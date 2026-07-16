"use client";

import { Dialog, DialogTitle } from "@/components/ui/dialog";
import {
  DialogScaffoldBody,
  DialogScaffoldContent,
  DialogScaffoldHeader,
} from "@/components/ui/dialog-scaffold";
import dynamic from "next/dynamic";
import type { LatLng } from "@/lib/types/common";

const LocationPreviewMap = dynamic(() => import("./location-preview-map").then((m) => m.LocationPreviewMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-[300px] items-center justify-center bg-muted rounded-md">
      <span className="text-sm text-muted-foreground">Loading map...</span>
    </div>
  ),
});

interface LocationPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coordinates: LatLng;
  title?: string;
}

export function LocationPreviewDialog({ open, onOpenChange, coordinates, title }: LocationPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogScaffoldContent className="sm:max-w-lg">
        <DialogScaffoldHeader>
          <DialogTitle>{title ?? "Location Preview"}</DialogTitle>
        </DialogScaffoldHeader>
        <DialogScaffoldBody className="py-4">
          <div className="h-[300px] w-full rounded-md overflow-hidden border">
            <LocationPreviewMap coordinates={coordinates} />
          </div>
        </DialogScaffoldBody>
      </DialogScaffoldContent>
    </Dialog>
  );
}
