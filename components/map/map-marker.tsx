"use client";

import { memo, useMemo, useEffect, useRef } from "react";
import { Marker, Tooltip, Popup } from "@/components/map/leaflet-react";
import { divIcon, type DivIcon, type Marker as LeafletMarker } from "leaflet";
import {
  getPinAssetForCategory,
  getBoardingHousePinAsset,
  formatBoardingHousePinPrice,
} from "@/lib/map/pins";
import type { MapItem } from "@/lib/types/map";
import type { Facility } from "@/lib/types/facility";
import { MapPopupCard } from "./map-popup-card";
import { BoardingHouseMapPopupCard } from "./boarding-house-map-popup-card";
import { useApp } from "@/lib/context/app-context";
import { useIsMobile } from "./use-is-mobile";
import {
  createPointerActivation,
  isPrimaryPointerActivation,
  isPointerTap,
  shouldDedupeCompatibilityClick,
  type PointerActivation,
  type PointerActivationEvent,
} from "@/lib/map/pointer-activation";
import { markMapPerformance } from "@/lib/map/performance-marks";

type MapMarkerProps = {
  item: MapItem;
  displayCoordinates?: MapItem["coordinates"];
  isSelected?: boolean;
  isRouteDestination?: boolean;
  forceMinimized?: boolean;
  zoom: number;
  onSelect?: (item: MapItem) => void;
  onMarkerTapOverride?: (item: MapItem) => void;
  onMarkerActivate?: (item: MapItem, activationId: string, modality: "mouse" | "touch" | "pen" | "keyboard") => void;
  onDeselect?: () => void;
  onDirections?: (item: MapItem) => void;
};

export const MapMarker = memo(function MapMarker({
  item,
  displayCoordinates = item.coordinates,
  isSelected = false,
  isRouteDestination = false,
  forceMinimized = false,
  zoom,
  onSelect,
  onMarkerTapOverride,
  onMarkerActivate,
  onDeselect,
  onDirections,
}: MapMarkerProps) {
  const { setFacilitySheetOpen } = useApp();
  const isMobile = useIsMobile();
  const isMinimized = !isRouteDestination && (forceMinimized || zoom < 16);
  // Label shows only at high zoom and ONLY if NOT selected (avoids redundancy)
  const showSideLabel = zoom >= 18.5 && !isSelected && !forceMinimized;
  const hideTooltip = showSideLabel || isSelected;

  const icon: DivIcon = useMemo(() => {
    if (item.kind === "boarding_house") {
      const pin = getBoardingHousePinAsset({
        priceMin: item.summary.priceMin,
        name: item.name,
        selected: isSelected,
        minimized: isMinimized,
      });
      return divIcon({
        html: pin.html,
        className: pin.className,
        iconSize: pin.iconSize,
        iconAnchor: pin.iconAnchor,
        tooltipAnchor: pin.tooltipAnchor,
      });
    }

    const category = item.category ?? "academic";
    const pin = getPinAssetForCategory(category, {
      selected: isSelected,
      minimized: isMinimized,
      label: showSideLabel ? item.name : undefined
    });
    return divIcon({
      html: pin.html,
      className: pin.className,
      iconSize: pin.iconSize,
      iconAnchor: pin.iconAnchor,
      tooltipAnchor: pin.tooltipAnchor,
    });
  }, [item, isSelected, isMinimized, showSideLabel]);

  const position: [number, number] = [displayCoordinates.lat, displayCoordinates.lng];
  const markerRef = useRef<LeafletMarker>(null);
  const compatibilityActivationRef = useRef<{
    activationId: string;
    modality: "mouse" | "touch" | "pen" | "keyboard";
    pointerId: number | null;
    at: number;
  } | null>(null);
  const pointerActivationRef = useRef<PointerActivation | null>(null);
  const cancelledPointerAtRef = useRef<number | null>(null);
  const markerPerformanceStartedAtRef = useRef<number | null>(null);
  const pendingMarkerPerformanceRef = useRef<number | null>(null);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;

    marker.closeTooltip();

    if (isMobile) {
      marker.closePopup();
      return;
    }

    if (isSelected) {
      const timer = setTimeout(() => {
        marker.closeTooltip();
        marker.openPopup();
      }, 50);
      return () => clearTimeout(timer);
    } else {
      marker.closePopup();
    }
  }, [isMobile, isSelected]);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;

    const handlePopupClose = () => {
      if (isSelected) {
        onDeselect?.();
      }
    };

    marker.on("popupclose", handlePopupClose);

    return () => {
      marker.off("popupclose", handlePopupClose);
    };
  }, [isSelected, onDeselect]);

  useEffect(() => {
    if (hideTooltip) {
      markerRef.current?.closeTooltip();
    }
  }, [hideTooltip, icon]);

  useEffect(() => {
    if (!isSelected || pendingMarkerPerformanceRef.current === null) return;
    const startedAt = pendingMarkerPerformanceRef.current;
    pendingMarkerPerformanceRef.current = null;
    markMapPerformance(
      "marker-activation",
      startedAt,
      typeof performance === "undefined" ? Date.now() : performance.now(),
    );
  }, [isSelected]);

  useEffect(() => {
    const marker = markerRef.current;
    const element = marker?.getElement();
    if (!marker || !element || !onMarkerActivate) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!isPrimaryPointerActivation(event as PointerActivationEvent)) {
        pointerActivationRef.current = null;
        markerPerformanceStartedAtRef.current = null;
        return;
      }
      markerPerformanceStartedAtRef.current =
        typeof performance === "undefined" ? Date.now() : performance.now();
      pointerActivationRef.current = createPointerActivation(item.id, event as PointerActivationEvent);
      element.setPointerCapture?.(event.pointerId);
    };
    const handlePointerUp = (event: PointerEvent) => {
      const activation = pointerActivationRef.current;
      pointerActivationRef.current = null;
      if (
        !activation ||
        !isPrimaryPointerActivation(event as PointerActivationEvent) ||
        !isPointerTap(activation, event as PointerActivationEvent)
      ) {
        markerPerformanceStartedAtRef.current = null;
        cancelledPointerAtRef.current = Date.now();
        element.releasePointerCapture?.(event.pointerId);
        return;
      }
      const modality = event.pointerType === "touch" || event.pointerType === "pen" ? event.pointerType : "mouse";
      const activationId = activation.activationId;
      compatibilityActivationRef.current = { activationId, modality, pointerId: event.pointerId, at: Date.now() };
      const startedAt = markerPerformanceStartedAtRef.current ?? (
        typeof performance === "undefined" ? Date.now() : performance.now()
      );
      markerPerformanceStartedAtRef.current = null;
      if (onMarkerTapOverride || isSelected) {
        markMapPerformance(
          "marker-activation",
          startedAt,
          typeof performance === "undefined" ? Date.now() : performance.now(),
        );
      } else {
        pendingMarkerPerformanceRef.current = startedAt;
      }
      markerRef.current?.closeTooltip();
      onMarkerActivate(item, activationId, modality);
      element.releasePointerCapture?.(event.pointerId);
    };
    const handlePointerCancel = () => {
      pointerActivationRef.current = null;
      markerPerformanceStartedAtRef.current = null;
      cancelledPointerAtRef.current = Date.now();
    };
    const handleLostPointerCapture = () => {
      if (pointerActivationRef.current) {
        pointerActivationRef.current = null;
        markerPerformanceStartedAtRef.current = null;
        cancelledPointerAtRef.current = Date.now();
      }
    };

    element.addEventListener("pointerdown", handlePointerDown);
    element.addEventListener("pointerup", handlePointerUp);
    element.addEventListener("pointercancel", handlePointerCancel);
    element.addEventListener("lostpointercapture", handleLostPointerCapture);
    return () => {
      element.removeEventListener("pointerdown", handlePointerDown);
      element.removeEventListener("pointerup", handlePointerUp);
      element.removeEventListener("pointercancel", handlePointerCancel);
      element.removeEventListener("lostpointercapture", handleLostPointerCapture);
      pointerActivationRef.current = null;
      markerPerformanceStartedAtRef.current = null;
    };
  }, [isSelected, item, onMarkerActivate, onMarkerTapOverride]);

  const handleViewDetails = () => {
    setFacilitySheetOpen(true);
  };

  const accessibleName =
    item.kind === "boarding_house"
      ? (() => {
          const price = formatBoardingHousePinPrice(item.summary.priceMin);
          return price ? `${item.name} — ${price}/month` : `${item.name} — boarding house`;
        })()
      : "code" in item && item.code
        ? `${item.name} (${item.code})`
        : item.name;

  return (
    <Marker
      key={item.id}
      position={position}
      ref={markerRef}
      icon={icon}
      keyboard
      riseOnHover
      zIndexOffset={isSelected || isRouteDestination ? 1000 : 0}
      alt={accessibleName}
      eventHandlers={{
        click: (event) => {
          markerRef.current?.closeTooltip();
          const original = (event as { originalEvent?: MouseEvent & { pointerId?: number; pointerType?: string } }).originalEvent;
          const cancelledAt = cancelledPointerAtRef.current;
          if (cancelledAt !== null && Date.now() - cancelledAt < 700) {
            cancelledPointerAtRef.current = null;
            return;
          }
          const compatibility = compatibilityActivationRef.current && shouldDedupeCompatibilityClick(
            compatibilityActivationRef.current,
            { pointerId: original?.pointerId, detail: original?.detail },
            Date.now(),
          )
            ? compatibilityActivationRef.current
            : null;
          compatibilityActivationRef.current = null;
          const activationId = compatibility?.activationId ?? `${item.id}:mouse:${original?.pointerId ?? "mouse"}:${original?.timeStamp ?? Date.now()}`;
          const modality = compatibility?.modality ?? (original?.pointerType === "touch" || original?.pointerType === "pen" ? original.pointerType : "mouse");
          onMarkerActivate?.(item, activationId, modality);
          if (onMarkerActivate) return;
          if (onMarkerTapOverride) {
            onMarkerTapOverride(item);
            return;
          }
          onSelect?.(item);
        },
        keydown: (event) => {
          const original = (event as { originalEvent?: KeyboardEvent }).originalEvent;
          const key = original?.key;
          if (key === "Enter" || key === " " || key === "Spacebar") {
            original?.preventDefault();
            markerRef.current?.closeTooltip();
            const activationId = `${item.id}:keyboard:${original?.timeStamp ?? Date.now()}`;
            compatibilityActivationRef.current = { activationId, modality: "keyboard", pointerId: null, at: Date.now() };
            const startedAt = typeof performance === "undefined" ? Date.now() : performance.now();
            if (onMarkerTapOverride || isSelected) {
              markMapPerformance(
                "marker-activation",
                startedAt,
                typeof performance === "undefined" ? Date.now() : performance.now(),
              );
            } else {
              pendingMarkerPerformanceRef.current = startedAt;
            }
            onMarkerActivate?.(item, activationId, "keyboard");
            if (onMarkerActivate) return;
            if (onMarkerTapOverride) {
              onMarkerTapOverride(item);
              return;
            }
            onSelect?.(item);
          }
        },
        mouseout: () => {
          markerRef.current?.closeTooltip();
        },
        popupopen: () => {
          markerRef.current?.closeTooltip();
          if (onMarkerTapOverride) {
            markerRef.current?.closePopup();
          }
        },
      }}
      title={accessibleName}
    >
      {item.name && (
        <Tooltip
          direction="top"
          offset={[0, -10]}
          opacity={hideTooltip ? 0 : 1}
          className={hideTooltip ? "hidden" : undefined}
        >
          {item.name}
        </Tooltip>
      )}
      {!isMobile && (
        <Popup
          offset={[0, -20]}
          className="map-popup-card"
          autoPan
          autoPanPaddingTopLeft={[24, 88]}
          autoPanPaddingBottomRight={[24, 96]}
        >
          {item.kind === "boarding_house" ? (
            <BoardingHouseMapPopupCard
              listing={item.summary}
              onDirections={() => onDirections?.(item)}
            />
          ) : (
            <MapPopupCard
              facility={item as unknown as Facility}
              onViewDetails={handleViewDetails}
              onDirections={() => onDirections?.(item)}
            />
          )}
        </Popup>
      )}
    </Marker>
  );
});
