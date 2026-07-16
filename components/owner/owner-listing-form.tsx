"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useFormStatus } from "react-dom";
import { AlertCircle } from "lucide-react";

import { createOwnerListing, updateOwnerListing } from "@/app/owner/actions";
import {
  BOARDING_HOUSE_MOBILE_CARRIERS,
  BOARDING_HOUSE_MOBILE_CARRIER_LABELS,
  BOARDING_HOUSE_OCCUPANCY_POLICIES,
  BOARDING_HOUSE_SAFETY_FEATURES,
  BOARDING_HOUSE_SAFETY_FEATURE_LABELS,
} from "@/lib/boarding-houses/types";
import { OCCUPANCY_POLICY_LABELS } from "@/lib/boarding-houses/labels";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ListingPhotoManager,
  type OwnerPhotoItem,
} from "@/components/owner/listing-photo-manager";
import {
  ListingOfferingsEditor,
  makeEmptyOffering,
  type OfferingRow,
} from "@/components/owner/listing-offerings-editor";

const MOVE_IN_MONTH_OPTIONS: Array<[string, string]> = [
  ["", "None"],
  ["1", "1 month"],
  ["2", "2 months"],
  ["3", "3 months"],
];

const ListingLocationPicker = dynamic(
  () => import("@/components/owner/listing-location-picker"),
  {
    ssr: false,
    loading: () => <div className="h-64 w-full animate-pulse rounded-xl border bg-muted" />,
  },
);

const OCCUPANCY_POLICY_OPTIONS: Array<[string, string]> =
  BOARDING_HOUSE_OCCUPANCY_POLICIES.map((value) => [value, OCCUPANCY_POLICY_LABELS[value]]);

const SAFETY_FEATURE_OPTIONS: Array<[string, string]> =
  BOARDING_HOUSE_SAFETY_FEATURES.map((value) => [
    value,
    BOARDING_HOUSE_SAFETY_FEATURE_LABELS[value],
  ]);

const MOBILE_CARRIER_OPTIONS: Array<[string, string]> =
  BOARDING_HOUSE_MOBILE_CARRIERS.map((value) => [
    value,
    BOARDING_HOUSE_MOBILE_CARRIER_LABELS[value],
  ]);

export type OwnerListingFormInitial = {
  id: string;
  name: string;
  addressLine: string;
  latitude: number;
  longitude: number;
  description: string;
  contactPhone: string | null;
  contactFacebook: string | null;
  contactEmail: string | null;
  walkingMinutesToCampusGate: number | null;
  occupancyPolicies: string[];
  offerings: Array<{
    label: string;
    roomType: string;
    monthlyPrice: number;
    availableSlots: number;
    capacity: number | null;
    sizeSqm: number | null;
    hasAircon: boolean;
    privateBathroom: boolean;
    imagePath: string | null;
    imageUrl: string | null;
  }>;
  wifi: boolean;
  waterIncluded: boolean;
  electricityIncluded: boolean;
  privateBathroom: boolean;
  advanceMonths: number | null;
  depositMonths: number | null;
  cookingAllowed: boolean;
  furnished: boolean;
  airConditioning: boolean;
  laundryArea: boolean;
  dryingArea: boolean;
  parking: boolean;
  studyArea: boolean;
  safetyFeatures: string[];
  applianceFee: number | null;
  mobileCarriers: string[];
  hasCurfew: boolean;
  allowsVisitors: boolean;
  allowsPets: boolean;
  smokingAllowed: boolean;
  curfewTime: string | null;
  photos: Array<{ id: string; url: string; alt: string }>;
};

export function OwnerListingForm({ initial }: { initial?: OwnerListingFormInitial }) {
  const [error, setError] = useState("");
  const [latitude, setLatitude] = useState(initial ? String(initial.latitude) : "");
  const [longitude, setLongitude] = useState(initial ? String(initial.longitude) : "");

  const [waterIncluded, setWaterIncluded] = useState(initial?.waterIncluded ?? false);
  const [electricityIncluded, setElectricityIncluded] = useState(
    initial?.electricityIncluded ?? false,
  );
  const [privateBathroom, setPrivateBathroom] = useState(
    initial?.privateBathroom ?? false,
  );

  const [photoItems, setPhotoItems] = useState<OwnerPhotoItem[]>(() =>
    (initial?.photos ?? []).map((photo) => ({
      key: `existing-${photo.id}`,
      kind: "existing" as const,
      id: photo.id,
      url: photo.url,
      alt: photo.alt,
    })),
  );

  const [offeringRows, setOfferingRows] = useState<OfferingRow[]>(() => {
    if (!initial || initial.offerings.length === 0) return [makeEmptyOffering()];
    return initial.offerings.map((offering, index) => ({
      key: `offering-${index}-${offering.label}`,
      label: offering.label,
      roomType: offering.roomType,
      monthlyPrice: String(offering.monthlyPrice),
      availableSlots: String(offering.availableSlots),
      capacity: offering.capacity != null ? String(offering.capacity) : "",
      sizeSqm: offering.sizeSqm != null ? String(offering.sizeSqm) : "",
      hasAircon: offering.hasAircon,
      privateBathroom: offering.privateBathroom,
      image:
        offering.imagePath && offering.imageUrl
          ? { kind: "existing" as const, path: offering.imagePath, url: offering.imageUrl }
          : { kind: "none" as const },
    }));
  });

  const listingPoint = useMemo(() => {
    const lat = Number.parseFloat(latitude);
    const lng = Number.parseFloat(longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }, [latitude, longitude]);

  const amenitySelected = useMemo(() => {
    if (!initial) return undefined;
    const entries: Array<[string, boolean]> = [
      ["wifi", initial.wifi],
      ["cookingAllowed", initial.cookingAllowed],
      ["furnished", initial.furnished],
      ["airConditioning", initial.airConditioning],
      ["laundryArea", initial.laundryArea],
      ["dryingArea", initial.dryingArea],
      ["parking", initial.parking],
      ["studyArea", initial.studyArea],
      ["hasCurfew", initial.hasCurfew],
      ["allowsVisitors", initial.allowsVisitors],
      ["allowsPets", initial.allowsPets],
      ["smokingAllowed", initial.smokingAllowed],
    ];
    return new Set(entries.filter(([, on]) => on).map(([key]) => key));
  }, [initial]);

  async function handleSubmit(formData: FormData) {
    setError("");

    if (!listingPoint) {
      setError("Drop the location pin on the map before submitting.");
      return;
    }

    const manifest = photoItems.map((item) =>
      item.kind === "existing" ? { t: "e", id: item.id } : { t: "n" },
    );
    formData.set("photoManifest", JSON.stringify(manifest));
    formData.delete("photos");
    for (const item of photoItems) {
      if (item.kind === "new") formData.append("photos", item.file, item.file.name);
    }

    formData.set(
      "offerings",
      JSON.stringify(
        offeringRows.map((row) => ({
          label: row.label,
          roomType: row.roomType,
          monthlyPrice: row.monthlyPrice,
          availableSlots: row.availableSlots,
          capacity: row.capacity,
          sizeSqm: row.sizeSqm,
          hasAircon: row.hasAircon,
          privateBathroom: row.privateBathroom,
          imagePath: row.image.kind === "existing" ? row.image.path : null,
          image: {
            t:
              row.image.kind === "existing"
                ? "keep"
                : row.image.kind === "new"
                  ? "new"
                  : "none",
          },
        })),
      ),
    );
    formData.delete("offeringImages");
    for (const row of offeringRows) {
      if (row.image.kind === "new") {
        formData.append("offeringImages", row.image.file, row.image.file.name);
      }
    }

    const result = initial
      ? await updateOwnerListing(initial.id, formData)
      : await createOwnerListing(formData);
    if (result?.error) setError(result.error);
  }

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>{initial ? "Edit listing" : "Listing details"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-6">
          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Listing name" name="name" required defaultValue={initial?.name ?? ""} />
            <Field
              label="Address"
              name="addressLine"
              required
              defaultValue={initial?.addressLine ?? ""}
            />
          </div>
          <input type="hidden" name="latitude" value={latitude} />
          <input type="hidden" name="longitude" value={longitude} />
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Describe the rooms, location, and student-friendly details."
              defaultValue={initial?.description ?? ""}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Phone" name="contactPhone" defaultValue={initial?.contactPhone ?? ""} />
            <Field
              label="Facebook URL"
              name="contactFacebook"
              defaultValue={initial?.contactFacebook ?? ""}
            />
            <Field
              label="Email"
              name="contactEmail"
              type="email"
              defaultValue={initial?.contactEmail ?? ""}
            />
          </div>
          <ListingOfferingsEditor rows={offeringRows} onRowsChange={setOfferingRows} />

          <div className="max-w-xs">
            <Field
              label="Walking minutes to campus gate"
              name="walkingMinutesToCampusGate"
              inputMode="numeric"
              defaultValue={
                initial?.walkingMinutesToCampusGate != null
                  ? String(initial.walkingMinutesToCampusGate)
                  : ""
              }
            />
          </div>

          <fieldset className="space-y-3 rounded-2xl border p-4">
            <legend className="px-1 text-sm font-semibold">Listing location</legend>
            <p className="text-xs text-muted-foreground">
              Tap the map to drop the <span className="font-medium text-foreground">blue</span> location
              pin on your boarding house.
            </p>
            <ListingLocationPicker
              location={listingPoint}
              onChange={(point) => {
                setLatitude(point.lat.toFixed(6));
                setLongitude(point.lng.toFixed(6));
              }}
            />
          </fieldset>

          <CheckGroup
            title="Occupancy policy"
            items={OCCUPANCY_POLICY_OPTIONS}
            name="occupancyPolicies"
            selected={initial ? new Set(initial.occupancyPolicies) : undefined}
          />
          <CheckGroup
            title="Amenities and rules"
            name="amenities"
            items={[
              ["wifi", "Wi-Fi"],
              ["cookingAllowed", "Cooking allowed"],
              ["furnished", "Furnished"],
              ["airConditioning", "Air-conditioning"],
              ["laundryArea", "Laundry area"],
              ["dryingArea", "Drying area"],
              ["parking", "Parking"],
              ["studyArea", "Study area"],
              ["hasCurfew", "Has curfew"],
              ["allowsVisitors", "Allows visitors"],
              ["allowsPets", "Allows pets"],
              ["smokingAllowed", "Smoking allowed"],
            ]}
            valueAsName
            selected={amenitySelected}
          />
          <CheckGroup
            title="Safety features"
            name="safetyFeatures"
            items={SAFETY_FEATURE_OPTIONS}
            selected={initial ? new Set(initial.safetyFeatures) : undefined}
          />
          <CheckGroup
            title="Mobile signal"
            name="mobileCarriers"
            items={MOBILE_CARRIER_OPTIONS}
            selected={initial ? new Set(initial.mobileCarriers) : undefined}
          />

          <fieldset className="space-y-2" data-tour="owner-utilities">
            <legend className="text-sm font-semibold">Utilities & bathroom</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <ControlledCheck
                name="waterIncluded"
                label="Water included"
                checked={waterIncluded}
                onChange={setWaterIncluded}
              />
              <ControlledCheck
                name="electricityIncluded"
                label="Electricity included"
                checked={electricityIncluded}
                onChange={setElectricityIncluded}
              />
              <ControlledCheck
                name="privateBathroom"
                label="Private bathroom available"
                checked={privateBathroom}
                onChange={setPrivateBathroom}
              />
            </div>
          </fieldset>

          <fieldset className="space-y-2" data-tour="owner-movein">
            <legend className="text-sm font-semibold">Move-in terms</legend>
            <p className="text-xs text-muted-foreground">
              Common in the Philippines is 1 month advance plus 1 month deposit.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <MonthsSelect
                label="Advance (months)"
                name="advanceMonths"
                defaultValue={initial?.advanceMonths != null ? String(initial.advanceMonths) : ""}
              />
              <MonthsSelect
                label="Deposit (months)"
                name="depositMonths"
                defaultValue={initial?.depositMonths != null ? String(initial.depositMonths) : ""}
              />
            </div>
          </fieldset>

          <div className="max-w-xs space-y-2">
            <Field
              label="Appliance fee (₱/month)"
              name="applianceFee"
              inputMode="numeric"
              defaultValue={
                initial?.applianceFee != null ? String(initial.applianceFee) : ""
              }
            />
            <p className="text-xs text-muted-foreground">
              Monthly add-on per appliance a boarder brings (e.g. rice cooker, fan).
              Leave blank if you do not charge one.
            </p>
          </div>

          <Field
            label="Curfew time"
            name="curfewTime"
            placeholder="22:00"
            defaultValue={initial?.curfewTime ?? ""}
          />

          <ListingPhotoManager items={photoItems} onItemsChange={setPhotoItems} />

          <SubmitButton editing={Boolean(initial)} />
        </form>
      </CardContent>
    </Card>
  );
}

function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full rounded-full md:w-auto" loading={pending}>
      {editing
        ? pending
          ? "Saving..."
          : "Save changes"
        : pending
          ? "Saving..."
          : "Save draft listing"}
    </Button>
  );
}

function Field(props: React.ComponentProps<typeof Input> & { label: string; name: string }) {
  const { label, name, ...inputProps } = props;
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} {...inputProps} />
    </div>
  );
}

function ControlledCheck({
  name,
  label,
  checked,
  onChange,
}: {
  name: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2 text-sm">
      <Checkbox
        name={name}
        checked={checked}
        onCheckedChange={(value) => onChange(value === true)}
      />
      {label}
    </label>
  );
}

function MonthsSelect({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue}
        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        {MOVE_IN_MONTH_OPTIONS.map(([value, optionLabel]) => (
          <option key={value} value={value}>
            {optionLabel}
          </option>
        ))}
      </select>
    </div>
  );
}

function CheckGroup({
  title,
  name,
  items,
  valueAsName = false,
  selected,
}: {
  title: string;
  name: string;
  items: Array<[string, string]>;
  valueAsName?: boolean;
  selected?: Set<string>;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold">{title}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map(([value, label]) => (
          <label key={value} className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2 text-sm">
            <Checkbox
              name={valueAsName ? value : name}
              value={value}
              defaultChecked={selected?.has(value)}
            />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
