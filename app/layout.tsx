import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "next-themes";
import { ptSans, sourceCodePro } from "@/lib/typography";
import { SkipLink } from "@/components/skip-link";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
import { NavigationProgress } from "@/components/navigation-progress";
import { Toaster } from "@/components/ui/sonner";
import { TourNudge } from "@/components/help/tour-nudge";
import { MapStyleProvider } from "@/lib/context/map-style-context";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/react";
import { SyncProvider } from "@/components/providers/sync-provider";
import { AppLoggingProvider } from "@/components/observability/app-logging-provider";
import { SITE_DESCRIPTION, SITE_TITLE } from "@/lib/seo";
import "./globals.css";

const appUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.VERCEL_PROJECT_PRODUCTION_URL ??
  "https://vsu-smartmap.vercel.app";

const defaultUrl = appUrl.startsWith("http") ? appUrl : `https://${appUrl}`;
const shouldEnableVercelAnalytics = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#166534",
};

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_TITLE}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_TITLE,
  generator: "Next.js",
  publisher: SITE_TITLE,
  manifest: "/manifest.json",
  alternates: {
    canonical: defaultUrl,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: SITE_TITLE,
  },
  icons: {
    icon: [
      { url: "/favicon.ico?v=20260709", sizes: "any" },
      { url: "/icons/icon-192x192.png?v=20260709", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png?v=20260709", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png?v=20260709",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: defaultUrl,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    siteName: SITE_TITLE,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Campus SmartMap for VSU preview with an unofficial student-led campus map disclaimer",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/og-image.png"],
  },
  verification: {
    google: "QEaVt0p58N8prtIVnsV9aIZV3Ezp_Q1JycBe2A81hR8",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${ptSans.variable} ${sourceCodePro.variable} antialiased`} suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <MapStyleProvider>
            <SyncProvider>
              <Script
                src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
                strategy="afterInteractive"
              />
              <NavigationProgress />
              <Toaster />
              <TourNudge />
              <ServiceWorkerRegistration />
              <AppLoggingProvider />
              <SkipLink />
              {children}
            </SyncProvider>
            {shouldEnableVercelAnalytics && <Analytics />}
          </MapStyleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
