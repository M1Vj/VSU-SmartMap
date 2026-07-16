import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";



const VSU_COLORS = {
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
};

const config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],

  theme: {
    extend: {
      container: {
        center: true,
        padding: "2rem",
        screens: {
          "2xl": "1400px",
        },
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        vsu: VSU_COLORS,
      },
      fontFamily: {
        sans: ["var(--font-sans)", "PT Sans", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "Source Code Pro", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      fontSize: {
        "display-xl": ["2.75rem", { lineHeight: "3.25rem", fontWeight: "700" }],
        "display-md": ["2.25rem", { lineHeight: "2.75rem", fontWeight: "700" }],
        "title-lg": ["1.5rem", { lineHeight: "2rem", fontWeight: "700" }],
        "title-sm": ["1.25rem", { lineHeight: "1.75rem", fontWeight: "600" }],
        body: ["1rem", { lineHeight: "1.6rem", fontWeight: "400" }],
        "body-sm": ["0.875rem", { lineHeight: "1.4rem", fontWeight: "400" }],
        label: ["0.8125rem", { lineHeight: "1.2rem", fontWeight: "600", letterSpacing: "0.02em" }],
      },
      spacing: {
        13: "3.25rem",
        15: "3.75rem",
        18: "4.5rem",
        22: "5.5rem",
        26: "6.5rem",
        30: "7.5rem",
      },
      borderRadius: {
        none: "0px",
        xs: "0.25rem",
        sm: "0.5rem",
        md: "0.75rem",
        lg: "1rem",
        xl: "1.5rem",
        pill: "999px",
        sheet: "2rem",
      },
      boxShadow: {
        card: "0px 8px 30px rgba(15, 28, 17, 0.06)",
        panel: "0px 12px 40px rgba(15, 28, 17, 0.08)",
        floating: "0px 25px 60px rgba(15, 28, 17, 0.12)",
      },
      screens: {
        xs: "420px",
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
        "2xl": "1440px",
        "3xl": "1680px",
      },

    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;

export default config;
