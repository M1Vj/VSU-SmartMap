declare const boardingHouseOAuthNextBrand: unique symbol;

export type BoardingHouseOAuthNext = string & {
  readonly [boardingHouseOAuthNextBrand]: true;
};
export type OAuthNext = "/schedule" | "/owner" | BoardingHouseOAuthNext;

const EXACT_OAUTH_RETURN_PATHS = new Set(["/schedule", "/owner"]);
const BOARDING_HOUSE_PREFIX = "/boarding-houses/";
const MAX_BOARDING_HOUSE_SLUG_LENGTH = 90;
const BOARDING_HOUSE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DUMMY_ORIGIN = "https://oauth-return.invalid";
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const ENCODED_SEPARATOR = /%(?:2f|5c)/i;

function isCanonicalBoardingHouseSlug(slug: string): boolean {
  return (
    slug.length <= MAX_BOARDING_HOUSE_SLUG_LENGTH &&
    BOARDING_HOUSE_SLUG.test(slug)
  );
}

export function boardingHouseOAuthNext(slug: string): BoardingHouseOAuthNext {
  if (!isCanonicalBoardingHouseSlug(slug)) {
    throw new Error("Invalid boarding-house slug");
  }
  return `${BOARDING_HOUSE_PREFIX}${slug}` as BoardingHouseOAuthNext;
}

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
      parsed.pathname !== value
    ) {
      return "/";
    }

    if (EXACT_OAUTH_RETURN_PATHS.has(parsed.pathname)) {
      return parsed.pathname as "/schedule" | "/owner";
    }

    if (parsed.pathname.startsWith(BOARDING_HOUSE_PREFIX)) {
      const slug = parsed.pathname.slice(BOARDING_HOUSE_PREFIX.length);
      if (isCanonicalBoardingHouseSlug(slug)) {
        return parsed.pathname as BoardingHouseOAuthNext;
      }
    }
    return "/";
  } catch {
    return "/";
  }
}

export function oauthFailurePath(next: OAuthNext | "/"): string {
  if (next === "/schedule") return "/schedule?auth_error=oauth";
  if (next.startsWith(BOARDING_HOUSE_PREFIX)) {
    return `${next}?auth_error=oauth`;
  }
  return "/owner/login?error=oauth";
}
