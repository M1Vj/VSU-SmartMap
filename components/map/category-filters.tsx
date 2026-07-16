"use client";

import { FACILITY_CATEGORIES, type FacilityCategory } from "@/lib/types/facility";
import { FACILITY_CATEGORY_META } from "@/lib/constants/facilities";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ChevronDown, Home, ListFilter } from "lucide-react";

type CategoryFiltersProps = {
  value: FacilityCategory[];
  onChange: (value: FacilityCategory[]) => void;
  onToggle: (value: FacilityCategory) => void;
  triggerClassName?: string;
  contentClassName?: string;
  title?: string;
  ariaLabelPrefix?: string;
  showBoardingHouses?: boolean;
  onToggleBoardingHouses?: (next: boolean) => void;
  boardingHousesLoading?: boolean;
};

export function CategoryFilters({
  value,
  onChange,
  onToggle,
  triggerClassName,
  contentClassName,
  title = "Map filters",
  ariaLabelPrefix = "Filter map categories",
  showBoardingHouses,
  onToggleBoardingHouses,
  boardingHousesLoading,
}: CategoryFiltersProps) {
  const isAllSelected = value.length === FACILITY_CATEGORIES.length;
  const isNoneSelected = value.length === 0;
  const selectedLabel = isAllSelected
    ? "All categories"
    : isNoneSelected
      ? "No categories"
      : `${value.length} selected`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            "h-8 shrink-0 rounded-full bg-background/95 px-3 text-xs shadow-lg ring-1 ring-black/5 backdrop-blur",
            triggerClassName,
          )}
          aria-label={`${ariaLabelPrefix}: ${selectedLabel}`}
          data-tour="map-filters"
        >
          <ListFilter className="h-3.5 w-3.5" />
          Filters
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
            {isAllSelected ? "All" : value.length}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className={cn("w-80 p-0 shadow-lg", contentClassName)}>
        <div className="border-b px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold leading-none">{title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{selectedLabel}</p>
            </div>
            <div className="flex gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[11px]"
                onClick={() => onChange([...FACILITY_CATEGORIES])}
              >
                All
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[11px]"
                onClick={() => onChange([])}
              >
                Clear
              </Button>
            </div>
          </div>
        </div>
        {onToggleBoardingHouses && (
          <div className="border-b px-2 py-2">
            <div className="flex h-9 items-center gap-2 rounded-md px-2 text-left text-xs transition-colors hover:bg-muted">
              <Checkbox
                id="map-filter-boarding-houses"
                checked={Boolean(showBoardingHouses)}
                onCheckedChange={(checked) => onToggleBoardingHouses(checked === true)}
                aria-label="Show boarding houses on the map"
              />
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white"
                aria-hidden="true"
              >
                <Home className="h-3 w-3" />
              </span>
              <label
                htmlFor="map-filter-boarding-houses"
                className="min-w-0 flex-1 truncate font-medium"
              >
                Boarding houses
              </label>
              {boardingHousesLoading && (
                <span
                  className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent text-muted-foreground"
                  aria-hidden="true"
                />
              )}
            </div>
          </div>
        )}
        <div
          role="group"
          aria-label="Filter by category"
          className="grid max-h-80 grid-cols-1 gap-1 overflow-y-auto p-2 sm:grid-cols-2"
        >
          {FACILITY_CATEGORIES.map((cat) => {
            const meta = FACILITY_CATEGORY_META[cat];
            const isActive = value.includes(cat);
            const checkboxId = `map-filter-${cat}`;

            return (
              <div
                key={cat}
                className="flex h-9 items-center gap-2 rounded-md px-2 text-left text-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <Checkbox
                  id={checkboxId}
                  checked={isActive}
                  onCheckedChange={() => onToggle(cat)}
                  aria-label={meta.label}
                />
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: meta.color }}
                  aria-hidden="true"
                />
                <label htmlFor={checkboxId} className="min-w-0 flex-1 truncate font-medium">
                  {meta.label}
                </label>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
