"use client";

import { useState, useTransition } from "react";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { updateOfferingSlots } from "@/app/owner/actions";

type OfferingSlotRow = {
  id: string;
  label: string;
  availableSlots: number;
};

type OfferingSlotsQuickEditProps = {
  listingId: string;
  offerings: OfferingSlotRow[];
};

export function OfferingSlotsQuickEdit({
  listingId,
  offerings,
}: OfferingSlotsQuickEditProps) {
  const [slots, setSlots] = useState(() =>
    new Map(offerings.map((offering) => [offering.id, offering.availableSlots])),
  );
  const [isPending, startTransition] = useTransition();

  if (offerings.length === 0) return null;

  function adjust(offeringId: string, delta: number) {
    const current = slots.get(offeringId) ?? 0;
    const next = Math.max(0, current + delta);
    if (next === current) return;
    const previous = current;
    setSlots((prev) => new Map(prev).set(offeringId, next));
    startTransition(async () => {
      const result = await updateOfferingSlots(listingId, offeringId, next);
      if (result?.error) {
        setSlots((prev) => new Map(prev).set(offeringId, previous));
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-1.5" data-tour="owner-slots">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Quick availability update
      </p>
      <ul className="space-y-1.5">
        {offerings.map((offering) => {
          const value = slots.get(offering.id) ?? 0;
          return (
            <li
              key={offering.id}
              className="flex items-center justify-between gap-2 rounded-xl border bg-muted/40 px-3 py-1.5"
            >
              <span className="min-w-0 truncate text-sm">{offering.label}</span>
              <span className="flex shrink-0 items-center gap-1.5">
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-7 w-7 rounded-full"
                  disabled={isPending || value === 0}
                  onClick={() => adjust(offering.id, -1)}
                  aria-label={`Decrease available slots for ${offering.label}`}
                >
                  <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
                <span
                  className="w-8 text-center text-sm font-semibold tabular-nums"
                  aria-live="polite"
                >
                  {value}
                </span>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-7 w-7 rounded-full"
                  disabled={isPending}
                  onClick={() => adjust(offering.id, 1)}
                  aria-label={`Increase available slots for ${offering.label}`}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
