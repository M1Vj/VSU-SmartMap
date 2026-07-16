"use client";

import L, {
  type CircleMarkerOptions,
  type LeafletEventHandlerFnMap,
  type LatLngExpression,
  type LatLngExpression as Position,
  type LatLngTuple,
  type MapOptions,
  type MarkerOptions,
  type PathOptions,
  type PolylineOptions,
  type PopupOptions,
  type TileLayerOptions,
  type TooltipOptions,
} from "leaflet";
import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

const MapContext = createContext<L.Map | null>(null);
const LayerContext = createContext<L.Layer | null>(null);

type MapContainerProps = MapOptions & {
  center: LatLngExpression;
  zoom: number;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
};

export function MapContainer({
  center,
  zoom,
  children,
  className,
  style,
  ...options
}: MapContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const initial = useRef({ center, zoom, options });
  const [map, setMap] = useState<L.Map | null>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const mapInstance = L.map(container, initial.current.options);
    mapInstance.setView(initial.current.center, initial.current.zoom);
    setMap(mapInstance);

    return () => {
      mapInstance.remove();
    };
  }, []);

  return (
    <div ref={containerRef} className={className} style={style}>
      {map ? <MapContext.Provider value={map}>{children}</MapContext.Provider> : null}
    </div>
  );
}

export function useMap(): L.Map {
  const map = useContext(MapContext);
  if (!map) throw new Error("Leaflet map components must be rendered inside MapContainer.");
  return map;
}

function useEventHandlers(
  target: L.Evented | null,
  eventHandlers?: LeafletEventHandlerFnMap,
) {
  useEffect(() => {
    if (!target || !eventHandlers) return;
    target.on(eventHandlers);
    return () => {
      target.off(eventHandlers);
    };
  }, [eventHandlers, target]);
}

export function useMapEvents(eventHandlers: LeafletEventHandlerFnMap): L.Map {
  const map = useMap();
  useEventHandlers(map, eventHandlers);
  return map;
}

type TileLayerProps = TileLayerOptions & { url: string };

export function TileLayer({ url, ...options }: TileLayerProps) {
  const map = useMap();
  const initialUrl = useRef(url);
  const initialOptions = useRef(options);
  const [layer, setLayer] = useState<L.TileLayer | null>(null);

  useEffect(() => {
    const instance = L.tileLayer(initialUrl.current, initialOptions.current).addTo(map);
    setLayer(instance);
    return () => {
      instance.removeFrom(map);
    };
  }, [map]);

  useEffect(() => {
    layer?.setUrl(url, false);
  }, [layer, url]);

  useEffect(() => {
    if (!layer) return;
    if (typeof options.opacity === "number") layer.setOpacity(options.opacity);
    if (typeof options.zIndex === "number") layer.setZIndex(options.zIndex);
  }, [layer, options.opacity, options.zIndex]);

  return null;
}

type CircleMarkerProps = CircleMarkerOptions & {
  center: LatLngExpression;
  pathOptions?: PathOptions;
  eventHandlers?: LeafletEventHandlerFnMap;
};

export function CircleMarker({
  center,
  radius,
  pathOptions,
  eventHandlers,
  ...options
}: CircleMarkerProps) {
  const map = useMap();
  const initialCenter = useRef(center);
  const initialOptions = useRef({ ...options, ...pathOptions, radius });
  const [layer, setLayer] = useState<L.CircleMarker | null>(null);

  useEffect(() => {
    const instance = L.circleMarker(initialCenter.current, initialOptions.current).addTo(map);
    setLayer(instance);
    return () => {
      instance.removeFrom(map);
    };
  }, [map]);

  useEffect(() => {
    layer?.setLatLng(center);
  }, [center, layer]);
  useEffect(() => {
    if (layer && typeof radius === "number") layer.setRadius(radius);
  }, [layer, radius]);
  useEffect(() => {
    if (layer && pathOptions) layer.setStyle(pathOptions);
  }, [layer, pathOptions]);
  useEventHandlers(layer, eventHandlers);

  return null;
}

type PolylineProps = PolylineOptions & {
  positions: LatLngExpression[] | LatLngExpression[][];
  pathOptions?: PathOptions;
  eventHandlers?: LeafletEventHandlerFnMap;
};

export function Polyline({
  positions,
  pathOptions,
  eventHandlers,
  ...options
}: PolylineProps) {
  const map = useMap();
  const initialPositions = useRef(positions);
  const initialOptions = useRef({ ...options, ...pathOptions });
  const [layer, setLayer] = useState<L.Polyline | null>(null);

  useEffect(() => {
    const instance = L.polyline(initialPositions.current, initialOptions.current).addTo(map);
    setLayer(instance);
    return () => {
      instance.removeFrom(map);
    };
  }, [map]);

  useEffect(() => {
    layer?.setLatLngs(positions);
  }, [layer, positions]);
  useEffect(() => {
    if (layer && pathOptions) layer.setStyle(pathOptions);
  }, [layer, pathOptions]);
  useEventHandlers(layer, eventHandlers);

  return null;
}

type MarkerProps = MarkerOptions & {
  position: Position;
  children?: ReactNode;
  eventHandlers?: LeafletEventHandlerFnMap;
};

export const Marker = forwardRef<L.Marker, MarkerProps>(function Marker(
  { position, children, eventHandlers, icon, draggable, opacity, zIndexOffset, ...options },
  forwardedRef,
) {
  const map = useMap();
  const initialPosition = useRef(position);
  const initialOptions = useRef({
    ...options,
    icon,
    draggable,
    opacity,
    zIndexOffset,
  });
  const [marker, setMarker] = useState<L.Marker | null>(null);

  useLayoutEffect(() => {
    const instance = L.marker(initialPosition.current, initialOptions.current).addTo(map);
    setMarker(instance);
    return () => {
      instance.removeFrom(map);
    };
  }, [map]);

  useImperativeHandle(forwardedRef, () => marker as L.Marker, [marker]);
  useEffect(() => {
    marker?.setLatLng(position);
  }, [marker, position]);
  useEffect(() => {
    if (marker && icon) marker.setIcon(icon);
  }, [icon, marker]);
  useEffect(() => {
    if (marker && typeof opacity === "number") marker.setOpacity(opacity);
  }, [marker, opacity]);
  useEffect(() => {
    if (marker && typeof zIndexOffset === "number") marker.setZIndexOffset(zIndexOffset);
  }, [marker, zIndexOffset]);
  useEffect(() => {
    if (!marker || draggable === undefined) return;
    if (draggable) marker.dragging?.enable();
    else marker.dragging?.disable();
  }, [draggable, marker]);
  useEventHandlers(marker, eventHandlers);

  return marker ? <LayerContext.Provider value={marker}>{children}</LayerContext.Provider> : null;
});

function useBoundOverlay<T extends L.Tooltip | L.Popup>(
  kind: "tooltip" | "popup",
  create: (root: HTMLDivElement) => T,
) {
  const layer = useContext(LayerContext);
  const [root] = useState<HTMLDivElement | null>(() =>
    typeof document === "undefined" ? null : document.createElement("div"),
  );
  const createRef = useRef(create);
  const [overlay, setOverlay] = useState<T | null>(null);

  useEffect(() => {
    if (!layer || !root) return;
    const instance = createRef.current(root);
    if (kind === "tooltip") layer.bindTooltip(instance as L.Tooltip);
    else layer.bindPopup(instance as L.Popup);
    setOverlay(instance);

    return () => {
      if (kind === "tooltip" && layer.getTooltip() === instance) layer.unbindTooltip();
      if (kind === "popup" && layer.getPopup() === instance) layer.unbindPopup();
    };
  }, [kind, layer, root]);

  return { overlay, root };
}

type TooltipProps = TooltipOptions & { children?: ReactNode };

export function Tooltip({ children, opacity, className, ...options }: TooltipProps) {
  const { overlay, root } = useBoundOverlay("tooltip", (contentRoot) =>
    L.tooltip({ ...options, opacity, className }).setContent(contentRoot),
  );
  const previousClass = useRef<string | undefined>(className);

  useEffect(() => {
    if (overlay && typeof opacity === "number") overlay.setOpacity(opacity);
  }, [opacity, overlay]);
  useEffect(() => {
    const element = overlay?.getElement();
    if (!element) return;
    if (previousClass.current) element.classList.remove(previousClass.current);
    if (className) element.classList.add(className);
    previousClass.current = className;
  }, [className, overlay]);

  return root ? createPortal(children, root) : null;
}

type PopupProps = PopupOptions & { children?: ReactNode };

export function Popup({ children, ...options }: PopupProps) {
  const { root } = useBoundOverlay("popup", (contentRoot) =>
    L.popup(options).setContent(contentRoot),
  );
  return root ? createPortal(children, root) : null;
}

export type { LatLngTuple };
