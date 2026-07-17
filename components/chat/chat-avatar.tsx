import Image from "next/image";
import { User } from "lucide-react";
import type { MessageRole } from "@/lib/types";

interface ChatAvatarProps {
  role: MessageRole;
}

export function ChatAvatar({ role }: ChatAvatarProps) {
  const isAssistant = role === "assistant";

  return (
    <div
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
        isAssistant
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground"
      }`}
    >
      {isAssistant ? (
        <Image
          src="/icons/icon-192x192.png?v=20260709"
          alt="Campus SmartMap assistant"
          width={20}
          height={20}
          className="h-5 w-5"
          unoptimized
          priority
        />
      ) : (
        <User className="h-4 w-4" aria-hidden />
      )}
    </div>
  );
}
