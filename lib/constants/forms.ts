export const VALIDATION_LIMITS = {
  room: {
    code: { min: 1, max: 16 },
    name: { max: 120 },
    description: { max: 400 },
  },
  facility: {
    code: { min: 1, max: 16 },
    name: { min: 2, max: 120 },
    description: { max: 400 },
  },
  submission: {
    name: { max: 80 },
    email: { max: 120 },
    notes: { max: 500 },
  },
  storage: {
    inputMaxMB: 5,
    acceptedTypes: ["image/png", "image/jpeg", "image/webp"] as const,
  },
} as const;
