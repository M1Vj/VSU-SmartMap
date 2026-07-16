import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  buildFacilityIndexes,
  matchFacilityForEvent,
} from "../events/location_matcher.mjs";

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
    schedule: "docs/schedules/salingkusog-2026.json",
    dryRun: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--schedule") {
      args.schedule = argv[i + 1];
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
  }

  return args;
}

function makeKey({ title, start_time, location_text }) {
  return `${title}__${start_time}__${location_text ?? ""}`.toLowerCase();
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

  const schedulePath = path.resolve(process.cwd(), args.schedule);
  const schedule = JSON.parse(fs.readFileSync(schedulePath, "utf8"));
  const events = Array.isArray(schedule.events) ? schedule.events : [];
  if (!events.length) {
    console.log("No events found in schedule.");
    return;
  }

  const minStart = events
    .map((e) => e.startTime)
    .filter(Boolean)
    .sort()[0];
  const maxStart = events
    .map((e) => e.startTime)
    .filter(Boolean)
    .sort()
    .at(-1);

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: existing, error: existingError } = await supabase
    .from("events")
    .select("title, start_time, location_text")
    .gte("start_time", minStart)
    .lte("start_time", maxStart);

  if (existingError) throw existingError;

  const existingKeys = new Set((existing ?? []).map(makeKey));

  const { data: facilities, error: facilitiesError } = await supabase
    .from("facilities")
    .select("id, name, code");

  if (facilitiesError) throw facilitiesError;

  const facilityIndexes = buildFacilityIndexes(facilities);

  const toInsert = [];
  for (const e of events) {
    const row = {
      title: e.title,
      description: null,
      start_time: e.startTime,
      end_time: e.endTime,
      location_text: e.locationText ?? null,
      location_id: null,
      category: e.category ?? "sports",
      image_url: null,
    };

    if (!row.title || !row.start_time || !row.end_time) continue;

    const match = matchFacilityForEvent(
      { title: row.title, locationText: row.location_text },
      facilityIndexes
    );
    if (match) {
      row.location_id = match.facility.id;
    }

    const key = makeKey(row);
    if (existingKeys.has(key)) continue;
    toInsert.push(row);
  }

  console.log(
    JSON.stringify(
      {
        schedule: path.relative(process.cwd(), schedulePath),
        totalScheduleEvents: events.length,
        existingInRange: (existing ?? []).length,
        toInsert: toInsert.length,
        mode: args.dryRun ? "dry-run" : "apply",
      },
      null,
      2
    )
  );

  if (args.dryRun) return;
  if (!toInsert.length) return;

  const CHUNK_SIZE = 100;
  for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
    const chunk = toInsert.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase.from("events").insert(chunk);
    if (error) throw error;
  }

  console.log(`Inserted ${toInsert.length} events.`);
}

await main();
