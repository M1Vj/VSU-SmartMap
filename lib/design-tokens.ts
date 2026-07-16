export const COLORS = {
  primary: { DEFAULT: "#4CA771", light: "#E4F3EA", dark: "#3C8B5C" },
  accent: { DEFAULT: "#F7D060", dark: "#E2BA45" },
  background: { DEFAULT: "#F5F7F2", card: "#FFFFFF", panel: "#E1E8DD" },
  neutral: { 900: "#0F1C11", 700: "#384C3B", 500: "#6B7C6D", 300: "#9CAFA1", 100: "#D8E0D4" },
  status: {
    success: "#3DA35D",
    warning: "#F4B942",
    danger: "#E8726C",
    info: "#4E94DB",
  },
  map: {
    land: "#D9E9D1",
    water: "#A9D6EC",
    pinAcademic: "#4CA771",
    pinService: "#F7D060",
    pinDorm: "#E8726C",
  },
} as const;

export const TYPOGRAPHY = {
  "display-xl": { size: "2.75rem", lineHeight: "3.25rem", weight: 700 },
  "display-md": { size: "2.25rem", lineHeight: "2.75rem", weight: 700 },
  "title-lg": { size: "1.5rem", lineHeight: "2rem", weight: 700 },
  "title-sm": { size: "1.25rem", lineHeight: "1.75rem", weight: 600 },
  body: { size: "1rem", lineHeight: "1.6rem", weight: 400 },
  "body-sm": { size: "0.875rem", lineHeight: "1.4rem", weight: 400 },
  label: { size: "0.8125rem", lineHeight: "1.2rem", weight: 600, letterSpacing: "0.02em" },
} as const;

export const SPACING = {
  13: "3.25rem",
  15: "3.75rem",
  18: "4.5rem",
  22: "5.5rem",
  26: "6.5rem",
  30: "7.5rem",
} as const;

export const RADII = {
  none: "0px",
  xs: "0.25rem",
  sm: "0.5rem",
  md: "0.75rem",
  lg: "1rem",
  xl: "1.5rem",
  pill: "999px",
  sheet: "2rem",
} as const;

export const ELEVATION = {
  card: "0px 8px 30px rgba(15, 28, 17, 0.06)",
  panel: "0px 12px 40px rgba(15, 28, 17, 0.08)",
  floating: "0px 25px 60px rgba(15, 28, 17, 0.12)",
} as const;

export const BREAKPOINTS = {
  xs: "420px",
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
  "2xl": "1440px",
  "3xl": "1680px",
} as const;

export type BrandColor = keyof typeof COLORS.primary;
