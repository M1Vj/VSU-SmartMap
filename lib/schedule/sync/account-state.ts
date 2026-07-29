import type { ScheduleSyncState } from "../local-types";
import type { ScheduleScope } from "../scope";

export type ScheduleAuthUser = { id: string; email?: string };

export type ScheduleAccountState =
  | { kind: "loading" }
  | { kind: "guest"; authRequired?: boolean }
  | {
      kind: "authenticated";
      userId: string;
      email?: string;
      offlineVerified: boolean;
    };

export interface ScheduleAuthAdapter {
  getUser(): Promise<{ user?: ScheduleAuthUser | null; error?: unknown }>;
  getSessionUser(): Promise<ScheduleAuthUser | undefined>;
}

function authenticated(
  user: ScheduleAuthUser,
  offlineVerified: boolean,
): ScheduleAccountState {
  return {
    kind: "authenticated",
    userId: user.id,
    ...(user.email ? { email: user.email } : {}),
    offlineVerified,
  };
}

function connectivityFailure(error: unknown, online: boolean): boolean {
  if (!online) return true;
  if (error instanceof TypeError) return true;
  if (typeof error !== "object" || error === null) return false;
  const name = (error as { name?: unknown }).name;
  return (
    name === "AuthRetryableFetchError" ||
    name === "FetchError" ||
    name === "NetworkError"
  );
}

function missingSession(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: unknown }).name === "AuthSessionMissingError"
  );
}

export function isScheduleSupabasePublicConfigValid(
  url: string | undefined,
  key: string | undefined,
): boolean {
  if (
    !url ||
    url !== url.trim() ||
    !key ||
    key !== key.trim()
  ) return false;
  try {
    const parsed = new URL(url);
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      Boolean(parsed.hostname)
    );
  } catch {
    return false;
  }
}

export function createScheduleAuthClient<T>(
  url: string | undefined,
  key: string | undefined,
  factory: () => T,
): { kind: "ready"; client: T } | { kind: "unavailable" } {
  if (!isScheduleSupabasePublicConfigValid(url, key)) {
    return { kind: "unavailable" };
  }
  try {
    return { kind: "ready", client: factory() };
  } catch {
    return { kind: "unavailable" };
  }
}

export async function resolveScheduleAuth(
  enabled: boolean,
  adapter: ScheduleAuthAdapter,
  online: boolean,
): Promise<ScheduleAccountState> {
  if (!enabled) return { kind: "guest" };
  let result: Awaited<ReturnType<ScheduleAuthAdapter["getUser"]>>;
  try {
    result = await adapter.getUser();
  } catch (error) {
    result = { error };
  }
  if (!result.error) {
    return result.user
      ? authenticated(result.user, true)
      : { kind: "guest" };
  }
  if (!result.user && missingSession(result.error)) {
    return { kind: "guest" };
  }
  if (!connectivityFailure(result.error, online)) {
    return { kind: "guest", authRequired: true };
  }
  try {
    const cached = await adapter.getSessionUser();
    return cached
      ? authenticated(cached, false)
      : { kind: "guest" };
  } catch {
    return { kind: "guest" };
  }
}

export type ScheduleAccountGeneration = ReturnType<
  typeof createScheduleAccountGeneration
>;

export function createScheduleAccountGeneration() {
  let generation = 0;
  let scope: ScheduleScope | undefined;
  return {
    begin(nextScope: ScheduleScope) {
      scope = nextScope;
      generation += 1;
      return generation;
    },
    invalidate() {
      scope = undefined;
      generation += 1;
    },
    isCurrent(token: number, expectedScope: ScheduleScope) {
      return token === generation && expectedScope === scope;
    },
  };
}

export async function readScopedScheduleConsent(
  scope: ScheduleScope,
  token: number,
  gate: ScheduleAccountGeneration,
  get: (scope: ScheduleScope) => Promise<Pick<ScheduleSyncState, "consentEnabled"> | undefined>,
): Promise<boolean | undefined> {
  const row = await get(scope);
  if (!gate.isCurrent(token, scope)) return undefined;
  return row?.consentEnabled === true;
}

export async function writeScopedScheduleConsent(
  scope: ScheduleScope,
  token: number,
  gate: ScheduleAccountGeneration,
  store: {
    get(scope: ScheduleScope): Promise<Partial<ScheduleSyncState> | undefined>;
    put(row: ScheduleSyncState): Promise<unknown>;
  },
): Promise<boolean> {
  if (!gate.isCurrent(token, scope)) return false;
  const row = await store.get(scope);
  if (!gate.isCurrent(token, scope)) return false;
  await store.put({ ...row, scope, consentEnabled: true });
  return gate.isCurrent(token, scope);
}

export async function signOutGuestFirst(
  publishGuest: () => void,
  signOut: () => Promise<unknown>,
): Promise<void> {
  publishGuest();
  await signOut();
}
