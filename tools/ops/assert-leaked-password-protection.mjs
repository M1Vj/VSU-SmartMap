#!/usr/bin/env node
// Drift guard for leaked-password protection (issue #60). Complements
// tools/ops/enable-leaked-password-protection.mjs: repository mode (default)
// keeps the enablement tool, runbook, and CI wiring mutually consistent and
// rejects attempts to carry the hosted-only flag in supabase/config.toml;
// --live mode additionally reads the hosted auth config and fails if the
// setting is off. Never prints configuration values (password-named fields
// are treated as sensitive), and skips the live check without operator
// secrets so fork pull requests stay green until enforcement is wired up.
//
// Usage:
//   node tools/ops/assert-leaked-password-protection.mjs            # repo mode
//   SUPABASE_ACCESS_TOKEN=... SUPABASE_PROJECT_REF=... \
//     node tools/ops/assert-leaked-password-protection.mjs --live   # + hosted

import { readFile } from "node:fs/promises";

const TOOL_PATH = "tools/ops/enable-leaked-password-protection.mjs";
const GUARD_NAME = "tools/ops/assert-leaked-password-protection.mjs";
const RUNBOOK_PATH = "docs/runbooks/supabase-auth-hardening.md";
const WORKFLOW_PATH = ".github/workflows/security.yml";
const CONFIG_PATH = "supabase/config.toml";
const FLAG = "password_hibp_enabled";

const failures = [];
function fail(message) {
  failures.push(message);
}

async function assertContains(path, needles) {
  let text;
  try {
    text = await readFile(path, "utf8");
  } catch {
    fail(`${path}: required file is missing`);
    return;
  }
  for (const needle of needles) {
    if (!text.includes(needle)) {
      fail(`${path}: expected content drifted: "${needle}"`);
    }
  }
}

// The enablement tool must still PATCH the flag to true via the management API.
await assertContains(TOOL_PATH, [
  "https://api.supabase.com/v1/projects/",
  `JSON.stringify({ ${FLAG}: true })`,
  "Missing SUPABASE_ACCESS_TOKEN",
]);

// The runbook must keep describing the same tool, flag, and issue.
await assertContains(RUNBOOK_PATH, [
  "Issue: #60",
  TOOL_PATH,
  GUARD_NAME,
  FLAG,
  "Prevent use of leaked passwords",
]);

// CI must keep wiring the guard in, including the live hosted assertion.
await assertContains(WORKFLOW_PATH, [
  "leaked-password-protection",
  GUARD_NAME,
  "--live",
]);

// The flag is hosted-project configuration only; it must not appear in the
// local config.toml, where it would silently do nothing.
try {
  const configToml = await readFile(CONFIG_PATH, "utf8");
  if (configToml.includes(FLAG)) {
    fail(`${CONFIG_PATH}: ${FLAG} does not apply to local stacks; remove it`);
  }
} catch {
  fail(`${CONFIG_PATH}: required file is missing`);
}

const wantsLive = process.argv.includes("--live");
if (wantsLive) {
  const token = process.env.SUPABASE_ACCESS_TOKEN ?? "";
  const projectRef = process.env.SUPABASE_PROJECT_REF ?? "";
  if (!token || !projectRef) {
    console.log(
      "Live drift check skipped: SUPABASE_ACCESS_TOKEN/SUPABASE_PROJECT_REF are not configured.",
    );
  } else {
    const response = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/config/auth`,
      { headers: { authorization: `Bearer ${token}` } },
    );
    if (!response.ok) {
      fail(`Reading hosted auth config failed: HTTP ${response.status}`);
    } else {
      const authConfig = await response.json();
      if (authConfig[FLAG] !== true) {
        fail(
          "Hosted leaked-password protection is OFF; re-run tools/ops/enable-leaked-password-protection.mjs",
        );
      } else {
        console.log("Hosted leaked-password protection confirmed on.");
      }
    }
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`DRIFT: ${failure}`);
  }
  process.exit(1);
}
console.log(wantsLive ? "No drift; leaked-password protection enforced." : "No drift in leaked-password protection tooling.");