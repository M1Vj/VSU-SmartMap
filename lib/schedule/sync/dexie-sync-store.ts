import type { VSUDatabase } from "../../db";
import {
  scopedCourseKey,
  type ScheduleOutboxMutation,
  type StoredScheduleConflict,
} from "../local-types";
import {
  createScheduleMutation,
  defaultScheduleMutationDependencies,
  type ScheduleMutationDependencies,
} from "../outbox";
import type { ScheduleScope } from "../scope";
import { MAX_SCHEDULE_COURSES } from "../types";
import { parseStoredScheduleCourse } from "../validation";
import type { ScheduleSyncLocalStore } from "./coordinator";
import { decideScheduleAcknowledgement } from "./coordinator";

const quarantineKey = (scope: ScheduleScope, courseId: string) =>
  `${scope}|quarantine|${courseId}`;

export async function resolveDexieScheduleReview(
  database: VSUDatabase,
  scope: ScheduleScope,
  key: string,
  choice: "local" | "remote" | "discard-quarantine",
  dependencies: ScheduleMutationDependencies = defaultScheduleMutationDependencies,
): Promise<void> {
  await database.transaction(
    "rw",
    database.schedule_scoped_courses,
    database.schedule_outbox,
    database.schedule_conflicts,
    async () => {
      const review = await database.schedule_conflicts.get(key);
      if (!review || review.scope !== scope) {
        throw new Error("Schedule review is no longer available.");
      }
      if (review.reviewKind === "quarantine") {
        if (choice !== "discard-quarantine") {
          throw new Error("Invalid quarantine resolution.");
        }
        await database.schedule_conflicts.delete(key);
        return;
      }
      if (choice === "discard-quarantine") {
        throw new Error("Invalid conflict resolution.");
      }
      const courseKey = scopedCourseKey(scope, review.courseId);
      const currentRow = await database.schedule_scoped_courses.get(courseKey);
      const currentMutation = await database.schedule_outbox
        .where("[scope+courseId]")
        .equals([scope, review.courseId])
        .first();
      const selected = choice === "local"
        ? currentMutation?.operation === "delete"
          ? undefined
          : currentMutation?.course ?? currentRow?.course ?? review.local
        : review.remote;
      if (choice === "local" && !selected) {
        if (currentMutation?.operation !== "delete") {
          throw new Error("Local schedule version is unavailable.");
        }
      }
      if (choice === "remote" && !selected && !review.remoteDeleted) {
        throw new Error("Cloud schedule version is unavailable.");
      }
      if (
        selected &&
        !currentRow &&
        await database.schedule_scoped_courses
          .where("scope")
          .equals(scope)
          .count() >= MAX_SCHEDULE_COURSES
      ) {
        throw new Error("Schedule course limit reached.");
      }
      await database.schedule_outbox
        .where("[scope+courseId]")
        .equals([scope, review.courseId])
        .delete();
      if (selected) {
        await database.schedule_scoped_courses.put({
          key: courseKey,
          scope,
          id: review.courseId,
          course: parseStoredScheduleCourse(selected),
          serverRevision: review.serverRevision,
        });
      } else {
        await database.schedule_scoped_courses.delete(courseKey);
      }
      if (choice === "local") {
        await database.schedule_outbox.add(createScheduleMutation({
          scope,
          courseId: review.courseId,
          expectedRevision: review.serverRevision,
          operation: selected ? "upsert" : "delete",
          ...(selected
            ? { course: parseStoredScheduleCourse(selected) }
            : {}),
          ...dependencies,
        }));
      }
      await database.schedule_conflicts.delete(key);
    },
  );
}

export function createDexieScheduleSyncLocalStore(
  database: VSUDatabase,
  dependencies: ScheduleMutationDependencies = defaultScheduleMutationDependencies,
): ScheduleSyncLocalStore {
  const currentMutation = (scope: ScheduleScope, courseId: string) =>
    database.schedule_outbox
      .where("[scope+courseId]")
      .equals([scope, courseId])
      .first();

  const storeConflict = async (
    scope: ScheduleScope,
    mutation: ScheduleOutboxMutation,
    remote: { payload: unknown | null; revision: number } | undefined,
  ) => {
    const key = scopedCourseKey(scope, mutation.courseId);
    const existing = await database.schedule_conflicts.get(key);
    let remoteCourse;
    if (remote?.payload) {
      try {
        remoteCourse = parseStoredScheduleCourse(remote.payload);
      } catch {
        remoteCourse = undefined;
      }
    }
    if (existing) {
      if (!remote) return;
      await database.schedule_conflicts.put({
        ...existing,
        ...(remoteCourse ? { remote: remoteCourse } : { remote: undefined }),
        remoteDeleted: remote.payload === null,
        serverRevision: remote.revision,
      });
      return;
    }
    const row = await database.schedule_scoped_courses.get(key);
    await database.schedule_conflicts.put({
      key,
      scope,
      courseId: mutation.courseId,
      ...(row?.course || mutation.course
        ? { local: row?.course ?? mutation.course }
        : {}),
      ...(remoteCourse ? { remote: remoteCourse } : {}),
      ...(remote?.payload === null ? { remoteDeleted: true } : {}),
      serverRevision: remote?.revision ?? mutation.expectedRevision,
      reviewKind: "conflict",
    });
  };

  return {
    async listOutbox(scope) {
      return database.schedule_outbox
        .where("scope")
        .equals(scope)
        .sortBy("sequence");
    },
    async acknowledge(scope, sent, result) {
      await database.transaction(
        "rw",
        database.schedule_scoped_courses,
        database.schedule_outbox,
        database.schedule_conflicts,
        async () => {
          const key = scopedCourseKey(scope, sent.courseId);
          const currentRow = await database.schedule_scoped_courses.get(key);
          const mutation = await currentMutation(scope, sent.courseId);
          const decision = decideScheduleAcknowledgement({
            scope,
            sent,
            result,
            currentRow,
            currentMutation: mutation,
            createCompensatingDelete: ({ scope: nextScope, courseId, expectedRevision }) =>
              createScheduleMutation({
                scope: nextScope,
                courseId,
                expectedRevision,
                operation: "delete",
                ...dependencies,
              }),
          });
          if (decision.row) await database.schedule_scoped_courses.put(decision.row);
          else await database.schedule_scoped_courses.delete(key);
          if (
            mutation?.sequence !== undefined &&
            decision.mutation?.mutationId === mutation.mutationId
          ) {
            await database.schedule_outbox.put({
              ...decision.mutation,
              sequence: mutation.sequence,
            });
          } else {
            if (mutation?.sequence !== undefined) {
              await database.schedule_outbox.delete(mutation.sequence);
            }
            if (decision.mutation) await database.schedule_outbox.add(decision.mutation);
          }
          await database.schedule_conflicts.delete(key);
        },
      );
    },
    async recordPushConflict(scope, mutation, result) {
      await database.transaction(
        "rw",
        database.schedule_outbox,
        database.schedule_scoped_courses,
        database.schedule_conflicts,
        async () => {
          const current = await currentMutation(scope, mutation.courseId);
          if (current?.mutationId !== mutation.mutationId) return;
          await storeConflict(scope, current, result?.remote);
          if (current.sequence !== undefined) {
            await database.schedule_outbox.delete(current.sequence);
          }
        },
      );
    },
    async reviewCounts(scope) {
      const rows = await database.schedule_conflicts.where("scope").equals(scope).toArray();
      return {
        conflicts: rows.filter((row) => row.reviewKind !== "quarantine").length,
        quarantined: rows.filter((row) => row.reviewKind === "quarantine").length,
      };
    },
    async cursorFor(scope) {
      return (await database.schedule_sync_state.get(scope))?.cursor;
    },
    async applyPull(scope, rows, nextCursor, resolve) {
      if (!Number.isSafeInteger(nextCursor) || nextCursor < 0) {
        throw new Error("Invalid schedule sync cursor.");
      }
      return database.transaction(
        "rw",
        database.schedule_scoped_courses,
        database.schedule_outbox,
        database.schedule_conflicts,
        database.schedule_sync_state,
        async () => {
          const currentCursor =
            (await database.schedule_sync_state.get(scope))?.cursor ?? 0;
          if (nextCursor < currentCursor) {
            throw new Error("Stale schedule pull cursor.");
          }
          for (const cloud of rows) {
            const key = scopedCourseKey(scope, cloud.id);
            const local = await database.schedule_scoped_courses.get(key);
            const pending = await currentMutation(scope, cloud.id);
            const decision = resolve({
              accountLocal: local
                ? {
                    course: local.course,
                    ...(local.serverRevision === undefined
                      ? {}
                      : { serverRevision: local.serverRevision }),
                  }
                : undefined,
              cloud,
              pendingMutation: pending,
            });
            if (
              decision.kind === "invalid-cloud-payload" ||
              decision.kind === "invalid-cloud-row"
            ) {
              const review: StoredScheduleConflict = {
                key: quarantineKey(scope, cloud.id),
                scope,
                courseId: cloud.id,
                serverRevision:
                  Number.isSafeInteger(cloud.revision) && cloud.revision >= 0
                    ? cloud.revision
                    : 0,
                reviewKind: "quarantine",
              };
              await database.schedule_conflicts.put(review);
              continue;
            }
            const existingReview = await database.schedule_conflicts.get(key);
            if (
              existingReview &&
              existingReview.reviewKind !== "quarantine"
            ) {
              await storeConflict(
                scope,
                pending ?? {
                  scope,
                  courseId: cloud.id,
                  mutationId: "00000000-0000-4000-8000-000000000000",
                  expectedRevision: existingReview.serverRevision,
                  operation: existingReview.local ? "upsert" : "delete",
                  ...(existingReview.local
                    ? { course: existingReview.local }
                    : {}),
                  createdAt: cloud.updatedAt,
                },
                cloud,
              );
              continue;
            }
            await database.schedule_conflicts.delete(
              quarantineKey(scope, cloud.id),
            );
            if (decision.kind === "replace-local") {
              await database.schedule_scoped_courses.put({
                key, scope, id: cloud.id,
                course: decision.course,
                serverRevision: decision.serverRevision,
              });
              await database.schedule_conflicts.delete(key);
            } else if (decision.kind === "delete-local") {
              await database.schedule_scoped_courses.delete(key);
              if (pending?.sequence !== undefined) {
                await database.schedule_outbox.delete(pending.sequence);
              }
              await database.schedule_conflicts.delete(key);
            } else if (decision.kind === "keep-local") {
              if (local) {
                await database.schedule_scoped_courses.put({
                  ...local,
                  serverRevision: decision.serverRevision,
                });
              }
              if (pending?.sequence !== undefined) {
                await database.schedule_outbox.update(pending.sequence, {
                  expectedRevision: decision.serverRevision,
                });
              }
            } else if (decision.kind === "conflict" && pending) {
              await storeConflict(scope, pending, cloud);
            }
          }
          if (
            await database.schedule_scoped_courses.where("scope").equals(scope).count() >
            MAX_SCHEDULE_COURSES
          ) {
            throw new Error("Pulled schedule exceeds the course limit.");
          }
          const state = await database.schedule_sync_state.get(scope);
          await database.schedule_sync_state.put({
            ...state,
            scope,
            cursor: nextCursor,
          });
          const review = await database.schedule_conflicts.where("scope").equals(scope).toArray();
          return {
            conflicts: review.filter((row) => row.reviewKind !== "quarantine").length,
            quarantined: review.filter((row) => row.reviewKind === "quarantine").length,
          };
        },
      );
    },
    async pendingCount(scope) {
      return database.schedule_outbox.where("scope").equals(scope).count();
    },
  };
}
