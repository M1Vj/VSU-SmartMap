"use client";

import { AlertTriangle, FileText } from "lucide-react";

import {
  approveOwnerApplication,
  rejectOwnerApplication,
  updateBoardingHouseReport,
} from "@/app/admin/boarding-houses/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ListingDetailDialog } from "./listing-detail-dialog";
import { ListingStatusBadge } from "./status-badge";
import type {
  AdminApplication,
  AdminListing,
  AdminReport,
  AdminVerificationDocument,
} from "./types";

const PESO = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

function priceLabel(listing: AdminListing): string {
  const min = listing.priceMin === null ? null : PESO.format(listing.priceMin);
  const max = listing.priceMax === null ? null : PESO.format(listing.priceMax);
  if (min && max) return min === max ? min : `${min}–${max}`;
  if (min) return `From ${min}`;
  if (max) return `Up to ${max}`;
  return "Price not listed";
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type Props = {
  applications: AdminApplication[];
  listings: AdminListing[];
  reports: AdminReport[];
};

export function BoardingHousesAdminTabs({ applications, listings, reports }: Props) {
  return (
    <Tabs
      defaultValue="listings"
      className="w-full rounded-3xl border bg-muted/40 p-3 shadow-sm sm:p-4"
    >
      <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-2xl bg-muted p-1.5">
        <TabsTrigger value="listings" className="gap-2 rounded-xl">
          Listing moderation
          <CountBadge value={listings.length} />
        </TabsTrigger>
        <TabsTrigger value="applications" className="gap-2 rounded-xl" data-tour="admin-bh-tab-applications">
          Owner applications
          <CountBadge value={applications.length} />
        </TabsTrigger>
        <TabsTrigger value="reports" className="gap-2 rounded-xl" data-tour="admin-bh-tab-reports">
          Student report queue
          <CountBadge value={reports.length} />
        </TabsTrigger>
      </TabsList>

      <TabsContent value="listings" className="mt-3">
        <ListingModerationPanel listings={listings} />
      </TabsContent>
      <TabsContent value="applications" className="mt-3">
        <OwnerApplicationsPanel applications={applications} />
      </TabsContent>
      <TabsContent value="reports" className="mt-3">
        <ReportQueuePanel reports={reports} listings={listings} />
      </TabsContent>
    </Tabs>
  );
}

function ListingModerationPanel({ listings }: { listings: AdminListing[] }) {
  if (listings.length === 0) {
    return <EmptyState text="No boarding house listings yet." />;
  }
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {listings.map((listing, index) => (
        <div
          key={listing.id}
          data-tour={index === 0 ? "admin-bh-listing" : undefined}
          className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate font-semibold">{listing.name}</h2>
              <ListingStatusBadge status={listing.status} />
            </div>
            <p className="truncate text-sm text-muted-foreground">{listing.addressLine}</p>
            <p className="mt-1 text-sm">
              {priceLabel(listing)} · {listing.availableSlots ?? 0} slots · {listing.ownerDisplayName || "Unknown owner"}
            </p>
          </div>
          <div className="shrink-0">
            <ListingDetailDialog listing={listing} />
          </div>
        </div>
      ))}
    </div>
  );
}

function OwnerApplicationsPanel({ applications }: { applications: AdminApplication[] }) {
  if (applications.length === 0) {
    return <EmptyState text="No pending owner applications." />;
  }
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {applications.map((application) => (
        <div key={application.id} className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="font-semibold">{application.displayName}</h2>
              <p className="text-sm text-muted-foreground">
                {[application.email, application.phone].filter(Boolean).join(" · ") || "No contact provided"}
              </p>
              {application.authorityNotes && (
                <p className="mt-2 whitespace-pre-line text-sm">{application.authorityNotes}</p>
              )}
            </div>
            <form action={approveOwnerApplication} className="shrink-0">
              <input type="hidden" name="id" value={application.id} />
              <Button size="sm" className="rounded-full">Approve</Button>
            </form>
          </div>
          <VerificationDocumentsList documents={application.documents} />
          <form action={rejectOwnerApplication} className="mt-3 flex gap-2">
            <input type="hidden" name="id" value={application.id} />
            <Input name="reviewerNote" placeholder="Optional rejection note" className="h-9" />
            <Button size="sm" variant="outline" className="rounded-full">Reject</Button>
          </form>
        </div>
      ))}
    </div>
  );
}

function ReportQueuePanel({
  reports,
  listings,
}: {
  reports: AdminReport[];
  listings: AdminListing[];
}) {
  if (reports.length === 0) {
    return <EmptyState text="No open student reports." />;
  }
  const listingsById = new Map(listings.map((listing) => [listing.id, listing]));
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {reports.map((report) => {
        const reportedListing = listingsById.get(report.listingId);
        return (
          <div key={report.id} className="rounded-2xl border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-semibold">{report.reason}</h2>
                <p className="text-sm text-muted-foreground">{report.listingName}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant="secondary" className="rounded-full">{report.status}</Badge>
                {reportedListing ? (
                  <ListingDetailDialog listing={reportedListing} label="View listing" />
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    disabled
                    title="Listing is no longer in the moderation queue (may have been deleted)."
                  >
                    View listing
                  </Button>
                )}
              </div>
            </div>
            {report.details && <p className="mt-2 text-sm">{report.details}</p>}
            {report.reporterContact && (
              <p className="mt-1 text-xs text-muted-foreground">Contact: {report.reporterContact}</p>
            )}
            <form action={updateBoardingHouseReport} className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input type="hidden" name="id" value={report.id} />
              <Input name="reviewerNote" placeholder="Moderator note" className="h-9" />
              <Button size="sm" name="status" value="resolved" className="rounded-full">Resolve</Button>
              <Button size="sm" name="status" value="dismissed" variant="outline" className="rounded-full">
                Dismiss
              </Button>
            </form>
          </div>
        );
      })}
    </div>
  );
}

function VerificationDocumentsList({ documents }: { documents: AdminVerificationDocument[] }) {
  if (documents.length === 0) {
    return (
      <p className="mt-3 flex items-center gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        No documents uploaded
      </p>
    );
  }
  return (
    <ul className="mt-3 space-y-1.5">
      {documents.map((doc) => (
        <li
          key={doc.id}
          className="flex items-center justify-between gap-2 rounded-xl border bg-muted/40 px-3 py-2 text-xs"
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="truncate">{doc.filename}</span>
            <span className="shrink-0 text-muted-foreground">({formatFileSize(doc.sizeBytes)})</span>
          </span>
          {doc.url ? (
            <a
              href={doc.url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 font-semibold text-primary underline-offset-2 hover:underline"
            >
              Open
            </a>
          ) : (
            <span className="shrink-0 text-muted-foreground">Unavailable</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function CountBadge({ value }: { value: number }) {
  return (
    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/10 px-1.5 text-xs font-semibold text-primary">
      {value}
    </span>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
