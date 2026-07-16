import type { FacilityCategory } from "@/lib/types/facility";

export interface FacilityCategoryMeta {
  label: string;
  color: string;
  pinAsset: string;
}

export const FACILITY_CATEGORY_META: Record<FacilityCategory, FacilityCategoryMeta> = {
  academic: {
    label: "Academic",
    color: "#10b981", // emerald-500
    pinAsset: "/pins/academic.svg",
  },
  administrative: {
    label: "Administrative",
    color: "#f59e0b", // amber-500
    pinAsset: "/pins/admin.svg",
  },
  research: {
    label: "Research",
    color: "#8b5cf6", // violet-500
    pinAsset: "/pins/research.svg",
  },
  office: {
    label: "Office",
    color: "#64748b", // slate-500
    pinAsset: "/pins/office.svg",
  },
  residential: {
    label: "Residential",
    color: "#3b82f6", // blue-500
    pinAsset: "/pins/dorm.svg",
  },
  dormitory: {
    label: "Dormitory",
    color: "#6366f1", // indigo-500
    pinAsset: "/pins/dorm.svg",
  },
  lodging: {
    label: "Lodging",
    color: "#0ea5e9", // sky-500
    pinAsset: "/pins/lodging.svg",
  },
  sports: {
    label: "Sports",
    color: "#84cc16", // lime-500
    pinAsset: "/pins/sports.svg",
  },
  dining: {
    label: "Dining",
    color: "#f97316", // orange-500
    pinAsset: "/pins/dining.svg",
  },
  library: {
    label: "Library",
    color: "#a16207", // yellow-800
    pinAsset: "/pins/library.svg",
  },
  medical: {
    label: "Medical",
    color: "#ef4444", // red-500
    pinAsset: "/pins/medical.svg",
  },
  parking: {
    label: "Parking",
    color: "#71717a", // zinc-500
    pinAsset: "/pins/parking.svg",
  },
  landmark: {
    label: "Landmark",
    color: "#ec4899", // pink-500
    pinAsset: "/pins/landmark.svg",
  },
  religious: {
    label: "Religious",
    color: "#06b6d4", // cyan-500
    pinAsset: "/pins/religious.svg",
  },
  utility: {
    label: "Utility",
    color: "#4b5563", // gray-600
    pinAsset: "/pins/utility.svg",
  },
  commercial: {
    label: "Commercial",
    color: "#14b8a6", // teal-500
    pinAsset: "/pins/commercial.svg",
  },
  transportation: {
    label: "Transportation",
    color: "#eab308", // yellow-500
    pinAsset: "/pins/transport.svg",
  },
  atm: {
    label: "ATM",
    color: "#22c55e", // green-500
    pinAsset: "/pins/atm.svg",
  },
  other: {
    label: "Other",
    color: "#9ca3af", // gray-400
    pinAsset: "/pins/other.svg",
  },
};

export function getCategoryMeta(category: FacilityCategory): FacilityCategoryMeta {
  return FACILITY_CATEGORY_META[category];
}

export function getCategoryLabel(category: FacilityCategory): string {
  return FACILITY_CATEGORY_META[category].label;
}

export function getCategoryColor(category: FacilityCategory): string {
  return FACILITY_CATEGORY_META[category].color;
}

export function getCategoryPinAsset(category: FacilityCategory): string {
  return FACILITY_CATEGORY_META[category].pinAsset;
}
