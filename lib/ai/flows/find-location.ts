import { flow } from "@genkit-ai/core";
import { runWithKeyRotation, streamWithKeyRotation } from "../genkit";
import { LocationQuerySchema, LocationResponseSchema, LocationQuery } from "../schemas/location";
import { CAMPUS_ASSISTANT_PROMPT } from "../prompts/campus-assistant";
import { getFacilitiesForChatCached } from "@/lib/supabase/queries/facilities.server";
import { getAiKnowledgeForChatCached } from "@/lib/supabase/queries/ai-knowledge.server";
import { getBoardingHousesForChatCached } from "@/lib/supabase/queries/boarding-houses.server";
import { getEventsCached } from "@/lib/actions/events";
import type { FacilityChatContext } from "@/lib/supabase/queries/facilities";
import type { Event } from "@/lib/types/events";
import type { AiKnowledgeChatContext } from "@/lib/types/ai-knowledge";
import {
  buildRetrievalQuery,
  compactFacilitiesForPrompt,
  selectFacilitiesForChatContext,
} from "../context-selection";
import {
  compactBoardingHousesForPrompt,
  shouldIncludeBoardingHouseContext,
} from "../boarding-context";

const CHAT_GENERATION_CONFIG = {
  temperature: 0.3,
  maxOutputTokens: 1024,
};

function applyRoomCodeHint(query: string, facilitiesContext: FacilityChatContext[]): string {
  const roomCodePattern = /([A-Za-z]+)(\d{2,3})/i;
  const match = query.match(roomCodePattern);

  if (!match) return query;

  const prefix = match[1].toUpperCase();
  const specificRoomExists = facilitiesContext.some((facility) =>
    facility.rooms?.some((room) => room.roomCode?.toUpperCase() === query.toUpperCase())
  );

  if (specificRoomExists) return query;

  const inferredBuilding = facilitiesContext.find((facility) =>
    facility.name.toUpperCase().startsWith(prefix) ||
    facility.code?.toUpperCase() === prefix ||
    (facility.category === "academic" && facility.name.toUpperCase().includes(prefix))
  );

  if (!inferredBuilding) return query;

  return `${query} (Note: I couldn't find this specific room in my data, but based on the naming pattern, it is likely located in the ${inferredBuilding.name}. I will assume it's there and explicitly mention this assumption to the user.)`;
}

function formatConversationHistory(input: LocationQuery): string {
  const contextData = input.context || {};

  return contextData.conversationHistory?.length
    ? contextData.conversationHistory
      .slice(-6)
      .map((msg) => {
        let content = msg.content;
        if (msg.role === "assistant") {
          try {
            const parsed = JSON.parse(msg.content);
            content = parsed.response || msg.content;
          } catch {
          }
        }
        return `${msg.role === "user" ? "User" : "Assistant"}: ${content}`;
      })
      .join("\n")
    : "None";
}

function formatKnowledgeContext(entries: AiKnowledgeChatContext[]): string {
  if (entries.length === 0) return "[]";

  let remainingBudget = 5200;
  return JSON.stringify(
    entries.map((entry) => {
      const contentBudget = Math.max(240, Math.min(900, remainingBudget));
      const content = entry.content.slice(0, contentBudget);
      remainingBudget -= content.length;

      return {
        id: entry.id,
        title: entry.title,
        content,
        keywords: entry.keywords,
        source: entry.source,
        priority: entry.priority,
      };
    })
  );
}

async function buildChatPrompt(input: LocationQuery): Promise<string> {
  const { data: facilitiesContext } = await getFacilitiesForChatCached();
  const facilities = facilitiesContext || [];
  const contextData = input.context || {};
  const retrievalQuery = buildRetrievalQuery(input.query, contextData);
  const selectedFacilities = selectFacilitiesForChatContext(facilities, retrievalQuery);
  const includeBoardingHouses = shouldIncludeBoardingHouseContext(retrievalQuery);

  const today = new Date();
  const nextWeek = new Date();
  nextWeek.setDate(today.getDate() + 7);

  const [
    { data: eventsData },
    { data: knowledgeData },
    { data: boardingHousesData },
  ] = await Promise.all([
    getEventsCached({
      startDate: today,
      endDate: nextWeek,
    }),
    getAiKnowledgeForChatCached({
      query: retrievalQuery,
      limit: 8,
    }),
    includeBoardingHouses
      ? getBoardingHousesForChatCached()
      : Promise.resolve({ data: [], error: null }),
  ]);

  const validContext = compactFacilitiesForPrompt(selectedFacilities);

  const eventsContext = ((eventsData || []) as Event[]).map((event) => ({
    id: event.id,
    title: event.title,
    description: event.description ? event.description.slice(0, 180) : undefined,
    startTime: event.startTime,
    endTime: event.endTime,
    locationText: event.locationText,
    locationId: event.locationId,
    category: event.category,
  }));

  const userQuery = applyRoomCodeHint(input.query, facilities);
  const summary = contextData.summary || "None";
  const conversationHistory = formatConversationHistory(input);
  const knowledgeContext = formatKnowledgeContext(knowledgeData || []);
  const boardingHousesContext = includeBoardingHouses
    ? compactBoardingHousesForPrompt(boardingHousesData || [])
    : "[]";

  return `
${CAMPUS_ASSISTANT_PROMPT}

## Context
User Query: "${userQuery}"

Previous Conversation Summary:
${summary}

Recent Conversation History:
${conversationHistory}

## Admin-Verified University Knowledge
${knowledgeContext}

## Retrieved Facilities
${JSON.stringify(validContext)}

The retrieved facilities are a query-focused subset of the campus map. Use only facilities in this list for facility IDs and cards. If the user clearly asks for a campus place but the relevant facility is not present, say you do not have enough verified map context and ask for another name, code, or landmark.

## Available Events (Next 7 Days)
${JSON.stringify(eventsContext)}

## Available Boarding House Listings
${boardingHousesContext}

Answer the user's query using the admin-verified university knowledge, available facilities, events, and provided boarding house listings. Prefer admin-verified knowledge for policies, office processes, schedules, and university facts. If none of the provided data supports an answer, say you do not have verified information and ask a focused follow-up.
`;
}

export const findLocationFlow = flow(
  {
    name: "findLocation",
    inputSchema: LocationQuerySchema,
    outputSchema: LocationResponseSchema,
  },
  async (input: LocationQuery) => {
    const prompt = await buildChatPrompt(input);

    return await runWithKeyRotation(async (ai) => {
      const result = await ai.generate({
        prompt: prompt,
        output: { schema: LocationResponseSchema },
        config: CHAT_GENERATION_CONFIG,
      });

      if (!result.output) {
        throw new Error("AI failed to generate a response");
      }

      return result.output;
    });
  }
);

export async function streamFindLocation(input: LocationQuery) {
  const prompt = await buildChatPrompt(input);

  return await streamWithKeyRotation(async (ai) => {
    return await ai.generateStream({
      prompt: prompt,
      output: { schema: LocationResponseSchema },
      config: CHAT_GENERATION_CONFIG,
    });
  });
}
