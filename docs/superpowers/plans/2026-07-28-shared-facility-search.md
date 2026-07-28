# Shared Facility Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the schedule course form the same ranked, room-aware, accessible facility search used by the map, backed by shared code.

**Architecture:** Extract facility loading, room lookup, option modeling, and combobox interaction from `AppHeader` into focused shared units. The map retains navigation-specific side effects and recent history; the schedule owns only its selected facility ID and form validation.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase JS, Dexie caches, React Hook Form, Node test runner, Playwright.

---

### Task 1: Define the shared option model

**Files:**
- Create: `lib/map/facility-search-model.ts`
- Create: `lib/map/facility-search-model.test.ts`
- Modify: `lib/map/search-suggestions.ts`

- [ ] **Step 1: Write the failing option-model tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { buildFacilitySearchOptions } from "./facility-search-model.ts";

test("maps ranked suggestions to one shared display model", () => {
  const options = buildFacilitySearchOptions({
    facilities: [{
      id: "11111111-1111-4111-8111-111111111111",
      name: "Department of Statistics",
      code: "DSTAT",
      category: "academic",
      description: "Statistics building",
      slug: "department-of-statistics",
      coordinates: { lat: 10.7, lng: 124.8 },
      hasRooms: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    }],
    rooms: [{
      facility_id: "11111111-1111-4111-8111-111111111111",
      room_code: "DSTAT-201",
      name: "Statistics Lab",
    }],
    query: "201",
  });

  assert.deepEqual(options.map(({ id, primary, secondary, matchedRoomCode }) => ({
    id,
    primary,
    secondary,
    matchedRoomCode,
  })), [{
    id: "11111111-1111-4111-8111-111111111111",
    primary: "Department of Statistics",
    secondary: "DSTAT · Academic · Room DSTAT-201",
    matchedRoomCode: "DSTAT-201",
  }]);
});

test("returns no options for a blank query and caps results at eight", () => {
  assert.deepEqual(buildFacilitySearchOptions({
    facilities: [],
    rooms: [],
    query: " ",
  }), []);
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```bash
rtk proxy node --import tsx --test lib/map/facility-search-model.test.ts
```

Expected: FAIL because `facility-search-model.ts` does not exist.

- [ ] **Step 3: Implement the option model**

```ts
import { getCategoryMeta } from "@/lib/constants/facilities";
import {
  getSearchSuggestions,
  type RoomSearchSource,
} from "@/lib/map/search-suggestions";
import type { Facility } from "@/lib/types/facility";

export type FacilitySearchOption = {
  id: string;
  facility: Facility;
  primary: string;
  secondary: string;
  color: string;
  matchedRoomCode?: string;
};

export function buildFacilitySearchOptions(input: {
  facilities: readonly Facility[];
  rooms: readonly RoomSearchSource[];
  query: string;
  limit?: number;
}): FacilitySearchOption[] {
  return getSearchSuggestions(input).map((suggestion) => {
    const meta = getCategoryMeta(suggestion.facility.category);
    const secondary = [
      suggestion.facility.code,
      meta.label,
      suggestion.matchedRoomCode
        ? `Room ${suggestion.matchedRoomCode}`
        : null,
    ].filter(Boolean).join(" · ");

    return {
      id: suggestion.facility.id,
      facility: suggestion.facility,
      primary: suggestion.facility.name,
      secondary: secondary || meta.label,
      color: meta.color,
      matchedRoomCode: suggestion.matchedRoomCode,
    };
  });
}
```

Keep `getSearchSuggestions` as the single ranking implementation. Export any
currently private input types needed by the model rather than duplicating them.

- [ ] **Step 4: Run focused and ranking tests**

Run:

```bash
rtk proxy node --import tsx --test lib/map/facility-search-model.test.ts lib/map/search-suggestions.test.ts
```

Expected: all tests PASS with the existing exact-code, prefix, name, alias, room,
stable ordering, and eight-result behavior unchanged.

- [ ] **Step 5: Commit**

```bash
rtk git add lib/map/facility-search-model.ts lib/map/facility-search-model.test.ts lib/map/search-suggestions.ts
rtk git commit -m "refactor(map): share facility search option model"
```

### Task 2: Extract cache-first facility and room loading

**Files:**
- Create: `lib/map/facility-search-loader.ts`
- Create: `lib/map/facility-search-loader.test.ts`
- Create: `components/facility/use-facility-search-data.ts`
- Modify: `components/app-header.tsx`
- Modify: `components/schedule/schedule-page-client.tsx`

- [ ] **Step 1: Write failing loader tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  loadFacilitySearchFacilities,
  loadFacilitySearchRooms,
} from "./facility-search-loader.ts";

test("publishes cache before a deferred refresh and treats remote empty as canonical", async () => {
  let resolveRemote!: (value: {
    data: readonly never[];
    error: null;
  }) => void;
  const remote = new Promise<{
    data: readonly never[];
    error: null;
  }>((resolve) => {
    resolveRemote = resolve;
  });
  const published: Array<{ ids: string[]; source: string }> = [];
  const cacheWrites: unknown[] = [];

  const pending = loadFacilitySearchFacilities({
    readCache: async () => [{ id: "cached", name: "Cached" }] as never,
    fetchRemote: async () => remote,
    writeCache: async (value) => { cacheWrites.push(value); },
    publish: (value, source) => {
      published.push({
        ids: value.map((item) => item.id),
        source,
      });
    },
  });

  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(published, [{ ids: ["cached"], source: "cache" }]);

  resolveRemote({ data: [], error: null });
  await pending;
  assert.deepEqual(published, [
    { ids: ["cached"], source: "cache" },
    { ids: [], source: "remote" },
  ]);
  assert.deepEqual(cacheWrites, [[]]);
});

test("does not query rooms below two trimmed characters", async () => {
  let called = false;
  const published: Array<{ count: number; source: string }> = [];
  await loadFacilitySearchRooms({
    query: " a ",
    readCache: async () => [],
    fetchRemote: async () => {
      called = true;
      return { data: [], error: null };
    },
    publish: (value, source) => {
      published.push({ count: value.length, source });
    },
  });
  assert.equal(called, false);
  assert.deepEqual(published, [{ count: 0, source: "empty" }]);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
rtk proxy node --import tsx --test lib/map/facility-search-loader.test.ts
```

Expected: FAIL because the loader module is absent.

- [ ] **Step 3: Implement dependency-injected loaders**

```ts
import type { Facility } from "@/lib/types/facility";
import type { RoomSearchSource } from "./search-suggestions";

export type SearchDataSource = "cache" | "remote" | "empty";

export async function loadFacilitySearchFacilities(deps: {
  readCache: () => Promise<readonly Facility[] | null>;
  fetchRemote: () => Promise<{
    data: readonly Facility[] | null;
    error: unknown;
  }>;
  writeCache: (value: readonly Facility[]) => Promise<unknown>;
  publish: (
    value: readonly Facility[],
    source: SearchDataSource,
  ) => void;
}) {
  const cached = await deps.readCache();
  if (cached !== null) deps.publish(cached, "cache");
  const remote = await deps.fetchRemote();
  if (!remote.error && remote.data !== null) {
    await deps.writeCache(remote.data);
    deps.publish(remote.data, "remote");
    return;
  }
  if (cached === null) deps.publish([], "empty");
}

export async function loadFacilitySearchRooms(deps: {
  query: string;
  readCache: () => Promise<readonly RoomSearchSource[] | null>;
  fetchRemote: () => Promise<{
    data: readonly RoomSearchSource[] | null;
    error: unknown;
  }>;
  publish: (
    value: readonly RoomSearchSource[],
    source: SearchDataSource,
  ) => void;
}) {
  const query = deps.query.trim();
  if (query.length < 2) {
    deps.publish([], "empty");
    return;
  }
  const cached = await deps.readCache();
  if (cached !== null) deps.publish(cached, "cache");
  const remote = await deps.fetchRemote();
  if (!remote.error && remote.data !== null) {
    deps.publish(remote.data, "remote");
    return;
  }
  if (cached === null) deps.publish([], "empty");
}
```

- [ ] **Step 4: Implement the shared React data hook**

```ts
export function useFacilitySearchData({
  enabled,
  query,
  initialFacilities = [],
}: {
  enabled: boolean;
  query: string;
  initialFacilities?: readonly Facility[];
}) {
  // State: facilities, rooms, loading, source, error.
  // Publish facilities cache state before awaiting the remote refresh.
  // Publish room cache state before remote lookup at two trimmed characters.
  // Treat a successful remote [] as canonical and persist the empty cache.
  // Ignore stale async completions through an effect-local cancellation flag.
  // Return only data and status; do not own selection or navigation.
}
```

Use the real `getCachedFacilities`, `setCachedFacilities`, `getFacilitiesLite`,
`getCachedRooms`, and `searchRooms` dependencies. Preserve cancellation on
effect cleanup and do not surface raw Supabase errors.

- [ ] **Step 5: Replace duplicated loading in map and schedule parents**

In `AppHeader`, replace `facilityOptions`, `roomOptions`, and their loading
effects with:

```ts
const facilitySearchData = useFacilitySearchData({
  enabled: isFacilitySearchPage && (
    searchFocused || trimmedSuggestionQuery.length > 0
  ),
  query: trimmedSuggestionQuery,
});
const facilityOptions = facilitySearchData.facilities;
const roomOptions = facilitySearchData.rooms;
```

In `SchedulePageClient`, load the canonical shared facility state once and pass
its `facilities`, `source`, `loading`, and `error` values to `CourseDialog`.
Continue deriving `knownFacilityIds` from cached plus refreshed facilities.

- [ ] **Step 6: Run loader, map, schedule, and type tests**

Run:

```bash
rtk proxy node --import tsx --test lib/map/facility-search-loader.test.ts lib/map/search-suggestions.test.ts lib/schedule/ui.test.ts
rtk npm run typecheck
```

Expected: all focused tests and typecheck PASS.

- [ ] **Step 7: Commit**

```bash
rtk git add lib/map/facility-search-loader.ts lib/map/facility-search-loader.test.ts components/facility/use-facility-search-data.ts components/app-header.tsx components/schedule/schedule-page-client.tsx
rtk git commit -m "refactor(map): share cache-first facility search data"
```

### Task 3: Build the accessible shared combobox

**Files:**
- Create: `components/facility/facility-search-combobox.tsx`
- Create: `components/facility/facility-search-combobox.test.ts`
- Modify: `components/app-header.tsx`

- [ ] **Step 1: Write a failing source-contract test**

```ts
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("shared facility combobox exposes the complete ARIA contract", async () => {
  const source = await readFile(
    new URL("./facility-search-combobox.tsx", import.meta.url),
    "utf8",
  );
  for (const required of [
    'role="combobox"',
    'aria-autocomplete="list"',
    "aria-expanded",
    "aria-controls",
    "aria-activedescendant",
    'role="listbox"',
    'role="option"',
    "aria-selected",
    'role="status"',
    '"ArrowDown"',
    '"ArrowUp"',
    '"Enter"',
    '"Escape"',
  ]) {
    assert.match(source, new RegExp(required.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")));
  }
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
rtk proxy node --import tsx --test components/facility/facility-search-combobox.test.ts
```

Expected: FAIL because the component is absent.

- [ ] **Step 3: Implement the controlled combobox**

```tsx
export type FacilitySearchComboboxProps = {
  id: string;
  label: string;
  query: string;
  options: readonly FacilitySearchOption[];
  selectedFacilityId?: string;
  loading?: boolean;
  unavailable?: boolean;
  placeholder: string;
  className?: string;
  inputClassName?: string;
  dataTour?: string;
  recents?: readonly RecentSearch[];
  onQueryChange: (value: string) => void;
  onSelect: (facility: Facility) => void;
  onSelectRecent?: (recent: RecentSearch) => void;
  onClearRecents?: () => void;
  onFocusChange?: (focused: boolean) => void;
};

export function FacilitySearchCombobox(props: FacilitySearchComboboxProps) {
  // Own only open/highlight/focus/listbox IDs and outside-click behavior.
  // Clamp highlightedIndex whenever the rendered option count changes.
  // Arrow keys wrap, Enter selects active or first, Escape closes.
  // Use onMouseDown preventDefault so pointer selection does not race blur.
  // Render loading, unavailable, and no-results statuses with role="status".
  // Render the existing colored-dot option visuals from AppHeader.
}
```

Move the existing map combobox markup and keyboard behavior into this component
without changing CSS tokens, result text, or the eight-result model. Keep recent
searches optional so the schedule does not inherit map navigation history.

- [ ] **Step 4: Replace the AppHeader combobox**

```tsx
<FacilitySearchCombobox
  id="map-facility-search"
  label="Search buildings or facilities"
  query={searchQuery}
  options={facilitySearchOptions}
  placeholder="Search buildings or facilities..."
  dataTour="map-search"
  recents={recentSearches}
  onQueryChange={setSearchQuery}
  onSelect={chooseFacility}
  onSelectRecent={(recent) => void chooseRecentSearch(recent)}
  onClearRecents={handleClearRecentSearches}
  onFocusChange={setSearchFocused}
  inputClassName={cn(isMapPage && "bg-background/95 shadow-lg backdrop-blur-md")}
/>
```

Keep the TBA dialog timer in `AppHeader`; when the query becomes TBA, close or
hide the shared listbox before opening the help dialog.

- [ ] **Step 5: Run component contract, ranking, and type tests**

Run:

```bash
rtk proxy node --import tsx --test components/facility/facility-search-combobox.test.ts lib/map/facility-search-model.test.ts lib/map/search-suggestions.test.ts
rtk npm run typecheck
rtk npm run lint
```

Expected: all commands PASS.

- [ ] **Step 6: Commit**

```bash
rtk git add components/facility/facility-search-combobox.tsx components/facility/facility-search-combobox.test.ts components/app-header.tsx
rtk git commit -m "feat(map): use shared accessible facility combobox"
```

### Task 4: Integrate shared search into the course dialog

**Files:**
- Modify: `components/schedule/course-dialog.tsx`
- Modify: `components/schedule/schedule-page-client.tsx`
- Modify: `lib/schedule/ui.test.ts`

- [ ] **Step 1: Write failing schedule picker tests**

Add tests proving:

```ts
test("schedule facility search uses the map ranking for code aliases and rooms", () => {
  const options = buildFacilitySearchOptions({
    facilities,
    rooms,
    query: "DSTAT-201",
  });
  assert.equal(options[0]?.facility.id, "dstat");
  assert.equal(options[0]?.matchedRoomCode, "DSTAT-201");
});

test("selecting a room search result retains the separate room detail", () => {
  assert.deepEqual(
    applyFacilitySearchSelection({
      facilityId: "",
      facilityDetail: "Room 101",
    }, "dstat"),
    { facilityId: "dstat", facilityDetail: "Room 101" },
  );
});
```

Place the small pure `applyFacilitySearchSelection` helper in `lib/schedule/ui.ts`
if needed to make this behavior explicit and testable.

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
rtk proxy node --import tsx --test lib/schedule/ui.test.ts lib/map/facility-search-model.test.ts
```

Expected: the new selection helper or expected integration behavior FAILS.

- [ ] **Step 3: Replace the native facility select**

For each facility-mode meeting, render:

```tsx
<FacilitySearchCombobox
  id={`facility-${index}`}
  label="Search campus facility"
  query={facilityQueries[index] ?? selectedFacility?.name ?? ""}
  options={facilitySearchOptions[index] ?? []}
  selectedFacilityId={form.getValues(`meetings.${index}.facilityId`)}
  loading={facilitySearchLoading}
  unavailable={facilitySearchUnavailable}
  placeholder="Search by building, code, alias, or room..."
  onQueryChange={(query) => updateFacilityQuery(index, query)}
  onSelect={(facility) => {
    form.setValue(`meetings.${index}.facilityId`, facility.id, {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.clearErrors(`meetings.${index}.facilityId`);
    updateFacilityQuery(index, facility.name);
  }}
/>
```

Keep a registered hidden input for `meetings.${index}.facilityId`, retain
`facilitySelectionError`, and leave `facilityDetail` unchanged when selecting a
room match. Reset the display query from the saved facility name whenever the
dialog opens or the edited course changes.

- [ ] **Step 4: Add loading and unavailable copy**

Use these exact distinctions:

```tsx
{facilitySearchSource === "cache" ? (
  <p className="text-xs text-muted-foreground">
    Showing saved campus facilities while offline.
  </p>
) : facilitySearchUnavailable ? (
  <p role="status" className="text-xs text-muted-foreground">
    Facility search is unavailable. Try again online or choose Other location.
  </p>
) : null}
```

Do not label an unavailable data source as `No facilities found`.

- [ ] **Step 5: Run focused tests, full tests, typecheck, and lint**

Run:

```bash
rtk proxy node --import tsx --test lib/schedule/ui.test.ts lib/map/facility-search-model.test.ts components/facility/facility-search-combobox.test.ts
rtk npm test
rtk npm run typecheck
rtk npm run lint
```

Expected: 450 existing tests plus new tests PASS; typecheck and lint PASS.

- [ ] **Step 6: Commit**

```bash
rtk git add components/schedule/course-dialog.tsx components/schedule/schedule-page-client.tsx lib/schedule/ui.ts lib/schedule/ui.test.ts
rtk git commit -m "feat(schedule): search campus facilities in course form"
```

### Task 5: Verify map and schedule search parity in the browser

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Build the production application**

Run:

```bash
rtk npm run build
```

Expected: PASS and the static `/schedule` route remains in the build manifest.

- [ ] **Step 2: Run desktop and mobile browser checks**

At 320, 768, 1024, and 1440 CSS pixels:

1. Search `DSTAT`, `statistics`, an alias, and `DSTAT-201` on the map.
2. Open Add course → Campus facility and repeat the queries.
3. Assert the same facility ordering and matched-room text.
4. Verify Arrow Up/Down, Enter, Escape, Tab, pointer selection, click outside,
   loading, no-results, and cached/offline states.
5. Save the course and verify `Open facility on map` opens the chosen facility.
6. Check the console for application errors and accessibility warnings.

- [ ] **Step 3: Document the behavior**

Add to README:

```md
- Schedule facility fields use the same ranked name, code, alias, and room
  search as the campus map and remain cache-first when connectivity is limited.
```

Add a changelog entry describing shared facility search without claiming fuzzy
or typo-tolerant matching.

- [ ] **Step 4: Run final gates**

Run:

```bash
rtk npm test
rtk npm run typecheck
rtk npm run lint
rtk npm run build
rtk git diff --check
```

Expected: every command PASS and the worktree contains only intentional files.

- [ ] **Step 5: Commit**

```bash
rtk git add README.md CHANGELOG.md
rtk git commit -m "docs(schedule): document shared facility search"
```
