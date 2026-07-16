"use client";

import { Button } from "@/components/ui/button";
import type { Facility } from "@/lib/types/facility";
import { Share2, Navigation, Check } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/lib/context/app-context";

interface ActionButtonsProps {
    facility: Facility;
    className?: string;
}

export function ActionButtons({ facility, className }: ActionButtonsProps) {
    const { startFacilityNavigation } = useApp();
    const [copied, setCopied] = useState(false);

    const [isNavigating, setIsNavigating] = useState(false);

    const handleShare = async () => {
        const url = `${window.location.origin}/?facility=${facility.id}`;
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy:", err);
        }
    };

    const handleDirections = () => {
        setIsNavigating(true);
        startFacilityNavigation(facility);
        setTimeout(() => setIsNavigating(false), 300);
    };

    return (
        <div className={className}>
            <div className="grid grid-cols-2 gap-3">
                <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                    onClick={handleShare}
                >
                    {copied ? (
                        <Check className="h-4 w-4" />
                    ) : (
                        <Share2 className="h-4 w-4" />
                    )}
                    {copied ? "Copied" : "Share"}
                </Button>
                <Button size="sm" className="w-full gap-2" onClick={handleDirections} loading={isNavigating}>
                    <Navigation className="h-4 w-4" />
                    Navigate
                </Button>
            </div>
        </div>
    );
}
