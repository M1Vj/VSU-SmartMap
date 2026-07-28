import assert from "node:assert/strict";
import test, { mock } from "node:test";

type Cookie = {
  name: string;
  value: string;
  options?: Record<string, unknown>;
};

let exchangeError: Error | null = null;
let exchangedCodes: string[] = [];
let cookieWrites: Cookie[] = [];

const supabase = {
  auth: {
    async exchangeCodeForSession(code: string) {
      exchangedCodes.push(code);
      return { error: exchangeError };
    },
  },
};

mock.module("@supabase/ssr", {
  namedExports: {
    createServerClient(
      _url: string,
      _key: string,
      options: { cookies: { setAll(cookies: Cookie[]): void } },
    ) {
      options.cookies.setAll([
        {
          name: "sb-session",
          value: "opaque-session",
          options: { httpOnly: true, path: "/" },
        },
      ]);
      return supabase;
    },
  },
});

mock.module("next/headers", {
  namedExports: {
    async cookies() {
      return {
        getAll() {
          return [];
        },
        set(name: string, value: string, options?: Record<string, unknown>) {
          cookieWrites.push({ name, value, options });
        },
      };
    },
  },
});

const routeModule = import("./route.ts");

function reset() {
  exchangeError = null;
  exchangedCodes = [];
  cookieWrites = [];
}

async function callback(query: string) {
  const { GET } = await routeModule;
  return GET(new Request(`https://map.example.test/auth/callback?${query}`));
}

test.beforeEach(reset);

test("schedule OAuth success redirects to schedule and exchanges the code", async () => {
  const response = await callback("code=one-time-code&next=%2Fschedule");

  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "https://map.example.test/schedule");
  assert.deepEqual(exchangedCodes, ["one-time-code"]);
  assert.equal(cookieWrites.length, 1);
  assert.equal(cookieWrites[0]?.name, "sb-session");
});

test("schedule OAuth missing-code and exchange failures return to schedule", async () => {
  let response = await callback("next=%2Fschedule");
  assert.equal(response.status, 307);
  assert.equal(
    response.headers.get("location"),
    "https://map.example.test/schedule?auth_error=oauth",
  );
  assert.deepEqual(exchangedCodes, []);

  exchangeError = new Error("exchange failed");
  response = await callback("code=bad-code&next=%2Fschedule");
  assert.equal(response.status, 307);
  assert.equal(
    response.headers.get("location"),
    "https://map.example.test/schedule?auth_error=oauth",
  );
  assert.deepEqual(exchangedCodes, ["bad-code"]);
  assert.equal(cookieWrites.length, 1);
});

test("owner OAuth remains compatible for success and failure", async () => {
  let response = await callback("code=owner-code&next=%2Fowner");
  assert.equal(response.headers.get("location"), "https://map.example.test/owner");

  response = await callback("next=%2Fowner");
  assert.equal(
    response.headers.get("location"),
    "https://map.example.test/owner/login?error=oauth",
  );
});

test("external or malformed next cannot control success or failure redirects", async () => {
  let response = await callback(
    "code=external-code&next=https%3A%2F%2Fevil.example%2Fsteal",
  );
  assert.equal(response.headers.get("location"), "https://map.example.test/");
  assert.deepEqual(exchangedCodes, ["external-code"]);

  response = await callback("next=%2F%2Fevil.example%2Fsteal");
  assert.equal(
    response.headers.get("location"),
    "https://map.example.test/owner/login?error=oauth",
  );
  assert.deepEqual(exchangedCodes, ["external-code"]);
});
