#!/usr/bin/env node

import process from "node:process";

const DEFAULT_MANAGEMENT_API_BASE_URL = "https://api.supabase.com";
const REQUEST_TIMEOUT_MS = 15_000;
const EXIT_PASS = 0;
const EXIT_FAIL = 1;

function readEnv(name) {
  const value = process.env[name];
  return typeof value === "string" ? value.trim() : "";
}

function fail(message) {
  console.error(`FAIL: ${message}`);
  console.error(
    "Remediation: re-enable leaked-password protection with 'node tools/ops/enable-leaked-password-protection.mjs' (see docs/runbooks/supabase-auth-hardening.md and docs/runbooks/leaked-password-protection-guard.md), then re-run this check."
  );
  process.exit(EXIT_FAIL);
}

async function fetchAuthConfig(projectRef, accessToken) {
  const baseUrl = readEnv("SUPABASE_MANAGEMENT_API_URL") || DEFAULT_MANAGEMENT_API_BASE_URL;
  const url = `${baseUrl.replace(/\/$/, "")}/v1/projects/${encodeURIComponent(projectRef)}/config/auth`;
  let response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    fail(`could not reach Supabase Management API at ${baseUrl} within ${REQUEST_TIMEOUT_MS}ms`);
  }
  if (!response.ok) {
    fail(`Management API returned HTTP ${response.status} ${response.statusText} for project auth config`);
  }
  try {
    return await response.json();
  } catch {
    fail("Management API returned a non-JSON auth config payload");
  }
}

const projectRef = readEnv("SUPABASE_PROJECT_REF");
if (!/^[a-z0-9]{20}$/.test(projectRef)) {
  fail("SUPABASE_PROJECT_REF is missing or not a 20-character project ref");
}

const accessToken = readEnv("SUPABASE_ACCESS_TOKEN");
if (accessToken.length === 0) {
  fail("SUPABASE_ACCESS_TOKEN is missing (needs auth:read scope only)");
}

const authConfig = await fetchAuthConfig(projectRef, accessToken);
const hibpEnabled = authConfig?.password_hibp_enabled;

if (hibpEnabled !== true) {
  fail(
    `leaked-password protection is not enabled on project '${projectRef}' (password_hibp_enabled=${JSON.stringify(hibpEnabled)})`
  );
}

console.log(`PASS: leaked-password protection enforced on project '${projectRef}' (password_hibp_enabled=true)`);
process.exit(EXIT_PASS);