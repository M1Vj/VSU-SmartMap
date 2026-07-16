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
  "/admin/suggestions/performance-benchmark",
  "/offline",
];

const baseUrl = new URL(process.env.PERF_BASE_URL ?? "http://127.0.0.1:3000");
const warmupRuns = readPositiveInteger("PERF_WARMUPS", 3);
const sampleRuns = readPositiveInteger("PERF_SAMPLES", 30);
const budgetMs = readPositiveNumber("PERF_BUDGET_MS", 50);
const maxRedirects = 5;

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

function request(url, startedAt = performance.now(), redirectCount = 0) {
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
        const location = response.headers.location;

        if (
          location &&
          response.statusCode &&
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          redirectCount < maxRedirects
        ) {
          response.resume();
          response.once("end", () => {
            resolve(request(new URL(location, url), startedAt, redirectCount + 1));
          });
          return;
        }

        let bytes = 0;
        response.on("data", (chunk) => {
          bytes += chunk.length;
        });
        response.once("end", () => {
          resolve({
            status: response.statusCode ?? 0,
            redirects: redirectCount,
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
  const results = new Map(ROUTES.map((route) => [route, []]));

  for (let iteration = 0; iteration < warmupRuns; iteration += 1) {
    for (const route of ROUTES) {
      await request(new URL(route, baseUrl));
    }
  }

  for (let iteration = 0; iteration < sampleRuns; iteration += 1) {
    for (const route of ROUTES) {
      results.get(route).push(await request(new URL(route, baseUrl)));
    }
  }

  const rows = ROUTES.map((route) => {
    const samples = results.get(route);
    const ttfb = summarize(samples.map((sample) => sample.ttfbMs));
    const total = summarize(samples.map((sample) => sample.totalMs));
    const latest = samples.at(-1);

    return {
      route,
      status: latest.status,
      redirects: latest.redirects,
      bytes: latest.bytes,
      ttfbP50: ttfb.p50,
      ttfbP95: ttfb.p95,
      totalMin: total.min,
      totalMean: total.mean,
      totalP50: total.p50,
      totalP95: total.p95,
      totalMax: total.max,
      passes: latest.status >= 200 && latest.status < 300 && total.p95 < budgetMs,
    };
  });

  console.log(
    `Page benchmark: ${baseUrl} | ${warmupRuns} warmups + ${sampleRuns} samples | p95 budget < ${budgetMs} ms`
  );
  console.table(
    rows.map((row) => ({
      route: row.route,
      status: row.status,
      redirects: row.redirects,
      bytes: row.bytes,
      "TTFB p50": row.ttfbP50.toFixed(2),
      "TTFB p95": row.ttfbP95.toFixed(2),
      "total min": row.totalMin.toFixed(2),
      "total mean": row.totalMean.toFixed(2),
      "total p50": row.totalP50.toFixed(2),
      "total p95": row.totalP95.toFixed(2),
      "total max": row.totalMax.toFixed(2),
      budget: row.passes ? "PASS" : "FAIL",
    }))
  );

  const failures = rows.filter((row) => !row.passes);
  if (failures.length > 0) {
    console.error(
      `Performance budget failed for ${failures.length}/${rows.length} routes: ${failures
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
