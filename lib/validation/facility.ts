import { z } from "zod";
import { FACILITY_CATEGORIES } from "@/lib/types/facility";
import { VALIDATION_LIMITS } from "@/lib/constants";
import { isPointInsideVsuCampus } from "@/lib/map/vsu-campus-boundary";

const coordsSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
}).refine(isPointInsideVsuCampus, {
  message: "Location must be inside the VSU campus map.",
});

const codeSchema = z.preprocess((value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}, z
  .union([
    z
      .string()
      .min(VALIDATION_LIMITS.facility.code.min)
      .max(VALIDATION_LIMITS.facility.code.max),
    z.null(),
  ])
  .optional());

export const baseFacilitySchema = z.object({
  code: codeSchema,
  slug: z.preprocess((value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  }, z.string().min(1).max(100).optional()),
  name: z.string().min(VALIDATION_LIMITS.facility.name.min).max(VALIDATION_LIMITS.facility.name.max),
  description: z.string().max(VALIDATION_LIMITS.facility.description.max).optional().or(z.literal("")),
  category: z.enum(FACILITY_CATEGORIES),
  coordinates: coordsSchema,
  imageUrl: z.preprocess(
    (value) => (value === "" || value === null ? null : value),
    z
      .string()
      .refine(
        (val) =>
          val.startsWith("http://") ||
          val.startsWith("https://") ||
          val.startsWith("/"),
        { message: "Image URL must be absolute (http/https) or a relative path." }
      )
      .nullable()
      .optional(),
  ),
  imageCredit: z.string().max(80).optional().or(z.literal("")),
  website: z.preprocess(
    (value) => (value === "" || value === null ? null : value),
    z.string().url({ message: "Please enter a valid URL" }).nullable().optional(),
  ),
  facebook: z.preprocess(
    (value) => (value === "" || value === null ? null : value),
    z.string().url({ message: "Please enter a valid Facebook URL" }).nullable().optional(),
  ),
  phone: z.string().max(20).optional().or(z.literal("")),
});

export const facilityWithRoomsSchema = baseFacilitySchema.extend({
  hasRooms: z.literal(true),
});

export const facilityPOISchema = baseFacilitySchema.extend({
  hasRooms: z.literal(false),
});

export const unifiedFacilitySchema = z.discriminatedUnion("hasRooms", [
  facilityWithRoomsSchema,
  facilityPOISchema,
]);

export const partialFacilitySchema = baseFacilitySchema
  .extend({ hasRooms: z.boolean() })
  .partial();

export type UnifiedFacilityFormValues = z.infer<typeof unifiedFacilitySchema>;
export type FacilityWithRoomsFormValues = z.infer<typeof facilityWithRoomsSchema>;
export type FacilityPOIFormValues = z.infer<typeof facilityPOISchema>;
export type PartialFacilityFormValues = z.infer<typeof partialFacilitySchema>;
