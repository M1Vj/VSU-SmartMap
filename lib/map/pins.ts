import { getCategoryColor } from "@/lib/constants/facilities";
import type { FacilityCategory } from "@/lib/types/facility";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const PHP_PRICE_FORMATTER = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

export function formatBoardingHousePinPrice(priceMin: number | null): string | null {
  if (priceMin === null || !Number.isFinite(priceMin)) {
    return null;
  }
  return PHP_PRICE_FORMATTER.format(priceMin);
}

type PinId =
  | "academic"
  | "administrative"
  | "research"
  | "office"
  | "residential"
  | "dormitory"
  | "lodging"
  | "sports"
  | "dining"
  | "library"
  | "medical"
  | "parking"
  | "landmark"
  | "religious"
  | "utility"
  | "commercial"
  | "transportation"
  | "atm"
  | "other";

type PinAsset = {
  html: string;
  className: string;
  iconSize: [number, number];
  iconAnchor: [number, number];
  tooltipAnchor: [number, number];
};

const PIN_SIZE: [number, number] = [42, 46]; // Slightly smaller pins for better map density
const PIN_ANCHOR: [number, number] = [21, 44]; // Anchor at the pin tip (width/2, height-2)
const TOOLTIP_ANCHOR: [number, number] = [0, -44];

// Centralize the icon paths. All icons are designed for a 24x24 grid, centered in the map pin.
const PIN_LIBRARY: Record<PinId, { path: string; scale?: number; translateY?: number }> = {
  academic: {
    // Graduation Cap
    path: "M12 3L1 9l11 6 9-4.91V17h2V9M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z",
  },
  administrative: {
    // Building with columns
    path: "M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm6 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V9h2v2zm6 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V9h2v2z",
    scale: 0.9,
  },
  research: {
    // Science Flask
    path: "M19.8 18.4L14 10.67V6.5l1.35-1.69c.26-.33.03-.81-.39-.81H9.04c-.42 0-.65.48-.39.81L10 6.5v4.17L4.2 18.4c-.49.66-.02 1.6.8 1.6h14c.82 0 1.29-.94.8-1.6z",
  },
  office: {
    // Briefcase
    path: "M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z",
    scale: 0.9,
  },
  residential: {
    // House
    path: "M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z",
    scale: 0.9,
  },
  dormitory: {
    // Bed icon for Dormitory
    path: "M7 13c1.66 0 3-1.34 3-3S8.66 7 7 7s-3 1.34-3 3 1.34 3 3 3zm12-6h-8v7H3V5H1v15h2v-3h18v3h2v-9c0-2.21-1.79-4-4-4z",
    scale: 0.85,
    translateY: 2,
  },
  lodging: {
    // Key icon for Lodging
    path: "M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z",
    scale: 0.85,
    translateY: 1,
  },
  sports: {
    // Basketball (easier to recognize than soccer at small sizes)
    path: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 12.65l1.32 5.05.66 1.96-1.78.04zm9.32-3.13l-3.32-2.34-1.19-4.22 2.65-2.46 3.65 1.73c-1.39 3.03-3.6 5.56-1.79 7.29zm-7.61-9.69L9.75 4.58c.7-.19 1.45-.29 2.25-.29.58 0 1.13.07 1.66.18l-1.95 3.64-3.16.89z",
    scale: 0.9,
  },
  dining: {
    // Restaurant (Fork & Knife)
    path: "M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z",
    scale: 0.85,
  },
  library: {
    // Book / Local Library
    // path: "M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm-9 3V9l7-4 7 4v2c0 2.21-1.79 4-4 4s-4-1.79-4-4zm15.65-2.26l-1.65.94V9l2.5-1.44zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z", 
    // Wait, replacing with a simpler book icon
    path: "M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z",
  },
  medical: {
    // Cross / Health
    path: "M19 3H5c-1.1 0-1.99.9-1.99 2L3 19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 11h-4v4h-4v-4H6v-4h4V6h4v4h4v4z",
  },
  parking: {
    // P symbol
    // path: "M13.2 12H10v3h4.2c2 0 3.6-1.6 3.6-3.6V9.6c0-2-1.6-3.6-3.6-3.6h-7.8v12h3.6V12zm0-3.6c.2 0 .4.2.4.4v1.2c0 .2-.2.4-.4.4H13c-.2 0-.4-.2-.4-.4V8.8c0-.2.2-.4.4-.4h.2zM6 2h12c2.2 0 4 1.8 4 4v12c0 2.2-1.8 4-4 4H6c-2.2 0-4-1.8-4-4V6c0-2.2 1.8-4 4-4z", 
    // Actually simpler P
    path: "M10 6.5h3c2.5 0 4.5 2 4.5 4.5s-2 4.5-4.5 4.5H10v6.5H6V6.5h4zm0 6h3c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5h-3v3z",
    translateY: 1,
  },
  landmark: {
    // Star
    path: "M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z",
  },
  religious: {
    // Christian Cross
    path: "M11 2v7H4v4h7v9h4v-9h7V9h-7V2z",
    scale: 0.85,
    translateY: 0,
  },
  utility: {
    // Gear / Construction
    path: "M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L3.16 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.04.24.24.41.48.41h3.84c.24 0 .43-.17.47-.41l.36-2.54c.59-.24 1.13-.57 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.08-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z",
  },
  commercial: {
    // Store
    path: "M20 4H4v2h16V4zm1 10v-2l-1-5H4l-1 5v2h1v6h10v-6h4v6h2v-6h1zm-9 4H6v-4h6v4z",
  },
  transportation: {
    // Bus
    path: "M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z",
  },
  atm: {
    // Dollar Sign
    path: "M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z",
  },
  other: {
    // Ellipsis / More Horizontal (three dots)
    path: "M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z",
  },
};

const FACILITY_CATEGORY_TO_PIN: Record<FacilityCategory, PinId> = {
  academic: "academic",
  administrative: "administrative",
  research: "research",
  office: "office",
  residential: "residential",
  dormitory: "dormitory",
  lodging: "lodging",
  sports: "sports",
  dining: "dining",
  library: "library",
  medical: "medical",
  parking: "parking",
  landmark: "landmark",
  religious: "religious",
  utility: "utility",
  commercial: "commercial",
  transportation: "transportation",
  atm: "atm",
  other: "other",
};

export function getPinAssetForCategory(
  category: FacilityCategory,
  options: { selected?: boolean; minimized?: boolean; label?: string } = {}
): PinAsset {
  const pinId = FACILITY_CATEGORY_TO_PIN[category] ?? "office";
  const pinDef = PIN_LIBRARY[pinId] ?? PIN_LIBRARY.office;
  const color = getCategoryColor(category);

  if (options.minimized && !options.selected) {
    const dotSize = 12;
    const padding = 2;
    const totalSize = dotSize + padding * 2;
    const html = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${totalSize}" height="${totalSize}" viewBox="0 0 ${totalSize} ${totalSize}">
        <circle 
          cx="${totalSize / 2}" 
          cy="${totalSize / 2}" 
          r="${dotSize / 2}" 
          fill="${color}" 
          stroke="#ffffff" 
          stroke-width="1.5"
        />
      </svg>
    `;
    return {
      html,
      className: `vsu-pin-dot pin-${category}`,
      iconSize: [totalSize, totalSize],
      iconAnchor: [totalSize / 2, totalSize / 2],
      tooltipAnchor: [0, -totalSize / 2],
    };
  }

  const scale = pinDef.scale ?? 1;
  const translateY = pinDef.translateY ?? 0;

  const pinPath = "M32 2C20.95 2 12 10.95 12 22c0 11 9 21 20 40 11-19 20-29 20-40 0-11.05-8.95-20-20-20z";

  const selectedRing = options.selected
    ? `<circle cx="32" cy="22" r="23" fill="none" stroke="#FFB81C" stroke-width="3" />`
    : "";

  const [pinWidth, pinHeight] = PIN_SIZE;

  // ViewBox expanded: -4 on y to account for ring top, height becomes 70
  const pinSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${pinWidth}" height="${pinHeight}" viewBox="0 -4 64 70" class="pin-svg">
      ${selectedRing}
      <path 
        d="${pinPath}" 
        fill="${color}" 
        stroke="#ffffff" 
        stroke-width="${options.selected ? 2 : 1.5}"
      />
      <g transform="translate(32, 22) scale(${1.15 * scale}) translate(-12, -12) translate(0, ${translateY})" fill="white">
        <path d="${pinDef.path}"/>
      </g>
    </svg>
  `;

  if (options.label) {
    const html = `
      <div class="vsu-pin-with-label">
        ${pinSvg}
        <span class="vsu-pin-label">${escapeHtml(options.label)}</span>
      </div>
    `;
    return {
      html,
      className: `vsu-pin-container pin-${category}${options.selected ? " pin-selected" : ""}`,
      iconSize: [300, pinHeight], // Room for wrapped labels
      iconAnchor: [21, 44], // Default pin anchor (center-bottom of the SVG at the left)
      tooltipAnchor: [0, TOOLTIP_ANCHOR[1]],
    };
  }

  return {
    html: pinSvg,
    className: `vsu-pin pin-${category}${options.selected ? " pin-selected" : ""}`,
    iconSize: PIN_SIZE,
    iconAnchor: PIN_ANCHOR,
    tooltipAnchor: TOOLTIP_ANCHOR,
  };
}

const BOARDING_HOUSE_PILL_COLOR = "#059669"; // emerald-600, matches boarding-house brand
const BOARDING_HOUSE_PILL_COLOR_SELECTED = "#047857"; // emerald-700
const BOARDING_HOUSE_HOME_GLYPH =
  "M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"; // same house path as residential pin

export function getBoardingHousePinAsset(
  options: {
    priceMin: number | null;
    name?: string;
    selected?: boolean;
    minimized?: boolean;
  } = { priceMin: null },
): PinAsset {
  const color = options.selected
    ? BOARDING_HOUSE_PILL_COLOR_SELECTED
    : BOARDING_HOUSE_PILL_COLOR;
  const priceLabel = formatBoardingHousePinPrice(options.priceMin);
  const ariaLabel = escapeHtml(
    options.name
      ? priceLabel
        ? `${options.name} — ${priceLabel} per month`
        : `${options.name} — boarding house`
      : priceLabel
        ? `Boarding house ${priceLabel} per month`
        : "Boarding house",
  );

  // Minimized (low zoom): compact home dot, visually distinct from facility dots.
  if (options.minimized && !options.selected) {
    const size = 18;
    const inner = 11;
    const html = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" role="img" aria-label="${ariaLabel}">
        <circle cx="12" cy="12" r="11" fill="${color}" stroke="#ffffff" stroke-width="2" />
        <g transform="translate(12, 12) scale(${inner / 24}) translate(-12, -12)" fill="#ffffff">
          <path d="${BOARDING_HOUSE_HOME_GLYPH}" />
        </g>
      </svg>
    `;
    return {
      html,
      className: "vsu-bh-pin",
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      tooltipAnchor: [0, -size / 2],
    };
  }

  const ringStyle = options.selected
    ? "box-shadow:0 0 0 3px rgba(5,150,105,0.35),0 2px 6px rgba(0,0,0,0.3);"
    : "box-shadow:0 1px 4px rgba(0,0,0,0.3);";

  // Price pill or home glyph fallback, rendered with inline styles so it is not
  // affected by CSS purging. Distinct rounded-rect tag shape vs facility teardrops.
  // When there is no price, the pill shows only the leading home glyph below —
  // do NOT add a second house here (that produced the "two houses" marker).
  const content = priceLabel
    ? `<span style="font-size:12px;font-weight:700;line-height:1;white-space:nowrap">${escapeHtml(priceLabel)}</span>`
    : "";

  const pillHeight = 26;
  const paddingX = priceLabel ? 9 : 7;
  // Approximate width so Leaflet can anchor the tip; the inner div is auto-width.
  const approxWidth = priceLabel
    ? Math.max(48, paddingX * 2 + priceLabel.length * 7.5 + 16)
    : pillHeight + 10;

  const html = `
    <div role="img" aria-label="${ariaLabel}" style="display:flex;flex-direction:column;align-items:center;pointer-events:auto">
      <div style="display:flex;align-items:center;gap:4px;height:${pillHeight}px;padding:0 ${paddingX}px;border-radius:9999px;background:${color};color:#ffffff;border:2px solid #ffffff;${ringStyle}">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="flex:none"><path d="${BOARDING_HOUSE_HOME_GLYPH}" /></svg>
        ${content}
      </div>
      <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid ${color};margin-top:-1px"></div>
    </div>
  `;

  const totalHeight = pillHeight + 6;
  return {
    html,
    className: `vsu-bh-pin${options.selected ? " vsu-bh-pin-selected" : ""}`,
    iconSize: [approxWidth, totalHeight],
    iconAnchor: [approxWidth / 2, totalHeight],
    tooltipAnchor: [0, -totalHeight],
  };
}
