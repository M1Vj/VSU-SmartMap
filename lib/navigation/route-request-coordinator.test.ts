import assert from "node:assert/strict";
import test from "node:test";

import { createRouteRequestCoordinator } from "./route-request-coordinator.ts";
import { createRouteAnnouncementTracker } from "./route-announcement.ts";

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
    clear: (options) => events.push(options?.preservePublishedResult ? "clear:preserve" : "clear"),
    publish: (route) => events.push(`publish:${route}`),
    loading: (_message, id) => events.push(`loading:${id}`),
    success: (_message, id) => events.push(`success:${id}`),
    error: (_message, id) => events.push(`error:${id}`),
    dismiss: (id) => events.push(`dismiss:${id}`),
    reportError: () => events.push("log"),
  });
  return { coordinator, events };
}

test("a replacement with no published route clears before resolving and silences delayed old success", async () => {
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

test("replacement preserves the last successful route until the new result publishes", async () => {
  const { coordinator, events } = harness();
  const replacement = deferred<string>();

  coordinator.start({ resolve: async () => "first route" });
  await new Promise((resolve) => setImmediate(resolve));

  coordinator.start({ loadingMessage: "Loading", resolve: () => replacement.promise });
  await Promise.resolve();

  assert.deepEqual(events.filter((event) => event.startsWith("clear")), ["clear", "clear:preserve"]);
  assert.deepEqual(events.filter((event) => event.startsWith("publish:")), ["publish:first route"]);

  replacement.resolve("replacement route");
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(events.filter((event) => event.startsWith("publish:")), [
    "publish:first route",
    "publish:replacement route",
  ]);
});

test("a failed replacement preserves the last successful route", async () => {
  const { coordinator, events } = harness();
  const replacement = deferred<string>();

  coordinator.start({ resolve: async () => "first route" });
  await new Promise((resolve) => setImmediate(resolve));

  coordinator.start({ resolve: () => replacement.promise });
  await Promise.resolve();
  replacement.reject(new Error("replacement failed"));
  await assert.rejects(replacement.promise);
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(events.filter((event) => event.startsWith("clear")), [
    "clear",
    "clear:preserve",
    "clear:preserve",
  ]);
  assert.deepEqual(events.filter((event) => event.startsWith("publish:")), ["publish:first route"]);
  assert.equal(events.filter((event) => event.startsWith("error:")).length, 1);
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

test("recalculations publish while a shared navigation session announces success only once", async () => {
  const { coordinator, events } = harness();
  const first = deferred<string>();
  const recalculation = deferred<string>();
  let successClaimed = false;
  const shouldAnnounceSuccess = () => {
    if (successClaimed) return false;
    successClaimed = true;
    return true;
  };
  const isSuccessAnnounced = () => successClaimed;

  coordinator.start({
    loadingMessage: "Loading",
    sessionId: 1,
    isSuccessAnnounced,
    shouldAnnounceSuccess,
    resolve: () => first.promise,
  });
  await Promise.resolve();
  first.resolve("first route");
  await new Promise((resolve) => setImmediate(resolve));

  coordinator.start({
    loadingMessage: "Loading",
    sessionId: 1,
    isSuccessAnnounced,
    shouldAnnounceSuccess,
    resolve: () => recalculation.promise,
  });
  await Promise.resolve();
  recalculation.resolve("recalculated route");
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(events.filter((event) => event.startsWith("success:")).length, 1);
  assert.deepEqual(events.filter((event) => event.startsWith("publish:")), [
    "publish:first route",
    "publish:recalculated route",
  ]);
  assert.equal(events.filter((event) => event.startsWith("loading:")).length, 1);
  assert.equal(events.filter((event) => event.startsWith("dismiss:")).length, 0);
});

test("an immediate same-session recalculation preserves the first success toast", async () => {
  const { coordinator, events } = harness();
  let successClaimed = false;
  const shouldAnnounceSuccess = () => {
    if (successClaimed) return false;
    successClaimed = true;
    return true;
  };
  const isSuccessAnnounced = () => successClaimed;

  coordinator.start({
    loadingMessage: "Loading",
    sessionId: 1,
    isSuccessAnnounced,
    shouldAnnounceSuccess,
    resolve: async () => "first route",
  });
  await new Promise((resolve) => setImmediate(resolve));

  const firstSuccessId = events
    .find((event) => event.startsWith("success:"))!
    .slice("success:".length);

  coordinator.start({
    loadingMessage: "Loading",
    sessionId: 1,
    isSuccessAnnounced,
    shouldAnnounceSuccess,
    resolve: async () => "recalculated route",
  });
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(events.filter((event) => event.startsWith("publish:")), [
    "publish:first route",
    "publish:recalculated route",
  ]);
  assert.equal(events.filter((event) => event.startsWith("loading:")).length, 1);
  assert.equal(events.filter((event) => event.startsWith("success:")).length, 1);
  assert.equal(events.filter((event) => event === `dismiss:${firstSuccessId}`).length, 0);
});

test("a tracked success survives silent recalculation and is dismissed once before a new session", async () => {
  const { coordinator, events } = harness();
  const tracker = createRouteAnnouncementTracker();
  const firstSession = 1;
  const firstClaim = () => tracker.claim(firstSession);
  const firstHasAnnouncement = () => tracker.has(firstSession);
  const firstRegister = (toastId: string) => tracker.register(firstSession, toastId);

  coordinator.start({
    loadingMessage: "Loading",
    sessionId: firstSession,
    isSuccessAnnounced: firstHasAnnouncement,
    shouldAnnounceSuccess: firstClaim,
    onSuccess: firstRegister,
    resolve: async () => "first route",
  });
  await new Promise((resolve) => setImmediate(resolve));

  const firstSuccessId = events
    .find((event) => event.startsWith("success:"))!
    .slice("success:".length);

  coordinator.start({
    loadingMessage: "Loading",
    sessionId: firstSession,
    isSuccessAnnounced: firstHasAnnouncement,
    shouldAnnounceSuccess: firstClaim,
    onSuccess: firstRegister,
    resolve: async () => "recalculated route",
  });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(events.filter((event) => event === `dismiss:${firstSuccessId}`).length, 0);
  assert.equal(events.filter((event) => event.startsWith("loading:")).length, 1);
  assert.equal(events.filter((event) => event.startsWith("success:")).length, 1);

  const trackedToastId = tracker.reset();
  assert.equal(trackedToastId, firstSuccessId);
  if (trackedToastId) events.push(`dismiss:${trackedToastId}`);

  const nextSession = 2;
  coordinator.start({
    loadingMessage: "Loading",
    sessionId: nextSession,
    isSuccessAnnounced: () => tracker.has(nextSession),
    shouldAnnounceSuccess: () => tracker.claim(nextSession),
    onSuccess: (toastId) => tracker.register(nextSession, toastId),
    resolve: async () => "new route",
  });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(events.filter((event) => event === `dismiss:${firstSuccessId}`).length, 1);
  assert.equal(events.filter((event) => event.startsWith("loading:")).length, 2);
  assert.equal(events.filter((event) => event.startsWith("success:")).length, 2);
});

test("resetting an in-flight session prevents its stale completion from reclaiming a toast", async () => {
  const { coordinator, events } = harness();
  const tracker = createRouteAnnouncementTracker();
  const route = deferred<string>();
  const sessionId = 1;

  coordinator.start({
    loadingMessage: "Loading",
    sessionId,
    isSuccessAnnounced: () => tracker.has(sessionId),
    shouldAnnounceSuccess: () => tracker.claim(sessionId),
    onSuccess: (toastId) => tracker.register(sessionId, toastId),
    resolve: () => route.promise,
  });
  await Promise.resolve();

  assert.equal(tracker.reset(sessionId), null);
  route.resolve("stale route");
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(events.filter((event) => event.startsWith("success:")).length, 0);
  assert.equal(tracker.has(sessionId), false);
  assert.equal(tracker.claim(sessionId), false);

  const nextSession = 2;
  coordinator.start({
    loadingMessage: "Loading",
    sessionId: nextSession,
    isSuccessAnnounced: () => tracker.has(nextSession),
    shouldAnnounceSuccess: () => tracker.claim(nextSession),
    onSuccess: (toastId) => tracker.register(nextSession, toastId),
    resolve: async () => "new route",
  });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(events.filter((event) => event.startsWith("success:")).length, 1);
});

test("a failed silent recalculation dismisses the tracked success before its error", async () => {
  const { coordinator, events } = harness();
  const tracker = createRouteAnnouncementTracker();
  const firstSession = 1;
  const recalculation = deferred<string>();
  const dismissTrackedSuccess = () => {
    const toastId = tracker.releaseToast();
    if (toastId) events.push(`dismiss:${toastId}`);
  };

  coordinator.start({
    loadingMessage: "Loading",
    sessionId: firstSession,
    isSuccessAnnounced: () => tracker.has(firstSession),
    shouldAnnounceSuccess: () => tracker.claim(firstSession),
    onSuccess: (toastId) => tracker.register(firstSession, toastId),
    resolve: async () => "first route",
  });
  await new Promise((resolve) => setImmediate(resolve));

  const firstSuccessId = events
    .find((event) => event.startsWith("success:"))!
    .slice("success:".length);

  coordinator.start({
    loadingMessage: "Loading",
    sessionId: firstSession,
    isSuccessAnnounced: () => tracker.has(firstSession),
    shouldAnnounceSuccess: () => tracker.claim(firstSession),
    onSuccess: (toastId) => tracker.register(firstSession, toastId),
    onError: dismissTrackedSuccess,
    resolve: () => recalculation.promise,
  });
  await Promise.resolve();

  recalculation.reject(new Error("recalculation failed"));
  await assert.rejects(recalculation.promise);
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(events.filter((event) => event === `dismiss:${firstSuccessId}`).length, 1);
  assert.equal(events.indexOf(`dismiss:${firstSuccessId}`) < events.lastIndexOf("clear:preserve"), true);
  assert.equal(events.filter((event) => event.startsWith("error:")).length, 1);
  assert.equal(tracker.has(firstSession), true);

  coordinator.start({
    loadingMessage: "Loading",
    sessionId: firstSession,
    isSuccessAnnounced: () => tracker.has(firstSession),
    shouldAnnounceSuccess: () => tracker.claim(firstSession),
    onSuccess: (toastId) => tracker.register(firstSession, toastId),
    resolve: async () => "recovered route",
  });
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(events.filter((event) => event.startsWith("publish:")), [
    "publish:first route",
    "publish:recovered route",
  ]);
  assert.equal(events.filter((event) => event.startsWith("success:")).length, 1);
});

test("a shared announcement gate survives coordinator remounts and a new session can succeed", async () => {
  const events: string[] = [];
  let announcedSession: string | null = null;
  const callbacks = {
    clear: () => events.push("clear"),
    publish: (route: string) => events.push(`publish:${route}`),
    loading: (_message: string, id: string) => events.push(`loading:${id}`),
    success: (_message: string, id: string) => events.push(`success:${id}`),
    error: (_message: string, id: string) => events.push(`error:${id}`),
    dismiss: (id: string) => events.push(`dismiss:${id}`),
  };
  const claimFor = (sessionId: string) => () => {
    if (announcedSession === sessionId) return false;
    announcedSession = sessionId;
    return true;
  };
  const isAnnouncedFor = (sessionId: string) => () => announcedSession === sessionId;

  const cleanupFirst = createRouteRequestCoordinator(callbacks).start({
    loadingMessage: "Loading",
    sessionId: 1,
    isSuccessAnnounced: isAnnouncedFor("navigation-one"),
    shouldAnnounceSuccess: claimFor("navigation-one"),
    resolve: async () => "first route",
  });
  await new Promise((resolve) => setImmediate(resolve));
  cleanupFirst();

  const cleanupAfterRemount = createRouteRequestCoordinator(callbacks).start({
    loadingMessage: "Loading",
    sessionId: 1,
    isSuccessAnnounced: isAnnouncedFor("navigation-one"),
    shouldAnnounceSuccess: claimFor("navigation-one"),
    resolve: async () => "route after remount",
  });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(events.filter((event) => event.startsWith("success:")).length, 1);
  assert.equal(events.filter((event) => event.startsWith("loading:")).length, 1);
  assert.equal(events.filter((event) => event.startsWith("dismiss:")).length, 0);
  cleanupAfterRemount();

  createRouteRequestCoordinator(callbacks).start({
    loadingMessage: "Loading",
    sessionId: 2,
    isSuccessAnnounced: isAnnouncedFor("navigation-two"),
    shouldAnnounceSuccess: claimFor("navigation-two"),
    resolve: async () => "new route",
  });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(events.filter((event) => event.startsWith("success:")).length, 2);
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

test("an explicit clear removes a previously published route", async () => {
  const { coordinator, events } = harness();

  coordinator.start({ resolve: async () => "route" });
  await new Promise((resolve) => setImmediate(resolve));
  coordinator.start({});

  assert.deepEqual(events.filter((event) => event.startsWith("publish:")), ["publish:route"]);
  assert.deepEqual(events.filter((event) => event.startsWith("clear")), ["clear", "clear"]);
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
