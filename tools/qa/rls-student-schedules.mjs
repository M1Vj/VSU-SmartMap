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

let defaultExpectedUserId;
function mutation(
  id,
  expectedRevision,
  operation,
  payload,
  mutationId = randomUUID(),
  expectedUserId = defaultExpectedUserId,
) {
  return {
    p_expected_user_id: expectedUserId,
    p_mutation_id: mutationId,
    p_course_id: id,
    p_expected_revision: expectedRevision,
    p_operation: operation,
    p_payload: payload,
  };
}

function sequenceLastValue() {
  return Number.parseInt(
    execFileSync(
      "docker",
      [
        "exec",
        "supabase_db_vsu-smartmap",
        "psql",
        "-U",
        "postgres",
        "-d",
        "postgres",
        "-Atc",
        "SELECT last_value FROM public.student_schedule_server_version_seq",
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    ).trim(),
    10,
  );
}

function seedDeletedScheduleRows(userId, count) {
  execFileSync(
    "docker",
    [
      "exec",
      "supabase_db_vsu-smartmap",
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `
        INSERT INTO public.student_schedule_courses (
          user_id,
          id,
          payload,
          last_mutation_id,
          deleted_at
        )
        SELECT
          '${userId}'::uuid,
          gen_random_uuid(),
          NULL,
          gen_random_uuid(),
          clock_timestamp()
        FROM generate_series(1, ${count});
      `,
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
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
    for (const label of ["a", "b", "c"]) {
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
    const [userA, userB, userC] = clients;
    const [userAId, userBId, userCId] = createdUserIds;
    defaultExpectedUserId = userAId;

    console.log("Student schedule adversarial matrix (loopback Supabase only)\n");

    const anonRead = await anon.from("student_schedule_courses").select("*");
    check("anon cannot read schedules", anonRead.error?.code === "42501", anonRead.error?.message);
    const anonCourseId = randomUUID();
    const anonRpc = await anon.rpc(
      "apply_student_schedule_mutation",
      mutation(anonCourseId, 0, "upsert", { id: anonCourseId }),
    );
    check(
      "anon cannot execute mutation RPC by privilege",
      anonRpc.error?.code === "42501"
        || /permission denied/i.test(anonRpc.error?.message ?? ""),
      anonRpc.error?.message,
    );
    const swappedAccountId = randomUUID();
    const swappedAccountRpc = await userB.rpc(
      "apply_student_schedule_mutation",
      mutation(
        swappedAccountId,
        0,
        "upsert",
        { id: swappedAccountId },
        undefined,
        userAId,
      ),
    );
    check(
      "authenticated account swap cannot write through another expected user",
      swappedAccountRpc.error?.code === "42501",
      swappedAccountRpc.error?.message,
    );

    const missingDeleteId = randomUUID();
    const missingMutationId = randomUUID();
    const rowsBeforeMissingDeletes = await userA
      .from("student_schedule_courses")
      .select("id", { count: "exact", head: true });
    const sequenceBeforeMissingDeletes = sequenceLastValue();
    const firstMissingDelete = await userA.rpc(
      "apply_student_schedule_mutation",
      mutation(missingDeleteId, 0, "delete", null, missingMutationId),
    );
    const repeatedMissingDelete = await userA.rpc(
      "apply_student_schedule_mutation",
      mutation(missingDeleteId, 0, "delete", null, missingMutationId),
    );
    const randomMissingDeletes = await Promise.all(
      Array.from({ length: 25 }, () => {
        const id = randomUUID();
        return userA.rpc(
          "apply_student_schedule_mutation",
          mutation(id, 0, "delete", null),
        );
      }),
    );
    const rowsAfterMissingDeletes = await userA
      .from("student_schedule_courses")
      .select("id", { count: "exact", head: true });
    const sequenceAfterMissingDeletes = sequenceLastValue();
    check(
      "missing delete returns deterministic canonical no-op",
      !firstMissingDelete.error
        && firstMissingDelete.data?.[0]?.status === "deleted"
        && firstMissingDelete.data?.[0]?.id === missingDeleteId
        && firstMissingDelete.data?.[0]?.payload === null
        && firstMissingDelete.data?.[0]?.revision === 0
        && firstMissingDelete.data?.[0]?.server_version === null
        && firstMissingDelete.data?.[0]?.created_at === null
        && firstMissingDelete.data?.[0]?.updated_at === null
        && firstMissingDelete.data?.[0]?.deleted_at === null,
      firstMissingDelete.error?.message,
    );
    check(
      "repeated missing delete returns the same canonical result",
      !repeatedMissingDelete.error
        && JSON.stringify(repeatedMissingDelete.data) === JSON.stringify(firstMissingDelete.data),
      repeatedMissingDelete.error?.message,
    );
    check(
      "many missing deletes all succeed without persistence",
      randomMissingDeletes.every(
        (result) => !result.error && result.data?.[0]?.status === "deleted",
      )
        && rowsAfterMissingDeletes.count === rowsBeforeMissingDeletes.count
        && sequenceAfterMissingDeletes === sequenceBeforeMissingDeletes,
      `${rowsBeforeMissingDeletes.count}→${rowsAfterMissingDeletes.count} rows, sequence ${sequenceBeforeMissingDeletes}→${sequenceAfterMissingDeletes}`,
    );
    const missingConflict = await userA.rpc(
      "apply_student_schedule_mutation",
      mutation(randomUUID(), 1, "delete", null),
    );
    check(
      "missing delete with nonzero expected revision conflicts",
      !missingConflict.error && missingConflict.data?.[0]?.status === "conflict",
      missingConflict.error?.message,
    );

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
        mutation(id, 0, "upsert", { id, title: "Boundary course" }, undefined, userBId),
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
      mutation(extraId, 0, "upsert", { id: extraId, title: "Course 201" }, undefined, userBId),
    );
    check("course 201 is rejected", Boolean(extra.error));
    const afterExtra = await userB
      .from("student_schedule_courses")
      .select("id", { count: "exact", head: true });
    check("rejected course does not overshoot quota", afterExtra.count === 200);

    seedDeletedScheduleRows(userCId, 999);
    const totalBoundaryIds = [randomUUID(), randomUUID()];
    const totalBoundaryMutations = [randomUUID(), randomUUID()];
    const totalBoundaryResults = await Promise.all(
      totalBoundaryIds.map((id, index) =>
        userC.rpc(
          "apply_student_schedule_mutation",
          mutation(
            id,
            0,
            "upsert",
            { id, title: "Total row boundary" },
            totalBoundaryMutations[index],
            userCId,
          ),
        ),
      ),
    );
    check(
      "concurrent total-row boundary accepts exactly row 1000",
      totalBoundaryResults.filter((result) => !result.error).length === 1
        && totalBoundaryResults.filter((result) => Boolean(result.error)).length === 1,
      `${totalBoundaryResults.filter((result) => !result.error).length} accepted`,
    );
    const totalBoundaryCount = await userC
      .from("student_schedule_courses")
      .select("id", { count: "exact", head: true });
    check(
      "concurrent total-row attempts cannot create row 1001",
      !totalBoundaryCount.error && totalBoundaryCount.count === 1000,
      `${totalBoundaryCount.count} rows`,
    );
    const privilegedOverflow = await service
      .from("student_schedule_courses")
      .insert({
        user_id: userCId,
        id: randomUUID(),
        payload: null,
        last_mutation_id: randomUUID(),
        deleted_at: new Date().toISOString(),
      });
    const countAfterPrivilegedOverflow = await userC
      .from("student_schedule_courses")
      .select("id", { count: "exact", head: true });
    check(
      "table trigger independently rejects privileged row 1001",
      Boolean(privilegedOverflow.error)
        && countAfterPrivilegedOverflow.count === 1000,
      privilegedOverflow.error?.message,
    );

    const acceptedBoundaryIndex = totalBoundaryResults.findIndex(
      (result) => !result.error,
    );
    const acceptedBoundaryReplay = acceptedBoundaryIndex < 0
      ? { data: null, error: new Error("No boundary mutation was accepted.") }
      : await userC.rpc(
          "apply_student_schedule_mutation",
          mutation(
            totalBoundaryIds[acceptedBoundaryIndex],
            0,
            "upsert",
            {
              id: totalBoundaryIds[acceptedBoundaryIndex],
              title: "Total row boundary",
            },
            totalBoundaryMutations[acceptedBoundaryIndex],
            userCId,
          ),
        );
    check(
      "row-cap enforcement preserves accepted mutation replay",
      !acceptedBoundaryReplay.error
        && acceptedBoundaryReplay.data?.[0]?.status === "replayed",
      acceptedBoundaryReplay.error?.message,
    );

    const cappedMissingDeleteId = randomUUID();
    const cappedMissingDelete = await userC.rpc(
      "apply_student_schedule_mutation",
      mutation(cappedMissingDeleteId, 0, "delete", null, undefined, userCId),
    );
    const countAfterCappedMissingDelete = await userC
      .from("student_schedule_courses")
      .select("id", { count: "exact", head: true });
    check(
      "missing delete remains a non-persisting no-op at the total cap",
      !cappedMissingDelete.error
        && cappedMissingDelete.data?.[0]?.status === "deleted"
        && countAfterCappedMissingDelete.count === 1000,
      cappedMissingDelete.error?.message,
    );

  } finally {
    for (const userId of createdUserIds) {
      try {
        const cleanup = await service.auth.admin.deleteUser(userId);
        check(
          `cleanup removes local test user ${userId.slice(0, 8)}`,
          !cleanup.error,
          cleanup.error?.message,
        );
        const remaining = await service
          .from("student_schedule_courses")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId);
        check(
          `cleanup cascades schedule rows for ${userId.slice(0, 8)}`,
          !remaining.error && remaining.count === 0,
          remaining.error?.message ?? `${remaining.count} rows remain`,
        );
      } catch (error) {
        check(
          `cleanup removes local test user ${userId.slice(0, 8)}`,
          false,
          error instanceof Error ? error.message : String(error),
        );
      }
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exitCode = failed > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error(`Student schedule RLS harness error: ${error.message}`);
  process.exit(2);
});
