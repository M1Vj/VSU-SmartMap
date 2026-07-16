import Link from "next/link";
import {
  AlertTriangle,
  ExternalLink,
  Footprints,
  Home,
  Pencil,
  Plus,
  Send,
} from "lucide-react";

import { requireOwnerSession } from "@/lib/auth/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server-client";
import { submitListingForReview } from "@/app/owner/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { OfferingSlotsQuickEdit } from "@/components/owner/offering-slots-quick-edit";
import { HelpGuideButton } from "@/components/help/help-guide-dialog";
import { formatSlotsListedLabel } from "@/lib/boarding-houses/labels";
import { cn } from "@/lib/utils";

type ListingStatus =
  | "draft"
  | "pending_review"
  | "published"
  | "rejected"
  | "unpublished"
  | "suspended";

type OwnerListing = {
  id: string;
  slug: string;
  name: string;
  status: ListingStatus;
  verification_status: string;
  available_slots: number | null;
  price_min: number | null;
  price_max: number | null;
  walking_minutes_to_campus_gate: number | null;
  moderation_note: string | null;
  updated_at: string;
  boarding_house_offerings: Array<{
    id: string;
    label: string;
    available_slots: number;
  }>;
};

const STATUS_BADGES: Record<
  ListingStatus,
  { label: string; className: string }
> = {
  draft: {
    label: "Draft",
    className: "bg-secondary text-secondary-foreground",
  },
  pending_review: {
    label: "In review",
    className: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  },
  published: {
    label: "Published",
    className:
      "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  },
  rejected: {
    label: "Rejected",
    className: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
  },
  unpublished: {
    label: "Unpublished",
    className: "bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100",
  },
  suspended: {
    label: "Suspended",
    className: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
  },
};

const REASON_CALLOUTS: Record<
  "rejected" | "suspended" | "unpublished",
  { title: string; className: string }
> = {
  rejected: {
    title: "Rejected by admin",
    className:
      "border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100",
  },
  suspended: {
    title: "Suspended by admin",
    className:
      "border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100",
  },
  unpublished: {
    title: "Unpublished by admin",
    className:
      "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100",
  },
};

function StatusBadge({ status }: { status: ListingStatus }) {
  const badge = STATUS_BADGES[status] ?? {
    label: status,
    className: "bg-secondary text-secondary-foreground",
  };
  return (
    <Badge className={cn("rounded-full border-transparent", badge.className)}>
      {badge.label}
    </Badge>
  );
}

function ReasonCallout({
  status,
  note,
}: {
  status: "rejected" | "suspended" | "unpublished";
  note: string | null;
}) {
  const callout = REASON_CALLOUTS[status];
  return (
    <div
      role="alert"
      className={cn("rounded-xl border p-4 text-sm", callout.className)}
    >
      <p className="flex items-center gap-2 font-bold">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
        {callout.title}
      </p>
      <p className="mt-1.5 leading-relaxed">
        {note?.trim() ? note : "Contact the administrators for details."}
      </p>
    </div>
  );
}

function ListingCard({
  listing,
  featured,
}: {
  listing: OwnerListing;
  featured?: boolean;
}) {
  const canSubmit =
    listing.status === "draft" ||
    listing.status === "rejected" ||
    listing.status === "unpublished";
  const showReason =
    listing.status === "rejected" ||
    listing.status === "suspended" ||
    listing.status === "unpublished";

  return (
    <Card className={cn("shadow-sm", featured && "border-primary/30")}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle className={cn(featured ? "text-xl" : "text-base")}>
            {listing.name}
          </CardTitle>
          <span data-tour="owner-status">
            <StatusBadge status={listing.status} />
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        {showReason ? (
          <ReasonCallout
            status={listing.status as "rejected" | "suspended" | "unpublished"}
            note={listing.moderation_note}
          />
        ) : null}
        <p className="text-base font-semibold text-foreground">
          ₱{listing.price_min?.toLocaleString("en-PH") ?? "—"}–₱
          {listing.price_max?.toLocaleString("en-PH") ?? "—"}{" "}
          <span className="text-sm font-normal text-muted-foreground">
            / month
          </span>
        </p>
        <p>{formatSlotsListedLabel(listing.available_slots)}</p>
        <OfferingSlotsQuickEdit
          listingId={listing.id}
          offerings={listing.boarding_house_offerings.map((offering) => ({
            id: offering.id,
            label: offering.label,
            availableSlots: offering.available_slots,
          }))}
        />
        <p>Verification: {listing.verification_status}</p>
        {listing.walking_minutes_to_campus_gate != null ? (
          <p className="flex items-center gap-1.5">
            <Footprints className="h-4 w-4 shrink-0" aria-hidden="true" />
            {listing.walking_minutes_to_campus_gate} min walk to campus gate
          </p>
        ) : null}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        <Button asChild size="sm" className="rounded-full">
          <Link href={`/owner/listings/${listing.id}/edit`}>
            <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
            Edit listing
          </Link>
        </Button>
        {canSubmit ? (
          <form
            action={async () => {
              "use server";
              await submitListingForReview(listing.id);
            }}
          >
            <Button
              type="submit"
              size="sm"
              variant="secondary"
              className="rounded-full"
            >
              <Send className="mr-2 h-4 w-4" aria-hidden="true" />
              Submit for review
            </Button>
          </form>
        ) : null}
        {listing.status === "published" ? (
          <Button
            asChild
            size="sm"
            variant="outline"
            className="rounded-full"
          >
            <Link href={`/boarding-houses/${listing.slug}`}>
              <ExternalLink className="mr-2 h-4 w-4" aria-hidden="true" />
              View public page
            </Link>
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  );
}

export default async function OwnerDashboardPage() {
  const session = await requireOwnerSession();
  const serviceClient = getSupabaseServiceRoleClient();
  const { data: ownerProfile } = await serviceClient
    .from("owner_profiles")
    .select("id, display_name, verification_status")
    .eq("user_id", session.user.id)
    .maybeSingle();

  const { data: listings } = ownerProfile
    ? await serviceClient
        .from("boarding_house_listings")
        .select(
          "id, slug, name, status, verification_status, available_slots, price_min, price_max, walking_minutes_to_campus_gate, moderation_note, updated_at, boarding_house_offerings(id, label, available_slots)",
        )
        .eq("owner_id", ownerProfile.id)
        .order("updated_at", { ascending: false })
    : { data: [] };

  const ownerListings = (listings ?? []) as OwnerListing[];
  const isEmpty = ownerListings.length === 0;
  const isSingle = ownerListings.length === 1;

  return (
    <main className="min-h-[100dvh] bg-muted/30 px-4 py-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-col gap-4 rounded-3xl border bg-card p-5 shadow-sm md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-primary">Owner portal</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">
              {ownerProfile?.display_name ?? "Boarding house owner"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Keep rent, slots, rules, and contacts accurate for students.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <HelpGuideButton
              variant="outline"
              size="sm"
              className="rounded-full"
            />
            <Button asChild variant="secondary" className="rounded-full">
              <Link href="/owner/listings/new">
                <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                New listing
              </Link>
            </Button>
          </div>
        </header>

        {isEmpty ? (
          <Card className="border-dashed shadow-sm">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Home className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
              <h2 className="mt-4 text-lg font-semibold">No listings yet</h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Create a draft listing with prices, slots, rules, and contact
                links. Admins review structural changes before publication.
              </p>
              <Button asChild className="mt-4 rounded-full">
                <Link href="/owner/listings/new">Create first listing</Link>
              </Button>
            </CardContent>
          </Card>
        ) : isSingle ? (
          <section>
            <ListingCard listing={ownerListings[0]} featured />
          </section>
        ) : (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {ownerListings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
