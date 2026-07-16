import test from "node:test";
import assert from "node:assert/strict";

import { selectAiKnowledgeForQuery } from "../supabase/queries/ai-knowledge.ts";
import type { AiKnowledgeEntryRow } from "../types/ai-knowledge.ts";

const makeRow = (overrides: Partial<AiKnowledgeEntryRow>): AiKnowledgeEntryRow => ({
  id: overrides.id ?? "entry-1",
  title: overrides.title ?? "Sample Entry",
  content: overrides.content ?? "Sample content",
  keywords: overrides.keywords ?? [],
  source: overrides.source ?? null,
  is_active: overrides.is_active ?? true,
  priority: overrides.priority ?? 0,
  created_at: overrides.created_at ?? "2026-05-30T00:00:00.000Z",
  updated_at: overrides.updated_at ?? "2026-05-30T00:00:00.000Z",
});

test("selectAiKnowledgeForQuery ranks matching active entries and excludes inactive rows", () => {
  const entries = [
    makeRow({
      id: "registrar",
      title: "Registrar Office",
      content: "Transcript requests, enrollment records, and academic documents.",
      keywords: ["records", "transcript"],
      priority: 1,
    }),
    makeRow({
      id: "inactive",
      title: "Inactive Transcript Process",
      content: "Old transcript instructions.",
      keywords: ["transcript"],
      is_active: false,
      priority: 100,
    }),
    makeRow({
      id: "library",
      title: "Library Hours",
      content: "Open reading areas and book borrowing.",
      keywords: ["books"],
      priority: 10,
    }),
  ];

  const selected = selectAiKnowledgeForQuery(entries, "How do I request transcript records?");

  assert.deepEqual(
    selected.map((entry) => entry.id),
    ["registrar"]
  );
});

test("selectAiKnowledgeForQuery expands local campus aliases", () => {
  const entries = [
    makeRow({
      id: "style",
      title: "Assistant Style",
      content: "Answer in Taglish when the user writes in Tagalog.",
      keywords: ["tone"],
      priority: 100,
    }),
    makeRow({
      id: "restroom",
      title: "Comfort Room Guidance",
      content: "CR, restroom, bathroom, and toilet questions should return nearby utility facilities.",
      keywords: ["comfort room", "restroom", "toilet"],
      priority: 1,
    }),
  ];

  const selected = selectAiKnowledgeForQuery(entries, "Saan may CR?");

  assert.equal(selected[0].id, "restroom");
});
