import assert from "node:assert/strict";
import test, { mock } from "node:test";

const originalEnvironment = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

let rpcCalls: Array<{ name: string; parameters: unknown }> = [];
let rpcError: { message: string } | null = null;

mock.module("@/lib/supabase/server-client", {
  namedExports: {
    getSupabaseServiceRoleClient() {
      return {
        async rpc(name: string, parameters?: unknown) {
          rpcCalls.push({ name, parameters });
          return { data: null, error: rpcError };
        },
      };
    },
  },
});

const cleanupModule = import("./verification-documents.ts");

function reset() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project-ref.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
  rpcCalls = [];
  rpcError = null;
}

test.beforeEach(reset);
test.after(() => {
  for (const [name, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

test("fails closed before client creation when required service credentials are absent", async () => {
  const { reclaimExpiredVerificationDocuments, VerificationDocumentCleanupError } =
    await cleanupModule;

  for (const missing of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    reset();
    delete process.env[missing];
    await assert.rejects(
      reclaimExpiredVerificationDocuments(),
      VerificationDocumentCleanupError,
    );
    assert.equal(rpcCalls.length, 0);
  }
});

test("calls only the service-role cleanup RPC and returns a non-sensitive result", async () => {
  const { reclaimExpiredVerificationDocuments } = await cleanupModule;
  const result = await reclaimExpiredVerificationDocuments();
  assert.deepEqual(rpcCalls, [{
    name: "delete_expired_verification_documents",
    parameters: undefined,
  }]);
  assert.deepEqual(result, { completed: true });
});

test("converts database details to a generic cleanup error", async () => {
  rpcError = { message: "private document path and database relation" };
  const { reclaimExpiredVerificationDocuments, VerificationDocumentCleanupError } =
    await cleanupModule;
  await assert.rejects(
    reclaimExpiredVerificationDocuments(),
    (error: unknown) =>
      error instanceof VerificationDocumentCleanupError
      && error.message === "Unable to reclaim verification documents."
      && !error.message.includes("private document"),
  );
});
