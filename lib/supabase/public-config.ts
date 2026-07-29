export function isSupabasePublicConfigValid(
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
