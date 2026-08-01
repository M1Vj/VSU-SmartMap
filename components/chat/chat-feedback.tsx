"use client";

import { useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import type { ChatFeedbackCredentials } from "@/lib/types/chat";

export const FEEDBACK_REASONS = [
  "incorrect",
  "outdated",
  "wrong_location",
  "unhelpful",
  "unsafe",
  "other",
] as const;

type FeedbackReason = (typeof FEEDBACK_REASONS)[number];
type FeedbackInput =
  | { rating: "positive" }
  | { rating: "negative"; reason: FeedbackReason; comment?: string };

export async function submitChatFeedback(
  credentials: ChatFeedbackCredentials,
  input: FeedbackInput,
  fetcher: typeof fetch = fetch,
) {
  const response = await fetcher("/api/chat/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...credentials, ...input }),
  });

  if (!response.ok) throw new Error("Unable to save feedback.");
}

export function ChatFeedback({
  credentials,
}: {
  credentials: ChatFeedbackCredentials;
}) {
  const [rating, setRating] = useState<"positive" | "negative" | null>(null);
  const [reason, setReason] = useState<FeedbackReason | null>(null);
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const save = async (input: FeedbackInput) => {
    setStatus("saving");
    try {
      await submitChatFeedback(credentials, input);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  };

  const choosePositive = () => {
    if (status === "saving" || status === "saved") return;
    setRating("positive");
    void save({ rating: "positive" });
  };

  const chooseNegative = () => {
    if (status === "saving" || status === "saved") return;
    setRating("negative");
    setStatus("idle");
  };

  const retry = () => {
    if (rating === "positive") void save({ rating: "positive" });
    if (rating === "negative" && reason) {
      void save({ rating: "negative", reason, comment: comment.trim() || undefined });
    }
  };

  const disabled = status === "saving" || status === "saved";

  return (
    <div className="w-full px-1 text-xs" aria-label="Response feedback">
      <div className="flex items-center gap-1">
        <span className="text-muted-foreground">Helpful?</span>
        <button
          type="button"
          aria-label="Helpful response"
          aria-pressed={rating === "positive"}
          disabled={disabled}
          onClick={choosePositive}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          <ThumbsUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label="Not helpful response"
          aria-pressed={rating === "negative"}
          disabled={disabled}
          onClick={chooseNegative}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          <ThumbsDown className="h-3.5 w-3.5" />
        </button>
        {status === "saved" && <span role="status">Saved</span>}
        {status === "saving" && <span role="status">Saving…</span>}
      </div>

      {rating === "negative" && status !== "saved" && (
        <div className="mt-1.5 max-w-sm space-y-2">
          <div className="flex flex-wrap gap-1" aria-label="Feedback reason">
            {FEEDBACK_REASONS.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={reason === item}
                disabled={status === "saving"}
                onClick={() => setReason(item)}
                className="rounded-full border px-2 py-0.5 capitalize hover:bg-muted disabled:opacity-50"
              >
                {item.replace("_", " ")}
              </button>
            ))}
          </div>
          <label className="block">
            <span className="sr-only">Optional feedback comment</span>
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Optional comment"
              className="w-full resize-none rounded-md border bg-background px-2 py-1.5 text-xs"
            />
          </label>
          <button
            type="button"
            disabled={!reason || status === "saving"}
            onClick={() => {
              if (reason) {
                void save({
                  rating: "negative",
                  reason,
                  comment: comment.trim() || undefined,
                });
              }
            }}
            className="rounded-md bg-primary px-2.5 py-1 text-primary-foreground disabled:opacity-50"
          >
            Submit
          </button>
        </div>
      )}

      {status === "error" && (
        <div className="mt-1 flex items-center gap-2 text-destructive" role="alert">
          <span>Couldn&apos;t save feedback.</span>
          <button type="button" onClick={retry} className="underline">
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
