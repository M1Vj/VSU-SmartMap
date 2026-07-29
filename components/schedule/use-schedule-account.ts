"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

import { signInWithGoogle } from "@/lib/auth/oauth";
import { db } from "@/lib/db";
import { removeLocalScheduleAccountData } from "@/lib/schedule/account-local-data";
import { accountScheduleScope, GUEST_SCHEDULE_SCOPE, type ScheduleScope } from "@/lib/schedule/scope";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import {
  createScheduleAuthClient,
  createScheduleAccountGeneration,
  readScopedScheduleConsent,
  resolveScheduleAuth,
  signOutGuestFirst,
  writeScopedScheduleConsent,
  type ScheduleAccountState,
} from "@/lib/schedule/sync/account-state";

const GENERIC_AUTH_ERROR = "Google sign-in is unavailable. Please try again.";

export type { ScheduleAccountState } from "@/lib/schedule/sync/account-state";

export function useScheduleAccount(enabled: boolean) {
  const [account, setAccount] = useState<ScheduleAccountState>(
    enabled ? { kind: "loading" } : { kind: "guest" },
  );
  const [consentEnabled, setConsentEnabled] = useState(false);
  const [authError, setAuthError] = useState("");
  const authErrorKind = useRef<"none" | "oauth" | "auth" | "unavailable" | "signout">("none");
  const authGeneration = useRef(0);
  const consentGeneration = useRef(createScheduleAccountGeneration());
  const consentToken = useRef(0);

  useEffect(() => {
    if (!enabled) {
      authGeneration.current += 1;
      consentGeneration.current.invalidate();
      setAccount({ kind: "guest" });
      setConsentEnabled(false);
      return;
    }
    const search = new URLSearchParams(window.location.search);
    if (
      search.get("auth_error") === "oauth" ||
      search.get("error") === "oauth"
    ) {
      authErrorKind.current = "oauth";
      setAuthError("Google sign-in failed. Please try again. Your local schedule is unchanged.");
    }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const clientResult = createScheduleAuthClient(
      url,
      key,
      getSupabaseBrowserClient,
    );
    if (clientResult.kind === "unavailable") {
      setAccount({ kind: "guest" });
      authErrorKind.current = "unavailable";
      setAuthError(GENERIC_AUTH_ERROR);
      return;
    }

    const client = clientResult.client;
    const consentGate = consentGeneration.current;
    let alive = true;
    const resolve = async (cachedSession?: Session | null) => {
      const current = ++authGeneration.current;
      consentGate.invalidate();
      setConsentEnabled(false);
      setAccount({ kind: "loading" });
      const next = await resolveScheduleAuth(
        true,
        {
          async getUser() {
            const { data, error } = await client.auth.getUser();
            return { user: data.user, error };
          },
          async getSessionUser() {
            return (
              cachedSession?.user ??
              (await client.auth.getSession()).data.session?.user
            );
          },
        },
        navigator.onLine,
      );
      if (!alive || current !== authGeneration.current) return;
      setAccount(next);
      if (next.kind !== "authenticated") {
        consentGate.invalidate();
        if (next.kind === "guest" && next.authRequired) {
          authErrorKind.current = "auth";
          setAuthError("Your Google session needs to be verified again.");
        } else if (authErrorKind.current === "auth") {
          authErrorKind.current = "none";
          setAuthError("");
        }
        return;
      }
      if (authErrorKind.current === "auth") {
        authErrorKind.current = "none";
        setAuthError("");
      }
      const nextScope = accountScheduleScope(next.userId);
      const token = consentGate.begin(nextScope);
      consentToken.current = token;
      const consent = await readScopedScheduleConsent(
        nextScope,
        token,
        consentGate,
        (scope) => db.schedule_sync_state.get(scope),
      );
      if (
        !alive ||
        current !== authGeneration.current ||
        consent === undefined
      ) return;
      setConsentEnabled(consent);
    };
    void resolve();
    const { data: listener } = client.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        void resolve(session);
      },
    );
    return () => {
      alive = false;
      authGeneration.current += 1;
      consentGate.invalidate();
      listener.subscription.unsubscribe();
    };
  }, [enabled]);

  const scope: ScheduleScope =
    account.kind === "authenticated"
      ? accountScheduleScope(account.userId)
      : GUEST_SCHEDULE_SCOPE;

  const startGoogleSignIn = useCallback(async () => {
    authErrorKind.current = "none";
    setAuthError("");
    try {
      await signInWithGoogle("/schedule");
    } catch {
      authErrorKind.current = "unavailable";
      setAuthError(GENERIC_AUTH_ERROR);
    }
  }, []);

  const enableConsent = useCallback(async () => {
    if (account.kind !== "authenticated" || !account.offlineVerified) return;
    const accountScope = accountScheduleScope(account.userId);
    const updated = await writeScopedScheduleConsent(
      accountScope,
      consentToken.current,
      consentGeneration.current,
      db.schedule_sync_state,
    );
    if (updated) setConsentEnabled(true);
  }, [account]);

  const signOut = useCallback(async () => {
    try {
      await signOutGuestFirst(
        () => {
          setAccount({ kind: "guest" });
          setConsentEnabled(false);
          authGeneration.current += 1;
          consentGeneration.current.invalidate();
          if (authErrorKind.current === "auth") {
            authErrorKind.current = "none";
            setAuthError("");
          }
        },
        () => getSupabaseBrowserClient().auth.signOut(),
      );
    } catch {
      authErrorKind.current = "signout";
      setAuthError("Sign out could not be completed. Please try again.");
    }
  }, []);

  const removeLocalData = useCallback(async (expectedScope: ScheduleScope) => {
    if (
      account.kind !== "authenticated" ||
      accountScheduleScope(account.userId) !== expectedScope
    ) return;
    await removeLocalScheduleAccountData(db, expectedScope);
    if (
      consentGeneration.current.isCurrent(
        consentToken.current,
        expectedScope,
      )
    ) {
      setConsentEnabled(false);
    }
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
