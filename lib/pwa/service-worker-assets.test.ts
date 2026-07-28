import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

test("service worker refreshes cached app icons with a new static cache", () => {
  const serviceWorker = readFileSync("public/sw.js", "utf8");

  assert.match(serviceWorker, /const CACHE_NAME = 'vsu-smartmap-v15';/);
  assert.match(serviceWorker, /'\/icons\/icon-192x192\.png\?v=20260709'/);
  assert.match(serviceWorker, /'\/icons\/icon-512x512\.png\?v=20260709'/);
  assert.doesNotMatch(serviceWorker, /'\/icons\/icon-192x192\.png'/);
  assert.doesNotMatch(serviceWorker, /'\/icons\/icon-512x512\.png'/);
});

test("service worker precaches the schedule shell", () => {
  const serviceWorker = readFileSync("public/sw.js", "utf8");

  assert.match(serviceWorker, /^\s*'\/schedule',$/m);
});

test("install settles with bounded deduplicated optional asset discovery", async () => {
  const listeners = new Map<string, (event: unknown) => void>();
  const fetchCounts = new Map<string, number>();
  const cachedUrls: string[] = [];
  const deletedCaches: string[] = [];
  const warnings: unknown[][] = [];
  let claimCalls = 0;
  const requiredHtml = [
    '<script src="/_next/static/chunks/shared.js"></script>',
    '<script src="/_next/static/chunks/shared.js"></script>',
    '<script src="/_next/static/chunks/missing.js"></script>',
    '<script src="/_next/static/chunks/hung.js"></script>',
  ].join("");
  const workerUrl = new URL("https://smartmap.test/sw.js?offline=1");
  class WorkerRequest extends Request {
    constructor(input: RequestInfo | URL, init?: RequestInit) {
      super(
        typeof input === "string" ? new URL(input, workerUrl.origin) : input,
        init,
      );
    }
  }
  const cache = {
    match: async () => undefined,
    put: async (request: Request, response: Response) => {
      assert.ok(response.ok);
      cachedUrls.push(request.url);
    },
  };
  const context = vm.createContext({
    URL,
    Request: WorkerRequest,
    Response,
    Headers,
    EventTarget,
    AbortController,
    setTimeout: (callback: () => void, timeout: number) =>
      setTimeout(callback, Math.min(timeout, 5)),
    clearTimeout,
    console: {
      warn: (...args: unknown[]) => warnings.push(args),
      error: (...args: unknown[]) => warnings.push(args),
    },
    fetch: async (request: Request) => {
      const url = new URL(request.url);
      fetchCounts.set(url.pathname, (fetchCounts.get(url.pathname) ?? 0) + 1);

      if (url.pathname.endsWith("/hung.js")) {
        return new Promise<Response>(() => undefined);
      }
      if (url.pathname.endsWith("/missing.js")) {
        return new Response("", { status: 404 });
      }
      if (url.pathname.startsWith("/_next/static/")) {
        return new Response("self.__chunkLoaded = true;", {
          headers: { "Content-Type": "application/javascript" },
        });
      }
      if (url.pathname === "/manifest.json" || url.pathname.startsWith("/icons/")) {
        return new Response("asset");
      }
      return new Response(requiredHtml, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    },
    caches: {
      open: async () => cache,
      match: async () => undefined,
      keys: async () => [
        "vsu-smartmap-v14",
        "vsu-smartmap-v15",
        "map-tiles-v1",
        "api-cache-v2",
      ],
      delete: async (cacheName: string) => {
        deletedCaches.push(cacheName);
        return true;
      },
    },
    self: {
      location: workerUrl,
      addEventListener: (type: string, listener: (event: unknown) => void) => {
        listeners.set(type, listener);
      },
      skipWaiting: () => undefined,
      clients: {
        claim: () => {
          claimCalls += 1;
        },
      },
      registration: { unregister: () => undefined },
    },
  });

  vm.runInContext(readFileSync("public/sw.js", "utf8"), context);

  let installPromise: Promise<unknown> | undefined;
  listeners.get("install")?.({
    waitUntil: (promise: Promise<unknown>) => {
      installPromise = promise;
    },
  });
  assert.ok(installPromise);

  const installOutcome = await Promise.race([
    installPromise.then(
      () => "fulfilled" as const,
      (error: unknown) => ({ status: "rejected" as const, error }),
    ),
    new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), 100)),
  ]);

  assert.equal(installOutcome, "fulfilled");
  assert.equal(fetchCounts.get("/_next/static/chunks/shared.js"), 1);
  assert.ok(cachedUrls.includes("https://smartmap.test/schedule"));
  assert.ok(cachedUrls.includes("https://smartmap.test/_next/static/chunks/shared.js"));
  assert.ok(!cachedUrls.includes("https://smartmap.test/_next/static/chunks/missing.js"));
  assert.ok(!cachedUrls.includes("https://smartmap.test/_next/static/chunks/hung.js"));
  assert.ok(warnings.length >= 2);

  let activatePromise: Promise<unknown> | undefined;
  listeners.get("activate")?.({
    waitUntil: (promise: Promise<unknown>) => {
      activatePromise = promise;
    },
  });
  assert.ok(activatePromise);
  await activatePromise;
  assert.deepEqual(deletedCaches, ["vsu-smartmap-v14"]);
  assert.equal(claimCalls, 1);
});

test("install rejects a hung required shell in bounded time", async () => {
  const listeners = new Map<string, (event: unknown) => void>();
  const cachedUrls: string[] = [];
  const errors: unknown[][] = [];
  const workerUrl = new URL("https://smartmap.test/sw.js?offline=1");
  class WorkerRequest extends Request {
    constructor(input: RequestInfo | URL, init?: RequestInit) {
      super(
        typeof input === "string" ? new URL(input, workerUrl.origin) : input,
        init,
      );
    }
  }
  const cache = {
    match: async () => undefined,
    put: async (request: Request, response: Response) => {
      assert.ok(response.ok);
      cachedUrls.push(request.url);
    },
  };
  const context = vm.createContext({
    URL,
    Request: WorkerRequest,
    Response,
    Headers,
    EventTarget,
    AbortController,
    setTimeout: (callback: () => void, timeout: number) =>
      setTimeout(callback, Math.min(timeout, 5)),
    clearTimeout,
    console: {
      warn: () => undefined,
      error: (...args: unknown[]) => errors.push(args),
    },
    fetch: async (request: Request) => {
      const url = new URL(request.url);
      if (url.pathname === "/schedule") {
        return new Promise<Response>(() => undefined);
      }
      if (url.pathname === "/manifest.json" || url.pathname.startsWith("/icons/")) {
        return new Response("asset");
      }
      return new Response("", {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    },
    caches: {
      open: async () => cache,
      match: async () => undefined,
      keys: async () => [],
      delete: async () => true,
    },
    self: {
      location: workerUrl,
      addEventListener: (type: string, listener: (event: unknown) => void) => {
        listeners.set(type, listener);
      },
      skipWaiting: () => undefined,
      clients: { claim: () => undefined },
      registration: { unregister: () => undefined },
    },
  });

  vm.runInContext(readFileSync("public/sw.js", "utf8"), context);

  let installPromise: Promise<unknown> | undefined;
  listeners.get("install")?.({
    waitUntil: (promise: Promise<unknown>) => {
      installPromise = promise;
    },
  });
  assert.ok(installPromise);

  const installOutcome = await Promise.race([
    installPromise.then(
      () => ({ status: "fulfilled" as const }),
      (error: unknown) => ({ status: "rejected" as const, error }),
    ),
    new Promise<{ status: "timeout" }>((resolve) =>
      setTimeout(() => resolve({ status: "timeout" }), 100),
    ),
  ]);

  assert.equal(installOutcome.status, "rejected");
  if (installOutcome.status === "rejected") {
    assert.match(
      String(installOutcome.error),
      /Failed to precache 1 required static asset/,
    );
  }
  assert.ok(cachedUrls.includes("https://smartmap.test/"));
  assert.ok(!cachedUrls.includes("https://smartmap.test/schedule"));
  assert.equal(errors.length, 1);
});

test("uncached static JavaScript returns an executable offline error response", async () => {
  const listeners = new Map<string, (event: unknown) => void>();
  const cache = {
    match: async () => undefined,
    put: async () => undefined,
  };
  const workerUrl = new URL("https://smartmap.test/sw.js");
  const context = vm.createContext({
    URL,
    Request,
    Response,
    Headers,
    EventTarget,
    setTimeout,
    fetch: async () => {
      throw new Error("offline");
    },
    caches: {
      open: async () => cache,
      match: async () => undefined,
      keys: async () => [],
    },
    self: {
      location: workerUrl,
      addEventListener: (type: string, listener: (event: unknown) => void) => {
        listeners.set(type, listener);
      },
      skipWaiting: () => undefined,
      clients: { claim: () => undefined },
      registration: { unregister: () => undefined },
    },
  });

  vm.runInContext(readFileSync("public/sw.js", "utf8"), context);

  let responsePromise: Promise<Response> | undefined;
  listeners.get("fetch")?.({
    request: new Request("https://smartmap.test/_next/static/chunks/schedule.js"),
    respondWith: (response: Promise<Response>) => {
      responsePromise = response;
    },
    waitUntil: () => undefined,
  });

  assert.ok(responsePromise);
  const response = await responsePromise;
  assert.ok(response instanceof Response);
  assert.equal(response.status, 503);
  assert.equal(response.statusText, "Service Unavailable");
  assert.equal(
    response.headers.get("Content-Type"),
    "application/javascript; charset=utf-8",
  );
  assert.equal(response.headers.get("Cache-Control"), "no-store");

  const body = await response.text();
  assert.doesNotThrow(() => new Function(body));
  assert.throws(
    () => new Function(body)(),
    /offline.*uncached code|uncached code.*offline/i,
  );
});
