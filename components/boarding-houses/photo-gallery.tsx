"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, MapPinned } from "lucide-react";

import { ImageZoomDialog } from "@/components/ui/image-zoom-dialog";

type GalleryPhoto = {
  url: string;
  alt: string;
};

type PhotoGalleryProps = {
  photos: GalleryPhoto[];
};

export function PhotoGallery({ photos }: PhotoGalleryProps) {
  const [index, setIndex] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const count = photos.length;

  const goTo = useCallback(
    (next: number) => {
      if (count === 0) return;
      setIndex(((next % count) + count) % count);
    },
    [count],
  );

  const goPrev = useCallback(() => goTo(index - 1), [goTo, index]);
  const goNext = useCallback(() => goTo(index + 1), [goTo, index]);

  useEffect(() => {
    if (index > count - 1) {
      setIndex(0);
    }
  }, [count, index]);

  if (count === 0) {
    return (
      <div className="flex h-64 items-center justify-center bg-gradient-to-br from-primary/10 via-background to-muted md:h-80">
        <MapPinned className="h-14 w-14 text-primary/70" aria-hidden="true" />
        <span className="sr-only">No photos available for this listing</span>
      </div>
    );
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (count < 2) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      goPrev();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      goNext();
    }
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current === null || count < 2) return;
    const endX = event.changedTouches[0]?.clientX ?? touchStartX.current;
    const delta = endX - touchStartX.current;
    if (Math.abs(delta) > 40) {
      if (delta < 0) {
        goNext();
      } else {
        goPrev();
      }
    }
    touchStartX.current = null;
  };

  const currentPhoto = photos[index];

  return (
    <>
      <div
        className="relative h-64 bg-muted outline-none md:h-80"
        role="group"
        aria-roledescription="carousel"
        aria-label="Listing photos"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {photos.map((photo, photoIndex) => (
          <div
            key={`${photo.url}-${photoIndex}`}
            className="absolute inset-0 transition-opacity duration-300"
            style={{ opacity: photoIndex === index ? 1 : 0 }}
            aria-hidden={photoIndex === index ? undefined : true}
          >
            <Image
              src={photo.url}
              alt={photo.alt}
              fill
              sizes="(min-width: 1024px) 768px, 100vw"
              className="object-cover"
              priority={photoIndex === 0}
              loading={photoIndex === 0 ? "eager" : "lazy"}
            />
          </div>
        ))}

        <button
          type="button"
          onClick={() => setZoomOpen(true)}
          aria-label="View photo full screen"
          className="absolute inset-0 z-0 cursor-zoom-in"
        />

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={goPrev}
              aria-label="Previous photo"
              className="absolute left-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-foreground shadow transition hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="Next photo"
              className="absolute right-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-foreground shadow transition hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
            <div
              className="absolute bottom-2 right-2 z-10 rounded-full bg-background/80 px-2.5 py-1 text-xs font-medium text-foreground shadow"
              aria-live="polite"
            >
              {index + 1} of {count}
            </div>
          </>
        )}
      </div>

      {currentPhoto && (
        <ImageZoomDialog
          open={zoomOpen}
          onOpenChange={setZoomOpen}
          src={currentPhoto.url}
          alt={currentPhoto.alt}
        />
      )}
    </>
  );
}
