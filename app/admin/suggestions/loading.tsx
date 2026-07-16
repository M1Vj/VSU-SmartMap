import { Skeleton } from "@/components/ui/skeleton";

function SuggestionCardSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Skeleton className="h-10 w-10 rounded" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
    </div>
  );
}

export default function SuggestionsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>

      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SuggestionCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
