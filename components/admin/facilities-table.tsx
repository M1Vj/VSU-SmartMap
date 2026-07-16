'use client';

import { useMemo, useState } from 'react';
import type { Facility, FacilityCategory } from '@/lib/types/facility';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FacilitiesFilters, type FacilitiesFiltersState } from './facilities-filters';
import { FacilityRowActions } from './facility-row-actions';

type TypeFilter = FacilitiesFiltersState['type'];

const dateFormatter = new Intl.DateTimeFormat('en', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

interface FacilitiesTableProps {
  facilities: Facility[];
  onAdd?: () => void;
  onEdit?: (facility: Facility) => void;
  onManageRooms?: (facility: Facility) => void;
  onDelete?: (facility: Facility) => void;
  disabled?: boolean;
}

const defaultFilters: FacilitiesFiltersState = {
  query: '',
  category: 'all',
  type: 'all',
  sort: 'name-asc',
};

export function FacilitiesTable({
  facilities,
  onAdd,
  onEdit,
  onManageRooms,
  onDelete,
  disabled,
}: FacilitiesTableProps) {
  const [filters, setFilters] = useState<FacilitiesFiltersState>(defaultFilters);

  const filtered = useMemo(() => {
    const byCategory = (facility: Facility, category: FacilityCategory | 'all') =>
      category === 'all' ? true : facility.category === category;

    const byType = (facility: Facility, type: TypeFilter) => {
      if (type === 'all') return true;
      if (type === 'buildings') return facility.hasRooms;
      return !facility.hasRooms;
    };

    const byQuery = (facility: Facility, query: string) => {
      if (!query.trim()) return true;
      const normalized = query.toLowerCase();
      return (
        facility.name.toLowerCase().includes(normalized) ||
        (facility.code ?? '').toLowerCase().includes(normalized)
      );
    };

    const facilitiesWithTimestamp = [...facilities]
      .filter((facility) => byQuery(facility, filters.query))
      .filter((facility) => byCategory(facility, filters.category))
      .filter((facility) => byType(facility, filters.type))
      .map((facility) => ({
        facility,
        updatedTimestamp: new Date(facility.updatedAt ?? facility.createdAt).getTime(),
      }));

    facilitiesWithTimestamp.sort((a, b) => {
      switch (filters.sort) {
        case 'name-desc':
          return b.facility.name.localeCompare(a.facility.name);
        case 'updated-desc':
          return b.updatedTimestamp - a.updatedTimestamp;
        case 'updated-asc':
          return a.updatedTimestamp - b.updatedTimestamp;
        case 'name-asc':
        default:
          return a.facility.name.localeCompare(b.facility.name);
      }
    });

    return facilitiesWithTimestamp.map((item) => item.facility);
  }, [facilities, filters]);

  return (
    <Card className="border shadow-sm">
      <CardHeader className="flex flex-col gap-3 space-y-0 bg-muted/20 md:flex-row md:items-center md:justify-between">
        <CardTitle className="text-lg">All facilities</CardTitle>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={onAdd} disabled={!onAdd || disabled} className="whitespace-nowrap">
            Add Facility
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <FacilitiesFilters value={filters} onChange={setFilters} />
        <div className="overflow-x-auto rounded-xl border">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead>
              <tr className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-semibold">Code</th>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Updated</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((facility) => (
                <tr key={facility.id} className="hover:bg-muted/40">
                  <td className="px-4 py-4 align-middle text-muted-foreground">
                    {facility.code ?? '—'}
                  </td>
                  <td className="px-4 py-4 align-middle font-semibold">{facility.name}</td>
                  <td className="px-4 py-4 align-middle">
                    <Badge variant="secondary" className="capitalize px-2 py-1">
                      {facility.category}
                    </Badge>
                  </td>
                  <td className="px-4 py-4 align-middle">
                    <Badge variant="outline" className="px-2 py-1 text-xs font-semibold">
                      {facility.hasRooms ? 'Building' : 'POI'}
                    </Badge>
                  </td>
                  <td className="px-4 py-4 align-middle text-muted-foreground">
                    {dateFormatter.format(new Date(facility.updatedAt ?? facility.createdAt))}
                  </td>
                  <td className="px-4 py-4 align-middle text-right">
                    <FacilityRowActions
                      facility={facility}
                      onEdit={onEdit}
                      onManageRooms={onManageRooms}
                      onDelete={onDelete}
                      disabled={disabled}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-10 text-center text-muted-foreground">
              No facilities match the current filters.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
