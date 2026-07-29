import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  getFacilitySearchLoadError,
  updateFacilitySearchFailures,
} from "./facility-search-load-state";

test("a successful room query does not hide a persistent facility failure", () => {
  const facilityFailure = updateFacilitySearchFailures(
    { facilityFailed: false, roomFailed: true },
    { facilityFailed: true },
  );
  const successfulRoomRefresh = updateFacilitySearchFailures(
    facilityFailure,
    { roomFailed: false },
  );

  assert.deepEqual(successfulRoomRefresh, {
    facilityFailed: true,
    roomFailed: false,
  });
  assert.equal(
    getFacilitySearchLoadError(successfulRoomRefresh),
    "Search suggestions could not be refreshed.",
  );
});

test("room failure clears independently while facility success remains available", () => {
  const roomFailure = updateFacilitySearchFailures(
    { facilityFailed: false, roomFailed: false },
    { roomFailed: true },
  );
  const recovered = updateFacilitySearchFailures(roomFailure, {
    roomFailed: false,
  });

  assert.equal(getFacilitySearchLoadError(roomFailure), "Search suggestions could not be refreshed.");
  assert.equal(getFacilitySearchLoadError(recovered), null);
});

test("hook uses completion-aware facility availability and independent failure fields", async () => {
  const source = await readFile(
    new URL("./use-facility-search-data.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /getFacilityRequest\(\)\.getAvailable\(\)/);
  assert.match(source, /facilityFailed/);
  assert.match(source, /roomFailed/);
  assert.match(source, /getFacilitySearchLoadError/);
});
