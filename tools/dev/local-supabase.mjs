export function parseSupabaseEnv(output) {
  const parsed = {};
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (!match) continue;
    parsed[match[1]] = match[2].trim().replace(/^(["'])(.*)\1$/, "$2");
  }
  return parsed;
}

export function assertLocalSupabaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Supabase did not return a valid local API URL.");
  }

  if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(url.hostname)) {
    throw new Error("Refusing to use a non-local Supabase project.");
  }
  if (url.port !== "57321") {
    throw new Error(`Refusing unexpected local API port ${url.port}; expected port 57321.`);
  }
  return url.toString().replace(/\/$/, "");
}
