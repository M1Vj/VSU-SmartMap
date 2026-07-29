import assert from "node:assert/strict";
import test, { mock } from "node:test";

type RoleLookupError = {
  code: string;
  message: string;
};

let currentUserId: string | null = "user-1";
let roleError: RoleLookupError | null = null;
let clientCalls = 0;
let roleCalls = 0;
let failure: "none" | "constructor" | "get-user" = "none";

const response = {
  kind: "next",
  cookies: { set() {} },
};

mock.module("next/server", {
  namedExports: {
    NextResponse: {
      next() {
        return response;
      },
      redirect(url: URL) {
        return { kind: "redirect", pathname: url.pathname };
      },
    },
  },
});

mock.module("@supabase/ssr", {
  namedExports: {
    createServerClient() {
      clientCalls += 1;
      if (failure === "constructor") throw new Error("constructor detail");
      return {
        auth: {
          async getUser() {
            if (failure === "get-user") throw new TypeError("network detail");
            return {
              data: {
                user: currentUserId ? {
                  id: currentUserId,
                  app_metadata: {},
                  user_metadata: { role: "admin", roles: ["admin"] },
                } : null,
              },
            };
          },
        },
        from(table: string) {
          roleCalls += 1;
          assert.equal(table, "app_user_roles");
          return {
            select() {
              return this;
            },
            async eq() {
              return { data: [], error: roleError };
            },
          };
        },
      };
    },
  },
});

const middlewareModule = import("./middleware.ts");

function createRequest(pathname = "/admin") {
  return {
    cookies: {
      getAll() {
        return [];
      },
      set() {},
    },
    nextUrl: {
      pathname,
      clone() {
        return new URL(`https://example.test${pathname}`);
      },
    },
  };
}

async function withPublicConfig<T>(
  url: string | undefined,
  key: string | undefined,
  run: () => Promise<T>,
): Promise<T> {
  const priorUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const priorKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = url;
  if (key === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = key;
  try {
    return await run();
  } finally {
    if (priorUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = priorUrl;
    if (priorKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = priorKey;
  }
}

function resetAuthHarness() {
  clientCalls = 0;
  roleCalls = 0;
  failure = "none";
  currentUserId = null;
  roleError = null;
}

test("missing or malformed config keeps schedule public without constructing auth", async () => {
  const { updateSession } = await middlewareModule;
  for (const [url, key] of [
    [undefined, undefined],
    ["not-a-url", "key"],
    ["ftp://example.test", "key"],
    ["https://example.test", "   "],
  ] as const) {
    resetAuthHarness();
    const result = await withPublicConfig(url, key, () =>
      updateSession(createRequest("/schedule") as never));
    assert.equal(result, response);
    assert.equal(clientCalls, 0);
    assert.equal(roleCalls, 0);
  }
});

test("invalid config fails closed for protected routes but leaves auth entry routes public", async () => {
  const { updateSession } = await middlewareModule;
  for (const [path, expected] of [
    ["/admin", "/admin/login"],
    ["/owner", "/owner/login"],
  ]) {
    resetAuthHarness();
    const result = await withPublicConfig("bad", "key", () =>
      updateSession(createRequest(path) as never));
    assert.deepEqual(result, { kind: "redirect", pathname: expected });
    assert.equal(clientCalls, 0);
  }
  for (const path of ["/admin/login", "/owner/login", "/owner/apply"]) {
    resetAuthHarness();
    const result = await withPublicConfig("bad", "key", () =>
      updateSession(createRequest(path) as never));
    assert.equal(result, response);
  }
});

for (const failingAt of ["constructor", "get-user"] as const) {
  test(`${failingAt} failure does not 500 public routes and fails closed protected routes`, async () => {
    const { updateSession } = await middlewareModule;
    for (const [path, expected] of [
      ["/schedule", undefined],
      ["/admin", "/admin/login"],
      ["/owner", "/owner/login"],
    ] as const) {
      resetAuthHarness();
      failure = failingAt;
      const result = await withPublicConfig(
        "https://example.test",
        "key",
        () => updateSession(createRequest(path) as never),
      );
      assert.deepEqual(
        result,
        expected ? { kind: "redirect", pathname: expected } : response,
      );
      assert.equal(roleCalls, 0);
    }
  });
}

test("middleware role lookup failure grants no admin role", async () => {
  currentUserId = "user-1";
  roleError = {
    code: "PGRST205",
    message: "Could not find the table 'public.app_user_roles' in the schema cache",
  };
  process.env.ALLOW_MISSING_ROLE_TABLE_ADMIN_FALLBACK = "true";
  process.env.ALLOW_LEGACY_USER_METADATA_ROLES = "true";
  const { updateSession } = await middlewareModule;

  try {
    failure = "none";
    const result = await withPublicConfig("https://example.test", "key", () =>
      updateSession(createRequest() as never));
    assert.deepEqual(result, { kind: "redirect", pathname: "/admin/login" });
  } finally {
    delete process.env.ALLOW_MISSING_ROLE_TABLE_ADMIN_FALLBACK;
    delete process.env.ALLOW_LEGACY_USER_METADATA_ROLES;
  }
});

test("middleware role lookup failure preserves explicit break-glass admin access", async () => {
  currentUserId = "break-glass-user";
  roleError = {
    code: "PGRST205",
    message: "Could not find the table 'public.app_user_roles' in the schema cache",
  };
  process.env.BREAK_GLASS_ADMIN_USER_IDS = currentUserId;
  const { updateSession } = await middlewareModule;

  try {
    failure = "none";
    const result = await withPublicConfig("https://example.test", "key", () =>
      updateSession(createRequest() as never));
    assert.equal(result, response);
  } finally {
    delete process.env.BREAK_GLASS_ADMIN_USER_IDS;
  }
});
