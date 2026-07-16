# Chatbot Knowledge Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade campus assistant to `gemini-3.1-flash-lite` and ground answers in admin-managed VSU knowledge entries.

**Architecture:** Add `ai_knowledge_entries` as structured, admin-managed facts. Server-side query ranks active entries by keyword/text match and injects only top entries into chat prompt beside facilities/events. Admin gets CRUD UI following existing server action + client table/dialog pattern.

**Tech Stack:** Next.js App Router, Supabase, Genkit Google AI, Gemini `gemini-3.1-flash-lite`, node:test, React admin components.

---

### Task 1: Knowledge Data Layer

**Files:**
- Create: `supabase/migrations/20260530000000_ai_knowledge_entries.sql`
- Create: `lib/types/ai-knowledge.ts`
- Modify: `lib/types/index.ts`
- Create: `lib/supabase/queries/ai-knowledge.ts`
- Create: `lib/supabase/queries/ai-knowledge.server.ts`
- Test: `lib/ai/knowledge-context.test.ts`

Steps:
- [ ] Write failing test for selecting active knowledge by query and excluding inactive rows.
- [ ] Add types, query helpers, cached server helper, migration.
- [ ] Run targeted test and commit.

### Task 2: Admin Knowledge Management

**Files:**
- Create: `app/admin/ai-knowledge/page.tsx`
- Create: `app/admin/ai-knowledge/actions.ts`
- Create: `components/admin/ai-knowledge-manager.tsx`
- Modify: `components/admin/admin-sidebar.tsx`

Steps:
- [ ] Add create/update/delete server actions with Zod validation and service-role writes after auth check.
- [ ] Add admin page and client manager with table, dialog form, active toggle, delete confirm.
- [ ] Add sidebar item.
- [ ] Run lint/build checks and commit.

### Task 3: AI Model + Prompt Grounding

**Files:**
- Modify: `lib/ai/genkit.ts`
- Modify: `lib/ai/flows/find-location.ts`
- Modify: `lib/ai/prompts/campus-assistant.ts`
- Test: `lib/ai/knowledge-context.test.ts`

Steps:
- [ ] Switch Genkit default model to string model id `googleai/gemini-3.1-flash-lite` or supported Genkit string equivalent.
- [ ] Build reusable chat context function shared by streaming and non-streaming flows.
- [ ] Include top admin knowledge entries in prompt with instruction to prefer provided knowledge and say when missing.
- [ ] Apply room-code inference consistently to streaming and non-streaming.
- [ ] Run targeted AI context tests and commit.

### Task 4: Verification

**Files:** no new production files.

Steps:
- [ ] Run `node --import tsx --test` targeted tests.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Start `npm run dev` and browser-check `/admin/ai-knowledge` and `/chat` render.
- [ ] Final commit if any fixes.
