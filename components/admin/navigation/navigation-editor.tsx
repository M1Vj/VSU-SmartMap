"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { EditorMap } from "./editor-map";
import type { MapNode, MapEdge, TransportMode, GraphNodeType } from "@/lib/types/graph";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MousePointer2, Plus, Save, Trash2, Route, Undo2, Redo2, ArrowLeftRight, ArrowRight, AlertTriangle, Clock, Wand2, RefreshCw, Footprints, Car, ChevronRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/db";
import {
  saveMapGraph,
  getMapGraphSnapshot,
  isStaleGraphRevisionError,
} from "@/lib/supabase/queries/navigation";
import { getFacilitiesLite } from "@/lib/supabase/queries/facilities";
import { FacilitySelectorUnified } from "@/components/facility/facility-selector-unified";
import { getDistance } from "@/lib/pathfinding/astar";
import { canAddEditorEdge } from "@/lib/pathfinding/editor-edges";
import { validateEditorGraph } from "@/lib/pathfinding/editor-graph";
import {
  decideNavigationConflict,
  isNavigationDraftDirty,
  resolveNavigationConflictSnapshot,
  type NavigationConflictSnapshotState,
} from "@/lib/pathfinding/navigation-conflict";
import type { FacilityLite } from "@/lib/types/facility";
import { toast } from "sonner";

interface HistoryState {
  nodes: MapNode[];
  edges: MapEdge[];
}

interface HistoryStackState {
  stack: HistoryState[];
  index: number;
}

type NavigationConflictState = NavigationConflictSnapshotState | { status: "loading" };

const cloneHistoryNodes = (items: MapNode[]) =>
  items.map((n) => ({
    ...n,
    building_ids: n.building_ids ? [...n.building_ids] : undefined,
    closure_recurring_days: n.closure_recurring_days ? [...n.closure_recurring_days] : undefined,
    closure_daily_schedule: n.closure_daily_schedule
      ? Object.fromEntries(
          Object.entries(n.closure_daily_schedule).map(([k, v]) => [
            k,
            { start: v.start, end: v.end },
          ])
        )
      : undefined,
  }));

const cloneHistoryEdges = (items: MapEdge[]) =>
  items.map((e) => ({
    ...e,
    access: e.access ? [...e.access] : undefined,
    closure_recurring_days: e.closure_recurring_days ? [...e.closure_recurring_days] : undefined,
    closure_daily_schedule: e.closure_daily_schedule
      ? Object.fromEntries(
          Object.entries(e.closure_daily_schedule).map(([k, v]) => [
            k,
            { start: v.start, end: v.end },
          ])
        )
      : undefined,
  }));

export function NavigationEditor() {
  const [nodes, setNodes] = useState<MapNode[]>([]);
  const [edges, setEdges] = useState<MapEdge[]>([]);
  const [facilities, setFacilities] = useState<FacilityLite[]>([]);
  const [historyState, setHistoryState] = useState<HistoryStackState>({ stack: [], index: -1 });
  const history = historyState.stack;
  const historyIndex = historyState.index;
  
  const [isAddNodeMode, setIsAddNodeMode] = useState(false);
  const [isAddEdgeMode, setIsAddEdgeMode] = useState(false);
  
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<Set<string>>(new Set());
  const [boxTarget, setBoxTarget] = useState<'nodes' | 'edges'>('nodes');
  const [edgeStartNodeId, setEdgeStartNodeId] = useState<string | null>(null);
  const [newEdgeBidirectional, setNewEdgeBidirectional] = useState(true);
  const [newEdgeType, setNewEdgeType] = useState<'walkway' | 'road' | 'car_road'>('walkway');
  const [facilitySearchQuery, setFacilitySearchQuery] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [graphRevision, setGraphRevision] = useState<number | null>(null);
  const [graphConflict, setGraphConflict] = useState<NavigationConflictState | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const historyIndexRef = useRef(historyIndex);
  const lastSavedIndexRef = useRef(0);
  const historyRef = useRef(historyState);
  const graphRevisionRef = useRef<number | null>(null);
  const operationRef = useRef<"idle" | "refreshing" | "saving">("idle");
  const manualOverwriteRef = useRef(false);

  useEffect(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;
    historyIndexRef.current = historyIndex;
  }, [nodes, edges, historyIndex]);

  useEffect(() => {
    historyRef.current = historyState;
  }, [historyState]);

  const validateAndReport = useCallback((nextNodes: MapNode[], nextEdges: MapEdge[]) => {
    if (operationRef.current !== "idle") {
      toast.info("Graph sync is in progress. Try the edit again when it finishes.");
      return false;
    }
    const result = validateEditorGraph(nextNodes, nextEdges);
    if (!result.ok) {
      toast.error(`Graph update rejected: ${result.message}`);
      return false;
    }
    return true;
  }, []);

  const pushHistory = useCallback((newNodes: MapNode[], newEdges: MapEdge[]) => {
    const newState = {
      nodes: cloneHistoryNodes(newNodes),
      edges: cloneHistoryEdges(newEdges),
    };

    // Keep history stack and index in one state object to avoid stale closures
    // (undo/redo would otherwise point at the wrong snapshot when updates are batched).
    setHistoryState((prev) => {
      const trimmed = prev.stack.slice(0, prev.index + 1);
      const nextStack = [...trimmed, newState];
      return { stack: nextStack, index: nextStack.length - 1 };
    });
  }, []);

  const handleUndo = useCallback(() => {
    if (operationRef.current !== "idle") return;
    const current = historyRef.current;
    if (current.index <= 0) return;

    const prevState = current.stack[current.index - 1];
    if (!prevState) return;

    setNodes(prevState.nodes);
    setEdges(prevState.edges);
    setSelectedNodeIds(new Set());
    setSelectedEdgeIds(new Set());
    setEdgeStartNodeId(null);
    setHistoryState((prev) => ({ ...prev, index: Math.max(0, prev.index - 1) }));
    toast.success("Undo");
  }, []);

  const handleRedo = useCallback(() => {
    if (operationRef.current !== "idle") return;
    const current = historyRef.current;
    if (current.index >= current.stack.length - 1) return;

    const nextState = current.stack[current.index + 1];
    if (!nextState) return;

    setNodes(nextState.nodes);
    setEdges(nextState.edges);
    setSelectedNodeIds(new Set());
    setSelectedEdgeIds(new Set());
    setEdgeStartNodeId(null);
    setHistoryState((prev) => ({ ...prev, index: Math.min(prev.stack.length - 1, prev.index + 1) }));
    toast.success("Redo");
  }, []);

  const updateNodes = useCallback((newNodes: MapNode[]) => {
      if (!validateAndReport(newNodes, edges)) return false;
      setNodes(newNodes);
      pushHistory(newNodes, edges);
      return true;
  }, [edges, pushHistory, validateAndReport]);

  const updateEdges = useCallback((newEdges: MapEdge[]) => {
      if (!validateAndReport(nodes, newEdges)) return false;
      setEdges(newEdges);
      pushHistory(nodes, newEdges);
      return true;
  }, [nodes, pushHistory, validateAndReport]);

  const updateGraph = useCallback((newNodes: MapNode[], newEdges: MapEdge[]) => {
      if (!validateAndReport(newNodes, newEdges)) return false;
      setNodes(newNodes);
      setEdges(newEdges);
      pushHistory(newNodes, newEdges);
      return true;
  }, [pushHistory, validateAndReport]);

  const commitLoadedGraph = useCallback((serverNodes: MapNode[], serverEdges: MapEdge[], revision: number) => {
    setNodes(serverNodes);
    setEdges(serverEdges);
    setGraphRevision(revision);
    graphRevisionRef.current = revision;
    setHistoryState({
      stack: [{ nodes: cloneHistoryNodes(serverNodes), edges: cloneHistoryEdges(serverEdges) }],
      index: 0,
    });
    lastSavedIndexRef.current = 0;
    manualOverwriteRef.current = false;
  }, []);

  const handleKeepDraftAfterConflict = useCallback(() => {
    if (graphConflict?.status !== "ready") return;
    const decision = decideNavigationConflict(
      graphConflict.snapshot,
      { nodes: nodesRef.current, edges: edgesRef.current },
      "keep-draft",
    );

    // The draft remains untouched. Advancing only the optimistic revision
    // makes the next explicit Save an intentional overwrite of the latest
    // server snapshot rather than an automatic retry.
    graphRevisionRef.current = decision.revision;
    setGraphRevision(decision.revision);
    manualOverwriteRef.current = true;
    setGraphConflict(null);
    toast.info("Draft kept. Review it, then click Save to overwrite the latest server graph.");
  }, [graphConflict]);

  const handleDiscardDraftAfterConflict = useCallback(async () => {
    if (graphConflict?.status !== "ready" || operationRef.current !== "idle") return;
    const decision = decideNavigationConflict(
      graphConflict.snapshot,
      { nodes: nodesRef.current, edges: edgesRef.current },
      "discard-draft",
    );

    operationRef.current = "refreshing";
    setIsRefreshing(true);
    try {
      // Cache first, then hydrate React state. If the cache write fails, the
      // local draft and conflict stay visible so a failed discard can never
      // silently leave the editor with a different offline graph.
      if (db) {
        await db.transaction('rw', db.map_nodes, db.map_edges, async () => {
          await db.map_nodes.clear();
          await db.map_nodes.bulkAdd(decision.nodes);
          await db.map_edges.clear();
          await db.map_edges.bulkAdd(decision.edges);
        });
      }

      commitLoadedGraph(decision.nodes, decision.edges, decision.revision);
      setGraphConflict(null);
      setSelectedNodeIds(new Set());
      setSelectedEdgeIds(new Set());
      setEdgeStartNodeId(null);
      toast.success("Draft discarded. The latest server graph is now loaded.");
    } catch (error) {
      toast.error("Unable to discard the draft because the local cache could not be updated. Your draft is still preserved.");
      console.error(error);
    } finally {
      operationRef.current = "idle";
      setIsRefreshing(false);
    }
  }, [commitLoadedGraph, graphConflict]);

  const handleRetryConflictSnapshot = useCallback(async () => {
    if (operationRef.current !== "idle") return;
    operationRef.current = "refreshing";
    setIsRefreshing(true);
    setGraphConflict({ status: "loading" });
    try {
      const snapshotRes = await getMapGraphSnapshot();
      setGraphConflict(resolveNavigationConflictSnapshot(snapshotRes));
    } catch (snapshotError) {
      setGraphConflict(resolveNavigationConflictSnapshot({ data: null, error: snapshotError }));
      console.error(snapshotError);
    } finally {
      operationRef.current = "idle";
      setIsRefreshing(false);
    }
  }, []);

  const handleRefresh = async () => {
    if (operationRef.current !== "idle" || isRefreshing || isSaving) return;
    if (graphConflict) {
      toast.info("Resolve the server graph conflict below before refreshing so your draft is not discarded.");
      return;
    }
    if (manualOverwriteRef.current) {
      toast.info("Click Save to confirm the draft overwrite before refreshing.");
      return;
    }

    if (isNavigationDraftDirty(historyIndexRef.current, lastSavedIndexRef.current)) {
      // A dirty refresh is a conflict review, not a discard action. Fetch the
      // latest coherent snapshot so the existing Keep/Discard choices can
      // resolve it, but leave the draft, history, and offline cache untouched.
      operationRef.current = "refreshing";
      setIsRefreshing(true);
      setGraphConflict({ status: "loading" });
      try {
        const snapshotRes = await getMapGraphSnapshot();
        setGraphConflict(resolveNavigationConflictSnapshot(snapshotRes));
      } catch (snapshotError) {
        setGraphConflict(resolveNavigationConflictSnapshot({ data: null, error: snapshotError }));
        console.error(snapshotError);
      } finally {
        operationRef.current = "idle";
        setIsRefreshing(false);
      }
      return;
    }

    operationRef.current = "refreshing";
    setIsRefreshing(true);
    try {
      const snapshotRes = await getMapGraphSnapshot();
      if (snapshotRes.error || !snapshotRes.data) {
        throw new Error("Graph snapshot unavailable");
      }
      const { nodes: serverNodes, edges: serverEdges, revision } = snapshotRes.data;

      commitLoadedGraph(serverNodes, serverEdges, revision);

      // The cache is replaced only after all server reads succeed.
      if (db) {
        await db.transaction('rw', db.map_nodes, db.map_edges, async () => {
          await db.map_nodes.clear();
          await db.map_nodes.bulkAdd(serverNodes);
          await db.map_edges.clear();
          await db.map_edges.bulkAdd(serverEdges);
        });
      }

      toast.success(`Synced ${serverNodes.length} nodes and ${serverEdges.length} edges from server`);
    } catch (e) {
      toast.error("Unable to refresh the navigation graph. The last committed graph was kept.");
      console.error(e);
    } finally {
      operationRef.current = "idle";
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      if (operationRef.current !== "idle") return;
      operationRef.current = "refreshing";
      setIsRefreshing(true);

      try {
        const snapshotRes = await getMapGraphSnapshot();
        if (snapshotRes.error || !snapshotRes.data) {
          throw new Error("Graph snapshot unavailable");
        }
        const { nodes: serverNodes, edges: serverEdges, revision } = snapshotRes.data;

        commitLoadedGraph(serverNodes, serverEdges, revision);

        if (db) {
          await db.transaction('rw', db.map_nodes, db.map_edges, async () => {
            await db.map_nodes.clear();
            await db.map_nodes.bulkAdd(serverNodes);
            await db.map_edges.clear();
            await db.map_edges.bulkAdd(serverEdges);
          });
        }
      } catch (e) {
        console.warn("Initial fetch failed:", e);
        graphRevisionRef.current = null;
        setGraphRevision(null);
        if (db) {
          const loadedNodes = await db.map_nodes.toArray();
          const loadedEdges = await db.map_edges.toArray();
          if (loadedNodes.length > 0) {
            setNodes(loadedNodes);
            setEdges(loadedEdges);
            setHistoryState({
              stack: [{ nodes: cloneHistoryNodes(loadedNodes), edges: cloneHistoryEdges(loadedEdges) }],
              index: 0,
            });
            lastSavedIndexRef.current = 0;
          }
        }
      } finally {
        operationRef.current = "idle";
        setIsRefreshing(false);
      }

      const { data: facilitiesData } = await getFacilitiesLite();
      if (facilitiesData) setFacilities(facilitiesData);
    };
    loadData();
  }, [commitLoadedGraph]);

  const handleNodeAdd = useCallback((lat: number, lng: number) => {
    const newNode: MapNode = {
      id: uuidv4(),
      lat,
      lng,
      type: 'node',
    };
    const newNodes = [...nodes, newNode];
    
    // If adding edges simultaneously, connect to the previous node
    if (isAddEdgeMode && edgeStartNodeId) {
        // Prevent self-loop if clicked too fast or logic error (though usually startNode is different)
        if (edgeStartNodeId !== newNode.id) {
             let access: TransportMode[] = ['walking'];
             let type: MapEdge['type'] = 'walkway';

             if (newEdgeType === 'road') {
                 type = 'road';
                 access = ['walking', 'driving'];
             } else if (newEdgeType === 'car_road') {
                 type = 'road';
                 access = ['driving'];
             }

             const newEdge: MapEdge = {
                id: uuidv4(),
                source_id: edgeStartNodeId,
                target_id: newNode.id,
                weight: 0,
                bidirectional: newEdgeBidirectional,
                type: type,
                access: access,
              };
              
              const newEdges = [...edges, newEdge];
              if (!updateGraph(newNodes, newEdges)) return;
              setEdgeStartNodeId(newNode.id); // Advance chain
              toast.success("Node & Edge added");
              return;
        }
    }
    
    if (!updateNodes(newNodes)) return;
    if (isAddEdgeMode) {
        setEdgeStartNodeId(newNode.id); // Start chain if not started
    }
    toast.success("Node added");
  }, [nodes, edges, updateNodes, updateGraph, isAddEdgeMode, edgeStartNodeId, newEdgeBidirectional, newEdgeType]);

  const handleNodeSelect = useCallback((id: string, multi: boolean) => {
    if (isAddEdgeMode) {
      if (!edgeStartNodeId) {
        setEdgeStartNodeId(id);
      } else {
        if (edgeStartNodeId === id) {
           return;
        }
        
        const canAddEdge = canAddEditorEdge(edges, {
          sourceId: edgeStartNodeId,
          targetId: id,
          bidirectional: newEdgeBidirectional,
        });

        if (!canAddEdge) {
            toast.info("Edge already exists between these nodes");
            setEdgeStartNodeId(id);
            return;
        }

         let access: TransportMode[] = ['walking'];
         let type: MapEdge['type'] = 'walkway';

          if (newEdgeType === 'road') {
              type = 'road';
              access = ['walking', 'driving'];
          } else if (newEdgeType === 'car_road') {
              type = 'road';
              access = ['driving'];
          }

         const newEdge: MapEdge = {
           id: uuidv4(),
           source_id: edgeStartNodeId,
           target_id: id,
           weight: 0,
           bidirectional: newEdgeBidirectional,
           type: type,
           access: access,
         };
        const newEdges = [...edges, newEdge];
        
        if (!updateEdges(newEdges)) return;
        setEdgeStartNodeId(id); 
        
        toast.success(`Edge added`);
      }
    } else {
      if (multi) {
        const newSet = new Set(selectedNodeIds);
        if (newSet.has(id)) {
          newSet.delete(id);
        } else {
          newSet.add(id);
        }
        setSelectedNodeIds(newSet);
      } else {
        setSelectedNodeIds(new Set([id]));
        setSelectedEdgeIds(new Set());
        setEdgeStartNodeId(null);
      }
    }
  }, [isAddEdgeMode, edgeStartNodeId, edges, selectedNodeIds, updateEdges, newEdgeBidirectional, newEdgeType]);

  const handleBoxSelect = useCallback(
    (ids: string[], additive: boolean, target: 'nodes' | 'edges') => {
      const merge = (prev: Set<string>) => {
        if (!additive) return new Set(ids);
        const next = new Set(prev);
        ids.forEach((id) => next.add(id));
        return next;
      };
      if (target === 'edges') {
        setSelectedEdgeIds(merge);
        if (!additive) setSelectedNodeIds(new Set());
      } else {
        setSelectedNodeIds(merge);
        if (!additive) setSelectedEdgeIds(new Set());
      }
      setEdgeStartNodeId(null);
    },
    [],
  );

  const handleEdgeSelect = useCallback((id: string, multi: boolean) => {
      // Allow selection only if NOT adding nodes/edges, OR if we decide to allow it.
      // Standard behavior: 'select' mode only.
      if (!isAddNodeMode && !isAddEdgeMode) {
          if (multi) {
            const newSet = new Set(selectedEdgeIds);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            setSelectedEdgeIds(newSet);
          } else {
            setSelectedEdgeIds(new Set([id]));
            setSelectedNodeIds(new Set());
          }
      }
  }, [isAddNodeMode, isAddEdgeMode, selectedEdgeIds]);

  const handleSave = useCallback(async (isAutosave = false) => {
    if (operationRef.current !== "idle" || isSaving || isRefreshing) return;
    if (graphConflict) {
      if (!isAutosave) toast.info("Resolve the server graph conflict below before saving.");
      return;
    }
    if (isAutosave && manualOverwriteRef.current) {
      return;
    }
    if (graphRevision === null || graphRevisionRef.current === null) {
      toast.error("Cannot save until the server graph revision is available. Refresh and try again.");
      return;
    }
    const expectedRevision = graphRevisionRef.current;
    const expectedHistoryIndex = historyIndexRef.current;

    const validation = validateEditorGraph(nodes, edges);
    if (!validation.ok) {
      toast.error(`Graph save rejected: ${validation.message}`);
      return;
    }

    operationRef.current = "saving";
    setIsSaving(true);
    const toastId = isAutosave ? "autosave" : "save-sync";
    
    try {
      if (!isAutosave) {
        toast.loading("Syncing to server...", { id: toastId });
      }
      
      const result = await saveMapGraph(nodes, edges, expectedRevision);
      if (result.error || result.revision === null) {
        if (isStaleGraphRevisionError(result.error)) {
          setGraphConflict({ status: "loading" });
          try {
            const latestSnapshot = await getMapGraphSnapshot();
            setGraphConflict(resolveNavigationConflictSnapshot(latestSnapshot));
          } catch (snapshotError) {
            setGraphConflict(resolveNavigationConflictSnapshot({ data: null, error: snapshotError }));
            console.error(snapshotError);
          }
          toast.error(
            isAutosave
              ? "Autosave paused: the server graph changed. Review the conflict below."
              : "The server graph changed. Your draft is preserved; choose how to resolve it below.",
            { id: toastId },
          );
          return;
        }
        throw new Error("Unable to save the navigation graph.");
      }

      graphRevisionRef.current = result.revision;
      setGraphRevision(result.revision);
      if (!isAutosave) manualOverwriteRef.current = false;

      // IndexedDB is a last-committed snapshot. Never write a failed draft to
      // it; only update it after the server RPC has committed successfully.
      try {
        if (db) {
          await db.transaction('rw', db.map_nodes, db.map_edges, async () => {
            await db.map_nodes.clear();
            await db.map_nodes.bulkAdd(nodes);
            await db.map_edges.clear();
            await db.map_edges.bulkAdd(edges);
          });
        }
      } catch (cacheError) {
        lastSavedIndexRef.current = expectedHistoryIndex;
        setLastSaved(new Date());
        toast.warning("Graph saved on server, but the local offline cache could not be updated.", { id: toastId });
        console.error(cacheError);
        return;
      }

      setLastSaved(new Date());
      lastSavedIndexRef.current = expectedHistoryIndex;
      if (isAutosave) {
        toast.success("Autosaved to server", { id: toastId, duration: 2000 });
      } else {
        toast.success("Graph saved to server & local", { id: toastId });
      }
    } catch (e) {
      toast.error(
        isAutosave
          ? "Autosave failed. The last committed graph was kept."
          : "Unable to save the navigation graph. The last committed graph was kept.",
        { id: toastId },
      );
      console.error(e);
    } finally {
      operationRef.current = "idle";
      setIsSaving(false);
    }
  }, [graphConflict, graphRevision, isSaving, isRefreshing, nodes, edges]);

  const saveRef = useRef(handleSave);
  useEffect(() => {
    saveRef.current = handleSave;
  }, [handleSave]);

  useEffect(() => {
    const interval = setInterval(() => {
        if (historyIndexRef.current > lastSavedIndexRef.current) {
            saveRef.current(true);
        }
    }, 60000);
    return () => clearInterval(interval);
  }, []); 

  const sanitizeNodeTypes = useCallback((currentNodes: MapNode[], currentEdges: MapEdge[]) => {
      return currentNodes.map(node => {
          if (['path_start', 'path_middle', 'path_end'].includes(node.type)) {
              const hasOneWayConnection = currentEdges.some(e => 
                  !e.bidirectional && (e.source_id === node.id || e.target_id === node.id)
              );
              if (!hasOneWayConnection) {
                  return { ...node, type: 'node' as GraphNodeType };
              }
          }
          return node;
      });
  }, []);

  const handleBulkDelete = useCallback(() => {
    const remainingNodes = nodes.filter(n => !selectedNodeIds.has(n.id));
    const nodeIdsToDelete = selectedNodeIds;
    let newEdges = edges.filter(e => !selectedEdgeIds.has(e.id));
    
    newEdges = newEdges.filter(e => !nodeIdsToDelete.has(e.source_id) && !nodeIdsToDelete.has(e.target_id));
    
    const sanitizedNodes = sanitizeNodeTypes(remainingNodes, newEdges);
    
    if (!updateGraph(sanitizedNodes, newEdges)) return;
    
    setSelectedNodeIds(new Set());
    setSelectedEdgeIds(new Set());
    toast.success("Selection deleted");
  }, [selectedNodeIds, selectedEdgeIds, nodes, edges, updateGraph, sanitizeNodeTypes]);

  useEffect(() => {
      if (!isAddEdgeMode) {
          setEdgeStartNodeId(null);
      }
  }, [isAddEdgeMode]);

  const getEdgeTypePreset = (edge: MapEdge) => {
      if (edge.type === 'walkway') return 'walkway';
      if (edge.type === 'road') {
          if (edge.access?.includes('walking')) return 'road';
          return 'car_road';
      }
      return edge.type;
  };

  const handleBulkTypePresetChange = (preset: string, edgeIds: Set<string>) => {
      let type: MapEdge['type'] = 'walkway';
      let access: TransportMode[] = ['walking'];

      if (preset === 'walkway') {
          type = 'walkway';
          access = ['walking'];
      } else if (preset === 'road') {
          type = 'road';
          access = ['walking', 'driving'];
      } else if (preset === 'car_road') {
          type = 'road';
          access = ['driving'];
      }

      const newEdges = edges.map(e => 
          edgeIds.has(e.id) ? { ...e, type, access } : e
      );
      updateEdges(newEdges);
  };

  const handleBulkSwapEdgeDirection = useCallback((edgeIds: Set<string>) => {
      const newEdges = edges.map(e => {
          if (edgeIds.has(e.id)) {
              return {
                  ...e,
                  source_id: e.target_id,
                  target_id: e.source_id
              };
          }
          return e;
      });

      const sanitizedNodes = sanitizeNodeTypes(nodes, newEdges);
      if (!updateGraph(sanitizedNodes, newEdges)) return;
      
      toast.success(`Direction swapped for ${edgeIds.size} edge(s)`);
  }, [nodes, edges, updateGraph, sanitizeNodeTypes]);

  const autoAssociateFacilities = (nodeId: string) => {
      const node = nodes.find(n => n.id === nodeId);
      if (!node || facilities.length === 0) return;

      const MAX_DIST = 50; 
      const nearby = facilities.filter(f => {
          const d = getDistance(node.lat, node.lng, f.coordinates.lat, f.coordinates.lng);
          return d <= MAX_DIST;
      }).sort((a, b) => {
          const da = getDistance(node.lat, node.lng, a.coordinates.lat, a.coordinates.lng);
          const db = getDistance(node.lat, node.lng, b.coordinates.lat, b.coordinates.lng);
          return da - db;
      });

      if (nearby.length === 0) {
          toast.info("No facilities found within 50m");
          return;
      }

      const currentIds = node.building_ids ?? [];
      let nextIndex = 0;

      if (currentIds.length > 0) {
          const firstId = currentIds[0];
          const currentIndex = nearby.findIndex(f => f.id === firstId);
          if (currentIndex !== -1) {
              nextIndex = (currentIndex + 1) % nearby.length;
          }
      }

      const nextFacility = nearby[nextIndex];
      handleBulkNodeUpdate({ building_ids: [nextFacility.id] }, new Set([nodeId]));
      toast.success(`Suggested: ${nextFacility.name} (${nextIndex + 1}/${nearby.length})`);
  };

  const handleBulkEdgeUpdate = (updates: Partial<MapEdge>, edgeIds: Set<string>) => {
      const newEdges = edges.map(e => 
          edgeIds.has(e.id) ? { ...e, ...updates } : e
      );
      
      if ('bidirectional' in updates) {
          const sanitizedNodes = sanitizeNodeTypes(nodes, newEdges);
          updateGraph(sanitizedNodes, newEdges);
      } else {
          updateEdges(newEdges);
      }
  };

  const handleBulkNodeUpdate = (updates: Partial<MapNode>, nodeIds: Set<string>) => {
      const newNodes = nodes.map(n => 
          nodeIds.has(n.id) ? { ...n, ...updates } : n
      );
      updateNodes(newNodes);
  };

  const getInferredNodeType = useCallback((nodeId: string): GraphNodeType | null => {
      const connectedEdges = edges.filter(e => e.source_id === nodeId || e.target_id === nodeId);
      const oneWayEdges = connectedEdges.filter(e => !e.bidirectional);
      
      if (oneWayEdges.length === 0) return null;

      const inEdges = oneWayEdges.filter(e => e.target_id === nodeId);
      const outEdges = oneWayEdges.filter(e => e.source_id === nodeId);

      if (inEdges.length === 0 && outEdges.length > 0) return 'path_start';
      if (inEdges.length > 0 && outEdges.length > 0) return 'path_middle';
      if (inEdges.length > 0 && outEdges.length === 0) return 'path_end';
      
      return null;
  }, [edges]);

  const handleSwapNodeDirection = (nodeIds: Set<string>) => {
      // Find the connected component of one-way edges involving these nodes
      const edgesToSwap = new Set<string>();
      const visitedNodes = new Set<string>();
      const queue = Array.from(nodeIds);
      
      queue.forEach(id => visitedNodes.add(id));

      while (queue.length > 0) {
          const nodeId = queue.shift()!;
          
          // Find all one-way edges connected to this node
          const connectedOneWay = edges.filter(e => 
              !e.bidirectional && (e.source_id === nodeId || e.target_id === nodeId)
          );

          connectedOneWay.forEach(edge => {
              if (!edgesToSwap.has(edge.id)) {
                  edgesToSwap.add(edge.id);
                  
                  // Add the other node to queue if not visited
                  const otherNodeId = edge.source_id === nodeId ? edge.target_id : edge.source_id;
                  if (!visitedNodes.has(otherNodeId)) {
                      visitedNodes.add(otherNodeId);
                      queue.push(otherNodeId);
                  }
              }
          });
      }

      if (edgesToSwap.size === 0) {
          toast.info("No one-way edges connected to selected nodes");
          return;
      }

      const newEdges = edges.map(e => {
          if (edgesToSwap.has(e.id)) {
              return {
                  ...e,
                  source_id: e.target_id,
                  target_id: e.source_id
              };
          }
          return e;
      });

      const newNodes = nodes.map(n => {
          if (visitedNodes.has(n.id)) {
              if (n.type === 'path_start') return { ...n, type: 'path_end' as GraphNodeType };
              if (n.type === 'path_end') return { ...n, type: 'path_start' as GraphNodeType };
          }
          return n;
      });

      if (!updateGraph(newNodes, newEdges)) return;
      toast.success(`Swapped direction of ${edgesToSwap.size} edge(s) and updated node roles`);
  };

  const getConnectedGroups = useCallback(() => {
      const visited = new Set<string>();
      const groups: string[][] = [];

      nodes.forEach(node => {
          if (!visited.has(node.id)) {
              const group: string[] = [];
              const queue = [node.id];
              visited.add(node.id);

              while (queue.length > 0) {
                  const curr = queue.shift()!;
                  group.push(curr);

                  edges.forEach(edge => {
                      if (edge.source_id === curr && !visited.has(edge.target_id)) {
                          visited.add(edge.target_id);
                          queue.push(edge.target_id);
                      } else if (edge.target_id === curr && !visited.has(edge.source_id)) {
                          visited.add(edge.source_id);
                          queue.push(edge.source_id);
                      }
                  });
              }
              groups.push(group);
          }
      });
      return groups;
  }, [nodes, edges]);

  const handleNodeMove = useCallback((id: string, lat: number, lng: number) => {
      const newNodes = nodes.map(n => n.id === id ? { ...n, lat, lng } : n);
      updateNodes(newNodes);
  }, [nodes, updateNodes]);

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-100px)] gap-4 relative">
      {isRefreshing && nodes.length === 0 && (
        <div className="absolute inset-0 z-[2000] flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg border">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
          <p className="text-sm text-muted-foreground mt-2 font-medium">Syncing graph with server...</p>
        </div>
      )}
      <div className="flex-1 relative rounded-lg border overflow-hidden min-h-[400px]">
        <EditorMap
          nodes={nodes}
          edges={edges}
          mode={isAddNodeMode && isAddEdgeMode ? 'mixed' : (isAddNodeMode ? 'add_node' : (isAddEdgeMode ? 'add_edge' : 'select'))}
          selectedNodeIds={selectedNodeIds}
          selectedEdgeIds={selectedEdgeIds}
          edgeStartNodeId={edgeStartNodeId}
          onNodeAdd={handleNodeAdd}
          onNodeSelect={handleNodeSelect}
          onEdgeSelect={handleEdgeSelect}
          onNodeMove={handleNodeMove}
          boxTarget={boxTarget}
          onBoxSelect={handleBoxSelect}
        />

        {!isAddNodeMode && !isAddEdgeMode && (
          <div className="absolute bottom-4 left-1/2 z-[1000] flex -translate-x-1/2 items-center gap-1 rounded-full border bg-background/90 px-2 py-1 text-[11px] text-muted-foreground shadow-sm">
            <span className="pl-1">Box-select:</span>
            <Button
              type="button"
              size="sm"
              variant={boxTarget === 'nodes' ? 'default' : 'ghost'}
              className="h-6 rounded-full px-2 text-[11px]"
              onClick={() => setBoxTarget('nodes')}
            >
              Nodes
            </Button>
            <Button
              type="button"
              size="sm"
              variant={boxTarget === 'edges' ? 'default' : 'ghost'}
              className="h-6 rounded-full px-2 text-[11px]"
              onClick={() => setBoxTarget('edges')}
            >
              Edges
            </Button>
            <span className="pr-1">· Shift adds · Space pans</span>
          </div>
        )}

        <Card className="absolute top-4 left-4 p-2 flex flex-col gap-2 z-[1000]" data-tour="nav-toolbar">
          <div className="flex gap-1 mb-1 justify-center">
             <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleUndo} disabled={historyIndex <= 0} title="Undo" aria-label="Undo">
                 <Undo2 className="h-4 w-4" />
             </Button>
             <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleRedo} disabled={historyIndex >= history.length - 1} title="Redo" aria-label="Redo">
                 <Redo2 className="h-4 w-4" />
             </Button>
          </div>
          <div className="h-px bg-border my-1" />
          
          <Button
            variant={(!isAddNodeMode && !isAddEdgeMode) ? "default" : "ghost"}
            size="icon"
            onClick={() => { setIsAddNodeMode(false); setIsAddEdgeMode(false); }}
            title="Select Mode"
            aria-label="Select mode"
          >
            <MousePointer2 className="h-4 w-4" />
          </Button>
          <Button
            variant={isAddNodeMode ? "default" : "ghost"}
            size="icon"
            onClick={() => setIsAddNodeMode(!isAddNodeMode)}
            title="Add Node"
            aria-label="Add node"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            variant={isAddEdgeMode ? "default" : "ghost"}
            size="icon"
            onClick={() => setIsAddEdgeMode(!isAddEdgeMode)}
            title="Add Edge (Chain)"
            aria-label="Add edge chain"
          >
            <Route className="h-4 w-4" />
          </Button>

          {isAddEdgeMode && (
              <div className="flex flex-col gap-1 border-t pt-1">
                  <Button
                    variant={newEdgeBidirectional ? "secondary" : "ghost"}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setNewEdgeBidirectional(true)}
                    title="Two-way"
                    aria-label="Use two-way edges"
                  >
                    <ArrowLeftRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={!newEdgeBidirectional ? "secondary" : "ghost"}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setNewEdgeBidirectional(false)}
                    title="One-way"
                    aria-label="Use one-way edges"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                  <div className="h-px bg-border my-1" />
                  <Select value={newEdgeType} onValueChange={(v: 'walkway' | 'road' | 'car_road') => setNewEdgeType(v)}>
                      <SelectTrigger className="h-8 w-8 p-0 border-none bg-transparent hover:bg-accent flex items-center justify-center" aria-label="New edge type">
                          <SelectValue>
                              {newEdgeType === 'walkway' && <Footprints className="h-4 w-4" />}
                              {newEdgeType === 'road' && <div className="relative h-4 w-4"><Footprints className="h-3 w-3 absolute -top-0.5 -left-0.5" /><Car className="h-3 w-3 absolute -bottom-0.5 -right-0.5" /></div>}
                              {newEdgeType === 'car_road' && <Car className="h-4 w-4" />}
                          </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                          <SelectItem value="walkway">
                              <div className="flex items-center gap-2">
                                  <Footprints className="h-4 w-4" />
                                  <span>Walkway</span>
                              </div>
                          </SelectItem>
                          <SelectItem value="road">
                              <div className="flex items-center gap-2">
                                  <Route className="h-4 w-4" />
                                  <span>Shared Road</span>
                              </div>
                          </SelectItem>
                          <SelectItem value="car_road">
                              <div className="flex items-center gap-2">
                                  <Car className="h-4 w-4" />
                                  <span>Car Road</span>
                              </div>
                          </SelectItem>
                      </SelectContent>
                  </Select>
              </div>
          )}
          
          <div className="h-px bg-border my-1" />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleSave()}
            title="Save"
            aria-label="Save graph"
            loading={isSaving}
          >
            <Save className="h-4 w-4" />
          </Button>
        </Card>
      </div>

      <Card className="w-full md:w-80 p-4 flex flex-col gap-4 overflow-y-auto" data-tour="nav-panel">
        <h2 className="font-semibold text-lg">Graph Editor</h2>
        <div className="text-sm text-muted-foreground">
          Nodes: {nodes.length} | Edges: {edges.length}
        </div>

        {graphConflict && (
          <div className="border border-amber-500/50 rounded p-3 bg-amber-500/10 space-y-3" role="alert">
            <div className="font-medium text-sm">Server graph changed</div>
            {graphConflict.status === "loading" && (
              <p className="text-xs text-muted-foreground">Loading the latest committed graph. Your draft is preserved.</p>
            )}
            {graphConflict.status === "error" && (
              <>
                <p className="text-xs text-muted-foreground">{graphConflict.message}</p>
                <Button variant="outline" size="sm" className="w-full" onClick={handleRetryConflictSnapshot}>
                  Retry latest snapshot
                </Button>
              </>
            )}
            {graphConflict.status === "ready" && (
              <>
                <p className="text-xs text-muted-foreground">
                  Your local edits are still open. Keep them and explicitly save over revision {graphConflict.snapshot.revision},
                  or discard them and load the server snapshot.
                </p>
                <div className="grid grid-cols-1 gap-2">
                  <Button variant="secondary" size="sm" onClick={handleKeepDraftAfterConflict}>
                    Keep my draft
                  </Button>
                  <Button variant="destructive" size="sm" onClick={handleDiscardDraftAfterConflict}>
                    Discard draft &amp; use server
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {(selectedNodeIds.size > 0 || selectedEdgeIds.size > 0) && (
            <div className="border rounded p-3 bg-muted/50 space-y-3">
                <div className="font-medium flex justify-between items-center">
                    <span>Selection</span>
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        {selectedNodeIds.size + selectedEdgeIds.size} items
                    </span>
                </div>
                
                 {selectedNodeIds.size > 0 && (
                     <div className="text-xs text-muted-foreground">
                         {selectedNodeIds.size} Node(s) selected
                     </div>
                 )}
                 
                 {selectedEdgeIds.size > 0 && (
                     <div className="text-xs text-muted-foreground">
                         {selectedEdgeIds.size} Edge(s) selected
                     </div>
                 )}

                 <Button variant="destructive" size="sm" className="w-full" onClick={handleBulkDelete}>
                     <Trash2 className="h-4 w-4 mr-2" /> Delete Selection
                 </Button>
             </div>
         )}

         {selectedNodeIds.size > 0 && (() => {
             const firstNodeId = Array.from(selectedNodeIds)[0];
             const firstNode = nodes.find(n => n.id === firstNodeId);
             if (!firstNode) return null;
             
              const allSameType = Array.from(selectedNodeIds).every(id => nodes.find(n => n.id === id)?.type === firstNode.type);
              const commonType = allSameType ? firstNode.type : undefined;

               const inferredTypes = Array.from(selectedNodeIds).map(id => ({ id, type: getInferredNodeType(id) }));
               const hasAnyInferred = inferredTypes.some(t => t.type !== null) || Array.from(selectedNodeIds).some(id => nodes.find(n => n.id === id)?.group_id);

               return (
                <div className="border rounded p-3 bg-card space-y-3">
                  <div className="font-medium flex justify-between items-center">
                      <span>Node Properties {selectedNodeIds.size > 1 && `(${selectedNodeIds.size})`}</span>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6" 
                        title="Swap connection directions"
                        onClick={() => handleSwapNodeDirection(selectedNodeIds)}
                      >
                        <RefreshCw className="h-3 w-3" />
                      </Button>
                  </div>
                  
                   <div className="space-y-2">
                      <Label className="text-xs">Node Type</Label>
                      {hasAnyInferred ? (
                          <div className="flex flex-col gap-2">
                              <div className="grid grid-cols-3 gap-1">
                                  <Button 
                                      variant={commonType === 'path_start' ? "default" : "outline"}
                                      size="sm"
                                      className="text-[10px] px-1 h-7"
                                      onClick={() => handleBulkNodeUpdate({ type: 'path_start' }, selectedNodeIds)}
                                  >
                                      Start
                                  </Button>
                                  <Button 
                                      variant={commonType === 'path_middle' ? "default" : "outline"}
                                      size="sm"
                                      className="text-[10px] px-1 h-7"
                                      onClick={() => handleBulkNodeUpdate({ type: 'path_middle' }, selectedNodeIds)}
                                  >
                                      Middle
                                  </Button>
                                  <Button 
                                      variant={commonType === 'path_end' ? "default" : "outline"}
                                      size="sm"
                                      className="text-[10px] px-1 h-7"
                                      onClick={() => handleBulkNodeUpdate({ type: 'path_end' }, selectedNodeIds)}
                                  >
                                      End
                                  </Button>
                              </div>
                              <p className="text-[10px] text-muted-foreground italic">
                                  {selectedNodeIds.size === 1 
                                     ? "One-way connections detected." 
                                     : `One-way roles for ${inferredTypes.filter(t => t.type !== null).length}/${selectedNodeIds.size} nodes.`}
                              </p>
                              <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="w-full text-[10px] h-7"
                                  onClick={() => {
                                      const newNodes = nodes.map(n => {
                                          if (
                                              selectedNodeIds.has(n.id) &&
                                              n.type !== 'gate' &&
                                              n.type !== 'building_entry'
                                          ) {
                                              const inferred = getInferredNodeType(n.id);
                                              if (inferred) return { ...n, type: inferred };
                                          }
                                          return n;
                                      });
                                      updateNodes(newNodes);
                                      toast.success("Applied auto-detected roles");
                                  }}
                              >
                                  <Wand2 className="h-3 w-3 mr-2" /> Auto-apply Roles
                              </Button>
                          </div>
                      ) : (
                        <Select 
                            value={commonType} 
                            onValueChange={(v: GraphNodeType) => handleBulkNodeUpdate({ type: v }, selectedNodeIds)}
                        >
                            <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder={!allSameType ? "Multiple Types" : "Select Type..."} />
                            </SelectTrigger>
                            <SelectContent>
                                 <SelectItem value="node">Standard Node</SelectItem>
                                 <SelectItem value="building_entry">Facility Entry</SelectItem>
                                 <SelectItem value="gate">Gate (external connector)</SelectItem>
                             </SelectContent>
                        </Select>
                      )}
                   </div>


                  {selectedNodeIds.size === 1 && firstNode.type === 'building_entry' && (
                    <div className="space-y-2 pt-2 border-t">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs">Associated Facilities</Label>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6" 
                                title="Auto-associate closest facilities"
                                onClick={() => autoAssociateFacilities(firstNodeId)}
                            >
                                <Wand2 className="h-3 w-3" />
                            </Button>
                        </div>
                        <FacilitySelectorUnified 
                            value={firstNode.building_ids ?? []}
                            onSelect={(f) => {
                                const currentIds = firstNode.building_ids ?? [];
                                if (!currentIds.includes(f.id)) {
                                    handleBulkNodeUpdate({ building_ids: [...currentIds, f.id] }, selectedNodeIds);
                                }
                            }}
                            onDeselect={(id) => {
                                const currentIds = firstNode.building_ids ?? [];
                                handleBulkNodeUpdate({ building_ids: currentIds.filter(cid => cid !== id) }, selectedNodeIds);
                            }}
                            multi
                            placeholder="Search & add facilities..."
                        />

                        <div className="border-t pt-2 mt-2">
                           <details className="group open:pb-2">
                               <summary className="list-none cursor-pointer flex items-center justify-between text-xs font-semibold py-2 hover:bg-muted/50 px-1 -mx-1 rounded select-none">
                                   <div className="flex items-center gap-1">
                                       <AlertTriangle className="h-3 w-3" /> Closure Rules
                                   </div>
                                   <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
                               </summary>
                               
                               <div className="space-y-2 pt-2 pl-2 border-l-2 border-muted ml-1">
                                   <div className="flex items-center gap-2">
                                       <Checkbox 
                                           id="node_until_toggled"
                                           checked={firstNode.closed_until_toggled ?? false}
                                           onCheckedChange={(checked) => handleBulkNodeUpdate({ 
                                               closed_until_toggled: !!checked 
                                           }, selectedNodeIds)}
                                       />
                                       <Label htmlFor="node_until_toggled" className="text-[10px] cursor-pointer font-bold text-destructive">
                                           Force Close (Until Toggled)
                                       </Label>
                                   </div>

                                   {!firstNode.closed_until_toggled && (
                                     <>
                                       <div className="grid grid-cols-2 gap-2">
                                           <div>
                                               <Label className="text-[10px]">Closed From</Label>
                                               <Input 
                                                   type="date" 
                                                   className="h-7 text-[10px]"
                                                   value={firstNode.closed_from?.split('T')[0] ?? ''}
                                                   onChange={(e) => handleBulkNodeUpdate({ 
                                                       closed_from: e.target.value ? new Date(e.target.value).toISOString() : undefined 
                                                   }, selectedNodeIds)}
                                               />
                                           </div>
                                           <div>
                                               <Label className="text-[10px]">Closed Until</Label>
                                               <Input 
                                                   type="date" 
                                                   className="h-7 text-[10px]"
                                                   value={firstNode.closed_until?.split('T')[0] ?? ''}
                                                   onChange={(e) => handleBulkNodeUpdate({ 
                                                       closed_until: e.target.value ? new Date(e.target.value).toISOString() : undefined 
                                                   }, selectedNodeIds)}
                                               />
                                           </div>
                                       </div>
                                     </>
                                   )}
                                   
                                   <div>
                                       <Label className="text-[10px]">Reason (optional)</Label>
                                       <Input 
                                           type="text" 
                                           className="h-7 text-xs"
                                           placeholder="e.g., Construction"
                                           value={firstNode.closure_reason ?? ''}
                                           onChange={(e) => handleBulkNodeUpdate({ closure_reason: e.target.value || undefined }, selectedNodeIds)}
                                       />
                                   </div>

                                   <div className="pt-2 border-t">
                                       <Label className="text-xs font-semibold flex items-center gap-1">
                                           <Clock className="h-3 w-3" /> Opening Hours
                                       </Label>
                                       <p className="text-[10px] text-muted-foreground mt-1 mb-2">
                                           Select times when this entry is <strong>OPEN</strong>.
                                       </p>
                                       
                                       <div className="space-y-2">
                                           <div className="flex flex-col gap-1">
                                               {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => {
                                                   const isEnabled = firstNode.closure_recurring_days?.includes(i);
                                                   const daily = firstNode.closure_daily_schedule?.[i];
                                                   
                                                   return (
                                                       <div key={i} className="flex items-center gap-2 bg-muted/30 p-1 rounded">
                                                           <Checkbox 
                                                               id={`node-day-${i}`}
                                                               checked={isEnabled}
                                                               onCheckedChange={(checked) => {
                                                                   const currentDays = firstNode.closure_recurring_days ?? [];
                                                                   const nextDays = checked 
                                                                     ? [...currentDays, i] 
                                                                     : currentDays.filter(d => d !== i);
                                                                   handleBulkNodeUpdate({ closure_recurring_days: nextDays }, selectedNodeIds);
                                                               }}
                                                           />
                                                           <Label htmlFor={`node-day-${i}`} className="text-[10px] w-8">{day}</Label>
                                                           
                                                           {isEnabled && (
                                                               <div className="flex items-center gap-1 flex-1">
                                                                   <Input 
                                                                       type="time" 
                                                                       className="h-6 text-[10px] p-1"
                                                                       value={daily?.start || firstNode.closure_recurring_start || ''}
                                                                       onChange={(e) => {
                                                                           const schedule = { ...(firstNode.closure_daily_schedule || {}) };
                                                                           schedule[i] = { 
                                                                               start: e.target.value, 
                                                                               end: daily?.end || firstNode.closure_recurring_end || '' 
                                                                           };
                                                                           handleBulkNodeUpdate({ closure_daily_schedule: schedule }, selectedNodeIds);
                                                                       }}
                                                                   />
                                                                   <span className="text-[10px]">-</span>
                                                                   <Input 
                                                                   type="time" 
                                                                   className="h-6 text-[10px] p-1"
                                                                   value={daily?.end || firstNode.closure_recurring_end || ''}
                                                                   onChange={(e) => {
                                                                       const schedule = { ...(firstNode.closure_daily_schedule || {}) };
                                                                       schedule[i] = { 
                                                                           start: daily?.start || firstNode.closure_recurring_start || '', 
                                                                           end: e.target.value 
                                                                       };
                                                                       handleBulkNodeUpdate({ closure_daily_schedule: schedule }, selectedNodeIds);
                                                                   }}
                                                               />
                                                           </div>
                                                       )}
                                                   </div>
                                               );
                                           })}
                                       </div>
                                   </div>
                               </div>
                           </div>
                           </details>
                        </div>
                    </div>
                )}

                {selectedNodeIds.size === 1 && (
                    <div className="space-y-2 pt-2 border-t">
                        <Label className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Automata State</Label>
                        <div className="text-xs p-2 bg-muted rounded flex flex-col gap-1">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Current:</span>
                                <span className="font-mono text-primary uppercase">{firstNode.type}</span>
                            </div>
                            <div className="flex justify-between border-t border-white/5 pt-1 mt-1">
                                <span className="text-muted-foreground">In-Degree:</span>
                                <span className="font-mono">{edges.filter(e => e.target_id === firstNodeId || (e.bidirectional && e.source_id === firstNodeId)).length}</span>
                            </div>
                            <div className="flex justify-between border-t border-white/5 pt-1 mt-1">
                                <span className="text-muted-foreground">Out-Degree:</span>
                                <span className="font-mono">{edges.filter(e => e.source_id === firstNodeId || (e.bidirectional && e.target_id === firstNodeId)).length}</span>
                            </div>
                            <div className="flex justify-between border-t border-white/5 pt-1 mt-1">
                                <span className="text-muted-foreground">Group Size:</span>
                                <span className="font-mono">{getConnectedGroups().find(g => g.includes(firstNodeId))?.length ?? 0} node(s)</span>
                            </div>
                        </div>
                    </div>
                )}
               </div>
             );
         })()}

         {selectedEdgeIds.size > 0 && (() => {
             const firstEdgeId = Array.from(selectedEdgeIds)[0];
             const firstEdge = edges.find(e => e.id === firstEdgeId);
             if (!firstEdge) return null;

             const allSameType = Array.from(selectedEdgeIds).every(id => {
                 const e = edges.find(edge => edge.id === id);
                 return e && getEdgeTypePreset(e) === getEdgeTypePreset(firstEdge);
             });
             const commonPreset = allSameType ? getEdgeTypePreset(firstEdge) : undefined;
             
              const allSameBidi = Array.from(selectedEdgeIds).every(id => edges.find(e => e.id === id)?.bidirectional === firstEdge.bidirectional);
              const commonBidi = allSameBidi ? firstEdge.bidirectional : false;

               const allSameUntilToggled = Array.from(selectedEdgeIds).every(id => edges.find(e => e.id === id)?.closed_until_toggled === firstEdge.closed_until_toggled);
              const commonUntilToggled = allSameUntilToggled ? firstEdge.closed_until_toggled : false;

              return (

             <div className="border rounded p-3 bg-card space-y-3">
                      <div className="font-medium flex justify-between items-center">
                          <span>Edge Properties {selectedEdgeIds.size > 1 && `(${selectedEdgeIds.size})`}</span>
                          {!commonBidi && (
                              <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-6 w-6"
                                  title="Swap Direction"
                                  onClick={() => handleBulkSwapEdgeDirection(selectedEdgeIds)}
                              >
                                  <RefreshCw className="h-3 w-3" />
                              </Button>
                          )}
                      </div>
                 
                 <div className="space-y-2">
                      <Label className="text-xs flex items-center gap-1"><Route className="h-3 w-3" /> Edge Type</Label>
                        <Select 
                            value={commonPreset} 
                            onValueChange={(v) => handleBulkTypePresetChange(v, selectedEdgeIds)}
                        >
                            <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder={!allSameType ? "Multiple Types" : "Select Type..."} />
                            </SelectTrigger>

                            <SelectContent>
                              <SelectItem value="walkway">
                                  <div className="flex items-center gap-2">
                                      <Footprints className="h-3 w-3" />
                                      <span>Walkway</span>
                                  </div>
                              </SelectItem>
                              <SelectItem value="road">
                                  <div className="flex items-center gap-2">
                                      <Route className="h-3 w-3" />
                                      <span>Shared Road</span>
                                  </div>
                              </SelectItem>
                              <SelectItem value="car_road">
                                  <div className="flex items-center gap-2">
                                      <Car className="h-3 w-3" />
                                      <span>Car Road</span>
                                  </div>
                              </SelectItem>
                          </SelectContent>
                      </Select>

                 </div>
                 
                 <div className="flex items-center gap-2 pt-2 border-t">
                     <ToggleGroup type="single" value={commonBidi ? "bidi" : "one-way"} onValueChange={(val) => {
                         if (val) handleBulkEdgeUpdate({ bidirectional: val === "bidi" }, selectedEdgeIds);
                     }}>
                        <ToggleGroupItem value="bidi" size="sm" aria-label="Two-way" className="h-8 px-2 text-xs">
                            <ArrowLeftRight className="h-3 w-3 mr-1" /> Two-way
                        </ToggleGroupItem>
                        <ToggleGroupItem value="one-way" size="sm" aria-label="One-way" className="h-8 px-2 text-xs">
                            <ArrowRight className="h-3 w-3 mr-1" /> One-way
                        </ToggleGroupItem>
                     </ToggleGroup>
                  </div>

                 
                      <div className="border-t pt-2 mt-2">

                          <details className="group open:pb-2">
                              <summary className="list-none cursor-pointer flex items-center justify-between text-xs font-semibold py-2 hover:bg-muted/50 px-1 -mx-1 rounded select-none">
                                  <div className="flex items-center gap-1">
                                      <AlertTriangle className="h-3 w-3" /> Closure Rules
                                  </div>
                                  <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
                              </summary>
                              
                              <div className="space-y-2 pt-2 pl-2 border-l-2 border-muted ml-1">
                                  <div className="flex items-center gap-2">
                                      <Checkbox 
                                          id="until_toggled"
                                          checked={commonUntilToggled ?? false}
                                          onCheckedChange={(checked) => handleBulkEdgeUpdate({ 
                                              closed_until_toggled: !!checked 
                                          }, selectedEdgeIds)}
                                      />
                                      <Label htmlFor="until_toggled" className="text-[10px] cursor-pointer font-bold text-destructive">
                                          Force Close (Until Toggled)
                                      </Label>
                                  </div>

                                  {!commonUntilToggled && (
                                    <>
                                      <div className="grid grid-cols-2 gap-2">
                                          <div>
                                              <Label className="text-[10px]">Closed From</Label>
                                              <Input 
                                                  type="date" 
                                                  className="h-7 text-[10px]"
                                                  value={firstEdge.closed_from?.split('T')[0] ?? ''}
                                                  onChange={(e) => handleBulkEdgeUpdate({ 
                                                      closed_from: e.target.value ? new Date(e.target.value).toISOString() : undefined 
                                                  }, selectedEdgeIds)}
                                              />
                                          </div>
                                          <div>
                                              <Label className="text-[10px]">Closed Until</Label>
                                              <Input 
                                                  type="date" 
                                                  className="h-7 text-[10px]"
                                                  value={firstEdge.closed_until?.split('T')[0] ?? ''}
                                                  onChange={(e) => handleBulkEdgeUpdate({ 
                                                      closed_until: e.target.value ? new Date(e.target.value).toISOString() : undefined 
                                                  }, selectedEdgeIds)}
                                              />
                                          </div>
                                      </div>
                                    </>
                                  )}
                                  
                                  <div>
                                      <Label className="text-[10px]">Reason (optional)</Label>
                                      <Input 
                                          type="text" 
                                          className="h-7 text-xs"
                                          placeholder="e.g., Construction"
                                          value={firstEdge.closure_reason ?? ''}
                                          onChange={(e) => handleBulkEdgeUpdate({ closure_reason: e.target.value || undefined }, selectedEdgeIds)}
                                      />
                                  </div>

                                  <div className="pt-2 border-t">
                                      <Label className="text-xs font-semibold flex items-center gap-1">
                                          <Clock className="h-3 w-3" /> Opening Hours
                                      </Label>
                                      <p className="text-[10px] text-muted-foreground mt-1 mb-2">
                                          Select times when this path is <strong>OPEN</strong>.
                                      </p>
                                      
                                      <div className="space-y-2">
                                          <div className="flex flex-col gap-1">
                                              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => {
                                                  // Inverted logic: 'closure_recurring_days' stores ALLOWED days
                                                  const isEnabled = firstEdge.closure_recurring_days?.includes(i);
                                                  const daily = firstEdge.closure_daily_schedule?.[i];
                                                  
                                                  return (
                                                      <div key={i} className="flex items-center gap-2 bg-muted/30 p-1 rounded">
                                                          <Checkbox 
                                                              id={`day-${i}`}
                                                              checked={isEnabled}
                                                              onCheckedChange={(checked) => {
                                                                  const currentDays = firstEdge.closure_recurring_days ?? [];
                                                                  const nextDays = checked 
                                                                    ? [...currentDays, i] 
                                                                    : currentDays.filter(d => d !== i);
                                                                  handleBulkEdgeUpdate({ closure_recurring_days: nextDays }, selectedEdgeIds);
                                                              }}
                                                          />
                                                          <Label htmlFor={`day-${i}`} className="text-[10px] w-8">{day}</Label>
                                                          
                                                          {isEnabled && (
                                                              <div className="flex items-center gap-1 flex-1">
                                                                  <Input 
                                                                      type="time" 
                                                                      className="h-6 text-[10px] p-1"
                                                                      value={daily?.start || firstEdge.closure_recurring_start || ''}
                                                                      onChange={(e) => {
                                                                          const schedule = { ...(firstEdge.closure_daily_schedule || {}) };
                                                                          schedule[i] = { 
                                                                              start: e.target.value, 
                                                                              end: daily?.end || firstEdge.closure_recurring_end || '' 
                                                                          };
                                                                          handleBulkEdgeUpdate({ closure_daily_schedule: schedule }, selectedEdgeIds);
                                                                      }}
                                                                  />
                                                                  <span className="text-[10px]">-</span>
                                                                  <Input 
                                                                  type="time" 
                                                                  className="h-6 text-[10px] p-1"
                                                                  value={daily?.end || firstEdge.closure_recurring_end || ''}
                                                                  onChange={(e) => {
                                                                      const schedule = { ...(firstEdge.closure_daily_schedule || {}) };
                                                                      schedule[i] = { 
                                                                          start: daily?.start || firstEdge.closure_recurring_start || '', 
                                                                          end: e.target.value 
                                                                      };
                                                                      handleBulkEdgeUpdate({ closure_daily_schedule: schedule }, selectedEdgeIds);
                                                                  }}
                                                              />
                                                          </div>
                                                      )}
                                                  </div>
                                              );
                                          })}
                                      </div>
                                  </div>
                              </div>
                          </div>
                          </details>
                  </div>

             </div>
             );
         })()}
      </Card>
    </div>
  );
}
