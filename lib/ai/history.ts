import { CHAT_HISTORY } from "@/lib/constants/chat";
import type { ChatMessage } from "@/lib/types";

interface TruncationResult {
  messages: ChatMessage[];
  wasTruncated: boolean;
  removedCount: number;
}

export function truncateHistory(
  messages: ChatMessage[],
  maxMessages = CHAT_HISTORY.MAX_MESSAGES
): TruncationResult {
  if (messages.length <= maxMessages) {
    return {
      messages,
      wasTruncated: false,
      removedCount: 0,
    };
  }

  const removedCount = messages.length - maxMessages;
  const truncated = messages.slice(-maxMessages);

  return {
    messages: truncated,
    wasTruncated: true,
    removedCount,
  };
}

export function prepareHistoryForContext(
  messages: ChatMessage[],
  maxContextMessages = CHAT_HISTORY.MAX_CONTEXT_MESSAGES
): Array<{ role: "user" | "assistant"; content: string }> {
  const recentMessages = messages
    .filter((message) => !message.isError && message.content.trim().length > 0)
    .slice(-maxContextMessages);

  return recentMessages.map((m) => ({
    role: m.role,
    content: compactText(m.content, CHAT_HISTORY.MAX_CONTEXT_CHARS_PER_MESSAGE),
  }));
}

function compactText(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function summarizeOlderMessages(messages: ChatMessage[]): string | undefined {
  const olderMessages = messages
    .filter((message) => !message.isError && message.content.trim().length > 0)
    .slice(0, -CHAT_HISTORY.MAX_CONTEXT_MESSAGES);

  if (olderMessages.length === 0) return undefined;

  const summaryParts = olderMessages.slice(-8).map((message) => {
    const label = message.role === "user" ? "User asked" : "Assistant answered";
    const content = compactText(message.content, 180);
    const facilities = message.facilities?.length
      ? ` Shown: ${message.facilities
        .slice(0, 4)
        .map((match) => match.facility.name)
        .join(", ")}.`
      : "";

    return `${label}: ${content}.${facilities}`;
  });

  return compactText(summaryParts.join(" "), CHAT_HISTORY.MAX_CONTEXT_SUMMARY_CHARS);
}

export function prepareChatContextPayload(messages: ChatMessage[]): {
  history: Array<{ role: "user" | "assistant"; content: string }>;
  summary?: string;
} {
  return {
    history: prepareHistoryForContext(messages),
    summary: summarizeOlderMessages(messages),
  };
}

export function estimateTokenCount(messages: ChatMessage[]): number {
  return messages.reduce((total, m) => {
    const wordCount = m.content.split(/\s+/).length;
    return total + Math.ceil(wordCount * 1.3);
  }, 0);
}

export function shouldSummarize(messages: ChatMessage[]): boolean {
  return messages.length >= CHAT_HISTORY.SUMMARY_THRESHOLD;
}
