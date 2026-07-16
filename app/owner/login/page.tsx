import { Suspense } from "react";
import Link from "next/link";

import { OwnerAuthForm } from "@/components/owner/owner-auth-form";

export default function OwnerLoginPage() {
  return (
    <main className="min-h-[100dvh] bg-muted/30 px-4 py-8">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-5xl flex-col items-center justify-center gap-6">
        <div className="max-w-md text-center">
          <Link href="/" className="text-sm font-semibold text-primary">
            Campus SmartMap
          </Link>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">Boarding house owner portal</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Apply for verification, manage listings, and keep student-facing information current.
          </p>
        </div>
        <Suspense fallback={null}>
          <OwnerAuthForm />
        </Suspense>
      </div>
    </main>
  );
}
