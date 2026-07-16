import type { MetadataRoute } from "next";

const appUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.VERCEL_PROJECT_PRODUCTION_URL ??
  "https://vsu-smartmap.vercel.app";

const siteUrl = appUrl.startsWith("http") ? appUrl : `https://${appUrl}`;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return ["", "/directory", "/events", "/chat", "/info"].map((path) => ({
    url: `${siteUrl}${path}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: path === "" ? 1 : 0.7,
  }));
}
