export const STORAGE_BUCKETS = {
  facilityImages: "smartmap-bucket",
  eventProofs: "event-proofs",
  eventImages: "smartmap-bucket",
} as const;

export const STORAGE_PATHS = {
  facilityHero: (facilityId: string) =>
    `${STORAGE_BUCKETS.facilityImages}/${facilityId}/hero`,
  roomImage: (facilityId: string, roomId: string) =>
    `${STORAGE_BUCKETS.facilityImages}/${facilityId}/rooms/${roomId}`,
  suggestionImage: (tempId: string) =>
    `${STORAGE_BUCKETS.facilityImages}/suggestion-images/${tempId}`,
  eventProof: (tempId: string) =>
    `${STORAGE_BUCKETS.eventProofs}/${tempId}`,
  bugReportScreenshot: (reportId: string) =>
    `${STORAGE_BUCKETS.facilityImages}/bug-reports/${reportId}`,
} as const;

const IMAGE_ACCEPTED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".heic",
  ".heif",
] as const;

export const STORAGE_LIMITS = {
  inputMaxMB: 30,
  imageInputMaxMB: 30,
  compressedMaxMB: 1,
  imageAcceptedTypes: IMAGE_ACCEPTED_TYPES,
  // Backward-compatible aliases for existing image-upload callers.
  facilityHeroInputMaxMB: 30,
  acceptedTypes: IMAGE_ACCEPTED_TYPES,
  facilityHeroAcceptedTypes: IMAGE_ACCEPTED_TYPES,
  compression: {
    quality: 0.8,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    fileType: "image/webp" as const,
  },
} as const;
