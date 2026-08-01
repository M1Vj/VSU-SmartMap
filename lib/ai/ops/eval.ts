export type EvalPriority = "P0" | "P1";
export type EvalDomain = "facility" | "room" | "event" | "boarding_house";

export interface EvalRecord {
  id: string;
  name: string;
  domain: EvalDomain;
  url?: string;
}

export interface ChatEvalCase {
  id: string;
  category: string;
  priority: EvalPriority;
  query: string;
  referenceRecords: EvalRecord[];
  retrievedRecords: EvalRecord[];
  expected: {
    relevantIds: string[];
    mustAbstain: boolean;
    allowedDomains: EvalDomain[];
    prohibitedPhrases: string[];
  };
  response: {
    text: string;
    abstained: boolean;
    references: EvalRecord[];
  };
}

export type EvalFailureCode =
  | "DOMAIN_VIOLATION"
  | "INVALID_REFERENCE"
  | "MUST_ABSTAIN"
  | "PROHIBITED_BEHAVIOR"
  | "RETRIEVAL_MISS"
  | "UNSAFE_LINK";

interface EvalFailure {
  code: EvalFailureCode;
  message: string;
}

export interface ChatEvalReport {
  schemaVersion: 1;
  cases: Array<{
    id: string;
    category: string;
    priority: EvalPriority;
    passed: boolean;
    recallAtK: number;
    reciprocalRank: number;
    failures: EvalFailure[];
  }>;
  summary: {
    total: number;
    passed: number;
    failed: number;
    p0Failures: number;
    recallAtK: number;
    mrr: number;
  };
}

const DOMAINS = new Set<EvalDomain>([
  "facility",
  "room",
  "event",
  "boarding_house",
]);

function objectAt(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }
  return value as Record<string, unknown>;
}

function stringAt(value: unknown, path: string, max = 500): string {
  if (typeof value !== "string" || value.length === 0 || value.length > max) {
    throw new Error(`${path} must be a non-empty string of at most ${max} characters`);
  }
  return value;
}

function booleanAt(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") throw new Error(`${path} must be a boolean`);
  return value;
}

function arrayAt(value: unknown, path: string, max = 50): unknown[] {
  if (!Array.isArray(value) || value.length > max) {
    throw new Error(`${path} must be an array with at most ${max} items`);
  }
  return value;
}

function recordAt(value: unknown, path: string): EvalRecord {
  const record = objectAt(value, path);
  const domain = stringAt(record.domain, `${path}.domain`, 40);
  if (!DOMAINS.has(domain as EvalDomain)) {
    throw new Error(`${path}.domain is invalid`);
  }
  return {
    id: stringAt(record.id, `${path}.id`, 100),
    name: stringAt(record.name, `${path}.name`, 200),
    domain: domain as EvalDomain,
    ...(record.url === undefined
      ? {}
      : { url: stringAt(record.url, `${path}.url`, 500) }),
  };
}

function stringArrayAt(value: unknown, path: string): string[] {
  return arrayAt(value, path).map((item, index) =>
    stringAt(item, `${path}[${index}]`, 200),
  );
}

export function parseEvalCase(value: unknown): ChatEvalCase {
  const candidate = objectAt(value, "case");
  const priority = stringAt(candidate.priority, "priority", 2);
  if (priority !== "P0" && priority !== "P1") {
    throw new Error("priority must be P0 or P1");
  }
  const expected = objectAt(candidate.expected, "expected");
  const response = objectAt(candidate.response, "response");
  const allowedDomains = stringArrayAt(expected.allowedDomains, "expected.allowedDomains");
  if (allowedDomains.some((domain) => !DOMAINS.has(domain as EvalDomain))) {
    throw new Error("expected.allowedDomains contains an invalid domain");
  }

  return {
    id: stringAt(candidate.id, "id", 100),
    category: stringAt(candidate.category, "category", 100),
    priority,
    query: stringAt(candidate.query, "query", 250),
    referenceRecords: arrayAt(candidate.referenceRecords, "referenceRecords").map(
      (record, index) => recordAt(record, `referenceRecords[${index}]`),
    ),
    retrievedRecords: arrayAt(candidate.retrievedRecords, "retrievedRecords").map(
      (record, index) => recordAt(record, `retrievedRecords[${index}]`),
    ),
    expected: {
      relevantIds: stringArrayAt(expected.relevantIds, "expected.relevantIds"),
      mustAbstain: booleanAt(expected.mustAbstain, "expected.mustAbstain"),
      allowedDomains: allowedDomains as EvalDomain[],
      prohibitedPhrases: stringArrayAt(
        expected.prohibitedPhrases,
        "expected.prohibitedPhrases",
      ),
    },
    response: {
      text: stringAt(response.text, "response.text", 4000),
      abstained: booleanAt(response.abstained, "response.abstained"),
      references: arrayAt(response.references, "response.references").map(
        (record, index) => recordAt(record, `response.references[${index}]`),
      ),
    },
  };
}

function recordKey(record: EvalRecord): string {
  return `${record.id}\u0000${record.name}\u0000${record.domain}`;
}

function hasUnsafeLink(text: string): boolean {
  const markdownDestinations = [...text.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+[^)]*)?\)/g)].map(
    (match) => match[1],
  );
  return markdownDestinations.some(
    (destination) =>
      destination.startsWith("//") ||
      (!destination.startsWith("/") && !destination.startsWith("#")),
  );
}

function evaluateCase(candidate: ChatEvalCase): ChatEvalReport["cases"][number] {
  const fixture = parseEvalCase(candidate);
  const failures: EvalFailure[] = [];
  const canonical = new Map(fixture.referenceRecords.map((record) => [record.id, record]));
  const canonicalKeys = new Set(fixture.referenceRecords.map(recordKey));
  const retrievedKeys = new Set(fixture.retrievedRecords.map(recordKey));
  const relevant = new Set(fixture.expected.relevantIds);

  for (const id of relevant) {
    if (!canonical.has(id)) {
      failures.push({ code: "INVALID_REFERENCE", message: `Relevant ID ${id} is not canonical` });
    }
  }
  for (const record of [...fixture.retrievedRecords, ...fixture.response.references]) {
    if (!canonicalKeys.has(recordKey(record))) {
      failures.push({ code: "INVALID_REFERENCE", message: `Reference ${record.id} is not canonical` });
    }
  }
  for (const record of fixture.response.references) {
    if (!retrievedKeys.has(recordKey(record))) {
      failures.push({ code: "INVALID_REFERENCE", message: `Reference ${record.id} was not retrieved` });
    }
    if (!fixture.expected.allowedDomains.includes(record.domain)) {
      failures.push({ code: "DOMAIN_VIOLATION", message: `Domain ${record.domain} is not allowed` });
    }
    if (record.url && (record.url.startsWith("//") || !record.url.startsWith("/"))) {
      failures.push({ code: "UNSAFE_LINK", message: `Reference ${record.id} has an unsafe URL` });
    }
  }
  if (fixture.expected.mustAbstain && !fixture.response.abstained) {
    failures.push({ code: "MUST_ABSTAIN", message: "Response was required to abstain" });
  }
  const normalizedText = fixture.response.text.toLocaleLowerCase("en-US");
  if (
    fixture.expected.prohibitedPhrases.some((phrase) =>
      normalizedText.includes(phrase.toLocaleLowerCase("en-US")),
    )
  ) {
    failures.push({ code: "PROHIBITED_BEHAVIOR", message: "Response contains prohibited content" });
  }
  if (hasUnsafeLink(fixture.response.text)) {
    failures.push({ code: "UNSAFE_LINK", message: "Response contains an unsafe Markdown link" });
  }

  const hits = fixture.retrievedRecords.filter((record) => relevant.has(record.id)).length;
  const recallAtK = relevant.size === 0 ? 1 : hits / relevant.size;
  const firstRelevantIndex = fixture.retrievedRecords.findIndex((record) => relevant.has(record.id));
  const reciprocalRank = relevant.size === 0 ? 1 : firstRelevantIndex < 0 ? 0 : 1 / (firstRelevantIndex + 1);
  if (relevant.size > 0 && hits === 0) {
    failures.push({ code: "RETRIEVAL_MISS", message: "No relevant record was retrieved" });
  }

  return {
    id: fixture.id,
    category: fixture.category,
    priority: fixture.priority,
    passed: failures.length === 0,
    recallAtK,
    reciprocalRank,
    failures,
  };
}

export function evaluateDataset(cases: ChatEvalCase[]): ChatEvalReport {
  if (!Array.isArray(cases) || cases.length === 0) {
    throw new Error("dataset must contain at least one case");
  }
  const results = cases.map(evaluateCase);
  const failed = results.filter((result) => !result.passed);
  return {
    schemaVersion: 1,
    cases: results,
    summary: {
      total: results.length,
      passed: results.length - failed.length,
      failed: failed.length,
      p0Failures: failed.filter((result) => result.priority === "P0").length,
      recallAtK: results.reduce((sum, result) => sum + result.recallAtK, 0) / results.length,
      mrr: results.reduce((sum, result) => sum + result.reciprocalRank, 0) / results.length,
    },
  };
}
