"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Facility } from "@/lib/types/facility";
import type { Suggestion } from "@/lib/types/suggestion";
import type { RoomFormValues } from "@/lib/validation/room";
import { cn } from "@/lib/utils";
import { formatDatePH } from "@/lib/utils/date";
import { approveSuggestion, rejectSuggestion } from "@/app/admin/suggestions/actions";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DialogScaffoldBody,
  DialogScaffoldContent,
  DialogScaffoldFooter,
  DialogScaffoldHeader,
} from "@/components/ui/dialog-scaffold";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import Image from "next/image";
import { ImageZoomDialog } from "@/components/ui/image-zoom-dialog";
import { FieldHelp } from "@/components/ui/field-help";

interface RoomRow {
  id: string;
  facility_id: string;
  room_code: string;
  name: string | null;
  description: string | null;
  floor: number | null;
  image_url: string | null;
  image_credit: string | null;
}

interface SuggestionRoomDiffViewProps {
  suggestion: Suggestion;
  payload: Partial<RoomFormValues>;
  currentRoom: RoomRow | null;
  targetFacility: Facility | null;
}

type FieldKey = "roomCode" | "name" | "description" | "floor" | "imageUrl" | "imageCredit";

const fieldLabels: Record<FieldKey, string> = {
  roomCode: "Room Code",
  name: "Name",
  description: "Description",
  floor: "Floor",
  imageUrl: "Room Image",
  imageCredit: "Photo Credit",
};

const formatValue = (value: unknown) => {
  if (value === undefined || value === null || value === "") return "—";
  return String(value);
};

const hasDifference = (
  key: FieldKey,
  currentRoom: RoomRow | null,
  payload: Partial<RoomFormValues>,
) => {
  if (!currentRoom) return true;
  const nextValue = payload[key];
  if (nextValue === undefined) return false;

  // For comparison, null and empty string are treated as equivalent,
  // since both are converted to "" before comparison.

  const keyMap: Record<FieldKey, keyof RoomRow> = {
    roomCode: "room_code",
    name: "name",
    description: "description",
    floor: "floor",
    imageUrl: "image_url",
    imageCredit: "image_credit",
  };

  const currentValue = currentRoom[keyMap[key]];
  return String(currentValue ?? "") !== String(nextValue ?? "");
};

export function SuggestionRoomDiffView({
  suggestion,
  payload,
  currentRoom,
  targetFacility,
}: SuggestionRoomDiffViewProps) {
  const [editedPayload, setEditedPayload] = useState<Partial<RoomFormValues>>(payload);
  const [isEditing, setIsEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const router = useRouter();
  const disabled = pending || suggestion.status !== "PENDING";

  const handleApproveClick = () => {
    setError(null);
    setMessage(null);
    setShowApproveDialog(true);
  };

  const executeApprove = () => {
    setShowApproveDialog(false);
    startTransition(async () => {
      const result = await approveSuggestion(suggestion.id, editedPayload);
      if (result?.error) {
        setError(result.error);
        toast.error("Failed to approve room suggestion");
        return;
      }
      setMessage("Room suggestion approved and applied.");
      toast.success("Room suggestion approved!");
      router.push("/admin/suggestions");
    });
  };

  const handleRejectClick = () => {
    setError(null);
    setMessage(null);
    setRejectionReason("");
    setShowRejectDialog(true);
  };

  const executeReject = () => {
    setShowRejectDialog(false);
    startTransition(async () => {
      const result = await rejectSuggestion(suggestion.id, rejectionReason || undefined);
      if (result?.error) {
        setError(result.error);
        toast.error("Failed to reject room suggestion");
        return;
      }
      setMessage("Room suggestion rejected.");
      toast.success("Room suggestion rejected");
      router.push("/admin/suggestions");
    });
  };

  const currentValues: Partial<RoomFormValues> | null = currentRoom
    ? {
      roomCode: currentRoom.room_code,
      name: currentRoom.name ?? "",
      description: currentRoom.description ?? "",
      floor: currentRoom.floor ?? undefined,
      imageUrl: currentRoom.image_url ?? undefined,
      imageCredit: currentRoom.image_credit ?? "",
    }
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="outline">{suggestion.type.replace("_", " ")}</Badge>
        <Badge variant="secondary">{suggestion.status}</Badge>
        <span className="text-sm text-muted-foreground">
          Submitted {formatDatePH(suggestion.createdAt)}
        </span>
      </div>

      {targetFacility && (
        <div className="rounded-md border border-border bg-muted/30 p-3">
          <p className="text-sm">
            <span className="text-muted-foreground">Target Facility:</span>{" "}
            <span className="font-medium">{targetFacility.name}</span>
          </p>
        </div>
      )}

      {message && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Current
            </h3>
          </div>
          {currentValues ? (
            <div className="space-y-3">
              {(Object.keys(fieldLabels) as FieldKey[]).map((key) => (
                <div key={key} className="space-y-1 rounded-md border border-border/60 bg-background px-3 py-2">
                  <p className="text-xs font-medium text-muted-foreground">{fieldLabels[key]}</p>
                  {key === 'imageUrl' ? (
                    currentValues[key] ? (
                      <button
                        type="button"
                        onClick={() => setZoomImage(String(currentValues[key]))}
                        className="relative block h-20 w-32 overflow-hidden rounded-md border hover:ring-2 hover:ring-primary/50 transition-all"
                      >
                        <Image
                          src={String(currentValues[key])}
                          alt="Current image"
                          fill
                          className="object-cover"
                        />
                      </button>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No image</p>
                    )
                  ) : (
                    <p className="text-sm text-foreground">{formatValue(currentValues[key])}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No existing room. This will create a new room if approved.
            </p>
          )}
        </div>

        <div className="rounded-lg border border-border bg-muted/10 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Proposed
            </h3>
            {suggestion.status === "PENDING" && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2 text-xs"
                onClick={() => setIsEditing(true)}
              >
                <Pencil className="h-3 w-3" />
                Edit
              </Button>
            )}
          </div>

          <div className="space-y-3">
            {(Object.keys(fieldLabels) as FieldKey[]).map((key) => {
              const changed = hasDifference(key, currentRoom, editedPayload);
              const value = editedPayload[key];

              return (
                <div
                  key={key}
                  className={cn(
                    "space-y-1 rounded-md border px-3 py-2",
                    changed ? "border-primary/60 bg-primary/5" : "border-border/60 bg-background"
                  )}
                >
                  <p className="text-xs font-medium text-muted-foreground">{fieldLabels[key]}</p>

                  {key === 'imageUrl' ? (
                    value ? (
                      <button
                        type="button"
                        onClick={() => setZoomImage(String(value))}
                        className="relative block h-20 w-32 overflow-hidden rounded-md border hover:ring-2 hover:ring-primary/50 transition-all"
                      >
                        <Image
                          src={String(value)}
                          alt="Proposed image"
                          fill
                          className="object-cover"
                        />
                      </button>
                    ) : (
                      <span className="text-sm italic text-muted-foreground">No image</span>
                    )
                  ) : (
                    <p className="text-sm text-foreground">{formatValue(value)}</p>
                  )}

                  {changed && currentValues && (
                    <div className="mt-2 text-xs">
                      <span className="text-primary font-medium">Original: </span>
                      {key === 'imageUrl' ? (
                        currentValues[key] ? (
                          <div className="mt-1 relative h-16 w-24 overflow-hidden rounded-md border opacity-75">
                            <Image
                              src={String(currentValues[key])}
                              alt="Original image"
                              fill
                              className="object-cover"
                            />
                          </div>
                        ) : <span className="text-muted-foreground">No image</span>
                      ) : (
                        <span className="text-primary">{formatValue(currentValues[key])}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button onClick={handleApproveClick} disabled={disabled}>
          {pending ? "Working..." : "Approve"}
        </Button>
        <Button onClick={handleRejectClick} disabled={disabled} variant="outline">
          Reject
        </Button>
        <Button
          variant="ghost"
          onClick={() => router.push("/admin/suggestions")}
          disabled={pending}
        >
          Back to Suggestions
        </Button>
      </div>

      <ConfirmDialog
        open={showApproveDialog}
        title="Approve Room Suggestion"
        description="Are you sure you want to approve this room suggestion? This will add the room to the facility immediately."
        confirmLabel="Approve"
        confirmVariant="default"
        onConfirm={executeApprove}
        onCancel={() => setShowApproveDialog(false)}
        loading={pending}
      />

      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogScaffoldContent className="sm:max-w-md">
          <DialogScaffoldHeader>
            <DialogTitle>Reject Room Suggestion</DialogTitle>
            <DialogDescription>
              Are you sure you want to reject this room suggestion? This action cannot be undone.
            </DialogDescription>
          </DialogScaffoldHeader>
          <DialogScaffoldBody className="py-4">
            <div className="grid gap-2">
              <Label htmlFor="reason">Rejection Reason (Optional)</Label>
              <Textarea
                id="reason"
                placeholder="Explain why this suggestion is being rejected..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
            </div>
          </DialogScaffoldBody>
          <DialogScaffoldFooter>
            <Button variant="ghost" onClick={() => setShowRejectDialog(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={executeReject} disabled={pending}>
              {pending ? "Rejecting..." : "Reject Suggestion"}
            </Button>
          </DialogScaffoldFooter>
        </DialogScaffoldContent>
      </Dialog>

      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogScaffoldContent className="sm:max-w-md">
          <DialogScaffoldHeader>
            <DialogTitle>Edit Room Suggestion</DialogTitle>
            <DialogDescription>
              Modify the proposed room details before approving.
            </DialogDescription>
          </DialogScaffoldHeader>
          <DialogScaffoldBody className="py-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <div className="flex items-center gap-1">
                  <Label htmlFor="edit-roomCode">Room Code *</Label>
                  <FieldHelp content="The unique identifier for the room (e.g., ICT101, Lab-A)." />
                </div>
                <Input
                  id="edit-roomCode"
                  value={editedPayload.roomCode ?? ""}
                  onChange={(e) =>
                    setEditedPayload({ ...editedPayload, roomCode: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center gap-1">
                  <Label htmlFor="edit-floor">Floor</Label>
                  <FieldHelp content="The floor level where this room is located." />
                </div>
                <Input
                  id="edit-floor"
                  type="number"
                  value={editedPayload.floor ?? ""}
                  onChange={(e) =>
                    setEditedPayload({
                      ...editedPayload,
                      floor: e.target.value === "" ? undefined : Number(e.target.value),
                    })
                  }
                />
              </div>
            </div>
            <div className="grid gap-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="edit-name">Name</Label>
                <FieldHelp content="A descriptive name for the room (e.g., Computer Lab, Conference Room)." />
              </div>
              <Input
                id="edit-name"
                value={editedPayload.name ?? ""}
                onChange={(e) =>
                  setEditedPayload({ ...editedPayload, name: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="edit-description">Description</Label>
                <FieldHelp content="Additional details about the room's purpose or availability." />
              </div>
              <Textarea
                id="edit-description"
                value={editedPayload.description ?? ""}
                onChange={(e) =>
                  setEditedPayload({ ...editedPayload, description: e.target.value })
                }
                rows={3}
              />
            </div>
          </DialogScaffoldBody>
          <DialogScaffoldFooter>
            <Button variant="ghost" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
            <Button onClick={() => setIsEditing(false)}>
              Update Proposal
            </Button>
          </DialogScaffoldFooter>
        </DialogScaffoldContent>
      </Dialog>
      {zoomImage && (
        <ImageZoomDialog
          open={!!zoomImage}
          onOpenChange={(open) => !open && setZoomImage(null)}
          src={zoomImage}
          alt="Room image"
        />
      )}
    </div>
  );
}
