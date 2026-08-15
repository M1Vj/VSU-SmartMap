"use client";

import { memo, useMemo, useEffect, useRef, useCallback, useState } from "react";
import { Marker, Tooltip, Popup, useMap } from "@/components/map/leaflet-react";
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
import { MapMarkerPopupShell } from "./map-marker-popup-shell";
import { useApp } from "@/lib/context/app-context";
import {
  createMarkerPopupLifecycleController,
  type MarkerPopupModality,
} from "@/lib/map/popup-lifecycle";
import {
  shouldDeselectAfterPopupClose,
  type MarkerPopupCloseReason,
} from "@/lib/map/popup-close";
import {
  createPointerActivation,
  isPrimaryCompatibilityClick,
  isPrimaryPointerActivation,
  isPointerTap,
  shouldDedupeCompatibilityClick,
  type PointerActivation,
  type PointerActivationEvent,
} from "@/lib/map/pointer-activation";
import { markMapPerformance } from "@/lib/map/performance-marks";
import {
  recordMapEvidenceEvent,
  registerDestinationMarkerForEvidence,
} from "@/lib/map/e2e-probe-bridge";
import {
  computePopupAutoPanPadding,
  DEFAULT_POPUP_BOTTOM_PADDING,
  DEFAULT_POPUP_TOP_PADDING,
  type PopupObstacleRect,
} from "@/lib/map/map-popup-clearance";

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
  onDirections?: (item: MapItem) => number | null;
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
  const map = useMap();
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
  const [readyMarker, setReadyMarker] = useState<LeafletMarker | null>(null);
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
  const selectedRef = useRef(isSelected);
  selectedRef.current = isSelected;
  const lastActivationModalityRef = useRef<MarkerPopupModality>("mouse");
  const lastActivationIdRef = useRef<string | undefined>(undefined);
  const popupOpenFrameRef = useRef<number | null>(null);
  const popupOpenGenerationRef = useRef(0);
  const popupFocusFrameRef = useRef<number | null>(null);
  const markerRestoreFrameRef = useRef<number | null>(null);
  const markerRestoreGenerationRef = useRef(0);
  const [popupAutoPanPadding, setPopupAutoPanPadding] = useState({
    top: DEFAULT_POPUP_TOP_PADDING,
    bottom: DEFAULT_POPUP_BOTTOM_PADDING,
  });
  const popupLifecycle = useMemo(() => createMarkerPopupLifecycleController(), []);

  const cancelPopupOpen = useCallback(() => {
    popupOpenGenerationRef.current += 1;
    const frameId = popupOpenFrameRef.current;
    if (frameId === null) return;
    if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(frameId);
    popupOpenFrameRef.current = null;
  }, []);

  const cancelPopupFocus = useCallback(() => {
    const frameId = popupFocusFrameRef.current;
    if (frameId === null) return;
    if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(frameId);
    popupFocusFrameRef.current = null;
  }, []);

  const cancelMarkerRestoreFocus = useCallback(() => {
    markerRestoreGenerationRef.current += 1;
    const frameId = markerRestoreFrameRef.current;
    if (frameId === null) return;
    if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(frameId);
    markerRestoreFrameRef.current = null;
  }, []);

  const requestMarkerRestoreFocus = useCallback(() => {
    cancelMarkerRestoreFocus();
    const generation = ++markerRestoreGenerationRef.current;
    const restoreCurrentMarkerFocus = () => {
      markerRestoreFrameRef.current = null;
      if (markerRestoreGenerationRef.current !== generation) return;
      const element = markerRef.current?.getElement();
      if (!element?.isConnected) return;
      element.focus();
    };
    if (typeof requestAnimationFrame === "function") {
      markerRestoreFrameRef.current = requestAnimationFrame(restoreCurrentMarkerFocus);
    } else {
      queueMicrotask(restoreCurrentMarkerFocus);
    }
  }, [cancelMarkerRestoreFocus]);

  const closePopup = useCallback((reason: MarkerPopupCloseReason) => {
    const marker = markerRef.current;
    cancelPopupOpen();
    cancelPopupFocus();
    cancelMarkerRestoreFocus();
    const closed = popupLifecycle.close(reason, {
      closePopup: () => marker?.closePopup(),
      onDeselect: () => {
        if (shouldDeselectAfterPopupClose(selectedRef.current, reason)) {
          onDeselect?.();
        }
      },
      restoreMarkerFocus: requestMarkerRestoreFocus,
    });
    if (closed && reason !== "action") {
      recordMapEvidenceEvent(
        "popup-close",
        lastActivationIdRef.current,
        lastActivationModalityRef.current,
      );
    }
    return closed;
  }, [cancelMarkerRestoreFocus, cancelPopupFocus, cancelPopupOpen, onDeselect, popupLifecycle, requestMarkerRestoreFocus]);

  useEffect(() => () => {
    cancelPopupOpen();
    cancelPopupFocus();
    cancelMarkerRestoreFocus();
  }, [cancelMarkerRestoreFocus, cancelPopupFocus, cancelPopupOpen]);

  const requestPopupOpen = useCallback((fromActivation = false) => {
    const marker = markerRef.current;
    if (!marker || onMarkerTapOverride) return;
    if (!fromActivation && (marker.isPopupOpen() || popupOpenFrameRef.current !== null)) return;
    if (fromActivation) {
      cancelPopupOpen();
      cancelPopupFocus();
      cancelMarkerRestoreFocus();
      popupLifecycle.selectionChanged(true);
    }
    const generation = ++popupOpenGenerationRef.current;
    const openAfterNativeToggle = () => {
      popupOpenFrameRef.current = null;
      if (popupOpenGenerationRef.current !== generation) return;
      if (!selectedRef.current || onMarkerTapOverride || marker.isPopupOpen()) return;
      marker.closeTooltip();
      marker.openPopup();
    };
    if (typeof requestAnimationFrame === "function") {
      popupOpenFrameRef.current = requestAnimationFrame(openAfterNativeToggle);
    } else {
      queueMicrotask(openAfterNativeToggle);
    }
  }, [cancelMarkerRestoreFocus, cancelPopupFocus, cancelPopupOpen, onMarkerTapOverride, popupLifecycle]);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;

    selectedRef.current = isSelected;
    marker.closeTooltip();

    if (isSelected && !onMarkerTapOverride) requestPopupOpen();

    if (onMarkerTapOverride) {
      cancelPopupOpen();
      if (marker.isPopupOpen()) closePopup("selection-transfer");
      if (!isSelected) popupLifecycle.selectionChanged(false);
      return;
    }

    if (!isSelected) {
      cancelPopupOpen();
      if (marker.isPopupOpen()) closePopup("selection-transfer");
      popupLifecycle.selectionChanged(false);
      return;
    }
  }, [cancelPopupOpen, closePopup, isSelected, onMarkerTapOverride, popupLifecycle, requestPopupOpen]);

  const destinationEvidenceRegistration = useMemo(() => {
    if (!isRouteDestination) return null;
    const iconAnchor = icon.options.iconAnchor;
    const iconSize = icon.options.iconSize;
    if (!iconAnchor || !iconSize) return null;
    const [anchorX, anchorY] = Array.isArray(iconAnchor)
      ? iconAnchor
      : [iconAnchor.x, iconAnchor.y];
    const [sizeX, sizeY] = Array.isArray(iconSize)
      ? iconSize
      : [iconSize.x, iconSize.y];
    if (![anchorX, anchorY, sizeX, sizeY].every((value) => typeof value === "number" && Number.isFinite(value))) {
      return null;
    }
    return {
      coordinate: item.coordinates,
      iconAnchor: [anchorX, anchorY] as const,
      iconSize: [sizeX, sizeY] as const,
    };
  }, [icon, isRouteDestination, item.coordinates]);

  useEffect(() => {
    if (!readyMarker || !destinationEvidenceRegistration) return;
    return registerDestinationMarkerForEvidence({ marker: readyMarker, ...destinationEvidenceRegistration });
  }, [destinationEvidenceRegistration, readyMarker]);

  useEffect(() => {
    const element = readyMarker?.getElement();
    if (!element) return;
    const evidenceKind = item.kind === "boarding_house" ? "boarding" : "facility";
    element.dataset.mapItemKind = evidenceKind;
    return () => {
      if (element.dataset.mapItemKind === evidenceKind) delete element.dataset.mapItemKind;
    };
  }, [item.kind, readyMarker]);

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
    if (!isSelected || onMarkerTapOverride) {
      setPopupAutoPanPadding({
        top: DEFAULT_POPUP_TOP_PADDING,
        bottom: DEFAULT_POPUP_BOTTOM_PADDING,
      });
      return;
    }

    const mapContainer = map.getContainer();
    const obstacleSelector = '[data-map-popup-obstacle="top"], [data-map-popup-obstacle="bottom"]';
    const measurePopupClearance = () => {
      if (typeof document === "undefined") return;
      const mapRect = mapContainer.getBoundingClientRect();
      const obstacles = Array.from(
        document.querySelectorAll<HTMLElement>(obstacleSelector),
      ).flatMap((element): PopupObstacleRect[] => {
        const side = element.dataset.mapPopupObstacle;
        if (side !== "top" && side !== "bottom") return [];
        const rect = element.getBoundingClientRect();
        return [{ side, top: rect.top, bottom: rect.bottom }];
      });
      setPopupAutoPanPadding(
        computePopupAutoPanPadding({
          mapRect,
          obstacles,
        }),
      );
    };

    measurePopupClearance();
    const resizeObserver = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(measurePopupClearance);
    resizeObserver?.observe(mapContainer);
    document.querySelectorAll<HTMLElement>(obstacleSelector).forEach((element) => {
      resizeObserver?.observe(element);
    });
    const handleWindowResize = () => measurePopupClearance();
    const handleMapResize = () => measurePopupClearance();
    window.addEventListener("resize", handleWindowResize);
    map.on("resize", handleMapResize);

    return () => {
      if (resizeObserver) resizeObserver.disconnect();
      window.removeEventListener("resize", handleWindowResize);
      map.off("resize", handleMapResize);
    };
  }, [isSelected, isRouteDestination, onMarkerTapOverride, map]);

  useEffect(() => {
    const popup = readyMarker?.getPopup();
    if (!popup) return;
    popup.options.autoPanPaddingTopLeft = [12, popupAutoPanPadding.top];
    popup.options.autoPanPaddingBottomRight = [12, popupAutoPanPadding.bottom];
  }, [popupAutoPanPadding, readyMarker]);

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
      lastActivationIdRef.current = activationId;
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
      lastActivationModalityRef.current = modality;
      if (isSelected) requestPopupOpen(true);
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
  }, [icon, isSelected, item, onMarkerActivate, onMarkerTapOverride, requestPopupOpen]);

  const handleDetails = useCallback(() => {
    if (!closePopup("action")) return false;
    recordMapEvidenceEvent("details", lastActivationIdRef.current, lastActivationModalityRef.current);
    return true;
  }, [closePopup]);

  const handleViewDetails = useCallback(() => {
    if (!handleDetails()) return;
    setFacilitySheetOpen(true);
  }, [handleDetails, setFacilitySheetOpen]);

  const handleDirections = useCallback(() => {
    const requestId = popupLifecycle.navigate(
      () => {
        const requestId = onDirections?.(item);
        return typeof requestId === "number" ? requestId : null;
      },
      {
        closePopup: () => markerRef.current?.closePopup(),
      },
    );
    if (typeof requestId === "number") {
      recordMapEvidenceEvent("navigate", requestId, lastActivationModalityRef.current);
    }
    return requestId;
  }, [item, onDirections, popupLifecycle]);

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
      onReady={setReadyMarker}
      icon={icon}
      keyboard
      riseOnHover
      zIndexOffset={isSelected || isRouteDestination ? 1000 : 0}
      alt={accessibleName}
      eventHandlers={{
        click: (event) => {
          markerRef.current?.closeTooltip();
          const original = (event as {
            originalEvent?: MouseEvent & {
              pointerId?: number;
              pointerType?: string;
              isPrimary?: boolean;
            };
          }).originalEvent;
          if (!isPrimaryCompatibilityClick({ button: original?.button, isPrimary: original?.isPrimary })) {
            return;
          }
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
          lastActivationIdRef.current = activationId;
          lastActivationModalityRef.current = modality;
          if (isSelected) requestPopupOpen(true);
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
            lastActivationIdRef.current = activationId;
            lastActivationModalityRef.current = "keyboard";
            if (isSelected) requestPopupOpen(true);
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
            return;
          }
          recordMapEvidenceEvent(
            "popup-open",
            lastActivationIdRef.current,
            lastActivationModalityRef.current,
          );
          popupLifecycle.opened(lastActivationModalityRef.current, () => {
            cancelPopupFocus();
            const focusFirstControl = () => {
              popupFocusFrameRef.current = null;
              if (!selectedRef.current || !markerRef.current?.isPopupOpen()) return;
              markerRef.current?.getPopup()?.getElement()
                ?.querySelector<HTMLElement>('[data-map-popup-first-control="true"]')
                ?.focus();
            };
            if (typeof requestAnimationFrame === "function") {
              popupFocusFrameRef.current = requestAnimationFrame(focusFirstControl);
            } else {
              queueMicrotask(focusFirstControl);
            }
          });
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
      {!onMarkerTapOverride && (
        <Popup
          offset={[0, -20]}
          className="map-popup-card"
          closeButton={false}
          closeOnEscapeKey={false}
          autoPan
          autoPanPaddingTopLeft={[12, popupAutoPanPadding.top]}
          autoPanPaddingBottomRight={[12, popupAutoPanPadding.bottom]}
        >
          <MapMarkerPopupShell
            label={accessibleName}
            onClose={() => closePopup("dismiss")}
          >
            {item.kind === "boarding_house" ? (
              <BoardingHouseMapPopupCard
                listing={item.summary}
                onDetails={handleDetails}
                onDirections={handleDirections}
              />
            ) : (
              <MapPopupCard
                facility={item as unknown as Facility}
                onViewDetails={handleViewDetails}
                onDirections={handleDirections}
              />
            )}
          </MapMarkerPopupShell>
        </Popup>
      )}
    </Marker>
  );
});
