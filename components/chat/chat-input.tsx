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
        <div className="relative flex-1 rounded-lg border bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-primary">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="chat-message"
              className="truncate text-xs text-foreground"
            >
              {isLimitReached ? "Daily chat limit reached" : placeholder}
            </label>
            {typeof remaining === "number" && (
              <span className="shrink-0 text-[10px] font-medium text-foreground">
                {remaining > 0 ? `${remaining} chats left` : "Limit reached"}
              </span>
            )}
          </div>
          <textarea
            id="chat-message"
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            disabled={disabled || isLimitReached}
            maxLength={maxLength}
            rows={1}
            className="mt-1 min-h-10 w-full resize-none bg-transparent pb-5 text-base focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
          />
          <div className="absolute bottom-2 right-3 text-[10px] text-foreground">
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

      <div className="mt-1.5 text-xs text-muted-foreground">
        AI answers may be inaccurate. Verify important details.
      </div>
    </div>
  );
}
