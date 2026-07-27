"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@/hooks/use-chat";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatHeader } from "./chat-header";
import { ChatWelcome } from "./chat-welcome";
import { ChatMessage } from "./chat-message";
import { ChatFacilityCards } from "./chat-facility-cards";
import { ChatEventCards } from "./chat-event-cards";
import { ChatBoardingHouseCard } from "./chat-boarding-house-card";
import { ChatInput } from "./chat-input";
import { TypingIndicator } from "./typing-indicator";
import { useChatLimit } from "@/hooks/use-chat-limit";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Bot, WifiOff } from "lucide-react";

type OfflineCachedWindow = Window & {
  __VSU_SMARTMAP_SERVED_FROM_OFFLINE_CACHE__?: boolean;
};

export function ChatView() {
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [isAppOffline, setIsAppOffline] = useState(false);
  const { messages, isLoading, sendMessage, clearMessages, retryLastMessage } =
    useChat({ streaming: true });
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isLoading]);

  useEffect(() => {
    const hasSeenDisclaimer = localStorage.getItem("ai-disclaimer-seen");
    if (!hasSeenDisclaimer) {
      // Small delay to ensure UI is ready
      const timer = setTimeout(() => setShowDisclaimer(true), 500);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    const syncOfflineState = () => {
      const servedFromOfflineCache = Boolean(
        (window as OfflineCachedWindow).__VSU_SMARTMAP_SERVED_FROM_OFFLINE_CACHE__
      );
      setIsAppOffline(!navigator.onLine || servedFromOfflineCache);
    };

    syncOfflineState();
    window.addEventListener("online", syncOfflineState);
    window.addEventListener("offline", syncOfflineState);

    return () => {
      window.removeEventListener("online", syncOfflineState);
      window.removeEventListener("offline", syncOfflineState);
    };
  }, []);

  const handleDisclaimerConfirm = () => {
    localStorage.setItem("ai-disclaimer-seen", "true");
    setShowDisclaimer(false);
  };

  const hasMessages = messages.length > 0;

  const { remaining, limit, isLimitReached, increment } = useChatLimit();

  const handleSendMessage = async (message: string) => {
    if (isLimitReached || isAppOffline) return;

    // Charge the allowance only once an answer has arrived. Incrementing first
    // meant six failed requests locked a student out having answered nothing.
    const answered = await sendMessage(message);
    if (answered) {
      increment();
    }
  };

  return (
    <div className="flex h-full flex-col">
      <ChatHeader onClear={clearMessages} hasMessages={hasMessages} />

      {isAppOffline && (
        <div
          role="status"
          className="flex items-start gap-2 border-b bg-muted/60 px-4 py-3 text-sm text-muted-foreground"
        >
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>
            Chat is unavailable offline. You can still read saved conversations, but new
            AI responses require reconnecting to the app.
          </span>
        </div>
      )}

      <ScrollArea className="min-h-0 flex-1 overflow-hidden">
        {!hasMessages ? (
          <ChatWelcome onSuggestionSelect={handleSendMessage} disabled={isLoading || isAppOffline} />
        ) : (
          <div
            className="space-y-4 p-4"
            role="log"
            aria-live="polite"
            aria-busy={isLoading}
            aria-label="Chat messages"
          >
            {messages.map((message, index) => {
              const isLastAssistant =
                message.role === "assistant" && index === messages.length - 1;

              return (
                <div key={`${message.id}-${index}`} className="space-y-2">
                  <ChatMessage
                    message={message}
                    onRetry={
                      message.isError && isLastAssistant
                        ? retryLastMessage
                        : undefined
                    }
                    onFollowUp={
                      message.followUp ? () => handleSendMessage(message.followUp!) : undefined
                    }
                  />
                  {message.facilities && (
                    <div className="ml-11">
                      <ChatFacilityCards matches={message.facilities} />
                    </div>
                  )}
                  {message.events && (
                    <div className="ml-11">
                      <ChatEventCards events={message.events} />
                    </div>
                  )}
                  {message.boardingHouses && (
                    <div className="ml-11 flex gap-2 overflow-x-auto pb-1">
                      {message.boardingHouses.map((boardingHouse) => (
                        <ChatBoardingHouseCard
                          key={boardingHouse.listingId}
                          boardingHouse={boardingHouse}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {isLoading && <TypingIndicator />}
            <div ref={endRef} />
          </div>
        )}
      </ScrollArea>

      <ChatInput
        onSubmit={handleSendMessage}
        disabled={isLoading || isAppOffline}
        placeholder={isAppOffline ? "Chat is unavailable offline" : undefined}
        remaining={remaining}
        limit={limit}
      />

      <Dialog open={showDisclaimer} onOpenChange={setShowDisclaimer}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Bot className="h-4 w-4" />
              </div>
              <DialogTitle>AI Assistant Disclaimer</DialogTitle>
            </div>
            <DialogDescription className="pt-2">
              This AI assistant uses advanced language models to help you navigate VSU.
              <br /><br />
              <strong>Please note:</strong> While we strive for accuracy, the AI may occasionally produce incorrect information. Always verify critical details like building locations or office hours with official university sources.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={handleDisclaimerConfirm} className="w-full sm:w-auto">
              I Understand
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
