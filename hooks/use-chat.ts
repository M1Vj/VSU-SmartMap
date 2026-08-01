"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { prepareChatContextPayload, truncateHistory } from "@/lib/ai/history";
import type {
  BoardingHouseMatch,
  ChatFeedbackCredentials,
  ChatMessage,
  ChatState,
  FacilityMatch,
  EventMatch,
} from "@/lib/types";

const CHAT_STORAGE_KEY = "vsu-smartmap-chat";
const CHAT_CONVERSATION_ID_KEY = "vsu-smartmap-chat-conversation-id";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function getOrCreateConversationId(
  storage: StorageLike,
  createUuid: () => string = () => crypto.randomUUID(),
) {
  const stored = storage.getItem(CHAT_CONVERSATION_ID_KEY);
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(stored ?? "")) {
    return stored!;
  }
  const conversationId = createUuid();
  storage.setItem(CHAT_CONVERSATION_ID_KEY, conversationId);
  return conversationId;
}

export function buildChatRequestBody(input: {
  message: string;
  history: ReturnType<typeof prepareChatContextPayload>["history"];
  summary: ReturnType<typeof prepareChatContextPayload>["summary"];
  streaming: boolean;
  conversationId: string;
}) {
  return input;
}

export function readFeedbackCredentials(payload: unknown): ChatFeedbackCredentials | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const { turnId, feedbackToken, requestId } = payload as Record<string, unknown>;
  return typeof turnId === "string" &&
    typeof feedbackToken === "string" &&
    typeof requestId === "string"
    ? { turnId, feedbackToken, requestId }
    : undefined;
}

function createMessageId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function applyTruncation(messages: ChatMessage[]) {
  return truncateHistory(messages).messages;
}

function loadMessagesFromStorage(): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(CHAT_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((msg: ChatMessage) => ({
      ...msg,
      timestamp: new Date(msg.timestamp),
    }));
  } catch {
    return [];
  }
}

function saveMessagesToStorage(messages: ChatMessage[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
  } catch (error) {
    if (error instanceof DOMException && error.name === "QuotaExceededError") {
      console.warn("Chat history storage quota exceeded");
    }
  }
}

function clearMessagesFromStorage() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(CHAT_STORAGE_KEY);
  } catch {
  }
}

interface UseChatOptions {
  streaming?: boolean;
}

export function useChat({ streaming = true }: UseChatOptions = {}) {
  const [state, setState] = useState<ChatState>({
    messages: [],
    isLoading: false,
    error: null,
  });
  const abortControllerRef = useRef<AbortController | null>(null);
  const initialized = useRef(false);
  const conversationIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!initialized.current) {
      conversationIdRef.current = getOrCreateConversationId(localStorage);
      const storedMessages = loadMessagesFromStorage();
      if (storedMessages.length > 0) {
        setState((prev) => ({ ...prev, messages: storedMessages }));
      }
      initialized.current = true;
    }
  }, []);

  useEffect(() => {
    if (initialized.current && !state.isLoading) {
      saveMessagesToStorage(state.messages);
    }
  }, [state.messages, state.isLoading]);

  const executeRequest = useCallback(
    async (
      content: string,
      baseMessages: ChatMessage[],
      userMessage: ChatMessage
    ) => {
      const assistantId = createMessageId();
      const messagesWithUser = applyTruncation([...baseMessages, userMessage]);
      const contextPayload = prepareChatContextPayload(baseMessages);

      setState({
        messages: messagesWithUser,
        isLoading: true,
        error: null,
      });

      const addAssistantPlaceholder = () =>
        setState((prev) => ({
          ...prev,
          messages: applyTruncation([
            ...prev.messages,
            {
              id: assistantId,
              role: "assistant",
              content: "",
              timestamp: new Date(),
            },
          ]),
        }));

      const updateAssistantMessage = (
        updater: (message: ChatMessage) => ChatMessage
      ) =>
        setState((prev) => ({
          ...prev,
          messages: prev.messages.map((message) =>
            message.id === assistantId ? updater(message) : message
          ),
        }));

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildChatRequestBody({
            message: content,
            history: contextPayload.history,
            summary: contextPayload.summary,
            streaming,
            conversationId:
              conversationIdRef.current ?? getOrCreateConversationId(localStorage),
          })),
          signal: abortControllerRef.current!.signal,
        });

        if (!res.ok) {
          const maybeError = await res.json().catch(() => null);
          const message = maybeError?.error || `Request failed: ${res.status}`;
          throw new Error(message);
        }

        if (streaming && res.body) {
          addAssistantPlaceholder();

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          let fullContent = "";
          let resolvedFinalContent = "";
          let facilities: FacilityMatch[] | undefined;
          let events: EventMatch[] | undefined;
          let boardingHouses: BoardingHouseMatch[] | undefined;
          let followUp: string | null = null;
          let feedbackCredentials: ChatFeedbackCredentials | undefined;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n\n");
            buffer = lines.pop() ?? "";

            for (const event of lines) {
              const line = event.trim();
              if (!line.startsWith("data:")) continue;

              const payloadRaw = line.slice(5).trim();
              if (!payloadRaw || payloadRaw === "[DONE]") continue;

              let payload: unknown;
              try {
                payload = JSON.parse(payloadRaw);
              } catch {
                continue;
              }

              if (!payload || typeof payload !== "object") continue;
              const type = (payload as { type?: string }).type;

              if (
                type === "chunk" &&
                typeof (payload as { content?: unknown }).content === "string"
              ) {
                fullContent += (payload as { content: string }).content;
                updateAssistantMessage((message) => ({
                  ...message,
                  content: fullContent,
                }));
              } else if (type === "final") {
                const finalContent =
                  typeof (payload as { content?: unknown }).content === "string"
                    ? (payload as { content: string }).content
                    : fullContent;
                resolvedFinalContent = finalContent;

                const maybeFacilities = (payload as {
                  facilities?: FacilityMatch[];
                }).facilities;
                facilities = Array.isArray(maybeFacilities)
                  ? maybeFacilities
                  : undefined;

                const maybeEvents = (payload as {
                  events?: EventMatch[];
                }).events;
                events = Array.isArray(maybeEvents)
                  ? maybeEvents
                  : undefined;

                const maybeBoardingHouses = (payload as {
                  boardingHouses?: BoardingHouseMatch[];
                }).boardingHouses;
                boardingHouses = Array.isArray(maybeBoardingHouses)
                  ? maybeBoardingHouses
                  : undefined;

                const maybeFollowUp = (payload as { followUp?: unknown })
                  .followUp;
                followUp =
                  typeof maybeFollowUp === "string" && maybeFollowUp.trim()
                    ? maybeFollowUp
                    : null;
                feedbackCredentials = readFeedbackCredentials(payload);

                updateAssistantMessage((message) => ({
                  ...message,
                  content: finalContent,
                  facilities,
                  events,
                  boardingHouses,
                  followUp,
                  ...feedbackCredentials,
                }));
              } else if (
                type === "error" &&
                (payload as { error?: unknown }).error
              ) {
                const message =
                  typeof (payload as { error?: unknown }).error === "string"
                    ? (payload as { error: string }).error
                    : "Chat failed";
                throw new Error(message);
              }
            }
          }

          setState((prev) => ({
            ...prev,
            isLoading: false,
            messages: prev.messages.map((message) =>
              message.id === assistantId
                ? {
                  ...message,
                  content: resolvedFinalContent || fullContent || message.content,
                  facilities,
                  events,
                  boardingHouses,
                  followUp,
                  ...feedbackCredentials,
                }
                : message
            ),
          }));
          return true;
        }

        const data = (await res.json()) as {
          content?: string;
          facilities?: FacilityMatch[];
          events?: EventMatch[];
          boardingHouses?: BoardingHouseMatch[];
          followUp?: string | null;
          turnId?: string;
          feedbackToken?: string;
          requestId?: string;
          error?: string;
        };

        if (data.error) {
          throw new Error(data.error);
        }

        const assistantMessage: ChatMessage = {
          id: assistantId,
          role: "assistant",
          content: data.content || "No response",
          timestamp: new Date(),
          facilities: data.facilities,
          events: data.events,
          boardingHouses: data.boardingHouses,
          followUp: data.followUp ?? null,
          ...readFeedbackCredentials(data),
        };

        setState((prev) => ({
          ...prev,
          messages: applyTruncation([...prev.messages, assistantMessage]),
          isLoading: false,
        }));
        return true;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          setState((prev) => ({ ...prev, isLoading: false }));
          return false;
        }

        const errorMessage =
          err instanceof Error ? err.message : "Something went wrong";

        const errorAssistant: ChatMessage = {
          id: assistantId,
          role: "assistant",
          content: errorMessage,
          timestamp: new Date(),
          isError: true,
        };

        setState((prev) => ({
          ...prev,
          messages: applyTruncation([...prev.messages, errorAssistant]),
          isLoading: false,
          error: errorMessage,
        }));
        return false;
      }
    },
    [streaming]
  );

  const sendMessage = useCallback(
    // Resolves true only when an answer actually arrived. The daily allowance
    // is charged against this, so a failed or aborted request must not count.
    async (content: string): Promise<boolean> => {
      const trimmed = content.trim();
      if (!trimmed) return false;

      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      const userMessage: ChatMessage = {
        id: createMessageId(),
        role: "user",
        content: trimmed,
        timestamp: new Date(),
      };

      return executeRequest(trimmed, state.messages, userMessage);
    },
    [state.messages, executeRequest]
  );

  const clearMessages = useCallback(() => {
    abortControllerRef.current?.abort();
    clearMessagesFromStorage();
    setState({
      messages: [],
      isLoading: false,
      error: null,
    });
  }, []);

  // Also resolves true only on a delivered answer, so a retry is charged
  // against the daily allowance exactly like a first attempt. Discarding this
  // result would make fail-then-retry an unlimited free path.
  const retryLastMessage = useCallback(async (): Promise<boolean> => {
    const lastUserMessage = [...state.messages]
      .reverse()
      .find((message) => message.role === "user");

    if (!lastUserMessage) return false;

    const cleanedMessages = state.messages.filter(
      (msg) =>
        !(msg.role === "assistant" && msg.isError) &&
        msg.id !== lastUserMessage.id
    );

    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    const userMessage: ChatMessage = {
      id: createMessageId(),
      role: "user",
      content: lastUserMessage.content,
      timestamp: new Date(),
    };

    return executeRequest(lastUserMessage.content, cleanedMessages, userMessage);
  }, [state.messages, executeRequest]);

  return {
    messages: state.messages,
    isLoading: state.isLoading,
    error: state.error,
    sendMessage,
    clearMessages,
    retryLastMessage,
  };
}
