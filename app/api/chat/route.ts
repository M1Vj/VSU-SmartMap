import {
  executeFindLocation,
  sanitizeGeneratedLocationResponse,
  streamFindLocation,
  type FindLocationOperations,
} from "@/lib/ai/flows/find-location";
import { findFallbackFacilityRefs } from "@/lib/ai/facility-fallback-match";
import {
  getCachedChatAnswer,
  getChatQuestionHash,
  isChatAnswerCacheEligible,
  upsertCachedChatAnswer,
  type ChatAnswerCacheHit,
} from "@/lib/ai/answer-cache";
import { consumeDurableChatRateLimit } from "@/lib/ai/rate-limit";
import {
  ChatRequestError,
  getTrustedClientIp,
  parseChatRequest,
} from "@/lib/ai/ops/request";
import { detectPromptInjectionSignals } from "@/lib/ai/ops/safety";
import { createChatTurnSession, type ChatTurnSession } from "@/lib/ai/ops/trace";
import { notifyChatOpsAlert } from "@/lib/ai/ops/alerts";
import { AI_RELEASE_ID } from "@/lib/ai/ops/release";
import type { ChatOutcome, ChatValidationStatus } from "@/lib/ai/ops/types";
import { getFacilitiesByIds } from "@/lib/supabase/queries/facilities";
import { getFacilitiesForChatCached } from "@/lib/supabase/queries/facilities.server";
import { getBoardingHousesForChatCached } from "@/lib/supabase/queries/boarding-houses.server";
import { getEventsCached } from "@/lib/actions/events";
import { NextResponse } from "next/server";
import { CHAT_HISTORY } from "@/lib/constants/chat";
import { CHAT_MODEL_ID } from "@/lib/ai/genkit";
import type { BoardingHouseMatch, FacilityMatch, EventMatch } from "@/lib/types/chat";
import { buildChatFallbackContent, shouldUseChatFallback } from "@/lib/ai/chat-fallback";
import { shouldFinalizePartialStream } from "./streaming";

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
  operations?: FindLocationOperations;
  cachedModel?: string;
  turnId?: string;
  feedbackToken?: string;
  requestId?: string;
};
const encoder = new TextEncoder();

class GroundingValidationError extends Error {
  constructor(readonly operations: FindLocationOperations) {
    super("Grounding validation failed");
    this.name = "GroundingValidationError";
  }
}

function attachTurnCredential(
  payload: FinalChatPayload,
  session: ChatTurnSession,
): FinalChatPayload {
  return {
    ...payload,
    turnId: session.identity.turnId,
    feedbackToken: session.identity.feedbackToken,
    requestId: session.identity.requestId,
  };
}

function clientPayload(payload: FinalChatPayload) {
  return {
    content: payload.content,
    facilities: payload.facilities,
    events: payload.events,
    boardingHouses: payload.boardingHouses,
    turnId: payload.turnId,
    feedbackToken: payload.feedbackToken,
    requestId: payload.requestId,
  };
}

function payloadRecordIds(payload: FinalChatPayload): string[] {
  return [
    ...(payload.cacheRefs?.facilities ?? []).map(({ facilityId }) => `facility:${facilityId}`),
    ...(payload.cacheRefs?.events ?? []).map(({ eventId }) => `event:${eventId}`),
    ...(payload.cacheRefs?.boardingHouses ?? []).map(({ listingId }) => `boarding:${listingId}`),
  ];
}

async function finalizeTurn(
  session: ChatTurnSession,
  payload: FinalChatPayload | undefined,
  outcome: ChatOutcome,
  options: {
    validationStatus?: ChatValidationStatus;
    validationReasons?: string[];
    cacheState?: string;
    errorClass?: string;
  } = {},
) {
  const operations = payload?.operations;
  await session.finalize({
    assistantMessage: payload?.content,
    outcome,
    selectedModel: operations?.generation?.selectedModel ?? payload?.cachedModel,
    attemptCount: operations?.generation?.attemptCount ?? 0,
    validationStatus: options.validationStatus ?? operations?.grounding.outcome ?? "pass",
    validationReasons: options.validationReasons ?? operations?.grounding.reasonCodes ?? [],
    retrievedRecordIds: operations?.retrievedRecordIds ?? (payload ? payloadRecordIds(payload) : []),
    cacheState: options.cacheState,
    errorClass: options.errorClass,
  });
}

function classifyChatError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("grounding") || message.includes("validation")) return "validation_error";
  if (message.includes("timeout") || message.includes("etimedout")) return "provider_timeout";
  if (message.includes("429") || message.includes("quota")) return "provider_quota";
  if (message.includes("rate limit")) return "provider_rate_limit";
  if (message.includes("network") || message.includes("unavailable") || message.includes("econnrefused")) {
    return "provider_unavailable";
  }
  return "provider_error";
}

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

async function resolveEventMatches(
  events: Array<{
    eventId: string;
    title: string;
    startTime: string;
    endTime: string;
    locationText?: string;
    category: string;
  }> | undefined
): Promise<EventMatch[]> {
  if (!events?.length) return [];
  const today = new Date();
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);
  const { data } = await getEventsCached({ startDate: today, endDate: nextWeek });
  const canonical = new Map((data ?? []).map((event) => [event.id, event]));

  return events.flatMap((event) => {
    const current = canonical.get(event.eventId);
    if (
      !current ||
      current.title !== event.title ||
      current.startTime !== event.startTime ||
      current.endTime !== event.endTime ||
      (current.locationText ?? undefined) !== event.locationText ||
      current.category !== event.category
    ) {
      return [];
    }
    return [{
      eventId: current.id,
      title: current.title,
      startTime: current.startTime,
      endTime: current.endTime,
      locationText: current.locationText ?? undefined,
      category: current.category,
    }];
  });
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
  const events = await resolveEventMatches(cacheHit.events);

  return {
    content: cacheHit.content,
    facilities: facilities.length > 0 ? facilities : undefined,
    events: events.length > 0 ? events : undefined,
    boardingHouses: boardingHouses.length > 0 ? boardingHouses : undefined,
    cacheRefs: {
      facilities: cacheHit.facilities,
      events: cacheHit.events,
      boardingHouses: cacheHit.boardingHouses,
    },
    cachedModel: cacheHit.model,
  };
}

async function buildFinalChatPayload(
  message: string,
  context: ChatContext,
  abortSignal?: AbortSignal,
): Promise<FinalChatPayload> {
  const { output: result, operations } = await executeFindLocation(
    { query: message, context },
    { abortSignal },
  );

  const matches = await resolveFacilityMatches(result.facilities);
  const eventMatches = await resolveEventMatches(result.events);
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
    operations,
  };
}

async function buildStaticFallbackPayload(message: string): Promise<FinalChatPayload> {
  const { data } = await getFacilitiesForChatCached();
  const facilityRefs = data ? findFallbackFacilityRefs(message, data) : [];
  const facilities = await resolveFacilityMatches(facilityRefs);

  return {
    content: buildChatFallbackContent(message),
    facilities: facilities.length > 0 ? facilities : undefined,
    events: undefined,
    boardingHouses: undefined,
    cacheRefs: { facilities: facilityRefs },
  };
}

async function enqueueGeneratedFinal(
  controller: ReadableStreamDefaultController<Uint8Array>,
  message: string,
  context: ChatContext,
  session?: ChatTurnSession,
  abortSignal?: AbortSignal,
) {
  const generated = await buildFinalChatPayload(message, context, abortSignal);
  if (generated.operations?.grounding.outcome === "fail") {
    throw new GroundingValidationError(generated.operations);
  }
  const payload = session ? attachTurnCredential(generated, session) : generated;

  enqueueSse(controller, {
    type: "final",
    content: payload.content,
    facilities: payload.facilities,
    events: payload.events,
    boardingHouses: payload.boardingHouses,
    turnId: payload.turnId,
    feedbackToken: payload.feedbackToken,
    requestId: payload.requestId,
  });
  return payload;
}

async function enqueueStaticFallback(
  controller: ReadableStreamDefaultController<Uint8Array>,
  message: string,
  session?: ChatTurnSession,
) {
  const fallback = await buildStaticFallbackPayload(message);
  const payload = session ? attachTurnCredential(fallback, session) : fallback;

  enqueueSse(controller, {
    type: "final",
    content: payload.content,
    facilities: payload.facilities,
    events: payload.events,
    boardingHouses: payload.boardingHouses,
    turnId: payload.turnId,
    feedbackToken: payload.feedbackToken,
    requestId: payload.requestId,
  });
  return payload;
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
    model: payload.operations?.generation?.selectedModel ?? CHAT_MODEL_ID,
  });
}

export async function POST(request: Request) {
  let fallbackQuery = "";
  let turnSession: ChatTurnSession | undefined;

  try {
    const parsed = await parseChatRequest(request);
    const session = createChatTurnSession({
      conversationId: parsed.data.conversationId,
      requestId: request.headers.get("x-request-id"),
      userMessage: parsed.data.message,
      injectionSignals: detectPromptInjectionSignals(parsed.data.message),
    });
    turnSession = session;
    const rateLimit = await consumeDurableChatRateLimit({
      subject: getTrustedClientIp(request.headers),
      costBytes: parsed.byteLength,
    });
    if (!rateLimit.allowed) {
      await finalizeTurn(session, undefined, "rate_limited", {
        validationStatus: "pass",
        cacheState: "skipped",
      });
      return NextResponse.json(
        { error: rateLimit.message },
        {
          status: 429,
          headers: {
            "Cache-Control": "no-store",
            "Retry-After": String(rateLimit.retryAfterSeconds),
          },
        },
      );
    }

    const { message, streaming, history, summary: requestedSummary } = parsed.data;
    fallbackQuery = message;

    const previousQueries = getPreviousQueries(history);
    const conversationHistory = getConversationHistory(history);
    const summary = getConversationSummary(requestedSummary);
    const context = { previousQueries, conversationHistory, summary };
    if (process.env.CHAT_LLM_ENABLED?.trim().toLowerCase() === "false") {
      const payload = attachTurnCredential(await buildStaticFallbackPayload(message), session);
      session.markFirstToken();
      await finalizeTurn(session, payload, "disabled_fallback", {
        validationStatus: "pass",
        cacheState: "disabled",
      });
      if (streaming) {
        return createSseResponse((controller) => {
          enqueueSse(controller, { type: "chunk", content: payload.content });
          enqueueSse(controller, {
            type: "final",
            content: payload.content,
            facilities: payload.facilities,
            turnId: payload.turnId,
            feedbackToken: payload.feedbackToken,
            requestId: payload.requestId,
          });
          closeSse(controller);
        });
      }
      return NextResponse.json(clientPayload(payload), { headers: { "Cache-Control": "no-store" } });
    }
    const contextFreeQuestion = isContextFreeQuestion(context) && isChatAnswerCacheEligible(message);
    const questionHash = contextFreeQuestion ? getChatQuestionHash(message) : "";
    const cacheHit = contextFreeQuestion ? await getCachedChatAnswer(questionHash) : null;

    if (cacheHit) {
      const payload = attachTurnCredential(await buildCachedFinalPayload(cacheHit), session);
      session.markFirstToken();
      await finalizeTurn(session, payload, "cached", { cacheState: "hit" });

      if (streaming) {
        return createSseResponse((controller) => {
          enqueueSse(controller, { type: "chunk", content: payload.content });
          enqueueSse(controller, {
            type: "final",
            content: payload.content,
            facilities: payload.facilities,
            events: payload.events,
            boardingHouses: payload.boardingHouses,
            turnId: payload.turnId,
            feedbackToken: payload.feedbackToken,
            requestId: payload.requestId,
          });
          closeSse(controller);
        });
      }

      return NextResponse.json(clientPayload(payload), { headers: { "Cache-Control": "no-store" } });
    }

    if (streaming) {
      let stream: Awaited<ReturnType<typeof streamFindLocation>>;

      try {
        stream = await streamFindLocation({ query: message, context }, {
          abortSignal: request.signal,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to start stream";
        if (shouldUseChatFallback(errorMessage)) {
          return createSseResponse(async (controller) => {
            try {
              const payload = await enqueueGeneratedFinal(
                controller,
                message,
                context,
                session,
                request.signal,
              );
              session.markFirstToken();
              await finalizeTurn(session, payload, "generated_fallback", { cacheState: "miss" });
            } catch (fallbackError) {
              const payload = await enqueueStaticFallback(controller, message, session);
              if (fallbackError instanceof GroundingValidationError) {
                payload.operations = fallbackError.operations;
              }
              session.markFirstToken();
              const errorClass = classifyChatError(fallbackError);
              const fallbackOutcome = fallbackError instanceof GroundingValidationError
                ? "validation_failed"
                : "static_fallback";
              await finalizeTurn(session, payload, fallbackOutcome, {
                validationStatus: fallbackError instanceof GroundingValidationError ? undefined : "warn",
                validationReasons: fallbackError instanceof GroundingValidationError
                  ? undefined
                  : ["provider_fallback"],
                cacheState: "miss",
                errorClass,
              });
              await notifyChatOpsAlert({
                outcome: fallbackOutcome,
                errorClass,
                releaseId: AI_RELEASE_ID,
                requestId: session.identity.requestId,
              });
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
          }

          const response = await stream.response;
          if (!response.output) {
            if (shouldFinalizePartialStream(lastResponseText)) {
              const fallbackPayload = await enqueueStaticFallback(controller, message, session);
              await finalizeTurn(session, fallbackPayload, "static_fallback", {
                validationStatus: "warn",
                validationReasons: ["structured_output_missing"],
                cacheState: "miss",
                errorClass: "validation_error",
              });
              await notifyChatOpsAlert({
                outcome: "static_fallback",
                errorClass: "validation_error",
                releaseId: AI_RELEASE_ID,
                requestId: session.identity.requestId,
              });
              finalSent = true;
              return;
            }

            throw new Error("AI response missing output");
          }

          const grounding = sanitizeGeneratedLocationResponse(
            response.output,
            stream.operations.groundingContext,
          );
          const groundedOutput = grounding.response;
          if (grounding.outcome === "fail") {
            const fallbackPayload = attachTurnCredential({
              ...(await buildStaticFallbackPayload(message)),
              operations: {
                generation: stream.operations.generation,
                grounding,
                retrievedRecordIds: stream.operations.retrievedRecordIds,
              },
            }, session);
            session.markFirstToken();
            send({ type: "chunk", content: fallbackPayload.content });
            send({ type: "final", ...clientPayload(fallbackPayload) });
            await finalizeTurn(session, fallbackPayload, "validation_failed", {
              cacheState: "miss",
              errorClass: "validation_error",
            });
            await notifyChatOpsAlert({
              outcome: "validation_failed",
              errorClass: "validation_error",
              releaseId: AI_RELEASE_ID,
              requestId: session.identity.requestId,
            });
            finalSent = true;
            return;
          }
          const matches = await resolveFacilityMatches(groundedOutput.facilities);
          const eventMatches = await resolveEventMatches(groundedOutput.events);
          const boardingHouseMatches = await resolveBoardingHouseMatches(groundedOutput.boardingHouses);
          const payload: FinalChatPayload = attachTurnCredential({
            content: groundedOutput.response,
            facilities: matches.length > 0 ? matches : undefined,
            events: eventMatches.length > 0 ? eventMatches : undefined,
            boardingHouses: boardingHouseMatches.length > 0 ? boardingHouseMatches : undefined,
            cacheRefs: {
              facilities: groundedOutput.facilities,
              events: groundedOutput.events,
              boardingHouses: groundedOutput.boardingHouses,
            },
            operations: {
              generation: stream.operations.generation,
              grounding,
              retrievedRecordIds: stream.operations.retrievedRecordIds,
            },
          }, session);

          session.markFirstToken();
          send({ type: "chunk", content: payload.content });
          send({
            type: "final",
            content: payload.content,
            facilities: payload.facilities,
            events: payload.events,
            boardingHouses: payload.boardingHouses,
            turnId: payload.turnId,
            feedbackToken: payload.feedbackToken,
            requestId: payload.requestId,
          });
          await finalizeTurn(session, payload, "live", { cacheState: "miss" });
          if (contextFreeQuestion) {
            await cacheSuccessfulFinalPayload(questionHash, message, payload);
          }
          finalSent = true;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Failed to stream response";

          if (!finalSent && shouldFinalizePartialStream(lastResponseText)) {
            const fallbackPayload = await enqueueStaticFallback(controller, message, session);
            const errorClass = classifyChatError(error);
            await finalizeTurn(session, fallbackPayload, "static_fallback", {
              validationStatus: "warn",
              validationReasons: ["partial_stream_discarded"],
              cacheState: "miss",
              errorClass,
            });
            await notifyChatOpsAlert({
              outcome: "static_fallback",
              errorClass,
              releaseId: AI_RELEASE_ID,
              requestId: session.identity.requestId,
            });
            finalSent = true;
            return;
          }

          if (shouldUseChatFallback(errorMessage)) {
            try {
              const payload = await enqueueGeneratedFinal(
                controller,
                message,
                context,
                session,
                request.signal,
              );
              session.markFirstToken();
              await finalizeTurn(session, payload, "generated_fallback", { cacheState: "miss" });
            } catch (fallbackError) {
              const payload = await enqueueStaticFallback(controller, message, session);
              if (fallbackError instanceof GroundingValidationError) {
                payload.operations = fallbackError.operations;
              }
              session.markFirstToken();
              const errorClass = classifyChatError(fallbackError);
              const fallbackOutcome = fallbackError instanceof GroundingValidationError
                ? "validation_failed"
                : "static_fallback";
              await finalizeTurn(session, payload, fallbackOutcome, {
                validationStatus: fallbackError instanceof GroundingValidationError ? undefined : "warn",
                validationReasons: fallbackError instanceof GroundingValidationError
                  ? undefined
                  : ["provider_fallback"],
                cacheState: "miss",
                errorClass,
              });
              await notifyChatOpsAlert({
                outcome: fallbackOutcome,
                errorClass,
                releaseId: AI_RELEASE_ID,
                requestId: session.identity.requestId,
              });
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

          const errorClass = classifyChatError(error);
          await finalizeTurn(session, undefined, "error", {
            validationStatus: "fail",
            validationReasons: ["stream_failed"],
            cacheState: "miss",
            errorClass,
          });
          await notifyChatOpsAlert({
            outcome: "error",
            errorClass,
            releaseId: AI_RELEASE_ID,
            requestId: session.identity.requestId,
          });
          send({ type: "error", error: userMessage });
        } finally {
          closeSse(controller);
        }
      });
    }

    const generatedPayload = await buildFinalChatPayload(message, context, request.signal);
    if (generatedPayload.operations?.grounding.outcome === "fail") {
      const fallbackPayload = attachTurnCredential({
        ...(await buildStaticFallbackPayload(message)),
        operations: generatedPayload.operations,
      }, session);
      session.markFirstToken();
      await finalizeTurn(session, fallbackPayload, "validation_failed", {
        cacheState: "miss",
        errorClass: "validation_error",
      });
      await notifyChatOpsAlert({
        outcome: "validation_failed",
        errorClass: "validation_error",
        releaseId: AI_RELEASE_ID,
        requestId: session.identity.requestId,
      });
      return NextResponse.json(clientPayload(fallbackPayload), {
        headers: { "Cache-Control": "no-store" },
      });
    }
    const payload = attachTurnCredential(generatedPayload, session);
    session.markFirstToken();
    await finalizeTurn(session, payload, "live", { cacheState: "miss" });
    if (contextFreeQuestion) {
      await cacheSuccessfulFinalPayload(questionHash, message, payload);
    }

    return NextResponse.json(clientPayload(payload), { headers: { "Cache-Control": "no-store" } });
  } catch (error: unknown) {
    if (error instanceof ChatRequestError) {
      return NextResponse.json(
        { error: error.publicMessage },
        {
          status: error.status,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }

    console.error("Chat API request failed");

    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    if (shouldUseChatFallback(errorMessage)) {
      const fallbackPayload = turnSession
        ? attachTurnCredential(await buildStaticFallbackPayload(fallbackQuery), turnSession)
        : await buildStaticFallbackPayload(fallbackQuery);
      if (turnSession) {
        turnSession.markFirstToken();
        const errorClass = classifyChatError(error);
        await finalizeTurn(turnSession, fallbackPayload, "static_fallback", {
          validationStatus: "warn",
          validationReasons: ["provider_fallback"],
          cacheState: "miss",
          errorClass,
        });
        await notifyChatOpsAlert({
          outcome: "static_fallback",
          errorClass,
          releaseId: AI_RELEASE_ID,
          requestId: turnSession.identity.requestId,
        });
      }
      return NextResponse.json(clientPayload(fallbackPayload), { headers: { "Cache-Control": "no-store" } });
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

    if (turnSession) {
      const errorClass = classifyChatError(error);
      await finalizeTurn(turnSession, undefined, "error", {
        validationStatus: "fail",
        validationReasons: ["request_failed"],
        cacheState: "miss",
        errorClass,
      });
      await notifyChatOpsAlert({
        outcome: "error",
        errorClass,
        releaseId: AI_RELEASE_ID,
        requestId: turnSession.identity.requestId,
      });
    }

    return NextResponse.json(
      { error: userMessage },
      { status: statusCode, headers: { "Cache-Control": "no-store" } }
    );
  }
}
