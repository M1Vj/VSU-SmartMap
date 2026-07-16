import type { MetadataRoute } from "next";

const appUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.VERCEL_PROJECT_PRODUCTION_URL ??
  "https://vsu-smartmap.vercel.app";

const siteUrl = appUrl.startsWith("http") ? appUrl : `https://${appUrl}`;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/admin/",
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
