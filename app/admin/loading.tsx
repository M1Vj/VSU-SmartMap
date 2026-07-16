import { Skeleton } from "@/components/ui/skeleton";

function StatsCardsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-lg border bg-card p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-16" />
            </div>
            <Skeleton className="h-10 w-10 rounded-full" />
          </div>
          <Skeleton className="mt-4 h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

function RecentActivitySkeleton() {
  return (
    <div className="rounded-lg border bg-card p-6">
      <Skeleton className="mb-4 h-6 w-32" />
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuickActionsSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-6">
      <Skeleton className="mb-4 h-6 w-28" />
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

export default function AdminDashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>

      <StatsCardsSkeleton />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <RecentActivitySkeleton />
        </div>
        <QuickActionsSkeleton />
      </div>
    </div>
  );
}
