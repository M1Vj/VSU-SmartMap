"use client";

import { useEffect } from "react";
import { processSyncQueue } from "@/lib/offline/sync-queue";
import { toast } from "sonner";

export function SyncProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const handleOnline = () => {
      toast.success("Connection restored.");
      void processSyncQueue();
    };

    const handleOffline = () => {
      toast.info("You are offline. Changes will be saved locally.");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Also try to process queue on mount if online
    if (navigator.onLine) {
      void processSyncQueue();
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return <>{children}</>;
}
