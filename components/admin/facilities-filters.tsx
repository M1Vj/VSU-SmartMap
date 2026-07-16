import { useMemo, useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import type { FacilityCategory } from '@/lib/types/facility';
import { FACILITY_CATEGORIES } from '@/lib/types/facility';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type TypeFilter = 'all' | 'buildings' | 'pois';
type SortOption = 'name-asc' | 'name-desc' | 'updated-desc' | 'updated-asc';

export interface FacilitiesFiltersState {
  query: string;
  category: FacilityCategory | 'all';
  type: TypeFilter;
  sort: SortOption;
}

interface FacilitiesFiltersProps {
  value: FacilitiesFiltersState;
  onChange: (next: FacilitiesFiltersState) => void;
}

const TYPE_LABELS: Record<TypeFilter, string> = {
  all: 'All',
  buildings: 'Buildings',
  pois: 'POIs',
};

const SORT_LABELS: Record<SortOption, string> = {
  'name-asc': 'Name (A → Z)',
  'name-desc': 'Name (Z → A)',
  'updated-desc': 'Updated (newest)',
  'updated-asc': 'Updated (oldest)',
};

export function FacilitiesFilters({ value, onChange }: FacilitiesFiltersProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const categoryOptions = useMemo(
    () => ['all', ...FACILITY_CATEGORIES] as const,
    [],
  );

  return (
    <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
      <div className="flex-1 min-w-[220px] space-y-1.5">
        <Label htmlFor="search">Search</Label>
        <Input
          id="search"
          value={value.query}
          placeholder="Search by name or code"
          onChange={(event) =>
            onChange({
              ...value,
              query: event.target.value,
            })
          }
        />
      </div>

      <div className="min-w-[180px] space-y-1.5">
        <Label>Category</Label>
        {mounted ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full justify-between font-normal">
                {value.category === 'all' ? 'All' : value.category}
                <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[180px]">
              <DropdownMenuRadioGroup
                value={value.category}
                onValueChange={(val) =>
                  onChange({
                    ...value,
                    category: val as FacilitiesFiltersState['category'],
                  })
                }
              >
                {categoryOptions.map((option) => (
                  <DropdownMenuRadioItem key={option} value={option}>
                    {option === 'all' ? 'All' : option}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button variant="outline" className="w-full justify-between font-normal" disabled>
            Loading...
            <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
          </Button>
        )}
      </div>

      <div className="min-w-[160px] space-y-1.5">
        <Label>Type</Label>
        {mounted ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full justify-between font-normal">
                {TYPE_LABELS[value.type]}
                <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[160px]">
              <DropdownMenuRadioGroup
                value={value.type}
                onValueChange={(val) =>
                  onChange({
                    ...value,
                    type: val as TypeFilter,
                  })
                }
              >
                <DropdownMenuRadioItem value="all">All</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="buildings">Buildings</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="pois">POIs</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button variant="outline" className="w-full justify-between font-normal" disabled>
            Loading...
            <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
          </Button>
        )}
      </div>

      <div className="min-w-[180px] space-y-1.5">
        <Label>Sort by</Label>
        {mounted ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full justify-between font-normal">
                {SORT_LABELS[value.sort]}
                <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[180px]">
              <DropdownMenuRadioGroup
                value={value.sort}
                onValueChange={(val) =>
                  onChange({
                    ...value,
                    sort: val as SortOption,
                  })
                }
              >
                <DropdownMenuRadioItem value="name-asc">Name (A → Z)</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="name-desc">Name (Z → A)</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="updated-desc">Updated (newest)</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="updated-asc">Updated (oldest)</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button variant="outline" className="w-full justify-between font-normal" disabled>
            Loading...
            <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
          </Button>
        )}
      </div>
    </div>
  );
}
