import { Skeleton } from "@/components/ui/skeleton";

function FiltersBarSkeleton() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-10 w-32" />
      <div className="ml-auto">
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="rounded-lg border bg-card">
      <div className="border-b p-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16 ml-auto" />
        </div>
      </div>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="border-b p-4 last:border-b-0">
          <div className="flex items-center gap-4">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-10 w-10 rounded" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-8 w-8" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function FacilitiesLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-64" />
      </div>

      <FiltersBarSkeleton />
      <TableSkeleton />
    </div>
  );
}
