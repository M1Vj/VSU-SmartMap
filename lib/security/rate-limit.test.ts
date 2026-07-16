import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import test, { mock } from "node:test";

type RpcResult = {
  data: unknown;
  error: { message: string } | null;
};

const originalEnvironment = {
  NODE_ENV: process.env.NODE_ENV,
  ABUSE_RATE_LIMIT_PEPPER: process.env.ABUSE_RATE_LIMIT_PEPPER,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

let rpcResult: RpcResult = {
  data: [{ allowed: true, retry_after_seconds: 0 }],
  error: null,
};
let clientCreations = 0;
let rpcCalls: Array<{ name: string; params: Record<string, unknown> }> = [];

mock.module("@supabase/supabase-js", {
  namedExports: {
    createClient(url: string, key: string) {
      clientCreations += 1;
      assert.equal(url, "https://project.supabase.co");
      assert.equal(key, "service-role-test-key");

      return {
        from() {
          throw new Error("rate limiting must not use generic table writes");
        },
        async rpc(name: string, params: Record<string, unknown>) {
          rpcCalls.push({ name, params });
          return rpcResult;
        },
      };
    },
  },
});

const rateLimitModule = import("./rate-limit.ts");

function configureEnvironment() {
  (process.env as Record<string, string | undefined>).NODE_ENV = "production";
  process.env.ABUSE_RATE_LIMIT_PEPPER = "test-only-pepper";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
}

function resetState() {
  configureEnvironment();
  clientCreations = 0;
  rpcCalls = [];
  rpcResult = {
    data: [{ allowed: true, retry_after_seconds: 0 }],
    error: null,
  };
}

function restoreEnvironment() {
  for (const [name, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}

test.after(restoreEnvironment);

test("consumeRateLimit HMACs a normalized subject and calls only the atomic RPC", async () => {
  resetState();
  const { consumeRateLimit } = await rateLimitModule;

  const result = await consumeRateLimit({
    scope: "public:suggestions",
    subject: "  2001:DB8::1  ",
    requestLimit: 12,
    byteLimit: 2_000_000,
    windowSeconds: 300,
    costBytes: 128,
  });

  assert.deepEqual(result, { allowed: true, retryAfterSeconds: 0 });
  assert.equal(clientCreations, 1);
  assert.equal(rpcCalls.length, 1);
  assert.equal(rpcCalls[0]?.name, "consume_security_rate_limit");
  assert.deepEqual(rpcCalls[0]?.params, {
    p_scope: "public:suggestions",
    p_subject_hash: createHmac("sha256", "test-only-pepper")
      .update("2001:db8::1")
      .digest("hex"),
    p_request_limit: 12,
    p_byte_limit: 2_000_000,
    p_window_seconds: 300,
    p_cost_bytes: 128,
  });
  assert.equal(JSON.stringify(rpcCalls).includes("2001:DB8::1"), false);
  assert.equal(JSON.stringify(rpcCalls).includes("2001:db8::1"), false);
});

test("hashRateLimitSubject returns the same private owner hash used by rate limiting", async () => {
  resetState();
  const { hashRateLimitSubject } = await rateLimitModule;

  assert.equal(
    hashRateLimitSubject("  ::ffff:192.0.2.1  "),
    createHmac("sha256", "test-only-pepper")
      .update("192.0.2.1")
      .digest("hex"),
  );
  assert.equal(hashRateLimitSubject("not-an-ip"), null);
  assert.equal(JSON.stringify(rpcCalls).includes("192.0.2.1"), false);
});

test("consumeRateLimit canonicalizes equivalent IPv6 spellings before hashing", async () => {
  resetState();
  const { consumeRateLimit } = await rateLimitModule;

  for (const subject of ["2001:db8::1", "2001:0db8:0:0:0:0:0:1"]) {
    await consumeRateLimit({
      scope: "public:suggestions",
      subject,
      requestLimit: 12,
      windowSeconds: 300,
    });
  }

  assert.equal(rpcCalls.length, 2);
  assert.equal(
    rpcCalls[0]?.params.p_subject_hash,
    rpcCalls[1]?.params.p_subject_hash,
  );
});

test("consumeRateLimit unifies native IPv4 with every IPv4-mapped IPv6 spelling", async () => {
  resetState();
  const { consumeRateLimit } = await rateLimitModule;

  const subjects = [
    "192.0.2.1",
    "::ffff:192.0.2.1",
    "::ffff:c000:201",
    "0:0:0:0:0:ffff:c000:0201",
    "::FFFF:192.0.2.1",
    "::FFFF:C000:201",
    "0:0:0:0:0:FFFF:C000:0201",
  ];

  for (const subject of subjects) {
    await consumeRateLimit({
      scope: "public:suggestions",
      subject,
      requestLimit: 12,
      windowSeconds: 300,
    });
  }

  assert.equal(rpcCalls.length, subjects.length);
  const nativeIpv4Hash = rpcCalls[0]?.params.p_subject_hash;
  for (const call of rpcCalls.slice(1)) {
    assert.equal(call.params.p_subject_hash, nativeIpv4Hash);
  }
});

test("consumeRateLimit rejects malformed and multi-value subjects before database access", async () => {
  resetState();
  const { consumeRateLimit } = await rateLimitModule;

  for (const subject of [
    "not-an-ip-address",
    "203.0.113.9, 198.51.100.2",
    "203.0.113.9 198.51.100.2",
  ]) {
    const result = await consumeRateLimit({
      scope: "public:suggestions",
      subject,
      requestLimit: 12,
      windowSeconds: 300,
    });
    assert.deepEqual(result, { allowed: false, retryAfterSeconds: 300 });
  }

  assert.equal(clientCreations, 0);
  assert.equal(rpcCalls.length, 0);
});

test("consumeRateLimit fails closed in production when the HMAC pepper is missing", async () => {
  resetState();
  delete process.env.ABUSE_RATE_LIMIT_PEPPER;
  const { consumeRateLimit } = await rateLimitModule;

  const result = await consumeRateLimit({
    scope: "public:reports",
    subject: "203.0.113.9",
    requestLimit: 5,
    windowSeconds: 120,
  });

  assert.deepEqual(result, { allowed: false, retryAfterSeconds: 120 });
  assert.equal(clientCreations, 0);
});

test("consumeRateLimit refuses to run without service-role Supabase credentials", async () => {
  resetState();
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const { consumeRateLimit } = await rateLimitModule;

  const result = await consumeRateLimit({
    scope: "public:reports",
    subject: "203.0.113.10",
    requestLimit: 5,
    windowSeconds: 120,
  });

  assert.deepEqual(result, { allowed: false, retryAfterSeconds: 120 });
  assert.equal(clientCreations, 0);
});

test("consumeRateLimit rejects out-of-range parameters before database access", async () => {
  resetState();
  const { consumeRateLimit } = await rateLimitModule;

  const result = await consumeRateLimit({
    scope: "../../unbounded scope",
    subject: "203.0.113.11",
    requestLimit: 0,
    byteLimit: Number.MAX_SAFE_INTEGER,
    windowSeconds: 0,
    costBytes: -1,
  });

  assert.deepEqual(result, { allowed: false, retryAfterSeconds: 60 });
  assert.equal(clientCreations, 0);
});

test("consumeRateLimit fails closed when the RPC returns an error", async () => {
  resetState();
  rpcResult = { data: null, error: { message: "database unavailable" } };
  const { consumeRateLimit } = await rateLimitModule;

  const result = await consumeRateLimit({
    scope: "public:reports",
    subject: "203.0.113.12",
    requestLimit: 5,
    windowSeconds: 90,
  });

  assert.deepEqual(result, { allowed: false, retryAfterSeconds: 90 });
});

test("the migration keeps rate-limit storage private and exposes service-role-only atomic RPCs", async () => {
  const migration = await readFile(
    new URL(
      "../../supabase/migrations/20260716000000_public_write_security.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(migration, /CREATE TABLE public\.security_rate_limit_buckets/i);
  assert.match(migration, /PRIMARY KEY \(scope, subject_hash, window_start\)/i);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/i);
  assert.match(
    migration,
    /REVOKE ALL ON TABLE public\.security_rate_limit_buckets\s+FROM PUBLIC, anon, authenticated, service_role/i,
  );
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.consume_security_rate_limit/i);
  assert.match(migration, /SECURITY DEFINER\s+SET search_path = ''/i);
  assert.match(migration, /ON CONFLICT \(scope, subject_hash, window_start\) DO UPDATE/i);
  assert.match(
    migration,
    /GRANT EXECUTE ON FUNCTION public\.consume_security_rate_limit[\s\S]+ TO service_role/i,
  );
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.cleanup_security_rate_limit_buckets/i);
  assert.doesNotMatch(migration, /GRANT EXECUTE[\s\S]+ TO (?:PUBLIC|anon|authenticated)/i);
});
