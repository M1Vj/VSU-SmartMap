import { WifiOff } from "lucide-react";
import { CachedMapButton } from "@/components/cached-map-button";
import { RetryButton } from "@/components/retry-button";
import { SiteCredit } from "@/components/layout/site-credit";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Offline",
  description: "You are currently offline. Some features may be unavailable.",
};

export default function OfflinePage() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-gradient-to-b from-background to-muted">
      <main className="flex flex-1 flex-col items-center justify-center p-6 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-muted">
          <WifiOff className="h-12 w-12 text-muted-foreground" aria-hidden={true} />
        </div>

        <h1 className="mt-8 text-2xl font-bold text-foreground">
          You&apos;re Offline
        </h1>

        <p className="mt-4 max-w-md text-muted-foreground">
          It looks like you&apos;ve lost your internet connection.
          Some features may be unavailable, but you can still view
          previously cached map areas.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <CachedMapButton />
          <RetryButton />
        </div>

        <p className="mt-8 text-sm text-muted-foreground">
          Tip: Map tiles you&apos;ve viewed before are saved for offline use.
        </p>
      </main>
      <SiteCredit reserveMobileNavigation={false} />
    </div>
  );
}
