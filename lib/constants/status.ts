export const SUBMISSION_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];
