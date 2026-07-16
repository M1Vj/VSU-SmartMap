import type { Metadata } from "next";
import { AlertCircle, Home, ShieldCheck } from "lucide-react";

import { AdminBreadcrumbs } from "@/components/admin/admin-breadcrumbs";
import { BoardingHousesAdminTabs } from "@/components/admin/boarding-houses/boarding-houses-admin-tabs";
import type {
  AdminApplication,
  AdminListing,
  AdminListingPhoto,
  AdminReport,
  AdminVerificationDocument,
} from "@/components/admin/boarding-houses/types";
import { requireAdminSession } from "@/lib/auth/server";
import { signStoragePaths } from "@/lib/boarding-houses/photo-urls";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Boarding Houses | Campus SmartMap for VSU Admin",
};

const DEFAULT_PHOTO_BUCKET = "boarding-house-photos";

type RawPhoto = {
  storage_bucket: string | null;
  storage_path: string;
  alt_text: string | null;
  sort_order: number | null;
};

async function signListingPhotos(
  rows: { id: string; boarding_house_photos: RawPhoto[] | null }[],
): Promise<Map<string, AdminListingPhoto[]>> {
  // Batch every photo across every listing into one signed-URL request per
  // bucket, then distribute the results back. Private bucket → must sign.
  const byBucket = new Map<string, { listingId: string; alt: string }[]>();
  const pathsByBucket = new Map<string, string[]>();

  for (const row of rows) {
    const photos = [...(row.boarding_house_photos ?? [])].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
    );
    for (const photo of photos) {
      if (!photo.storage_path) continue;
      const bucket = photo.storage_bucket || DEFAULT_PHOTO_BUCKET;
      const meta = byBucket.get(bucket) ?? [];
      const paths = pathsByBucket.get(bucket) ?? [];
      meta.push({ listingId: row.id, alt: photo.alt_text ?? "" });
      paths.push(photo.storage_path);
      byBucket.set(bucket, meta);
      pathsByBucket.set(bucket, paths);
    }
  }

  const result = new Map<string, AdminListingPhoto[]>();
  for (const [bucket, paths] of pathsByBucket) {
    const signed = await signStoragePaths(bucket, paths);
    const meta = byBucket.get(bucket) ?? [];
    signed.forEach((url, index) => {
      if (!url) return;
      const entry = meta[index];
      const list = result.get(entry.listingId) ?? [];
      list.push({ url, alt: entry.alt });
      result.set(entry.listingId, list);
    });
  }

  return result;
}

async function signVerificationDocuments(
  rows: {
    id: string;
    application_id: string;
    storage_bucket: string;
    storage_path: string;
    original_filename: string;
    size_bytes: number;
  }[],
): Promise<Map<string, AdminVerificationDocument[]>> {
  const byBucket = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = byBucket.get(row.storage_bucket) ?? [];
    list.push(row);
    byBucket.set(row.storage_bucket, list);
  }

  const result = new Map<string, AdminVerificationDocument[]>();
  for (const [bucket, bucketRows] of byBucket) {
    const signed = await signStoragePaths(bucket, bucketRows.map((row) => row.storage_path));
    signed.forEach((url, index) => {
      const row = bucketRows[index];
      const list = result.get(row.application_id) ?? [];
      list.push({
        id: row.id,
        filename: row.original_filename,
        sizeBytes: row.size_bytes,
        url,
      });
      result.set(row.application_id, list);
    });
  }

  return result;
}

export default async function AdminBoardingHousesPage() {
  const admin = await requireAdminSession();

  const [applicationsResult, listingsResult, reportsResult] = await Promise.all([
    admin.serviceClient
      .from("owner_applications")
      .select("id, display_name, phone, email, authority_notes, status, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
    admin.serviceClient
      .from("boarding_house_listings")
      .select(
        "id, slug, name, description, address_line, latitude, longitude, status, verification_status, contact_phone, contact_facebook, contact_email, price_min, price_max, available_slots, room_types, occupancy_policies, wifi, cooking_allowed, furnished, water_included, electricity_included, air_conditioning, laundry_area, drying_area, parking, study_area, safety_features, appliance_fee, mobile_carriers, has_curfew, curfew_time, allows_visitors, allows_pets, smoking_allowed, walking_minutes_to_campus_gate, owner_display_name, avg_rating, rating_count, moderation_note, created_at, updated_at, submitted_at, published_at, boarding_house_photos(storage_bucket, storage_path, alt_text, sort_order)",
      )
      .in("status", ["draft", "pending_review", "published", "unpublished", "suspended", "rejected"])
      .order("updated_at", { ascending: false }),
    admin.serviceClient
      .from("boarding_house_reports")
      .select("id, listing_id, reason, details, reporter_contact, status, created_at, boarding_house_listings(name)")
      .in("status", ["open", "reviewing"])
      .order("created_at", { ascending: true }),
  ]);

  const setupErrors = [
    applicationsResult.error,
    listingsResult.error,
    reportsResult.error,
  ].filter(Boolean);

  const listingRows = listingsResult.data ?? [];
  const signedPhotos = await signListingPhotos(
    listingRows.map((row) => ({
      id: row.id,
      boarding_house_photos: (row.boarding_house_photos as RawPhoto[] | null) ?? null,
    })),
  );

  const listings: AdminListing[] = listingRows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? "",
    addressLine: row.address_line,
    latitude: row.latitude,
    longitude: row.longitude,
    status: row.status,
    verificationStatus: row.verification_status,
    contactPhone: row.contact_phone,
    contactFacebook: row.contact_facebook,
    contactEmail: row.contact_email,
    priceMin: row.price_min,
    priceMax: row.price_max,
    availableSlots: row.available_slots,
    roomTypes: row.room_types ?? [],
    occupancyPolicies: row.occupancy_policies ?? [],
    amenities: {
      wifi: row.wifi,
      cookingAllowed: row.cooking_allowed,
      furnished: row.furnished,
      waterIncluded: row.water_included,
      electricityIncluded: row.electricity_included,
      airConditioning: row.air_conditioning,
      laundryArea: row.laundry_area,
      dryingArea: row.drying_area,
      parking: row.parking,
      studyArea: row.study_area,
    },
    rules: {
      hasCurfew: row.has_curfew,
      curfewTime: row.curfew_time,
      allowsVisitors: row.allows_visitors,
      allowsPets: row.allows_pets,
      smokingAllowed: row.smoking_allowed,
    },
    safetyFeatures: row.safety_features ?? [],
    applianceFee: row.appliance_fee ?? null,
    mobileCarriers: row.mobile_carriers ?? [],
    walkingMinutesToCampusGate: row.walking_minutes_to_campus_gate,
    ownerDisplayName: row.owner_display_name ?? "",
    avgRating: Number(row.avg_rating ?? 0),
    ratingCount: row.rating_count ?? 0,
    moderationNote: row.moderation_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    submittedAt: row.submitted_at,
    publishedAt: row.published_at,
    photos: signedPhotos.get(row.id) ?? [],
  }));

  const applicationRows = applicationsResult.data ?? [];
  const documentsResult = applicationRows.length
    ? await admin.serviceClient
        .from("owner_verification_documents")
        .select("id, application_id, storage_bucket, storage_path, original_filename, size_bytes")
        .in(
          "application_id",
          applicationRows.map((row) => row.id),
        )
    : { data: [], error: null };
  if (documentsResult.error) setupErrors.push(documentsResult.error);
  const signedDocuments = await signVerificationDocuments(documentsResult.data ?? []);

  const applications: AdminApplication[] = applicationRows.map((row) => ({
    id: row.id,
    displayName: row.display_name,
    phone: row.phone,
    email: row.email,
    authorityNotes: row.authority_notes,
    status: row.status,
    createdAt: row.created_at,
    documents: signedDocuments.get(row.id) ?? [],
  }));

  const reports: AdminReport[] = (reportsResult.data ?? []).map((row) => ({
    id: row.id,
    listingId: row.listing_id,
    reason: row.reason,
    details: row.details,
    reporterContact: row.reporter_contact,
    status: row.status,
    createdAt: row.created_at,
    listingName:
      (row.boarding_house_listings as { name?: string } | null)?.name ?? "Listing",
  }));

  return (
    <div className="space-y-6">
      <AdminBreadcrumbs />
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Boarding Houses</h1>
          <p className="text-muted-foreground">
            Review owner applications, listing publication, and student reports.
          </p>
        </div>
        <Badge className="w-fit gap-1 rounded-full bg-emerald-600 text-white hover:bg-emerald-600">
          <ShieldCheck className="h-3.5 w-3.5" />
          Verification means identity and authority only
        </Badge>
      </header>

      {setupErrors.length > 0 && (
        <Card className="border-amber-200 bg-amber-50 text-amber-950 shadow-sm">
          <CardContent className="flex gap-3 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="space-y-1 text-sm">
              <p className="font-semibold">Boarding house database setup is incomplete.</p>
              <p>
                Apply the Supabase boarding-house migration before reviewing owner
                applications, listing moderation, or student reports. The queues below
                may show as empty until the tables exist.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <section className="grid gap-4 lg:grid-cols-3">
        <Metric title="Listings" value={listings.length} />
        <Metric title="Pending owners" value={applications.length} />
        <Metric title="Open reports" value={reports.length} />
      </section>

      <BoardingHousesAdminTabs
        applications={applications}
        listings={listings}
        reports={reports}
      />
    </div>
  );
}

function Metric({ title, value }: { title: string; value: number }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="flex items-center gap-3 p-5">
        <div className="rounded-2xl bg-primary/10 p-3 text-primary">
          <Home className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
