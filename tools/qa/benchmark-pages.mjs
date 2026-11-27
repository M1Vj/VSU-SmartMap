import http from "node:http";
import https from "node:https";
import { performance } from "node:perf_hooks";

const ROUTES = [
  "/",
  "/chat",
  "/directory",
  "/events",
  "/info",
  "/admin",
  "/admin/ai-knowledge",
  "/admin/bugs",
  "/admin/events",
  "/admin/facilities",
  "/admin/login",
  "/admin/navigation",
  "/admin/navigation/pathfinding",
  "/admin/suggestions",
  "/offline",
];

// PERF_PUBLIC_ONLY=1 measures public routes only; the default checks all configured targets.
// No mode supplies a signed-in session or measures underlying query work.
const publicOnly = process.env.PERF_PUBLIC_ONLY === "1";
const routes = publicOnly
  ? ROUTES.filter((route) => route === "/admin/login" || !route.startsWith("/admin"))
  : ROUTES;
const baseUrl = parseBaseUrl(process.env.PERF_BASE_URL ?? "http://127.0.0.1:3000");

function parseBaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    console.error("PERF_BASE_URL must be a valid HTTP(S) URL without credentials.");
    process.exit(1);
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    console.error("PERF_BASE_URL must be a valid HTTP(S) URL without credentials.");
    process.exit(1);
  }
  return url;
}
const warmupRuns = readPositiveInteger("PERF_WARMUPS", 3);
const sampleRuns = readPositiveInteger("PERF_SAMPLES", 30);
const budgetMs = readPositiveNumber("PERF_BUDGET_MS", 50);

const agents = {
  "http:": new http.Agent({ keepAlive: true, maxSockets: 1 }),
  "https:": new https.Agent({ keepAlive: true, maxSockets: 1 }),
};

function readPositiveInteger(name, fallback) {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function readPositiveNumber(name, fallback) {
  const value = Number.parseFloat(process.env[name] ?? "");
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1);
  return sorted[index];
}

function summarize(values) {
  return {
    min: Math.min(...values),
    mean: values.reduce((sum, value) => sum + value, 0) / values.length,
    p50: percentile(values, 0.5),
    p95: percentile(values, 0.95),
    max: Math.max(...values),
  };
}

function request(url) {
  const startedAt = performance.now();
  const transport = url.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    const req = transport.get(
      url,
      {
        agent: agents[url.protocol],
        headers: {
          accept: "text/html,application/xhtml+xml",
          "user-agent": "VSU-SmartMap-Performance-Benchmark/1.0",
        },
      },
      (response) => {
        const responseStartedAt = performance.now();
        const status = response.statusCode ?? 0;
        // A redirect is not the page we asked to time. Do not fetch its destination.
        const redirected = status >= 300 && status < 400 && Boolean(response.headers.location);

        let bytes = 0;
        response.on("data", (chunk) => {
          bytes += chunk.length;
        });
        response.once("end", () => {
          resolve({
            status,
            redirected,
            ttfbMs: responseStartedAt - startedAt,
            totalMs: performance.now() - startedAt,
            bytes,
          });
        });
      }
    );

    req.setTimeout(15_000, () => req.destroy(new Error(`Timed out requesting ${url}`)));
    req.once("error", reject);
  });
}

async function run() {
  const results = new Map(routes.map((route) => [route, []]));

  for (let iteration = 0; iteration < warmupRuns; iteration += 1) {
    for (const route of routes) {
      await request(new URL(route, baseUrl));
    }
  }

  for (let iteration = 0; iteration < sampleRuns; iteration += 1) {
    for (const route of routes) {
      results.get(route).push(await request(new URL(route, baseUrl)));
    }
  }

  const rows = routes.map((route) => {
    const samples = results.get(route);
    const latest = samples.at(-1);
    const targetSamples = samples.filter(
      (sample) => sample.status >= 200 && sample.status < 300,
    ).length;
    const complete = targetSamples === samples.length;
    const ttfb = complete ? summarize(samples.map((sample) => sample.ttfbMs)) : null;
    const total = complete ? summarize(samples.map((sample) => sample.totalMs)) : null;
    return {
      route,
      status: latest.status,
      redirected: latest.redirected,
      bytes: latest.bytes,
      targetSamples,
      sampleCount: samples.length,
      ttfb,
      total,
      passes: total !== null && total.p95 < budgetMs,
    };
  });

  console.log(
    `Anonymous page benchmark (${publicOnly ? "public routes only" : "all configured routes"}): ${baseUrl.origin} | ${warmupRuns} warmups + ${sampleRuns} samples | p95 budget < ${budgetMs} ms`
  );
  const timing = (value) => value === undefined ? "N/A" : value.toFixed(2);
  console.table(
    rows.map((row) => ({
      route: row.route,
      "last status": row.status,
      "last redirect": row.redirected,
      "last bytes": row.bytes,
      "direct 2xx": `${row.targetSamples}/${row.sampleCount}`,
      "TTFB p50": timing(row.ttfb?.p50),
      "TTFB p95": timing(row.ttfb?.p95),
      "total min": timing(row.total?.min),
      "total mean": timing(row.total?.mean),
      "total p50": timing(row.total?.p50),
      "total p95": timing(row.total?.p95),
      "total max": timing(row.total?.max),
      budget: row.passes ? "PASS" : "FAIL",
    }))
  );

  const failures = rows.filter((row) => !row.passes);
  if (failures.length > 0) {
    for (const row of failures) {
      if (row.targetSamples !== row.sampleCount) {
        console.error(`${row.route}: ${row.targetSamples}/${row.sampleCount} samples returned a direct HTTP 2xx`);
      }
    }
    console.error(
      `Page benchmark failed for ${failures.length}/${rows.length} routes: ${failures
        .map((row) => row.route)
        .join(", ")}`
    );
    process.exitCode = 1;
  }
}

try {
  await run();
} finally {
  for (const agent of Object.values(agents)) agent.destroy();
}
