import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { assertLocalSupabaseUrl, parseSupabaseEnv } from "../dev/local-supabase.mjs";

const PASSWORD = "LocalSmartMap123!";

function environment() {
  const output = execFileSync(
    "npx",
    ["--yes", "supabase@2.107.0", "status", "-o", "env"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  const env = parseSupabaseEnv(output);
  return {
    url: assertLocalSupabaseUrl(env.API_URL),
    anonKey: env.ANON_KEY || env.PUBLISHABLE_KEY,
    serviceKey: env.SERVICE_ROLE_KEY || env.SECRET_KEY,
  };
}

function catalogRows(sql) {
  return execFileSync(
    "docker",
    [
      "exec",
      "supabase_db_vsu-smartmap",
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-At",
      "-F",
      "|",
      "-c",
      sql,
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  ).trim().split("\n").filter(Boolean);
}

function client(url, key) {
  return createClient(url, key, { auth: { persistSession: false } });
}

async function signedInClient(url, anonKey, email) {
  const result = client(url, anonKey);
  const signIn = await result.auth.signInWithPassword({ email, password: PASSWORD });
  if (signIn.error) throw new Error(signIn.error.message);
  return result;
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

function denied(result) {
  return result.error?.code === "42501"
    || /permission denied|not allowed/i.test(result.error?.message ?? "");
}

function changedNothing(result) {
  return denied(result) || (!result.error && Array.isArray(result.data) && result.data.length === 0);
}

async function main() {
  const { url, anonKey, serviceKey } = environment();
  const anon = client(url, anonKey);
  const student = await signedInClient(url, anonKey, "student@smartmap.example");
  const admin = await signedInClient(url, anonKey, "admin@smartmap.example");
  const owner = await signedInClient(url, anonKey, "owner@smartmap.example");
  const service = client(url, serviceKey);
  const suffix = randomUUID();
  let seededSuggestionId = null;
  let triggerListingId = null;
  let triggerReviewId = null;
  let triggerOwnerProfileId = null;
  let originalOwnerDisplayName = null;
  let disposableFacilityId = null;
  let disposableRoomId = null;
  let adminFacilityId = null;
  let verificationDocumentId = null;
  let knowledgeFixtureId = null;

  console.log("Authenticated student database-hardening matrix (loopback Supabase only)\n");

  try {
  const dangerousPolicyCount = Number(catalogRows(`
    SELECT count(*)
    FROM pg_catalog.pg_policies
    WHERE schemaname IN ('public', 'storage')
      AND policyname IN (
        'Authenticated users can insert facilities',
        'Authenticated users can update facilities',
        'Authenticated users can delete facilities',
        'Authenticated users can manage facilities',
        'Authenticated users can insert rooms',
        'Authenticated users can update rooms',
        'Authenticated users can delete rooms',
        'Authenticated users can manage rooms',
        'Authenticated users can read suggestions',
        'Authenticated users can view suggestions',
        'Authenticated users can update suggestions',
        'Authenticated users can insert suggestions',
        'Authenticated users can delete suggestions',
        'Authenticated users can manage suggestions',
        'Authenticated upload event-images',
        'Authenticated update event-images',
        'Authenticated delete event-images'
      );
  `)[0]);
  check("catalog contains no dangerous drift policy names", dangerousPolicyCount === 0);

  const functionCatalog = catalogRows(`
    SELECT
      procedure.proname,
      procedure.prosecdef,
      procedure.proconfig = ARRAY['search_path=""'],
      pg_catalog.has_function_privilege('anon', procedure.oid, 'EXECUTE'),
      pg_catalog.has_function_privilege('authenticated', procedure.oid, 'EXECUTE'),
      pg_catalog.has_function_privilege('service_role', procedure.oid, 'EXECUTE')
    FROM pg_catalog.pg_proc AS procedure
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
      AND procedure.proname IN (
        'delete_expired_verification_documents',
        'enforce_owner_listing_transition',
        'has_app_role',
        'propagate_owner_display_name',
        'recompute_boarding_house_rating',
        'set_boarding_house_owner_display_name'
      )
    ORDER BY procedure.proname;
  `);
  const expectedFunctionCatalog = [
    "delete_expired_verification_documents|t|t|f|f|f",
    "enforce_owner_listing_transition|t|t|f|f|f",
    "has_app_role|t|t|f|t|f",
    "propagate_owner_display_name|t|t|f|f|f",
    "recompute_boarding_house_rating|t|t|f|f|f",
    "set_boarding_house_owner_display_name|t|t|f|f|f",
  ];
  check(
    "catalog has exact SECURITY DEFINER paths and API ACLs",
    JSON.stringify(functionCatalog) === JSON.stringify(expectedFunctionCatalog),
    functionCatalog.join("; "),
  );

  const verificationRetentionCatalog = catalogRows(`
    SELECT
      procedure.proname,
      procedure.prosecdef,
      procedure.proconfig = ARRAY['search_path=""'],
      pg_catalog.has_function_privilege('anon', procedure.oid, 'EXECUTE'),
      pg_catalog.has_function_privilege('authenticated', procedure.oid, 'EXECUTE'),
      pg_catalog.has_function_privilege('service_role', procedure.oid, 'EXECUTE')
    FROM pg_catalog.pg_proc AS procedure
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
      AND procedure.proname IN (
        'claim_expired_verification_documents',
        'complete_verification_document_deletion',
        'release_verification_document_deletion'
      )
    ORDER BY procedure.proname;
  `);
  check(
    "verification retention RPCs are fixed-path and service-only",
    verificationRetentionCatalog.length === 3
      && verificationRetentionCatalog.every((row) => row.endsWith("|t|t|f|f|t")),
    verificationRetentionCatalog.join("; "),
  );
  const legacyCleanupDefinition = catalogRows(`
    SELECT
      pg_catalog.strpos(
        pg_catalog.pg_get_functiondef(
          'public.delete_expired_verification_documents()'::pg_catalog.regprocedure
        ),
        'DELETE FROM storage.objects'
      ) = 0,
      pg_catalog.strpos(
        pg_catalog.pg_get_functiondef(
          'public.delete_expired_verification_documents()'::pg_catalog.regprocedure
        ),
        'verification cleanup deprecated'
      ) > 0;
  `);
  check(
    "legacy cleanup is disabled and cannot delete Storage metadata",
    legacyCleanupDefinition[0] === "t|t",
    legacyCleanupDefinition[0],
  );

  const searchCatalog = catalogRows(`
    SELECT
      procedure.prosecdef,
      procedure.proconfig = ARRAY['search_path=""'],
      pg_catalog.has_function_privilege('anon', procedure.oid, 'EXECUTE'),
      pg_catalog.has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
    FROM pg_catalog.pg_proc AS procedure
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
      AND procedure.oid = 'public.search_ai_knowledge_entries(text,integer,integer)'::pg_catalog.regprocedure;
  `);
  check(
    "search RPC has an empty path and preserved public/authenticated execute",
    searchCatalog[0] === "f|t|t|t",
    searchCatalog[0],
  );

  const defaultAcl = catalogRows(`
    SELECT
      NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_default_acl AS defaults
        CROSS JOIN LATERAL pg_catalog.aclexplode(defaults.defaclacl) AS acl
        JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = defaults.defaclnamespace
        WHERE defaults.defaclrole = 'postgres'::pg_catalog.regrole
          AND namespace.nspname = 'public'
          AND defaults.defaclobjtype = 'f'
          AND acl.grantee IN (
            0,
            'anon'::pg_catalog.regrole,
            'authenticated'::pg_catalog.regrole
          )
          AND acl.privilege_type = 'EXECUTE'
      ),
      EXISTS (
        SELECT 1
        FROM pg_catalog.pg_default_acl AS defaults
        CROSS JOIN LATERAL pg_catalog.aclexplode(defaults.defaclacl) AS acl
        JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = defaults.defaclnamespace
        WHERE defaults.defaclrole = 'postgres'::pg_catalog.regrole
          AND namespace.nspname = 'public'
          AND defaults.defaclobjtype = 'f'
          AND acl.grantee = 'service_role'::pg_catalog.regrole
          AND acl.privilege_type = 'EXECUTE'
      );
  `);
  check(
    "postgres future-function defaults are private with service-role execute",
    defaultAcl[0] === "t|t",
    defaultAcl[0],
  );

  for (const table of ["facilities", "rooms"]) {
    const publicRead = await anon.from(table).select("id").limit(1);
    check(
      `public can still read a known ${table} fixture`,
      !publicRead.error && (publicRead.data?.length ?? 0) > 0,
      publicRead.error?.message,
    );
  }

  const facility = {
    name: `Disposable ${suffix}`,
    slug: `disposable-${suffix}`,
    category: "academic",
    latitude: 10.74,
    longitude: 124.79,
  };
  const disposableFacility = await service
    .from("facilities")
    .insert(facility)
    .select("id")
    .single();
  if (disposableFacility.error || !disposableFacility.data?.id) {
    throw new Error("Unable to create the disposable facility fixture.");
  }
  disposableFacilityId = disposableFacility.data.id;
  const disposableRoom = await service
    .from("rooms")
    .insert({
      facility_id: disposableFacilityId,
      room_code: `SAFE-${suffix.slice(0, 8)}`,
      name: "Disposable room",
    })
    .select("id")
    .single();
  if (disposableRoom.error || !disposableRoom.data?.id) {
    throw new Error("Unable to create the disposable room fixture.");
  }
  disposableRoomId = disposableRoom.data.id;

  check(
    "student cannot insert facilities",
    denied(await student.from("facilities").insert({
      ...facility,
      slug: `forbidden-${suffix}`,
    })),
  );
  check(
    "student cannot update facilities",
    changedNothing(
      await student
        .from("facilities")
        .update({ name: "Forbidden" })
        .eq("id", disposableFacilityId)
        .select("id"),
    ),
  );
  check(
    "student cannot delete facilities",
    changedNothing(
      await student.from("facilities").delete().eq("id", disposableFacilityId).select("id"),
    ),
  );
  check(
    "student cannot insert rooms",
    denied(await student.from("rooms").insert({
      facility_id: disposableFacilityId,
      room_code: "NOPE",
    })),
  );
  check(
    "student cannot update rooms",
    changedNothing(
      await student.from("rooms").update({ name: "Forbidden" }).eq("id", disposableRoomId).select("id"),
    ),
  );
  check(
    "student cannot delete rooms",
    changedNothing(await student.from("rooms").delete().eq("id", disposableRoomId).select("id")),
  );

  const seededSuggestion = await service
    .from("suggestions")
    .insert({
      type: "ADD_FACILITY",
      status: "PENDING",
      payload: { name: `Trusted pending ${suffix}` },
    })
    .select("id")
    .single();
  if (seededSuggestion.error || !seededSuggestion.data?.id) {
    throw new Error("Unable to seed the trusted suggestion disclosure fixture.");
  }
  seededSuggestionId = seededSuggestion.data.id;

  const suggestionRead = await student
    .from("suggestions")
    .select("id")
    .eq("id", seededSuggestionId);
  check(
    "student cannot read a known trusted pending suggestion",
    denied(suggestionRead) || (!suggestionRead.error && suggestionRead.data?.length === 0),
    suggestionRead.error?.message,
  );
  const suggestionDelete = await student
    .from("suggestions")
    .delete()
    .eq("id", seededSuggestionId)
    .select("id");
  check(
    "student cannot delete a known trusted pending suggestion",
    changedNothing(suggestionDelete),
  );
  const suggestionSurvives = await service
    .from("suggestions")
    .select("id")
    .eq("id", seededSuggestionId)
    .single();
  check(
    "trusted pending suggestion survives the student's read/delete attempts",
    !suggestionSurvives.error && suggestionSurvives.data?.id === seededSuggestionId,
    suggestionSurvives.error?.message,
  );
  check(
    "student cannot bypass server-controlled pending suggestion submission",
    denied(await student.from("suggestions").insert({
      type: "ADD_FACILITY",
      status: "PENDING",
      payload: { name: "Forbidden" },
    })),
  );
  check(
    "student cannot call cleanup RPC",
    denied(await student.rpc("delete_expired_verification_documents")),
  );

  for (const rpc of [
    "delete_expired_verification_documents",
    "enforce_owner_listing_transition",
    "propagate_owner_display_name",
    "recompute_boarding_house_rating",
    "set_boarding_house_owner_display_name",
  ]) {
    const result = await anon.rpc(rpc);
    check(`anon cannot execute ${rpc}`, Boolean(result.error), result.error?.message);
  }

  const studentRole = await student.rpc("has_app_role", { required_role: "admin" });
  check(
    "authenticated has_app_role remains callable",
    !studentRole.error && studentRole.data === false,
    studentRole.error?.message,
  );
  const adminRole = await admin.rpc("has_app_role", { required_role: "admin" });
  check(
    "admin role check remains usable by admin policies",
    !adminRole.error && adminRole.data === true,
    adminRole.error?.message,
  );

  const adminFacilityInput = {
    ...facility,
    name: `Admin disposable ${suffix}`,
    slug: `admin-disposable-${suffix}`,
  };
  const adminFacility = await admin
    .from("facilities")
    .insert(adminFacilityInput)
    .select("id")
    .single();
  check(
    "admin policy can insert facilities",
    !adminFacility.error && Boolean(adminFacility.data?.id),
    adminFacility.error?.message,
  );
  if (adminFacility.data?.id) {
    adminFacilityId = adminFacility.data.id;
    const adminRoom = await admin
      .from("rooms")
      .insert({
        facility_id: adminFacility.data.id,
        room_code: `QA-${suffix.slice(0, 8)}`,
      })
      .select("id")
      .single();
    check(
      "admin policy can insert rooms",
      !adminRoom.error && Boolean(adminRoom.data?.id),
      adminRoom.error?.message,
    );
    const adminUpdate = await admin
      .from("facilities")
      .update({ name: `Allowed ${suffix}` })
      .eq("id", adminFacility.data.id)
      .select("id");
    check(
      "admin policy can update facilities",
      !adminUpdate.error && adminUpdate.data?.length === 1,
      adminUpdate.error?.message,
    );
    const adminDelete = await admin
      .from("facilities")
      .delete()
      .eq("id", adminFacility.data.id)
      .select("id");
    check(
      "admin policy can delete facilities and cascading rooms",
      !adminDelete.error && adminDelete.data?.length === 1,
      adminDelete.error?.message,
    );
    if (!adminDelete.error && adminDelete.data?.length === 1) adminFacilityId = null;
  }

  const serviceRead = await service.from("suggestions").select("id").limit(1);
  check("service operations retain suggestion access", !serviceRead.error, serviceRead.error?.message);
  const serviceCleanup = await service.rpc("delete_expired_verification_documents");
  check(
    "service cannot invoke deprecated metadata-only cleanup",
    Boolean(serviceCleanup.error),
    serviceCleanup.error?.message,
  );

  const ownerIdentity = await owner.auth.getUser();
  const ownerProfile = await service
    .from("owner_profiles")
    .select("id,display_name")
    .eq("user_id", ownerIdentity.data.user?.id)
    .single();
  if (ownerProfile.error || !ownerProfile.data) {
    throw new Error("Unable to load the trigger owner fixture.");
  }
  triggerOwnerProfileId = ownerProfile.data.id;
  originalOwnerDisplayName = ownerProfile.data.display_name;

  const ownerApplication = await service
    .from("owner_applications")
    .select("id,user_id")
    .eq("user_id", ownerIdentity.data.user?.id)
    .limit(1)
    .single();
  if (ownerApplication.error || !ownerApplication.data) {
    throw new Error("Unable to load the verification retention fixture.");
  }
  const verificationDocument = await service
    .from("owner_verification_documents")
    .insert({
      application_id: ownerApplication.data.id,
      user_id: ownerApplication.data.user_id,
      storage_bucket: "boarding-house-verification",
      storage_path: `${ownerApplication.data.user_id}/${ownerApplication.data.id}/fixture-${suffix}.pdf`,
      original_filename: "fixture.pdf",
      mime_type: "application/pdf",
      size_bytes: 128,
      delete_after: "2020-01-01T00:00:00.000Z",
    })
    .select("id")
    .single();
  if (verificationDocument.error || !verificationDocument.data?.id) {
    throw new Error("Unable to seed the verification retention fixture.");
  }
  verificationDocumentId = verificationDocument.data.id;
  const firstClaim = await service.rpc("claim_expired_verification_documents", {
    p_now: "2026-07-29T00:00:00.000Z",
    p_limit: 1,
    p_lease_seconds: 900,
  });
  const claimedDocument = firstClaim.data?.find((row) => row.id === verificationDocumentId);
  check(
    "verification retention claims the exact expired fixture with a lease token",
    !firstClaim.error && Boolean(claimedDocument?.claim_token),
    firstClaim.error?.message,
  );
  if (!claimedDocument?.claim_token) {
    throw new Error("Verification retention did not claim its fixture.");
  }
  const wrongCompletion = await service.rpc("complete_verification_document_deletion", {
    p_document_id: verificationDocumentId,
    p_claim_token: randomUUID(),
  });
  const afterWrongCompletion = await service
    .from("owner_verification_documents")
    .select("id")
    .eq("id", verificationDocumentId)
    .single();
  check(
    "wrong verification claim token cannot delete the retained row",
    !wrongCompletion.error
      && wrongCompletion.data === false
      && !afterWrongCompletion.error,
    wrongCompletion.error?.message ?? afterWrongCompletion.error?.message,
  );
  const releaseClaim = await service.rpc("release_verification_document_deletion", {
    p_document_id: verificationDocumentId,
    p_claim_token: claimedDocument.claim_token,
  });
  const repeatedRelease = await service.rpc("release_verification_document_deletion", {
    p_document_id: verificationDocumentId,
    p_claim_token: claimedDocument.claim_token,
  });
  check(
    "verification claim release is exact and idempotent",
    !releaseClaim.error
      && releaseClaim.data === true
      && !repeatedRelease.error
      && repeatedRelease.data === false,
    releaseClaim.error?.message ?? repeatedRelease.error?.message,
  );
  const leaseStart = "2026-07-29T01:00:00.000Z";
  const leasedClaim = await service.rpc("claim_expired_verification_documents", {
    p_now: leaseStart,
    p_limit: 1,
    p_lease_seconds: 900,
  });
  const leasedDocument = leasedClaim.data?.find((row) => row.id === verificationDocumentId);
  const earlyRecovery = await service.rpc("claim_expired_verification_documents", {
    p_now: "2026-07-29T01:14:59.000Z",
    p_limit: 1,
    p_lease_seconds: 900,
  });
  const staleRecovery = await service.rpc("claim_expired_verification_documents", {
    p_now: "2026-07-29T01:15:01.000Z",
    p_limit: 1,
    p_lease_seconds: 900,
  });
  const recoveredDocument = staleRecovery.data?.find((row) => row.id === verificationDocumentId);
  check(
    "verification leases block early reclaim and recover after expiry",
    !leasedClaim.error
      && Boolean(leasedDocument?.claim_token)
      && !earlyRecovery.error
      && (earlyRecovery.data?.length ?? 0) === 0
      && !staleRecovery.error
      && Boolean(recoveredDocument?.claim_token)
      && recoveredDocument?.claim_token !== leasedDocument?.claim_token,
    leasedClaim.error?.message
      ?? earlyRecovery.error?.message
      ?? staleRecovery.error?.message,
  );
  if (recoveredDocument?.claim_token) {
    const releaseRecoveredClaim = await service.rpc("release_verification_document_deletion", {
      p_document_id: verificationDocumentId,
      p_claim_token: recoveredDocument.claim_token,
    });
    check(
      "recovered verification lease releases with its new exact token",
      !releaseRecoveredClaim.error && releaseRecoveredClaim.data === true,
      releaseRecoveredClaim.error?.message,
    );
  }

  const triggerListing = await service
    .from("boarding_house_listings")
    .insert({
      owner_id: triggerOwnerProfileId,
      slug: `hardening-trigger-${suffix}`,
      name: `Hardening trigger ${suffix}`,
      description: "",
      address_line: "Local trigger test address",
      latitude: 10.74,
      longitude: 124.79,
      status: "draft",
      verification_status: "unverified",
      owner_display_name: "Caller supplied value",
    })
    .select("id,owner_display_name,status,verification_status")
    .single();
  if (triggerListing.error || !triggerListing.data) {
    throw new Error(`Unable to create trigger listing fixture: ${triggerListing.error?.message ?? ""}`);
  }
  triggerListingId = triggerListing.data.id;
  check(
    "owner-name trigger replaces caller input with the profile display name",
    triggerListing.data.owner_display_name === originalOwnerDisplayName,
    triggerListing.data.owner_display_name,
  );

  const propagatedName = `Trigger Owner ${suffix.slice(0, 8)}`;
  const propagate = await service
    .from("owner_profiles")
    .update({ display_name: propagatedName })
    .eq("id", triggerOwnerProfileId);
  const propagatedListing = await service
    .from("boarding_house_listings")
    .select("owner_display_name")
    .eq("id", triggerListingId)
    .single();
  check(
    "owner-name propagation trigger updates existing listing snapshots",
    !propagate.error
      && !propagatedListing.error
      && propagatedListing.data?.owner_display_name === propagatedName,
    propagate.error?.message ?? propagatedListing.error?.message,
  );

  const forbiddenTransition = await owner
    .from("boarding_house_listings")
    .update({ status: "published", verification_status: "verified" })
    .eq("id", triggerListingId)
    .select("id");
  const unchangedTransition = await service
    .from("boarding_house_listings")
    .select("status,verification_status")
    .eq("id", triggerListingId)
    .single();
  check(
    "listing-transition trigger prevents an owner from self-publishing",
    (Boolean(forbiddenTransition.error) || forbiddenTransition.data?.length === 0)
      && unchangedTransition.data?.status === "draft"
      && unchangedTransition.data?.verification_status === "unverified",
    forbiddenTransition.error?.message ?? unchangedTransition.error?.message,
  );

  const studentIdentity = await student.auth.getUser();
  const triggerReview = await service
    .from("boarding_house_reviews")
    .insert({
      listing_id: triggerListingId,
      author_id: studentIdentity.data.user?.id,
      author_display_name: "Local Student",
      rating: 4,
      body: "Trigger aggregation fixture",
      status: "approved",
    })
    .select("id")
    .single();
  if (triggerReview.error || !triggerReview.data?.id) {
    throw new Error(`Unable to create trigger review fixture: ${triggerReview.error?.message ?? ""}`);
  }
  triggerReviewId = triggerReview.data.id;
  const ratedListing = await service
    .from("boarding_house_listings")
    .select("avg_rating,rating_count")
    .eq("id", triggerListingId)
    .single();
  check(
    "rating trigger recomputes the listing aggregate after insert",
    !ratedListing.error
      && Number(ratedListing.data?.avg_rating) === 4
      && ratedListing.data?.rating_count === 1,
    ratedListing.error?.message,
  );
  const deleteTriggerReview = await service
    .from("boarding_house_reviews")
    .delete()
    .eq("id", triggerReviewId);
  if (!deleteTriggerReview.error) triggerReviewId = null;
  const unratedListing = await service
    .from("boarding_house_listings")
    .select("avg_rating,rating_count")
    .eq("id", triggerListingId)
    .single();
  check(
    "rating trigger recomputes the listing aggregate after delete",
    !deleteTriggerReview.error
      && !unratedListing.error
      && Number(unratedListing.data?.avg_rating) === 0
      && unratedListing.data?.rating_count === 0,
    deleteTriggerReview.error?.message ?? unratedListing.error?.message,
  );

  const eventWrite = await student.storage
    .from("event-images")
    .upload(`hardening/${suffix}.txt`, new Blob(["blocked"], { type: "text/plain" }));
  if (!eventWrite.error) {
    const cleanupUnexpectedUpload = await service.storage
      .from("event-images")
      .remove([`hardening/${suffix}.txt`]);
    check(
      "unexpected event-images write is removed before failing",
      !cleanupUnexpectedUpload.error,
      cleanupUnexpectedUpload.error?.message,
    );
  }
  check("event-images write remains denied", Boolean(eventWrite.error), eventWrite.error?.message);

  const searchToken = `hardeningsearch${suffix.slice(0, 8)}`;
  const knowledgeFixture = await service
    .from("ai_knowledge_entries")
    .insert({
      title: `Retention fixture ${searchToken}`,
      content: `Known public search fixture ${searchToken}`,
      keywords: [searchToken],
      source: "local-adversarial-harness",
      is_active: true,
      priority: 100,
    })
    .select("id")
    .single();
  if (knowledgeFixture.error || !knowledgeFixture.data?.id) {
    throw new Error("Unable to seed the public search fixture.");
  }
  knowledgeFixtureId = knowledgeFixture.data.id;
  const publicSearch = await anon.rpc("search_ai_knowledge_entries", {
    search_query: searchToken,
    match_limit: 3,
    fetch_limit: 10,
  });
  check(
    "public AI knowledge search keeps its result contract",
    !publicSearch.error
      && Array.isArray(publicSearch.data)
      && publicSearch.data.length > 0
      && publicSearch.data.every((row) => typeof row.search_rank === "number"),
    publicSearch.error?.message,
  );

  } finally {
    if (knowledgeFixtureId) {
      const cleanup = await service.from("ai_knowledge_entries").delete().eq("id", knowledgeFixtureId);
      check("cleanup removes the public search fixture", !cleanup.error, cleanup.error?.message);
    }
    if (verificationDocumentId) {
      const cleanup = await service
        .from("owner_verification_documents")
        .delete()
        .eq("id", verificationDocumentId);
      check("cleanup removes the verification retention fixture", !cleanup.error, cleanup.error?.message);
    }
    if (triggerReviewId) {
      const cleanup = await service.from("boarding_house_reviews").delete().eq("id", triggerReviewId);
      check("cleanup removes trigger review fixture", !cleanup.error, cleanup.error?.message);
    }
    if (triggerListingId) {
      const cleanup = await service.from("boarding_house_listings").delete().eq("id", triggerListingId);
      check("cleanup removes trigger listing fixture", !cleanup.error, cleanup.error?.message);
    }
    if (triggerOwnerProfileId && originalOwnerDisplayName) {
      const cleanup = await service
        .from("owner_profiles")
        .update({ display_name: originalOwnerDisplayName })
        .eq("id", triggerOwnerProfileId);
      check("cleanup restores the owner display name", !cleanup.error, cleanup.error?.message);
    }
    if (seededSuggestionId) {
      const cleanup = await service.from("suggestions").delete().eq("id", seededSuggestionId);
      check("cleanup removes the trusted suggestion fixture", !cleanup.error, cleanup.error?.message);
    }
    if (adminFacilityId) {
      const cleanup = await service.from("facilities").delete().eq("id", adminFacilityId);
      check("cleanup removes the admin facility fixture", !cleanup.error, cleanup.error?.message);
    }
    if (disposableRoomId) {
      const cleanup = await service.from("rooms").delete().eq("id", disposableRoomId);
      check("cleanup removes the disposable room fixture", !cleanup.error, cleanup.error?.message);
    }
    if (disposableFacilityId) {
      const cleanup = await service.from("facilities").delete().eq("id", disposableFacilityId);
      check("cleanup removes the disposable facility fixture", !cleanup.error, cleanup.error?.message);
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exitCode = failed > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error(`Authenticated student hardening harness error: ${error.message}`);
  process.exit(2);
});
