import { db } from "@/lib/db";
import type { MapNode, MapEdge } from "@/lib/types/graph";

export async function getCachedNavigationGraph() {
  if (typeof window === "undefined") return null;

  try {
    const nodes = await db.map_nodes.toArray();
    const edges = await db.map_edges.toArray();
    if (nodes.length === 0) return null;
    return { nodes, edges };
  } catch (error) {
    console.warn("Failed to get navigation graph from IDB:", error);
    return null;
  }
}

export async function setCachedNavigationGraph(nodes: MapNode[], edges: MapEdge[]) {
  if (typeof window === "undefined") return;

  try {
    await db.transaction("rw", db.map_nodes, db.map_edges, async () => {
      await db.map_nodes.clear();
      await db.map_nodes.bulkAdd(nodes);
      await db.map_edges.clear();
      await db.map_edges.bulkAdd(edges);
    });
  } catch (error) {
    console.warn("Failed to cache navigation graph to IDB:", error);
  }
}
