"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ArrowLeft, ArrowRight, ImagePlus, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { STORAGE_LIMITS } from "@/lib/constants/storage";
import { compressImage } from "@/lib/utils/image-compression";

export type OwnerPhotoItem =
  | { key: string; kind: "existing"; id: string; url: string; alt: string }
  | { key: string; kind: "new"; file: File; url: string };

const MAX_PHOTOS = 8;
const ACCEPTED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_COMPRESSED_BYTES = STORAGE_LIMITS.compressedMaxMB * 1024 * 1024;

export function ListingPhotoManager({
  items,
  onItemsChange,
}: {
  items: OwnerPhotoItem[];
  onItemsChange: (items: OwnerPhotoItem[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setNotice("");
    const remaining = MAX_PHOTOS - items.length;
    if (remaining <= 0) {
      setNotice(`You can add up to ${MAX_PHOTOS} photos.`);
      return;
    }

    const picked = Array.from(fileList);
    const accepted = picked.filter((file) => ACCEPTED_TYPES.has(file.type));
    if (accepted.length < picked.length) {
      setNotice("Only PNG, JPG, or WebP images are supported.");
    }
    const toAdd = accepted.slice(0, remaining);
    if (accepted.length > remaining) {
      setNotice(`Only ${remaining} more photo(s) can be added.`);
    }
    if (toAdd.length === 0) return;

    setBusy(true);
    const createdUrls: string[] = [];
    try {
      const nextItems: OwnerPhotoItem[] = [];
      for (const file of toAdd) {
        const { file: output } = await compressImage(file);
        if (output.size > MAX_COMPRESSED_BYTES) {
          throw new Error("Compressed photo exceeds the target size.");
        }
        const url = URL.createObjectURL(output);
        createdUrls.push(url);
        nextItems.push({
          key: `new-${crypto.randomUUID()}`,
          kind: "new",
          file: output,
          url,
        });
      }
      onItemsChange([...items, ...nextItems]);
    } catch {
      createdUrls.forEach((url) => URL.revokeObjectURL(url));
      setNotice("Could not process one of the photos. Please try another image.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function removeAt(index: number) {
    const item = items[index];
    if (item.kind === "new") URL.revokeObjectURL(item.url);
    onItemsChange(items.filter((_, i) => i !== index));
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onItemsChange(next);
  }

  return (
    <fieldset className="space-y-3 rounded-2xl border p-4" data-tour="owner-photos">
      <legend className="px-1 text-sm font-semibold">Photos</legend>
      <p className="text-xs text-muted-foreground">
        Add up to {MAX_PHOTOS} photos. The first photo is the{" "}
        <span className="font-medium text-foreground">cover</span> students see first.
        Images are compressed in your browser before upload.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          className="rounded-full"
          disabled={busy || items.length >= MAX_PHOTOS}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <ImagePlus className="mr-2 h-4 w-4" aria-hidden="true" />
          )}
          {busy ? "Processing..." : "Add photos"}
        </Button>
        <span className="text-xs text-muted-foreground">
          {items.length}/{MAX_PHOTOS} added
        </span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        className="sr-only"
        onChange={(event) => handleFiles(event.target.files)}
      />

      {notice ? <p className="text-xs text-destructive">{notice}</p> : null}

      {items.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {items.map((item, index) => (
            <li
              key={item.key}
              className="group relative overflow-hidden rounded-xl border bg-muted"
            >
              <div className="relative aspect-[4/3] w-full">
                <Image
                  src={item.url}
                  alt={item.kind === "existing" ? item.alt : "New listing photo"}
                  fill
                  unoptimized
                  sizes="(max-width: 640px) 50vw, 25vw"
                  className="object-cover"
                />
                {index === 0 ? (
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                    Cover
                  </span>
                ) : null}
              </div>
              <div className="flex items-center justify-between gap-1 p-1.5">
                <div className="flex gap-1">
                  <button
                    type="button"
                    aria-label="Move photo earlier"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    className="rounded-md border bg-background p-1 text-muted-foreground hover:text-foreground disabled:opacity-40"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label="Move photo later"
                    disabled={index === items.length - 1}
                    onClick={() => move(index, 1)}
                    className="rounded-md border bg-background p-1 text-muted-foreground hover:text-foreground disabled:opacity-40"
                  >
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
                <button
                  type="button"
                  aria-label="Remove photo"
                  onClick={() => removeAt(index)}
                  className="rounded-md border bg-background p-1 text-destructive hover:bg-destructive/10"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </fieldset>
  );
}
