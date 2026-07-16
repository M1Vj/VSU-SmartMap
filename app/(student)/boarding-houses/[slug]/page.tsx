import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Home,
  Mail,
  MapPinned,
  Phone,
  ShieldCheck,
  Star,
  Wallet,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PhotoGallery } from "@/components/boarding-houses/photo-gallery";
import { ReviewList } from "@/components/boarding-houses/review-list";
import { ReportForm, ReviewForm } from "@/components/boarding-houses/review-form";
import { DetailWalkFact } from "@/components/boarding-houses/detail-walk-fact";
import { RoomOptionCard } from "@/components/boarding-houses/room-option-card";
import { formatBoardingHousePriceRange } from "@/lib/boarding-houses/filters";
import { formatAvailabilityLabel } from "@/lib/boarding-houses/labels";
import {
  BOARDING_HOUSE_MOBILE_CARRIER_LABELS,
  BOARDING_HOUSE_SAFETY_FEATURE_LABELS,
} from "@/lib/boarding-houses/types";
import type {
  BoardingHouseDetail,
  BoardingHouseOffering,
} from "@/lib/boarding-houses/types";
import { isSuspiciouslyCheap } from "@/lib/boarding-houses/price-anomaly";
import { signStoragePaths } from "@/lib/boarding-houses/photo-urls";
import { getBoardingHousesForChatCached } from "@/lib/supabase/queries/boarding-houses.server";
import {
  getApprovedBoardingHouseReviews,
  getBoardingHouseBySlug,
} from "@/lib/supabase/queries/boarding-houses";
import { getAuthorizedSession } from "@/lib/auth/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server-client";
import { cn } from "@/lib/utils";

type BoardingHouseDetailPageProps = {
  params: Promise<{ slug: string }>;
};

const HTTP_SCHEME = /^https?:\/\//i;

async function loadListing(slug: string): Promise<BoardingHouseDetail> {
  const serviceClient = getSupabaseServiceRoleClient();
  const { data: listing, error } = await getBoardingHouseBySlug(slug, serviceClient);

  if (error) {
    throw new Error(`Failed to load boarding house: ${error.message}`);
  }

  if (!listing) {
    notFound();
  }

  return listing;
}

export async function generateMetadata({
  params,
}: BoardingHouseDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const { data: listing } = await getBoardingHouseBySlug(
    slug,
    getSupabaseServiceRoleClient(),
  );

  if (!listing) {
    return { title: "Boarding house not found" };
  }

  const price = formatBoardingHousePriceRange(listing);
  const blurb = listing.description
    ? listing.description.replace(/\s+/g, " ").trim().slice(0, 140)
    : `${price} near VSU.`;

  return {
    title: listing.name,
    description: `${listing.addressLine}. ${blurb}`,
  };
}

async function signGalleryPhotos(listing: BoardingHouseDetail) {
  const byBucket = new Map<string, { path: string; alt: string }[]>();
  for (const photo of listing.photos) {
    if (!photo.storagePath) continue;
    const bucket = photo.storageBucket || "boarding-house-photos";
    const entries = byBucket.get(bucket) ?? [];
    entries.push({ path: photo.storagePath, alt: photo.alt });
    byBucket.set(bucket, entries);
  }

  const signed: { url: string; alt: string }[] = [];
  for (const [bucket, entries] of byBucket) {
    const urls = await signStoragePaths(
      bucket,
      entries.map((entry) => entry.path),
    );
    urls.forEach((url, index) => {
      if (url) {
        signed.push({ url, alt: entries[index].alt });
      }
    });
  }

  return signed;
}

async function signOfferingImages(
  offerings: readonly BoardingHouseOffering[],
): Promise<BoardingHouseOffering[]> {
  const paths = offerings
    .map((offering) => offering.imagePath)
    .filter((path): path is string => Boolean(path));
  if (paths.length === 0) return offerings.map((offering) => ({ ...offering }));

  const urls = await signStoragePaths("boarding-house-photos", paths);
  const urlByPath = new Map<string, string>();
  paths.forEach((path, index) => {
    const url = urls[index];
    if (url) urlByPath.set(path, url);
  });

  return offerings.map((offering) => ({
    ...offering,
    imageUrl: offering.imagePath ? urlByPath.get(offering.imagePath) ?? null : null,
  }));
}

export default async function BoardingHouseDetailPage({
  params,
}: BoardingHouseDetailPageProps) {
  const { slug } = await params;
  const listing = await loadListing(slug);

  const [galleryPhotos, offerings, reviewsResult, session, peerListings] =
    await Promise.all([
      signGalleryPhotos(listing),
      signOfferingImages(listing.offerings),
      getApprovedBoardingHouseReviews(listing.id, getSupabaseServiceRoleClient()),
      getAuthorizedSession(),
      getBoardingHousesForChatCached(),
    ]);

  const priceLooksTooCheap = isSuspiciouslyCheap(
    listing.priceMin,
    (peerListings.data ?? [])
      .filter((peer) => peer.id !== listing.id)
      .map((peer) => peer.priceMin),
  );

  const reviews = reviewsResult.data ?? [];
  const mapHref = `/?boarding=1&boardingHouse=${encodeURIComponent(listing.id)}`;
  const isVerified = listing.verificationStatus === "verified";
  const showRoomOptions = shouldShowRoomOptions(offerings);

  const ratingSummary =
    listing.reviewCount === 0
      ? "New"
      : `${listing.averageRating.toFixed(1)} · ${listing.reviewCount} ${
          listing.reviewCount === 1 ? "review" : "reviews"
        }`;

  const facebookHref =
    listing.contactFacebook && HTTP_SCHEME.test(listing.contactFacebook)
      ? listing.contactFacebook
      : null;

  const moveInTerms = formatMoveInTerms(
    listing.advanceMonths ?? null,
    listing.depositMonths ?? null,
  );

  const connectivity = amenitySection([
    listing.amenities.wifi && "Wi-Fi",
    listing.mobileCarriers.length > 0 &&
      `Signal: ${listing.mobileCarriers
        .map((carrier) => BOARDING_HOUSE_MOBILE_CARRIER_LABELS[carrier])
        .join(", ")}`,
  ]);
  const kitchen = amenitySection([
    listing.amenities.cookingAllowed && "Cooking allowed",
  ]);
  const utilities = amenitySection([
    Boolean(listing.waterIncluded) && "Water included",
    Boolean(listing.electricityIncluded) && "Electricity included",
    listing.applianceFee !== null &&
      `Appliance fee ${formatMonthlyPeso(listing.applianceFee)} / month per appliance`,
  ]);
  const comfort = amenitySection([
    listing.amenities.furnished && "Furnished",
    listing.amenities.airConditioning && "Air conditioning",
    Boolean(listing.privateBathroom) && "Private bathroom available",
    listing.amenities.laundryArea && "Laundry area",
    listing.amenities.dryingArea && "Drying area",
    listing.amenities.parking && "Parking",
    listing.amenities.studyArea && "Study area",
  ]);
  const rules = amenitySection([
    listing.rules.hasCurfew
      ? listing.rules.curfewTime
        ? `Curfew at ${listing.rules.curfewTime}`
        : "Has curfew"
      : "No curfew",
    listing.rules.allowsVisitors ? "Visitors allowed" : "No visitors",
    listing.rules.allowsPets ? "Pets allowed" : "No pets",
    listing.rules.smokingAllowed ? "Smoking allowed" : "No smoking",
  ]);
  const safety = listing.safetyFeatures.map(
    (feature) => BOARDING_HOUSE_SAFETY_FEATURE_LABELS[feature],
  );

  return (
    <div className="h-full w-full overflow-y-auto bg-background">
      <div className="container mx-auto max-w-6xl px-4 py-6 pb-28 md:px-6 md:pb-8">
        <Button asChild variant="ghost" className="mb-4 rounded-full">
          <Link href="/boarding-houses">
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
            Back to boarding houses
          </Link>
        </Button>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <main className="min-w-0 space-y-5">
            <section className="overflow-hidden rounded-3xl border bg-card shadow-sm">
              <PhotoGallery photos={galleryPhotos} />

              <div className="space-y-4 p-5 md:p-7">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    {isVerified && (
                      <div className="mb-2 flex flex-wrap gap-2">
                        <Badge className="gap-1 rounded-full bg-emerald-600 text-white hover:bg-emerald-600">
                          <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                          Verified
                        </Badge>
                      </div>
                    )}
                    <h1 className="text-2xl font-bold tracking-tight md:text-4xl">
                      {listing.name}
                    </h1>
                    <p className="mt-2 text-muted-foreground">{listing.addressLine}</p>
                    <p
                      className="mt-2 flex items-center gap-1.5 text-sm font-medium text-foreground"
                      aria-label={
                        listing.reviewCount === 0
                          ? "No reviews yet"
                          : `Average rating ${listing.averageRating.toFixed(1)} from ${listing.reviewCount} reviews`
                      }
                    >
                      <Star
                        className="h-4 w-4 fill-amber-400 text-amber-400"
                        aria-hidden="true"
                      />
                      {ratingSummary}
                    </p>
                  </div>
                  <p className="text-lg font-semibold text-primary">
                    {formatBoardingHousePriceRange(listing)}
                  </p>
                </div>

                <p className="whitespace-pre-line text-sm leading-7 text-muted-foreground md:text-base">
                  {listing.description || "No description has been added yet."}
                </p>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              <AmenityCard title="Connectivity" items={connectivity} />
              <AmenityCard title="Utilities" items={utilities} />
              <AmenityCard title="Kitchen" items={kitchen} />
              <AmenityCard title="Comfort" items={comfort} />
              <AmenityCard title="Rules" items={rules} />
              <AmenityCard title="Safety" items={safety} />
            </section>

            {showRoomOptions && (
              <section className="space-y-4">
                <h2 className="text-xl font-bold tracking-tight">Room options</h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {offerings.map((offering) => (
                    <RoomOptionCard key={offering.id} offering={offering} />
                  ))}
                </div>
              </section>
            )}

            <section className="space-y-4">
              <h2 className="text-xl font-bold tracking-tight">Reviews</h2>
              <ReviewList reviews={reviews} />
              <ReviewForm
                listingId={listing.id}
                slug={slug}
                isAuthenticated={Boolean(session)}
              />
            </section>
          </main>

          <aside className="space-y-4 lg:self-start">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Student essentials</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <DetailWalkFact
                  coordinates={listing.coordinates}
                  ownerMinutes={listing.walkingMinutesToCampusGate}
                />
                <Fact
                  icon={Home}
                  label={formatAvailabilityLabel(listing.availableSlots)}
                />
                {moveInTerms && <Fact icon={Wallet} label={moveInTerms} />}
                <Button asChild className="mt-2 w-full rounded-full">
                  <Link href={mapHref}>View on centralized map</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Contact</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {listing.contactPhone && (
                  <div className="flex gap-2">
                    <Contact
                      href={`tel:${listing.contactPhone}`}
                      icon={Phone}
                      className="min-w-0 flex-1"
                    >
                      {listing.contactPhone}
                    </Contact>
                    <Button
                      asChild
                      size="sm"
                      variant="secondary"
                      className="h-auto shrink-0 rounded-xl px-3 py-2"
                    >
                      <a href={`sms:${listing.contactPhone}`}>Text</a>
                    </Button>
                  </div>
                )}
                {listing.contactEmail && (
                  <Contact href={`mailto:${listing.contactEmail}`} icon={Mail}>
                    {listing.contactEmail}
                  </Contact>
                )}
                {facebookHref && (
                  <a
                    href={facebookHref}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="flex items-center gap-2 rounded-xl border px-3 py-2 transition hover:bg-muted/60"
                  >
                    <MapPinned className="h-4 w-4 text-primary" aria-hidden="true" />
                    <span>Facebook / Messenger</span>
                  </a>
                )}
                {!listing.contactPhone &&
                  !listing.contactEmail &&
                  !facebookHref && (
                    <p className="text-muted-foreground">
                      Contact details are not available yet.
                    </p>
                  )}

                <div className="mt-2 flex gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
                  <AlertTriangle
                    className="mt-0.5 h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                  <div className="space-y-1">
                    <p className="font-semibold">Stay safe from scams</p>
                    {priceLooksTooCheap && (
                      <p className="font-medium">
                        This rent is well below similar listings nearby — a
                        common scam lure. Be extra careful and always view the
                        place in person first.
                      </p>
                    )}
                    <p>
                      Never send GCash or reservation fees before viewing the
                      place in person. Ask for proof of ownership or a valid ID,
                      and report any suspicious listing below.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Report listing issue</CardTitle>
              </CardHeader>
              <CardContent>
                <ReportForm listingId={listing.id} />
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  );
}

function amenitySection(items: Array<string | false>): string[] {
  return items.filter((item): item is string => Boolean(item));
}

function AmenityCard({ title, items }: { title: string; items: string[] }) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        {items.length === 0 ? (
          <p>Not specified.</p>
        ) : (
          <ul className="space-y-1.5">
            {items.map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                  aria-hidden="true"
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function shouldShowRoomOptions(
  offerings: readonly BoardingHouseOffering[],
): boolean {
  if (offerings.length > 1) return true;
  if (offerings.length === 0) return false;
  return offerings[0].label.trim() !== "Primary room offering";
}

function formatMoveInTerms(
  advanceMonths: number | null,
  depositMonths: number | null,
): string | null {
  if (advanceMonths === null && depositMonths === null) return null;
  const parts: string[] = [];
  if (advanceMonths !== null) {
    parts.push(
      advanceMonths === 0 ? "no advance" : `${advanceMonths} mo advance`,
    );
  }
  if (depositMonths !== null) {
    parts.push(
      depositMonths === 0 ? "no deposit" : `${depositMonths} mo deposit`,
    );
  }
  return `Move-in: ${parts.join(" + ")}`;
}

function formatMonthlyPeso(value: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(value);
}

function Fact({
  icon: Icon,
  label,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-muted/70 px-3 py-2">
      <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

function Contact({
  href,
  icon: Icon,
  children,
  className,
}: {
  href: string;
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      className={cn(
        "flex items-center gap-2 rounded-xl border px-3 py-2 transition hover:bg-muted/60",
        className,
      )}
    >
      <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
      <span className="truncate">{children}</span>
    </a>
  );
}
