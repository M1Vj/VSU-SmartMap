"use client";

import { AlertCircle } from "lucide-react";
import type { ChatMessage as ChatMessageType } from "@/lib/types";
import { ChatAvatar } from "./chat-avatar";
import { ChatMarkdown } from "./chat-markdown";
import { ChatTimestamp } from "./chat-timestamp";

interface ChatMessageProps {
  message: ChatMessageType;
  onRetry?: () => void;
  onFollowUp?: (followUp: string) => void;
}

export function ChatMessage({ message, onRetry, onFollowUp }: ChatMessageProps) {
  const { role, content, timestamp, isError, followUp } = message;
  const isAssistant = role === "assistant";

  return (
    <div
      className={`flex gap-3 ${isAssistant ? "flex-row" : "flex-row-reverse"}`}
    >
      <ChatAvatar role={role} />

      <div
        className={`flex max-w-[80%] flex-col gap-1 ${
          isAssistant ? "items-start" : "items-end"
        }`}
      >
        <div
          className={`rounded-2xl px-4 py-2 ${
            isAssistant
              ? "bg-muted text-foreground"
              : "bg-primary text-primary-foreground"
          } ${isError ? "border border-destructive bg-destructive/10 text-destructive" : ""}`}
        >
          {isError && (
            <div className="mb-1 flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              <span className="text-xs font-medium">Error</span>
            </div>
          )}
          {isAssistant && !isError ? (
            <ChatMarkdown content={content} />
          ) : (
            <p className="text-sm whitespace-pre-wrap">{content}</p>
          )}
        </div>

        <div className="flex items-center gap-2 px-1">
          <ChatTimestamp date={timestamp} />
          {isError && onRetry && (
            <button
              onClick={onRetry}
              className="text-xs text-primary hover:underline"
            >
              Retry
            </button>
          )}
        </div>

        {followUp && onFollowUp && !isError && (
          <button
            type="button"
            onClick={() => onFollowUp(followUp)}
            className="rounded-full border px-3 py-1 text-xs font-medium text-primary transition hover:bg-primary/5"
          >
            {followUp}
          </button>
        )}
      </div>
    </div>
  );
}
