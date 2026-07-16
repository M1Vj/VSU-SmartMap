import test from "node:test";
import assert from "node:assert/strict";

import {
  clearRecentSearches,
  pushRecentSearch,
  readRecentSearches,
} from "./recent-searches.ts";

function storageWith(initial?: string) {
  const store = new Map<string, string>();
  if (initial !== undefined) {
    store.set("vsu-recent-searches", initial);
  }

  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };
}

test("pushRecentSearch dedupes selected places and caps history", () => {
  const storage = storageWith();

  const next = [
    { id: "admin", name: "Administration Building" },
    { id: "library", name: "University Library" },
    { id: "dstat", name: "Department of Statistics" },
    { id: "vetmed", name: "College of Veterinary Medicine" },
    { id: "gym", name: "VSU Gymnasium" },
    { id: "library", name: "University Library" },
  ].reduce(
    (history, item) => pushRecentSearch(storage, item, history),
    [] as ReturnType<typeof readRecentSearches>,
  );

  assert.deepEqual(
    next.map((item) => item.id),
    ["library", "gym", "vetmed", "dstat", "admin"],
  );
  assert.deepEqual(readRecentSearches(storage), next);
});

test("readRecentSearches ignores malformed stored history", () => {
  assert.deepEqual(readRecentSearches(storageWith("{bad json")), []);
  assert.deepEqual(
    readRecentSearches(storageWith(JSON.stringify([{ id: "ok", name: 123 }]))),
    [],
  );
});

test("clearRecentSearches removes stored search history", () => {
  const storage = storageWith(
    JSON.stringify([{ id: "library", name: "University Library" }]),
  );

  assert.equal(readRecentSearches(storage).length, 1);
  clearRecentSearches(storage);
  assert.deepEqual(readRecentSearches(storage), []);
});
