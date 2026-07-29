import type { SupabaseClient } from "@supabase/supabase-js";
import type { ScheduleOutboxMutation } from "../local-types";
import { isValidScheduleId, parseStoredScheduleCourse } from "../validation";
import type { CloudMutationResult, CloudScheduleRow } from "./types";

export type ScheduleSyncErrorCategory =
  | "offline"
  | "auth"
  | "conflict"
  | "unavailable"
  | "invalid-remote";

const ERROR_MESSAGES: Record<ScheduleSyncErrorCategory, string> = {
  offline: "Schedule sync is offline.",
  auth: "Schedule sync requires authentication.",
  conflict: "Schedule changes need review.",
  unavailable: "Schedule sync is unavailable.",
  "invalid-remote": "Schedule sync received invalid remote data.",
};

export class ScheduleSyncError extends Error {
  constructor(readonly category: ScheduleSyncErrorCategory) {
    super(ERROR_MESSAGES[category]);
    this.name = "ScheduleSyncError";
  }
}

export interface ScheduleCloudGateway {
  push(mutation: ScheduleOutboxMutation, signal?: AbortSignal): Promise<CloudMutationResult>;
  pull(afterServerVersion: number, signal?: AbortSignal): Promise<CloudScheduleRow[]>;
}

type RawRow = Record<string, unknown>;

function record(value: unknown): value is RawRow {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const INSTANT_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/;

export function isScheduleSyncTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = INSTANT_PATTERN.exec(value);
  if (!match) return false;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, , zone] =
    match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > new Date(Date.UTC(year, month, 0)).getUTCDate() ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    return false;
  }
  if (zone !== "Z") {
    const zoneHour = Number(zone.slice(1, 3));
    const zoneMinute = Number(zone.slice(4, 6));
    if (zoneHour > 23 || zoneMinute > 59) return false;
  }
  return Number.isFinite(Date.parse(value));
}

function positive(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function parseRow(value: unknown, validatePayload: boolean): CloudScheduleRow {
  if (
    !record(value) ||
    !isValidScheduleId(value.id) ||
    value.id !== value.id.trim().toLowerCase() ||
    !positive(value.revision) ||
    !positive(value.server_version) ||
    !isScheduleSyncTimestamp(value.created_at) ||
    !isScheduleSyncTimestamp(value.updated_at)
  ) {
    throw new ScheduleSyncError("invalid-remote");
  }
  const deleted = value.deleted_at;
  if (
    (value.payload === null && !isScheduleSyncTimestamp(deleted)) ||
    (value.payload !== null && deleted !== null && deleted !== undefined)
  ) {
    throw new ScheduleSyncError("invalid-remote");
  }
  if (validatePayload && value.payload !== null) {
    try {
      if (parseStoredScheduleCourse(value.payload).id !== value.id) {
        throw new ScheduleSyncError("invalid-remote");
      }
    } catch {
      throw new ScheduleSyncError("invalid-remote");
    }
  }
  return {
    id: value.id,
    payload: value.payload,
    revision: value.revision,
    serverVersion: value.server_version,
    createdAt: value.created_at,
    updatedAt: value.updated_at,
    ...(typeof deleted === "string" ? { deletedAt: deleted } : {}),
  };
}

function allNull(result: RawRow): boolean {
  return result.payload === null &&
    result.server_version === null &&
    result.created_at === null &&
    result.updated_at === null &&
    result.deleted_at === null;
}

function parseMutationResult(
  value: unknown,
  mutation: ScheduleOutboxMutation,
): CloudMutationResult {
  if (!Array.isArray(value) || value.length !== 1 || !record(value[0])) {
    throw new ScheduleSyncError("invalid-remote");
  }
  const result = value[0];
  if (
    result.status === "deleted" &&
    mutation.operation === "delete" &&
    result.id === mutation.courseId &&
    result.id === result.id.toLowerCase() &&
    result.revision === 0 &&
    allNull(result)
  ) {
    return { kind: "deleted-noop", courseId: result.id, revision: 0 };
  }
  if (result.status === "conflict") {
    if (
      result.id !== mutation.courseId ||
      result.id !== result.id.toLowerCase()
    ) {
      throw new ScheduleSyncError("invalid-remote");
    }
    if (result.revision === null) {
      if (!allNull(result)) throw new ScheduleSyncError("invalid-remote");
      return { kind: "conflict", courseId: result.id };
    }
    return {
      kind: "conflict",
      courseId: result.id,
      remote: parseRow(result, true),
    };
  }
  if (!["upserted", "deleted", "replayed"].includes(String(result.status))) {
    throw new ScheduleSyncError("invalid-remote");
  }
  const row = parseRow(result, true);
  if (
    row.id !== mutation.courseId ||
    (mutation.operation === "upsert" &&
      (row.payload === null ||
        (result.status !== "upserted" && result.status !== "replayed"))) ||
    (mutation.operation === "delete" &&
      (row.payload !== null ||
        (result.status !== "deleted" && result.status !== "replayed"))) ||
    (result.status === "upserted" && row.payload === null) ||
    (result.status === "deleted" && row.payload !== null)
  ) {
    throw new ScheduleSyncError("invalid-remote");
  }
  return {
    kind: "accepted",
    status: result.status as "upserted" | "deleted" | "replayed",
    row,
  };
}

function classify(error: unknown): ScheduleSyncError {
  const code = record(error) && typeof error.code === "string" ? error.code : "";
  if (code === "42501" || code === "PGRST301" || code === "401") {
    return new ScheduleSyncError("auth");
  }
  if (code === "409" || code === "23505" || code === "P0001") {
    return new ScheduleSyncError("conflict");
  }
  const message = record(error) && typeof error.message === "string"
    ? error.message.toLowerCase()
    : "";
  if (
    (record(error) && error.name === "TypeError") ||
    message.includes("failed to fetch") ||
    message.includes("fetch failed") ||
    message.includes("networkerror") ||
    message.includes("network request failed") ||
    message === "load failed"
  ) {
    return new ScheduleSyncError("offline");
  }
  return new ScheduleSyncError("unavailable");
}

export class SupabaseScheduleGateway implements ScheduleCloudGateway {
  constructor(
    private readonly client: SupabaseClient,
    private readonly expectedUserId: string,
  ) {
    if (
      !isValidScheduleId(expectedUserId) ||
      expectedUserId !== expectedUserId.trim().toLowerCase()
    ) {
      throw new ScheduleSyncError("unavailable");
    }
  }

  async push(mutation: ScheduleOutboxMutation, signal?: AbortSignal): Promise<CloudMutationResult> {
    if (mutation.scope !== `user:${this.expectedUserId}`) {
      throw new ScheduleSyncError("auth");
    }
    const request = this.client.rpc(
      "apply_student_schedule_mutation",
      {
        p_expected_user_id: this.expectedUserId,
        p_mutation_id: mutation.mutationId,
        p_course_id: mutation.courseId,
        p_expected_revision: mutation.expectedRevision,
        p_operation: mutation.operation,
        p_payload: mutation.operation === "upsert" ? mutation.course ?? null : null,
      },
    );
    const { data, error } = await (
      signal && typeof request.abortSignal === "function"
        ? request.abortSignal(signal)
        : request
    );
    if (error) throw classify(error);
    return parseMutationResult(data, mutation);
  }

  async pullAllBounded(
    maximumRows: number,
    pageSize = 1_000,
  ): Promise<CloudScheduleRow[]> {
    if (
      !Number.isSafeInteger(maximumRows) ||
      maximumRows < 0 ||
      !Number.isSafeInteger(pageSize) ||
      pageSize <= 0 ||
      pageSize > maximumRows
    ) {
      throw new ScheduleSyncError("invalid-remote");
    }
    const rows: CloudScheduleRow[] = [];
    let cursor = 0;
    while (true) {
      const page = await this.pullPage(cursor, pageSize);
      if (page.length === 0) return rows;
      if (rows.length + page.length > maximumRows) {
        throw new ScheduleSyncError("invalid-remote");
      }
      rows.push(...page);
      const last = page.at(-1);
      if (!last || last.serverVersion <= cursor) {
        throw new ScheduleSyncError("invalid-remote");
      }
      cursor = last.serverVersion;
    }
  }

  async pull(afterServerVersion: number, signal?: AbortSignal): Promise<CloudScheduleRow[]> {
    return this.pullPage(afterServerVersion, undefined, signal);
  }

  private async pullPage(
    afterServerVersion: number,
    pageSize?: number,
    signal?: AbortSignal,
  ): Promise<CloudScheduleRow[]> {
    if (!Number.isSafeInteger(afterServerVersion) || afterServerVersion < 0) {
      throw new ScheduleSyncError("invalid-remote");
    }
    let query = this.client
      .from("student_schedule_courses")
      .select("id,payload,revision,server_version,created_at,updated_at,deleted_at")
      .eq("user_id", this.expectedUserId)
      .gt("server_version", afterServerVersion)
      .order("server_version", { ascending: true })
      .order("id", { ascending: true });
    if (pageSize !== undefined) query = query.limit(pageSize);
    if (signal && typeof query.abortSignal === "function") {
      query = query.abortSignal(signal);
    }
    const { data, error } = await query;
    if (error) throw classify(error);
    if (!Array.isArray(data)) throw new ScheduleSyncError("invalid-remote");
    const rows = data.map((row) => parseRow(row, false));
    let priorVersion = afterServerVersion;
    let priorId = "";
    for (const row of rows) {
      if (
        row.serverVersion <= afterServerVersion ||
        row.serverVersion < priorVersion ||
        (row.serverVersion === priorVersion && row.id <= priorId)
      ) {
        throw new ScheduleSyncError("invalid-remote");
      }
      priorId = row.serverVersion === priorVersion ? row.id : "";
      priorVersion = row.serverVersion;
      priorId = row.id;
    }
    return rows;
  }
}
