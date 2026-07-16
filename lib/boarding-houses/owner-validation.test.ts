import test from "node:test";
import assert from "node:assert/strict";

import {
  ownerApplicationSchema,
  ownerListingDraftSchema,
  ownerOfferingSchema,
  slugifyListingName,
} from "./owner-validation.ts";

const baseOffering = {
  label: "Standard bedspace",
  roomType: "bedspace",
  monthlyPrice: "2500",
  availableSlots: "4",
  capacity: "",
  sizeSqm: "",
  hasAircon: false,
  privateBathroom: false,
};

const baseDraft = {
  name: "Green Gate Residence",
  description: "Clean rooms for VSU students near the main gate.",
  addressLine: "Pangasugan Road",
  latitude: 10.7445,
  longitude: 124.7921,
  contactPhone: "09171234567",
  contactFacebook: "https://facebook.com/greengate",
  contactEmail: "owner@example.com",
  occupancyPolicies: ["female_only"],
  offerings: [baseOffering],
  wifi: true,
  cookingAllowed: true,
  furnished: true,
  hasCurfew: false,
  curfewTime: "",
  walkingMinutesToCampusGate: 8,
};

test("ownerApplicationSchema requires contact details and authority notes", () => {
  const parsed = ownerApplicationSchema.safeParse({
    displayName: "Maria Owner",
    phone: "09171234567",
    email: "owner@example.com",
    authorityNotes: "I own the property and manage its boarding rooms.",
  });

  assert.equal(parsed.success, true);
});

test("ownerApplicationSchema rejects too-short authority notes", () => {
  const parsed = ownerApplicationSchema.safeParse({
    displayName: "M",
    phone: "123",
    email: "not-an-email",
    authorityNotes: "owner",
  });

  assert.equal(parsed.success, false);
});

test("ownerListingDraftSchema accepts a complete draft with student-essential fields", () => {
  const parsed = ownerListingDraftSchema.safeParse(baseDraft);

  assert.equal(parsed.success, true);
});

test("ownerListingDraftSchema parses utility inclusions and move-in terms", () => {
  const parsed = ownerListingDraftSchema.safeParse({
    ...baseDraft,
    waterIncluded: true,
    electricityIncluded: true,
    privateBathroom: true,
    advanceMonths: "1",
    depositMonths: "2",
  });

  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.waterIncluded, true);
    assert.equal(parsed.data.electricityIncluded, true);
    assert.equal(parsed.data.privateBathroom, true);
    assert.equal(parsed.data.advanceMonths, 1);
    assert.equal(parsed.data.depositMonths, 2);
  }
});

test("ownerListingDraftSchema treats blank move-in terms as null", () => {
  const parsed = ownerListingDraftSchema.safeParse({
    ...baseDraft,
    advanceMonths: "",
    depositMonths: "",
  });

  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.advanceMonths, null);
    assert.equal(parsed.data.depositMonths, null);
  }
});

test("ownerListingDraftSchema defaults new utility flags to false when omitted", () => {
  const parsed = ownerListingDraftSchema.safeParse(baseDraft);

  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.waterIncluded, false);
    assert.equal(parsed.data.electricityIncluded, false);
    assert.equal(parsed.data.privateBathroom, false);
    assert.equal(parsed.data.advanceMonths, null);
    assert.equal(parsed.data.depositMonths, null);
  }
});

test("ownerListingDraftSchema rejects out-of-range move-in terms", () => {
  const parsed = ownerListingDraftSchema.safeParse({
    ...baseDraft,
    advanceMonths: "13",
  });

  assert.equal(parsed.success, false);
});

test("ownerListingDraftSchema rejects blank offering price and slots", () => {
  const parsed = ownerListingDraftSchema.safeParse({
    ...baseDraft,
    offerings: [{ ...baseOffering, monthlyPrice: "", availableSlots: "" }],
  });

  assert.equal(parsed.success, false);
});

test("ownerListingDraftSchema rejects non-integer offering price", () => {
  const parsed = ownerListingDraftSchema.safeParse({
    ...baseDraft,
    offerings: [{ ...baseOffering, monthlyPrice: "2500.5" }],
  });

  assert.equal(parsed.success, false);
});

test("ownerListingDraftSchema requires at least one offering", () => {
  const parsed = ownerListingDraftSchema.safeParse({ ...baseDraft, offerings: [] });

  assert.equal(parsed.success, false);
});

test("ownerListingDraftSchema accepts multiple offerings with room detail", () => {
  const parsed = ownerListingDraftSchema.safeParse({
    ...baseDraft,
    offerings: [
      baseOffering,
      {
        label: "Aircon private room",
        roomType: "private_room",
        monthlyPrice: "3500",
        availableSlots: "2",
        capacity: "1",
        sizeSqm: "12.5",
        hasAircon: true,
        privateBathroom: true,
      },
    ],
  });

  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.offerings.length, 2);
    assert.equal(parsed.data.offerings[1].capacity, 1);
    assert.equal(parsed.data.offerings[1].sizeSqm, 12.5);
    assert.equal(parsed.data.offerings[1].hasAircon, true);
    assert.equal(parsed.data.offerings[1].privateBathroom, true);
  }
});

test("ownerOfferingSchema defaults optional room detail and rejects bad capacity", () => {
  const parsed = ownerOfferingSchema.safeParse(baseOffering);
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.capacity, null);
    assert.equal(parsed.data.sizeSqm, null);
    assert.equal(parsed.data.hasAircon, false);
    assert.equal(parsed.data.privateBathroom, false);
  }

  const badCapacity = ownerOfferingSchema.safeParse({ ...baseOffering, capacity: "50" });
  assert.equal(badCapacity.success, false);

  const badSize = ownerOfferingSchema.safeParse({ ...baseOffering, sizeSqm: "-3" });
  assert.equal(badSize.success, false);
});

test("ownerOfferingSchema defaults the room image manifest to none", () => {
  const parsed = ownerOfferingSchema.safeParse(baseOffering);
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.deepEqual(parsed.data.image, { t: "none" });
    assert.equal(parsed.data.imagePath, null);
  }
});

test("ownerOfferingSchema keeps an existing room image path", () => {
  const parsed = ownerOfferingSchema.safeParse({
    ...baseOffering,
    image: { t: "keep" },
    imagePath: "listing-123/rooms/abc.jpg",
  });
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.deepEqual(parsed.data.image, { t: "keep" });
    assert.equal(parsed.data.imagePath, "listing-123/rooms/abc.jpg");
  }
});

test("ownerOfferingSchema accepts a new room image manifest with no kept path", () => {
  const parsed = ownerOfferingSchema.safeParse({
    ...baseOffering,
    image: { t: "new" },
  });
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.deepEqual(parsed.data.image, { t: "new" });
    assert.equal(parsed.data.imagePath, null);
  }
});

test("ownerOfferingSchema rejects an unknown room image manifest tag", () => {
  const parsed = ownerOfferingSchema.safeParse({
    ...baseOffering,
    image: { t: "swap" },
  });
  assert.equal(parsed.success, false);
});

test("ownerListingDraftSchema requires a valid curfew time when curfew is on", () => {
  const missing = ownerListingDraftSchema.safeParse({
    ...baseDraft,
    hasCurfew: true,
    curfewTime: "",
  });
  assert.equal(missing.success, false);

  const badFormat = ownerListingDraftSchema.safeParse({
    ...baseDraft,
    hasCurfew: true,
    curfewTime: "25:99",
  });
  assert.equal(badFormat.success, false);

  const valid = ownerListingDraftSchema.safeParse({
    ...baseDraft,
    hasCurfew: true,
    curfewTime: "22:00",
  });
  assert.equal(valid.success, true);
});

test("ownerListingDraftSchema clears curfew time when curfew is off", () => {
  const parsed = ownerListingDraftSchema.safeParse({
    ...baseDraft,
    hasCurfew: false,
    curfewTime: "22:00",
  });

  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.curfewTime, null);
  }
});

test("slugifyListingName collapses repeats and trims dashes", () => {
  assert.equal(slugifyListingName("  --Green   Gate!! --  "), "green-gate");
});

test("slugifyListingName falls back to a safe default when empty", () => {
  assert.equal(slugifyListingName("!!!"), "listing");
});
