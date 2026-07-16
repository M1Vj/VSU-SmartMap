"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { roomSchema, type RoomFormValues } from "@/lib/validation/room";
import { createSuggestionAction } from "@/app/actions/suggestions";
import { ImagePlus, X } from "lucide-react";
import Image from "next/image";
import { uploadSuggestionImageClient } from "@/lib/supabase/storage-client";
import { TurnstileWidget } from "@/components/ui/turnstile-widget";
import type { TurnstileToken } from "@/lib/types/turnstile";
import { FieldHelp } from "@/components/ui/field-help";

function hasRoomChanges(
  initialData: RoomFormValues,
  values: RoomFormValues,
  file: File | null,
): boolean {
  if (file) return true;
  if (values.roomCode !== initialData.roomCode) return true;
  if ((values.name ?? "") !== (initialData.name ?? "")) return true;
  if ((values.description ?? "") !== (initialData.description ?? "")) return true;
  if (values.floor !== initialData.floor) return true;
  if ((values.imageUrl ?? "") !== (initialData.imageUrl ?? "")) return true;
  if ((values.imageCredit ?? "") !== (initialData.imageCredit ?? "")) return true;
  return false;
}

interface SuggestRoomModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  facilityId: string;
  facilityName: string;
  facilityCode?: string;
  initialData?: RoomFormValues | null;
  roomId?: string; // If editing an existing room
}

export function SuggestRoomModal({
  open,
  onOpenChange,
  facilityId,
  facilityName,
  facilityCode,
  initialData,
  roomId,
}: SuggestRoomModalProps) {
  const isEditing = !!initialData && !!roomId;
  const [values, setValues] = useState<RoomFormValues>({
    facilityId,
    roomCode: initialData?.roomCode ?? (facilityCode ? `${facilityCode} ` : ""),
    name: initialData?.name ?? "",
    description: initialData?.description ?? "",
    floor: initialData?.floor ?? undefined,
    imageUrl: initialData?.imageUrl ?? undefined,
    imageCredit: initialData?.imageCredit ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const turnstileTokenRef = useRef<TurnstileToken | null>(null);

  const resetTurnstile = useCallback(() => {
    turnstileTokenRef.current = null;
    setTurnstileResetKey((value) => value + 1);
  }, []);

  useEffect(() => {
    if (open) {
      if (initialData) {
        setValues({
          facilityId,
          roomCode: initialData.roomCode,
          name: initialData.name ?? "",
          description: initialData.description ?? "",
          floor: initialData.floor,
          imageUrl: initialData.imageUrl,
          imageCredit: initialData.imageCredit ?? "",
        });
        if (initialData.imageUrl) {
          setPreview(initialData.imageUrl);
        }
      } else {
        setValues({
          facilityId,
          roomCode: facilityCode ? `${facilityCode} ` : "",
          name: "",
          description: "",
          floor: undefined,
          imageCredit: "",
        });
        setFile(null);
        setPreview((prev) => {
          if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
          return null;
        });
        resetTurnstile();
      }
      setError(null);
    } else {
      resetTurnstile();
    }
  }, [open, facilityId, initialData, facilityCode, resetTurnstile]);

  useEffect(() => {
    return () => {
      if (preview?.startsWith("blob:")) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const parsed = roomSchema.safeParse(values);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Invalid room data";
      setError(message);
      return;
    }

    if (isEditing && initialData && !hasRoomChanges(initialData, values, file)) {
      setError("No changes detected. Please modify at least one field.");
      return;
    }

    setSubmitting(true);
    try {
      const turnstilePayload = turnstileTokenRef.current;
      if (!turnstilePayload?.token) {
        setError("Please complete the captcha verification.");
        return;
      }
      let uploadId: string | undefined;

      if (file) {
        const tempId = crypto.randomUUID();
        const upload = await uploadSuggestionImageClient(tempId, file, turnstilePayload);
        if (upload.error) {
          setError(upload.error.message);
          return;
        }
        uploadId = upload.data?.uploadId;
      }

      const payload = {
        ...parsed.data,
        imageUrl: parsed.data.imageUrl === null ? null : undefined,
      };

      const result = await createSuggestionAction({
        type: isEditing ? "EDIT_ROOM" : "ADD_ROOM",
        targetId: isEditing ? roomId : facilityId,
        payload,
        uploadId,
        ...(!uploadId ? {
          turnstileToken: turnstilePayload.token,
          turnstileIdempotencyKey: turnstilePayload.idempotencyKey,
        } : {}),
      });

      resetTurnstile();

      if (result.error) {
        setError(result.error);
        toast.error("Failed to submit room suggestion");
        return;
      }

      toast.success(isEditing ? "Room edit suggestion submitted!" : "Room suggestion submitted!");
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (preview) URL.revokeObjectURL(preview);
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    // Clear the existing imageUrl in values so we know we have a new file
    setValues({ ...values, imageUrl: undefined });
  };

  const clearImage = () => {
    setFile(null);
    if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    setPreview(null);
    setValues({ ...values, imageUrl: "", imageCredit: "" });
  };

  const handleTurnstileReset = useCallback(() => {
    turnstileTokenRef.current = null;
  }, []);

  const handleTurnstileVerify = useCallback((payload: TurnstileToken) => {
    turnstileTokenRef.current = payload;
    setError(null);
  }, []);

  const handleTurnstileError = useCallback((code?: string) => {
    if (code) {
      setError(`Captcha error (code ${code}). Please try again or refresh.`);
      console.error("Turnstile error code:", code);
    }
    resetTurnstile();
  }, [resetTurnstile]);

  const handleTurnstileExpire = useCallback(() => {
    resetTurnstile();
  }, [resetTurnstile]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogScaffoldContent className="sm:max-w-md">
        <DialogScaffoldHeader>
          <DialogTitle>{isEditing ? "Suggest edit" : "Suggest a room"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? <span>Suggest changes to <span className="font-medium">{values.roomCode}</span> in <span className="font-medium">{facilityName}</span>.</span>
              : <span>Suggest a new room for <span className="font-medium">{facilityName}</span>.</span>
            }
            An admin will review your suggestion before it is applied.
          </DialogDescription>
        </DialogScaffoldHeader>

        <form className="flex flex-col flex-1 min-h-0" onSubmit={handleSubmit}>
          <DialogScaffoldBody>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1">
                    <Label htmlFor="roomCode">Room code *</Label>
                    <FieldHelp content="The unique identifier for the room (e.g., ICT101, Lab-A)." />
                  </div>
                  <Input
                    id="roomCode"
                    value={values.roomCode}
                    onChange={(event) =>
                      setValues({ ...values, roomCode: event.target.value })
                    }
                    placeholder="e.g., 101, Lab-A"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    <Label htmlFor="floor">Floor (optional)</Label>
                    <FieldHelp content="The floor level where this room is located." />
                  </div>
                  <Input
                    id="floor"
                    type="number"
                    placeholder="e.g. 1"
                    value={values.floor ?? ""}
                    onChange={(e) =>
                      setValues({
                        ...values,
                        floor: e.target.value ? parseInt(e.target.value) : undefined,
                      })
                    }
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-1">
                  <Label htmlFor="name">Name (optional)</Label>
                  <FieldHelp content="A descriptive name for the room (e.g., Computer Lab, Conference Room)." />
                </div>
                <Input
                  id="name"
                  value={values.name ?? ""}
                  onChange={(event) =>
                    setValues({ ...values, name: event.target.value })
                  }
                  placeholder="e.g., Computer Lab, Conference Room"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-1">
                  <Label htmlFor="description">Description (optional)</Label>
                  <FieldHelp content="Additional details about the room's purpose or availability." />
                </div>
                <Textarea
                  id="description"
                  value={values.description ?? ""}
                  onChange={(event) =>
                    setValues({ ...values, description: event.target.value })
                  }
                  placeholder="What is this room used for?"
                  rows={3}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-1">
                  <Label>Room Image (optional)</Label>
                  <FieldHelp content="A photo of the room interior or entrance." />
                </div>
                {!preview ? (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full gap-2 text-muted-foreground"
                      onClick={() => document.getElementById("room-image-upload")?.click()}
                    >
                      <ImagePlus className="h-4 w-4" />
                      Select image
                    </Button>
                    <input
                      id="room-image-upload"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </div>
                ) : (
                  <div className="relative mt-2 aspect-video w-full overflow-hidden rounded-md border">
                    <Image
                      src={preview}
                      alt="Preview"
                      fill
                      className="object-cover"
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="destructive"
                      className="absolute right-2 top-2 h-6 w-6 rounded-full opacity-90 transition-opacity hover:opacity-100"
                      onClick={clearImage}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>

              {preview && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1">
                    <Label htmlFor="imageCredit">Photo credit (optional)</Label>
                    <FieldHelp content="Mention the photographer or source of the image." />
                  </div>
                  <Input
                    id="imageCredit"
                    value={values.imageCredit ?? ""}
                    onChange={(event) => setValues({ ...values, imageCredit: event.target.value })}
                    placeholder="Your name"
                  />
                  <p className="text-xs text-muted-foreground">
                    Credit will be displayed with the image.
                  </p>
                </div>
              )}

              <TurnstileWidget
                onVerify={handleTurnstileVerify}
                onError={handleTurnstileError}
                onExpire={handleTurnstileExpire}
                onReset={handleTurnstileReset}
                resetSignal={turnstileResetKey}
              />

              {error && (
                <p className="text-sm text-destructive" role="status">
                  {error}
                </p>
              )}
            </div>
          </DialogScaffoldBody>

          <DialogScaffoldFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Submitting..." : "Submit suggestion"}
            </Button>
          </DialogScaffoldFooter>
        </form>
      </DialogScaffoldContent>
    </Dialog>
  );
}
