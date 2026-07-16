"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { Suggestion } from "@/lib/types/suggestion";
import { cn } from "@/lib/utils";
import { formatDatePH } from "@/lib/utils/date";
import { bulkRejectSuggestions } from "@/app/admin/suggestions/actions";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { toast } from "sonner";
import { useRealtimeSuggestions } from "@/hooks/use-realtime-suggestions";

interface SuggestionsTableProps {
  suggestions: Suggestion[];
  facilityNames: Record<string, string>;
}

const formatType = (type: Suggestion["type"]) => {
  switch (type) {
    case "ADD_FACILITY":
      return "Add Facility";
    case "EDIT_FACILITY":
      return "Edit Facility";
    case "ADD_ROOM":
      return "Add Room";
    case "EDIT_ROOM":
      return "Edit Room";
    default:
      return type;
  }
};

export function SuggestionsTable({ suggestions, facilityNames }: SuggestionsTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const { suggestions: items } = useRealtimeSuggestions(suggestions);

  const allSelected = items.length > 0 && selectedIds.size === items.length;
  const someSelected = selectedIds.size > 0;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((s) => s.id)));
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleBulkReject = () => {
    setShowRejectDialog(false);
    startTransition(async () => {
      const ids = Array.from(selectedIds);
      const result = await bulkRejectSuggestions(ids);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      const { processed, failed } = result.data!;
      if (failed > 0) {
        toast.warning(`Rejected ${processed} suggestions, ${failed} failed`);
      } else {
        toast.success(`Rejected ${processed} suggestions`);
      }
      setSelectedIds(new Set());
      router.refresh();
    });
  };

  if (!items.length) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-sm text-muted-foreground">
        No pending suggestions right now.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {someSelected && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
          <span className="text-sm font-medium">
            {selectedIds.size} selected
          </span>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setShowRejectDialog(true)}
            disabled={pending}
            loading={pending}
          >
            Reject Selected
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedIds(new Set())}
            disabled={pending}
          >
            Clear Selection
          </Button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm min-w-[600px]">
          <thead className="bg-muted/40">
            <tr className="text-left text-muted-foreground">
              <th className="px-4 py-3 w-10">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                  aria-label="Select all"
                />
              </th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Target</th>
              <th className="px-4 py-3 font-medium">Submitted</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((suggestion) => {
              let targetName = "New facility";
              const payload = suggestion.payload as Record<string, unknown>;

              if (suggestion.targetId && facilityNames[suggestion.targetId]) {
                targetName = facilityNames[suggestion.targetId];
              } else if (typeof payload.name === "string" && payload.name) {
                targetName = payload.name;
              }

              if (suggestion.type === "ADD_ROOM" || suggestion.type === "EDIT_ROOM") {
                if (payload.roomCode) {
                  targetName = `Room ${payload.roomCode}`;
                } else if (payload.name) {
                  targetName = String(payload.name);
                } else {
                  targetName = "Room";
                }
              }

              const isSelected = selectedIds.has(suggestion.id);

              return (
                <tr
                  key={suggestion.id}
                  className={cn(
                    "border-t border-border/70",
                    "hover:bg-muted/30 transition-colors",
                    isSelected && "bg-primary/5"
                  )}
                >
                  <td className="px-4 py-3 align-middle">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleOne(suggestion.id)}
                      aria-label={`Select suggestion ${suggestion.id}`}
                    />
                  </td>
                  <td className="px-4 py-3 align-middle font-medium text-foreground">
                    {formatType(suggestion.type)}
                  </td>
                  <td className="px-4 py-3 align-middle text-foreground">
                    {targetName}
                  </td>
                  <td className="px-4 py-3 align-middle text-muted-foreground">
                    {formatDatePH(suggestion.createdAt)}
                  </td>
                  <td className="px-4 py-3 align-middle text-right">
                    <Link href={`/admin/suggestions/${suggestion.id}`}>
                      <Button size="sm" variant="outline">
                        Review
                      </Button>
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={showRejectDialog}
        title="Reject Selected Suggestions"
        description={`Are you sure you want to reject ${selectedIds.size} suggestion${selectedIds.size > 1 ? "s" : ""}? This action cannot be undone.`}
        confirmLabel="Reject All"
        confirmVariant="destructive"
        onConfirm={handleBulkReject}
        onCancel={() => setShowRejectDialog(false)}
        loading={pending}
      />
    </div>
  );
}
