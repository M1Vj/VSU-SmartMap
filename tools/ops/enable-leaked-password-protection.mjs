#!/usr/bin/env node
// Enables Supabase leaked-password protection (HaveIBeenPwned check) on the
// hosted project. Requires a Pro-plan project and a management token.
//
// Usage:
//   SUPABASE_ACCESS_TOKEN=... SUPABASE_PROJECT_REF=... \
//     node tools/ops/enable-leaked-password-protection.mjs
//
// The script is read-only until both variables are set, skips work when the
// setting is already on, verifies the change after applying it, and never
// prints configuration values — check the dashboard or re-run to confirm.

const required = ["SUPABASE_ACCESS_TOKEN", "SUPABASE_PROJECT_REF"];
for (const name of required) {
  if (!process.env[name]) {
    console.error(`Missing ${name}. Export it and re-run; nothing was changed.`);
    process.exit(1);
  }
}

const token = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef = process.env.SUPABASE_PROJECT_REF;
const endpoint = `https://api.supabase.com/v1/projects/${projectRef}/config/auth`;

async function readAuthConfig() {
  const response = await fetch(endpoint, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(`Reading auth config failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

function leakedPasswordProtectionState(config) {
  return config.password_hibp_enabled === true ? "on" : "off";
}

async function enableLeakedPasswordProtection() {
  const response = await fetch(endpoint, {
    method: "PATCH",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ password_hibp_enabled: true }),
  });
  if (!response.ok) {
    throw new Error(`Enabling leaked-password protection failed: ${response.status} ${await response.text()}`);
  }
}

const current = await readAuthConfig();
if (leakedPasswordProtectionState(current) === "on") {
  console.log("Leaked-password protection is already on; nothing to do.");
  process.exit(0);
}

console.log("Leaked-password protection is off; enabling it now...");
await enableLeakedPasswordProtection();

const verified = await readAuthConfig();
if (leakedPasswordProtectionState(verified) !== "on") {
  console.error("The API did not confirm the change. Check the dashboard under Authentication -> Passwords.");
  process.exit(1);
}
console.log("Leaked-password protection is now on. Sign-ups and password changes reject breached passwords.");
