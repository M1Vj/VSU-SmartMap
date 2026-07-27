export const SITE_TITLE = "Campus SmartMap for VSU";

export const SITE_DESCRIPTION =
  "Unofficial student-led campus map for Visayas State University, with building search, facility details, events, and walking directions.";

// One origin for metadataBase, robots.txt and the sitemap. These were three
// copies of the same fallback chain and they had already drifted: layout.tsx
// was corrected while robots.ts and sitemap.ts still advertised
// vsu-smartmap.vercel.app, a host that has never belonged to this project. A
// mismatch here is not cosmetic - canonical URLs, the advertised sitemap and
// og:image would each claim a different origin.
//
// The explicit variable wins because VERCEL_PROJECT_PRODUCTION_URL reports
// whichever domain is attached to the project, which is not necessarily one
// that resolves. It pointed at a subdomain whose DNS records had been deleted,
// which is what turned every shared link into a blank preview card.
export function resolveSiteUrl(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): string {
  const configured =
    env.NEXT_PUBLIC_SITE_URL ||
    env.VERCEL_PROJECT_PRODUCTION_URL ||
    "https://vsumap.vercel.app";
  const withScheme = configured.startsWith("http") ? configured : `https://${configured}`;
  return withScheme.replace(/\/+$/, "");
}

export const SITE_URL = resolveSiteUrl();
