"use client";

import type { ReactNode } from "react";
import { MapPin, Pencil } from "lucide-react";

import type {
  BoardingHouseFilters,
  BoardingHouseOccupancyPolicy,
} from "@/lib/boarding-houses/types";
import { BOARDING_HOUSE_DEFAULT_FILTERS } from "@/lib/boarding-houses/filters";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type WalkingTimeControls = {
  referenceLabel: string;
  maxMinutes: number | null;
  onMaxMinutesChange: (value: number | null) => void;
  onEditReference: () => void;
};

type BoardingHouseFiltersPanelProps = {
  value: BoardingHouseFilters;
  onChange: (next: BoardingHouseFilters) => void;
  walking: WalkingTimeControls;
  onReset?: () => void;
};

export function BoardingHouseFiltersPanel({
  value,
  onChange,
  walking,
  onReset,
}: BoardingHouseFiltersPanelProps) {
  const patch = (partial: Partial<BoardingHouseFilters>) =>
    onChange({ ...value, ...partial });

  const toggleOccupancyPolicy = (
    policy: BoardingHouseOccupancyPolicy,
    checked: boolean,
  ) =>
    patch({
      occupancyPolicies: checked
        ? [...value.occupancyPolicies, policy]
        : value.occupancyPolicies.filter((item) => item !== policy),
    });

  return (
    <aside className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Student filters</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Compare rent, slots, rules, and walking time.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 rounded-full px-3 text-xs"
          onClick={() =>
            onReset ? onReset() : onChange({ ...BOARDING_HOUSE_DEFAULT_FILTERS })
          }
        >
          Reset
        </Button>
      </div>

      <div className="mt-4 space-y-4">
        <Field label="Search" htmlFor="bh-filter-search">
          <Input
            id="bh-filter-search"
            value={value.query}
            onChange={(event) => patch({ query: event.target.value })}
            placeholder="Name, address, owner"
            type="search"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Min rent" htmlFor="bh-filter-min-price">
            <Input
              id="bh-filter-min-price"
              inputMode="numeric"
              value={value.minMonthlyPrice ?? ""}
              onChange={(event) =>
                patch({ minMonthlyPrice: readNullableNumber(event.target.value) })
              }
              placeholder="₱ / month"
            />
          </Field>
          <Field label="Max rent" htmlFor="bh-filter-max-price">
            <Input
              id="bh-filter-max-price"
              inputMode="numeric"
              value={value.maxMonthlyPrice ?? ""}
              onChange={(event) =>
                patch({ maxMonthlyPrice: readNullableNumber(event.target.value) })
              }
              placeholder="₱ / month"
            />
          </Field>
        </div>

        <Field label="Min slots" htmlFor="bh-filter-min-slots">
          <Input
            id="bh-filter-min-slots"
            inputMode="numeric"
            value={value.minAvailableSlots ?? ""}
            onChange={(event) =>
              patch({ minAvailableSlots: readNullableNumber(event.target.value) })
            }
            placeholder="1"
          />
        </Field>

        <Field label="Room type">
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["bedspace", "Bedspace"],
                ["shared_room", "Shared room"],
                ["private_room", "Private"],
                ["studio", "Studio"],
                ["whole_unit", "Whole unit"],
              ] as const
            ).map(([type, label]) => (
              <FilterToggle
                key={type}
                checked={value.roomTypes.includes(type)}
                label={label}
                onCheckedChange={(checked) =>
                  patch({
                    roomTypes: checked
                      ? [...value.roomTypes, type]
                      : value.roomTypes.filter((current) => current !== type),
                  })
                }
              />
            ))}
          </div>
        </Field>

        <Field label="Occupancy policy">
          <div className="grid grid-cols-2 gap-2">
            <FilterToggle
              checked={value.occupancyPolicies.includes("any_gender")}
              label="Any gender"
              onCheckedChange={(checked) =>
                toggleOccupancyPolicy("any_gender", checked)
              }
            />
            <FilterToggle
              checked={value.occupancyPolicies.includes("female_only")}
              label="Female only"
              onCheckedChange={(checked) =>
                toggleOccupancyPolicy("female_only", checked)
              }
            />
            <FilterToggle
              checked={value.occupancyPolicies.includes("male_only")}
              label="Male only"
              onCheckedChange={(checked) =>
                toggleOccupancyPolicy("male_only", checked)
              }
            />
            <FilterToggle
              checked={value.occupancyPolicies.includes("family_only")}
              label="Family only"
              onCheckedChange={(checked) =>
                toggleOccupancyPolicy("family_only", checked)
              }
            />
          </div>
        </Field>

        <Field label="Essentials">
          <div className="grid grid-cols-1 gap-2">
            <FilterToggle
              checked={value.wifi}
              label="Wi-Fi"
              onCheckedChange={(checked) => patch({ wifi: checked })}
            />
            <FilterToggle
              checked={value.cookingAllowed}
              label="Cooking allowed"
              onCheckedChange={(checked) => patch({ cookingAllowed: checked })}
            />
            <FilterToggle
              checked={value.furnished}
              label="Furnished"
              onCheckedChange={(checked) => patch({ furnished: checked })}
            />
            <FilterToggle
              checked={value.airConditioning}
              label="Aircon"
              onCheckedChange={(checked) => patch({ airConditioning: checked })}
            />
            <FilterToggle
              checked={value.privateBathroom}
              label="Private bathroom"
              onCheckedChange={(checked) => patch({ privateBathroom: checked })}
            />
            <FilterToggle
              checked={value.allowsNoCurfew}
              label="No curfew listed"
              onCheckedChange={(checked) => patch({ allowsNoCurfew: checked })}
            />
            <FilterToggle
              checked={value.smokingAllowed}
              label="Smoking allowed"
              onCheckedChange={(checked) => patch({ smokingAllowed: checked })}
            />
            <FilterToggle
              checked={value.dryingArea}
              label="Drying area"
              onCheckedChange={(checked) => patch({ dryingArea: checked })}
            />
          </div>
        </Field>

        <Field label="Utilities included">
          <div className="grid grid-cols-1 gap-2">
            <FilterToggle
              checked={value.waterIncluded}
              label="Water"
              onCheckedChange={(checked) => patch({ waterIncluded: checked })}
            />
            <FilterToggle
              checked={value.electricityIncluded}
              label="Electricity"
              onCheckedChange={(checked) => patch({ electricityIncluded: checked })}
            />
          </div>
        </Field>

        <Field label="Safety">
          <div className="grid grid-cols-1 gap-2">
            <FilterToggle
              checked={value.cctv}
              label="CCTV"
              onCheckedChange={(checked) => patch({ cctv: checked })}
            />
          </div>
        </Field>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label
              htmlFor="bh-filter-walking-time"
              className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Walking time
            </Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={walking.onEditReference}
              aria-label={`Measured from ${walking.referenceLabel}. Change reference point.`}
              className="h-7 max-w-[60%] gap-1 rounded-full px-2.5"
            >
              <MapPin className="text-primary" aria-hidden="true" />
              <span className="truncate">{walking.referenceLabel}</span>
              <Pencil className="text-muted-foreground" aria-hidden="true" />
            </Button>
          </div>
          <Input
            id="bh-filter-walking-time"
            inputMode="numeric"
            value={walking.maxMinutes ?? ""}
            onChange={(event) =>
              walking.onMaxMinutesChange(readNullableNumber(event.target.value))
            }
            placeholder="Max minutes"
          />
        </div>
      </div>
    </aside>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label
        htmlFor={htmlFor}
        className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
      >
        {label}
      </Label>
      {children}
    </div>
  );
}

function FilterToggle({
  checked,
  label,
  onCheckedChange,
}: {
  checked: boolean;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition hover:bg-muted/60">
      <Checkbox
        checked={checked}
        onCheckedChange={(next) => onCheckedChange(next === true)}
      />
      <span>{label}</span>
    </label>
  );
}

function readNullableNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}
