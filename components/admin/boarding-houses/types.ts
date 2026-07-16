export type AdminListingPhoto = {
  url: string;
  alt: string;
};

export type AdminListing = {
  id: string;
  slug: string;
  name: string;
  description: string;
  addressLine: string;
  latitude: number;
  longitude: number;
  status: string;
  verificationStatus: string;
  contactPhone: string | null;
  contactFacebook: string | null;
  contactEmail: string | null;
  priceMin: number | null;
  priceMax: number | null;
  availableSlots: number | null;
  roomTypes: string[];
  occupancyPolicies: string[];
  amenities: {
    wifi: boolean;
    cookingAllowed: boolean;
    furnished: boolean;
    waterIncluded: boolean;
    electricityIncluded: boolean;
    airConditioning: boolean;
    laundryArea: boolean;
    dryingArea: boolean;
    parking: boolean;
    studyArea: boolean;
  };
  rules: {
    hasCurfew: boolean;
    curfewTime: string | null;
    allowsVisitors: boolean;
    allowsPets: boolean;
    smokingAllowed: boolean;
  };
  safetyFeatures: string[];
  applianceFee: number | null;
  mobileCarriers: string[];
  walkingMinutesToCampusGate: number | null;
  ownerDisplayName: string;
  avgRating: number;
  ratingCount: number;
  moderationNote: string | null;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  publishedAt: string | null;
  photos: AdminListingPhoto[];
};

export type AdminVerificationDocument = {
  id: string;
  filename: string;
  sizeBytes: number;
  url: string | null;
};

export type AdminApplication = {
  id: string;
  displayName: string;
  phone: string | null;
  email: string | null;
  authorityNotes: string | null;
  status: string;
  createdAt: string;
  documents: AdminVerificationDocument[];
};

export type AdminReport = {
  id: string;
  listingId: string;
  reason: string;
  details: string | null;
  reporterContact: string | null;
  status: string;
  createdAt: string;
  listingName: string;
};
