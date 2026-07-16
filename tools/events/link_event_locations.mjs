import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  buildFacilityIndexes,
  matchFacilityForEvent,
} from "./location_matcher.mjs";

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
    dryRun: true,
    limit: undefined,
    titlePrefix: undefined,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--apply") {
      args.dryRun = false;
      continue;
    }
    if (a === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (a === "--limit") {
      const raw = argv[i + 1];
      i += 1;
      const parsed = raw ? Number(raw) : NaN;
      if (Number.isFinite(parsed) && parsed > 0) args.limit = parsed;
      continue;
    }
    if (a === "--title-prefix") {
      args.titlePrefix = argv[i + 1] || undefined;
      i += 1;
      continue;
    }
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const envPath = path.join(process.cwd(), ".env.local");
  loadEnv(envPath);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: facilities, error: facilitiesError } = await supabase
    .from("facilities")
    .select("id, name, code");

  if (facilitiesError) throw facilitiesError;

  const { facilitiesByName, facilitiesByCode } = buildFacilityIndexes(facilities);

  let query = supabase
    .from("events")
    .select("id, title, location_text, location_id")
    .is("location_id", null)
    .not("location_text", "is", null);

  if (args.titlePrefix) {
    query = query.ilike("title", `${args.titlePrefix}%`);
  }

  if (args.limit) {
    query = query.limit(args.limit);
  }

  const { data: events, error: eventsError } = await query;
  if (eventsError) throw eventsError;

  const candidates = (events ?? []).filter((e) => String(e.location_text ?? "").trim().length > 0);

  const updates = [];
  const unmatchedEvents = [];

  for (const e of candidates) {
    const match = matchFacilityForEvent(
      { title: e.title, locationText: e.location_text },
      { facilitiesByName, facilitiesByCode }
    );
    if (!match) {
      unmatchedEvents.push(e);
      continue;
    }

    updates.push({
      eventId: e.id,
      title: e.title,
      locationText: e.location_text,
      facilityId: match.facility.id,
      facilityName: match.facility.name,
      reason: match.reason,
    });
  }

  const unmatched = new Map();
  for (const e of unmatchedEvents) {
    const k = String(e.location_text);
    unmatched.set(k, (unmatched.get(k) ?? 0) + 1);
  }

  const unmatchedList = [...unmatched.entries()]
    .map(([locationText, count]) => ({ locationText, count }))
    .sort((a, b) => b.count - a.count);

  const summary = {
    mode: args.dryRun ? "dry-run" : "apply",
    titlePrefix: args.titlePrefix ?? null,
    totalCandidates: candidates.length,
    matchedEvents: updates.length,
    unmatchedEvents: unmatchedEvents.length,
    unmatchedLocations: unmatchedList.length,
  };

  console.log(JSON.stringify(summary, null, 2));
  console.log("\nTop unmatched locations:");
  console.log(
    JSON.stringify(
      unmatchedList.slice(0, 30),
      null,
      2
    )
  );

  if (args.dryRun) return;
  if (updates.length === 0) return;

  const byFacility = new Map();
  for (const u of updates) {
    const list = byFacility.get(u.facilityId) ?? [];
    list.push(u.eventId);
    byFacility.set(u.facilityId, list);
  }

  let updated = 0;
  const CHUNK_SIZE = 100;
  for (const [facilityId, ids] of byFacility.entries()) {
    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
      const chunk = ids.slice(i, i + CHUNK_SIZE);
      const { error } = await supabase
        .from("events")
        .update({ location_id: facilityId })
        .is("location_id", null)
        .in("id", chunk);
      if (error) throw error;
      updated += chunk.length;
    }
  }

  console.log(`\nUpdated ${updated} events with location_id.`);
}

await main();
