"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DialogScaffoldBody,
  DialogScaffoldContent,
  DialogScaffoldHeader,
} from "@/components/ui/dialog-scaffold";
import { Badge } from "@/components/ui/badge";
import { Clock, Loader2, History } from "lucide-react";
import { getFacilityHistory } from "@/app/admin/facilities/actions";
import type { Suggestion } from "@/lib/types/suggestion";
import { cn } from "@/lib/utils";

interface FacilityHistoryDialogProps {
  facilityId: string;
  facilityName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FacilityHistoryDialog({
  facilityId,
  facilityName,
  open,
  onOpenChange,
}: FacilityHistoryDialogProps) {
  const [history, setHistory] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setLoading(true);
      getFacilityHistory(facilityId)
        .then((result) => {
          if (result.data) {
            setHistory(result.data);
          }
        })
        .finally(() => setLoading(false));
    }
  }, [open, facilityId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogScaffoldContent className="sm:max-w-xl">
        <DialogScaffoldHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Edit History
          </DialogTitle>
          <DialogDescription>
            Approved changes for <span className="font-medium text-foreground">{facilityName}</span>.
          </DialogDescription>
        </DialogScaffoldHeader>

        <DialogScaffoldBody className="py-4">
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              No edit history found.
            </p>
          ) : (
            <div className="space-y-6">
              {history.map((item) => (
                <HistoryItem key={item.id} item={item} />
              ))}
            </div>
          )}
        </DialogScaffoldBody>
      </DialogScaffoldContent>
    </Dialog>
  );
}

function HistoryItem({ item }: { item: Suggestion }) {
  return (
    <div className="relative pl-4 border-l-2 border-muted pb-6 last:pb-0">
      <div className="absolute -left-[5px] top-0 h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="text-[10px] h-5 px-1.5">
            {item.type.replace("_", " ")}
          </Badge>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {new Date(item.createdAt).toLocaleDateString()}
          </span>
        </div>

        <PayloadView payload={item.payload} />
      </div>
    </div>
  );
}

function PayloadView({ payload }: { payload: Record<string, unknown> }) {
  const entries = Object.entries(payload).filter(
    ([key]) => !["id", "updatedAt", "createdAt", "roomId", "roomCode", "source"].includes(key)
  );

  if (entries.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">No field changes recorded.</p>
    );
  }

  return (
    <div className="rounded-md border bg-muted/30 p-3 text-sm">
      <ul className="space-y-1">
        {entries.map(([key, value]) => (
          <PayloadField key={key} fieldKey={key} value={value} />
        ))}
      </ul>
    </div>
  );
}

function PayloadField({ fieldKey, value }: { fieldKey: string; value: unknown }) {
  const isDiff = value && typeof value === "object" && "from" in value && "to" in value;
  const label = fieldKey.replace(/([A-Z])/g, " $1").trim();

  return (
    <li className="grid grid-cols-[1fr_2fr] gap-2 text-xs">
      <span className="font-medium text-muted-foreground capitalize">{label}:</span>
      <div className="font-mono text-foreground overflow-hidden">
        {isDiff ? (
          <DiffValue from={(value as { from: unknown }).from} to={(value as { to: unknown }).to} />
        ) : (
          <span className="truncate">
            {typeof value === "object" ? JSON.stringify(value) : String(value)}
          </span>
        )}
      </div>
    </li>
  );
}

function DiffValue({ from, to }: { from: unknown; to: unknown }) {
  const formatValue = (v: unknown) =>
    typeof v === "object" ? JSON.stringify(v) : String(v ?? "Empty");

  return (
    <div className="flex flex-col gap-1">
      <div className={cn("flex items-center gap-2 text-red-500 line-through opacity-70")}>
        <span className="truncate">{formatValue(from)}</span>
      </div>
      <div className={cn("flex items-center gap-2 text-green-600")}>
        <span className="truncate">{formatValue(to)}</span>
      </div>
    </div>
  );
}
