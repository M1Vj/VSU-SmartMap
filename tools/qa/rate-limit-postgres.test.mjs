import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

const POSTGRES_IMAGE = "postgres:17";
const ROLE_NAMES = ["anon", "authenticated", "service_role"];
const CONTAINER_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/;
const migrationUrl = new URL(
  "../../supabase/migrations/20260716000000_public_write_security.sql",
  import.meta.url,
);

const containerName = `smartmap-rate-limit-${process.pid}-${Date.now()}`;
const databaseName = `rate_limit_test_${process.pid}_${Date.now()}`;

let containerStarted = false;

class DockerCommandError extends Error {
  constructor(args, stderr) {
    super(`docker ${args.join(" ")} failed: ${stderr.trim()}`);
    this.name = "DockerCommandError";
    this.stderr = stderr;
  }
}

function assertSafeContainerName(name) {
  assert.match(
    name,
    CONTAINER_NAME_PATTERN,
    "RATE_LIMIT_TEST_CONTAINER must be a Docker-safe container name",
  );
}

function runDockerSync(args, options = {}) {
  const result = spawnSync("docker", args, {
    encoding: "utf8",
    input: options.input,
    maxBuffer: 4 * 1024 * 1024,
  });

  if (result.error) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    throw new DockerCommandError(args, result.stderr || result.stdout);
  }

  return result;
}

function runDockerAsync(args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new DockerCommandError(args, stderr || stdout));
    });

    child.stdin.end(input);
  });
}

function psqlArgs(database = databaseName) {
  return [
    "exec",
    "-i",
    containerName,
    "psql",
    "-X",
    "-q",
    "-A",
    "-t",
    "-F",
    "\t",
    "--set",
    "ON_ERROR_STOP=1",
    "-U",
    "postgres",
    "-d",
    database,
  ];
}

function executeSqlSync(sql, database = databaseName, options = {}) {
  const result = runDockerSync(psqlArgs(database), {
    input: sql,
    allowFailure: options.allowFailure,
  });
  return {
    status: result.status,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
  };
}

function executeSql(sql, database = databaseName) {
  return runDockerAsync(psqlArgs(database), sql);
}

async function waitForPostgres() {
  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline) {
    const logs = runDockerSync(["logs", containerName], { allowFailure: true });
    const initializationComplete = `${logs.stdout}\n${logs.stderr}`.includes(
      "PostgreSQL init process complete; ready for start up.",
    );
    const query = initializationComplete
      ? executeSqlSync("SELECT 1;", "postgres", { allowFailure: true })
      : { status: 1 };

    if (query.status === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`PostgreSQL did not become ready in container ${containerName}`);
}

function quoteIdentifier(identifier) {
  assert.match(identifier, /^[a-z0-9_]+$/);
  return `"${identifier}"`;
}

function parseRateLimitRows(output) {
  return output
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [allowed, retryAfterSeconds] = line.split("\t");
      assert.ok(allowed === "t" || allowed === "f", `unexpected row: ${line}`);
      return {
        allowed: allowed === "t",
        retryAfterSeconds: Number(retryAfterSeconds),
      };
    });
}

function consumeSql({
  scope,
  subjectHash,
  requestLimit,
  byteLimit = null,
  windowSeconds,
  costBytes = 0,
}) {
  assert.match(scope, /^[a-z][a-z0-9:_-]{0,63}$/);
  assert.match(subjectHash, /^[0-9a-f]{64}$/);
  assert.ok(Number.isInteger(requestLimit));
  assert.ok(byteLimit === null || Number.isInteger(byteLimit));
  assert.ok(Number.isInteger(windowSeconds));
  assert.ok(Number.isInteger(costBytes));

  return `SELECT allowed, retry_after_seconds
FROM public.consume_security_rate_limit(
  '${scope}',
  '${subjectHash}',
  ${requestLimit},
  ${byteLimit === null ? "NULL" : byteLimit},
  ${windowSeconds},
  ${costBytes}
);`;
}

async function setupDatabase() {
  assertSafeContainerName(containerName);

  runDockerSync([
    "run",
    "--rm",
    "-d",
    "--name",
    containerName,
    "-e",
    "POSTGRES_HOST_AUTH_METHOD=trust",
    POSTGRES_IMAGE,
  ]);
  containerStarted = true;
  await waitForPostgres();

  for (const role of ROLE_NAMES) {
    executeSqlSync(`CREATE ROLE ${quoteIdentifier(role)} NOLOGIN;`, "postgres");
  }

  executeSqlSync(`CREATE DATABASE ${quoteIdentifier(databaseName)};`, "postgres");
  executeSqlSync(
    "GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;",
  );
  executeSqlSync(await readFile(migrationUrl, "utf8"));
}

function cleanupDatabase() {
  if (!containerStarted) return;
  runDockerSync(["rm", "-f", containerName], { allowFailure: true });
}

test.before(setupDatabase);
test.after(cleanupDatabase);

test("request counts allow exactly the configured boundary", () => {
  const call = consumeSql({
    scope: "integration:requests",
    subjectHash: "1".repeat(64),
    requestLimit: 3,
    windowSeconds: 60,
  });
  const rows = parseRateLimitRows(executeSqlSync(call.repeat(4)).stdout);

  assert.deepEqual(
    rows.map((row) => row.allowed),
    [true, true, true, false],
  );
  assert.equal(rows[3].retryAfterSeconds > 0, true);
  assert.equal(rows[3].retryAfterSeconds <= 60, true);
});

test("byte counts allow the exact byte boundary and reject the next byte", () => {
  const base = {
    scope: "integration:bytes",
    subjectHash: "2".repeat(64),
    requestLimit: 10,
    byteLimit: 10,
    windowSeconds: 60,
  };
  const sql = [4, 6, 1]
    .map((costBytes) => consumeSql({ ...base, costBytes }))
    .join("\n");
  const rows = parseRateLimitRows(executeSqlSync(sql).stdout);

  assert.deepEqual(
    rows.map((row) => row.allowed),
    [true, true, false],
  );
});

test("a one-second window resets after its boundary", async () => {
  executeSqlSync(
    `SELECT pg_sleep(
      1.05 - mod(extract(epoch FROM clock_timestamp())::numeric, 1)
    );`,
  );
  const call = consumeSql({
    scope: "integration:reset",
    subjectHash: "3".repeat(64),
    requestLimit: 1,
    windowSeconds: 1,
  });
  const beforeReset = parseRateLimitRows(executeSqlSync(call.repeat(2)).stdout);

  assert.deepEqual(
    beforeReset.map((row) => row.allowed),
    [true, false],
  );

  await new Promise((resolve) => setTimeout(resolve, 1_100));
  const afterReset = parseRateLimitRows(executeSqlSync(call).stdout);
  assert.deepEqual(afterReset, [{ allowed: true, retryAfterSeconds: 0 }]);
});

test("concurrent consumption allows exactly the configured request limit", async () => {
  executeSqlSync(
    `SELECT pg_sleep(
      5.05 - mod(extract(epoch FROM clock_timestamp())::numeric, 5)
    );`,
  );
  const call = consumeSql({
    scope: "integration:concurrent",
    subjectHash: "4".repeat(64),
    requestLimit: 5,
    windowSeconds: 5,
  });
  const results = await Promise.all(
    Array.from({ length: 20 }, () => executeSql(call)),
  );
  const rows = results.flatMap(parseRateLimitRows);

  assert.equal(rows.length, 20);
  assert.equal(rows.filter((row) => row.allowed).length, 5);
  assert.equal(rows.filter((row) => !row.allowed).length, 15);
});

test("anon and authenticated roles cannot execute the consume RPC", async () => {
  const call = consumeSql({
    scope: "integration:permissions",
    subjectHash: "5".repeat(64),
    requestLimit: 1,
    windowSeconds: 60,
  });

  for (const role of ["anon", "authenticated"]) {
    await assert.rejects(
      executeSql(`SET ROLE ${quoteIdentifier(role)};\n${call}`),
      /permission denied for function consume_security_rate_limit/i,
    );
  }
});

test("service_role can execute the RPC", async () => {
  const call = consumeSql({
    scope: "integration:service-role",
    subjectHash: "6".repeat(64),
    requestLimit: 1,
    windowSeconds: 60,
  });
  const rows = parseRateLimitRows(
    await executeSql(`SET ROLE service_role;\n${call}`),
  );
  assert.deepEqual(rows, [{ allowed: true, retryAfterSeconds: 0 }]);
});

test("API roles cannot access the rate-limit table directly", async () => {
  for (const role of ROLE_NAMES) {
    await assert.rejects(
      executeSql(
        `SET ROLE ${quoteIdentifier(role)}; SELECT * FROM public.security_rate_limit_buckets;`,
      ),
      /permission denied for table security_rate_limit_buckets/i,
    );
  }
});
