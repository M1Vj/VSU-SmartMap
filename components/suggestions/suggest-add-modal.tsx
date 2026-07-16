"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import { FacilityDialog } from "@/components/admin/facility-dialog";
import type { UnifiedFacilityFormValues } from "@/lib/validation/facility";
import { createSuggestionAction } from "@/app/actions/suggestions";
import { uploadSuggestionImageClient } from "@/lib/supabase/storage-client";
import { TurnstileWidget } from "@/components/ui/turnstile-widget";
import type { TurnstileToken } from "@/lib/types/turnstile";

interface SuggestAddModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function SuggestAddModal({ open, onOpenChange, onSuccess }: SuggestAddModalProps) {
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
    setMessage(null);

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
      type: "ADD_FACILITY",
      targetId: null,
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

    toast.success("Suggestion submitted! Thank you for contributing.");
    onOpenChange(false);
    onSuccess?.();
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
      mode="create"
      onOpenChange={onOpenChange}
      onSubmit={handleSubmit}
      title="Suggest a place"
      description="Share details for a new building or point of interest so we can add it to the map."
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
