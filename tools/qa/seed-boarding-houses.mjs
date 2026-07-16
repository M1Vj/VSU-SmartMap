// Seed example boarding houses (varied states + edge cases) for QA.
// Idempotent: removes prior seed rows (by slug / known test emails) then recreates.
// Uses the service role, so it bypasses RLS and the owner-transition trigger — this
// simulates already-moderated data. Run: node tools/qa/seed-boarding-houses.mjs
//
// Creates: one approved owner (via the approve_owner_application RPC), two test
// student reviewers, and five listings covering happy-path, no-price, fully-booked,
// pending_review (must stay hidden), and suspended (must stay hidden).

import { existsSync, readFileSync } from "node:fs";
import zlib from "node:zlib";
import { createClient } from "@supabase/supabase-js";
import { assertLocalSupabaseUrl } from "../dev/local-supabase.mjs";

function loadEnv() {
  const env = { ...process.env };
  const path = new URL("../../.env.local", import.meta.url);
  if (existsSync(path)) {
    const raw = readFileSync(path, "utf8");
    for (const line of raw.split("\n")) {
      if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
      const i = line.indexOf("=");
      const key = line.slice(0, i).trim();
      if (!env[key]) env[key] = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    }
  }
  return env;
}

// Minimal solid-color PNG encoder (valid image/png for the storage bucket).
function solidPng(w, h, [r, g, b]) {
  const rowLen = 1 + w * 3;
  const rows = Buffer.alloc(rowLen * h);
  for (let y = 0; y < h; y++) {
    const off = y * rowLen;
    rows[off] = 0; // filter: none
    for (let x = 0; x < w; x++) {
      rows[off + 1 + x * 3] = r;
      rows[off + 2 + x * 3] = g;
      rows[off + 3 + x * 3] = b;
    }
  }
  const chunk = (type, data) => {
    const t = Buffer.from(type, "ascii");
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(Buffer.concat([t, data])) >>> 0, 0);
    return Buffer.concat([len, t, data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(rows)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const env = loadEnv();
assertLocalSupabaseUrl(env.NEXT_PUBLIC_SUPABASE_URL);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const OWNER_EMAIL = "owner@smartmap.example";
const ADMIN_EMAIL = "admin@smartmap.example";
const REVIEWER_EMAILS = ["reviewer@smartmap.example", "student@smartmap.example"];
const FIXTURE_PASSWORD = "LocalSmartMap123!";
const FIXTURE_TIME = "2026-01-01T00:00:00.000Z";
const SLUGS = [
  "green-gate-residence",
  "pangasugan-budget-bedspace",
  "hilltop-ladies-dorm",
  "riverside-rooms-pending",
  "old-market-lodge-suspended",
];

async function findUserByEmail(email) {
  // listUsers is paged; scan a few pages.
  for (let page = 1; page <= 5; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const u = data.users.find((x) => x.email === email);
    if (u) return u;
    if (data.users.length < 200) break;
  }
  return null;
}

async function ensureUser(email, name) {
  let u = await findUserByEmail(email);
  if (!u) {
    const { data, error } = await sb.auth.admin.createUser({
      email,
      password: FIXTURE_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: name },
    });
    if (error) throw error;
    u = data.user;
  }
  return u;
}

async function main() {
  console.log("Seeding example boarding houses...\n");

  const admin = await ensureUser(ADMIN_EMAIL, "Local Administrator");
  const ownerUser = await ensureUser(OWNER_EMAIL, "Local Boarding-House Owner");
  const { error: roleError } = await sb.from("app_user_roles").upsert(
    { user_id: admin.id, role: "admin" },
    { onConflict: "user_id,role" },
  );
  if (roleError) throw roleError;

  // --- Clean prior seed (listings cascade to offerings/photos/reviews) ---
  await sb.from("boarding_house_listings").delete().in("slug", SLUGS);

  // --- Owner via approve_owner_application RPC (exercises the atomic path) ---
  await sb.from("owner_applications").delete().eq("user_id", ownerUser.id);
  const { data: app, error: appErr } = await sb
    .from("owner_applications")
    .insert({
      user_id: ownerUser.id,
      display_name: "Tatay Boarding Rentals",
      phone: "0917-555-0101",
      email: OWNER_EMAIL,
      authority_notes: "Owns three boarding houses along Pangasugan Road near the VSU gate.",
      status: "pending",
    })
    .select("id")
    .single();
  if (appErr) throw appErr;
  const { error: rpcErr } = await sb.rpc("approve_owner_application", {
    p_application_id: app.id,
    p_reviewer_id: admin.id,
    p_reviewer_note: "Verified IDs and proof of ownership.",
  });
  if (rpcErr) throw rpcErr;
  const { data: profile } = await sb
    .from("owner_profiles")
    .select("id")
    .eq("user_id", ownerUser.id)
    .single();
  console.log("Owner profile:", profile.id);

  // --- Reviewers ---
  const reviewers = [];
  reviewers.push(await ensureUser(REVIEWER_EMAILS[0], "Local Reviewer"));
  reviewers.push(await ensureUser(REVIEWER_EMAILS[1], "Local Student"));

  const baseAmenities = {
    wifi: true, cooking_allowed: true, furnished: true,
    air_conditioning: false, laundry_area: true, parking: false, study_area: true,
    water_included: true, electricity_included: true,
    private_bathroom: false, advance_months: 1, deposit_months: 1,
  };

  const listings = [
    {
      slug: "green-gate-residence", name: "Green Gate Residence", status: "published",
      verification_status: "verified", price_min: 2500, price_max: 3500, available_slots: 6,
      latitude: 10.7449, longitude: 124.7922, walking_minutes_to_campus_gate: 8,
      address_line: "Pangasugan Road, Brgy. Pangasugan, Baybay City",
      description: "Bright, secure boarding house a short walk from the VSU main gate. Fast fiber Wi-Fi, study nook, and a shared kitchen.",
      room_types: ["bedspace", "private_room"], occupancy_policies: ["any_gender", "female_only"],
      ...baseAmenities, has_curfew: false, allows_visitors: true, allows_pets: false,
      contact_phone: "0917-555-0101", contact_email: OWNER_EMAIL,
      contact_facebook: "https://example.com/green-gate-residence",
      photos: [[34, 139, 34], [60, 179, 113]], reviews: [5, 4],
      offerings: [
        {
          room_type: "bedspace", label: "Shared bedspace (fan)", monthly_price: 2500,
          available_slots: 4, capacity: 4, size_sqm: 16.0, has_aircon: false, private_bathroom: false,
          room_image: [70, 130, 180],
        },
        {
          room_type: "private_room", label: "Aircon private room", monthly_price: 3500,
          available_slots: 2, capacity: 1, size_sqm: 12.5, has_aircon: true, private_bathroom: true,
        },
      ],
    },
    {
      slug: "pangasugan-budget-bedspace", name: "Pangasugan Budget Bedspace", status: "published",
      verification_status: "verified", price_min: null, price_max: null, available_slots: 6,
      latitude: 10.7461, longitude: 124.7937, walking_minutes_to_campus_gate: 12,
      address_line: "Lower Pangasugan, Baybay City",
      description: "Affordable bedspaces; message the owner for current monthly rates.",
      room_types: ["bedspace"], occupancy_policies: ["male_only"],
      ...baseAmenities, furnished: false, electricity_included: false, deposit_months: 0,
      has_curfew: true, curfew_time: "22:00",
      allows_visitors: false, allows_pets: false, contact_phone: "0917-555-0102",
      photos: [], reviews: [],
      offerings: [
        {
          room_type: "bedspace", label: "Budget bedspace", monthly_price: 0,
          available_slots: 6, capacity: 6, has_aircon: false, private_bathroom: false,
        },
      ],
    },
    {
      slug: "hilltop-ladies-dorm", name: "Hilltop Ladies Dorm", status: "published",
      verification_status: "verified", price_min: 4000, price_max: 4000, available_slots: 0,
      latitude: 10.7433, longitude: 124.7951, walking_minutes_to_campus_gate: 15,
      address_line: "Hilltop Subdivision, Baybay City",
      description: "Female-only dorm with curfew, CCTV, and a live-in manager. Currently fully booked.",
      room_types: ["private_room"], occupancy_policies: ["female_only"],
      ...baseAmenities, air_conditioning: true, private_bathroom: true, advance_months: 2,
      has_curfew: true, curfew_time: "21:30",
      allows_visitors: false, allows_pets: false, contact_phone: "0917-555-0103",
      photos: [[219, 112, 147]], reviews: [4],
    },
    {
      slug: "riverside-rooms-pending", name: "Riverside Rooms", status: "pending_review",
      verification_status: "pending", price_min: 3000, price_max: 3000, available_slots: 3,
      latitude: 10.7475, longitude: 124.7910, walking_minutes_to_campus_gate: 20,
      address_line: "Riverside, Baybay City",
      description: "Awaiting admin review — must NOT be visible to students.",
      room_types: ["shared_room"], occupancy_policies: ["any_gender"],
      ...baseAmenities, private_bathroom: true,
      has_curfew: false, allows_visitors: true, allows_pets: true,
      contact_phone: "0917-555-0104", photos: [], reviews: [],
    },
    {
      slug: "old-market-lodge-suspended", name: "Old Market Lodge", status: "suspended",
      verification_status: "verified", price_min: 2000, price_max: 2800, available_slots: 2,
      latitude: 10.7402, longitude: 124.8001, walking_minutes_to_campus_gate: 25,
      address_line: "Old Market District, Baybay City", suspended_at: FIXTURE_TIME,
      description: "Suspended by an admin after reports — must NOT be visible to students.",
      room_types: ["bedspace"], occupancy_policies: ["any_gender"],
      ...baseAmenities, water_included: false, electricity_included: false,
      has_curfew: false, allows_visitors: true, allows_pets: false,
      contact_phone: "0917-555-0105", photos: [], reviews: [],
    },
  ];

  for (const l of listings) {
    const { photos, reviews, offerings, ...row } = l;
    const insert = { owner_id: profile.id, ...row };
    if (row.status === "published") insert.published_at = FIXTURE_TIME;
    const { data: created, error: cErr } = await sb
      .from("boarding_house_listings")
      .insert(insert)
      .select("id, name, status, verification_status, owner_display_name")
      .single();
    if (cErr) {
      console.log("  ✖ listing", l.slug, "->", cErr.message);
      continue;
    }
    // Room offerings — one boarding house can list rooms that differ in
    // price, size, capacity, aircon, and bathroom arrangement.
    const offeringSources = offerings ?? [
      {
        room_type: row.room_types[0],
        label: "Primary room offering",
        monthly_price: row.price_min ?? 0,
        available_slots: row.available_slots ?? 0,
      },
    ];
    const offeringRows = [];
    let roomImgIdx = 0;
    for (const offering of offeringSources) {
      const { room_image, ...rest } = offering;
      let image_path = null;
      if (room_image) {
        const rpath = `${created.id}/rooms/room-${roomImgIdx}.png`;
        const rup = await sb.storage
          .from("boarding-house-photos")
          .upload(rpath, solidPng(640, 360, room_image), {
            contentType: "image/png",
            upsert: true,
          });
        if (rup.error) {
          console.log("    room image upload failed", rpath, rup.error.message);
        } else {
          image_path = rpath;
        }
        roomImgIdx += 1;
      }
      offeringRows.push({
        listing_id: created.id,
        occupancy_policy: row.occupancy_policies[0],
        image_path,
        ...rest,
      });
    }
    await sb.from("boarding_house_offerings").insert(offeringRows);
    // Photos -> upload to private bucket + row
    let pi = 0;
    for (const color of photos) {
      const path = `${created.id}/photo-${pi}.png`;
      const png = solidPng(640, 420, color);
      const up = await sb.storage
        .from("boarding-house-photos")
        .upload(path, png, { contentType: "image/png", upsert: true });
      if (up.error) {
        console.log("    photo upload failed", path, up.error.message);
      } else {
        await sb.from("boarding_house_photos").insert({
          listing_id: created.id,
          storage_bucket: "boarding-house-photos",
          storage_path: path,
          public_url: path,
          alt_text: `${row.name} photo ${pi + 1}`,
          sort_order: pi,
        });
      }
      pi += 1;
    }
    // Reviews -> approved, by test students (trigger recomputes avg/count)
    for (let ri = 0; ri < reviews.length; ri++) {
      const reviewer = reviewers[ri % reviewers.length];
      await sb.from("boarding_house_reviews").insert({
        listing_id: created.id,
        author_id: reviewer.id,
        author_display_name: reviewer.user_metadata?.full_name ?? "VSU student",
        rating: reviews[ri],
        body: reviews[ri] >= 5 ? "Clean, safe, and close to campus. Highly recommend." : "Good value; the Wi-Fi is reliable.",
        status: "approved",
      });
    }
    const { data: after } = await sb
      .from("boarding_house_listings")
      .select("avg_rating, rating_count")
      .eq("id", created.id)
      .single();
    console.log(
      `  ✔ ${created.name} [${created.status}/${created.verification_status}] owner="${created.owner_display_name}" photos=${photos.length} rating=${after.avg_rating}(${after.rating_count})`,
    );
  }

  console.log("\nSeed complete.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
