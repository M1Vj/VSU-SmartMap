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
    <div className="border-t bg-background p-3">
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
            className="min-h-11 w-full resize-none rounded-lg border bg-background px-3 py-2.5 pr-12 text-base placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
          />
          <div className="absolute bottom-2 right-2 text-[10px] text-muted-foreground">
            {value.length}/{maxLength}
          </div>
        </div>

        <Button
          type="submit"
          size="icon"
          disabled={disabled || !value.trim() || isLimitReached}
          className="h-11 w-11 shrink-0"
        >
          <Send className="h-4 w-4" />
          <span className="sr-only">Send message</span>
        </Button>
      </form>

      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>AI answers may be inaccurate. Verify important details.</span>
        {typeof remaining === "number" && typeof limit === "number" && (
          <span className={isLimitReached ? "text-destructive" : undefined}>
            {remaining > 0
              ? `${remaining} of ${limit} chats left today`
              : "Daily chat limit reached. Try again tomorrow."}
          </span>
        )}
      </div>
    </div>
  );
}
