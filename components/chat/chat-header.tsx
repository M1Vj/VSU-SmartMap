"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChatHeaderProps {
  onClear: () => void;
  hasMessages: boolean;
}

export function ChatHeader({ onClear, hasMessages }: ChatHeaderProps) {
  return (
    <header className="flex min-h-12 items-center justify-between gap-3 px-4 py-2">
      <h1 className="text-lg font-semibold">Campus Assistant</h1>

      {hasMessages && (
        <Button variant="ghost" size="sm" onClick={onClear}>
          <Trash2 className="mr-2 h-4 w-4" aria-hidden />
          Clear chat
        </Button>
      )}
    </header>
  );
}
