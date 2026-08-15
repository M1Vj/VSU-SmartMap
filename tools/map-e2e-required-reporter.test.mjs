import assert from "node:assert/strict";
import test from "node:test";

import RequiredMapE2EReporter from "./map-e2e-required-reporter.mjs";

test("required map E2E reporter fails the run for fixture-blocked rows", async () => {
  const reporter = new RequiredMapE2EReporter();
  reporter.onTestEnd(
    { title: "route fixture", annotations: [{ type: "blocked", description: "required fixture is absent" }] },
    { status: "skipped", annotations: [] },
  );
  const outcome = await reporter.onEnd({ status: "passed" });
  assert.equal(outcome?.status, "failed");
});
test("required map E2E reporter fails closed and prints external capability blocks", async () => {
  const reporter = new RequiredMapE2EReporter();
  reporter.onTestEnd(
    { title: "background lifecycle", annotations: [{ type: "external-blocked", description: "hardware capability unavailable" }] },
    { status: "skipped", annotations: [] },
  );
  const outcome = await reporter.onEnd({ status: "passed" });
  assert.equal(outcome?.status, "failed");
});
