import assert from "node:assert/strict";
import test, { mock } from "node:test";

type Cookie = {
  name: string;
  value: string;
  options?: Record<string, unknown>;
};

let exchangeError: Error | null = null;
let exchangeRejection: Error | null = null;
let initializationError: Error | null = null;
let invalidCookieWrite = false;
let exchangedCodes: string[] = [];
let cookieAdapter: { setAll(cookies: Cookie[]): void } | null = null;

const supabase = {
  auth: {
    async exchangeCodeForSession(code: string) {
      exchangedCodes.push(code);
      if (exchangeRejection) throw exchangeRejection;
      if (invalidCookieWrite) {
        cookieAdapter?.setAll(null as unknown as Cookie[]);
      } else if (!exchangeError) {
        cookieAdapter?.setAll([
          {
            name: "sb-session",
            value: "opaque-session",
            options: { httpOnly: true, path: "/" },
          },
          {
            name: "sb-verifier",
            value: "",
            options: { maxAge: 0, path: "/" },
          },
        ]);
      } else {
        cookieAdapter?.setAll([
          {
            name: "sb-verifier",
            value: "",
            options: { maxAge: 0, path: "/" },
          },
        ]);
      }
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
      if (initializationError) throw initializationError;
      cookieAdapter = options.cookies;
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
        set() {},
      };
    },
  },
});

const routeModule = import("./route.ts");

function reset() {
  exchangeError = null;
  exchangeRejection = null;
  initializationError = null;
  invalidCookieWrite = false;
  exchangedCodes = [];
  cookieAdapter = null;
}

async function callback(query: string) {
  const { GET } = await routeModule;
  return GET(new Request(`https://map.example.test/auth/callback?${query}`));
}

test.beforeEach(reset);

test("schedule OAuth success redirects to schedule and exchanges the code", async () => {
  const response = await callback("code=one-time-code&next=%2Fschedule");

  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "/schedule");
  assert.deepEqual(exchangedCodes, ["one-time-code"]);
  assert.deepEqual(
    response.cookies.getAll().map(({ name, value }) => ({ name, value })),
    [
      { name: "sb-session", value: "opaque-session" },
      { name: "sb-verifier", value: "" },
    ],
  );
  assert.match(response.headers.get("set-cookie") ?? "", /sb-session=opaque-session/);
});

test("schedule OAuth missing-code and exchange failures return to schedule", async () => {
  let response = await callback("next=%2Fschedule");
  assert.equal(response.status, 307);
  assert.equal(
    response.headers.get("location"),
    "/schedule?auth_error=oauth",
  );
  assert.deepEqual(exchangedCodes, []);

  exchangeError = new Error("exchange failed");
  response = await callback("code=bad-code&next=%2Fschedule");
  assert.equal(response.status, 307);
  assert.equal(
    response.headers.get("location"),
    "/schedule?auth_error=oauth",
  );
  assert.deepEqual(exchangedCodes, ["bad-code"]);
  assert.deepEqual(
    response.cookies.getAll().map(({ name, value }) => ({ name, value })),
    [{ name: "sb-verifier", value: "" }],
  );
  assert.equal(
    (response.headers.get("set-cookie") ?? "").includes("sb-session="),
    false,
  );
});

test("owner OAuth remains compatible for success and failure", async () => {
  let response = await callback("code=owner-code&next=%2Fowner");
  assert.equal(response.headers.get("location"), "/owner");

  response = await callback("next=%2Fowner");
  assert.equal(
    response.headers.get("location"),
    "/owner/login?error=oauth",
  );
});

test("external or malformed next cannot control success or failure redirects", async () => {
  let response = await callback(
    "code=external-code&next=https%3A%2F%2Fevil.example%2Fsteal",
  );
  assert.equal(response.headers.get("location"), "/");
  assert.deepEqual(exchangedCodes, ["external-code"]);

  response = await callback("next=%2F%2Fevil.example%2Fsteal");
  assert.equal(
    response.headers.get("location"),
    "/owner/login?error=oauth",
  );
  assert.deepEqual(exchangedCodes, ["external-code"]);
});

test("boarding-house success and failure preserve a validated listing continuation", async () => {
  let response = await callback(
    "code=review-code&next=%2Fboarding-houses%2Fgreen-gate-abc123",
  );
  assert.equal(
    response.headers.get("location"),
    "/boarding-houses/green-gate-abc123",
  );

  response = await callback("next=%2Fboarding-houses%2Fgreen-gate-abc123");
  assert.equal(
    response.headers.get("location"),
    "/boarding-houses/green-gate-abc123?auth_error=oauth",
  );
});

test("callback failures are generic for rejected exchange, initialization, and cookie writes", async () => {
  exchangeRejection = new Error("secret exchange detail");
  let response = await callback("code=rejected&next=%2Fschedule");
  assert.equal(response.headers.get("location"), "/schedule?auth_error=oauth");
  assert.equal(response.cookies.getAll().length, 0);

  reset();
  initializationError = new Error("secret initialization detail");
  response = await callback("code=init&next=%2Fschedule");
  assert.equal(response.headers.get("location"), "/schedule?auth_error=oauth");
  assert.equal(response.cookies.getAll().length, 0);

  reset();
  invalidCookieWrite = true;
  response = await callback("code=cookie&next=%2Fschedule");
  assert.equal(response.headers.get("location"), "/schedule?auth_error=oauth");
  assert.equal(response.cookies.getAll().length, 0);
});

test("redirect locations stay relative under a hostile request origin", async () => {
  const { GET } = await routeModule;
  const response = await GET(
    new Request(
      "https://attacker.example/auth/callback?code=hostile&next=%2Fschedule",
      { headers: { host: "attacker.example" } },
    ),
  );

  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "/schedule");
  assert.equal(response.headers.get("location")?.includes("attacker.example"), false);
});
