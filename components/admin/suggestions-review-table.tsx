"use client";

import * as React from "react";
import Image from "next/image";
import { format } from "date-fns";
import { Check, X, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { EventSuggestion } from "@/lib/types/events";
import { approveEventSuggestion, rejectEventSuggestion } from "@/lib/actions/events";

interface SuggestionsReviewTableProps {
  suggestions: EventSuggestion[];
}

export function SuggestionsReviewTable({ suggestions }: SuggestionsReviewTableProps) {
  const router = useRouter();
  const [processingId, setProcessingId] = React.useState<string | null>(null);

  const handleApprove = async (id: string) => {
    try {
      setProcessingId(id);
      const result = await approveEventSuggestion(id);
      if (result.error) throw new Error(result.error.message);
      toast.success("Suggestion approved and event created!");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to approve");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    try {
      setProcessingId(id);
      const result = await rejectEventSuggestion(id);
      if (result.error) throw new Error(result.error.message);
      toast.success("Suggestion rejected.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reject");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Submitted By</TableHead>
            <TableHead>Proof</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {suggestions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center">
                No pending suggestions.
              </TableCell>
            </TableRow>
          ) : (
            suggestions.map((suggestion) => (
              <TableRow key={suggestion.id}>
                <TableCell className="font-medium">
                  {suggestion.title}
                  <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                    {suggestion.description}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="capitalize">
                    {suggestion.category}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {suggestion.submittedBy || "Anonymous"}
                </TableCell>
                <TableCell>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8"
                        disabled={!suggestion.proofAvailable}
                      >
                        <FileText className="mr-2 h-3 w-3" />
                        View
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl max-h-[90vh]">
                      <DialogHeader>
                        <DialogTitle>Proof Document</DialogTitle>
                        <DialogDescription>
                          Submitted proof for: {suggestion.title}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="relative h-[70vh] max-h-[70vh] w-full overflow-auto bg-muted/20 rounded-md">
                        <Image
                          src={`/api/admin/event-proofs/${encodeURIComponent(suggestion.id)}`}
                          alt="Proof"
                          fill
                          unoptimized
                          sizes="(max-width: 768px) 100vw, 768px"
                          className="object-contain"
                        />
                      </div>
                    </DialogContent>
                  </Dialog>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    {format(new Date(suggestion.startTime), "MMM d, h:mm a")}
                  </div>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                    onClick={() => handleApprove(suggestion.id)}
                    disabled={!!processingId}
                  >
                    {processingId === suggestion.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => handleReject(suggestion.id)}
                    disabled={!!processingId}
                  >
                    {processingId === suggestion.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <X className="h-4 w-4" />
                    )}
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
