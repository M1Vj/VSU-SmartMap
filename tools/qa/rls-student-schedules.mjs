import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { assertLocalSupabaseUrl, parseSupabaseEnv } from "../dev/local-supabase.mjs";

const PASSWORD = "LocalScheduleSync123!";

function localEnvironment() {
  const output = execFileSync(
    "npx",
    ["--yes", "supabase@2.107.0", "status", "-o", "env"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  const env = parseSupabaseEnv(output);
  return {
    url: assertLocalSupabaseUrl(env.API_URL),
    anonKey: env.ANON_KEY || env.PUBLISHABLE_KEY,
    serviceKey: env.SERVICE_ROLE_KEY || env.SECRET_KEY,
  };
}

function browserClient(url, anonKey) {
  return createClient(url, anonKey, { auth: { persistSession: false } });
}

async function waitForSchemaCache(client) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const result = await client.from("student_schedule_courses").select("id").limit(1);
    if (result.error?.code !== "PGRST002") return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Local PostgREST schema cache did not become ready.");
}

function mutation(id, expectedRevision, operation, payload, mutationId = randomUUID()) {
  return {
    p_mutation_id: mutationId,
    p_course_id: id,
    p_expected_revision: expectedRevision,
    p_operation: operation,
    p_payload: payload,
  };
}

let passed = 0;
let failed = 0;
function check(name, ok, detail = "") {
  if (ok) {
    passed += 1;
    console.log(`  ✔ ${name}`);
  } else {
    failed += 1;
    console.log(`  ✖ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main() {
  const { url, anonKey, serviceKey } = localEnvironment();
  if (!anonKey || !serviceKey) throw new Error("Local Supabase API keys are unavailable.");

  const anon = browserClient(url, anonKey);
  const service = createClient(url, serviceKey, { auth: { persistSession: false } });
  const suffix = randomUUID();
  const createdUserIds = [];

  try {
    await waitForSchemaCache(anon);
    const clients = [];
    for (const label of ["a", "b"]) {
      const email = `schedule-${label}-${suffix}@local.smartmap.invalid`;
      const { data, error } = await service.auth.admin.createUser({
        email,
        password: PASSWORD,
        email_confirm: true,
      });
      if (error || !data.user) throw new Error(error?.message ?? `Unable to create user ${label}`);
      createdUserIds.push(data.user.id);
      const client = browserClient(url, anonKey);
      const signIn = await client.auth.signInWithPassword({ email, password: PASSWORD });
      if (signIn.error) throw new Error(signIn.error.message);
      clients.push(client);
    }
    const [userA, userB] = clients;
    const [userAId, userBId] = createdUserIds;

    console.log("Student schedule adversarial matrix (loopback Supabase only)\n");

    const anonRead = await anon.from("student_schedule_courses").select("*");
    check("anon cannot read schedules", anonRead.error?.code === "42501", anonRead.error?.message);
    const anonRpc = await anon.rpc(
      "apply_student_schedule_mutation",
      mutation(randomUUID(), 0, "upsert", { id: randomUUID() }),
    );
    check("anon cannot execute mutation RPC", Boolean(anonRpc.error), anonRpc.error?.message);

    const courseId = randomUUID();
    const mutationId = randomUUID();
    const firstPayload = { id: courseId, title: "Algorithms" };
    const first = await userA.rpc(
      "apply_student_schedule_mutation",
      mutation(courseId, 0, "upsert", firstPayload, mutationId),
    );
    check("user A RPC creates its course", !first.error && first.data?.[0]?.status === "upserted", first.error?.message);
    check("created row has revision 1", first.data?.[0]?.revision === 1);

    const replay = await userA.rpc(
      "apply_student_schedule_mutation",
      mutation(courseId, 0, "upsert", firstPayload, mutationId),
    );
    check(
      "same mutation id replays canonical row",
      !replay.error
        && replay.data?.[0]?.status === "replayed"
        && replay.data?.[0]?.server_version === first.data?.[0]?.server_version,
      replay.error?.message,
    );

    const conflict = await userA.rpc(
      "apply_student_schedule_mutation",
      mutation(courseId, 0, "upsert", { id: courseId, title: "Wrong revision" }),
    );
    check("revision mismatch returns canonical conflict", !conflict.error && conflict.data?.[0]?.status === "conflict");

    const ownRead = await userA.from("student_schedule_courses").select("*").eq("id", courseId);
    check("user A reads its own course", !ownRead.error && ownRead.data?.length === 1);
    const foreignRead = await userB.from("student_schedule_courses").select("*").eq("user_id", userAId);
    check("user B cannot discover user A course", !foreignRead.error && foreignRead.data?.length === 0);

    for (const [name, request] of [
      ["insert", userA.from("student_schedule_courses").insert({
        user_id: userAId,
        id: randomUUID(),
        payload: null,
        last_mutation_id: randomUUID(),
        deleted_at: new Date().toISOString(),
      })],
      ["update", userA.from("student_schedule_courses").update({ payload: firstPayload }).eq("id", courseId)],
      ["delete", userA.from("student_schedule_courses").delete().eq("id", courseId)],
      ["foreign update", userB.from("student_schedule_courses").update({ payload: firstPayload }).eq("user_id", userAId)],
      ["foreign delete", userB.from("student_schedule_courses").delete().eq("user_id", userAId)],
    ]) {
      const result = await request;
      check(`direct ${name} is denied`, result.error?.code === "42501", result.error?.message);
    }

    const invalidId = await userA.rpc(
      "apply_student_schedule_mutation",
      mutation(randomUUID(), 0, "upsert", { id: randomUUID() }),
    );
    check("payload id mismatch is rejected", Boolean(invalidId.error));
    const oversizedId = randomUUID();
    const oversized = await userA.rpc(
      "apply_student_schedule_mutation",
      mutation(oversizedId, 0, "upsert", { id: oversizedId, notes: "x".repeat(32769) }),
    );
    check("oversized payload is rejected", Boolean(oversized.error));

    const deleted = await userA.rpc(
      "apply_student_schedule_mutation",
      mutation(courseId, 1, "delete", null),
    );
    check(
      "delete tombstones and erases payload",
      !deleted.error && deleted.data?.[0]?.payload === null && Boolean(deleted.data?.[0]?.deleted_at),
      deleted.error?.message,
    );
    const resurrectedPayload = { id: courseId, title: "Algorithms II" };
    const resurrected = await userA.rpc(
      "apply_student_schedule_mutation",
      mutation(courseId, 2, "upsert", resurrectedPayload),
    );
    check(
      "upsert resurrects a tombstone",
      !resurrected.error
        && resurrected.data?.[0]?.deleted_at === null
        && resurrected.data?.[0]?.revision === 3,
      resurrected.error?.message,
    );

    const immutableUser = await service
      .from("student_schedule_courses")
      .update({ user_id: userBId })
      .eq("user_id", userAId)
      .eq("id", courseId);
    check("trigger rejects user identity changes", Boolean(immutableUser.error));
    const immutableId = await service
      .from("student_schedule_courses")
      .update({ id: randomUUID() })
      .eq("user_id", userAId)
      .eq("id", courseId);
    check("trigger rejects course identity changes", Boolean(immutableId.error));

    const boundaryCalls = Array.from({ length: 200 }, () => {
      const id = randomUUID();
      return userB.rpc(
        "apply_student_schedule_mutation",
        mutation(id, 0, "upsert", { id, title: "Boundary course" }),
      );
    });
    const boundaryResults = await Promise.all(boundaryCalls);
    check(
      "concurrent boundary accepts exactly 200 courses",
      boundaryResults.filter((result) => !result.error).length === 200,
      `${boundaryResults.filter((result) => !result.error).length} accepted`,
    );
    const count = await userB
      .from("student_schedule_courses")
      .select("id", { count: "exact", head: true });
    check("active count has no overshoot", !count.error && count.count === 200, `${count.count} rows`);
    const extraId = randomUUID();
    const extra = await userB.rpc(
      "apply_student_schedule_mutation",
      mutation(extraId, 0, "upsert", { id: extraId, title: "Course 201" }),
    );
    check("course 201 is rejected", Boolean(extra.error));
    const afterExtra = await userB
      .from("student_schedule_courses")
      .select("id", { count: "exact", head: true });
    check("rejected course does not overshoot quota", afterExtra.count === 200);

    console.log(`\n${passed} passed, ${failed} failed`);
    process.exitCode = failed > 0 ? 1 : 0;
  } finally {
    for (const userId of createdUserIds) {
      await service.auth.admin.deleteUser(userId);
    }
  }
}

main().catch((error) => {
  console.error(`Student schedule RLS harness error: ${error.message}`);
  process.exit(2);
});
