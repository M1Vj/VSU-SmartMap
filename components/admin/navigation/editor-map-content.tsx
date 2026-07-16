"use client";

import "leaflet/dist/leaflet.css";

import { Fragment, useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { MapContainer, TileLayer, Polyline, useMap, useMapEvents, Marker } from "@/components/map/leaflet-react";
import { toast } from "sonner";
import L from "leaflet";
import { MAP_MAX_ZOOM, MAP_MIN_ZOOM, MAP_TILES, MAP_DEFAULT_CENTER } from "@/lib/constants/map";
import { useMapStyle } from "@/lib/context/map-style-context";
import { isEdgeClosed } from "@/lib/pathfinding/astar";
import { VSU_CAMPUS_LEAFLET_BOUNDS } from "@/lib/map/vsu-campus-boundary";
import { MAP_LEAFLET_ZOOM_OPTIONS, MAP_ZOOM_ANIMATION_OPTIONS } from "@/lib/map/wheel-zoom";
import { SmoothWheelZoom, SmoothZoomControl } from "@/components/map/smooth-wheel-zoom";
import { isPointInsideRoutingBoundary } from "@/lib/pathfinding/transition-gates";
import type { MapNode, MapEdge } from "@/lib/types/graph";

interface EditorMapContentProps {
  nodes: MapNode[];
  edges: MapEdge[];
  mode: 'select' | 'add_node' | 'add_edge' | 'mixed';
  selectedNodeIds: Set<string>;
  selectedEdgeIds: Set<string>;
  edgeStartNodeId: string | null;
  onNodeAdd: (lat: number, lng: number) => void;
  onNodeSelect: (id: string, multi: boolean) => void;
  onEdgeSelect: (id: string, multi: boolean) => void;
  onNodeMove: (id: string, lat: number, lng: number) => void;
  boxTarget: 'nodes' | 'edges';
  onBoxSelect: (ids: string[], additive: boolean, target: 'nodes' | 'edges') => void;
}

function MapEvents({ mode, onNodeAdd }: { mode: string; onNodeAdd: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      if (mode === 'add_node' || mode === 'mixed') {
        if (!isPointInsideRoutingBoundary({ lat: e.latlng.lat, lng: e.latlng.lng })) {
          toast.error("Navigation nodes must stay inside the internal routing boundary.");
          return;
        }
        onNodeAdd(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

// Image-editor-style interactions for the select tool: click-drag on empty map
// draws a marquee that selects the nodes inside it (Shift/Ctrl/Cmd adds to the
// selection); holding Space turns the drag into a map pan. Map dragging is
// otherwise disabled in select mode so a plain drag marquees instead of panning.
function SelectionInteractions({
  active,
  nodes,
  edges,
  boxTarget,
  onBoxSelect,
}: {
  active: boolean;
  nodes: MapNode[];
  edges: MapEdge[];
  boxTarget: 'nodes' | 'edges';
  onBoxSelect: (ids: string[], additive: boolean, target: 'nodes' | 'edges') => void;
}) {
  const map = useMap();
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const targetRef = useRef(boxTarget);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);
  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);
  useEffect(() => {
    targetRef.current = boxTarget;
  }, [boxTarget]);
  const spaceRef = useRef(false);
  const boxRef = useRef<{ start: L.Point; el: HTMLDivElement; additive: boolean } | null>(null);

  useEffect(() => {
    const container = map.getContainer();
    const setCursor = (c: string) => {
      container.style.cursor = c;
    };

    const applyIdle = () => {
      if (active && !spaceRef.current) {
        map.dragging.disable();
        setCursor("crosshair");
      } else {
        map.dragging.enable();
        setCursor("");
      }
    };
    applyIdle();

    const clearBox = () => {
      if (boxRef.current) {
        boxRef.current.el.remove();
        boxRef.current = null;
      }
    };

    // Don't hijack Space when the user is typing or focused on a control.
    const ignoreKeyTarget = (el: EventTarget | null) =>
      !!(el as HTMLElement | null)?.closest?.(
        'input,textarea,select,button,a,[contenteditable="true"],[role="button"]',
      );

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" || !active || ignoreKeyTarget(e.target)) return;
      e.preventDefault();
      if (!spaceRef.current) {
        spaceRef.current = true;
        clearBox();
        map.dragging.enable();
        setCursor("grab");
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      spaceRef.current = false;
      applyIdle();
    };

    const onMouseDown = (e: L.LeafletMouseEvent) => {
      if (!active || spaceRef.current) return;
      const oe = e.originalEvent;
      if (oe.button !== 0) return;
      // Drags that begin on a node/edge marker move/select that marker instead.
      if ((oe.target as HTMLElement)?.closest?.(".leaflet-marker-icon")) return;
      const el = document.createElement("div");
      el.style.cssText =
        "position:absolute;border:1px solid #3b82f6;background:rgba(59,130,246,0.15);pointer-events:none;z-index:800;";
      container.appendChild(el);
      boxRef.current = {
        start: e.containerPoint,
        el,
        additive: oe.shiftKey || oe.metaKey || oe.ctrlKey,
      };
    };
    const onMouseMove = (e: L.LeafletMouseEvent) => {
      const box = boxRef.current;
      if (!box) return;
      const p = e.containerPoint;
      box.el.style.left = `${Math.min(p.x, box.start.x)}px`;
      box.el.style.top = `${Math.min(p.y, box.start.y)}px`;
      box.el.style.width = `${Math.abs(p.x - box.start.x)}px`;
      box.el.style.height = `${Math.abs(p.y - box.start.y)}px`;
    };
    const onMouseUp = (e: L.LeafletMouseEvent) => {
      const box = boxRef.current;
      if (!box) return;
      const end = e.containerPoint;
      const additive = box.additive;
      clearBox();
      if (box.start.distanceTo(end) < 4) return; // a click, not a marquee
      const bounds = L.latLngBounds(
        map.containerPointToLatLng(box.start),
        map.containerPointToLatLng(end),
      );
      if (targetRef.current === "edges") {
        const byId = new Map(nodesRef.current.map((n) => [n.id, n] as const));
        const ids = edgesRef.current
          .filter((edge) => {
            const s = byId.get(edge.source_id);
            const t = byId.get(edge.target_id);
            // An edge is boxed when both its endpoints are inside the marquee.
            return (
              s && t && bounds.contains([s.lat, s.lng]) && bounds.contains([t.lat, t.lng])
            );
          })
          .map((edge) => edge.id);
        onBoxSelect(ids, additive, "edges");
      } else {
        const ids = nodesRef.current
          .filter((n) => bounds.contains([n.lat, n.lng]))
          .map((n) => n.id);
        onBoxSelect(ids, additive, "nodes");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    map.on("mousedown", onMouseDown);
    map.on("mousemove", onMouseMove);
    map.on("mouseup", onMouseUp);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      map.off("mousedown", onMouseDown);
      map.off("mousemove", onMouseMove);
      map.off("mouseup", onMouseUp);
      clearBox();
      spaceRef.current = false;
      map.dragging.enable();
      setCursor("");
    };
  }, [map, active, onBoxSelect]);

  return null;
}

export default function EditorMapContent({
  nodes,
  edges,
  mode,
  selectedNodeIds,
  selectedEdgeIds,
  edgeStartNodeId,
  onNodeAdd,
  onNodeSelect,
  onEdgeSelect,
  onNodeMove,
  boxTarget,
  onBoxSelect,
}: EditorMapContentProps) {
  const { resolvedTheme } = useTheme();
  const { mapStyle } = useMapStyle();

  // Leaflet needs raster XYZ tiles; MAP_TILES.url/darkUrl are MapLibre vector
  // style docs that render blank here, so use the raster fallbacks.
  const tiles =
    mapStyle === "satellite"
      ? {
          url: MAP_TILES.satelliteUrl,
          attribution: MAP_TILES.satelliteAttribution,
          maxNativeZoom: MAP_TILES.maxNativeZoom ?? MAP_MAX_ZOOM,
        }
      : resolvedTheme === "dark"
        ? { url: MAP_TILES.rasterDarkUrl, attribution: MAP_TILES.rasterDarkAttribution, maxNativeZoom: 20 }
        : { url: MAP_TILES.rasterStreetUrl, attribution: MAP_TILES.rasterStreetAttribution, maxNativeZoom: 19 };

  const getEdgeColor = (edge: MapEdge) => {
    if (edge.closed_until_toggled) return '#ef4444';
    if (isEdgeClosed(edge)) return '#ef4444';
    
    const access = edge.access || [];
    const hasWalk = access.includes('walking');
    const hasDrive = access.includes('driving');

    if (hasWalk && hasDrive) return '#f97316';
    if (hasDrive) return '#3b82f6';
    return '#22c55e';
  };

  const getEdgeDashArray = (edge: MapEdge) => {
    if (edge.closed_until_toggled || isEdgeClosed(edge)) return '5, 10';
    if (!edge.bidirectional) return '10, 5';
    return undefined;
  };

  const groupedEdges = new Map<string, MapEdge[]>();
  edges.forEach(edge => {
    const key = [edge.source_id, edge.target_id].sort().join('-');
    if (!groupedEdges.has(key)) {
      groupedEdges.set(key, []);
    }
    groupedEdges.get(key)!.push(edge);
  });

  const getNodeColor = (node: MapNode, isSelected: boolean, isChainStart: boolean) => {
    if (isSelected) return 'yellow';
    if (isChainStart) return 'cyan';
    
    switch (node.type) {
      case 'path_start': return '#22c55e';
      case 'path_middle': return '#eab308';
      case 'path_end': return '#ef4444';
      case 'building_entry': return '#a855f7';
      case 'gate': return '#ec4899';
      default: return '#3b82f6';
    }
  };

  return (
    <MapContainer
      center={[MAP_DEFAULT_CENTER.lat, MAP_DEFAULT_CENTER.lng]}
      zoom={17}
      minZoom={MAP_MIN_ZOOM}
      maxZoom={MAP_MAX_ZOOM}
      className="h-full w-full"
      zoomControl={false}
      {...MAP_LEAFLET_ZOOM_OPTIONS}
      {...MAP_ZOOM_ANIMATION_OPTIONS}
      bounceAtZoomLimits={false}
      maxBounds={VSU_CAMPUS_LEAFLET_BOUNDS}
      maxBoundsViscosity={1}
    >
      <TileLayer
        key={tiles.url}
        attribution={tiles.attribution}
        url={tiles.url}
        maxZoom={MAP_MAX_ZOOM}
        maxNativeZoom={tiles.maxNativeZoom}
      />
      <SmoothZoomControl position="bottomleft" />
      <SmoothWheelZoom />

      <MapEvents mode={mode} onNodeAdd={onNodeAdd} />
      <SelectionInteractions
        active={mode === "select"}
        nodes={nodes}
        edges={edges}
        boxTarget={boxTarget}
        onBoxSelect={onBoxSelect}
      />

      {Array.from(groupedEdges.values()).flatMap((group) => {
        return group.map((edge, index) => {
          const source = nodes.find((n) => n.id === edge.source_id);
          const target = nodes.find((n) => n.id === edge.target_id);
          if (!source || !target) return null;

          const isSelected = selectedEdgeIds.has(edge.id);
          
          let lat1 = source.lat;
          let lng1 = source.lng;
          let lat2 = target.lat;
          let lng2 = target.lng;

          if (group.length > 1) {
            const offsetStep = 0.00003; 
            const offsetIndex = index - (group.length - 1) / 2;
            
            const dx = lng2 - lng1;
            const dy = lat2 - lat1;
            const len = Math.sqrt(dx * dx + dy * dy);
            
            if (len > 0) {
                const px = -dy / len * offsetStep * offsetIndex;
                const py = dx / len * offsetStep * offsetIndex;
                
                lat1 += py;
                lng1 += px;
                lat2 += py;
                lng2 += px;
            }
          }

          const showArrow = !edge.bidirectional;
          const arrowIcon = showArrow ? (() => {
              const angle = Math.atan2(lat2 - lat1, lng2 - lng1) * 180 / Math.PI;
              const color = getEdgeColor(edge);
              // CSS rotation is clockwise. 0deg is East (right).
              // atan2 gives counter-clockwise from East.
              // So we need -angle.
              return L.divIcon({
                  className: 'bg-transparent border-none',
                  html: `<div style="transform: rotate(${-angle}deg); width: 0; height: 0; border-top: 6px solid transparent; border-bottom: 6px solid transparent; border-left: 12px solid ${isSelected ? 'yellow' : color};"></div>`,
                  iconSize: [12, 12],
                  iconAnchor: [6, 6], // Center of the 12x12 box? No, center of rotation. 
                  // If arrow is border-left, the tip is at right. The 'center' of the triangle visually is roughly 1/3 from left.
                  // But let's just center the div.
              });
          })() : null;

          const midLat = (lat1 + lat2) / 2;
          const midLng = (lng1 + lng2) / 2;

          return (
            <Fragment key={edge.id}>
              <Polyline
                key={edge.id}
                positions={[
                  [lat1, lng1],
                  [lat2, lng2],
                ]}
                pathOptions={{ 
                  color: isSelected ? 'yellow' : getEdgeColor(edge), 
                  weight: isSelected ? 6 : 4, 
                  opacity: isEdgeClosed(edge) ? 0.5 : 0.8,
                  dashArray: isSelected ? undefined : getEdgeDashArray(edge),
                }}
                eventHandlers={{
                  click: (e) => {
                    L.DomEvent.stopPropagation(e);
                    const isMulti = e.originalEvent.metaKey || e.originalEvent.ctrlKey || e.originalEvent.shiftKey;
                    onEdgeSelect(edge.id, isMulti);
                  }
                }}
              />
              {showArrow && (
                <Marker 
                  position={[midLat, midLng]}
                  icon={arrowIcon!}
                  eventHandlers={{
                    click: (e) => {
                      L.DomEvent.stopPropagation(e);
                      const isMulti = e.originalEvent.metaKey || e.originalEvent.ctrlKey || e.originalEvent.shiftKey;
                      onEdgeSelect(edge.id, isMulti);
                    }
                  }}
                />
              )}
            </Fragment>
          );
        });
      })}

      {nodes.map((node) => {
        const isSelected = selectedNodeIds.has(node.id);
        const isStartNode = node.id === edgeStartNodeId;
        const isGate = node.type === 'gate';
        const color = getNodeColor(node, isSelected, isStartNode);
        const radius = isSelected || isStartNode ? 8 : isGate ? 7 : 5;
        // Gate nodes (external<->internal handoff) get a thicker ring so the
        // connection points stand out from ordinary nodes.
        const border = isGate ? '3px solid #fff' : '2px solid white';
        const ring = isGate ? 'box-shadow: 0 0 0 2px #ec4899, 0 0 4px rgba(0,0,0,0.4);' : 'box-shadow: 0 0 4px rgba(0,0,0,0.3);';

        const icon = L.divIcon({
          className: 'custom-node-icon',
          html: `<div style="background-color: ${color}; width: ${radius*2}px; height: ${radius*2}px; border-radius: 50%; border: ${border}; ${ring}"></div>`,
          iconSize: [radius*2, radius*2],
          iconAnchor: [radius, radius],
        });
        
        return (
          <Marker
            key={node.id}
            position={[node.lat, node.lng]}
            icon={icon}
            draggable={mode === 'select'}
            eventHandlers={{
              click: (e) => {
                L.DomEvent.stopPropagation(e);
                const isMulti = e.originalEvent.metaKey || e.originalEvent.ctrlKey || e.originalEvent.shiftKey;
                onNodeSelect(node.id, isMulti);
              },
              dragend: (e) => {
                const marker = e.target;
                const position = marker.getLatLng();
                if (!isPointInsideRoutingBoundary({ lat: position.lat, lng: position.lng })) {
                  toast.error("Navigation nodes must stay inside the internal routing boundary.");
                  marker.setLatLng([node.lat, node.lng]);
                  return;
                }
                onNodeMove(node.id, position.lat, position.lng);
              }
            }}
          />
        );
      })}
    </MapContainer>
  );
}
