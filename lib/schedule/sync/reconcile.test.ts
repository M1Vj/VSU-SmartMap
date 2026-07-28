import assert from "node:assert/strict";
import test from "node:test";
import type { ScheduleOutboxMutation } from "../local-types";
import type { ScheduleCourse } from "../types";
import {
  reconcileScheduleSources,
  resolvePulledRow,
} from "./reconcile";
import type { CloudScheduleRow } from "./types";

const IDS = {
  guest: "00000000-0000-4000-8000-000000000001",
  local: "00000000-0000-4000-8000-000000000002",
  cloud: "00000000-0000-4000-8000-000000000003",
  meeting: "00000000-0000-4000-8000-000000000004",
  mutation: "00000000-0000-4000-8000-000000000005",
} as const;

function course(id: string, title = "Algorithms"): ScheduleCourse {
  return {
    id,
    code: "CS 101",
    title,
    color: "blue",
    meetings: [
      {
        id: IDS.meeting,
        days: [1],
        startMinute: 480,
        endMinute: 540,
      },
    ],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
  };
}

function cloudRow(
  value: ScheduleCourse | null,
  revision = 2,
): CloudScheduleRow {
  return {
    id: value?.id ?? IDS.local,
    payload: value,
    revision,
    serverVersion: revision,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-03T00:00:00.000Z",
    ...(value === null ? { deletedAt: "2026-01-03T00:00:00.000Z" } : {}),
  };
}

function mutation(
  operation: "upsert" | "delete",
  expectedRevision: number,
): ScheduleOutboxMutation {
  return {
    mutationId: IDS.mutation,
    scope: "user:00000000-0000-4000-8000-000000000006",
    courseId: IDS.local,
    expectedRevision,
    operation,
    ...(operation === "upsert" ? { course: course(IDS.local, "Local") } : {}),
    createdAt: "2026-01-04T00:00:00.000Z",
  };
}

function numberedId(value: number): string {
  return `00000000-0000-4000-8000-${value.toString(16).padStart(12, "0")}`;
}

test("distinct IDs merge with provenance in stable ID order", () => {
  const result = reconcileScheduleSources({
    guest: [course(IDS.guest)],
    accountLocal: [{ course: course(IDS.local), serverRevision: 7 }],
    cloud: [cloudRow(course(IDS.cloud), 9)],
  });
  assert.equal(result.kind, "merge-ready");
  assert.deepEqual(
    result.courses.map(({ course: item, source, revision }) => ({
      id: item.id,
      source,
      revision,
    })),
    [
      { id: IDS.guest, source: "guest", revision: undefined },
      { id: IDS.local, source: "account-local", revision: 7 },
      { id: IDS.cloud, source: "cloud", revision: 9 },
    ],
  );
});

test("semantically identical same-ID documents coalesce without key-order or timestamp dependence", () => {
  const local = course(IDS.local);
  const reordered = {
    updatedAt: "2099-12-31T23:59:59.000Z",
    meetings: local.meetings.map(({ id, ...meeting }) => ({ ...meeting, id })),
    color: local.color,
    title: local.title,
    code: local.code,
    createdAt: "2020-01-01T00:00:00.000Z",
    id: local.id,
  } satisfies ScheduleCourse;
  const result = reconcileScheduleSources({
    guest: [local],
    accountLocal: [{ course: reordered, serverRevision: 4 }],
    cloud: [cloudRow({ ...local, updatedAt: "2025-05-05T00:00:00.000Z" }, 6)],
  });
  assert.equal(result.kind, "merge-ready");
  assert.equal(result.courses.length, 1);
  assert.equal(result.courses[0]?.source, "cloud");
  assert.equal(result.courses[0]?.revision, 6);
});

test("divergent same-ID versions retain every source in stable provenance order", () => {
  const result = reconcileScheduleSources({
    guest: [course(IDS.local, "Guest")],
    accountLocal: [{ course: course(IDS.local, "Local"), serverRevision: 4 }],
    cloud: [cloudRow(course(IDS.local, "Cloud"), 5)],
  });
  assert.equal(result.kind, "conflict");
  assert.deepEqual(result.conflicts[0]?.versions.map((item) => item.source), [
    "guest",
    "account-local",
    "cloud",
  ]);
  assert.deepEqual(result.conflicts[0]?.versions.map((item) => item.revision), [
    undefined,
    4,
    5,
  ]);
});

test("cloud tombstones prevent automatic resurrection and retain provenance in conflicts", () => {
  const result = reconcileScheduleSources({
    guest: [course(IDS.local, "Guest")],
    accountLocal: [{ course: course(IDS.local, "Local"), serverRevision: 4 }],
    cloud: [cloudRow(null, 5)],
  });
  assert.equal(result.kind, "conflict");
  assert.deepEqual(result.conflicts[0]?.versions, [
    {
      kind: "active",
      source: "guest",
      course: course(IDS.local, "Guest"),
    },
    {
      kind: "active",
      source: "account-local",
      course: course(IDS.local, "Local"),
      revision: 4,
    },
    {
      kind: "tombstone",
      source: "cloud",
      courseId: IDS.local,
      revision: 5,
      deletedAt: "2026-01-03T00:00:00.000Z",
    },
  ]);
});

test("a cloud tombstone alone produces no active course or conflict", () => {
  const result = reconcileScheduleSources({
    guest: [],
    accountLocal: [],
    cloud: [cloudRow(null, 5)],
  });
  assert.deepEqual(result, { kind: "merge-ready", courses: [] });
});

test("duplicate source IDs and corrupt or mismatched cloud payloads are surfaced", () => {
  assert.equal(
    reconcileScheduleSources({
      guest: [course(IDS.guest), course(IDS.guest)],
      accountLocal: [],
      cloud: [],
    }).kind,
    "invalid",
  );
  const corrupt = cloudRow(course(IDS.cloud));
  corrupt.id = IDS.local;
  const result = reconcileScheduleSources({
    guest: [],
    accountLocal: [],
    cloud: [corrupt, { ...corrupt }],
  });
  assert.equal(result.kind, "invalid");
  if (result.kind === "invalid") {
    assert.deepEqual(result.issues.map((issue) => issue.kind), [
      "duplicate-id",
      "invalid-cloud-payload",
    ]);
  }
});

test("remote tombstone matrix follows expectedRevision without clock winners", () => {
  const local = { course: course(IDS.local), serverRevision: 1 };
  const tombstone = cloudRow(null, 2);
  assert.equal(
    resolvePulledRow({ accountLocal: local, cloud: tombstone }).kind,
    "delete-local",
  );
  assert.equal(
    resolvePulledRow({
      accountLocal: local,
      cloud: tombstone,
      pendingMutation: mutation("upsert", 1),
    }).kind,
    "conflict",
  );
  assert.equal(
    resolvePulledRow({
      accountLocal: local,
      cloud: tombstone,
      pendingMutation: mutation("upsert", 2),
    }).kind,
    "keep-local",
  );
  assert.equal(
    resolvePulledRow({
      accountLocal: local,
      cloud: tombstone,
      pendingMutation: mutation("upsert", 3),
    }).kind,
    "conflict",
  );
  assert.equal(
    resolvePulledRow({
      accountLocal: local,
      cloud: tombstone,
      pendingMutation: mutation("delete", 1),
    }).kind,
    "delete-local",
  );
  assert.equal(
    resolvePulledRow({
      accountLocal: local,
      cloud: tombstone,
      pendingMutation: mutation("delete", 2),
    }).kind,
    "delete-local",
  );
  assert.equal(
    resolvePulledRow({
      accountLocal: local,
      cloud: tombstone,
      pendingMutation: mutation("delete", 3),
    }).kind,
    "delete-local",
  );
  assert.equal(
    resolvePulledRow({
      accountLocal: undefined,
      cloud: tombstone,
      pendingMutation: mutation("upsert", 2),
    }).kind,
    "keep-local",
  );
  assert.equal(
    resolvePulledRow({ accountLocal: undefined, cloud: tombstone }).kind,
    "no-change",
  );
});

test("active remote matrix replaces, keeps, or conflicts by expected revision", () => {
  const local = { course: course(IDS.local, "Local"), serverRevision: 1 };
  const remote = cloudRow(course(IDS.local, "Cloud"), 2);
  assert.equal(
    resolvePulledRow({ accountLocal: local, cloud: remote }).kind,
    "replace-local",
  );
  assert.equal(
    resolvePulledRow({
      accountLocal: local,
      cloud: remote,
      pendingMutation: mutation("upsert", 1),
    }).kind,
    "conflict",
  );
  assert.equal(
    resolvePulledRow({
      accountLocal: local,
      cloud: remote,
      pendingMutation: mutation("upsert", 2),
    }).kind,
    "keep-local",
  );
  assert.equal(
    resolvePulledRow({
      accountLocal: local,
      cloud: remote,
      pendingMutation: mutation("delete", 2),
    }).kind,
    "keep-local",
  );
  assert.equal(
    resolvePulledRow({
      accountLocal: local,
      cloud: remote,
      pendingMutation: mutation("delete", 1),
    }).kind,
    "conflict",
  );
  assert.equal(
    resolvePulledRow({
      accountLocal: local,
      cloud: remote,
      pendingMutation: mutation("delete", 3),
    }).kind,
    "conflict",
  );
  assert.equal(
    resolvePulledRow({
      accountLocal: local,
      cloud: remote,
      pendingMutation: mutation("upsert", 3),
    }).kind,
    "conflict",
  );
});

test("stale active and tombstone pulls never mutate newer account-local state", () => {
  const local = { course: course(IDS.local, "Local"), serverRevision: 3 };
  for (const remote of [cloudRow(course(IDS.local, "Cloud"), 2), cloudRow(null, 2)]) {
    assert.deepEqual(resolvePulledRow({ accountLocal: local, cloud: remote }), {
      kind: "no-change",
      serverRevision: 2,
    });
    assert.deepEqual(
      resolvePulledRow({
        accountLocal: local,
        cloud: remote,
        pendingMutation: mutation("upsert", 2),
      }),
      { kind: "no-change", serverRevision: 2 },
    );
  }
});

test("equal and newer active pulls apply without pending while tombstones delete", () => {
  const local = { course: course(IDS.local, "Local"), serverRevision: 2 };
  for (const revision of [2, 3]) {
    assert.equal(
      resolvePulledRow({
        accountLocal: local,
        cloud: cloudRow(course(IDS.local, "Cloud"), revision),
      }).kind,
      "replace-local",
    );
    assert.equal(
      resolvePulledRow({
        accountLocal: local,
        cloud: cloudRow(null, revision),
      }).kind,
      "delete-local",
    );
  }
  assert.equal(
    resolvePulledRow({
      accountLocal: local,
      cloud: cloudRow(course(IDS.local, "Cloud"), 2),
      pendingMutation: mutation("upsert", 2),
    }).kind,
    "keep-local",
  );
  assert.equal(
    resolvePulledRow({
      accountLocal: local,
      cloud: cloudRow(null, 2),
      pendingMutation: mutation("upsert", 2),
    }).kind,
    "keep-local",
  );
});

test("invalid cloud metadata is quarantined per course while valid output is retained", () => {
  const valid = cloudRow(course(IDS.cloud), 2);
  const invalidCourses = Array.from({ length: 5 }, (_, index) =>
    course(numberedId(index + 20)),
  );
  const invalidRows: CloudScheduleRow[] = [
    { ...cloudRow(course(IDS.local)), id: "NOT-A-UUID" },
    { ...cloudRow(invalidCourses[0]!), revision: 0 },
    { ...cloudRow(invalidCourses[1]!), serverVersion: 1.5 },
    { ...cloudRow(invalidCourses[2]!), createdAt: "not-a-date" },
    {
      ...cloudRow(invalidCourses[3]!),
      deletedAt: "2026-01-03T00:00:00.000Z",
    },
    {
      ...cloudRow(null),
      id: invalidCourses[4]!.id,
      deletedAt: undefined,
    },
  ];
  const result = reconcileScheduleSources({
    guest: [course(IDS.guest)],
    accountLocal: [],
    cloud: [valid, ...invalidRows],
  });
  assert.equal(result.kind, "invalid");
  if (result.kind === "invalid") {
    assert.deepEqual(result.courses.map((item) => item.course.id), [
      IDS.guest,
      IDS.cloud,
    ]);
    assert.equal(result.issues.length, invalidRows.length);
    assert.equal(
      result.issues.every((issue) => issue.kind === "invalid-cloud-row"),
      true,
    );
  }
  assert.equal(
    resolvePulledRow({
      accountLocal: undefined,
      cloud: invalidRows[1]!,
    }).kind,
    "invalid-cloud-row",
  );
});

test("issues are sorted stably by course ID then source", () => {
  const result = reconcileScheduleSources({
    guest: [course(IDS.cloud), course(IDS.cloud)],
    accountLocal: [
      { course: course(IDS.guest) },
      { course: course(IDS.guest) },
    ],
    cloud: [
      { ...cloudRow(course(IDS.local)), revision: 0 },
      { ...cloudRow(course(IDS.guest)), revision: 0 },
    ],
  });
  assert.equal(result.kind, "invalid");
  if (result.kind === "invalid") {
    assert.deepEqual(
      result.issues.map(({ courseId, source }) => [courseId, source]),
      [
        [IDS.guest, "account-local"],
        [IDS.guest, "cloud"],
        [IDS.local, "cloud"],
        [IDS.cloud, "guest"],
      ],
    );
  }
});

test("merged unique active course limit accepts 200 and rejects 201 across sources", () => {
  const courses = Array.from({ length: 201 }, (_, index) =>
    course(numberedId(index + 100), `Course ${index}`),
  );
  const atLimit = reconcileScheduleSources({
    guest: courses.slice(0, 67),
    accountLocal: courses.slice(67, 134).map((item) => ({ course: item })),
    cloud: courses.slice(134, 200).map((item) => cloudRow(item)),
  });
  assert.equal(atLimit.kind, "merge-ready");
  if (atLimit.kind === "merge-ready") assert.equal(atLimit.courses.length, 200);

  const overLimit = reconcileScheduleSources({
    guest: courses.slice(0, 67),
    accountLocal: courses.slice(67, 134).map((item) => ({ course: item })),
    cloud: courses.slice(134).map((item) => cloudRow(item)),
  });
  assert.equal(overLimit.kind, "invalid");
  if (overLimit.kind === "invalid") {
    assert.equal(
      overLimit.issues.some((issue) => issue.kind === "course-limit-exceeded"),
      true,
    );
    assert.equal(overLimit.courses.length, 201);
  }
});
