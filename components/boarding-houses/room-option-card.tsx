"use client";

import { useState } from "react";
import Image from "next/image";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ImageZoomDialog } from "@/components/ui/image-zoom-dialog";
import { formatSlotCount, roomTypeLabel } from "@/lib/boarding-houses/labels";
import type { BoardingHouseOffering } from "@/lib/boarding-houses/types";

export function RoomOptionCard({
  offering,
}: {
  offering: BoardingHouseOffering;
}) {
  const [zoomOpen, setZoomOpen] = useState(false);

  return (
    <>
      <Card className="overflow-hidden shadow-sm">
        {offering.imageUrl ? (
          <button
            type="button"
            onClick={() => setZoomOpen(true)}
            className="relative aspect-video w-full cursor-zoom-in"
            aria-label={`View ${offering.label} photo full screen`}
          >
            <Image
              src={offering.imageUrl}
              alt={offering.label}
              fill
              unoptimized
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
            />
          </button>
        ) : null}
        <CardHeader className="space-y-2">
          <CardTitle className="text-base">{offering.label}</CardTitle>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary" className="rounded-full">
              {roomTypeLabel(offering.roomType)}
            </Badge>
            {offering.hasAircon && (
              <Badge variant="secondary" className="rounded-full">
                Aircon
              </Badge>
            )}
            {offering.privateBathroom && (
              <Badge variant="secondary" className="rounded-full">
                Private bathroom
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p className="font-semibold text-primary">
            {formatOfferingPrice(offering.monthlyPrice)} / month
          </p>
          <p className="text-muted-foreground">
            {formatSlotCount(offering.availableSlots)}
            {offering.capacity != null &&
              ` · fits ${offering.capacity} ${offering.capacity === 1 ? "person" : "people"} per room`}
            {offering.sizeSqm != null && ` · ${offering.sizeSqm} sqm`}
          </p>
        </CardContent>
      </Card>

      {offering.imageUrl && (
        <ImageZoomDialog
          open={zoomOpen}
          onOpenChange={setZoomOpen}
          src={offering.imageUrl}
          alt={offering.label}
        />
      )}
    </>
  );
}

function formatOfferingPrice(value: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(value);
}
