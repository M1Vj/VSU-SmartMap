"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  ownerApplicationSchema,
  ownerListingDraftSchema,
  slugifyListingName,
  type OwnerOfferingInput,
} from "@/lib/boarding-houses/owner-validation";
import {
  assertOwnerAction,
  getAuthorizedSession,
} from "@/lib/auth/server";
import { notifyAdmins } from "@/lib/notifications/service";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server-client";
import {
  VERIFICATION_DOCUMENT_BUCKET,
  buildVerificationDocumentPath,
  type VerificationDocumentLabel,
} from "@/lib/storage/verification-document-path";

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_DOCUMENT_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
]);

const PHOTO_BUCKET = "boarding-house-photos";
const MAX_PHOTOS = 8;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const PHOTO_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

type ActionResult = {
  error?: string;
  message?: string;
};

const GENERIC_SAVE_ERROR =
  "Could not save your listing. Please check your details and try again.";

export async function submitOwnerApplication(formData: FormData): Promise<ActionResult> {
  const session = await getAuthorizedSession();
  if (!session) return { error: "Please sign in before applying." };

  const parsed = ownerApplicationSchema.safeParse({
    displayName: formData.get("displayName"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    authorityNotes: formData.get("authorityNotes"),
  });

  if (!parsed.success) {
    return { error: "Please complete the application details correctly." };
  }

  const identityDocument = readFile(formData.get("identityDocument"));
  const authorityDocument = readFile(formData.get("authorityDocument"));
  if (!identityDocument || !authorityDocument) {
    return { error: "Upload both an identity document and proof of listing authority." };
  }

  const documentError =
    validateDocument(identityDocument) ?? validateDocument(authorityDocument);
  if (documentError) return { error: documentError };

  const serviceClient = getSupabaseServiceRoleClient();
  const { data: existingApplication } = await serviceClient
    .from("owner_applications")
    .select("id")
    .eq("user_id", session.user.id)
    .in("status", ["pending", "approved"])
    .maybeSingle();
  if (existingApplication) {
    return { error: "You already have an application in progress." };
  }

  const { data: application, error: insertError } = await serviceClient
    .from("owner_applications")
    .insert({
      user_id: session.user.id,
      display_name: parsed.data.displayName,
      phone: parsed.data.phone,
      email: parsed.data.email,
      authority_notes: parsed.data.authorityNotes,
      status: "pending",
    })
    .select("id")
    .maybeSingle();

  if (insertError || !application) {
    console.error("submitOwnerApplication insert failed", insertError);
    return { error: "Could not submit your application. Please try again." };
  }

  const uploadResult = await uploadVerificationDocument({
    applicationId: application.id,
    userId: session.user.id,
    label: "identity",
    file: identityDocument,
  });
  if (uploadResult.error) return { error: uploadResult.error };

  const authorityUploadResult = await uploadVerificationDocument({
    applicationId: application.id,
    userId: session.user.id,
    label: "authority",
    file: authorityDocument,
  });
  if (authorityUploadResult.error) return { error: authorityUploadResult.error };

  await notifyAdmins({
    eventType: "owner_application_submitted",
    subject: `Owner application submitted: ${parsed.data.displayName}`,
    text: [
      `A boarding-house owner application was submitted by ${parsed.data.displayName}.`,
      `Email: ${parsed.data.email}`,
      `Phone: ${parsed.data.phone}`,
      "Review it in the admin Boarding Houses page.",
    ].join("\n"),
    metadata: {
      applicationId: application.id,
      ownerUserId: session.user.id,
      ownerEmail: parsed.data.email,
    },
    client: serviceClient,
  });

  revalidatePath("/admin/boarding-houses");
  revalidatePath("/admin/notifications");
  return { message: "Application submitted. An admin will review it before listings can go live." };
}

export async function createOwnerListing(formData: FormData): Promise<ActionResult> {
  const owner = await assertOwnerAction();
  if ("error" in owner) return { error: owner.error };

  const parsed = ownerListingDraftSchema.safeParse(parseListingForm(formData));

  if (!parsed.success) {
    return { error: firstIssueMessage(parsed.error) };
  }

  const aggregates = deriveListingAggregates(parsed.data.offerings);

  const serviceClient = getSupabaseServiceRoleClient();
  const { data: ownerProfile, error: ownerError } = await serviceClient
    .from("owner_profiles")
    .select("id")
    .eq("user_id", owner.user.id)
    .maybeSingle();

  if (ownerError || !ownerProfile) {
    if (ownerError) console.error("createOwnerListing owner lookup failed", ownerError);
    return { error: "Owner profile was not found. Please wait for admin approval." };
  }

  const slug = `${slugifyListingName(parsed.data.name)}-${Date.now().toString(36)}`;
  const { data: listing, error: listingError } = await serviceClient
    .from("boarding_house_listings")
    .insert({
      owner_id: ownerProfile.id,
      slug,
      name: parsed.data.name,
      description: parsed.data.description,
      address_line: parsed.data.addressLine,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      status: "draft",
      verification_status: "unverified",
      contact_phone: parsed.data.contactPhone,
      contact_facebook: parsed.data.contactFacebook,
      contact_email: parsed.data.contactEmail,
      price_min: aggregates.priceMin,
      price_max: aggregates.priceMax,
      price_changed_at: new Date().toISOString(),
      available_slots: aggregates.availableSlots,
      room_types: aggregates.roomTypes,
      occupancy_policies: parsed.data.occupancyPolicies,
      wifi: parsed.data.wifi,
      cooking_allowed: parsed.data.cookingAllowed,
      furnished: parsed.data.furnished,
      water_included: parsed.data.waterIncluded,
      electricity_included: parsed.data.electricityIncluded,
      private_bathroom: parsed.data.privateBathroom || aggregates.privateBathroom,
      advance_months: parsed.data.advanceMonths,
      deposit_months: parsed.data.depositMonths,
      air_conditioning: parsed.data.airConditioning || aggregates.hasAircon,
      laundry_area: parsed.data.laundryArea,
      drying_area: parsed.data.dryingArea,
      parking: parsed.data.parking,
      study_area: parsed.data.studyArea,
      safety_features: parsed.data.safetyFeatures,
      appliance_fee: parsed.data.applianceFee,
      mobile_carriers: parsed.data.mobileCarriers,
      has_curfew: parsed.data.hasCurfew,
      curfew_time: parsed.data.curfewTime,
      allows_visitors: parsed.data.allowsVisitors,
      allows_pets: parsed.data.allowsPets,
      smoking_allowed: parsed.data.smokingAllowed,
      walking_minutes_to_campus_gate: parsed.data.walkingMinutesToCampusGate,
    })
    .select("id")
    .maybeSingle();

  if (listingError || !listing) {
    console.error("createOwnerListing listing insert failed", listingError);
    return { error: GENERIC_SAVE_ERROR };
  }

  const offeringBuild = await buildOfferingRowsWithImages(
    serviceClient,
    listing.id,
    parsed.data.offerings,
    parsed.data.occupancyPolicies[0],
    formData,
  );
  if ("error" in offeringBuild) {
    const { error: cleanupError } = await serviceClient
      .from("boarding_house_listings")
      .delete()
      .eq("id", listing.id);
    if (cleanupError) {
      console.error("createOwnerListing orphan cleanup failed", cleanupError);
    }
    return { error: offeringBuild.error };
  }

  const { error: offeringError } = await serviceClient
    .from("boarding_house_offerings")
    .insert(offeringBuild.rows);

  if (offeringError) {
    console.error("createOwnerListing offering insert failed", offeringError);
    if (offeringBuild.uploadedPaths.length > 0) {
      await serviceClient.storage.from(PHOTO_BUCKET).remove(offeringBuild.uploadedPaths);
    }
    const { error: cleanupError } = await serviceClient
      .from("boarding_house_listings")
      .delete()
      .eq("id", listing.id);
    if (cleanupError) {
      console.error("createOwnerListing orphan cleanup failed", cleanupError);
    }
    return { error: GENERIC_SAVE_ERROR };
  }

  const photoResult = await syncListingPhotos(
    serviceClient,
    listing.id,
    parsed.data.name,
    formData,
  );
  if ("error" in photoResult) {
    console.error("createOwnerListing photo sync failed", photoResult.error);
  } else if (photoResult.thumbnailPath) {
    const { error: thumbError } = await serviceClient
      .from("boarding_house_listings")
      .update({ thumbnail_url: photoResult.thumbnailPath })
      .eq("id", listing.id);
    if (thumbError) console.error("createOwnerListing thumbnail sync failed", thumbError);
  }

  revalidatePath("/owner");
  redirect("/owner");
}

export async function updateOfferingSlots(
  listingId: string,
  offeringId: string,
  nextSlots: number,
): Promise<ActionResult> {
  const owner = await assertOwnerAction();
  if ("error" in owner) return { error: owner.error };

  if (!Number.isInteger(nextSlots) || nextSlots < 0 || nextSlots > 999) {
    return { error: "Enter a valid number of available slots." };
  }

  const serviceClient = getSupabaseServiceRoleClient();
  const ownership = await loadOwnedListing(serviceClient, owner.user.id, listingId);
  if ("error" in ownership) return { error: ownership.error };

  const { data: offering, error: offeringError } = await serviceClient
    .from("boarding_house_offerings")
    .select("id, listing_id")
    .eq("id", offeringId)
    .eq("listing_id", ownership.listing.id)
    .maybeSingle();
  if (offeringError || !offering) {
    if (offeringError) console.error("updateOfferingSlots lookup failed", offeringError);
    return { error: "Room offering was not found." };
  }

  const { error: updateError } = await serviceClient
    .from("boarding_house_offerings")
    .update({ available_slots: nextSlots })
    .eq("id", offering.id);
  if (updateError) {
    console.error("updateOfferingSlots update failed", updateError);
    return { error: GENERIC_SAVE_ERROR };
  }

  const { data: rows, error: sumError } = await serviceClient
    .from("boarding_house_offerings")
    .select("available_slots")
    .eq("listing_id", ownership.listing.id);
  if (sumError) {
    console.error("updateOfferingSlots sum failed", sumError);
    return { error: GENERIC_SAVE_ERROR };
  }
  const totalSlots = (rows ?? []).reduce(
    (sum, row) => sum + (row.available_slots ?? 0),
    0,
  );

  const { error: listingError } = await serviceClient
    .from("boarding_house_listings")
    .update({ available_slots: totalSlots })
    .eq("id", ownership.listing.id);
  if (listingError) {
    console.error("updateOfferingSlots listing sync failed", listingError);
    return { error: GENERIC_SAVE_ERROR };
  }

  revalidatePath("/owner");
  return { message: "Availability updated." };
}

export async function submitListingForReview(listingId: string): Promise<ActionResult> {
  const owner = await assertOwnerAction();
  if ("error" in owner) return { error: owner.error };

  const serviceClient = getSupabaseServiceRoleClient();
  const ownership = await loadOwnedListing(serviceClient, owner.user.id, listingId);
  if ("error" in ownership) return { error: ownership.error };

  if (ownership.listing.status === "suspended") {
    return {
      error:
        "This listing was suspended by an admin. Please resolve the issue with the administrators before resubmitting.",
    };
  }

  const { error: updateError } = await serviceClient
    .from("boarding_house_listings")
    .update({
      status: "pending_review",
      submitted_at: new Date().toISOString(),
      moderation_note: null,
    })
    .eq("id", ownership.listing.id);

  if (updateError) {
    console.error("submitListingForReview update failed", updateError);
    return { error: GENERIC_SAVE_ERROR };
  }

  await notifyAdmins({
    eventType: "boarding_house_listing_submitted",
    subject: `Boarding-house listing submitted: ${ownership.listing.name}`,
    text: [
      `A boarding-house listing was submitted for review: ${ownership.listing.name}.`,
      `Listing ID: ${ownership.listing.id}`,
      "Review it in the admin Boarding Houses page.",
    ].join("\n"),
    metadata: {
      listingId: ownership.listing.id,
      ownerUserId: owner.user.id,
    },
    client: serviceClient,
  });

  revalidatePath("/owner");
  revalidatePath("/admin/boarding-houses");
  revalidatePath("/admin/notifications");
  return { message: "Listing submitted for review." };
}

export async function updateOwnerListing(
  listingId: string,
  formData: FormData,
): Promise<ActionResult> {
  const owner = await assertOwnerAction();
  if ("error" in owner) return { error: owner.error };

  const parsed = ownerListingDraftSchema.safeParse(parseListingForm(formData));
  if (!parsed.success) {
    return { error: firstIssueMessage(parsed.error) };
  }

  const serviceClient = getSupabaseServiceRoleClient();
  const ownership = await loadOwnedListing(serviceClient, owner.user.id, listingId);
  if ("error" in ownership) return { error: ownership.error };

  const current = ownership.listing;
  const aggregates = deriveListingAggregates(parsed.data.offerings);

  const photoResult = await syncListingPhotos(
    serviceClient,
    current.id,
    parsed.data.name,
    formData,
  );
  if ("error" in photoResult) return { error: photoResult.error };

  // Substantive edits (identity, location, copy, photos) require admin re-review;
  // safe edits (pricing, slots, contacts, amenities/rules, move-in terms) apply live.
  const substantiveChanged =
    parsed.data.name !== current.name ||
    parsed.data.addressLine !== current.address_line ||
    parsed.data.latitude !== current.latitude ||
    parsed.data.longitude !== current.longitude ||
    parsed.data.description !== (current.description ?? "") ||
    !sameStringSet(parsed.data.safetyFeatures, current.safety_features ?? []);

  const photosChanged = photoResult.added > 0 || photoResult.removed > 0;

  const isLive =
    current.status === "published" || current.verification_status === "verified";

  const requiresReview = isLive && (substantiveChanged || photosChanged);

  const statusFields = requiresReview
    ? { status: "pending_review" as const, submitted_at: new Date().toISOString() }
    : {};

  const priceChanged =
    aggregates.priceMin !== current.price_min ||
    aggregates.priceMax !== current.price_max;

  const { error: updateError } = await serviceClient
    .from("boarding_house_listings")
    .update({
      name: parsed.data.name,
      description: parsed.data.description,
      address_line: parsed.data.addressLine,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      contact_phone: parsed.data.contactPhone,
      contact_facebook: parsed.data.contactFacebook,
      contact_email: parsed.data.contactEmail,
      price_min: aggregates.priceMin,
      price_max: aggregates.priceMax,
      ...(priceChanged ? { price_changed_at: new Date().toISOString() } : {}),
      available_slots: aggregates.availableSlots,
      thumbnail_url: photoResult.thumbnailPath,
      room_types: aggregates.roomTypes,
      occupancy_policies: parsed.data.occupancyPolicies,
      wifi: parsed.data.wifi,
      cooking_allowed: parsed.data.cookingAllowed,
      furnished: parsed.data.furnished,
      water_included: parsed.data.waterIncluded,
      electricity_included: parsed.data.electricityIncluded,
      private_bathroom: parsed.data.privateBathroom || aggregates.privateBathroom,
      advance_months: parsed.data.advanceMonths,
      deposit_months: parsed.data.depositMonths,
      air_conditioning: parsed.data.airConditioning || aggregates.hasAircon,
      laundry_area: parsed.data.laundryArea,
      drying_area: parsed.data.dryingArea,
      parking: parsed.data.parking,
      study_area: parsed.data.studyArea,
      safety_features: parsed.data.safetyFeatures,
      appliance_fee: parsed.data.applianceFee,
      mobile_carriers: parsed.data.mobileCarriers,
      has_curfew: parsed.data.hasCurfew,
      curfew_time: parsed.data.curfewTime,
      allows_visitors: parsed.data.allowsVisitors,
      allows_pets: parsed.data.allowsPets,
      smoking_allowed: parsed.data.smokingAllowed,
      walking_minutes_to_campus_gate: parsed.data.walkingMinutesToCampusGate,
      ...statusFields,
    })
    .eq("id", current.id);

  if (updateError) {
    console.error("updateOwnerListing update failed", updateError);
    return { error: GENERIC_SAVE_ERROR };
  }

  // Replace the full offering set so rooms added/removed/edited stay in sync.
  // Insert the new rows before deleting the old ones so a mid-sequence failure
  // never leaves the listing with zero offerings.
  const { data: oldOfferings, error: offeringLoadError } = await serviceClient
    .from("boarding_house_offerings")
    .select("id, image_path")
    .eq("listing_id", current.id);
  if (offeringLoadError) {
    console.error("updateOwnerListing offering load failed", offeringLoadError);
    return { error: GENERIC_SAVE_ERROR };
  }
  const offeringBuild = await buildOfferingRowsWithImages(
    serviceClient,
    current.id,
    parsed.data.offerings,
    parsed.data.occupancyPolicies[0],
    formData,
  );
  if ("error" in offeringBuild) return { error: offeringBuild.error };
  const { error: offeringInsertError } = await serviceClient
    .from("boarding_house_offerings")
    .insert(offeringBuild.rows);
  if (offeringInsertError) {
    console.error("updateOwnerListing offering insert failed", offeringInsertError);
    if (offeringBuild.uploadedPaths.length > 0) {
      await serviceClient.storage.from(PHOTO_BUCKET).remove(offeringBuild.uploadedPaths);
    }
    return { error: GENERIC_SAVE_ERROR };
  }
  const oldOfferingIds = (oldOfferings ?? []).map((row) => row.id);
  if (oldOfferingIds.length > 0) {
    const { error: offeringDeleteError } = await serviceClient
      .from("boarding_house_offerings")
      .delete()
      .in("id", oldOfferingIds);
    if (offeringDeleteError) {
      console.error("updateOwnerListing offering delete failed", offeringDeleteError);
      return { error: GENERIC_SAVE_ERROR };
    }
  }
  // Remove room-image objects the previous offering set referenced but the new
  // set no longer does; kept paths stay because they appear in nextImagePaths.
  const nextImagePaths = new Set(
    offeringBuild.rows
      .map((row) => row.image_path)
      .filter((path): path is string => typeof path === "string" && path.length > 0),
  );
  const orphanImagePaths = (oldOfferings ?? [])
    .map((row) => row.image_path)
    .filter(
      (path): path is string =>
        typeof path === "string" && path.length > 0 && !nextImagePaths.has(path),
    );
  if (orphanImagePaths.length > 0) {
    const { error: orphanRemoveError } = await serviceClient.storage
      .from(PHOTO_BUCKET)
      .remove(orphanImagePaths);
    if (orphanRemoveError) {
      console.error("updateOwnerListing room image cleanup failed", orphanRemoveError);
    }
  }

  const { error: moderationEventError } = await serviceClient
    .from("boarding_house_moderation_events")
    .insert({
      listing_id: current.id,
      actor_id: owner.user.id,
      event_type: requiresReview ? "owner_resubmitted_for_review" : "owner_edited",
      note: null,
    });
  if (moderationEventError) {
    console.error("updateOwnerListing moderation event insert failed", moderationEventError);
  }

  if (requiresReview) {
    await notifyAdmins({
      eventType: "boarding_house_listing_updated",
      subject: `Boarding-house listing updated: ${parsed.data.name}`,
      text: [
        `A published boarding-house listing was updated and needs re-review: ${parsed.data.name}.`,
        `Listing ID: ${current.id}`,
        "Review it in the admin Boarding Houses page.",
      ].join("\n"),
      metadata: {
        listingId: current.id,
        ownerUserId: owner.user.id,
      },
      client: serviceClient,
    });
  }

  revalidatePath("/owner");
  if (requiresReview) {
    revalidatePath("/admin/boarding-houses");
    revalidatePath("/admin/notifications");
  }
  return {
    message: requiresReview
      ? "Changes saved and submitted for re-review."
      : "Listing updated.",
  };
}

async function uploadVerificationDocument({
  applicationId,
  userId,
  label,
  file,
}: {
  applicationId: string;
  userId: string;
  label: VerificationDocumentLabel;
  file: File;
}): Promise<ActionResult> {
  const serviceClient = getSupabaseServiceRoleClient();
  const documentId = randomUUID();
  const now = Date.now();
  const storagePath = buildVerificationDocumentPath({
    userId,
    applicationId,
    label,
    timestamp: now,
    filename: file.name,
  });
  const { error: rowError } = await serviceClient
    .from("owner_verification_documents")
    .insert({
      id: documentId,
      application_id: applicationId,
      user_id: userId,
      storage_bucket: VERIFICATION_DOCUMENT_BUCKET,
      storage_path: storagePath,
      original_filename: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      delete_after: new Date(now + 90 * 24 * 60 * 60 * 1000).toISOString(),
    });

  if (rowError) {
    console.error("uploadVerificationDocument row insert failed");
    return { error: "Could not save your documents. Please try again." };
  }

  const { error: uploadError } = await serviceClient.storage
    .from(VERIFICATION_DOCUMENT_BUCKET)
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    console.error("uploadVerificationDocument upload failed");
    const { error: retentionError } = await serviceClient
      .from("owner_verification_documents")
      .update({ delete_after: new Date(now).toISOString() })
      .eq("id", documentId);
    if (retentionError) {
      console.error("uploadVerificationDocument retention expedite failed");
    }
    return { error: "Could not upload your documents. Please try again." };
  }
  return {};
}

type OwnedListing = {
  id: string;
  name: string;
  description: string | null;
  address_line: string;
  latitude: number;
  longitude: number;
  status: string;
  verification_status: string;
  price_min: number | null;
  price_max: number | null;
  safety_features: string[] | null;
};

async function loadOwnedListing(
  serviceClient: ReturnType<typeof getSupabaseServiceRoleClient>,
  userId: string,
  listingId: string,
): Promise<{ listing: OwnedListing } | { error: string }> {
  if (!listingId) return { error: "Listing was not found." };

  const { data: ownerProfile, error: ownerError } = await serviceClient
    .from("owner_profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (ownerError || !ownerProfile) {
    if (ownerError) console.error("loadOwnedListing owner lookup failed", ownerError);
    return { error: "Owner profile was not found. Please wait for admin approval." };
  }

  const { data: listing, error: listingError } = await serviceClient
    .from("boarding_house_listings")
    .select(
      "id, name, description, address_line, latitude, longitude, status, verification_status, price_min, price_max, safety_features, owner_id",
    )
    .eq("id", listingId)
    .maybeSingle();

  if (listingError) {
    console.error("loadOwnedListing listing lookup failed", listingError);
    return { error: GENERIC_SAVE_ERROR };
  }
  if (!listing || listing.owner_id !== ownerProfile.id) {
    return { error: "Listing was not found." };
  }

  return { listing };
}

// Radix checkboxes submit their field name (or "on") only when checked and are
// absent when unchecked, so detect state by presence rather than a fixed value.
function checkboxOn(formData: FormData, name: string): boolean {
  return formData.get(name) != null;
}

function parseListingForm(formData: FormData) {
  return {
    name: formData.get("name"),
    description: formData.get("description"),
    addressLine: formData.get("addressLine"),
    latitude: formData.get("latitude"),
    longitude: formData.get("longitude"),
    contactPhone: formData.get("contactPhone"),
    contactFacebook: formData.get("contactFacebook"),
    contactEmail: formData.get("contactEmail"),
    occupancyPolicies: formData.getAll("occupancyPolicies"),
    offerings: parseOfferings(formData.get("offerings")),
    wifi: checkboxOn(formData, "wifi"),
    cookingAllowed: checkboxOn(formData, "cookingAllowed"),
    furnished: checkboxOn(formData, "furnished"),
    waterIncluded: checkboxOn(formData, "waterIncluded"),
    electricityIncluded: checkboxOn(formData, "electricityIncluded"),
    privateBathroom: checkboxOn(formData, "privateBathroom"),
    advanceMonths: formData.get("advanceMonths"),
    depositMonths: formData.get("depositMonths"),
    airConditioning: checkboxOn(formData, "airConditioning"),
    laundryArea: checkboxOn(formData, "laundryArea"),
    dryingArea: checkboxOn(formData, "dryingArea"),
    parking: checkboxOn(formData, "parking"),
    studyArea: checkboxOn(formData, "studyArea"),
    safetyFeatures: formData.getAll("safetyFeatures"),
    mobileCarriers: formData.getAll("mobileCarriers"),
    applianceFee: formData.get("applianceFee"),
    hasCurfew: checkboxOn(formData, "hasCurfew"),
    curfewTime: formData.get("curfewTime"),
    allowsVisitors: checkboxOn(formData, "allowsVisitors"),
    allowsPets: checkboxOn(formData, "allowsPets"),
    smokingAllowed: checkboxOn(formData, "smokingAllowed"),
    walkingMinutesToCampusGate: formData.get("walkingMinutesToCampusGate"),
  };
}

type PhotoManifestEntry = { t: "e"; id: string } | { t: "n" };

type PhotoSyncResult =
  | { added: number; removed: number; thumbnailPath: string | null }
  | { error: string };

// Reconcile a listing's photos against the ordered manifest the owner form sends:
// existing photos are kept/reordered/removed and newly uploaded files are inserted,
// keeping thumbnail_url pointed at the sort_order=0 storage path (the read pipeline
// re-signs that path on display). Runs with the service role, which bypasses RLS.
async function syncListingPhotos(
  serviceClient: ReturnType<typeof getSupabaseServiceRoleClient>,
  listingId: string,
  listingName: string,
  formData: FormData,
): Promise<PhotoSyncResult> {
  const manifest = parsePhotoManifest(formData.get("photoManifest"));
  if (!manifest) return { error: "Could not read the photo order. Please try again." };

  const newFiles = formData
    .getAll("photos")
    .filter((value): value is File => value instanceof File && value.size > 0);

  if (manifest.length > MAX_PHOTOS) {
    return { error: `You can keep at most ${MAX_PHOTOS} photos per listing.` };
  }

  const expectedNew = manifest.filter((entry) => entry.t === "n").length;
  if (expectedNew !== newFiles.length) {
    return { error: "The photos did not upload correctly. Please try again." };
  }

  for (const file of newFiles) {
    if (!PHOTO_EXTENSIONS[file.type]) {
      return { error: "Photos must be PNG, JPG, or WebP files." };
    }
    if (file.size > MAX_PHOTO_BYTES) {
      return { error: "Each photo must be 5MB or smaller." };
    }
  }

  const { data: currentPhotos, error: loadError } = await serviceClient
    .from("boarding_house_photos")
    .select("id, storage_bucket, storage_path")
    .eq("listing_id", listingId)
    .order("sort_order", { ascending: true });

  if (loadError) {
    console.error("syncListingPhotos load failed", loadError);
    return { error: GENERIC_SAVE_ERROR };
  }

  const currentById = new Map(
    (currentPhotos ?? []).map((photo) => [photo.id, photo]),
  );
  const keptIds = new Set(
    manifest.flatMap((entry) => (entry.t === "e" && currentById.has(entry.id) ? [entry.id] : [])),
  );
  const removed = (currentPhotos ?? []).filter((photo) => !keptIds.has(photo.id));

  // Upload the new files first so we can resolve every storage path before writing rows.
  const uploadedPaths: string[] = [];
  for (const file of newFiles) {
    const path = `${listingId}/${randomUUID()}.${PHOTO_EXTENSIONS[file.type]}`;
    const { error: uploadError } = await serviceClient.storage
      .from(PHOTO_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) {
      console.error("syncListingPhotos upload failed", uploadError);
      if (uploadedPaths.length > 0) {
        await serviceClient.storage.from(PHOTO_BUCKET).remove(uploadedPaths);
      }
      return { error: "Could not upload your photos. Please try again." };
    }
    uploadedPaths.push(path);
  }

  if (removed.length > 0) {
    const removedIds = removed.map((photo) => photo.id);
    const { error: deleteRowError } = await serviceClient
      .from("boarding_house_photos")
      .delete()
      .in("id", removedIds);
    if (deleteRowError) {
      console.error("syncListingPhotos delete rows failed", deleteRowError);
      return { error: GENERIC_SAVE_ERROR };
    }
    const removedPaths = removed.map((photo) => photo.storage_path);
    const { error: deleteObjectError } = await serviceClient.storage
      .from(PHOTO_BUCKET)
      .remove(removedPaths);
    if (deleteObjectError) {
      console.error("syncListingPhotos delete objects failed", deleteObjectError);
    }
  }

  let newPointer = 0;
  let thumbnailPath: string | null = null;
  const inserts: Array<Record<string, unknown>> = [];

  for (let index = 0; index < manifest.length; index += 1) {
    const entry = manifest[index];
    if (entry.t === "e") {
      const existing = currentById.get(entry.id);
      if (!existing) continue;
      const { error: reorderError } = await serviceClient
        .from("boarding_house_photos")
        .update({ sort_order: index })
        .eq("id", entry.id);
      if (reorderError) {
        console.error("syncListingPhotos reorder failed", reorderError);
        return { error: GENERIC_SAVE_ERROR };
      }
      if (index === 0) thumbnailPath = existing.storage_path;
    } else {
      const path = uploadedPaths[newPointer];
      newPointer += 1;
      inserts.push({
        listing_id: listingId,
        storage_bucket: PHOTO_BUCKET,
        storage_path: path,
        public_url: path,
        alt_text: `${listingName} photo ${index + 1}`,
        sort_order: index,
      });
      if (index === 0) thumbnailPath = path;
    }
  }

  if (inserts.length > 0) {
    const { error: insertError } = await serviceClient
      .from("boarding_house_photos")
      .insert(inserts);
    if (insertError) {
      console.error("syncListingPhotos insert failed", insertError);
      return { error: GENERIC_SAVE_ERROR };
    }
  }

  return { added: newFiles.length, removed: removed.length, thumbnailPath };
}

function parsePhotoManifest(value: FormDataEntryValue | null): PhotoManifestEntry[] | null {
  if (typeof value !== "string" || value.trim() === "") return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  const entries: PhotoManifestEntry[] = [];
  for (const item of parsed) {
    if (item && typeof item === "object" && "t" in item) {
      const tag = (item as { t: unknown }).t;
      if (tag === "e" && typeof (item as { id?: unknown }).id === "string") {
        entries.push({ t: "e", id: (item as { id: string }).id });
      } else if (tag === "n") {
        entries.push({ t: "n" });
      } else {
        return null;
      }
    } else {
      return null;
    }
  }
  return entries;
}

function parseOfferings(value: FormDataEntryValue | null): unknown[] {
  if (typeof value !== "string" || value.trim() === "") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function deriveListingAggregates(offerings: OwnerOfferingInput[]) {
  const prices = offerings.map((offering) => offering.monthlyPrice);
  return {
    priceMin: Math.min(...prices),
    priceMax: Math.max(...prices),
    availableSlots: offerings.reduce((sum, offering) => sum + offering.availableSlots, 0),
    roomTypes: Array.from(new Set(offerings.map((offering) => offering.roomType))),
    hasAircon: offerings.some((offering) => offering.hasAircon),
    privateBathroom: offerings.some((offering) => offering.privateBathroom),
  };
}

const OFFERING_IMAGE_FOLDER = "rooms";

// Build the offering rows for a listing, resolving each row's optional room image:
// "keep" reuses the existing path (validated to belong to this listing), "new"
// uploads the next file from the ordered offeringImages field, "none" clears it.
// Uploaded objects are cleaned up if a later step fails so nothing is orphaned.
async function buildOfferingRowsWithImages(
  serviceClient: ReturnType<typeof getSupabaseServiceRoleClient>,
  listingId: string,
  offerings: OwnerOfferingInput[],
  occupancyPolicy: string,
  formData: FormData,
): Promise<
  { rows: Array<Record<string, unknown>>; uploadedPaths: string[] } | { error: string }
> {
  const newFiles = formData
    .getAll("offeringImages")
    .filter((value): value is File => value instanceof File && value.size > 0);

  const expectedNew = offerings.filter((offering) => offering.image.t === "new").length;
  if (expectedNew !== newFiles.length) {
    return { error: "The room photos did not upload correctly. Please try again." };
  }
  for (const file of newFiles) {
    if (!PHOTO_EXTENSIONS[file.type]) {
      return { error: "Room photos must be PNG, JPG, or WebP files." };
    }
    if (file.size > MAX_PHOTO_BYTES) {
      return { error: "Each room photo must be 5MB or smaller." };
    }
  }

  const uploadedPaths: string[] = [];
  const rows: Array<Record<string, unknown>> = [];
  let filePointer = 0;

  for (const offering of offerings) {
    let imagePath: string | null = null;

    if (offering.image.t === "keep") {
      const kept = offering.imagePath;
      if (kept) {
        if (!kept.startsWith(`${listingId}/`)) {
          if (uploadedPaths.length > 0) {
            await serviceClient.storage.from(PHOTO_BUCKET).remove(uploadedPaths);
          }
          return { error: GENERIC_SAVE_ERROR };
        }
        imagePath = kept;
      }
    } else if (offering.image.t === "new") {
      const file = newFiles[filePointer];
      filePointer += 1;
      const path = `${listingId}/${OFFERING_IMAGE_FOLDER}/${randomUUID()}.${PHOTO_EXTENSIONS[file.type]}`;
      const { error: uploadError } = await serviceClient.storage
        .from(PHOTO_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) {
        console.error("buildOfferingRowsWithImages upload failed", uploadError);
        if (uploadedPaths.length > 0) {
          await serviceClient.storage.from(PHOTO_BUCKET).remove(uploadedPaths);
        }
        return { error: "Could not upload your room photos. Please try again." };
      }
      uploadedPaths.push(path);
      imagePath = path;
    }

    rows.push({
      listing_id: listingId,
      room_type: offering.roomType,
      label: offering.label,
      monthly_price: offering.monthlyPrice,
      available_slots: offering.availableSlots,
      occupancy_policy: occupancyPolicy,
      capacity: offering.capacity,
      size_sqm: offering.sizeSqm,
      has_aircon: offering.hasAircon,
      private_bathroom: offering.privateBathroom,
      image_path: imagePath,
    });
  }

  return { rows, uploadedPaths };
}

function sameStringSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((value, index) => value === sortedB[index]);
}

function firstIssueMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Please complete the listing details correctly.";
}

function readFile(value: FormDataEntryValue | null): File | null {
  if (!(value instanceof File) || value.size === 0) return null;
  return value;
}

function validateDocument(file: File): string | null {
  if (!ALLOWED_DOCUMENT_TYPES.has(file.type)) {
    return "Documents must be PNG, JPG, WebP, or PDF files.";
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    return "Each document must be 10MB or smaller.";
  }
  return null;
}
