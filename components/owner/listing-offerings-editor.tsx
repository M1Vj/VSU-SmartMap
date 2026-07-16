"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Loader2, Plus, Trash2, X } from "lucide-react";

import { BOARDING_HOUSE_ROOM_TYPES } from "@/lib/boarding-houses/types";
import { ROOM_TYPE_LABELS } from "@/lib/boarding-houses/labels";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { STORAGE_LIMITS } from "@/lib/constants/storage";
import { compressImage } from "@/lib/utils/image-compression";

export type OfferingImageState =
  | { kind: "none" }
  | { kind: "existing"; path: string; url: string }
  | { kind: "new"; file: File; url: string };

export type OfferingRow = {
  key: string;
  label: string;
  roomType: string;
  monthlyPrice: string;
  availableSlots: string;
  capacity: string;
  sizeSqm: string;
  hasAircon: boolean;
  privateBathroom: boolean;
  image: OfferingImageState;
};

const MAX_OFFERINGS = 10;
const IMAGE_ACCEPTED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_COMPRESSED_IMAGE_BYTES = STORAGE_LIMITS.compressedMaxMB * 1024 * 1024;

export function makeEmptyOffering(): OfferingRow {
  return {
    key: `offering-${crypto.randomUUID()}`,
    label: "",
    roomType: BOARDING_HOUSE_ROOM_TYPES[0],
    monthlyPrice: "",
    availableSlots: "",
    capacity: "",
    sizeSqm: "",
    hasAircon: false,
    privateBathroom: false,
    image: { kind: "none" },
  };
}

export function ListingOfferingsEditor({
  rows,
  onRowsChange,
}: {
  rows: OfferingRow[];
  onRowsChange: (rows: OfferingRow[]) => void;
}) {
  function update(index: number, patch: Partial<OfferingRow>) {
    onRowsChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function setImage(index: number, next: OfferingImageState) {
    const previous = rows[index].image;
    if (previous.kind === "new" && previous.url !== (next.kind === "new" ? next.url : "")) {
      URL.revokeObjectURL(previous.url);
    }
    update(index, { image: next });
  }

  function add() {
    if (rows.length >= MAX_OFFERINGS) return;
    onRowsChange([...rows, makeEmptyOffering()]);
  }

  function remove(index: number) {
    if (rows.length <= 1) return;
    const target = rows[index].image;
    if (target.kind === "new") URL.revokeObjectURL(target.url);
    onRowsChange(rows.filter((_, i) => i !== index));
  }

  return (
    <fieldset className="space-y-3 rounded-2xl border p-4" data-tour="owner-offerings">
      <legend className="px-1 text-sm font-semibold">Room offerings</legend>
      <p className="text-xs text-muted-foreground">
        List each room or bed type with its own price and slots. Prices and total slots
        for the listing are calculated from these rows.
      </p>

      <ul className="space-y-4">
        {rows.map((row, index) => (
          <li key={row.key} className="space-y-3 rounded-xl border bg-background p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Room {index + 1}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-destructive/10"
                disabled={rows.length <= 1}
                onClick={() => remove(index)}
              >
                <Trash2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Remove
              </Button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`offering-${index}-label`}>Label</Label>
                <Input
                  id={`offering-${index}-label`}
                  value={row.label}
                  placeholder="e.g. Aircon private room"
                  onChange={(event) => update(index, { label: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`offering-${index}-roomType`}>Room type</Label>
                <select
                  id={`offering-${index}-roomType`}
                  value={row.roomType}
                  onChange={(event) => update(index, { roomType: event.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {BOARDING_HOUSE_ROOM_TYPES.map((value) => (
                    <option key={value} value={value}>
                      {ROOM_TYPE_LABELS[value]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor={`offering-${index}-price`}>Monthly price (₱)</Label>
                <Input
                  id={`offering-${index}-price`}
                  inputMode="numeric"
                  value={row.monthlyPrice}
                  onChange={(event) => update(index, { monthlyPrice: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`offering-${index}-slots`}>Available slots</Label>
                <Input
                  id={`offering-${index}-slots`}
                  inputMode="numeric"
                  value={row.availableSlots}
                  onChange={(event) => update(index, { availableSlots: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`offering-${index}-capacity`}>People / room</Label>
                <Input
                  id={`offering-${index}-capacity`}
                  inputMode="numeric"
                  placeholder="Optional"
                  value={row.capacity}
                  onChange={(event) => update(index, { capacity: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`offering-${index}-size`}>Size (sqm)</Label>
                <Input
                  id={`offering-${index}-size`}
                  inputMode="decimal"
                  placeholder="Optional"
                  value={row.sizeSqm}
                  onChange={(event) => update(index, { sizeSqm: event.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2 text-sm">
                <Checkbox
                  checked={row.hasAircon}
                  onCheckedChange={(value) => update(index, { hasAircon: value === true })}
                />
                Aircon
              </label>
              <label className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2 text-sm">
                <Checkbox
                  checked={row.privateBathroom}
                  onCheckedChange={(value) =>
                    update(index, { privateBathroom: value === true })
                  }
                />
                Private bathroom
              </label>
            </div>

            <RoomImageField
              index={index}
              image={row.image}
              onPick={(next) => setImage(index, next)}
              onRemove={() => setImage(index, { kind: "none" })}
            />
          </li>
        ))}
      </ul>

      <Button
        type="button"
        variant="secondary"
        className="rounded-full"
        disabled={rows.length >= MAX_OFFERINGS}
        onClick={add}
      >
        <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
        Add room
      </Button>
    </fieldset>
  );
}

function RoomImageField({
  index,
  image,
  onPick,
  onRemove,
}: {
  index: number;
  image: OfferingImageState;
  onPick: (next: OfferingImageState) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function handleFile(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    setNotice("");
    if (!IMAGE_ACCEPTED_TYPES.has(file.type)) {
      setNotice("Use a PNG, JPG, or WebP image.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setBusy(true);
    try {
      const { file: output } = await compressImage(file);
      if (output.size > MAX_COMPRESSED_IMAGE_BYTES) {
        throw new Error("Compressed room photo exceeds the target size.");
      }
      onPick({ kind: "new", file: output, url: URL.createObjectURL(output) });
    } catch {
      setNotice("Could not process this room photo. Please try another image.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const preview = image.kind === "none" ? null : image.url;

  return (
    <div className="space-y-2">
      <span className="text-sm font-medium">Room photo</span>
      <div className="flex flex-wrap items-center gap-3">
        {preview ? (
          <div className="relative h-20 w-28 overflow-hidden rounded-lg border bg-muted">
            <Image
              src={preview}
              alt={`Room ${index + 1} photo`}
              fill
              unoptimized
              sizes="112px"
              className="object-cover"
            />
          </div>
        ) : null}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="rounded-full"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <ImagePlus className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            {busy ? "Processing..." : preview ? "Replace" : "Add photo"}
          </Button>
          {preview ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-full text-destructive hover:bg-destructive/10"
              onClick={onRemove}
            >
              <X className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Remove
            </Button>
          ) : null}
        </div>
      </div>
      {notice ? <p className="text-xs text-destructive">{notice}</p> : null}
      <input
        ref={inputRef}
        id={`offering-${index}-image`}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        onChange={(event) => handleFile(event.target.files)}
      />
    </div>
  );
}
