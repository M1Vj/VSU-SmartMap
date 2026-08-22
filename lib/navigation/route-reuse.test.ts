import assert from "node:assert/strict";
import test from "node:test";
import type { PathResult } from "@/lib/types/graph";
import { createRouteRequestCoordinator } from "./route-request-coordinator";
import { canReuseCommittedRoute } from "./route-reuse";

const route: PathResult = {
  path: [
    { id: "start", lat: 10, lng: 10, type: "node" },
    { id: "end", lat: 10.001, lng: 10.001, type: "node" },
  ],
  totalDistance: 150,
  estimatedTime: 2,
};

const committed = {
  route,
  destinationId: "facility-a",
  origin: "live" as const,
  mode: "walking" as const,
  start: { lat: 10, lng: 10 },
  end: { lat: 10.1, lng: 10.1 },
};

test("reuses only an exact committed route snapshot", () => {
  assert.equal(
    canReuseCommittedRoute({
      committed,
      destinationId: "facility-a",
      mode: "walking",
      origin: "live",
      start: { lat: 10, lng: 10 },
      end: { lat: 10.1, lng: 10.1 },
    }),
    true,
  );
  assert.equal(
    canReuseCommittedRoute({
      committed,
      destinationId: "facility-a",
      mode: "walking",
      origin: "live",
      start: { lat: 10.0001, lng: 10 },
      end: { lat: 10.1, lng: 10.1 },
    }),
    false,
  );
  assert.equal(
    canReuseCommittedRoute({
      committed,
      destinationId: "facility-a",
      mode: "driving",
      origin: "live",
      start: { lat: 10, lng: 10 },
      end: { lat: 10.1, lng: 10.1 },
    }),
    false,
  );
  assert.equal(
    canReuseCommittedRoute({
      committed,
      destinationId: "facility-b",
      mode: "walking",
      origin: "live",
      start: { lat: 10, lng: 10 },
      end: { lat: 10.1, lng: 10.1 },
    }),
    false,
  );
  assert.equal(
    canReuseCommittedRoute({
      committed,
      destinationId: "facility-a",
      mode: "walking",
      origin: "manual",
      start: { lat: 10, lng: 10 },
      end: { lat: 10.1, lng: 10.1 },
    }),
    false,
  );
});

test("reuse aborts the old request without provider/toast work, while a changed start requests again", async () => {
  const events: string[] = [];
  let providerCalls = 0;
  let firstSignal: AbortSignal | undefined;
  const coordinator = createRouteRequestCoordinator<string>({
    clear: () => events.push("clear"),
    publish: () => undefined,
    loading: (_message, id) => events.push(`loading:${id}`),
    success: (_message, id) => events.push(`success:${id}`),
    error: (_message, id) => events.push(`error:${id}`),
    dismiss: (id) => events.push(`dismiss:${id}`),
  });

  coordinator.start({
    loadingMessage: "Loading",
    resolve: (signal) => {
      firstSignal = signal;
      providerCalls += 1;
      return new Promise<string>(() => undefined);
    },
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(providerCalls, 1);

  const loadingCountBeforeReuse = events.filter((event) => event.startsWith("loading:")).length;
  coordinator.start({});
  assert.equal(firstSignal?.aborted, true);
  assert.equal(events.filter((event) => event.startsWith("loading:")).length, loadingCountBeforeReuse);
  assert.equal(events.filter((event) => event.startsWith("success:")).length, 0);

  coordinator.start({
    loadingMessage: "Loading",
    resolve: async () => {
      providerCalls += 1;
      return "changed-start";
    },
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(providerCalls, 2);
  assert.equal(events.filter((event) => event.startsWith("loading:")).length, loadingCountBeforeReuse + 1);
});
