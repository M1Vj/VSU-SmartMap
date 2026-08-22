#!/usr/bin/env node
// Enables Supabase leaked-password protection (HaveIBeenPwned check) on the
// hosted project. Requires a Pro-plan project and a management token.
//
// Usage:
//   SUPABASE_ACCESS_TOKEN=... SUPABASE_PROJECT_REF=... \
//     node tools/ops/enable-leaked-password-protection.mjs
//
// The script is read-only until both variables are set, prints the current
// setting first, and is safe to re-run.

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
  return response.json();
}

const before = await readAuthConfig();
console.log(`password_hibp_enabled before: ${before.password_hibp_enabled}`);

if (before.password_hibp_enabled === true) {
  console.log("Already enabled; nothing to do.");
  process.exit(0);
}

const after = await enableLeakedPasswordProtection();
console.log(`password_hibp_enabled after: ${after.password_hibp_enabled}`);
if (after.password_hibp_enabled !== true) {
  console.error("The API did not confirm the new value. Check the dashboard under Authentication -> Passwords.");
  process.exit(1);
}
console.log("Leaked-password protection is enabled. Sign-ups and password changes now reject breached passwords.");
