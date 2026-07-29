"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import type { OAuthNext } from "@/lib/auth/oauth-return";

export async function signInWithGoogle(next: OAuthNext): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  await supabase.auth.signOut();
}
