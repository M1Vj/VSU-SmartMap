import type { AuditFields } from "./common";
import type { SubmissionStatus } from "@/lib/constants/status";

export interface Submission extends AuditFields {
  readonly id: string;
  readonly suggestedName: string;
  readonly suggestedDescription?: string;
  readonly suggestedCategory?: string;
  readonly suggestedLatitude?: number;
  readonly suggestedLongitude?: number;
  readonly submitterName?: string;
  readonly submitterEmail?: string;
  readonly status: SubmissionStatus;
  readonly notes?: string;
  readonly facilityId?: string;
  readonly reviewedBy?: string;
  readonly reviewedAt?: string;
}

export type SubmissionSummary = Pick<
  Submission,
  "id" | "suggestedName" | "status" | "createdAt"
>;
