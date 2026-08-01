import { CHAT_MODEL_ID } from "@/lib/ai/genkit";

import { AI_RELEASE_BINDINGS, AI_RELEASE_ID } from "./release";
import { createTurnIdentity, recordChatTurn } from "./server";
import type { PromptInjectionSignal } from "./safety";
import type {
  ChatOutcome,
  ChatTurnInput,
  ChatTurnIdentity,
  ChatValidationStatus,
} from "./types";

type RecordTurn = (input: ChatTurnInput) => Promise<{ stored: boolean; turnId: string }>;

type ChatTurnSessionInput = {
  conversationId?: string;
  requestId?: string | null;
  userMessage: string;
  injectionSignals: PromptInjectionSignal[];
  now?: () => number;
  record?: RecordTurn;
};

type FinalizeChatTurnInput = {
  assistantMessage?: string;
  outcome: ChatOutcome;
  selectedModel?: string;
  attemptCount?: number;
  validationStatus: ChatValidationStatus;
  validationReasons?: string[];
  retrievedRecordIds?: string[];
  cacheState?: string;
  errorClass?: string;
  metadata?: Record<string, unknown>;
};

export type ChatTurnSession = {
  identity: ChatTurnIdentity;
  markFirstToken(): void;
  finalize(input: FinalizeChatTurnInput): Promise<void>;
};

export function createChatTurnSession(input: ChatTurnSessionInput): ChatTurnSession {
  const now = input.now ?? Date.now;
  const persist = input.record ?? recordChatTurn;
  const startedAt = now();
  const identity = createTurnIdentity({
    conversationId: input.conversationId,
    requestId: input.requestId,
  });
  let firstTokenAt: number | undefined;
  let finalized = false;

  return {
    identity,
    markFirstToken() {
      firstTokenAt ??= now();
    },
    async finalize(finalInput) {
      if (finalized) return;
      finalized = true;

      const completedAt = now();
      const row: ChatTurnInput = {
        id: identity.turnId,
        conversationId: identity.conversationId,
        requestId: identity.requestId,
        releaseId: AI_RELEASE_ID,
        feedbackTokenHash: identity.feedbackTokenHash,
        userMessage: input.userMessage,
        assistantMessage: finalInput.assistantMessage,
        outcome: finalInput.outcome,
        requestedModel: CHAT_MODEL_ID,
        selectedModel: finalInput.selectedModel,
        promptVersion: AI_RELEASE_BINDINGS.promptVersion,
        attemptCount: finalInput.attemptCount ?? 0,
        latencyMs: Math.max(0, completedAt - startedAt),
        timeToFirstTokenMs:
          firstTokenAt === undefined ? undefined : Math.max(0, firstTokenAt - startedAt),
        cacheState: finalInput.cacheState,
        retrievedRecordIds: finalInput.retrievedRecordIds ?? [],
        validationStatus: finalInput.validationStatus,
        validationReasons: finalInput.validationReasons ?? [],
        injectionSignals: input.injectionSignals,
        errorClass: finalInput.errorClass,
        metadata: finalInput.metadata ?? {},
      };

      try {
        await persist(row);
      } catch {
        // Observability must never break the student-facing response path.
      }
    },
  };
}
