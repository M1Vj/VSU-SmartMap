import type {
  ScheduleOutboxMutation,
  StoredScopedScheduleCourse,
} from "../local-types";
import { GUEST_SCHEDULE_SCOPE, type ScheduleScope } from "../scope";
import { isValidScheduleId, parseStoredScheduleCourse } from "../validation";
import type { CloudMutationResult, CloudScheduleRow } from "./types";
import {
  isScheduleSyncTimestamp,
  type ScheduleCloudGateway,
} from "./cloud-gateway";
import { resolvePulledRow } from "./reconcile";

export type SyncRunResult =
  | { kind: "synced"; scope: ScheduleScope; runToken: number; pending: number; conflicts: number }
  | { kind: "pending"; scope: ScheduleScope; runToken: number; pending: number }
  | { kind: "needs-review"; scope: ScheduleScope; runToken: number; pending: number; conflicts: number; quarantined: number }
  | { kind: "skipped"; scope: ScheduleScope }
  | { kind: "offline"; scope: ScheduleScope }
  | { kind: "auth-required"; scope: ScheduleScope; runToken?: number; pending: number }
  | { kind: "scope-changed"; scope: ScheduleScope }
  | { kind: "failed"; scope: ScheduleScope; runToken: number; pending: number };

export interface ScheduleSyncLocalStore {
  listOutbox(scope: ScheduleScope): Promise<ScheduleOutboxMutation[]>;
  /**
   * Atomically commits the canonical row/revision, then deletes only `sent`
   * when it is still current; a replacement is retained and rebased.
   */
  acknowledge(
    scope: ScheduleScope,
    sent: ScheduleOutboxMutation,
    result: Exclude<CloudMutationResult, { kind: "conflict" }>,
  ): Promise<void>;
  recordPushConflict(
    scope: ScheduleScope,
    mutation: ScheduleOutboxMutation,
    result?: Extract<CloudMutationResult, { kind: "conflict" }>,
  ): Promise<void>;
  reviewCounts(scope: ScheduleScope): Promise<{ conflicts: number; quarantined: number }>;
  cursorFor(scope: ScheduleScope): Promise<number | undefined>;
  /**
   * One transaction: resolve/apply or quarantine every row and write cursor.
   * It must roll back all writes, including the cursor, on any failure.
   */
  applyPull(
    scope: ScheduleScope,
    rows: readonly CloudScheduleRow[],
    nextCursor: number,
    resolve: typeof resolvePulledRow,
  ): Promise<{ conflicts: number; quarantined: number }>;
  pendingCount(scope: ScheduleScope): Promise<number>;
}

type CoordinatorOptions = {
  store: ScheduleSyncLocalStore;
  gateway: ScheduleCloudGateway;
  consent?: (scope: ScheduleScope) => boolean;
  online?: () => boolean;
  cloudVerified?: (scope: ScheduleScope) => boolean;
  onRunStarted?: (scope: ScheduleScope, runToken: number) => void;
};

type AcknowledgementInput = {
  scope: ScheduleScope;
  sent: ScheduleOutboxMutation;
  result: Exclude<CloudMutationResult, { kind: "conflict" }>;
  currentRow?: StoredScopedScheduleCourse;
  currentMutation?: ScheduleOutboxMutation;
  createCompensatingDelete(input: {
    scope: ScheduleScope;
    courseId: string;
    expectedRevision: number;
  }): ScheduleOutboxMutation;
};

export function decideScheduleAcknowledgement(
  input: AcknowledgementInput,
): { row?: StoredScopedScheduleCourse; mutation?: ScheduleOutboxMutation } {
  const revision = input.result.kind === "accepted"
    ? input.result.row.revision
    : 0;
  const exact = input.currentMutation?.mutationId === input.sent.mutationId;
  if (input.currentMutation && !exact) {
    return {
      ...(input.currentRow ? {
        row: { ...input.currentRow, serverRevision: revision },
      } : {}),
      mutation: { ...input.currentMutation, expectedRevision: revision },
    };
  }
  if (
    !input.currentMutation &&
    !input.currentRow &&
    input.sent.operation === "upsert" &&
    input.result.kind === "accepted" &&
    input.result.row.payload !== null
  ) {
    const mutation = input.createCompensatingDelete({
      scope: input.scope,
      courseId: input.sent.courseId,
      expectedRevision: revision,
    });
    if (
      mutation.scope !== input.scope ||
      mutation.scope === GUEST_SCHEDULE_SCOPE ||
      mutation.courseId !== input.sent.courseId ||
      mutation.courseId !== mutation.courseId.toLowerCase() ||
      mutation.expectedRevision !== revision ||
      mutation.operation !== "delete" ||
      mutation.course !== undefined ||
      !isCanonicalUuid(mutation.mutationId) ||
      mutation.mutationId === input.sent.mutationId ||
      mutation.sequence !== undefined ||
      !isScheduleSyncTimestamp(mutation.createdAt)
    ) {
      throw new Error("Invalid compensating schedule mutation.");
    }
    return { mutation };
  }
  if (input.result.kind === "accepted" && input.result.row.payload !== null) {
    return {
      row: {
        key: `${input.scope}|${input.sent.courseId}`,
        scope: input.scope,
        id: input.sent.courseId,
        course: parseCanonicalCourse(input.result.row.payload),
        serverRevision: revision,
      },
    };
  }
  return {};
}

function isCanonicalUuid(value: unknown): value is string {
  return isValidScheduleId(value) && value === value.trim().toLowerCase();
}

function parseCanonicalCourse(payload: unknown) {
  return parseStoredScheduleCourse(payload);
}

function category(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "category" in error
    ? String((error as { category?: unknown }).category)
    : undefined;
}

export class ScheduleSyncCoordinator {
  private active?: { scope: ScheduleScope; promise: Promise<SyncRunResult> };
  private nextRunToken = 1;
  private readonly cancellation = new AbortController();

  constructor(private readonly options: CoordinatorOptions) {}

  cancel(): void {
    this.cancellation.abort();
  }

  sync(scope: ScheduleScope): Promise<SyncRunResult> {
    if (this.active) {
      return this.active.scope === scope
        ? this.active.promise
        : Promise.resolve({ kind: "scope-changed", scope });
    }
    if (scope === GUEST_SCHEDULE_SCOPE || this.options.consent?.(scope) === false) {
      return Promise.resolve({ kind: "skipped", scope });
    }
    if (this.options.online?.() === false) {
      return Promise.resolve({ kind: "offline", scope });
    }
    const runToken = this.nextRunToken++;
    if (this.options.cloudVerified?.(scope) === false) {
      return this.options.store.pendingCount(scope)
        .then((pending) => ({
          kind: "auth-required" as const, scope, runToken, pending,
        }))
        .catch(() => ({
          kind: "failed" as const, scope, runToken, pending: 0,
        }));
    }
    this.options.onRunStarted?.(scope, runToken);
    const promise = this.run(scope, runToken).finally(() => {
      if (this.active?.promise === promise) this.active = undefined;
    });
    this.active = { scope, promise };
    return promise;
  }

  private async run(scope: ScheduleScope, runToken: number): Promise<SyncRunResult> {
    const cancelled = () => this.cancellation.signal.aborted;
    try {
      const pending = [...await this.options.store.listOutbox(scope)].sort(
        (a, b) => (a.sequence ?? Number.MAX_SAFE_INTEGER) -
          (b.sequence ?? Number.MAX_SAFE_INTEGER),
      );
      if (cancelled()) return { kind: "scope-changed", scope };
      for (const mutation of pending) {
        let result: CloudMutationResult;
        try {
          result = await this.options.gateway.push(
            mutation,
            this.cancellation.signal,
          );
        } catch (error) {
          if (cancelled()) return { kind: "scope-changed", scope };
          const pendingCount = await this.options.store.pendingCount(scope);
          if (category(error) === "auth") {
            return { kind: "auth-required", scope, runToken, pending: pendingCount };
          }
          if (category(error) === "offline") {
            return { kind: "offline", scope };
          }
          if (category(error) === "conflict") {
            await this.options.store.recordPushConflict(scope, mutation);
            continue;
          }
          return { kind: "failed", scope, runToken, pending: pendingCount };
        }
        if (cancelled()) return { kind: "scope-changed", scope };
        if (result.kind === "conflict") {
          await this.options.store.recordPushConflict(scope, mutation, result);
          continue;
        }
        await this.options.store.acknowledge(scope, mutation, result);
        if (cancelled()) return { kind: "scope-changed", scope };
      }

      const cursor = await this.options.store.cursorFor(scope) ?? 0;
      if (cancelled()) return { kind: "scope-changed", scope };
      if (!Number.isSafeInteger(cursor) || cursor < 0) {
        return {
          kind: "failed",
          scope,
          runToken,
          pending: await this.options.store.pendingCount(scope),
        };
      }
      const rows = await this.options.gateway.pull(
        cursor,
        this.cancellation.signal,
      );
      if (cancelled()) return { kind: "scope-changed", scope };
      const nextCursor = rows.reduce(
        (maximum, row) => Math.max(maximum, row.serverVersion),
        cursor,
      );
      await this.options.store.applyPull(
        scope,
        rows,
        nextCursor,
        resolvePulledRow,
      );
      if (cancelled()) return { kind: "scope-changed", scope };
      const remaining = await this.options.store.pendingCount(scope);
      const review = await this.options.store.reviewCounts(scope);
      if (review.conflicts > 0 || review.quarantined > 0) {
        return {
          kind: "needs-review",
          scope,
          runToken,
          pending: remaining,
          conflicts: review.conflicts,
          quarantined: review.quarantined,
        };
      }
      return remaining > 0
        ? { kind: "pending", scope, runToken, pending: remaining }
        : { kind: "synced", scope, runToken, pending: 0, conflicts: 0 };
    } catch {
      return {
        kind: "failed",
        scope,
        runToken,
        pending: await this.options.store.pendingCount(scope).catch(() => 0),
      };
    }
  }
}
