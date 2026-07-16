#!/usr/bin/env node

import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

import { createClient } from "@supabase/supabase-js";

const MAX_BYTES = 5 * 1024 * 1024;
const INVENTORY_PAGE_SIZE = 200;
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const DIRECT_PATH = new RegExp(`^${UUID}/${UUID}\\.(?:jpg|png|webp)$`, "i");
const PREFIXED_PATH = new RegExp(`^event-proofs/(${UUID}/${UUID}\\.(?:jpg|png|webp))$`, "i");

export function parseLegacyProofUrl(rawUrl, projectUrl) {
  if (typeof rawUrl !== "string" || rawUrl.includes("%")) return null;
  try {
    const value = new URL(rawUrl);
    const project = new URL(projectUrl);
    if (
      value.protocol !== "https:" ||
      value.origin !== project.origin ||
      value.username ||
      value.password ||
      value.search ||
      value.hash
    ) return null;

    const prefix = "/storage/v1/object/public/";
    if (!value.pathname.startsWith(prefix)) return null;
    const storagePath = value.pathname.slice(prefix.length);
    const slash = storagePath.indexOf("/");
    if (slash < 1) return null;
    const bucket = storagePath.slice(0, slash);
    const objectPath = storagePath.slice(slash + 1);

    if (bucket === "smartmap-bucket") {
      const match = PREFIXED_PATH.exec(objectPath);
      if (!match) return null;
      return { bucket, objectPath, destinationPath: match[1] };
    }
    if (bucket === "event-proofs") {
      if (DIRECT_PATH.test(objectPath)) {
        return { bucket, objectPath, destinationPath: objectPath };
      }
      const match = PREFIXED_PATH.exec(objectPath);
      if (match) return { bucket, objectPath, destinationPath: match[1] };
    }
  } catch {
    return null;
  }
  return null;
}

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function isMissingObjectError(error) {
  return Boolean(
    error && (
      error.status === 404 ||
      error.statusCode === 404 ||
      error.code?.toLowerCase() === "not_found" ||
      error.message?.toLowerCase().includes("not found")
    )
  );
}

async function readObject(client, bucket, objectPath) {
  const { data, error } = await client.storage.from(bucket).download(objectPath);
  if (error || !data) return null;
  const bytes = Buffer.from(await data.arrayBuffer());
  if (bytes.length < 1 || bytes.length > MAX_BYTES) return null;
  return { bytes, hash: digest(bytes), contentType: data.type || "application/octet-stream" };
}

async function verifiedTransfer(client, source) {
  const original = await readObject(client, source.bucket, source.objectPath);
  if (!original) return false;

  const alreadyPrivate =
    source.bucket === "event-proofs" && source.objectPath === source.destinationPath;
  if (!alreadyPrivate) {
    await client.storage.from("event-proofs").upload(
      source.destinationPath,
      original.bytes,
      {
        upsert: false,
        contentType: original.contentType,
        cacheControl: "3600",
      },
    );
  }

  const copied = alreadyPrivate
    ? original
    : await readObject(client, "event-proofs", source.destinationPath);
  return Boolean(
    copied && copied.bytes.length === original.bytes.length && copied.hash === original.hash,
  );
}

async function inventoryRows(client, table, selection) {
  const rows = [];
  for (let from = 0; ; from += INVENTORY_PAGE_SIZE) {
    const { data, error } = await client
      .from(table)
      .select(selection)
      .order("id", { ascending: true })
      .range(from, from + INVENTORY_PAGE_SIZE - 1);
    if (error) throw new Error("Unable to inventory legacy event evidence.");
    const page = data ?? [];
    rows.push(...page);
    if (page.length < INVENTORY_PAGE_SIZE) return rows;
  }
}

async function setSuggestionPath(client, id, originalUrl, destinationPath) {
  const { error, count } = await client
    .from("event_suggestions")
    .update({ proof_object_path: destinationPath }, { count: "exact" })
    .eq("id", id)
    .eq("proof_file_url", originalUrl)
    .is("proof_object_path", null);
  return !error && count === 1;
}

async function clearSuggestionLegacyUrl(client, id, originalUrl, destinationPath) {
  const { error, count } = await client
    .from("event_suggestions")
    .update({ proof_file_url: null }, { count: "exact" })
    .eq("id", id)
    .eq("proof_file_url", originalUrl)
    .eq("proof_object_path", destinationPath);
  return !error && count === 1;
}

export async function runEventProofMigration({
  client,
  projectUrl,
  apply = false,
  logger = console,
}) {
  const [suggestionRows, eventRows] = await Promise.all([
    inventoryRows(
      client,
      "event_suggestions",
      "id,proof_file_url,proof_object_path",
    ),
    inventoryRows(client, "events", "id,image_url"),
  ]);
  const candidates = [];
  let invalidSuggestionUrls = 0;
  for (const row of suggestionRows) {
    if (!row.proof_file_url) continue;
    const source = parseLegacyProofUrl(row.proof_file_url, projectUrl);
    if (!source) {
      invalidSuggestionUrls += 1;
      continue;
    }
    candidates.push({ row, source });
  }

  const eventCandidates = eventRows.filter(
    (row) => parseLegacyProofUrl(row.image_url, projectUrl) !== null,
  );
  const result = {
    apply,
    suggestionCandidates: candidates.length,
    migratedSuggestions: 0,
    invalidSuggestionUrls,
    eventImageCandidates: eventCandidates.length,
    clearedEventImages: 0,
    retry: 0,
  };

  if (!apply) {
    logger.info("Event proof migration dry-run counts", result);
    return result;
  }

  for (const { row, source } of candidates) {
    try {
      if (row.proof_object_path && row.proof_object_path !== source.destinationPath) {
        result.retry += 1;
        continue;
      }

      const existingDestination = row.proof_object_path
        ? await readObject(client, "event-proofs", source.destinationPath)
        : null;
      if (!existingDestination && !await verifiedTransfer(client, source)) {
        result.retry += 1;
        continue;
      }

      if (!row.proof_object_path) {
        if (!await setSuggestionPath(
          client,
          row.id,
          row.proof_file_url,
          source.destinationPath,
        )) {
          result.retry += 1;
          continue;
        }
      }

      const sourceIsDestination =
        source.bucket === "event-proofs" && source.objectPath === source.destinationPath;
      if (!sourceIsDestination) {
        const { error: removeError } = await client.storage
          .from(source.bucket)
          .remove([source.objectPath]);
        if (removeError && !isMissingObjectError(removeError)) {
          result.retry += 1;
          continue;
        }
      }

      if (!await clearSuggestionLegacyUrl(
        client,
        row.id,
        row.proof_file_url,
        source.destinationPath,
      )) {
        result.retry += 1;
        continue;
      }
      result.migratedSuggestions += 1;
    } catch {
      result.retry += 1;
    }
  }

  for (const row of eventCandidates) {
    const { error, count } = await client
      .from("events")
      .update({ image_url: null }, { count: "exact" })
      .eq("id", row.id)
      .eq("image_url", row.image_url);
    if (error || count !== 1) result.retry += 1;
    else result.clearedEventImages += 1;
  }

  logger.info("Event proof migration apply counts", result);
  return result;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some((argument) => argument !== "--apply")) {
    throw new Error("Usage: node tools/migrations/migrate-event-proofs.mjs [--apply]");
  }
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!projectUrl || !serviceRoleKey) {
    throw new Error("Required Supabase environment variables are unavailable.");
  }

  const client = createClient(projectUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await runEventProofMigration({ client, projectUrl, apply: args.includes("--apply") });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {
    console.error("Event proof migration failed.");
    process.exitCode = 1;
  });
}
