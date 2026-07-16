"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChatHeaderProps {
  onClear: () => void;
  hasMessages: boolean;
}

export function ChatHeader({ onClear, hasMessages }: ChatHeaderProps) {
  return (
    <header className="flex items-center justify-between border-b px-4 py-3">
      <div>
        <h1 className="text-lg font-semibold">Campus Assistant</h1>
        <p className="text-sm text-muted-foreground">
          Ask me about any location on campus
        </p>
      </div>

      {hasMessages && (
        <Button variant="ghost" size="sm" onClick={onClear}>
          <Trash2 className="mr-2 h-4 w-4" aria-hidden />
          Clear chat
        </Button>
      )}
    </header>
  );
}
