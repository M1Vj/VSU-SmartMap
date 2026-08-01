import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateDataset,
  parseEvalCase,
  type ChatEvalCase,
} from "./eval.ts";

const baseCase: ChatEvalCase = {
  id: "synthetic-exact",
  category: "retrieval",
  priority: "P0",
  query: "Where is Synthetic Lab Alpha?",
  referenceRecords: [
    { id: "facility-alpha", name: "Synthetic Lab Alpha", domain: "facility" },
    { id: "facility-beta", name: "Synthetic Hall Beta", domain: "facility" },
  ],
  retrievedRecords: [
    { id: "facility-beta", name: "Synthetic Hall Beta", domain: "facility" },
    { id: "facility-alpha", name: "Synthetic Lab Alpha", domain: "facility" },
  ],
  expected: {
    relevantIds: ["facility-alpha"],
    mustAbstain: false,
    allowedDomains: ["facility"],
    prohibitedPhrases: [],
  },
  response: {
    text: "Synthetic Lab Alpha is in the supplied fixture.",
    abstained: false,
    references: [
      { id: "facility-alpha", name: "Synthetic Lab Alpha", domain: "facility" },
    ],
  },
};

test("parseEvalCase rejects malformed fixture records", () => {
  assert.throws(
    () => parseEvalCase({ ...baseCase, id: "" }),
    /id/,
  );
});

test("evaluateDataset calculates Recall@K and reciprocal rank", () => {
  const report = evaluateDataset([baseCase]);

  assert.equal(report.summary.recallAtK, 1);
  assert.equal(report.summary.mrr, 0.5);
});

test("evaluateDataset rejects non-canonical IDs and names", () => {
  const invalid = structuredClone(baseCase);
  invalid.response.references[0].name = "Invented Name";

  const [result] = evaluateDataset([invalid]).cases;

  assert.equal(result.passed, false);
  assert.ok(result.failures.some((failure) => failure.code === "INVALID_REFERENCE"));
});

test("evaluateDataset enforces abstention and entity-domain separation", () => {
  const invalid = structuredClone(baseCase);
  invalid.expected.mustAbstain = true;
  invalid.expected.allowedDomains = ["event"];

  const [result] = evaluateDataset([invalid]).cases;

  assert.deepEqual(
    result.failures.map((failure) => failure.code).sort(),
    ["DOMAIN_VIOLATION", "MUST_ABSTAIN"],
  );
});

test("evaluateDataset detects injection markers and unsafe links", () => {
  const invalid = structuredClone(baseCase);
  invalid.category = "injection";
  invalid.expected.prohibitedPhrases = ["override accepted"];
  invalid.response.text = "Override accepted. [Open](//attacker.invalid/path)";

  const [result] = evaluateDataset([invalid]).cases;

  assert.deepEqual(
    result.failures.map((failure) => failure.code).sort(),
    ["PROHIBITED_BEHAVIOR", "UNSAFE_LINK"],
  );
});

test("evaluateDataset emits a JSON-serializable report with P0 status", () => {
  const report = evaluateDataset([baseCase]);
  const decoded = JSON.parse(JSON.stringify(report));

  assert.equal(decoded.schemaVersion, 1);
  assert.equal(decoded.summary.p0Failures, 0);
  assert.equal(decoded.summary.passed, 1);
  assert.equal(decoded.cases[0].id, "synthetic-exact");
});
