import assert from "node:assert/strict";
import test from "node:test";

import { createRouteRequestCoordinator } from "./route-request-coordinator.ts";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function harness() {
  const events: string[] = [];
  const coordinator = createRouteRequestCoordinator<string>({
    clear: () => events.push("clear"),
    publish: (route) => events.push(`publish:${route}`),
    loading: (_message, id) => events.push(`loading:${id}`),
    success: (_message, id) => events.push(`success:${id}`),
    error: (_message, id) => events.push(`error:${id}`),
    dismiss: (id) => events.push(`dismiss:${id}`),
    reportError: () => events.push("log"),
  });
  return { coordinator, events };
}

test("replacement clears immediately, forwards a signal, and silences delayed old success", async () => {
  const { coordinator, events } = harness();
  const first = deferred<string>();
  const second = deferred<string>();
  let firstSignal: AbortSignal | undefined;
  let secondSignal: AbortSignal | undefined;

  coordinator.start({
    loadingMessage: "Loading",
    resolve: (signal) => {
      firstSignal = signal;
      return first.promise;
    },
  });
  await Promise.resolve();
  coordinator.start({
    loadingMessage: "Loading",
    resolve: (signal) => {
      secondSignal = signal;
      return second.promise;
    },
  });
  await Promise.resolve();

  assert.equal(firstSignal?.aborted, true);
  assert.equal(secondSignal?.aborted, false);
  assert.deepEqual(events.filter((event) => event === "clear"), ["clear", "clear"]);

  first.resolve("old");
  second.resolve("new");
  await Promise.all([first.promise, second.promise]);
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(events.filter((event) => event.startsWith("publish:")), ["publish:new"]);
});

test("delayed old failure cannot clear or show an error after replacement", async () => {
  const { coordinator, events } = harness();
  const first = deferred<string>();
  const second = deferred<string>();

  coordinator.start({ loadingMessage: "Loading", resolve: () => first.promise });
  await Promise.resolve();
  coordinator.start({ loadingMessage: "Loading", resolve: () => second.promise });
  const eventCountAfterReplacement = events.length;

  first.reject(new Error("old failure"));
  await assert.rejects(first.promise);
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(events.slice(eventCountAfterReplacement), []);
});

test("active failure clears and shows an error", async () => {
  const { coordinator, events } = harness();
  const route = deferred<string>();

  coordinator.start({ loadingMessage: "Loading", resolve: () => route.promise });
  await Promise.resolve();
  route.reject(new Error("active failure"));
  await assert.rejects(route.promise);
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(events.filter((event) => event === "clear").length, 2);
  assert.equal(events.filter((event) => event.startsWith("error:")).length, 1);
});

test("cleanup aborts and dismisses only its owned loading toast", async () => {
  const { coordinator, events } = harness();
  let firstSignal: AbortSignal | undefined;
  let secondSignal: AbortSignal | undefined;
  const never = new Promise<string>(() => {});

  const cleanupFirst = coordinator.start({
    loadingMessage: "First",
    resolve: (signal) => {
      firstSignal = signal;
      return never;
    },
  });
  await Promise.resolve();
  const cleanupSecond = coordinator.start({
    loadingMessage: "Second",
    resolve: (signal) => {
      secondSignal = signal;
      return never;
    },
  });
  await Promise.resolve();
  const loadingIds = events
    .filter((event) => event.startsWith("loading:"))
    .map((event) => event.slice("loading:".length));

  assert.equal(firstSignal?.aborted, true);
  assert.equal(new Set(loadingIds).size, 2);
  cleanupFirst();
  assert.equal(secondSignal?.aborted, false);
  assert.equal(events.filter((event) => event === `dismiss:${loadingIds[1]}`).length, 0);

  cleanupSecond();
  assert.equal(secondSignal?.aborted, true);
  assert.equal(events.filter((event) => event === `dismiss:${loadingIds[1]}`).length, 1);
});

test("an empty transition clears and dismisses the previous owned loading toast", () => {
  const { coordinator, events } = harness();
  const never = new Promise<string>(() => {});

  coordinator.start({ loadingMessage: "Waiting", resolve: () => never });
  const loadingId = events.find((event) => event.startsWith("loading:"))!.slice("loading:".length);
  coordinator.start({});

  assert.equal(events.filter((event) => event === "clear").length, 2);
  assert.equal(events.filter((event) => event === `dismiss:${loadingId}`).length, 1);
});

test("immediate cleanup prevents the canceled resolver from being called", async () => {
  const { coordinator } = harness();
  let resolveCalls = 0;

  const cleanup = coordinator.start({
    loadingMessage: "Loading",
    resolve: async () => {
      resolveCalls += 1;
      return "route";
    },
  });
  cleanup();
  await Promise.resolve();

  assert.equal(resolveCalls, 0);
});

test("immediate replacement prevents the replaced resolver from being called", async () => {
  const { coordinator } = harness();
  let firstResolveCalls = 0;
  let secondResolveCalls = 0;

  coordinator.start({
    resolve: async () => {
      firstResolveCalls += 1;
      return "old";
    },
  });
  coordinator.start({
    resolve: async () => {
      secondResolveCalls += 1;
      return "new";
    },
  });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(firstResolveCalls, 0);
  assert.equal(secondResolveCalls, 1);
});

for (const terminal of ["success", "error"] as const) {
  test(`${terminal} toast is dismissed when a new loading request replaces it`, async () => {
    const { coordinator, events } = harness();
    if (terminal === "success") {
      coordinator.start({ loadingMessage: "Loading", resolve: async () => "route" });
    } else {
      coordinator.start({
        loadingMessage: "Loading",
        resolve: async () => {
          throw new Error("failure");
        },
      });
    }
    await new Promise((resolve) => setImmediate(resolve));
    const terminalId = events
      .find((event) => event.startsWith(`${terminal}:`))!
      .slice(`${terminal}:`.length);

    coordinator.start({ loadingMessage: "Next" });

    assert.equal(events.filter((event) => event === `dismiss:${terminalId}`).length, 1);
  });
}

test("unmount cleanup dismisses an owned terminal toast", async () => {
  const { coordinator, events } = harness();
  const cleanup = coordinator.start({
    loadingMessage: "Loading",
    resolve: async () => "route",
  });
  await new Promise((resolve) => setImmediate(resolve));
  const successId = events.find((event) => event.startsWith("success:"))!.slice("success:".length);

  cleanup();

  assert.equal(events.filter((event) => event === `dismiss:${successId}`).length, 1);
});
