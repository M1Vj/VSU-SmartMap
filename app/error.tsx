'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { AlertCircle, WifiOff, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { captureClientLogEvent } from '@/components/observability/app-logging-provider'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [isOffline, setIsOffline] = useState(false);
  const isChunkError = error.message?.includes('chunk') || error.message?.includes('module');

  useEffect(() => {
    console.error(error);
    captureClientLogEvent({
      level: "fatal",
      eventName: "next.route_error",
      message: error.message || "Route error boundary rendered",
      metadata: {
        name: error.name,
        digest: error.digest,
        stack: error.stack,
      },
    });
    setIsOffline(!navigator.onLine);

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [error]);

  const handleReload = () => {
    window.location.reload();
  };

  if (isOffline || isChunkError) {
    return (
      <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center gap-4 text-center px-4">
        <div className="rounded-full bg-amber-500/10 p-4">
          <WifiOff className="h-8 w-8 text-amber-500" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">You&apos;re Offline</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Some content couldn&apos;t be loaded. Please check your internet connection and try again.
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={handleReload} variant="default">
            <RefreshCw className="h-4 w-4 mr-2" />
            Reload Page
          </Button>
          <Button asChild variant="outline">
            <Link href="/offline">View Offline</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center gap-4 text-center">
      <div className="rounded-full bg-destructive/10 p-4">
        <AlertCircle className="h-8 w-8 text-destructive" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Something went wrong!</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          {error.message || "An unexpected error occurred."}
        </p>
      </div>
      <Button
        onClick={() => reset()}
      >
        Try again
      </Button>
    </div>
  )
}
