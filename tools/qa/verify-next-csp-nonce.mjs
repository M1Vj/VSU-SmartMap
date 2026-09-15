#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];
function check(name, ok, detail = "") {
  if (ok) {
    console.log(`PASS ${name}`);
  } else {
    failures.push(name);
    console.log(`FAIL ${name}${detail ? `: ${detail}` : ""}`);
  }
}

let pkg;
try {
  pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
} catch (err) {
  console.log(`FAIL package.json readable: ${String(err?.message || err)}`);
  process.exit(1);
}

check("next pinned to 16.3.5", pkg?.dependencies?.next === "16.3.5", String(pkg?.dependencies?.next));
check("bundle-analyzer pinned to 16.3.5", pkg?.devDependencies?.["@next/bundle-analyzer"] === "16.3.5", String(pkg?.devDependencies?.["@next/bundle-analyzer"]));
check("eslint-config-next pinned to 16.3.5", pkg?.devDependencies?.["eslint-config-next"] === "16.3.5", String(pkg?.devDependencies?.["eslint-config-next"]));

let proxy = "";
try {
  proxy = readFileSync(path.join(root, "proxy.ts"), "utf8");
} catch (err) {
  console.log(`FAIL proxy.ts readable: ${String(err?.message || err)}`);
  process.exit(1);
}

check("proxy exports buildContentSecurityPolicy(nonce)", proxy.includes("function buildContentSecurityPolicy(nonce"));
check("proxy exports applySecurityHeaders", proxy.includes("export function applySecurityHeaders"));
check("proxy mints per-request nonce", proxy.includes("crypto.randomUUID().replace(/-/g,"));
check("proxy forwards nonce via request headers", proxy.includes("new NextRequest(request, { headers })"));
check("proxy comments Next.js request-CSP forwarding", proxy.includes("request's CSP header"));
check("proxy applies headers to response with same nonce", proxy.includes("applySecurityHeaders(response.headers, nonce)"));
check("script-src carries nonce", proxy.includes("script-src 'self' 'nonce-"));

const scriptSrcLine = proxy.split("\n").find((l) => l.includes("script-src")) || "";
check("script-src has no unsafe-inline", !scriptSrcLine.includes("unsafe-inline"), scriptSrcLine.trim());

if (failures.length > 0) {
  console.log(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log("\nAll Next.js 16.3.5 backport checks passed");