"use client";

import { useState } from "react";
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
import { Button } from "@/components/ui/button";
import { History, Clock } from "lucide-react";
import type { Suggestion } from "@/lib/types/suggestion";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDatePH } from "@/lib/utils/date";

interface SuggestionHistoryProps {
  suggestions: Suggestion[];
  facilityNames: Record<string, string>;
  currentId?: string;
}

export function SuggestionHistory({ suggestions, facilityNames, currentId }: SuggestionHistoryProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" className="gap-2" onClick={() => setOpen(true)}>
        <History className="h-4 w-4" />
        History
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogScaffoldContent className="sm:max-w-xl">
          <DialogScaffoldHeader>
            <DialogTitle>Suggestion History</DialogTitle>
            <DialogDescription>
              Past suggestions and their resolutions.
            </DialogDescription>
          </DialogScaffoldHeader>

          <DialogScaffoldBody className="py-4">
            <div className="space-y-4">
              {suggestions.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">
                  No history found.
                </p>
              ) : (
                suggestions.map((suggestion) => {
                  const targetName =
                    suggestion.targetId && facilityNames[suggestion.targetId]
                      ? facilityNames[suggestion.targetId]
                      : typeof suggestion.payload?.name === "string"
                        ? (suggestion.payload.name as string)
                        : "New facility";

                  return (
                    <div
                      key={suggestion.id}
                      className={cn(
                        "block rounded-lg border p-4",
                        suggestion.id === currentId && "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex flex-col gap-1">
                          <span className="font-medium text-sm">{targetName}</span>
                          <Badge variant="outline" className="w-fit text-[10px] px-1.5 py-0 h-5">
                            {suggestion.type.replace("_", " ")}
                          </Badge>
                        </div>
                        <Badge
                          variant={
                            suggestion.status === "APPROVED"
                              ? "default"
                              : suggestion.status === "REJECTED"
                                ? "destructive"
                                : "secondary"
                          }
                          className="text-[10px] px-1.5 py-0 h-5"
                        >
                          {suggestion.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                        <Clock className="h-3 w-3" />
                        {formatDatePH(suggestion.createdAt)}
                      </div>
                      {suggestion.adminNote && (
                        <p className="mt-2 text-xs text-muted-foreground border-l-2 border-muted pl-2 italic">
                          &ldquo;{suggestion.adminNote}&rdquo;
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </DialogScaffoldBody>
        </DialogScaffoldContent>
      </Dialog>
    </>
  );
}
