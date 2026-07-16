import { z } from "zod";
import { SUBMISSION_STATUSES, VALIDATION_LIMITS } from "@/lib/constants";

export const submissionSchema = z.object({
  suggestedName: z.string().min(1).max(VALIDATION_LIMITS.submission.name.max),
  suggestedDescription: z
    .string()
    .max(VALIDATION_LIMITS.submission.notes.max)
    .optional()
    .or(z.literal("")),
  suggestedCategory: z
    .string()
    .max(50)
    .optional()
    .or(z.literal("")),
  suggestedLatitude: z.number().min(-90).max(90).optional(),
  suggestedLongitude: z.number().min(-180).max(180).optional(),
  submitterName: z
    .string()
    .max(VALIDATION_LIMITS.submission.name.max)
    .optional()
    .or(z.literal("")),
  submitterEmail: z
    .string()
    .email()
    .max(VALIDATION_LIMITS.submission.email.max)
    .optional()
    .or(z.literal("")),
  status: z.enum(SUBMISSION_STATUSES).default("PENDING"),
  notes: z
    .string()
    .max(VALIDATION_LIMITS.submission.notes.max)
    .optional()
    .or(z.literal("")),
  facilityId: z.string().uuid().optional(),
});

export type SubmissionFormValues = z.infer<typeof submissionSchema>;