import assert from "node:assert/strict";
import test, { mock } from "node:test";

const SUGGESTION_ID = "550e8400-e29b-41d4-a716-446655440000";
let authorized = false;
let authCalls = 0;
let lookupCalls = 0;
let signedUrl: string | null = "https://signed.test/proof.webp?token=opaque";

const serviceClient = { marker: "admin-scoped-service-client" };

mock.module("@/lib/auth/server", {
  namedExports: {
    async assertAdminAction() {
      authCalls += 1;
      return authorized ? { serviceClient } : { error: "Unauthorized" };
    },
  },
});

mock.module("@/lib/storage/event-proofs", {
  namedExports: {
    async createAdminEventProofSignedUrl(
      client: unknown,
      suggestionId: string,
      projectUrl: string,
      ttl: number,
    ) {
      lookupCalls += 1;
      assert.equal(client, serviceClient);
      assert.equal(suggestionId, SUGGESTION_ID);
      assert.equal(projectUrl, "https://project-ref.supabase.co");
      assert.equal(ttl, 300);
      return signedUrl;
    },
  },
});

const routeModule = import("./route.ts");

function reset() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project-ref.supabase.co";
  authorized = false;
  authCalls = 0;
  lookupCalls = 0;
  signedUrl = "https://signed.test/proof.webp?token=opaque";
}

test.beforeEach(reset);

test("denies anonymous and non-admin callers before evidence lookup", async () => {
  const { GET } = await routeModule;
  const response = await GET(new Request("https://example.test"), {
    params: Promise.resolve({ id: SUGGESTION_ID }),
  });
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "Evidence unavailable." });
  assert.equal(authCalls, 1);
  assert.equal(lookupCalls, 0);
});

test("redirects an admin to a short-lived signed URL without caching", async () => {
  authorized = true;
  const { GET } = await routeModule;
  const response = await GET(new Request("https://example.test"), {
    params: Promise.resolve({ id: SUGGESTION_ID }),
  });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), signedUrl);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(authCalls, 1);
  assert.equal(lookupCalls, 1);
});

test("uses the same generic denial for invalid, missing, or deleted evidence", async () => {
  authorized = true;
  signedUrl = null;
  const { GET } = await routeModule;
  const response = await GET(new Request("https://example.test"), {
    params: Promise.resolve({ id: SUGGESTION_ID }),
  });
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "Evidence unavailable." });
  assert.equal(response.headers.get("cache-control"), "no-store");
});
