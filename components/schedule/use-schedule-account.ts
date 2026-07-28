"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";

import { signInWithGoogle } from "@/lib/auth/oauth";
import { db } from "@/lib/db";
import { removeLocalScheduleAccountData } from "@/lib/schedule/account-local-data";
import { accountScheduleScope, GUEST_SCHEDULE_SCOPE, type ScheduleScope } from "@/lib/schedule/scope";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

const CONSENT_INTENT_KEY = "vsu.schedule.sync-consent-intent";
const GENERIC_AUTH_ERROR = "Google sign-in is unavailable. Please try again.";

export type ScheduleAccountState =
  | { kind: "loading" }
  | { kind: "guest" }
  | {
      kind: "authenticated";
      userId: string;
      email?: string;
      offlineVerified: boolean;
    };

function authenticated(user: User, offlineVerified: boolean): ScheduleAccountState {
  return {
    kind: "authenticated",
    userId: user.id,
    ...(user.email ? { email: user.email } : {}),
    offlineVerified,
  };
}

export function useScheduleAccount(enabled: boolean) {
  const [account, setAccount] = useState<ScheduleAccountState>(
    enabled ? { kind: "loading" } : { kind: "guest" },
  );
  const [consentEnabled, setConsentEnabled] = useState(false);
  const [authError, setAuthError] = useState("");
  const generation = useRef(0);

  const loadConsent = useCallback(async (state: ScheduleAccountState) => {
    if (state.kind !== "authenticated") {
      setConsentEnabled(false);
      return;
    }
    const scope = accountScheduleScope(state.userId);
    const intent = sessionStorage.getItem(CONSENT_INTENT_KEY) === "pending";
    const row = await db.schedule_sync_state.get(scope);
    if (intent && state.offlineVerified) {
      await db.schedule_sync_state.put({ ...row, scope, consentEnabled: true });
      sessionStorage.removeItem(CONSENT_INTENT_KEY);
      setConsentEnabled(true);
      return;
    }
    setConsentEnabled(row?.consentEnabled === true);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setAccount({ kind: "guest" });
      setConsentEnabled(false);
      return;
    }
    const search = new URLSearchParams(window.location.search);
    if (
      search.get("auth_error") === "oauth" ||
      search.get("error") === "oauth"
    ) {
      sessionStorage.removeItem(CONSENT_INTENT_KEY);
      setAuthError("Google sign-in failed. Please try again. Your local schedule is unchanged.");
    }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      setAccount({ kind: "guest" });
      setAuthError(GENERIC_AUTH_ERROR);
      return;
    }

    const client = getSupabaseBrowserClient();
    let alive = true;
    const resolve = async (cachedUser?: User) => {
      const current = ++generation.current;
      let next: ScheduleAccountState = { kind: "guest" };
      try {
        const { data, error } = await client.auth.getUser();
        if (error) throw error;
        if (data.user) next = authenticated(data.user, true);
      } catch {
        try {
          const user =
            cachedUser ??
            (await client.auth.getSession()).data.session?.user;
          if (user) next = authenticated(user, false);
        } catch {
          next = { kind: "guest" };
          setAuthError(GENERIC_AUTH_ERROR);
        }
      }
      if (!alive || current !== generation.current) return;
      setAccount(next);
      await loadConsent(next);
    };
    void resolve();
    const { data: listener } = client.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
      void resolve(session?.user);
      },
    );
    return () => {
      alive = false;
      generation.current += 1;
      listener.subscription.unsubscribe();
    };
  }, [enabled, loadConsent]);

  const scope: ScheduleScope =
    account.kind === "authenticated"
      ? accountScheduleScope(account.userId)
      : GUEST_SCHEDULE_SCOPE;

  const startGoogleSignIn = useCallback(async () => {
    setAuthError("");
    sessionStorage.setItem(CONSENT_INTENT_KEY, "pending");
    try {
      await signInWithGoogle("/schedule");
    } catch {
      sessionStorage.removeItem(CONSENT_INTENT_KEY);
      setAuthError(GENERIC_AUTH_ERROR);
    }
  }, []);

  const enableConsent = useCallback(async () => {
    if (account.kind !== "authenticated" || !account.offlineVerified) return;
    const accountScope = accountScheduleScope(account.userId);
    const row = await db.schedule_sync_state.get(accountScope);
    await db.schedule_sync_state.put({
      ...row,
      scope: accountScope,
      consentEnabled: true,
    });
    setConsentEnabled(true);
  }, [account]);

  const signOut = useCallback(async () => {
    setAccount({ kind: "guest" });
    setConsentEnabled(false);
    generation.current += 1;
    try {
      await getSupabaseBrowserClient().auth.signOut();
    } catch {
      setAuthError("Sign out could not be completed. Please try again.");
    }
  }, []);

  const removeLocalData = useCallback(async (expectedScope: ScheduleScope) => {
    if (
      account.kind !== "authenticated" ||
      accountScheduleScope(account.userId) !== expectedScope
    ) return;
    await removeLocalScheduleAccountData(db, expectedScope);
    setConsentEnabled(false);
  }, [account]);

  return {
    account,
    scope,
    consentEnabled: enabled && consentEnabled,
    authError,
    clearAuthError: () => setAuthError(""),
    startGoogleSignIn,
    enableConsent,
    signOut,
    removeLocalData,
  };
}
