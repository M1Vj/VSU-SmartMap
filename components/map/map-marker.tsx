"use client";

import { useMemo, useEffect, useRef } from "react";
import { Marker, Tooltip, Popup } from "@/components/map/leaflet-react";
import { divIcon, type DivIcon, type Marker as LeafletMarker } from "leaflet";
import type { LeafletMouseEvent } from "leaflet";
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
import { startMapPerformance } from "@/lib/map/performance";
import { resolveMarkerActivation, type MarkerActivation } from "@/lib/map/marker-activation";

type MapMarkerProps = {
  item: MapItem;
  displayCoordinates?: MapItem["coordinates"];
  isSelected?: boolean;
  isRouteDestination?: boolean;
  forceMinimized?: boolean;
  zoom: number;
  onSelect?: (item: MapItem) => void;
  onMarkerTapOverride?: (item: MapItem) => void;
  onDeselect?: () => void;
  onDirections?: (item: MapItem) => void;
};

type MarkerActivationModality = "pointer" | "keyboard";

export function MapMarker({
  item,
  displayCoordinates = item.coordinates,
  isSelected = false,
  isRouteDestination = false,
  forceMinimized = false,
  zoom,
  onSelect,
  onMarkerTapOverride,
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
  const lastPointerTapRef = useRef<MarkerActivation | null>(null);
  const pendingTouchRef = useRef<MarkerActivation | null>(null);
  const suppressNextKeyboardClickRef = useRef(false);

  const activateMarker = (at: number, _modality: MarkerActivationModality) => {
    markerRef.current?.closeTooltip();
    if (onMarkerTapOverride) {
      onMarkerTapOverride(item);
      return;
    }
    startMapPerformance("marker_first_interaction", at);
    onSelect?.(item);
  };

  const handleMarkerTap = (event: LeafletMouseEvent) => {
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    const originalEvent = event.originalEvent as MouseEvent & {
      pointerType?: string;
      pointerId?: number;
      changedTouches?: TouchList;
      sourceCapabilities?: { firesTouchEvents?: boolean } | null;
    };
    const clickDetail = typeof originalEvent?.detail === "number" ? originalEvent.detail : null;
    if (suppressNextKeyboardClickRef.current && (clickDetail === 0 || clickDetail === null)) {
      suppressNextKeyboardClickRef.current = false;
      return;
    }
    suppressNextKeyboardClickRef.current = false;
    const resolved = resolveMarkerActivation({
      lat: event.latlng.lat,
      lng: event.latlng.lng,
      at: now,
      pointerType:
        originalEvent.pointerType === "touch" || originalEvent.pointerType === "mouse"
          ? originalEvent.pointerType
          : undefined,
      firesTouchEvents: originalEvent.sourceCapabilities?.firesTouchEvents,
      activationId:
        typeof originalEvent.pointerId === "number"
          ? originalEvent.pointerId
          : originalEvent.changedTouches?.[0]?.identifier,
      previous: lastPointerTapRef.current,
      pending: pendingTouchRef.current,
    });

    pendingTouchRef.current = null;

    if (resolved.suppress) {
      return;
    }

    lastPointerTapRef.current = resolved.activation;
    activateMarker(now, "pointer");
  };

  useEffect(() => {
    const element = markerRef.current?.getElement();
    if (!element) return;

    const markPointer = (event: PointerEvent | TouchEvent) => {
      const pointerType =
        "pointerType" in event && (event.pointerType === "touch" || event.pointerType === "mouse")
          ? event.pointerType
          : "touch";
      const touch = "changedTouches" in event ? event.changedTouches[0] : null;
      const activationId = "pointerId" in event ? event.pointerId : touch?.identifier;

      pendingTouchRef.current = {
        lat: displayCoordinates.lat,
        lng: displayCoordinates.lng,
        at: typeof performance !== "undefined" ? performance.now() : Date.now(),
        input: pointerType,
        compatibility: false,
        awaitingCompatibility: pointerType === "touch",
        activationId: typeof activationId === "number" ? activationId : undefined,
      };
    };

    element.addEventListener("pointerdown", markPointer as EventListener, { passive: true });
    element.addEventListener("touchstart", markPointer as EventListener, { passive: true });
    return () => {
      element.removeEventListener("pointerdown", markPointer as EventListener);
      element.removeEventListener("touchstart", markPointer as EventListener);
    };
  }, [displayCoordinates.lat, displayCoordinates.lng, icon]);

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
        click: handleMarkerTap,
        keydown: (event) => {
          const original = (event as { originalEvent?: KeyboardEvent }).originalEvent;
          const key = original?.key;
          if (key === "Enter" || key === " " || key === "Spacebar") {
            original?.preventDefault();
            const now = typeof performance !== "undefined" ? performance.now() : Date.now();
            suppressNextKeyboardClickRef.current = true;
            activateMarker(now, "keyboard");
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
}
