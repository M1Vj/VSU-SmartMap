import type { Metadata } from "next";
import { ChatView } from "@/components/chat/chat-view";

export const metadata: Metadata = {
  title: "Chat",
  description: "Ask the Campus Assistant about campus buildings, offices, and services.",
};

export default function ChatPage() {
  return (
    <div className="h-full pb-[calc(var(--student-mobile-nav-height)+env(safe-area-inset-bottom,0px))] md:pb-0">
      <ChatView />
    </div>
  );
}
