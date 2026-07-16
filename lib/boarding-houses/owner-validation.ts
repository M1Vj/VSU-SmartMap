import { z } from "zod";

import {
  BOARDING_HOUSE_MOBILE_CARRIERS,
  BOARDING_HOUSE_OCCUPANCY_POLICIES,
  BOARDING_HOUSE_ROOM_TYPES,
  BOARDING_HOUSE_SAFETY_FEATURES,
} from "@/lib/boarding-houses/types";

const optionalUrlSchema = z
  .string()
  .trim()
  .max(300)
  .optional()
  .nullable()
  .transform((value) => (value ? value : null))
  .refine((value) => !value || value.startsWith("https://"), {
    message: "Use a full https:// URL.",
  });

const optionalEmailSchema = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((value) => (value ? value : null))
  .refine((value) => !value || z.email().safeParse(value).success, {
    message: "Enter a valid email address.",
  });

export const ownerApplicationSchema = z.object({
  displayName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(5).max(40),
  email: z.email().max(254),
  authorityNotes: z.string().trim().min(10).max(2000),
});

const TIME_24H_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

const optionalMonthsSchema = z
  .union([z.string(), z.number()])
  .optional()
  .nullable()
  .transform((value, ctx) => {
    const raw = typeof value === "string" ? value.trim() : value;
    if (raw === "" || raw === null || raw === undefined) return null;
    const num = Number(raw);
    if (!Number.isInteger(num) || num < 0 || num > 12) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Choose a valid number of months.",
      });
      return z.NEVER;
    }
    return num;
  });

const requiredCountSchema = (label: string) =>
  z
    .union([z.string(), z.number()])
    .transform((value, ctx) => {
      const raw = typeof value === "string" ? value.trim() : value;
      if (raw === "" || raw === null || raw === undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Enter ${label}.` });
        return z.NEVER;
      }
      const num = Number(raw);
      if (!Number.isFinite(num)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Enter a valid ${label}.` });
        return z.NEVER;
      }
      if (!Number.isInteger(num)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${label} must be a whole number.`,
        });
        return z.NEVER;
      }
      if (num < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${label} cannot be negative.`,
        });
        return z.NEVER;
      }
      return num;
    });

const optionalCapacitySchema = z
  .union([z.string(), z.number()])
  .optional()
  .nullable()
  .transform((value, ctx) => {
    const raw = typeof value === "string" ? value.trim() : value;
    if (raw === "" || raw === null || raw === undefined) return null;
    const num = Number(raw);
    if (!Number.isInteger(num) || num < 1 || num > 20) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Capacity must be between 1 and 20 people.",
      });
      return z.NEVER;
    }
    return num;
  });

const optionalSizeSchema = z
  .union([z.string(), z.number()])
  .optional()
  .nullable()
  .transform((value, ctx) => {
    const raw = typeof value === "string" ? value.trim() : value;
    if (raw === "" || raw === null || raw === undefined) return null;
    const num = Number(raw);
    if (!Number.isFinite(num) || num <= 0 || num > 9999.9) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a valid room size in square meters.",
      });
      return z.NEVER;
    }
    return Math.round(num * 10) / 10;
  });

const offeringImageManifestSchema = z
  .object({ t: z.enum(["keep", "new", "none"]) })
  .default({ t: "none" });

export const ownerOfferingSchema = z.object({
  label: z.string().trim().min(2).max(120),
  roomType: z.enum(BOARDING_HOUSE_ROOM_TYPES),
  monthlyPrice: requiredCountSchema("a monthly price"),
  availableSlots: requiredCountSchema("the number of available slots"),
  capacity: optionalCapacitySchema,
  sizeSqm: optionalSizeSchema,
  hasAircon: z.coerce.boolean().default(false),
  privateBathroom: z.coerce.boolean().default(false),
  image: offeringImageManifestSchema,
  imagePath: z
    .string()
    .trim()
    .max(500)
    .optional()
    .nullable()
    .transform((value) => value || null),
});

export const ownerListingDraftSchema = z
  .object({
    name: z.string().trim().min(2).max(140),
    description: z.string().trim().max(4000).default(""),
    addressLine: z.string().trim().min(4).max(240),
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),
    contactPhone: z.string().trim().max(40).optional().nullable().transform((value) => value || null),
    contactFacebook: optionalUrlSchema,
    contactEmail: optionalEmailSchema,
    occupancyPolicies: z.array(z.enum(BOARDING_HOUSE_OCCUPANCY_POLICIES)).min(1),
    offerings: z.array(ownerOfferingSchema).min(1).max(10),
    wifi: z.coerce.boolean().default(false),
    cookingAllowed: z.coerce.boolean().default(false),
    furnished: z.coerce.boolean().default(false),
    waterIncluded: z.coerce.boolean().default(false),
    electricityIncluded: z.coerce.boolean().default(false),
    privateBathroom: z.coerce.boolean().default(false),
    advanceMonths: optionalMonthsSchema,
    depositMonths: optionalMonthsSchema,
    airConditioning: z.coerce.boolean().default(false),
    laundryArea: z.coerce.boolean().default(false),
    dryingArea: z.coerce.boolean().default(false),
    parking: z.coerce.boolean().default(false),
    studyArea: z.coerce.boolean().default(false),
    safetyFeatures: z.array(z.enum(BOARDING_HOUSE_SAFETY_FEATURES)).default([]),
    mobileCarriers: z.array(z.enum(BOARDING_HOUSE_MOBILE_CARRIERS)).default([]),
    applianceFee: z
      .union([z.string(), z.number()])
      .optional()
      .nullable()
      .transform((value, ctx) => {
        const raw = typeof value === "string" ? value.trim() : value;
        if (raw === "" || raw === null || raw === undefined) return null;
        const num = Number(raw);
        if (!Number.isInteger(num) || num < 0 || num > 10000) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Appliance fee must be between 0 and 10000.",
          });
          return z.NEVER;
        }
        return num;
      }),
    hasCurfew: z.coerce.boolean().default(false),
    curfewTime: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((value) => value || null),
    allowsVisitors: z.coerce.boolean().default(false),
    allowsPets: z.coerce.boolean().default(false),
    smokingAllowed: z.coerce.boolean().default(false),
    walkingMinutesToCampusGate: z
      .union([z.string(), z.number()])
      .optional()
      .nullable()
      .transform((value, ctx) => {
        const raw = typeof value === "string" ? value.trim() : value;
        if (raw === "" || raw === null || raw === undefined) return null;
        const num = Number(raw);
        if (!Number.isInteger(num) || num < 0 || num > 240) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Walking minutes must be between 0 and 240.",
          });
          return z.NEVER;
        }
        return num;
      }),
  })
  .superRefine((data, ctx) => {
    if (data.hasCurfew) {
      if (!data.curfewTime || !TIME_24H_REGEX.test(data.curfewTime)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["curfewTime"],
          message: "Enter a curfew time in 24-hour HH:MM format (e.g. 22:00).",
        });
      }
    }
  })
  .transform((data) => ({
    ...data,
    curfewTime: data.hasCurfew ? data.curfewTime : null,
  }));

export function slugifyListingName(value: string): string {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return slug || "listing";
}

export type OwnerApplicationInput = z.infer<typeof ownerApplicationSchema>;
export type OwnerListingDraftInput = z.infer<typeof ownerListingDraftSchema>;
export type OwnerOfferingInput = z.infer<typeof ownerOfferingSchema>;
