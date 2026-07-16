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

export const STORAGE_LIMITS = {
  inputMaxMB: 5,
  compressedMaxMB: 1,
  acceptedTypes: ["image/png", "image/jpeg", "image/webp", ".png", ".jpg", ".jpeg", ".webp"] as const,
  compression: {
    quality: 0.8,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    fileType: "image/webp" as const,
  },
} as const;
