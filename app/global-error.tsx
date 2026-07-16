'use client'

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { captureClientLogEvent } from "@/components/observability/app-logging-provider"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
    captureClientLogEvent({
      level: "fatal",
      eventName: "next.global_error",
      message: error.message || "Global error boundary rendered",
      metadata: {
        name: error.name,
        digest: error.digest,
        stack: error.stack,
      },
    })
  }, [error])

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex h-screen flex-col items-center justify-center gap-4 text-center">
        <h2 className="text-2xl font-bold">Something went wrong!</h2>
        <Button onClick={() => reset()}>Try again</Button>
      </body>
    </html>
  )
}
