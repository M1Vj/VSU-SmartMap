"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { ImagePlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getCategoryMeta } from "@/lib/constants/facilities";
import type { Facility } from "@/lib/types/facility";
import { cn } from "@/lib/utils";
import { ImageZoomDialog } from "@/components/ui/image-zoom-dialog";

interface FacilityHeaderProps {
    facility: Facility;
    className?: string;
    onAddPhoto?: () => void;
    parentOpen?: boolean;
}

export function FacilityHeader({ facility, className, onAddPhoto, parentOpen = true }: FacilityHeaderProps) {
    const meta = getCategoryMeta(facility.category);
    const hasImage = !!facility.imageUrl;
    const [zoomOpen, setZoomOpen] = useState(false);

    useEffect(() => {
        if (!parentOpen && zoomOpen) {
            setZoomOpen(false);
        }
    }, [parentOpen, zoomOpen]);

    useEffect(() => {
        setZoomOpen(false);
    }, [facility.id]);

    return (
        <>
            <div className={cn("space-y-4", className)}>
                <div
                    className={cn(
                        "relative w-full overflow-hidden rounded-lg",
                        hasImage ? "aspect-video" : "aspect-[3/1]"
                    )}
                >
                    {hasImage ? (
                        <button
                            type="button"
                            onClick={() => setZoomOpen(true)}
                            className="relative w-full h-full group cursor-zoom-in"
                            title="Click to zoom"
                        >
                            <Image
                                src={facility.imageUrl!}
                                alt={facility.name}
                                fill
                                className="object-cover transition-transform duration-200 group-hover:scale-105"
                                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200 flex items-center justify-center">
                                <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-white text-sm font-medium bg-black/50 px-3 py-1.5 rounded-full">
                                    Click to zoom
                                </span>
                            </div>
                            {facility.imageCredit && (
                                <div className="absolute bottom-2 right-2 z-10 max-w-[80%]">
                                    <span className="inline-block truncate text-xs text-white/70 bg-black/25 px-2 py-0.5 rounded backdrop-blur-sm">
                                        📷 {facility.imageCredit}
                                    </span>
                                </div>
                            )}
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={onAddPhoto}
                            className="flex h-full w-full items-center justify-center gap-2 bg-muted text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
                        >
                            <ImagePlus className="h-5 w-5" aria-hidden />
                            <span className="text-sm font-medium">Add Photo</span>
                        </button>
                    )}
                </div>

                <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                        <h2 className="text-2xl font-bold leading-tight">{facility.name}</h2>
                        <Badge
                            variant="outline"
                            style={{
                                backgroundColor: meta.color,
                                borderColor: meta.color,
                                color: "#ffffff",
                            }}
                        >
                            {meta.label}
                        </Badge>
                    </div>

                    {facility.code && (
                        <p className="text-sm font-medium text-muted-foreground">
                            Code: {facility.code}
                        </p>
                    )}

                    {facility.description && (
                        <p className="text-sm text-muted-foreground">{facility.description}</p>
                    )}

                </div>
            </div>

            {hasImage && (
                <ImageZoomDialog
                    open={zoomOpen && parentOpen}
                    onOpenChange={setZoomOpen}
                    src={facility.imageUrl!}
                    alt={facility.name}
                    credit={facility.imageCredit}
                />
            )}
        </>
    );
}
