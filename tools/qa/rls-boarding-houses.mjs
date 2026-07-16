// Local-only adversarial RLS matrix for boarding-house and storage policies.
// The service role is used only to discover deterministic fixture identifiers;
// every assertion is performed through an anon-key client.

import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { assertLocalSupabaseUrl, parseSupabaseEnv } from "../dev/local-supabase.mjs";

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";
const PASSWORD = "LocalSmartMap123!";

function localEnvironment() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const url = assertLocalSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
    return {
      url,
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    };
  }

  const output = execFileSync("npx", ["--yes", "supabase@2.107.0", "status", "-o", "env"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const env = parseSupabaseEnv(output);
  return {
    url: assertLocalSupabaseUrl(env.API_URL),
    anonKey: env.ANON_KEY || env.PUBLISHABLE_KEY,
    serviceKey: env.SERVICE_ROLE_KEY || env.SECRET_KEY,
  };
}

let passed = 0;
let failed = 0;
function check(name, ok, detail = "") {
  if (ok) {
    passed += 1;
    console.log(`  ✔ ${name}`);
  } else {
    failed += 1;
    console.log(`  ✖ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function browserClient(url, anonKey) {
  return createClient(url, anonKey, { auth: { persistSession: false } });
}

async function authenticatedClient(url, anonKey, email) {
  const client = browserClient(url, anonKey);
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`Unable to sign in ${email}: ${error.message}`);
  return client;
}

async function main() {
  const { url, anonKey, serviceKey } = localEnvironment();
  if (!anonKey || !serviceKey) throw new Error("Local Supabase API keys are unavailable.");

  const anon = browserClient(url, anonKey);
  const student = await authenticatedClient(url, anonKey, "student@smartmap.example");
  const reviewer = await authenticatedClient(url, anonKey, "reviewer@smartmap.example");
  const owner = await authenticatedClient(url, anonKey, "owner@smartmap.example");
  const admin = await authenticatedClient(url, anonKey, "admin@smartmap.example");
  const service = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: publicListing } = await service
    .from("boarding_house_listings")
    .select("id")
    .eq("slug", "green-gate-residence")
    .single();
  const { data: pendingListing } = await service
    .from("boarding_house_listings")
    .select("id")
    .eq("slug", "riverside-rooms-pending")
    .single();
  if (!publicListing || !pendingListing) throw new Error("Run npm run dev:bootstrap before qa:rls.");

  console.log("RLS adversarial matrix (loopback Supabase only)\n");

  const { data: publicRows, error: publicError } = await anon
    .from("boarding_house_listings")
    .select("id,status,verification_status")
    .limit(1000);
  check("anon listing read succeeds", !publicError, publicError?.message);
  check(
    "anon sees only published and verified listings",
    (publicRows ?? []).every(
      (row) => row.status === "published" && row.verification_status === "verified",
    ),
  );

  for (const table of [
    "app_user_roles",
    "owner_profiles",
    "owner_applications",
    "owner_verification_documents",
    "boarding_house_moderation_events",
  ]) {
    const { data, error } = await anon.from(table).select("*").limit(1);
    check(`anon cannot read ${table}`, Boolean(error) || (data ?? []).length === 0);
  }

  const { data: reviews } = await anon
    .from("boarding_house_reviews")
    .select("status")
    .limit(1000);
  check("anon sees only approved reviews", (reviews ?? []).every((row) => row.status === "approved"));

  const { error: anonReviewError } = await anon.from("boarding_house_reviews").insert({
    listing_id: publicListing.id,
    author_id: ZERO_UUID,
    rating: 5,
    body: "rls-test",
  });
  check("anon cannot insert reviews", Boolean(anonReviewError));

  const { error: anonReportError } = await anon.from("boarding_house_reports").insert({
    listing_id: publicListing.id,
    reason: "safety",
    details: "direct API write must be rejected",
  });
  check("anon cannot bypass server controls for reports", anonReportError?.code === "42501");

  const { data: studentIdentity } = await student.auth.getUser();
  const { error: directReviewError } = await student.from("boarding_house_reviews").insert({
    listing_id: publicListing.id,
    author_id: studentIdentity.user?.id ?? ZERO_UUID,
    author_display_name: "Local Student",
    rating: 5,
    body: "direct API write must be rejected",
  });
  check("authenticated users cannot bypass server controls for reviews", directReviewError?.code === "42501");

  for (const table of ["suggestions", "bug_reports", "event_suggestions", "submissions"]) {
    const { error } = await anon.from(table).insert({});
    check(`anon has no direct write privilege on ${table}`, error?.code === "42501");
  }

  for (const [name, client] of [["student", student], ["reviewer", reviewer]]) {
    const { data: roles, error } = await client.from("app_user_roles").select("role");
    check(`${name} can query only its own empty role set`, !error && (roles ?? []).length === 0);
    const { data: profiles } = await client.from("owner_profiles").select("id");
    check(`${name} cannot read owner profiles`, (profiles ?? []).length === 0);
  }

  const { data: ownerRoles, error: ownerRoleError } = await owner
    .from("app_user_roles")
    .select("role");
  check(
    "owner reads its boarding-house role",
    !ownerRoleError && (ownerRoles ?? []).some((row) => row.role === "boarding_house_owner"),
  );
  const { data: ownerProfiles, error: ownerProfileError } = await owner
    .from("owner_profiles")
    .select("id,user_id");
  check("owner reads exactly its own profile", !ownerProfileError && ownerProfiles?.length === 1);

  const { data: ownerPublish, error: ownerPublishError } = await owner
    .from("boarding_house_listings")
    .update({ status: "published", verification_status: "verified" })
    .eq("id", pendingListing.id)
    .select("id");
  check(
    "owner cannot self-publish a pending listing",
    Boolean(ownerPublishError) || (ownerPublish ?? []).length === 0,
  );

  const { data: reviewerModeration, error: reviewerModerationError } = await reviewer
    .from("boarding_house_listings")
    .update({ status: "suspended" })
    .eq("id", publicListing.id)
    .select("id");
  check(
    "reviewer cannot moderate listings",
    Boolean(reviewerModerationError) || (reviewerModeration ?? []).length === 0,
  );

  const { data: adminRoles, error: adminRoleError } = await admin
    .from("app_user_roles")
    .select("user_id,role");
  check("admin can read protected role rows", !adminRoleError && (adminRoles ?? []).length >= 2);
  const { data: adminListings, error: adminListingError } = await admin
    .from("boarding_house_listings")
    .select("id,status")
    .limit(1000);
  check(
    "admin can read non-public listings",
    !adminListingError && (adminListings ?? []).some((row) => row.status !== "published"),
  );

  for (const bucket of ["boarding-house-photos", "boarding-house-verification", "event-proofs"]) {
    const { data, error } = await anon.storage.from(bucket).list();
    check(`anon cannot list private ${bucket}`, Boolean(error) || (data ?? []).length === 0);
  }

  const { error: legacyWriteError } = await student.storage
    .from("event-images")
    .upload("rls-test/must-not-exist.txt", new Blob(["blocked"], { type: "text/plain" }));
  check("authenticated users cannot write legacy event-images", Boolean(legacyWriteError));

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(`RLS test harness error: ${error.message}`);
  process.exit(2);
});
