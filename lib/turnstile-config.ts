export const TEST_TURNSTILE_SITE_KEY = "1x00000000000000000000AA";

interface TurnstileSiteKeyOptions {
  configuredKey?: string;
  hostname?: string;
  nodeEnv?: string;
}

export function isLocalHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export function resolveTurnstileSiteKey({
  configuredKey,
  hostname,
  nodeEnv,
}: TurnstileSiteKeyOptions): string | null {
  if (nodeEnv !== "production" || (hostname && isLocalHostname(hostname))) {
    return TEST_TURNSTILE_SITE_KEY;
  }

  if (
    configuredKey &&
    configuredKey !== "your-turnstile-site-key" &&
    !configuredKey.includes("placeholder")
  ) {
    return configuredKey;
  }

  return null;
}
