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

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toLocalPartsFromUtcIso(utcIso, offsetMinutes) {
  const ms = new Date(utcIso).getTime();
  const local = new Date(ms + offsetMinutes * 60 * 1000);
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth() + 1,
    day: local.getUTCDate(),
    hour: local.getUTCHours(),
    minute: local.getUTCMinutes(),
  };
}

function localPartsToIsoWithOffset({ year, month, day, hour, minute }, tzOffset) {
  return `${year}-${pad2(month)}-${pad2(day)}T${pad2(hour)}:${pad2(minute)}:00${tzOffset}`;
}

function toMinutes(hour, minute) {
  return hour * 60 + minute;
}

function minutesToHourMinute(minutes) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return { hour, minute };
}

function parseArgs(argv) {
  const args = {
    schedule: "docs/schedules/salingkusog-2026.json",
    titlePrefix: "Salingkusog 2025 -",
    offsetMinutes: 8 * 60,
    tzOffset: "+08:00",
    thresholdMinutes: 90,
    dryRun: true,
    restore: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--schedule") {
      args.schedule = argv[i + 1];
      i += 1;
      continue;
    }
    if (a === "--prefix") {
      args.titlePrefix = argv[i + 1];
      i += 1;
      continue;
    }
    if (a === "--threshold-minutes") {
      args.thresholdMinutes = Number(argv[i + 1]);
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
    if (a === "--restore") {
      args.restore = argv[i + 1];
      i += 1;
      continue;
    }
  }

  return args;
}

function getScheduleSlots(schedule) {
  const events = Array.isArray(schedule?.events) ? schedule.events : [];
  const slotsByDate = new Map();

  for (const e of events) {
    const start = String(e?.startTime ?? "");
    if (!start || start.length < 16) continue;
    const date = start.slice(0, 10);
    const time = start.slice(11, 16);
    if (!/^\d{2}:\d{2}$/.test(time)) continue;
    const [h, m] = time.split(":").map((v) => Number(v));
    if (!Number.isFinite(h) || !Number.isFinite(m)) continue;
    const minutes = toMinutes(h, m);
    const set = slotsByDate.get(date) ?? new Set();
    set.add(minutes);
    slotsByDate.set(date, set);
  }

  const normalized = new Map();
  for (const [date, set] of slotsByDate.entries()) {
    normalized.set(date, Array.from(set).sort((a, b) => a - b));
  }
  return normalized;
}

function findSlotFloor(slots, actualMinutes) {
  if (!slots?.length) return null;
  let lo = 0;
  let hi = slots.length - 1;
  let best = null;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const v = slots[mid];
    if (v <= actualMinutes) {
      best = v;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}

function findNextSlot(slots, minutes) {
  if (!slots?.length) return null;
  for (const v of slots) {
    if (v > minutes) return v;
  }
  return null;
}

function nowStamp() {
  const d = new Date();
  return (
    `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}_` +
    `${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}`
  );
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

  if (args.restore) {
    const restorePath = path.resolve(process.cwd(), args.restore);
    const backup = JSON.parse(fs.readFileSync(restorePath, "utf8"));
    const rows = Array.isArray(backup?.rows) ? backup.rows : [];
    const toRestore = rows
      .map((r) => ({
        id: r.id,
        start_time: r.start_time,
        end_time: r.end_time,
      }))
      .filter((r) => r.id && r.start_time && r.end_time);

    console.log(
      JSON.stringify(
        {
          mode: args.dryRun ? "restore-dry-run" : "restore-apply",
          backup: path.relative(process.cwd(), restorePath),
          rowsInBackup: rows.length,
          rowsToRestore: toRestore.length,
        },
        null,
        2
      )
    );

    if (args.dryRun) return;

    for (const row of toRestore) {
      const { error } = await supabase
        .from("events")
        .update({ start_time: row.start_time, end_time: row.end_time })
        .eq("id", row.id);
      if (error) throw error;
    }
    console.log(`Restored ${toRestore.length} events.`);
    return;
  }

  const schedulePath = path.resolve(process.cwd(), args.schedule);
  const schedule = JSON.parse(fs.readFileSync(schedulePath, "utf8"));
  const slotsByDate = getScheduleSlots(schedule);

  const { data: existing, error: existingError } = await supabase
    .from("events")
    .select("id, title, start_time, end_time, location_text")
    .ilike("title", `${args.titlePrefix}%`)
    .order("start_time", { ascending: true });

  if (existingError) throw existingError;

  const rows = existing ?? [];
  const updates = [];
  const byDate = new Map();

  for (const row of rows) {
    const startLocal = toLocalPartsFromUtcIso(row.start_time, args.offsetMinutes);
    const endLocal = toLocalPartsFromUtcIso(row.end_time, args.offsetMinutes);
    const dateIso = `${startLocal.year}-${pad2(startLocal.month)}-${pad2(startLocal.day)}`;

    const actualStartMin = toMinutes(startLocal.hour, startLocal.minute);
    const scheduleSlots = slotsByDate.get(dateIso) ?? [];
    const floor = findSlotFloor(scheduleSlots, actualStartMin);

    let mappedStartMin = actualStartMin;
    if (floor !== null) {
      const diff = actualStartMin - floor;
      if (diff >= 0 && diff <= args.thresholdMinutes) {
        mappedStartMin = floor;
      }
    }

    const next = findNextSlot(scheduleSlots, mappedStartMin);
    const currentEndMin = toMinutes(endLocal.hour, endLocal.minute);
    let mappedEndMin = next !== null ? next : currentEndMin;
    if (mappedEndMin <= mappedStartMin) {
      mappedEndMin = currentEndMin;
    }
    if (mappedEndMin <= mappedStartMin) continue;

    const newStartParts = { ...startLocal, ...minutesToHourMinute(mappedStartMin) };
    const newEndParts = { ...startLocal, ...minutesToHourMinute(mappedEndMin) };

    const newStartIso = localPartsToIsoWithOffset(newStartParts, args.tzOffset);
    const newEndIso = localPartsToIsoWithOffset(newEndParts, args.tzOffset);

    const changed = mappedStartMin !== actualStartMin || mappedEndMin !== currentEndMin;
    if (!changed) continue;

    updates.push({
      id: row.id,
      title: row.title,
      location_text: row.location_text,
      old: { start_time: row.start_time, end_time: row.end_time },
      next: { start_time: newStartIso, end_time: newEndIso },
    });

    const key = dateIso;
    const arr = byDate.get(key) ?? [];
    arr.push(row);
    byDate.set(key, arr);
  }

  console.log(
    JSON.stringify(
      {
        mode: args.dryRun ? "dry-run" : "apply",
        schedule: path.relative(process.cwd(), schedulePath),
        matchedEvents: rows.length,
        updates: updates.length,
        thresholdMinutes: args.thresholdMinutes,
      },
      null,
      2
    )
  );

  if (!updates.length) return;

  const backup = {
    generatedAt: new Date().toISOString(),
    schedule: path.relative(process.cwd(), schedulePath),
    titlePrefix: args.titlePrefix,
    rows: updates.map((u) => ({
      id: u.id,
      title: u.title,
      start_time: u.old.start_time,
      end_time: u.old.end_time,
      location_text: u.location_text,
    })),
  };

  const backupDir = path.join(process.cwd(), "output", "salingkusog");
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `events-backup-${nowStamp()}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2) + "\n", "utf8");

  console.log(`Backup written: ${path.relative(process.cwd(), backupPath)}`);

  const preview = updates.slice(0, 12).map((u) => ({
    title: u.title,
    old: u.old,
    next: u.next,
  }));
  console.log("Preview:");
  console.log(JSON.stringify(preview, null, 2));

  if (args.dryRun) return;

  for (const u of updates) {
    const { error } = await supabase
      .from("events")
      .update({ start_time: u.next.start_time, end_time: u.next.end_time })
      .eq("id", u.id);
    if (error) throw error;
  }

  console.log(`Updated ${updates.length} events.`);
}

await main();
