import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { requireOwnerSession } from "@/lib/auth/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server-client";
import { signStoragePaths } from "@/lib/boarding-houses/photo-urls";
import {
  OwnerListingForm,
  type OwnerListingFormInitial,
} from "@/components/owner/owner-listing-form";

const DEFAULT_PHOTO_BUCKET = "boarding-house-photos";

type Props = { params: Promise<{ id: string }> };

export default async function EditOwnerListingPage({ params }: Props) {
  const { id } = await params;
  const session = await requireOwnerSession();
  const serviceClient = getSupabaseServiceRoleClient();

  const { data: ownerProfile } = await serviceClient
    .from("owner_profiles")
    .select("id")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (!ownerProfile) {
    notFound();
  }

  const { data: listing } = await serviceClient
    .from("boarding_house_listings")
    .select(
      "id, owner_id, name, address_line, latitude, longitude, description, contact_phone, contact_facebook, contact_email, walking_minutes_to_campus_gate, occupancy_policies, wifi, water_included, electricity_included, private_bathroom, advance_months, deposit_months, cooking_allowed, furnished, air_conditioning, laundry_area, drying_area, parking, study_area, safety_features, appliance_fee, mobile_carriers, has_curfew, allows_visitors, allows_pets, smoking_allowed, curfew_time, boarding_house_photos(id, storage_bucket, storage_path, alt_text, sort_order), boarding_house_offerings(id, room_type, label, monthly_price, available_slots, capacity, size_sqm, has_aircon, private_bathroom, image_path, created_at)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!listing || listing.owner_id !== ownerProfile.id) {
    notFound();
  }

  const photoRows = [...(listing.boarding_house_photos ?? [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  );
  const signedPhotoUrls = await signStoragePaths(
    DEFAULT_PHOTO_BUCKET,
    photoRows.map((photo) => photo.storage_path),
  );
  const photos = photoRows.flatMap((photo, index) => {
    const url = signedPhotoUrls[index];
    return url ? [{ id: photo.id, url, alt: photo.alt_text ?? "" }] : [];
  });

  const offeringRows = [...(listing.boarding_house_offerings ?? [])].sort((a, b) =>
    String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")),
  );
  const offeringImagePaths = offeringRows
    .map((offering) => offering.image_path)
    .filter((path): path is string => Boolean(path));
  const signedOfferingUrls = await signStoragePaths(
    DEFAULT_PHOTO_BUCKET,
    offeringImagePaths,
  );
  const offeringUrlByPath = new Map<string, string>();
  offeringImagePaths.forEach((path, index) => {
    const url = signedOfferingUrls[index];
    if (url) offeringUrlByPath.set(path, url);
  });
  const offerings = offeringRows.map((offering) => ({
    label: offering.label,
    roomType: offering.room_type,
    monthlyPrice: offering.monthly_price,
    availableSlots: offering.available_slots,
    capacity: offering.capacity ?? null,
    sizeSqm: offering.size_sqm ?? null,
    hasAircon: Boolean(offering.has_aircon),
    privateBathroom: Boolean(offering.private_bathroom),
    imagePath: offering.image_path ?? null,
    imageUrl: offering.image_path
      ? offeringUrlByPath.get(offering.image_path) ?? null
      : null,
  }));

  const initial: OwnerListingFormInitial = {
    id: listing.id,
    name: listing.name,
    addressLine: listing.address_line,
    latitude: listing.latitude,
    longitude: listing.longitude,
    description: listing.description ?? "",
    contactPhone: listing.contact_phone,
    contactFacebook: listing.contact_facebook,
    contactEmail: listing.contact_email,
    walkingMinutesToCampusGate: listing.walking_minutes_to_campus_gate,
    occupancyPolicies: listing.occupancy_policies ?? [],
    offerings,
    wifi: Boolean(listing.wifi),
    waterIncluded: Boolean(listing.water_included),
    electricityIncluded: Boolean(listing.electricity_included),
    privateBathroom: Boolean(listing.private_bathroom),
    advanceMonths: listing.advance_months ?? null,
    depositMonths: listing.deposit_months ?? null,
    cookingAllowed: Boolean(listing.cooking_allowed),
    furnished: Boolean(listing.furnished),
    airConditioning: Boolean(listing.air_conditioning),
    laundryArea: Boolean(listing.laundry_area),
    dryingArea: Boolean(listing.drying_area),
    parking: Boolean(listing.parking),
    studyArea: Boolean(listing.study_area),
    safetyFeatures: listing.safety_features ?? [],
    applianceFee: listing.appliance_fee ?? null,
    mobileCarriers: listing.mobile_carriers ?? [],
    hasCurfew: Boolean(listing.has_curfew),
    allowsVisitors: Boolean(listing.allows_visitors),
    allowsPets: Boolean(listing.allows_pets),
    smokingAllowed: Boolean(listing.smoking_allowed),
    curfewTime: listing.curfew_time,
    photos,
  };

  return (
    <main className="min-h-[100dvh] bg-muted/30 px-4 py-6">
      <div className="mx-auto max-w-4xl">
        <header className="mb-5">
          <Link
            href="/owner"
            className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Edit listing</h1>
        </header>
        <OwnerListingForm initial={initial} />
      </div>
    </main>
  );
}
