import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createServer, type RequestListener } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { fileURLToPath } from "node:url";

async function runBenchmark(
  handle: RequestListener,
  { publicOnly = false, urlUserinfo = "" } = {},
) {
  const server = createServer(handle);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  try {
    const { port } = server.address() as AddressInfo;
    return await new Promise<{ code: number | string; stdout: string; stderr: string }>((resolve) => {
      execFile(
        process.execPath,
        [fileURLToPath(new URL("./benchmark-pages.mjs", import.meta.url))],
        { timeout: 10_000, env: {
          ...process.env,
          PERF_BASE_URL: `http://${urlUserinfo}127.0.0.1:${port}`,
          PERF_WARMUPS: "1",
          PERF_SAMPLES: "2",
          PERF_BUDGET_MS: "1000",
          PERF_PUBLIC_ONLY: publicOnly ? "1" : "0",
        } },
        (error, stdout, stderr) => resolve({ code: error ? (error.code ?? error.signal ?? "failed") : 0, stdout, stderr }),
      );
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("target page responses within budget pass", async () => {
  const result = await runBenchmark((_req, res) => res.end("requested page"));
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Anonymous page benchmark/);
  assert.doesNotMatch(result.stdout, /N\/A/);
});

test("a login redirect does not pass as a measured admin page", async () => {
  const requested: string[] = [];
  const result = await runBenchmark((req, res) => {
    requested.push(req.url ?? "");
    if (req.url === "/admin/facilities") {
      res.writeHead(302, { Location: "/admin/login" }).end();
      return;
    }
    res.end("requested page");
  });
  assert.equal(result.code, 1);
  assert.match(result.stderr, /\/admin\/facilities: 0\/2 samples returned a direct HTTP 2xx/);
  assert.equal(requested.filter((url) => url === "/admin/login").length, 3);
  assert.match(result.stdout.split("\n").find((line) => line.includes("/admin/facilities")) ?? "", /N\/A/);
});

test("an earlier failed sample is not hidden by the final 200", async () => {
  let eventRequests = 0;
  const result = await runBenchmark((req, res) => {
    if (req.url === "/events" && ++eventRequests === 2) {
      res.writeHead(503).end("temporarily unavailable");
      return;
    }
    res.end("requested page");
  });
  assert.equal(result.code, 1);
  assert.match(result.stderr, /\/events: 1\/2 samples returned a direct HTTP 2xx/);
  assert.match(result.stdout.split("\n").find((line) => line.includes("'"+"/events"+"'")) ?? "", /N\/A/);
});

test("public-only mode makes no requests to protected admin routes", async () => {
  const requested: string[] = [];
  const result = await runBenchmark((req, res) => {
    requested.push(req.url ?? "");
    res.end("public page");
  }, { publicOnly: true });
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /public routes only/);
  assert.ok(requested.includes("/admin/login"));
  assert.deepEqual(requested.filter((url) => url.startsWith("/admin") && url !== "/admin/login"), []);
});

test("public-only mode does not follow a public response to a protected route", async () => {
  const requested: string[] = [];
  const result = await runBenchmark((req, res) => {
    requested.push(req.url ?? "");
    if (req.url === "/events") {
      res.writeHead(302, { Location: "/admin/facilities" }).end();
      return;
    }
    res.end("public page");
  }, { publicOnly: true });
  assert.equal(result.code, 1);
  assert.match(result.stderr, /\/events: 0\/2 samples returned a direct HTTP 2xx/);
  assert.ok(!requested.includes("/admin/facilities"));
});

test("embedded URL credentials are neither sent nor printed", async () => {
  let requests = 0;
  const result = await runBenchmark((_req, res) => {
    requests++;
    res.end();
  }, { urlUserinfo: "example-user:placeholder-value@" });
  assert.equal(result.code, 1);
  assert.equal(requests, 0);
  assert.match(result.stderr, /URL without credentials/);
  assert.doesNotMatch(result.stdout + result.stderr, /example-user|placeholder-value/);
});
