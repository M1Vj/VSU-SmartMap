import assert from "node:assert/strict";
import test from "node:test";
import type { Facility } from "@/lib/types/facility";
import {
  loadFacilitySearchFacilities,
  loadFacilitySearchRooms,
  startFacilitySearchFacilities,
  startFacilitySearchRooms,
  type SearchDataSource,
} from "./facility-search-loader";

const cachedFacility = {
  id: "cached",
  name: "Cached Hall",
} as Facility;

test("facilities publish cache before a deferred canonical empty remote result", async () => {
  let resolveRemote!: (value: { data: Facility[]; error: null }) => void;
  const remote = new Promise<{ data: Facility[]; error: null }>((resolve) => {
    resolveRemote = resolve;
  });
  const publications: Array<{ data: readonly Facility[]; source: SearchDataSource }> = [];
  const writes: Facility[][] = [];

  const loading = loadFacilitySearchFacilities({
    readCache: async () => [cachedFacility],
    writeCache: async (facilities) => {
      writes.push([...facilities]);
    },
    fetchRemote: async () => remote,
    publish: (data, source) => {
      publications.push({ data, source });
    },
  });

  await Promise.resolve();
  assert.deepEqual(publications, [{ data: [cachedFacility], source: "cache" }]);
  assert.deepEqual(writes, []);

  resolveRemote({ data: [], error: null });
  const result = await loading;

  assert.deepEqual(result, { data: [], source: "remote", failed: false });
  assert.deepEqual(publications, [
    { data: [cachedFacility], source: "cache" },
    { data: [], source: "remote" },
  ]);
  assert.deepEqual(writes, [[]]);
});

test("rooms trim queries and publish empty without remote fetch below two characters", async () => {
  let remoteCalls = 0;
  const publications: Array<{ data: readonly unknown[]; source: SearchDataSource }> = [];

  const result = await loadFacilitySearchRooms({
    query: " a ",
    readCache: async () => {
      throw new Error("cache should not be read");
    },
    fetchRemote: async () => {
      remoteCalls += 1;
      return { data: [], error: null };
    },
    publish: (data, source) => {
      publications.push({ data, source });
    },
  });

  assert.deepEqual(result, { data: [], source: "empty", failed: false });
  assert.equal(remoteCalls, 0);
  assert.deepEqual(publications, [{ data: [], source: "empty" }]);
});

test("facilities return cached data when the remote refresh fails", async () => {
  const publications: Array<{ data: readonly Facility[]; source: SearchDataSource }> = [];

  const result = await loadFacilitySearchFacilities({
    readCache: async () => [cachedFacility],
    writeCache: async () => {
      throw new Error("failed refresh must not write cache");
    },
    fetchRemote: async () => ({ data: null, error: new Error("offline") }),
    publish: (data, source) => {
      publications.push({ data, source });
    },
  });

  assert.deepEqual(result, {
    data: [cachedFacility],
    source: "cache",
    failed: true,
  });
  assert.deepEqual(publications, [{ data: [cachedFacility], source: "cache" }]);
});

test("facility request exposes cached data before its deferred refresh settles", async () => {
  let resolveRemote!: (value: { data: Facility[]; error: null }) => void;
  const remote = new Promise<{ data: Facility[]; error: null }>((resolve) => {
    resolveRemote = resolve;
  });
  const request = startFacilitySearchFacilities({
    readCache: async () => [cachedFacility],
    writeCache: async () => {},
    fetchRemote: async () => remote,
  });

  assert.deepEqual(await request.available, [cachedFacility]);
  let completed = false;
  void request.complete.then(() => {
    completed = true;
  });
  await Promise.resolve();
  assert.equal(completed, false);

  resolveRemote({ data: [], error: null });
  assert.deepEqual(await request.complete, {
    data: [],
    source: "remote",
    failed: false,
  });
});

test("facility request availability advances from cache to the completed canonical remote result", async () => {
  let resolveRemote!: (value: { data: Facility[]; error: null }) => void;
  const remote = new Promise<{ data: Facility[]; error: null }>((resolve) => {
    resolveRemote = resolve;
  });
  const request = startFacilitySearchFacilities({
    readCache: async () => [cachedFacility],
    writeCache: async () => {},
    fetchRemote: async () => remote,
  });

  assert.deepEqual(await request.getAvailable(), [cachedFacility]);

  resolveRemote({ data: [], error: null });
  await request.complete;

  assert.deepEqual(await request.getAvailable(), []);
  assert.deepEqual(request.getCurrent(), { data: [], source: "remote" });
  assert.equal(request.isComplete(), true);
});

test("thrown facility refresh failure reports failure while preserving cached data", async () => {
  const result = await loadFacilitySearchFacilities({
    readCache: async () => [cachedFacility],
    writeCache: async () => {},
    fetchRemote: async () => {
      throw new Error("offline");
    },
    publish: () => {},
  });

  assert.deepEqual(result, {
    data: [cachedFacility],
    source: "cache",
    failed: true,
  });
});

test("room result errors report failure and publish empty without cache", async () => {
  const publications: Array<{ data: readonly unknown[]; source: SearchDataSource }> = [];
  const result = await loadFacilitySearchRooms({
    query: "ab",
    readCache: async () => null,
    fetchRemote: async () => ({ data: null, error: new Error("offline") }),
    publish: (data, source) => publications.push({ data, source }),
  });

  assert.deepEqual(result, { data: [], source: "empty", failed: true });
  assert.deepEqual(publications, [{ data: [], source: "empty" }]);
});

test("cache write failure does not discard a successful canonical remote result", async () => {
  const remoteFacility = { id: "remote", name: "Remote Hall" } as Facility;
  const publications: Array<{ data: readonly Facility[]; source: SearchDataSource }> = [];
  const result = await loadFacilitySearchFacilities({
    readCache: async () => [cachedFacility],
    writeCache: async () => {
      throw new Error("quota exceeded");
    },
    fetchRemote: async () => ({ data: [remoteFacility], error: null }),
    publish: (data, source) => publications.push({ data, source }),
  });

  assert.deepEqual(result, {
    data: [remoteFacility],
    source: "remote",
    failed: false,
  });
  assert.deepEqual(publications, [
    { data: [cachedFacility], source: "cache" },
    { data: [remoteFacility], source: "remote" },
  ]);
});

test("room request publishes the current query with cached options before deferred remote completion", async () => {
  const cachedRoom = { id: "cached-room", name: "Cached Room" };
  let resolveRemote!: (value: { data: typeof cachedRoom[]; error: null }) => void;
  const remote = new Promise<{ data: typeof cachedRoom[]; error: null }>((resolve) => {
    resolveRemote = resolve;
  });
  const publications: Array<{
    query: string;
    data: typeof cachedRoom[];
    source: SearchDataSource;
  }> = [];

  const request = startFacilitySearchRooms({
    query: "  Cached Hall ",
    readCache: async () => [cachedRoom],
    fetchRemote: async () => remote,
  });
  request.subscribe((publication) => publications.push(publication));

  assert.deepEqual(await request.available, {
    query: "  Cached Hall ",
    data: [cachedRoom],
    source: "cache",
  });
  assert.deepEqual(publications, [{
    query: "  Cached Hall ",
    data: [cachedRoom],
    source: "cache",
  }]);

  let completed = false;
  void request.complete.then(() => {
    completed = true;
  });
  await Promise.resolve();
  assert.equal(completed, false);

  resolveRemote({ data: [], error: null });
  assert.deepEqual(await request.complete, {
    data: [],
    source: "remote",
    failed: false,
  });
  assert.deepEqual(publications.at(-1), {
    query: "  Cached Hall ",
    data: [],
    source: "remote",
  });
});

test("one facility lifecycle request is reusable across query-dependent room refreshes", async () => {
  let facilityFetches = 0;
  let roomFetches = 0;
  const facilityRequest = startFacilitySearchFacilities({
    readCache: async () => [cachedFacility],
    writeCache: async () => {},
    fetchRemote: async () => {
      facilityFetches += 1;
      return { data: [cachedFacility], error: null };
    },
  });

  const loadRooms = (query: string) => startFacilitySearchRooms({
    query,
    readCache: async () => [],
    fetchRemote: async () => {
      roomFetches += 1;
      return { data: [], error: null };
    },
  }).complete;

  await Promise.all([
    facilityRequest.complete,
    loadRooms("first"),
    loadRooms("second"),
  ]);

  assert.equal(facilityFetches, 1);
  assert.equal(roomFetches, 2);
});
