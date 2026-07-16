import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
let supabaseHost: string | undefined;

if (supabaseUrl && typeof supabaseUrl === "string") {
  try {
    supabaseHost = new URL(supabaseUrl).hostname;
  } catch (error) {
    console.warn("Invalid NEXT_PUBLIC_SUPABASE_URL format. Expected a valid URL, got:", supabaseUrl, error);
  }
}

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
  images: {
    remotePatterns: supabaseHost
      ? [
        {
          protocol: "https",
          hostname: supabaseHost,
        },
      ]
      : [],
  },
};

export default withBundleAnalyzer(nextConfig);
