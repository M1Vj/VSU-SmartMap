"use client";

import { useState, type ReactNode } from "react";
import {
  CalendarClock,
  Clock,
  Coins,
  Eye,
  MapPin,
  Star,
  Users,
  Wallet,
} from "lucide-react";

import {
  publishBoardingHouseListing,
  rejectBoardingHouseListing,
  suspendBoardingHouseListing,
  unpublishBoardingHouseListing,
} from "@/app/admin/boarding-houses/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { LocationPreviewDialog } from "@/components/admin/location-preview-dialog";
import { PhotoGallery } from "@/components/boarding-houses/photo-gallery";
import { occupancyPolicyLabel, roomTypeLabel } from "@/lib/boarding-houses/labels";
import {
  BOARDING_HOUSE_MOBILE_CARRIER_LABELS,
  BOARDING_HOUSE_SAFETY_FEATURE_LABELS,
  type BoardingHouseMobileCarrier,
  type BoardingHouseSafetyFeature,
} from "@/lib/boarding-houses/types";
import { ListingStatusBadge, VerificationBadge } from "./status-badge";
import type { AdminListing } from "./types";

const PESO = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

function formatPriceRange(listing: AdminListing): string {
  const { priceMin, priceMax } = listing;
  if (priceMin === null && priceMax === null) return "Price not listed";
  if (priceMin !== null && priceMax !== null) {
    return priceMin === priceMax
      ? `${PESO.format(priceMin)} / month`
      : `${PESO.format(priceMin)}–${PESO.format(priceMax)} / month`;
  }
  if (priceMin !== null) return `From ${PESO.format(priceMin)} / month`;
  return `Up to ${PESO.format(priceMax ?? 0)} / month`;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function ListingDetailDialog({
  listing,
  label = "View details",
}: {
  listing: AdminListing;
  label?: string;
}) {
  const amenities = [
    listing.amenities.wifi && "Wi-Fi",
    listing.amenities.cookingAllowed && "Cooking allowed",
    listing.amenities.waterIncluded && "Water included",
    listing.amenities.electricityIncluded && "Electricity included",
    listing.amenities.furnished && "Furnished",
    listing.amenities.airConditioning && "Air conditioning",
    listing.amenities.laundryArea && "Laundry area",
    listing.amenities.dryingArea && "Drying area",
    listing.amenities.parking && "Parking",
    listing.amenities.studyArea && "Study area",
  ].filter((entry): entry is string => Boolean(entry));

  const rules = [
    listing.rules.hasCurfew
      ? listing.rules.curfewTime
        ? `Curfew at ${listing.rules.curfewTime}`
        : "Has curfew"
      : "No curfew",
    listing.rules.allowsVisitors ? "Visitors allowed" : "No visitors",
    listing.rules.allowsPets ? "Pets allowed" : "No pets",
    listing.rules.smokingAllowed ? "Smoking allowed" : "No smoking",
  ];

  const safetyFeatures = listing.safetyFeatures.map(
    (value) =>
      BOARDING_HOUSE_SAFETY_FEATURE_LABELS[value as BoardingHouseSafetyFeature] ??
      value,
  );

  const mobileCarriers = listing.mobileCarriers.map(
    (value) =>
      BOARDING_HOUSE_MOBILE_CARRIER_LABELS[value as BoardingHouseMobileCarrier] ??
      value,
  );

  const [mapOpen, setMapOpen] = useState(false);
  const ratingSummary =
    listing.ratingCount === 0
      ? "No reviews yet"
      : `${listing.avgRating.toFixed(1)} · ${listing.ratingCount} ${
          listing.ratingCount === 1 ? "review" : "reviews"
        }`;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="rounded-full">
          <Eye className="mr-1.5 h-4 w-4" aria-hidden="true" />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl gap-0 overflow-hidden p-0">
        <div className="max-h-[85vh] overflow-y-auto">
          <PhotoGallery photos={listing.photos} />

          <div className="space-y-5 p-6">
            <DialogHeader className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <ListingStatusBadge status={listing.status} />
                <VerificationBadge status={listing.verificationStatus} />
              </div>
              <DialogTitle className="text-2xl">{listing.name}</DialogTitle>
              <DialogDescription>{listing.addressLine}</DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 sm:grid-cols-2">
              <Fact icon={Wallet} label="Price">
                {formatPriceRange(listing)}
              </Fact>
              <Fact icon={Users} label="Available slots">
                {listing.availableSlots ?? 0}
              </Fact>
              <Fact icon={Clock} label="Walk to campus gate">
                {listing.walkingMinutesToCampusGate === null
                  ? "Not set"
                  : `${listing.walkingMinutesToCampusGate} min`}
              </Fact>
              <Fact icon={Star} label="Rating">
                {ratingSummary}
              </Fact>
              <Fact icon={Coins} label="Appliance fee">
                {listing.applianceFee === null
                  ? "None"
                  : `${PESO.format(listing.applianceFee)} / appliance`}
              </Fact>
            </div>

            <Section title="Description">
              <p className="whitespace-pre-line text-sm leading-7 text-muted-foreground">
                {listing.description || "No description has been added yet."}
              </p>
            </Section>

            <div className="grid gap-5 sm:grid-cols-2">
              <Section title="Room types">
                <ChipList
                  items={listing.roomTypes.map(roomTypeLabel)}
                  empty="Not specified"
                />
              </Section>
              <Section title="Occupancy">
                <ChipList
                  items={listing.occupancyPolicies.map(occupancyPolicyLabel)}
                  empty="Not specified"
                />
              </Section>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Section title="Amenities">
                <BulletList items={amenities} empty="None listed" />
              </Section>
              <Section title="House rules">
                <BulletList items={rules} empty="Not specified" />
              </Section>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Section title="Safety features">
                <ChipList items={safetyFeatures} empty="None listed" />
              </Section>
              <Section title="Mobile signal">
                <ChipList items={mobileCarriers} empty="Not specified" />
              </Section>
            </div>

            <Section title="Owner & contact">
              <dl className="grid gap-1.5 text-sm">
                <Row label="Owner">{listing.ownerDisplayName || "—"}</Row>
                <Row label="Phone">{listing.contactPhone || "—"}</Row>
                <Row label="Email">{listing.contactEmail || "—"}</Row>
                <Row label="Facebook">{listing.contactFacebook || "—"}</Row>
              </dl>
            </Section>

            <Section title="Location">
              <div className="space-y-2 text-sm">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => setMapOpen(true)}
                >
                  <MapPin className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  View on SmartMap
                </Button>
              </div>
            </Section>

            <Section title="Timeline">
              <dl className="grid gap-1.5 text-sm">
                <Row label="Created">{formatDate(listing.createdAt)}</Row>
                <Row label="Last updated">{formatDate(listing.updatedAt)}</Row>
                <Row label="Submitted">{formatDate(listing.submittedAt)}</Row>
                <Row label="Published">{formatDate(listing.publishedAt)}</Row>
              </dl>
            </Section>

            {listing.moderationNote && (
              <div className="flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
                <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-semibold">Last moderation note</p>
                  <p className="mt-0.5">{listing.moderationNote}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="border-t bg-card p-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Moderation actions
          </p>
          <ListingModerationActions listing={listing} />
        </div>

        <LocationPreviewDialog
          open={mapOpen}
          onOpenChange={setMapOpen}
          coordinates={{ lat: listing.latitude, lng: listing.longitude }}
          title={listing.name}
        />
      </DialogContent>
    </Dialog>
  );
}

export function ListingModerationActions({ listing }: { listing: AdminListing }) {
  const { id, status } = listing;

  if (status === "pending_review") {
    return (
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <form action={publishBoardingHouseListing}>
          <input type="hidden" name="id" value={id} />
          <Button size="sm" className="w-full rounded-full sm:w-auto">
            Publish
          </Button>
        </form>
        <form action={rejectBoardingHouseListing} className="flex flex-1 gap-2">
          <input type="hidden" name="id" value={id} />
          <Input name="note" placeholder="Reason for rejection" className="h-9" />
          <Button size="sm" variant="outline" className="rounded-full">
            Reject
          </Button>
        </form>
      </div>
    );
  }

  if (status === "published") {
    return (
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <form action={unpublishBoardingHouseListing}>
          <input type="hidden" name="id" value={id} />
          <Button size="sm" variant="outline" className="w-full rounded-full sm:w-auto">
            Unpublish
          </Button>
        </form>
        <form action={suspendBoardingHouseListing} className="flex flex-1 gap-2">
          <input type="hidden" name="id" value={id} />
          <Input name="note" placeholder="Reason for suspension" className="h-9" />
          <Button size="sm" variant="destructive" className="rounded-full">
            Suspend
          </Button>
        </form>
      </div>
    );
  }

  if (status === "unpublished" || status === "suspended" || status === "draft") {
    return (
      <form action={publishBoardingHouseListing}>
        <input type="hidden" name="id" value={id} />
        <Button size="sm" className="rounded-full">
          Publish
        </Button>
      </form>
    );
  }

  if (status === "rejected") {
    // moderate_boarding_house_listing's publish guard excludes 'rejected', so
    // Publish would raise a DB exception here. Unpublish has no state guard
    // and moves the listing into 'unpublished', which IS in the publish
    // allow-list — this is the only unblocked path back to reconsideration.
    return (
      <div className="flex flex-col gap-1.5">
        <form action={unpublishBoardingHouseListing}>
          <input type="hidden" name="id" value={id} />
          <Button size="sm" variant="outline" className="rounded-full">
            Reconsider (move to unpublished)
          </Button>
        </form>
        <p className="text-xs text-muted-foreground">
          Moves this listing to Unpublished so it can be reviewed and published again.
        </p>
      </div>
    );
  }

  return (
    <p className="text-sm text-muted-foreground">
      No moderation actions available for this status.
    </p>
  );
}

function Fact({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Wallet;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border p-3">
      <div className="rounded-xl bg-primary/10 p-2 text-primary">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold">{children}</p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function ChipList({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <Badge key={item} variant="secondary" className="rounded-full">
          {item}
        </Badge>
      ))}
    </div>
  );
}

function BulletList({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <ul className="space-y-1.5 text-sm text-muted-foreground">
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
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}
