import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./app-logging-provider.tsx", import.meta.url), "utf8");

test("client logging never captures visible labels, form identifiers, referrers, or full console arguments", () => {
  assert.doesNotMatch(source, /\.textContent/);
  assert.doesNotMatch(source, /target\?\.id|getAttribute\(["']aria-label["']\)/);
  assert.doesNotMatch(source, /document\.referrer/);
  assert.doesNotMatch(source, /metadata:\s*\{\s*args:/);
  assert.doesNotMatch(source, /String\(item\)/);
});

test("client logging records only coarse interaction and error context", () => {
  assert.match(source, /category:\s*["']ui\.interaction["']/);
  assert.match(source, /metadata:\s*\{\s*tag,\s*action,\s*route:/);
  assert.match(source, /errorType/);
  assert.match(source, /argumentCount/);
});

test("pagehide uses the same named listener for registration and cleanup", () => {
  assert.match(source, /const onPageHide\s*=.*flush/);
  assert.match(source, /addEventListener\(["']pagehide["'],\s*onPageHide\)/);
  assert.match(source, /removeEventListener\(["']pagehide["'],\s*onPageHide\)/);
});

test("delivery retries transient responses with bounded events and exponential delay", () => {
  assert.match(source, /response\.status === 429 \|\| response\.status >= 500/);
  assert.match(source, /retryAttemptRef\.current <= MAX_RETRY_ATTEMPTS/);
  assert.match(source, /events\.slice\(-MAX_RETRY_EVENTS\)/);
  assert.match(source, /FLUSH_DELAY_MS \* \(2 \*\* retryAttemptRef\.current\)/);
  assert.match(source, /if \(queueRef\.current\.length > 0\)/);
});

test("local browser sessions do not send remote telemetry", () => {
  assert.match(source, /isLocalHostname\(window\.location\.hostname\)/);
});
