"use client";

import { useEffect, useState } from "react";
import { getFacilitiesLite } from "@/lib/supabase/queries/facilities";
import { DirectoryContainer } from "@/components/directory";
import { CategoryFilters } from "@/components/map/category-filters";
import { getCachedFacilities, setCachedFacilities } from "@/lib/cache/facilities-cache";
import { useApp } from "@/lib/context/app-context";
import type { Facility } from "@/lib/types";

function DirectorySkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-48 rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  );
}

export default function DirectoryPage() {
  const { selectedCategories, setCategories, toggleCategory } = useApp();
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);

      const fetchFacilities = async () => {
        const { data, error: fetchError } = await getFacilitiesLite();

        if (fetchError || !data) {
          const cached = await getCachedFacilities();
          if (cached && cached.length > 0) {
            setError(null);
          } else {
            setError("Failed to load facilities. Please try again later.");
            setFacilities([]);
          }
          setIsLoading(false);
          return;
        }

        setCachedFacilities(data as unknown as Facility[]);
        setFacilities(data as unknown as Facility[]);
        setError(null);
        setIsLoading(false);
      };

      const cached = await getCachedFacilities();
      if (cached && cached.length > 0) {
        setFacilities(cached);
      }

      void fetchFacilities();
    };

    void load();
  }, []);

  if (error && facilities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-lg text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-y-auto bg-background">
      <div className="container mx-auto px-4 py-6 pb-24 md:pb-6">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground md:text-3xl">
              Campus Directory
            </h1>
            <p className="mt-1 text-muted-foreground">
              Browse all buildings and points of interest
            </p>
          </div>
          <div className="shrink-0 sm:pt-1">
            <CategoryFilters
              value={selectedCategories}
              onChange={setCategories}
              onToggle={toggleCategory}
              title="Directory filters"
              ariaLabelPrefix="Filter directory categories"
              triggerClassName="shadow-none ring-0 backdrop-blur-none"
              contentClassName="shadow-none"
            />
          </div>
        </header>

        {isLoading && facilities.length === 0 ? (
          <DirectorySkeleton />
        ) : (
          <DirectoryContainer facilities={facilities} />
        )}
      </div>
    </div>
  );
}
