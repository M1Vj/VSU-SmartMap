import assert from "node:assert/strict";
import test from "node:test";
import type { Facility } from "@/lib/types/facility";
import {
  loadFacilitySearchFacilities,
  loadFacilitySearchRooms,
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

  assert.deepEqual(result, []);
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

  assert.deepEqual(result, []);
  assert.equal(remoteCalls, 0);
  assert.deepEqual(publications, [{ data: [], source: "empty" }]);
});
