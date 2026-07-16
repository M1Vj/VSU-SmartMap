import {
  findLocationFlow,
  streamFindLocation,
} from "@/lib/ai/flows/find-location";
import { findFallbackFacilityRefs } from "@/lib/ai/facility-fallback-match";
import {
  getCachedChatAnswer,
  getChatQuestionHash,
  upsertCachedChatAnswer,
  type ChatAnswerCacheHit,
} from "@/lib/ai/answer-cache";
import { chatRateLimiter, getClientIp } from "@/lib/ai/rate-limit";
import { getFacilitiesByIds } from "@/lib/supabase/queries/facilities";
import { getFacilitiesForChatCached } from "@/lib/supabase/queries/facilities.server";
import { getBoardingHousesForChatCached } from "@/lib/supabase/queries/boarding-houses.server";
import { NextResponse } from "next/server";
import { CHAT_HISTORY } from "@/lib/constants/chat";
import { CHAT_MODEL_ID } from "@/lib/ai/genkit";
import type { BoardingHouseMatch, FacilityMatch, EventMatch } from "@/lib/types/chat";
import { buildChatFallbackContent, shouldUseChatFallback } from "@/lib/ai/chat-fallback";
import {
  buildPartialStreamFinalPayload,
  shouldFinalizePartialStream,
} from "./streaming";

type HistoryEntry = { role: "user" | "assistant"; content: string };
type ChatContext = {
  previousQueries: string[];
  conversationHistory: HistoryEntry[];
  summary?: string;
};
type BoardingHouseRef = { listingId: string; name: string };
type FinalChatPayload = {
  content: string;
  facilities?: FacilityMatch[];
  events?: EventMatch[];
  boardingHouses?: BoardingHouseMatch[];
  cacheRefs?: {
    facilities?: Array<{ facilityId: string; name: string }>;
    events?: EventMatch[];
    boardingHouses?: BoardingHouseRef[];
  };
};
const encoder = new TextEncoder();

function createSseResponse(start: (controller: ReadableStreamDefaultController<Uint8Array>) => Promise<void> | void) {
  const readable = new ReadableStream({
    async start(controller) {
      await start(controller);
    },
  });

  return new Response(readable, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

function enqueueSse(controller: ReadableStreamDefaultController<Uint8Array>, data: unknown) {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
}

function closeSse(controller: ReadableStreamDefaultController<Uint8Array>) {
  controller.enqueue(encoder.encode("data: [DONE]\n\n"));
  controller.close();
}

function getPreviousQueries(history: unknown): string[] {
  if (!Array.isArray(history)) return [];

  return history
    .filter(
      (entry): entry is HistoryEntry =>
        entry?.role === "user" && typeof entry.content === "string"
    )
    .map((entry) => entry.content)
    .filter(Boolean)
    .slice(-CHAT_HISTORY.MAX_CONTEXT_MESSAGES);
}

function getConversationHistory(history: unknown): HistoryEntry[] {
  if (!Array.isArray(history)) return [];

  return history
    .filter(
      (entry): entry is HistoryEntry =>
        (entry?.role === "user" || entry?.role === "assistant") &&
        typeof entry.content === "string" &&
        entry.content.trim().length > 0
    )
    .slice(-CHAT_HISTORY.MAX_CONTEXT_MESSAGES);
}

function getConversationSummary(summary: unknown): string | undefined {
  if (typeof summary !== "string") return undefined;
  const normalized = summary.replace(/\s+/g, " ").trim();
  if (!normalized) return undefined;
  return normalized.slice(0, CHAT_HISTORY.MAX_CONTEXT_SUMMARY_CHARS);
}

async function resolveFacilityMatches(
  facilities: Array<{ facilityId: string; name: string }> | undefined
): Promise<FacilityMatch[]> {
  if (!facilities?.length) return [];

  const ids = Array.from(new Set(facilities.map((f) => f.facilityId)));
  const { data } = await getFacilitiesByIds({ ids });

  if (!data) return [];

  return facilities
    .map((facility) => {
      const fullFacility = data.find((item) => item.id === facility.facilityId);
      if (!fullFacility) return null;

      return {
        facility: fullFacility,
        matchReason: "",
        confidence: 1,
      };
    })
    .filter(Boolean) as FacilityMatch[];
}

function resolveEventMatches(
  events: Array<{
    eventId: string;
    title: string;
    startTime: string;
    endTime: string;
    locationText?: string;
    category: string;
  }> | undefined
): EventMatch[] {
  if (!events?.length) return [];

  return events.map((event) => ({
    eventId: event.eventId,
    title: event.title,
    startTime: event.startTime,
    endTime: event.endTime,
    locationText: event.locationText,
    category: event.category,
  }));
}

async function resolveBoardingHouseMatches(
  boardingHouses: BoardingHouseRef[] | undefined
): Promise<BoardingHouseMatch[]> {
  if (!boardingHouses?.length) return [];

  const ids = new Set(boardingHouses.map((listing) => listing.listingId));
  const { data } = await getBoardingHousesForChatCached();
  if (!data) return [];

  return data
    .filter((listing) => ids.has(listing.id))
    .map((listing) => ({
      listingId: listing.id,
      name: listing.name,
      slug: listing.slug,
      priceMin: listing.priceMin,
      priceMax: listing.priceMax,
      availableSlots: listing.availableSlots,
      walkingMinutesToCampusGate: listing.walkingMinutesToCampusGate,
    }));
}

async function buildCachedFinalPayload(cacheHit: ChatAnswerCacheHit): Promise<FinalChatPayload> {
  const facilities = await resolveFacilityMatches(cacheHit.facilities);
  const boardingHouses = await resolveBoardingHouseMatches(cacheHit.boardingHouses);
  const events = resolveEventMatches(cacheHit.events);

  return {
    content: cacheHit.content,
    facilities: facilities.length > 0 ? facilities : undefined,
    events: events.length > 0 ? events : undefined,
    boardingHouses: boardingHouses.length > 0 ? boardingHouses : undefined,
  };
}

async function buildFinalChatPayload(message: string, context: ChatContext): Promise<FinalChatPayload> {
  const result = await findLocationFlow({
    query: message,
    context,
  });

  const matches = await resolveFacilityMatches(result.facilities);
  const eventMatches = resolveEventMatches(result.events);
  const boardingHouseMatches = await resolveBoardingHouseMatches(result.boardingHouses);

  return {
    content: result.response,
    facilities: matches.length > 0 ? matches : undefined,
    events: eventMatches.length > 0 ? eventMatches : undefined,
    boardingHouses: boardingHouseMatches.length > 0 ? boardingHouseMatches : undefined,
    cacheRefs: {
      facilities: result.facilities,
      events: result.events,
      boardingHouses: result.boardingHouses,
    },
  };
}

async function buildPartialStreamPayload(message: string, content: string): Promise<FinalChatPayload> {
  const { data } = await getFacilitiesForChatCached();
  const facilityRefs = data ? findFallbackFacilityRefs(message, data) : [];
  const facilities = await resolveFacilityMatches(facilityRefs);

  return {
    content,
    facilities: facilities.length > 0 ? facilities : undefined,
  };
}

async function buildStaticFallbackPayload(message: string) {
  const { data } = await getFacilitiesForChatCached();
  const facilityRefs = data ? findFallbackFacilityRefs(message, data) : [];
  const facilities = await resolveFacilityMatches(facilityRefs);

  return {
    content: buildChatFallbackContent(message),
    facilities: facilities.length > 0 ? facilities : undefined,
    events: undefined,
    boardingHouses: undefined,
  };
}

async function enqueueGeneratedFinal(
  controller: ReadableStreamDefaultController<Uint8Array>,
  message: string,
  context: ChatContext
) {
  const payload = await buildFinalChatPayload(message, context);

  enqueueSse(controller, {
    type: "final",
    content: payload.content,
    facilities: payload.facilities,
    events: payload.events,
    boardingHouses: payload.boardingHouses,
  });
}

async function enqueueStaticFallback(
  controller: ReadableStreamDefaultController<Uint8Array>,
  message: string
) {
  const payload = await buildStaticFallbackPayload(message);

  enqueueSse(controller, {
    type: "final",
    content: payload.content,
    facilities: payload.facilities,
    events: payload.events,
    boardingHouses: payload.boardingHouses,
  });
}

function isContextFreeQuestion(context: ChatContext): boolean {
  return context.conversationHistory.length === 0 && !context.summary;
}

async function cacheSuccessfulFinalPayload(
  questionHash: string,
  question: string,
  payload: FinalChatPayload
) {
  await upsertCachedChatAnswer(questionHash, {
    question,
    content: payload.content,
    facilities: payload.cacheRefs?.facilities,
    events: payload.cacheRefs?.events,
    boardingHouses: payload.cacheRefs?.boardingHouses,
    model: CHAT_MODEL_ID,
  });
}

export async function POST(request: Request) {
  let fallbackQuery = "";

  try {
    const rateLimit = chatRateLimiter.check(getClientIp(request.headers));
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: rateLimit.message }, { status: 429 });
    }

    const body = await request.json();
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    fallbackQuery = message;
    const streaming = Boolean(body?.streaming);
    const history = Array.isArray(body?.history) ? body.history : [];

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const previousQueries = getPreviousQueries(history);
    const conversationHistory = getConversationHistory(history);
    const summary = getConversationSummary(body?.summary);
    const context = { previousQueries, conversationHistory, summary };
    const contextFreeQuestion = isContextFreeQuestion(context);
    const questionHash = contextFreeQuestion ? getChatQuestionHash(message) : "";
    const cacheHit = contextFreeQuestion ? await getCachedChatAnswer(questionHash) : null;

    if (cacheHit) {
      const payload = await buildCachedFinalPayload(cacheHit);

      if (streaming) {
        return createSseResponse((controller) => {
          enqueueSse(controller, { type: "chunk", content: payload.content });
          enqueueSse(controller, {
            type: "final",
            content: payload.content,
            facilities: payload.facilities,
            events: payload.events,
            boardingHouses: payload.boardingHouses,
          });
          closeSse(controller);
        });
      }

      return NextResponse.json(payload);
    }

    if (streaming) {
      let stream: Awaited<ReturnType<typeof streamFindLocation>>;

      try {
        stream = await streamFindLocation({
          query: message,
          context,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to start stream";
        if (shouldUseChatFallback(errorMessage)) {
          return createSseResponse(async (controller) => {
            try {
              await enqueueGeneratedFinal(controller, message, context);
            } catch {
              await enqueueStaticFallback(controller, message);
            } finally {
              closeSse(controller);
            }
          });
        }

        throw error;
      }

      return createSseResponse(async (controller) => {
        const send = (data: unknown) => enqueueSse(controller, data);
        let lastResponseText = "";
        let finalSent = false;

        try {
          for await (const chunk of stream.stream) {
            const output = (chunk as { output?: { response?: string } }).output;
            if (!output?.response) continue;

            const newText = output.response.slice(lastResponseText.length);
            if (!newText) continue;

            lastResponseText = output.response;
            send({ type: "chunk", content: newText });
          }

          const response = await stream.response;
          if (!response.output) {
            if (shouldFinalizePartialStream(lastResponseText)) {
              const recoveredPayload = await buildPartialStreamPayload(message, lastResponseText);
              send(buildPartialStreamFinalPayload(lastResponseText, recoveredPayload));
              finalSent = true;
              return;
            }

            throw new Error("AI response missing output");
          }

          const matches = await resolveFacilityMatches(response.output.facilities);
          const eventMatches = resolveEventMatches(response.output.events);
          const boardingHouseMatches = await resolveBoardingHouseMatches(response.output.boardingHouses);
          const payload: FinalChatPayload = {
            content: response.output.response,
            facilities: matches.length > 0 ? matches : undefined,
            events: eventMatches.length > 0 ? eventMatches : undefined,
            boardingHouses: boardingHouseMatches.length > 0 ? boardingHouseMatches : undefined,
            cacheRefs: {
              facilities: response.output.facilities,
              events: response.output.events,
              boardingHouses: response.output.boardingHouses,
            },
          };

          send({
            type: "final",
            content: payload.content,
            facilities: payload.facilities,
            events: payload.events,
            boardingHouses: payload.boardingHouses,
          });
          if (contextFreeQuestion) {
            await cacheSuccessfulFinalPayload(questionHash, message, payload);
          }
          finalSent = true;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Failed to stream response";

          if (!finalSent && shouldFinalizePartialStream(lastResponseText)) {
            const recoveredPayload = await buildPartialStreamPayload(message, lastResponseText);
            send(buildPartialStreamFinalPayload(lastResponseText, recoveredPayload));
            finalSent = true;
            return;
          }

          if (shouldUseChatFallback(errorMessage)) {
            try {
              await enqueueGeneratedFinal(controller, message, context);
            } catch {
              await enqueueStaticFallback(controller, message);
            }
            return;
          }

          let userMessage = "Sorry, I encountered an error. Please try again.";

          if (errorMessage.includes("429") || errorMessage.includes("quota") || errorMessage.includes("Too Many Requests")) {
            userMessage = "I'm currently experiencing high traffic. Please wait a moment and try again.";
          } else if (errorMessage.includes("rate limit") || errorMessage.includes("Max retries")) {
            userMessage = "Too many requests right now. Please try again in a few seconds.";
          } else if (errorMessage.includes("timeout") || errorMessage.includes("ETIMEDOUT")) {
            userMessage = "The request timed out. Please try again.";
          } else if (errorMessage.includes("network") || errorMessage.includes("ECONNREFUSED")) {
            userMessage = "Network connection issue. Please check your connection and try again.";
          }

          send({ type: "error", error: userMessage });
        } finally {
          closeSse(controller);
        }
      });
    }

    const payload = await buildFinalChatPayload(message, context);
    if (contextFreeQuestion) {
      await cacheSuccessfulFinalPayload(questionHash, message, payload);
    }

    return NextResponse.json({
      content: payload.content,
      facilities: payload.facilities,
      events: payload.events,
      boardingHouses: payload.boardingHouses,
    });
  } catch (error: unknown) {
    console.error("Chat API Error:", error);

    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    if (shouldUseChatFallback(errorMessage)) {
      return NextResponse.json(await buildStaticFallbackPayload(fallbackQuery));
    }

    let userMessage = "Sorry, I encountered an error. Please try again.";
    let statusCode = 500;

    if (errorMessage.includes("429") || errorMessage.includes("quota") || errorMessage.includes("Too Many Requests")) {
      userMessage = "I'm currently experiencing high traffic. Please wait a moment and try again.";
      statusCode = 429;
    } else if (errorMessage.includes("rate limit") || errorMessage.includes("Max retries")) {
      userMessage = "Too many requests right now. Please try again in a few seconds.";
      statusCode = 429;
    } else if (errorMessage.includes("timeout") || errorMessage.includes("ETIMEDOUT")) {
      userMessage = "The request timed out. Please try again.";
      statusCode = 504;
    } else if (errorMessage.includes("network") || errorMessage.includes("ECONNREFUSED")) {
      userMessage = "Network connection issue. Please check your connection and try again.";
      statusCode = 503;
    }

    return NextResponse.json(
      { error: userMessage },
      { status: statusCode }
    );
  }
}
