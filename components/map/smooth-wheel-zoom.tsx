"use client";

import { useEffect } from "react";
import L from "leaflet";
import { useMap } from "@/components/map/leaflet-react";
import {
  MAP_SMOOTH_CONTROL_ZOOM_OPTIONS,
  MAP_SMOOTH_WHEEL_ZOOM_OPTIONS,
} from "@/lib/map/wheel-zoom";

type SmoothWheelZoomOptions = typeof MAP_SMOOTH_WHEEL_ZOOM_OPTIONS;
type SmoothControlZoomOptions = typeof MAP_SMOOTH_CONTROL_ZOOM_OPTIONS;

type SmoothWheelLeafletMap = L.Map & {
  _limitZoom: (zoom: number) => number;
  _move: (
    center: L.LatLngExpression,
    zoom: number,
    data?: Record<string, unknown>,
    suppressEvent?: boolean
  ) => L.Map;
  _moveEnd: (zoomChanged?: boolean) => L.Map;
  _moveStart: (zoomChanged?: boolean, noMoveStart?: boolean) => L.Map;
  _panAnim?: { stop: () => void };
  _stop: () => L.Map;
};

type SmoothWheelZoomProps = {
  options?: SmoothWheelZoomOptions;
};

export function SmoothWheelZoom({
  options = MAP_SMOOTH_WHEEL_ZOOM_OPTIONS,
}: SmoothWheelZoomProps) {
  const map = useMap() as SmoothWheelLeafletMap;

  useEffect(() => {
    if (!options.enabled) return;

    map.scrollWheelZoom.disable();

    const container = map.getContainer();
    const centerPoint = () => map.getSize().divideBy(2);

    let goalZoom = map.getZoom();
    let anchorPoint = centerPoint();
    let anchorLatLng = map.getCenter();
    let frameId = 0;
    let quietTimer: ReturnType<typeof setTimeout> | null = null;
    let zooming = false;
    let wheelActive = false;
    let moved = false;

    const cancelFrame = () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
        frameId = 0;
      }
    };

    const clearQuietTimer = () => {
      if (quietTimer) {
        clearTimeout(quietTimer);
        quietTimer = null;
      }
    };

    const finishZoom = () => {
      clearQuietTimer();
      cancelFrame();
      wheelActive = false;
      zooming = false;

      if (moved) {
        moved = false;
        map._moveEnd(true);
      }
    };

    const getAnchoredCenter = (zoom: number) => {
      const offsetFromCenter = anchorPoint.subtract(centerPoint());

      if (offsetFromCenter.x === 0 && offsetFromCenter.y === 0) {
        return map.getCenter();
      }

      return map.unproject(
        map.project(anchorLatLng, zoom).subtract(offsetFromCenter),
        zoom
      );
    };

    const scheduleNextFrame = () => {
      frameId = requestAnimationFrame(updateZoom);
    };

    const updateZoom = () => {
      frameId = 0;

      const currentZoom = map.getZoom();
      const targetZoom = map._limitZoom(goalZoom);
      const diff = targetZoom - currentZoom;
      const shouldSettle =
        !wheelActive && Math.abs(diff) <= options.minZoomDelta;
      const nextZoom = shouldSettle
        ? targetZoom
        : currentZoom + diff * options.easing;

      if (!moved) {
        moved = true;
        map._moveStart(true, false);
      }

      map._move(getAnchoredCenter(nextZoom), nextZoom, { wheel: true, round: false });

      if (shouldSettle) {
        finishZoom();
        return;
      }

      scheduleNextFrame();
    };

    const startZoom = () => {
      if (zooming) return;

      zooming = true;
      moved = false;
      goalZoom = map.getZoom();
      map._stop();
      map._panAnim?.stop();
      scheduleNextFrame();
    };

    const handleWheel = (event: WheelEvent) => {
      const delta = L.DomEvent.getWheelDelta(event);
      if (!delta) return;

      event.preventDefault();
      event.stopPropagation();

      startZoom();

      wheelActive = true;
      anchorPoint = map.mouseEventToContainerPoint(event);
      anchorLatLng = map.containerPointToLatLng(anchorPoint);
      goalZoom = map._limitZoom(goalZoom + delta * options.sensitivity);

      clearQuietTimer();
      quietTimer = setTimeout(() => {
        wheelActive = false;
      }, options.settleDelayMs);
    };

    const handleExternalInteraction = () => {
      if (zooming) finishZoom();
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    map.on("dragstart", handleExternalInteraction);

    return () => {
      container.removeEventListener("wheel", handleWheel);
      map.off("dragstart", handleExternalInteraction);
      if (zooming) finishZoom();
    };
  }, [map, options]);

  return null;
}

type SmoothZoomControlProps = {
  options?: SmoothControlZoomOptions;
  position?: L.ControlPosition;
};

export function SmoothZoomControl({
  options = MAP_SMOOTH_CONTROL_ZOOM_OPTIONS,
  position = "bottomleft",
}: SmoothZoomControlProps) {
  const map = useMap() as SmoothWheelLeafletMap;

  useEffect(() => {
    if (!options.enabled) return;

    const control = new L.Control({ position });

    let goalZoom = map.getZoom();
    let frameId = 0;
    let moved = false;
    let zooming = false;
    let controlContainer: HTMLElement | null = null;

    const cancelFrame = () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
        frameId = 0;
      }
    };

    const finishZoom = () => {
      cancelFrame();
      zooming = false;

      if (moved) {
        moved = false;
        map._moveEnd(true);
      }
    };

    const updateButtons = (container: HTMLElement) => {
      const zoom = map.getZoom();
      const zoomIn = container.querySelector<HTMLAnchorElement>(".leaflet-control-zoom-in");
      const zoomOut = container.querySelector<HTMLAnchorElement>(".leaflet-control-zoom-out");
      zoomIn?.classList.toggle("leaflet-disabled", zoom >= map.getMaxZoom());
      zoomOut?.classList.toggle("leaflet-disabled", zoom <= map.getMinZoom());
    };

    const handleMapZoom = () => {
      if (controlContainer) updateButtons(controlContainer);
    };

    const scheduleNextFrame = () => {
      frameId = requestAnimationFrame(updateZoom);
    };

    const updateZoom = () => {
      frameId = 0;

      const currentZoom = map.getZoom();
      const targetZoom = map._limitZoom(goalZoom);
      const diff = targetZoom - currentZoom;
      const shouldSettle = Math.abs(diff) <= MAP_SMOOTH_WHEEL_ZOOM_OPTIONS.minZoomDelta;
      const nextZoom = shouldSettle
        ? targetZoom
        : currentZoom + diff * MAP_SMOOTH_WHEEL_ZOOM_OPTIONS.easing;

      if (!moved) {
        moved = true;
        map._moveStart(true, false);
      }

      map._move(map.getCenter(), nextZoom, { control: true, round: false });

      if (shouldSettle) {
        finishZoom();
        return;
      }

      scheduleNextFrame();
    };

    const zoomBy = (delta: number) => {
      goalZoom = map._limitZoom((zooming ? goalZoom : map.getZoom()) + delta);
      if (goalZoom === map.getZoom()) return;

      if (!zooming) {
        zooming = true;
        moved = false;
        map._stop();
        map._panAnim?.stop();
        scheduleNextFrame();
      }
    };

    control.onAdd = () => {
      const container = L.DomUtil.create("div", "leaflet-control-zoom leaflet-bar leaflet-control");
      controlContainer = container;
      const zoomIn = L.DomUtil.create("a", "leaflet-control-zoom-in", container);
      const zoomOut = L.DomUtil.create("a", "leaflet-control-zoom-out", container);

      zoomIn.href = "#";
      zoomIn.title = "Zoom in";
      zoomIn.setAttribute("role", "button");
      zoomIn.setAttribute("aria-label", "Zoom in");
      zoomIn.textContent = "+";

      zoomOut.href = "#";
      zoomOut.title = "Zoom out";
      zoomOut.setAttribute("role", "button");
      zoomOut.setAttribute("aria-label", "Zoom out");
      zoomOut.textContent = "−";

      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.disableScrollPropagation(container);

      L.DomEvent.on(zoomIn, "click", (event) => {
        L.DomEvent.preventDefault(event);
        zoomBy(options.zoomDelta);
      });
      L.DomEvent.on(zoomOut, "click", (event) => {
        L.DomEvent.preventDefault(event);
        zoomBy(-options.zoomDelta);
      });

      map.on("zoom move zoomend", handleMapZoom);
      updateButtons(container);

      return container;
    };

    control.addTo(map);

    return () => {
      finishZoom();
      map.off("zoom move zoomend", handleMapZoom);
      controlContainer = null;
      control.remove();
    };
  }, [map, options, position]);

  return null;
}
