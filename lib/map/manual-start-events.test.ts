import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("every manual-start completion dispatches the exact pending request", async () => {
  const source = await readFile(new URL("../../app/(student)/page.tsx", import.meta.url), "utf8");
  assert.equal((source.match(/resolveManualStart\(/g) ?? []).length >= 4, true);
  assert.equal((source.match(/resolveManualStart\([^\n]+, "live"\)/g) ?? []).length >= 2, true);
  assert.equal((source.match(/resolveManualStart\([^\n]+, "manual"\)/g) ?? []).length >= 2, true);
  assert.doesNotMatch(source, /pendingRequestId \?\? navigationSessionId/);
  assert.match(source, /const resolveManualStart = useCallback/);
  assert.match(source, /const pendingRequestId = runtime\.getState\(\)\.navigation\.pendingRequestId/);
  assert.match(source, /if \(pendingRequestId == null\) return/);
  assert.match(source, /const accepted =\s*next !== current[\s\S]{0,1000}return accepted;/);
  assert.match(source, /if \(resolveManualStart\(routeStart, "live"\)\) setManualLocationRequestPending\(false\)/);
  assert.match(source, /if \(resolveManualStart\(VSU_MAIN_GATE, "manual"\)\) setManualLocationRequestPending\(false\)/);
});
