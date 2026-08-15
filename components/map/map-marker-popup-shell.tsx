"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { X } from "lucide-react";

type MapMarkerPopupShellProps = {
  label: string;
  onClose: () => void;
  children: ReactNode;
};

export function handleMapPopupKeyDown(
  event: Pick<KeyboardEvent, "key" | "preventDefault" | "stopPropagation">,
  onClose: () => void,
) {
  if (event.key !== "Escape") return;
  event.preventDefault();
  event.stopPropagation();
  onClose();
}

export function MapMarkerPopupShell({
  label,
  onClose,
  children,
}: MapMarkerPopupShellProps) {
  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-label={`${label} quick actions`}
      data-map-control="marker-popup"
      className="relative flex max-h-[min(60vh,22rem)] w-[min(260px,calc(100vw-1.5rem))] flex-col overflow-hidden"
      onKeyDown={(event) => handleMapPopupKeyDown(event, onClose)}
    >
      <button
        type="button"
        aria-label={`Close ${label} popup`}
        data-map-popup-first-control="true"
        onClick={onClose}
        className="absolute right-1 top-1 z-10 flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="h-5 w-5" aria-hidden />
      </button>
      <div className="min-h-0 overflow-y-auto pr-1">{children}</div>
    </section>
  );
}
