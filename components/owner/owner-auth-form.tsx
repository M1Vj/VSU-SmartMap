"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { signInWithGoogle } from "@/lib/auth/oauth";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function GoogleIcon() {
  return (
    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.46 1.46 14.97.5 12 .5A11 11 0 0 0 2.18 7.05l3.66 2.84c.87-2.6 3.3-4.14 6.16-4.14z"
      />
    </svg>
  );
}

export function OwnerAuthForm() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (searchParams.get("error") === "oauth") {
      setError("Google sign-in failed. Please try again.");
    }
  }, [searchParams]);

  async function handleGoogleSignIn() {
    setError("");
    setLoading(true);
    try {
      await signInWithGoogle("/owner");
    } catch {
      setError("Unable to start Google sign-in. Please try again.");
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md shadow-sm">
      <CardHeader>
        <CardTitle>Owner sign in</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-6 text-muted-foreground">
          Owners sign in with their Google account. No password to remember.
        </p>
        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        <Button
          type="button"
          variant="outline"
          className="w-full rounded-full"
          loading={loading}
          onClick={handleGoogleSignIn}
        >
          {!loading && <GoogleIcon />}
          {loading ? "Redirecting..." : "Continue with Google"}
        </Button>
      </CardContent>
    </Card>
  );
}
