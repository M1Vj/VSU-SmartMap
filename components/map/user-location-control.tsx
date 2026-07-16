"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMap } from "@/components/map/leaflet-react";
import { toast } from "sonner";
import type { GeolocationState } from "@/hooks/use-geolocation";
import { UserLocationMarker } from "./user-location-marker";
import { MyLocationButton } from "./my-location-button";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { LocationHelpDialog, type LocationHelpReason } from "./location-help-dialog";
import { useApp } from "@/lib/context/app-context";
import { isPointInsideVsuCampus } from "@/lib/map/vsu-campus-boundary";

import L from "leaflet";

interface UserLocationControlProps {
  className?: string;
  destination?: { lat: number; lng: number } | null;
  selectedFacility?: { lat: number; lng: number } | null;
  geo: Pick<GeolocationState, "position" | "heading" | "error" | "isTracking" | "isSupported"> & {
    startTracking: () => void;
  };
}

const LOCATION_PERMISSION_KEY = "vsu-smartmap-location-consent";
const LOCATING_TOAST_ID = "locating-progress";
// How long to wait for a fix after an explicit tap before offering guidance,
// while the GPS watch keeps searching in the background.
const SLOW_ACQUIRE_MS = 18000;
const LOCATING_MESSAGE =
  "Finding your location… GPS can take up to a minute outdoors.";
const INSECURE_CONTEXT_MESSAGE =
  "Location requires a secure (HTTPS) connection. If you're testing on mobile, open the deployed site (HTTPS) or use an HTTPS tunnel.";

export function UserLocationControl({ className, destination, selectedFacility, geo }: UserLocationControlProps) {
  const map = useMap();
  const { locationPromptOpen, setLocationPromptOpen } = useApp();
  const {
    position,
    heading,
    error,
    isTracking,
    isSupported,
    startTracking,
  } = geo;

  const hasConsented = useCallback(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(LOCATION_PERMISSION_KEY) === "true";
  }, []);

  const hasStartedRef = useRef(false);
  const pendingFlyRef = useRef(false);
  // True only while the user is waiting on a fix they explicitly asked for, so
  // passive/auto tracking never pops the guidance modal unprompted.
  const userRequestedRef = useRef(false);
  // Once the user dismisses the guidance, don't re-open it until the next tap.
  const helpDismissedRef = useRef(false);

  const [helpOpen, setHelpOpen] = useState(false);
  const [helpReason, setHelpReason] = useState<LocationHelpReason>("searching");

  const beginRequestedLocate = useCallback(() => {
    userRequestedRef.current = true;
    helpDismissedRef.current = false;
    pendingFlyRef.current = true;
    toast.loading(LOCATING_MESSAGE, { id: LOCATING_TOAST_ID, duration: 60000 });
    startTracking();
  }, [startTracking]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.isSecureContext) return;

    // Only auto-start ONCE on mount if consented
    if (hasConsented() && !isTracking && !hasStartedRef.current) {
      hasStartedRef.current = true;
      startTracking();
    }
  }, [hasConsented, isTracking, startTracking]);

  const handleLocate = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (e.currentTarget) {
      L.DomEvent.disableClickPropagation(e.currentTarget as unknown as HTMLElement);
    }
    
    if (!isSupported) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }

    if (typeof window !== "undefined" && !window.isSecureContext) {
      toast.error(INSECURE_CONTEXT_MESSAGE);
      return;
    }

    if (position) {
      const userLatLng = L.latLng(position.coords.latitude, position.coords.longitude);
      if (!isPointInsideVsuCampus({ lat: userLatLng.lat, lng: userLatLng.lng })) {
        toast.error("Your location is outside the VSU campus map.");
        return;
      }

      const target = destination || selectedFacility;
      
      if (target) {
        const targetLatLng = L.latLng(target.lat, target.lng);
        const distance = userLatLng.distanceTo(targetLatLng);

        if (distance < 10) {
          map.flyTo(userLatLng, 18, { duration: 0.8 });
        } else {
          const bounds = L.latLngBounds([userLatLng, targetLatLng]);
          map.fitBounds(bounds, { 
            padding: [100, 100], 
            maxZoom: 18, 
            duration: 0.8,
            animate: true 
          });
        }
      } else {
        map.flyTo(userLatLng, 18, { duration: 0.8 });
      }
    } else if (hasConsented()) {
      beginRequestedLocate();
    } else {
      setLocationPromptOpen(true);
    }
  }, [isSupported, position, map, hasConsented, destination, selectedFacility, setLocationPromptOpen, beginRequestedLocate]);

  const handlePermissionConfirm = useCallback(() => {
    if (typeof window !== "undefined" && !window.isSecureContext) {
      toast.error(INSECURE_CONTEXT_MESSAGE);
      setLocationPromptOpen(false);
      return;
    }

    localStorage.setItem(LOCATION_PERMISSION_KEY, "true");
    setLocationPromptOpen(false);
    beginRequestedLocate();
  }, [beginRequestedLocate, setLocationPromptOpen]);

  const handlePermissionCancel = useCallback(() => {
    setLocationPromptOpen(false);
  }, [setLocationPromptOpen]);

  const handleHelpOpenChange = useCallback((open: boolean) => {
    setHelpOpen(open);
    if (!open) helpDismissedRef.current = true;
  }, []);

  // One-shot recenter when the fix the user explicitly asked for arrives.
  // Continuous auto-centering stays off so the map remains browsable.
  useEffect(() => {
    if (!position) return;
    // Any successful fix ends the "can't locate" state.
    setHelpOpen(false);
    userRequestedRef.current = false;

    if (!pendingFlyRef.current) return;
    pendingFlyRef.current = false;
    toast.dismiss(LOCATING_TOAST_ID);

    const userLatLng = L.latLng(position.coords.latitude, position.coords.longitude);
    if (!isPointInsideVsuCampus({ lat: userLatLng.lat, lng: userLatLng.lng })) {
      toast.error("Your location is outside the VSU campus map.");
      return;
    }

    map.flyTo(userLatLng, 18, { duration: 0.8 });
  }, [position, map]);

  useEffect(() => {
    if (!error) return;
    pendingFlyRef.current = false;
    toast.dismiss(LOCATING_TOAST_ID);

    const message = error.message ?? "";
    const isInsecure = message.toLowerCase().includes("secure");

    // Passive/auto tracking or an HTTPS-context problem: keep it to a quiet
    // toast (the guidance modal's steps don't address either).
    if (!userRequestedRef.current || isInsecure) {
      toast.error(message || "Location error occurred", { id: "location-error" });
      return;
    }

    if (helpDismissedRef.current) return;

    setHelpReason(
      error.code === 1 ? "denied" : isTracking ? "searching" : "unavailable"
    );
    setHelpOpen(true);
  }, [error, isTracking]);

  // While an explicitly requested fix is still being acquired, offer guidance
  // after a short wait — the GPS watch keeps searching underneath.
  useEffect(() => {
    if (!isTracking || position || !userRequestedRef.current) return;

    const timer = window.setTimeout(() => {
      if (!helpDismissedRef.current && userRequestedRef.current) {
        setHelpReason("searching");
        setHelpOpen(true);
      }
    }, SLOW_ACQUIRE_MS);

    return () => window.clearTimeout(timer);
  }, [isTracking, position]);

  return (
    <>
      {position && isPointInsideVsuCampus({ lat: position.coords.latitude, lng: position.coords.longitude }) && (
        <UserLocationMarker position={position} heading={heading} />
      )}

      <MyLocationButton
        isTracking={isTracking}
        isAcquiring={isTracking && !position}
        hasHeading={heading !== null}
        onLocate={handleLocate}
        className={className || "left-[12px] bottom-40 md:bottom-[80px]"}
      />

      <ConfirmDialog
        open={locationPromptOpen}
        title="Enable Location Access?"
        description="Campus SmartMap would like to access your location to show where you are on campus. Your location data stays on your device and is not stored or shared."
        confirmLabel="Enable Location"
        cancelLabel="Not Now"
        confirmVariant="default"
        onConfirm={handlePermissionConfirm}
        onCancel={handlePermissionCancel}
      />

      <LocationHelpDialog
        open={helpOpen}
        reason={helpReason}
        onOpenChange={handleHelpOpenChange}
        onRetry={beginRequestedLocate}
      />
    </>
  );
}
