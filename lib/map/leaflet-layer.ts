import type { LeafletEventHandlerFnMap, Map as LeafletMap } from "leaflet";

type EventedLayer = {
  on(eventHandlers: LeafletEventHandlerFnMap): void;
  addTo(map: LeafletMap): void;
};

export function addLayerToMap<T extends EventedLayer>(
  layer: T,
  map: LeafletMap,
  eventHandlers?: LeafletEventHandlerFnMap,
): T {
  if (eventHandlers) layer.on(eventHandlers);
  layer.addTo(map);
  return layer;
}
