"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { Loader2, LogIn, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TurnstileWidget } from "@/components/ui/turnstile-widget";
import { signInWithGoogle } from "@/lib/auth/oauth";
import type { TurnstileToken } from "@/lib/types/turnstile";
import {
  submitBoardingHouseReport,
  submitReviewAction,
  type ActionResult,
} from "@/app/(student)/boarding-houses/[slug]/actions";

type ReviewFormProps = {
  listingId: string;
  slug: string;
  isAuthenticated: boolean;
};

const RATING_LABELS = [
  "1 star — poor",
  "2 stars — fair",
  "3 stars — okay",
  "4 stars — good",
  "5 stars — excellent",
];

export function ReviewForm({ listingId, slug, isAuthenticated }: ReviewFormProps) {
  const next = `/boarding-houses/${slug}`;

  if (!isAuthenticated) {
    return (
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <p className="mb-3 text-sm text-muted-foreground">
          Share your experience to help fellow students choose safely.
        </p>
        <Button
          type="button"
          variant="outline"
          className="w-full rounded-full"
          onClick={() => {
            void signInWithGoogle(next);
          }}
        >
          <LogIn className="mr-2 h-4 w-4" aria-hidden="true" />
          Sign in with Google to write a review
        </Button>
      </div>
    );
  }

  return (
    <AuthenticatedReviewForm listingId={listingId} slug={slug} />
  );
}

function AuthenticatedReviewForm({
  listingId,
  slug,
}: {
  listingId: string;
  slug: string;
}) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const turnstileTokenRef = useRef<TurnstileToken | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    async (_prev, formData) => {
      if (rating < 1) {
        return { error: "Please choose a star rating from 1 to 5." };
      }
      formData.set("rating", String(rating));
      const token = turnstileTokenRef.current;
      if (token) {
        formData.set("turnstileToken", token.token);
        formData.set("turnstileIdempotencyKey", token.idempotencyKey);
      }
      const result = await submitReviewAction(formData);
      return result;
    },
    {},
  );

  const resetTurnstile = useCallback(() => {
    turnstileTokenRef.current = null;
    setTurnstileResetKey((value) => value + 1);
  }, []);

  const handleTurnstileVerify = useCallback((payload: TurnstileToken) => {
    turnstileTokenRef.current = payload;
  }, []);

  const handleTurnstileExpire = useCallback(() => {
    turnstileTokenRef.current = null;
  }, []);

  useEffect(() => {
    if (state.message) {
      setRating(0);
      setHoverRating(0);
      formRef.current?.reset();
      resetTurnstile();
    } else if (state.error) {
      resetTurnstile();
    }
  }, [state, resetTurnstile]);

  const activeRating = hoverRating || rating;

  return (
    <form ref={formRef} action={formAction} className="space-y-4 rounded-2xl border bg-card p-4 shadow-sm">
      <input type="hidden" name="listingId" value={listingId} />
      <input type="hidden" name="slug" value={slug} />

      <div className="space-y-2">
        <span id="rating-label" className="text-sm font-medium">
          Your rating
        </span>
        <div
          role="radiogroup"
          aria-labelledby="rating-label"
          className="flex items-center gap-1"
          onMouseLeave={() => setHoverRating(0)}
        >
          {Array.from({ length: 5 }).map((_, starIndex) => {
            const value = starIndex + 1;
            const filled = value <= activeRating;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={rating === value}
                aria-label={RATING_LABELS[starIndex]}
                tabIndex={rating === value || (rating === 0 && value === 1) ? 0 : -1}
                onClick={() => setRating(value)}
                onMouseEnter={() => setHoverRating(value)}
                onFocus={() => setHoverRating(value)}
                onBlur={() => setHoverRating(0)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowRight" || event.key === "ArrowUp") {
                    event.preventDefault();
                    setRating(Math.min(5, (rating || 0) + 1));
                  } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
                    event.preventDefault();
                    setRating(Math.max(1, (rating || 1) - 1));
                  }
                }}
                className="rounded-full p-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Star
                  className={
                    filled
                      ? "h-7 w-7 fill-amber-400 text-amber-400"
                      : "h-7 w-7 text-muted-foreground/40"
                  }
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="review-body">Your review</Label>
        <Textarea
          id="review-body"
          name="body"
          maxLength={2000}
          placeholder="What was your experience with this boarding house? (rent, cleanliness, landlord, safety, distance to campus)"
          className="min-h-[100px] resize-none"
        />
      </div>

      <TurnstileWidget
        onVerify={handleTurnstileVerify}
        onExpire={handleTurnstileExpire}
        resetSignal={turnstileResetKey}
      />

      {state.error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="text-sm font-medium text-emerald-600">
          {state.message}
        </p>
      )}

      <Button type="submit" disabled={isPending} className="w-full rounded-full">
        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
        Post review
      </Button>
    </form>
  );
}

export function ReportForm({ listingId }: { listingId: string }) {
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const turnstileTokenRef = useRef<TurnstileToken | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    async (_prev, formData) => {
      const token = turnstileTokenRef.current;
      if (token) {
        formData.set("turnstileToken", token.token);
        formData.set("turnstileIdempotencyKey", token.idempotencyKey);
      }
      return submitBoardingHouseReport(formData);
    },
    {},
  );

  const resetTurnstile = useCallback(() => {
    turnstileTokenRef.current = null;
    setTurnstileResetKey((value) => value + 1);
  }, []);

  const handleTurnstileVerify = useCallback((payload: TurnstileToken) => {
    turnstileTokenRef.current = payload;
  }, []);

  const handleTurnstileExpire = useCallback(() => {
    turnstileTokenRef.current = null;
  }, []);

  useEffect(() => {
    if (state.message) {
      formRef.current?.reset();
      resetTurnstile();
    } else if (state.error) {
      resetTurnstile();
    }
  }, [state, resetTurnstile]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <input type="hidden" name="listingId" value={listingId} />
      <div className="space-y-2">
        <Label htmlFor="reason">Reason</Label>
        <Input
          id="reason"
          name="reason"
          placeholder="Incorrect price, unavailable slot, safety concern"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="details">Details</Label>
        <Textarea
          id="details"
          name="details"
          required
          placeholder="Describe what students should know."
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="reporterContact">Contact (optional)</Label>
        <Input id="reporterContact" name="reporterContact" placeholder="Email or phone" />
      </div>

      <TurnstileWidget
        onVerify={handleTurnstileVerify}
        onExpire={handleTurnstileExpire}
        resetSignal={turnstileResetKey}
      />

      {state.error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="text-sm font-medium text-emerald-600">
          {state.message}
        </p>
      )}

      <Button
        type="submit"
        variant="outline"
        disabled={isPending}
        className="w-full rounded-full"
      >
        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
        Submit report
      </Button>
    </form>
  );
}
