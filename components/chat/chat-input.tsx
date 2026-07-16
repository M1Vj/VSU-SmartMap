"use client";

import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChatInputProps {
  onSubmit: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  remaining?: number;
  limit?: number;
}

export function ChatInput({
  onSubmit,
  disabled = false,
  placeholder = "Ask about a location...",
  remaining,
  limit,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const maxLength = 250;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) return;

    onSubmit(trimmed);
    setValue("");

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleInput = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
  };

  const isLimitReached = remaining === 0;

  return (
    <div className="relative border-t bg-background p-3">
      <div className="absolute bottom-full left-0 mb-2 w-full px-4 text-center">
        <span className="inline-block rounded-full bg-background/80 px-3 py-1 text-xs text-red-500/80 backdrop-blur-sm">
          ⚠️ AI may generate incorrect information
        </span>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder={isLimitReached ? "Daily chat limit reached" : placeholder}
            disabled={disabled || isLimitReached}
            maxLength={maxLength}
            rows={1}
            className="w-full resize-none rounded-lg border bg-background px-3 py-2 pr-12 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
          />
          <div className="absolute bottom-2 right-2 text-[10px] text-muted-foreground">
            {value.length}/{maxLength}
          </div>
        </div>

        <Button
          type="submit"
          size="icon"
          disabled={disabled || !value.trim() || isLimitReached}
          className="shrink-0"
        >
          <Send className="h-4 w-4" />
          <span className="sr-only">Send message</span>
        </Button>
      </form>

      {typeof remaining === "number" && typeof limit === "number" && (
        <div className="mt-1 text-center text-[10px] text-muted-foreground">
          {remaining > 0 ? (
            <span>
              {remaining} / {limit} free chats remaining today
            </span>
          ) : (
            <span className="text-destructive">
              Daily limit reached. Please try again tomorrow.
            </span>
          )}
        </div>
      )}
    </div>
  );
}
