import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnv(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function parseArgs(argv) {
  const args = {
    prefix: "QA TEST -",
    dryRun: true,
    deleteStorage: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--prefix") {
      args.prefix = argv[i + 1] ?? args.prefix;
      i += 1;
      continue;
    }
    if (a === "--apply") {
      args.dryRun = false;
      continue;
    }
    if (a === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (a === "--no-delete-storage") {
      args.deleteStorage = false;
      continue;
    }
  }

  return args;
}

function extractStorageLocation(proofFileUrl) {
  const url = String(proofFileUrl ?? "");
  if (!url) return null;

  const marker = "/storage/v1/object/";
  const idx = url.indexOf(marker);
  if (idx === -1) return null;

  const tail = url.slice(idx + marker.length);
  const parts = tail.split("/").filter(Boolean);
  if (parts.length < 2) return null;

  if (parts[0] === "public") {
    const bucket = parts[1];
    const objectPath = parts.slice(2).join("/");
    if (!bucket || !objectPath) return null;
    return { bucket, path: objectPath };
  }

  const bucket = parts[0];
  const objectPath = parts.slice(1).join("/");
  if (!bucket || !objectPath) return null;
  return { bucket, path: objectPath };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const envPath = path.join(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) loadEnv(envPath);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.");
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

  const { data, error } = await supabase
    .from("event_suggestions")
    .select("id,title,status,proof_file_url,created_at")
    .ilike("title", `${args.prefix}%`)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const rows = Array.isArray(data) ? data : [];
  if (rows.length === 0) {
    console.log(`No event_suggestions found for prefix: ${JSON.stringify(args.prefix)}`);
    return;
  }

  console.log(`Matched ${rows.length} event_suggestions for prefix: ${JSON.stringify(args.prefix)}`);
  for (const r of rows) {
    console.log(`- ${r.id} | ${r.status} | ${r.created_at} | ${r.title}`);
  }

  if (args.dryRun) {
    console.log("Dry-run: no deletes performed. Re-run with --apply to delete.");
    return;
  }

  if (args.deleteStorage) {
    for (const r of rows) {
      const loc = extractStorageLocation(r.proof_file_url);
      if (!loc) continue;
      const { error: removeError } = await supabase.storage.from(loc.bucket).remove([loc.path]);
      if (removeError) {
        console.warn(`Failed to delete storage object for ${r.id}: ${removeError.message}`);
      } else {
        console.log(`Deleted storage object for ${r.id}: ${loc.bucket}/${loc.path}`);
      }
    }
  }

  const ids = rows.map((r) => r.id);
  const { error: deleteError } = await supabase.from("event_suggestions").delete().in("id", ids);
  if (deleteError) throw deleteError;

  console.log(`Deleted ${ids.length} event_suggestions.`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

