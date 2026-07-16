"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { getAuthorizedSession } from "@/lib/auth/server";
import { notifyAdmins } from "@/lib/notifications/service";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server-client";
import { verifyTurnstileToken } from "@/lib/turnstile";

export type ActionResult = {
  error?: string;
  message?: string;
};

const reportSchema = z.object({
  listingId: z.uuid(),
  reason: z.string().trim().min(3).max(80),
  details: z.string().trim().min(10).max(2000),
  reporterContact: z.string().trim().max(254).optional().nullable(),
  turnstileToken: z.string().optional(),
  turnstileIdempotencyKey: z.string().optional(),
});

const reviewSchema = z.object({
  listingId: z.uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  body: z.string().trim().max(2000),
  slug: z.string().trim().min(1),
  turnstileToken: z.string().optional(),
  turnstileIdempotencyKey: z.string().optional(),
});

const GENERIC_REPORT_ERROR = "Unable to submit report. Please try again.";
const GENERIC_REVIEW_ERROR = "Unable to submit review. Please try again.";

function getClientIp(requestHeaders: Headers) {
  return (
    requestHeaders.get("x-forwarded-for")?.split(",", 1)[0]?.trim() ||
    requestHeaders.get("x-real-ip")?.trim() ||
    "127.0.0.1"
  );
}

async function ensureTurnstile(
  token: string | undefined,
  idempotencyKey: string | undefined,
): Promise<ActionResult | null> {
  if (!token) {
    return { error: "Captcha verification required. Please complete the captcha." };
  }

  const result = await verifyTurnstileToken(token, idempotencyKey);
  if (!result.success) {
    return { error: result.error ?? "Captcha verification failed." };
  }

  return null;
}

export async function submitBoardingHouseReport(
  formData: FormData,
): Promise<ActionResult> {
  const parsed = reportSchema.safeParse({
    listingId: formData.get("listingId"),
    reason: formData.get("reason"),
    details: formData.get("details"),
    reporterContact: formData.get("reporterContact") || null,
    turnstileToken: formData.get("turnstileToken") || undefined,
    turnstileIdempotencyKey: formData.get("turnstileIdempotencyKey") || undefined,
  });

  if (!parsed.success) {
    return { error: "Please complete the form with a clear reason and details." };
  }

  const turnstileError = await ensureTurnstile(
    parsed.data.turnstileToken,
    parsed.data.turnstileIdempotencyKey,
  );
  if (turnstileError) {
    return turnstileError;
  }

  const quota = await consumeRateLimit({
    scope: "public:boarding-house-report",
    subject: getClientIp(await headers()),
    requestLimit: 6,
    windowSeconds: 60 * 60,
  });
  if (!quota.allowed) return { error: GENERIC_REPORT_ERROR };

  const client = getSupabaseServiceRoleClient();
  const { data: listing } = await client
    .from("boarding_house_listings")
    .select("id")
    .eq("id", parsed.data.listingId)
    .eq("status", "published")
    .eq("verification_status", "verified")
    .maybeSingle();
  if (!listing) return { error: GENERIC_REPORT_ERROR };

  const { data, error } = await client
    .from("boarding_house_reports")
    .insert({
      listing_id: parsed.data.listingId,
      reason: parsed.data.reason,
      details: parsed.data.details,
      reporter_contact: parsed.data.reporterContact,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[boarding-houses] report insert failed", error);
    return { error: GENERIC_REPORT_ERROR };
  }

  await notifyAdmins({
    eventType: "boarding_house_report_submitted",
    subject: "Boarding-house report submitted",
    text: [
      "A student submitted a boarding-house report.",
      `Reason: ${parsed.data.reason}`,
      `Listing ID: ${parsed.data.listingId}`,
      "Review it in the admin Boarding Houses page.",
    ].join("\n"),
    metadata: {
      reportId: (data as { id?: string } | null)?.id,
      listingId: parsed.data.listingId,
      reason: parsed.data.reason,
    },
  });

  revalidatePath("/admin/boarding-houses");
  revalidatePath("/admin/notifications");
  return { message: "Report submitted. Thank you for keeping students safe." };
}

export async function submitReviewAction(
  formData: FormData,
): Promise<ActionResult> {
  const parsed = reviewSchema.safeParse({
    listingId: formData.get("listingId"),
    rating: formData.get("rating"),
    body: formData.get("body") ?? "",
    slug: formData.get("slug"),
    turnstileToken: formData.get("turnstileToken") || undefined,
    turnstileIdempotencyKey: formData.get("turnstileIdempotencyKey") || undefined,
  });

  if (!parsed.success) {
    return { error: "Please pick a rating from 1 to 5 and keep your review under 2000 characters." };
  }

  const session = await getAuthorizedSession();
  if (!session) {
    return { error: "Please sign in with Google to write a review." };
  }

  const turnstileError = await ensureTurnstile(
    parsed.data.turnstileToken,
    parsed.data.turnstileIdempotencyKey,
  );
  if (turnstileError) {
    return turnstileError;
  }

  const metadata = session.user.user_metadata ?? {};
  const authorDisplayName =
    (typeof metadata.full_name === "string" && metadata.full_name) ||
    (typeof metadata.name === "string" && metadata.name) ||
    session.user.email ||
    "VSU student";

  const serviceClient = getSupabaseServiceRoleClient();
  const { data: listing } = await serviceClient
    .from("boarding_house_listings")
    .select("id,owner_id")
    .eq("id", parsed.data.listingId)
    .eq("status", "published")
    .eq("verification_status", "verified")
    .maybeSingle();
  if (!listing) return { error: GENERIC_REVIEW_ERROR };

  const { data: ownerProfile } = await serviceClient
    .from("owner_profiles")
    .select("user_id")
    .eq("id", listing.owner_id)
    .maybeSingle();
  if (ownerProfile?.user_id === session.user.id) {
    return { error: "Owners cannot review their own boarding house." };
  }

  const { error } = await serviceClient
    .from("boarding_house_reviews")
    .upsert(
      {
        listing_id: parsed.data.listingId,
        author_id: session.user.id,
        author_display_name: authorDisplayName.slice(0, 120),
        rating: parsed.data.rating,
        body: parsed.data.body,
      },
      { onConflict: "listing_id,author_id" },
    );

  if (error) {
    if (error.code === "42501" || /row-level security/i.test(error.message)) {
      return {
        error:
          "You can't review this listing. Owners can't review their own boarding house, and only published, verified listings accept reviews.",
      };
    }
    console.error("[boarding-houses] review upsert failed", error);
    return { error: GENERIC_REVIEW_ERROR };
  }

  revalidatePath(`/boarding-houses/${parsed.data.slug}`);
  return { message: "Thanks! Your review has been posted." };
}
