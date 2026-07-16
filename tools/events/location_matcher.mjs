export function normalizeText(input) {
  return String(input ?? "")
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SYNONYMS = new Map([
  ["upper oval", { kind: "code", key: "oval" }],
  ["vsu gym", { kind: "code", key: "gym" }],
  ["convention", { kind: "name", key: "vsu convention center" }],
  ["convention center", { kind: "name", key: "vsu convention center" }],
  ["upper court", { kind: "name", key: "vsu upper volleyball court" }],
  ["upper court 1", { kind: "name", key: "vsu upper volleyball court" }],
  ["upper court 2", { kind: "name", key: "vsu upper volleyball court" }],
  ["upper campus c1", { kind: "name", key: "vsu upper basketball court" }],
  ["upper campus c2", { kind: "name", key: "vsu upper basketball court" }],
  ["court near apartelle", { kind: "name", key: "vsu apartelle" }],
  ["molave hill", { kind: "name", key: "vsu swimming pool" }],
  ["rde hall", { kind: "name", key: "rde" }],
  ["eb slh", { kind: "code", key: "cet" }],
]);

export function buildFacilityIndexes(facilities) {
  const facilitiesByName = new Map();
  const facilitiesByCode = new Map();

  for (const f of facilities ?? []) {
    const nameNorm = normalizeText(f.name);
    if (nameNorm) facilitiesByName.set(nameNorm, f);
    const codeNorm = normalizeText(f.code);
    if (codeNorm) facilitiesByCode.set(codeNorm, f);
  }

  return { facilitiesByName, facilitiesByCode };
}

export function matchFacilityForEvent(
  { title, locationText },
  { facilitiesByName, facilitiesByCode }
) {
  const raw = String(locationText ?? "").trim();
  if (!raw) return null;

  const norm = normalizeText(raw);
  if (!norm) return null;

  if (norm === "lower campus") {
    const titleNorm = normalizeText(title);
    if (titleNorm.includes("tennis")) {
      const tennis = facilitiesByName.get(normalizeText("lawn tennis court"));
      if (tennis) return { facility: tennis, reason: "lower-campus:tennis" };
    }
    if (titleNorm.includes("futsal")) {
      const futsal = facilitiesByName.get(normalizeText("lower basketball court"));
      if (futsal) return { facility: futsal, reason: "lower-campus:futsal" };
    }
  }

  const byName = facilitiesByName.get(norm);
  if (byName) return { facility: byName, reason: "name" };

  const byCode = facilitiesByCode.get(norm);
  if (byCode) return { facility: byCode, reason: "code" };

  const firstToken = norm.split(" ")[0];
  if (firstToken) {
    const byPrefix = facilitiesByCode.get(firstToken);
    if (byPrefix) return { facility: byPrefix, reason: "code-prefix" };
  }

  const withoutTrailingNumber = norm.replace(/\s+\d+$/, "");
  if (withoutTrailingNumber !== norm) {
    const byStripped = facilitiesByName.get(withoutTrailingNumber);
    if (byStripped) return { facility: byStripped, reason: "name-stripped-number" };
  }

  const campusCourtMatch = norm.match(/\bupper campus\s+c(\d)\b/);
  if (campusCourtMatch) {
    const courtNorm = normalizeText(`upper campus court ${campusCourtMatch[1]}`);
    const byCourt = facilitiesByName.get(courtNorm);
    if (byCourt) return { facility: byCourt, reason: "upper-campus-court" };
  }

  const synonym = SYNONYMS.get(norm);
  if (synonym) {
    const keyNorm = normalizeText(synonym.key);
    const resolved =
      synonym.kind === "code"
        ? facilitiesByCode.get(keyNorm)
        : facilitiesByName.get(keyNorm);
    if (resolved) return { facility: resolved, reason: `syn:${norm}` };
  }

  if (UUID_RE.test(norm)) return null;
  return null;
}

