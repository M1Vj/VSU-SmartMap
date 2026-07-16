import test from "node:test";
import assert from "node:assert/strict";

import { getServiceWorkerMode, getServiceWorkerUrl } from "./service-worker.ts";

test("getServiceWorkerMode registers only in production", () => {
  assert.equal(getServiceWorkerMode("production"), "register");
  assert.equal(getServiceWorkerMode("development"), "unregister");
  assert.equal(getServiceWorkerMode("test"), "unregister");
  assert.equal(getServiceWorkerMode(undefined), "unregister");
});

test("getServiceWorkerUrl enables localhost offline preview only when requested", () => {
  assert.equal(getServiceWorkerUrl("true", "localhost"), "/sw.js?offline=1");
  assert.equal(getServiceWorkerUrl("true", "127.0.0.1"), "/sw.js?offline=1");
  assert.equal(getServiceWorkerUrl(undefined, "localhost"), "/sw.js");
  assert.equal(getServiceWorkerUrl("true", "vsu-smartmap.example"), "/sw.js");
});
