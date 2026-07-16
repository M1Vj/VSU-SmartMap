import { formatDistanceToNow } from "date-fns";
import { ShieldCheck, Star } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { BoardingHouseReview } from "@/lib/boarding-houses/types";

type ReviewListProps = {
  reviews: readonly BoardingHouseReview[];
};

function StarRating({ rating }: { rating: number }) {
  const clamped = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <div
      className="flex items-center gap-0.5"
      role="img"
      aria-label={`${clamped} out of 5 stars`}
    >
      {Array.from({ length: 5 }).map((_, starIndex) => (
        <Star
          key={starIndex}
          className={
            starIndex < clamped
              ? "h-4 w-4 fill-amber-400 text-amber-400"
              : "h-4 w-4 text-muted-foreground/40"
          }
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

function relativeDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  try {
    return formatDistanceToNow(parsed, { addSuffix: true });
  } catch {
    return "";
  }
}

export function ReviewList({ reviews }: ReviewListProps) {
  if (reviews.length === 0) {
    return (
      <p className="rounded-xl border border-dashed bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
        No reviews yet — be the first.
      </p>
    );
  }

  return (
    <ul className="space-y-4">
      {reviews.map((review) => {
        const when = relativeDate(review.createdAt);
        return (
          <li
            key={review.id}
            className="rounded-2xl border bg-card p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <StarRating rating={review.rating} />
                <span className="text-sm font-semibold text-foreground">
                  {review.authorDisplayName}
                </span>
                {review.isVerifiedStay && (
                  <Badge className="gap-1 rounded-full bg-emerald-600 text-white hover:bg-emerald-600">
                    <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                    Verified stay
                  </Badge>
                )}
              </div>
              {when && (
                <time
                  dateTime={review.createdAt}
                  className="text-xs text-muted-foreground"
                >
                  {when}
                </time>
              )}
            </div>
            {review.body && (
              <p className="mt-2 whitespace-pre-line text-sm leading-6 text-muted-foreground">
                {review.body}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
