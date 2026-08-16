import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

test("service worker refreshes cached app icons with a new static cache", () => {
  const serviceWorker = readFileSync("public/sw.js", "utf8");

  assert.match(serviceWorker, /const CACHE_NAME = 'vsu-smartmap-v17';/);
  assert.match(serviceWorker, /'\/icons\/icon-192x192\.png\?v=20260709'/);
  assert.match(serviceWorker, /'\/icons\/icon-512x512\.png\?v=20260709'/);
  assert.doesNotMatch(serviceWorker, /'\/icons\/icon-192x192\.png'/);
  assert.doesNotMatch(serviceWorker, /'\/icons\/icon-512x512\.png'/);
});

test("service worker precaches the schedule shell", () => {
  const serviceWorker = readFileSync("public/sw.js", "utf8");

  assert.match(serviceWorker, /^\s*'\/schedule',$/m);
});

test("Supabase Auth requests are network-only without matching lookalike hosts or paths", async () => {
  const listeners = new Map<string, (event: unknown) => void>();
  const workerUrl = new URL("https://smartmap.test/sw.js");
  const fetchedUrls: string[] = [];
  const cacheMatchUrls: string[] = [];
  const context = vm.createContext({
    URL,
    Request,
    Response,
    Headers,
    EventTarget,
    AbortController,
    setTimeout,
    clearTimeout,
    console,
    fetch: async (request: Request) => {
      fetchedUrls.push(request.url);
      return new Response("network");
    },
    caches: {
      open: async () => ({
        match: async (request: Request) => {
          cacheMatchUrls.push(request.url);
          return new Response("cached");
        },
        put: async () => undefined,
        keys: async () => [],
      }),
      match: async (request: Request) => {
        cacheMatchUrls.push(request.url);
        return new Response("cached");
      },
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

  const dispatchFetch = async (url: string) => {
    let responsePromise: Promise<Response> | undefined;
    listeners.get("fetch")?.({
      request: new Request(url),
      respondWith: (response: Promise<Response>) => {
        responsePromise = response;
      },
      waitUntil: () => undefined,
    });
    assert.ok(responsePromise);
    return responsePromise;
  };

  const authUrl = "https://project-ref.supabase.co/auth/v1/token?grant_type=pkce";
  assert.equal(await (await dispatchFetch(authUrl)).text(), "network");
  assert.deepEqual(cacheMatchUrls, []);
  assert.deepEqual(fetchedUrls, [authUrl]);

  const lookalikeHostUrl =
    "https://project-ref.supabase.co.attacker.example/auth/v1/token";
  assert.equal(await (await dispatchFetch(lookalikeHostUrl)).text(), "cached");
  assert.deepEqual(cacheMatchUrls, [lookalikeHostUrl]);

  const lookalikePathUrl = "https://cdn.example/supabase.co/auth/v1/token";
  assert.equal(await (await dispatchFetch(lookalikePathUrl)).text(), "cached");
  assert.deepEqual(cacheMatchUrls, [lookalikeHostUrl, lookalikePathUrl]);
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
  const currentCsp = "default-src 'self'; connect-src 'self' https://server.arcgisonline.com https://tiles.openfreemap.org https://tile.openstreetmap.org https://a.basemaps.cartocdn.com; img-src 'self' blob: data: https:";
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
    keys: async () => [],
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
        headers: {
          "Content-Security-Policy": currentCsp,
          "Content-Type": "text/html; charset=utf-8",
        },
      });
    },
    caches: {
      open: async () => cache,
      match: async () => undefined,
      keys: async () => [
        "vsu-smartmap-v14",
        "vsu-smartmap-v15",
        "vsu-smartmap-v16",
        "vsu-smartmap-v17",
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
  assert.deepEqual(deletedCaches, [
    "vsu-smartmap-v14",
    "vsu-smartmap-v15",
    "vsu-smartmap-v16",
    "map-tiles-v1",
    "api-cache-v2",
  ]);
  assert.ok(!deletedCaches.includes("vsu-smartmap-v17"));
  assert.equal(claimCalls, 1);

  let documentResponsePromise: Promise<Response> | undefined;
  listeners.get("fetch")?.({
    request: new WorkerRequest("https://smartmap.test/"),
    respondWith: (response: Promise<Response>) => {
      documentResponsePromise = response;
    },
    waitUntil: () => undefined,
  });
  assert.ok(documentResponsePromise);
  const reloadedDocument = await documentResponsePromise;
  assert.equal(reloadedDocument.headers.get("Content-Security-Policy"), currentCsp);
  assert.equal(fetchCounts.get("/"), 2);
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

test("map tile failures stay network errors for the MapWrapper fallback", async () => {
  const listeners = new Map<string, (event: unknown) => void>();
  const fetchedUrls: string[] = [];
  const workerUrl = new URL("https://smartmap.test/sw.js");
  const cache = {
    match: async () => undefined,
    delete: async () => true,
    put: async () => undefined,
    keys: async () => [],
  };
  const context = vm.createContext({
    URL,
    Request,
    Response,
    Headers,
    EventTarget,
    AbortController,
    setTimeout,
    clearTimeout,
    console,
    fetch: async (request: Request | string) => {
      const url = new URL(typeof request === "string" ? request : request.url);
      fetchedUrls.push(url.toString());
      throw new Error(`${url.hostname} unavailable`);
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

  const dispatchFetch = async (url: string) => {
    let responsePromise: Promise<Response> | undefined;
    listeners.get("fetch")?.({
      request: new Request(url),
      respondWith: (response: Promise<Response>) => {
        responsePromise = response;
      },
      waitUntil: () => undefined,
    });
    assert.ok(responsePromise);
    return responsePromise;
  };

  const baseUrl = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/17/12345/67890";
  const baseResponse = await dispatchFetch(baseUrl);
  assert.equal(baseResponse?.status, 0);
  assert.deepEqual(fetchedUrls, [baseUrl]);

  const referenceUrl =
    "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/17/12345/67890";
  const referenceResponse = await dispatchFetch(referenceUrl);
  assert.equal(referenceResponse?.status, 0);
  assert.deepEqual(fetchedUrls, [baseUrl, referenceUrl]);
});

test("tile cache upgrades migrate usable v1 entries before retiring v1", async () => {
  const listeners = new Map<string, (event: unknown) => void>();
  const workerUrl = new URL("https://smartmap.test/sw.js");
  const validTileUrl = "https://tile.openstreetmap.org/17/67890/12345.png";
  const poisonedTileUrl = "https://tile.openstreetmap.org/17/67890/12346.png";
  const nonTileUrl = "https://tiles.openfreemap.org/styles/liberty";
  const migratedUrls: string[] = [];
  const deletedCaches: Array<{ name: string; migratedUrls: string[] }> = [];
  const v1Entries = new Map<string, Response>([
    [validTileUrl, new Response("valid-v1-tile", { status: 200 })],
    [poisonedTileUrl, new Response(null, { status: 204 })],
    [nonTileUrl, new Response("style-json", { status: 200 })],
  ]);
  const v2Entries = new Map<string, Response>();
  for (let index = 0; index < 400; index += 1) {
    v2Entries.set(
      `https://tile.openstreetmap.org/16/0/${index}.png`,
      new Response(`existing-v2-${index}`, { status: 200 }),
    );
  }
  const v1Cache = {
    keys: async () => [...v1Entries.keys()].map((url) => new Request(url)),
    match: async (request: Request) => v1Entries.get(request.url)?.clone(),
  };
  const v2Cache = {
    keys: async () => [...v2Entries.keys()].map((url) => new Request(url)),
    match: async (request: Request) => v2Entries.get(request.url)?.clone(),
    delete: async (request: Request) => v2Entries.delete(request.url),
    put: async (request: Request, response: Response) => {
      migratedUrls.push(request.url);
      v2Entries.set(request.url, response.clone());
    },
  };
  const cacheByName = new Map([
    ["map-tiles-v1", v1Cache],
    ["map-tiles-v2", v2Cache],
  ]);
  const context = vm.createContext({
    URL,
    Request,
    Response,
    Headers,
    EventTarget,
    AbortController,
    setTimeout,
    clearTimeout,
    console,
    fetch: async () => {
      throw new Error("offline");
    },
    caches: {
      open: async (name: string) => cacheByName.get(name) ?? v2Cache,
      match: async () => undefined,
      keys: async () => ["vsu-smartmap-v16", "vsu-smartmap-v17", "map-tiles-v1", "map-tiles-v2"],
      delete: async (name: string) => {
        deletedCaches.push({ name, migratedUrls: [...migratedUrls] });
        return true;
      },
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

  let activatePromise: Promise<unknown> | undefined;
  listeners.get("activate")?.({
    waitUntil: (promise: Promise<unknown>) => {
      activatePromise = promise;
    },
  });
  assert.ok(activatePromise);
  await activatePromise;

  assert.deepEqual(migratedUrls, [validTileUrl]);
  assert.ok(v2Entries.has(validTileUrl));
  assert.ok(!v2Entries.has(poisonedTileUrl));
  assert.ok(!v2Entries.has(nonTileUrl));
  assert.ok(v2Entries.size <= 400);
  assert.deepEqual(deletedCaches, [
    { name: "vsu-smartmap-v16", migratedUrls: [validTileUrl] },
    { name: "map-tiles-v1", migratedUrls: [validTileUrl] },
  ]);

  let responsePromise: Promise<Response> | undefined;
  listeners.get("fetch")?.({
    request: new Request(validTileUrl),
    respondWith: (response: Promise<Response>) => {
      responsePromise = response;
    },
    waitUntil: () => undefined,
  });
  assert.ok(responsePromise);
  const offlineResponse = await responsePromise;
  assert.equal(offlineResponse.status, 200);
  assert.equal(await offlineResponse.text(), "valid-v1-tile");
});

test("tile cache stores verifiable responses, keeps them offline, and rejects opaque entries", async () => {
  const listeners = new Map<string, (event: unknown) => void>();
  const workerUrl = new URL("https://smartmap.test/sw.js");
  const tileUrl = "https://tile.openstreetmap.org/17/67890/12345.png";
  const opaqueResponse = {
    status: 0,
    ok: false,
    type: "opaque",
    clone() {
      return this;
    },
  };
  const cacheEntries = new Map<string, Response | typeof opaqueResponse>();
  let networkResponse: Response | typeof opaqueResponse = new Response("fresh-tile", { status: 200 });
  let offline = false;
  let deleteCount = 0;
  let cachePutCount = 0;
  const waitUntilPromises: Promise<unknown>[] = [];
  const cache = {
    match: async (request: Request) =>
      cacheEntries.get(request.url)?.clone(),
    delete: async () => {
      deleteCount += 1;
      return true;
    },
    put: async (request: Request, response: Response) => {
      cachePutCount += 1;
      cacheEntries.set(request.url, response.clone());
    },
    keys: async () => [],
  };
  const context = vm.createContext({
    URL,
    Request,
    Response,
    Headers,
    EventTarget,
    AbortController,
    setTimeout,
    clearTimeout,
    console,
    fetch: async () => {
      if (offline) throw new Error("offline");
      return networkResponse;
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

  const dispatchFetch = async () => {
    waitUntilPromises.length = 0;
    let responsePromise: Promise<Response> | undefined;
    listeners.get("fetch")?.({
      request: new Request(tileUrl),
      respondWith: (response: Promise<Response>) => {
        responsePromise = response;
      },
      waitUntil: (promise: Promise<unknown>) => {
        waitUntilPromises.push(promise);
      },
    });
    assert.ok(responsePromise);
    const response = await responsePromise;
    await Promise.all(waitUntilPromises);
    return response;
  };

  const networkTile = await dispatchFetch();
  assert.equal(networkTile.status, 200);
  assert.equal(await networkTile.text(), "fresh-tile");
  assert.equal(cachePutCount, 1);

  offline = true;
  const offlineTile = await dispatchFetch();
  assert.equal(offlineTile.status, 200);
  assert.equal(await offlineTile.text(), "fresh-tile");

  offline = false;
  networkResponse = opaqueResponse;
  cacheEntries.delete(tileUrl);
  const opaqueNetworkTile = await dispatchFetch();
  assert.equal(opaqueNetworkTile, opaqueResponse);
  assert.equal(cachePutCount, 1);

  offline = true;
  cacheEntries.set(tileUrl, opaqueResponse);
  const opaqueOfflineTile = await dispatchFetch();
  assert.equal(opaqueOfflineTile.status, 0);
  assert.equal(deleteCount, 1);
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
