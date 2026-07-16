import { Badge } from "@/components/ui/badge";

const LISTING_STATUS_BADGES: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-slate-100 text-slate-700 hover:bg-slate-100" },
  pending_review: { label: "Pending review", className: "bg-amber-100 text-amber-800 hover:bg-amber-100" },
  published: { label: "Published", className: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-800 hover:bg-red-100" },
  unpublished: { label: "Unpublished", className: "bg-slate-200 text-slate-700 hover:bg-slate-200" },
  suspended: { label: "Suspended", className: "bg-red-100 text-red-800 hover:bg-red-100" },
};

const VERIFICATION_BADGES: Record<string, { label: string; className: string }> = {
  unverified: { label: "Unverified", className: "bg-slate-100 text-slate-600 hover:bg-slate-100" },
  pending: { label: "Verification pending", className: "bg-amber-100 text-amber-800 hover:bg-amber-100" },
  verified: { label: "Verified", className: "bg-emerald-600 text-white hover:bg-emerald-600" },
  rejected: { label: "Verification rejected", className: "bg-red-100 text-red-800 hover:bg-red-100" },
  expired: { label: "Verification expired", className: "bg-orange-100 text-orange-800 hover:bg-orange-100" },
};

export function ListingStatusBadge({ status }: { status: string }) {
  const config = LISTING_STATUS_BADGES[status] ?? {
    label: status,
    className: "bg-slate-100 text-slate-700 hover:bg-slate-100",
  };
  return (
    <Badge className={`shrink-0 rounded-full border-transparent ${config.className}`}>
      {config.label}
    </Badge>
  );
}

export function VerificationBadge({ status }: { status: string }) {
  const config = VERIFICATION_BADGES[status] ?? {
    label: status,
    className: "bg-slate-100 text-slate-600 hover:bg-slate-100",
  };
  return (
    <Badge className={`shrink-0 rounded-full border-transparent ${config.className}`}>
      {config.label}
    </Badge>
  );
}
