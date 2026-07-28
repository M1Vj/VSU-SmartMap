export type OAuthNext = "/schedule" | "/owner";

const OAUTH_RETURN_PATHS = new Set<OAuthNext>(["/schedule", "/owner"]);
const DUMMY_ORIGIN = "https://oauth-return.invalid";
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const ENCODED_SEPARATOR = /%(?:2f|5c)/i;

export function safeOauthNext(value: string | null): OAuthNext | "/" {
  if (
    !value ||
    value.includes("\\") ||
    value.includes("?") ||
    value.includes("#") ||
    CONTROL_CHARACTERS.test(value) ||
    ENCODED_SEPARATOR.test(value)
  ) {
    return "/";
  }

  try {
    const parsed = new URL(value, DUMMY_ORIGIN);
    if (
      parsed.origin !== DUMMY_ORIGIN ||
      parsed.search ||
      parsed.hash ||
      parsed.pathname !== value ||
      !OAUTH_RETURN_PATHS.has(parsed.pathname as OAuthNext)
    ) {
      return "/";
    }

    return parsed.pathname as OAuthNext;
  } catch {
    return "/";
  }
}

export function oauthFailurePath(next: OAuthNext | "/"): string {
  return next === "/schedule"
    ? "/schedule?auth_error=oauth"
    : "/owner/login?error=oauth";
}
