import { z } from "zod";
import { VALIDATION_LIMITS } from "@/lib/constants";

export const roomSchema = z.object({
  facilityId: z.string().uuid(),
  roomCode: z
    .string()
    .min(VALIDATION_LIMITS.room.code.min)
    .max(VALIDATION_LIMITS.room.code.max),
  name: z.preprocess(
    (val) => (val === "" ? null : val),
    z.string().max(VALIDATION_LIMITS.room.name.max).nullable().optional()
  ),
  description: z.preprocess(
    (val) => (val === "" ? null : val),
    z.string().max(VALIDATION_LIMITS.room.description.max).nullable().optional()
  ),
  floor: z.number().int().optional(),
  imageUrl: z.preprocess(
    (val) => (val === "" ? null : val),
    z.string().url().nullable().optional()
  ),
  imageCredit: z.preprocess(
    (val) => (val === "" ? null : val),
    z.string().max(80).nullable().optional()
  ),
});

export type RoomFormValues = z.infer<typeof roomSchema>;