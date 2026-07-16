"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import { FacilityDialog } from "@/components/admin/facility-dialog";
import type { Facility } from "@/lib/types/facility";
import type { UnifiedFacilityFormValues } from "@/lib/validation/facility";
import { createSuggestionAction } from "@/app/actions/suggestions";
import { uploadSuggestionImageClient } from "@/lib/supabase/storage-client";
import { TurnstileWidget } from "@/components/ui/turnstile-widget";
import type { TurnstileToken } from "@/lib/types/turnstile";

interface SuggestEditModalProps {
  facility: Facility | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function hasChanges(
  facility: Facility,
  values: UnifiedFacilityFormValues,
  options?: { file?: File | null; clearImage?: boolean },
): boolean {
  if (options?.file) return true;
  if (options?.clearImage && facility.imageUrl) return true;

  if ((values.code ?? "") !== (facility.code ?? "")) return true;
  if (values.name !== facility.name) return true;
  if ((values.description ?? "") !== (facility.description ?? "")) return true;
  if (values.category !== facility.category) return true;
  if (values.hasRooms !== facility.hasRooms) return true;
  if (
    values.coordinates.lat !== facility.coordinates.lat ||
    values.coordinates.lng !== facility.coordinates.lng
  ) return true;
  if ((values.imageCredit ?? "") !== (facility.imageCredit ?? "")) return true;
  if ((values.website ?? "") !== (facility.website ?? "")) return true;
  if ((values.facebook ?? "") !== (facility.facebook ?? "")) return true;
  if ((values.phone ?? "") !== (facility.phone ?? "")) return true;

  return false;
}

export function SuggestEditModal({ facility, open, onOpenChange }: SuggestEditModalProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const turnstileTokenRef = useRef<TurnstileToken | null>(null);

  const resetTurnstile = useCallback(() => {
    turnstileTokenRef.current = null;
    setTurnstileResetKey((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!open) {
      setMessage(null);
      resetTurnstile();
    }
  }, [open, resetTurnstile]);

  const handleSubmit = async (
    values: UnifiedFacilityFormValues,
    options?: { file?: File | null; clearImage?: boolean },
  ) => {
    if (!facility) return;
    setMessage(null);

    if (!hasChanges(facility, values, options)) {
      setMessage("No changes detected. Please modify at least one field.");
      return;
    }

    const file = options?.file ?? null;
    const clearImage = options?.clearImage ?? false;
    const turnstilePayload = turnstileTokenRef.current;
    if (!turnstilePayload?.token) {
      setMessage("Please complete the captcha verification.");
      return;
    }
    let uploadId: string | undefined;

    if (file) {
      const tempId = crypto.randomUUID();
      const upload = await uploadSuggestionImageClient(tempId, file, turnstilePayload);
      if (upload.error) {
        setMessage(upload.error.message);
        return;
      }
      uploadId = upload.data?.uploadId;
    }

    const payload: UnifiedFacilityFormValues = {
      ...values,
      imageUrl: clearImage ? null : undefined,
    };

    const result = await createSuggestionAction({
      type: "EDIT_FACILITY",
      targetId: facility.id,
      payload,
      uploadId,
      ...(!uploadId ? {
        turnstileToken: turnstilePayload.token,
        turnstileIdempotencyKey: turnstilePayload.idempotencyKey,
      } : {}),
    });

    resetTurnstile();

    if (result.error) {
      setMessage(result.error);
      toast.error("Failed to submit suggestion");
      return;
    }

    toast.success("Edit suggestion submitted! An admin will review it.");
    onOpenChange(false);
  };

  const handleTurnstileReset = useCallback(() => {
    turnstileTokenRef.current = null;
  }, []);

  const handleTurnstileVerify = useCallback((payload: TurnstileToken) => {
    turnstileTokenRef.current = payload;
    setMessage(null);
  }, []);

  const handleTurnstileError = useCallback((code?: string) => {
    if (code) {
      setMessage(`Captcha error (code ${code}). Please try again or refresh.`);
      console.error("Turnstile error code:", code);
    }
    resetTurnstile();
  }, [resetTurnstile]);

  const handleTurnstileExpire = useCallback(() => {
    resetTurnstile();
  }, [resetTurnstile]);

  return (
    <FacilityDialog
      open={open}
      mode="edit"
      facility={facility ?? undefined}
      onOpenChange={onOpenChange}
      onSubmit={handleSubmit}
      title="Suggest edits"
      description="Propose updates to this facility. An admin will review before publishing."
      submitLabel="Submit suggestion"
      submittingLabel="Submitting..."
    >
      <div className="px-6 pb-4 space-y-3">
        <TurnstileWidget
          onVerify={handleTurnstileVerify}
          onError={handleTurnstileError}
          onExpire={handleTurnstileExpire}
          onReset={handleTurnstileReset}
          resetSignal={turnstileResetKey}
        />
        {message && (
          <p className="text-sm text-destructive" role="status">
            {message}
          </p>
        )}
      </div>
    </FacilityDialog>
  );
}
