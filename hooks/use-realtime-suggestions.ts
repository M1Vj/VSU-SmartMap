import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Suggestion, SuggestionRow } from "@/lib/types/suggestion";
import { toSuggestion } from "@/lib/supabase/queries/suggestions";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

export function useRealtimeSuggestions(initialSuggestions: Suggestion[]) {
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<Suggestion[]>(initialSuggestions);

  // Sync with server data when it changes (e.g. after a router refresh)
  useEffect(() => {
    setSuggestions(initialSuggestions);
  }, [initialSuggestions]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("suggestions-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "suggestions",
        },
        (payload: RealtimePostgresChangesPayload<SuggestionRow>) => {
          // Optimistically update the state
          if (payload.eventType === "INSERT") {
            const newSuggestion = toSuggestion(payload.new as SuggestionRow);
            setSuggestions((prev) => [newSuggestion, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            const updatedSuggestion = toSuggestion(payload.new as SuggestionRow);
            setSuggestions((prev) =>
              prev.map((s) => (s.id === updatedSuggestion.id ? updatedSuggestion : s))
            );
          } else if (payload.eventType === "DELETE") {
            setSuggestions((prev) => prev.filter((s) => s.id !== (payload.old as { id: string }).id));
          }

          // Trigger a background refresh to keep server components in sync
          router.refresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  return { suggestions };
}
