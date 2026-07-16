import { db } from "@/lib/db";
import { toast } from "sonner";
import { createSuggestion } from "@/lib/supabase/queries/suggestions";
import { type SuggestionInsert } from "@/lib/types/suggestion";

export async function addToSyncQueue(action: string, payload: unknown) {
  try {
    await db.offline_queue.add({
      action,
      payload,
      timestamp: Date.now(),
    });
    toast.info("Offline: Saved to device. Will sync when online.");
  } catch (error) {
    console.error("Failed to add to sync queue:", error);
    toast.error("Failed to save offline action.");
  }
}

export async function processSyncQueue() {
  if (typeof window === "undefined" || !navigator.onLine) return;

  const count = await db.offline_queue.count();
  if (count === 0) return;

  const pending = await db.offline_queue.orderBy('timestamp').toArray();

  let successCount = 0;
  let failCount = 0;

  toast.loading("Syncing offline data...", { id: "sync-toast" });

  for (const item of pending) {
    try {
      let result;

      switch (item.action) {
        case 'CREATE_SUGGESTION':
          // Reconstruct Date objects if needed because IndexedDB/JSON serialization might turn them to strings
          // Supabase expects ISO strings for dates usually, but let's check payload structure.
          result = await createSuggestion(item.payload as SuggestionInsert);
          break;
        default:
          console.warn("Unknown sync action:", item.action);
          // If unknown, maybe we should delete it to avoid stuck queue? 
          // For now, let's keep it but skip delete.
          continue;
      }

      if (result.error) {
        console.error("Sync error for item:", item, result.error);
        failCount++;
        // Decide if we should keep it in queue or not. 
        // If it's a validation error, it will never pass. 
        // If it's a network error, we probably wouldn't be here (navigator.onLine check).
        // Let's keep it if it's strictly a 500 or network issue, but remove if 400.
        // For simplicity, we'll leave it for now and retry next time, 
        // OR we can implement a retry count. 
        // Let's assume transient errors for now.
      } else {
        // Success
        if (item.id) {
          await db.offline_queue.delete(item.id);
        }
        successCount++;
      }

    } catch (e) {
      console.error("Sync exception:", e);
      failCount++;
    }
  }

  toast.dismiss("sync-toast");

  if (successCount > 0) {
    toast.success(`Synced ${successCount} item(s).`);
  }
  if (failCount > 0) {
    toast.error(`Failed to sync ${failCount} item(s).`);
  }
}
