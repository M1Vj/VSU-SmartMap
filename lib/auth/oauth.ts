"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

export async function signInWithGoogle(next: string = "/owner"): Promise<void> {
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
