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
  push(mutation: ScheduleOutboxMutation): Promise<CloudMutationResult>;
  pull(afterServerVersion: number): Promise<CloudScheduleRow[]>;
}

type RawRow = Record<string, unknown>;

function record(value: unknown): value is RawRow {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function timestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(new Date(value).getTime());
}

function positive(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function parseRow(value: unknown): CloudScheduleRow {
  if (
    !record(value) ||
    !isValidScheduleId(value.id) ||
    value.id !== value.id.trim().toLowerCase() ||
    !positive(value.revision) ||
    !positive(value.server_version) ||
    !timestamp(value.created_at) ||
    !timestamp(value.updated_at)
  ) {
    throw new ScheduleSyncError("invalid-remote");
  }
  const deleted = value.deleted_at;
  if (
    (value.payload === null && !timestamp(deleted)) ||
    (value.payload !== null && deleted !== null && deleted !== undefined)
  ) {
    throw new ScheduleSyncError("invalid-remote");
  }
  if (value.payload !== null) {
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

function parseMutationResult(value: unknown): CloudMutationResult {
  if (!Array.isArray(value) || value.length !== 1 || !record(value[0])) {
    throw new ScheduleSyncError("invalid-remote");
  }
  const result = value[0];
  if (
    result.status === "deleted" &&
    isValidScheduleId(result.id) &&
    result.revision === 0 &&
    result.server_version === null &&
    result.payload === null
  ) {
    return { kind: "deleted-noop", courseId: result.id, revision: 0 };
  }
  if (result.status === "conflict") {
    if (!isValidScheduleId(result.id)) throw new ScheduleSyncError("invalid-remote");
    if (result.revision === null) {
      return { kind: "conflict", courseId: result.id };
    }
    return { kind: "conflict", courseId: result.id, remote: parseRow(result) };
  }
  if (!["upserted", "deleted", "replayed"].includes(String(result.status))) {
    throw new ScheduleSyncError("invalid-remote");
  }
  return {
    kind: "accepted",
    status: result.status as "upserted" | "deleted" | "replayed",
    row: parseRow(result),
  };
}

function classify(error: unknown): ScheduleSyncError {
  const code = record(error) && typeof error.code === "string" ? error.code : "";
  if (code === "42501" || code === "PGRST301" || code === "401") {
    return new ScheduleSyncError("auth");
  }
  if (code === "409" || code === "23505") return new ScheduleSyncError("conflict");
  if (record(error) && error.name === "TypeError") return new ScheduleSyncError("offline");
  return new ScheduleSyncError("unavailable");
}

export class SupabaseScheduleGateway implements ScheduleCloudGateway {
  constructor(private readonly client: SupabaseClient) {}

  async push(mutation: ScheduleOutboxMutation): Promise<CloudMutationResult> {
    const { data, error } = await this.client.rpc(
      "apply_student_schedule_mutation",
      {
        p_mutation_id: mutation.mutationId,
        p_course_id: mutation.courseId,
        p_expected_revision: mutation.expectedRevision,
        p_operation: mutation.operation,
        p_payload: mutation.operation === "upsert" ? mutation.course ?? null : null,
      },
    );
    if (error) throw classify(error);
    return parseMutationResult(data);
  }

  async pull(afterServerVersion: number): Promise<CloudScheduleRow[]> {
    if (!Number.isSafeInteger(afterServerVersion) || afterServerVersion < 0) {
      throw new ScheduleSyncError("invalid-remote");
    }
    const { data, error } = await this.client
      .from("student_schedule_courses")
      .select("id,payload,revision,server_version,created_at,updated_at,deleted_at")
      .gt("server_version", afterServerVersion)
      .order("server_version", { ascending: true })
      .order("id", { ascending: true });
    if (error) throw classify(error);
    if (!Array.isArray(data)) throw new ScheduleSyncError("invalid-remote");
    const rows = data.map(parseRow);
    let priorVersion = afterServerVersion;
    let priorId = "";
    for (const row of rows) {
      if (
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
