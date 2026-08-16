import assert from "node:assert/strict";
import test from "node:test";
import type { PathResult } from "@/lib/types/graph";
import {
  createInitialMapRuntimeState,
  mapRuntimeReducer,
  type MapRuntimeState,
} from "@/lib/map/map-runtime";
import { createRouteRequestCoordinator } from "./route-request-coordinator";

const route: PathResult = {
  path: [
    { id: "start", lat: 10, lng: 10, type: "node" },
    { id: "end", lat: 10.001, lng: 10.001, type: "node" },
  ],
  totalDistance: 150,
  estimatedTime: 2,
};

test("coordinator request identity is propagated to runtime and stale guards", async () => {
  const state = { current: createInitialMapRuntimeState() };
  state.current = mapRuntimeReducer(state.current, {
    type: "navigation/requested",
    requestId: 1,
    destinationId: "facility-a",
    origin: "live",
    mode: "walking",
    start: { lat: 10, lng: 10 },
    end: { lat: 10.1, lng: 10.1 },
  });

  let startedRequestIds: number[] = [];
  let publishedRequestIds: number[] = [];
  let successToastIds: string[] = [];
  let resolveFirst!: (value: PathResult) => void;
  let resolveSecond!: (value: PathResult) => void;
  const first = new Promise<PathResult>((resolve) => { resolveFirst = resolve; });
  const second = new Promise<PathResult>((resolve) => { resolveSecond = resolve; });
  const coordinator = createRouteRequestCoordinator<PathResult>({
    clear: () => undefined,
    publish: (result, requestId) => {
      if (requestId === undefined) return;
      publishedRequestIds.push(requestId);
      state.current = mapRuntimeReducer(state.current, {
        type: "navigation/committed",
        requestId,
        route: result,
      });
    },
    loading: () => undefined,
    success: (_message, toastId) => { successToastIds.push(toastId); },
    error: () => undefined,
    dismiss: () => undefined,
    requestStarted: (requestId) => {
      startedRequestIds.push(requestId);
      const currentPending = state.current.navigation.pendingRequestId;
      if (currentPending !== requestId) {
        state.current = mapRuntimeReducer(state.current, {
          type: "navigation/requested",
          requestId,
          destinationId: "facility-a",
          origin: "live",
          mode: "walking",
          start: { lat: 10, lng: 10 },
          end: { lat: 10.1, lng: 10.1 },
        });
      }
      state.current = mapRuntimeReducer(state.current, { type: "navigation/resolving", requestId });
    },
  });

  coordinator.start({ resolve: () => first });
  await Promise.resolve();
  coordinator.start({ resolve: () => second });
  await Promise.resolve();
  assert.equal(startedRequestIds.length, 2);
  assert.notEqual(startedRequestIds[0], startedRequestIds[1]);
  assert.equal(state.current.navigation.pendingRequestId, startedRequestIds[1]);

  resolveFirst(route);
  resolveSecond({ ...route, totalDistance: 225 });
  await Promise.all([first, second]);
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(publishedRequestIds, [startedRequestIds[1]]);
  assert.equal(state.current.navigation.committed?.route.totalDistance, 225);
  assert.equal(state.current.navigation.pendingRequestId, null);
  assert.equal(successToastIds.length, 1);
});
