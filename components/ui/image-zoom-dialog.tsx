"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Image from "next/image";
import { X, ZoomIn, ZoomOut, RotateCw } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ImageZoomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src: string;
  alt: string;
  credit?: string;
}

export function ImageZoomDialog({
  open,
  onOpenChange,
  src,
  alt,
  credit,
}: ImageZoomDialogProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const initialPinchDistance = useRef<number | null>(null);
  const initialZoom = useRef<number>(1);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.5, 3));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.5, 0.5));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);
  const handleReset = () => {
    setZoom(1);
    setRotation(0);
  };

  const handleClose = () => {
    handleReset();
    onOpenChange(false);
  };

  const getDistance = useCallback((touches: TouchList): number => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  }, []);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (e.touches.length === 2) {
      initialPinchDistance.current = getDistance(e.touches);
      initialZoom.current = zoom;
    }
  }, [zoom, getDistance]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (e.touches.length === 2 && initialPinchDistance.current !== null) {
      e.preventDefault();
      const currentDistance = getDistance(e.touches);
      const scale = currentDistance / initialPinchDistance.current;
      const newZoom = Math.max(0.5, Math.min(3, initialZoom.current * scale));
      setZoom(newZoom);
    }
  }, [getDistance]);

  const handleTouchEnd = useCallback(() => {
    initialPinchDistance.current = null;
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !open) return;

    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });
    container.addEventListener("touchend", handleTouchEnd);

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [open, handleTouchStart, handleTouchMove, handleTouchEnd]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="w-[95vw] max-w-[95vw] h-[85vh] max-h-[85vh] p-0 overflow-hidden"
        aria-describedby="image-zoom-description"
      >
        <DialogTitle className="sr-only">{alt}</DialogTitle>
        <div id="image-zoom-description" className="sr-only">
          Zoomed view of {alt}. Use controls or pinch to zoom.
        </div>

        <div className="absolute top-2 right-2 z-50 flex gap-1 sm:gap-2">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="h-8 w-8 sm:h-9 sm:w-9"
            onClick={handleZoomOut}
            disabled={zoom <= 0.5}
            title="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="h-8 w-8 sm:h-9 sm:w-9"
            onClick={handleZoomIn}
            disabled={zoom >= 3}
            title="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="h-8 w-8 sm:h-9 sm:w-9"
            onClick={handleRotate}
            title="Rotate"
          >
            <RotateCw className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="h-8 w-8 sm:h-9 sm:w-9"
            onClick={handleClose}
            title="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div
          ref={containerRef}
          className="relative flex items-center justify-center w-full h-full overflow-auto bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 touch-none"
        >
          <div
            className={cn(
              "relative transition-transform duration-200 ease-out",
              "min-w-[200px] min-h-[200px]"
            )}
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
            }}
          >
            <Image
              src={src}
              alt={alt}
              width={1200}
              height={800}
              className="object-contain max-w-full max-h-full"
              quality={100}
              priority
            />
          </div>
        </div>

        {credit && (
          <div className="absolute bottom-2 left-2 right-2 z-50 flex justify-center">
            <span className="text-xs text-muted-foreground bg-background/80 backdrop-blur px-3 py-1 rounded-full">
              📷 Photo by {credit}
            </span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
