"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function RetryButton() {
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    const updateOnlineState = () => setIsOnline(navigator.onLine);

    updateOnlineState();
    window.addEventListener("online", updateOnlineState);
    window.addEventListener("offline", updateOnlineState);

    return () => {
      window.removeEventListener("online", updateOnlineState);
      window.removeEventListener("offline", updateOnlineState);
    };
  }, []);

  return (
    <Button
      onClick={() => {
        if (navigator.onLine) {
          window.location.reload();
        }
      }}
      variant="outline"
      className="gap-2"
      disabled={!isOnline}
      title={isOnline ? "Retry loading the app" : "Reconnect to retry"}
    >
      <RefreshCw className="h-4 w-4" aria-hidden />
      Try Again
    </Button>
  );
}
