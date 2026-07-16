"use client";

import dynamic from "next/dynamic";
import type { MapNode, MapEdge } from "@/lib/types/graph";
import { Skeleton } from "@/components/ui/skeleton";

const EditorMapContent = dynamic(
  () => import("./editor-map-content"),
  { 
    ssr: false,
    loading: () => <Skeleton className="h-full w-full rounded-lg" />
  }
);

interface EditorMapProps {
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

export function EditorMap(props: EditorMapProps) {
  return <EditorMapContent {...props} />;
}