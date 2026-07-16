"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Facility } from "@/lib/types/facility";
import type { Suggestion } from "@/lib/types/suggestion";
import type { UnifiedFacilityFormValues } from "@/lib/validation/facility";
import { cn } from "@/lib/utils";
import { formatDatePH } from "@/lib/utils/date";
import { approveSuggestion, rejectSuggestion } from "@/app/admin/suggestions/actions";
import { FacilityDialog } from "@/components/admin/facility-dialog";
import { uploadFacilityHeroClient } from "@/lib/supabase/storage-client";
import { ImageZoomDialog } from "@/components/ui/image-zoom-dialog";
import { Pencil, MapPin } from "lucide-react";
import { toast } from "sonner";
import { LocationPreviewDialog } from "@/components/admin/location-preview-dialog";
import type { LatLng } from "@/lib/types/common";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
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

interface SuggestionDiffViewProps {
  suggestion: Suggestion;
  payload: Partial<UnifiedFacilityFormValues>;
  currentFacility: Facility | null;
}

type FieldKey = keyof Pick<
  UnifiedFacilityFormValues,
  "name" | "code" | "description" | "category" | "hasRooms" | "coordinates" | "imageUrl" | "imageCredit" | "website" | "facebook" | "phone"
>;

const fieldLabels: Record<FieldKey, string> = {
  name: "Name",
  code: "Code",
  description: "Description",
  category: "Category",
  hasRooms: "Has Rooms",
  coordinates: "Coordinates",
  imageUrl: "Image",
  imageCredit: "Photo Credit",
  website: "Website",
  facebook: "Facebook",
  phone: "Phone",
};

const formatValue = (key: FieldKey, value: unknown) => {
  if (value === undefined || value === null) return "—";
  if (key === "hasRooms") return value ? "Building (has rooms)" : "POI (no rooms)";
  if (key === "coordinates" && typeof value === "object") {
    const coords = value as { lat?: number; lng?: number };
    return coords.lat !== undefined && coords.lng !== undefined
      ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`
      : "—";
  }
  if (key === "imageUrl") {
    return value ? "(image uploaded)" : "—";
  }
  return String(value);
};

const COORD_EPSILON = 1e-6;

const hasDifference = (
  key: FieldKey,
  currentValues: Partial<UnifiedFacilityFormValues> | null,
  payload: Partial<UnifiedFacilityFormValues>,
) => {
  if (!currentValues) return true;
  const nextValue = payload[key];
  if (nextValue === undefined) return false;

  const currentValue = currentValues[key];

  if (key === "coordinates") {
    const currentCoords = currentValue as { lat?: number; lng?: number } | undefined;
    const nextCoords = nextValue as { lat?: number; lng?: number } | undefined;
    if (!currentCoords || !nextCoords) return !!nextCoords;
    const latDiff = typeof currentCoords.lat === "number" && typeof nextCoords.lat === "number"
      ? Math.abs(currentCoords.lat - nextCoords.lat) > COORD_EPSILON
      : currentCoords.lat !== nextCoords.lat;
    const lngDiff = typeof currentCoords.lng === "number" && typeof nextCoords.lng === "number"
      ? Math.abs(currentCoords.lng - nextCoords.lng) > COORD_EPSILON
      : currentCoords.lng !== nextCoords.lng;
    return latDiff || lngDiff;
  }

  return JSON.stringify(currentValue) !== JSON.stringify(nextValue);
};

export function SuggestionDiffView({ suggestion, payload, currentFacility }: SuggestionDiffViewProps) {
  const currentValues: Partial<UnifiedFacilityFormValues> | null = currentFacility
    ? {
      code: currentFacility.code ?? null,
      name: currentFacility.name,
      description: currentFacility.description ?? "",
      category: currentFacility.category,
      hasRooms: currentFacility.hasRooms,
      coordinates: currentFacility.coordinates,
      imageUrl: currentFacility.imageUrl ?? "",
      imageCredit: currentFacility.imageCredit ?? "",
      website: currentFacility.website ?? "",
      facebook: currentFacility.facebook ?? "",
      phone: currentFacility.phone ?? "",
      slug: currentFacility.slug,
    }
    : null;

  const [editedPayload, setEditedPayload] = useState<Partial<UnifiedFacilityFormValues>>(payload);
  const [isEditing, setIsEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [zoomImage, setZoomImage] = useState<{ src: string; alt: string } | null>(null);
  const [previewLocation, setPreviewLocation] = useState<{ coords: LatLng; title: string } | null>(null);

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
        toast.error("Failed to approve suggestion");
        return;
      }
      setMessage("Suggestion approved and applied.");
      toast.success("Suggestion approved!");
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
        toast.error("Failed to reject suggestion");
        return;
      }
      setMessage("Suggestion rejected.");
      toast.success("Suggestion rejected");
      router.push("/admin/suggestions");
    });
  };

  const handleEditSubmit = async (
    values: UnifiedFacilityFormValues,
    options?: { file?: File | null; clearImage?: boolean },
  ) => {
    let imageUrl = values.imageUrl ?? editedPayload.imageUrl;

    if (options?.file) {
      const tempId = crypto.randomUUID();
      const upload = await uploadFacilityHeroClient(tempId, options.file);
      if (upload.error) {
        setError(upload.error.message);
        return;
      }
      imageUrl = upload.data?.publicUrl ?? imageUrl;
    } else if (options?.clearImage) {
      imageUrl = undefined;
    }

    setEditedPayload({ ...values, imageUrl });
    setIsEditing(false);
  };

  const dialogFacility: Facility = {
    id: currentFacility?.id ?? "temp-id",
    code: editedPayload.code ?? currentFacility?.code,
    slug: editedPayload.slug ?? currentFacility?.slug ?? "",
    name: editedPayload.name ?? currentFacility?.name ?? "New Facility",
    description: editedPayload.description ?? currentFacility?.description,
    category: editedPayload.category ?? currentFacility?.category ?? "landmark",
    coordinates: editedPayload.coordinates ?? currentFacility?.coordinates ?? { lat: 0, lng: 0 },
    imageUrl: editedPayload.imageUrl ?? currentFacility?.imageUrl,
    imageCredit: editedPayload.imageCredit ?? currentFacility?.imageCredit,
    website: editedPayload.website ?? currentFacility?.website,
    facebook: editedPayload.facebook ?? currentFacility?.facebook,
    phone: editedPayload.phone ?? currentFacility?.phone,
    hasRooms: editedPayload.hasRooms ?? currentFacility?.hasRooms ?? false,
    createdAt: currentFacility?.createdAt ?? new Date().toISOString(),
    updatedAt: currentFacility?.updatedAt ?? new Date().toISOString(),
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="outline">{suggestion.type.replace("_", " ")}</Badge>
        <Badge variant="secondary">{suggestion.status}</Badge>
        <span className="text-sm text-muted-foreground">
          Submitted {formatDatePH(suggestion.createdAt)}
        </span>
      </div>

      {message && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
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
                  {key === "imageUrl" && currentValues.imageUrl ? (
                    <button
                      type="button"
                      className="relative h-32 w-full overflow-hidden rounded-md border cursor-zoom-in hover:ring-2 hover:ring-primary/50 transition-shadow"
                      onClick={() => setZoomImage({ src: currentValues.imageUrl!, alt: "Current image" })}
                    >
                      <Image
                        src={currentValues.imageUrl}
                        alt="Current image"
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 50vw"
                      />
                    </button>
                  ) : key === "coordinates" && currentValues.coordinates && currentValues.coordinates.lat !== undefined && currentValues.coordinates.lng !== undefined ? (
                    <button
                      type="button"
                      className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors cursor-pointer"
                      onClick={() => setPreviewLocation({ coords: currentValues.coordinates!, title: "Current Location" })}
                    >
                      <MapPin className="h-4 w-4" />
                      <span className="underline underline-offset-2">{formatValue(key, currentValues[key])}</span>
                    </button>
                  ) : (
                    <p className="text-sm text-foreground">{formatValue(key, currentValues[key])}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No existing record. This will create a new facility if approved.
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
              const changed = hasDifference(key, currentValues, editedPayload);
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
                  {key === "imageUrl" && typeof value === "string" && value ? (
                    <button
                      type="button"
                      className="relative h-32 w-full overflow-hidden rounded-md border cursor-zoom-in hover:ring-2 hover:ring-primary/50 transition-shadow"
                      onClick={() => setZoomImage({ src: value, alt: "Proposed image" })}
                    >
                      <Image
                        src={value}
                        alt="Proposed image"
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 50vw"
                      />
                    </button>
                  ) : key === "coordinates" && value && typeof value === "object" && (value as LatLng).lat !== undefined && (value as LatLng).lng !== undefined ? (
                    <button
                      type="button"
                      className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors cursor-pointer"
                      onClick={() => setPreviewLocation({ coords: value as LatLng, title: "Proposed Location" })}
                    >
                      <MapPin className="h-4 w-4" />
                      <span className="underline underline-offset-2">{formatValue(key, value)}</span>
                    </button>
                  ) : (
                    <p className="text-sm text-foreground">{formatValue(key, value)}</p>
                  )}
                  {changed && currentValues && (
                    <p className="text-xs text-primary">
                      Updated from {formatValue(key, currentValues[key])}
                    </p>
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
        title="Approve Suggestion"
        description="Are you sure you want to approve this suggestion? This will update the live data immediately."
        confirmLabel="Approve"
        confirmVariant="default"
        onConfirm={executeApprove}
        onCancel={() => setShowApproveDialog(false)}
        loading={pending}
      />

      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogScaffoldContent className="sm:max-w-md">
          <DialogScaffoldHeader>
            <DialogTitle>Reject Suggestion</DialogTitle>
            <DialogDescription>
              Are you sure you want to reject this suggestion? This action cannot be undone.
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

      <FacilityDialog
        open={isEditing}
        mode={suggestion.type === "ADD_FACILITY" ? "create" : "edit"}
        facility={dialogFacility}
        onOpenChange={setIsEditing}
        onSubmit={handleEditSubmit}
        title="Edit Suggestion"
        description="Modify the proposed details before approving."
        submitLabel="Update Proposal"
        showSlug={true}
      />

      {zoomImage && (
        <ImageZoomDialog
          open={!!zoomImage}
          onOpenChange={(open) => !open && setZoomImage(null)}
          src={zoomImage.src}
          alt={zoomImage.alt}
        />
      )}

      {previewLocation && (
        <LocationPreviewDialog
          open={!!previewLocation}
          onOpenChange={(open) => !open && setPreviewLocation(null)}
          coordinates={previewLocation.coords}
          title={previewLocation.title}
        />
      )}
    </div>
  );
}
