import assert from "node:assert/strict";
import test from "node:test";
import type { ScheduleCourse } from "./types";
import {
  assignMeetingColumns,
  assertScheduleFileSize,
  buildFacilityLocationLabel,
  buildWeekGridModel,
  analyzeDayConflicts,
  endTimeValueToMinute,
  facilitySelectionError,
  getFacilityOptionsStatus,
  getMeetingGridPosition,
  mapScheduleIssuesToFormErrors,
  MAX_WEEK_GRID_OCCURRENCES,
  minuteToTimeValue,
  selectedDayConflictNotices,
  getDayAgendaData,
  reconcileKnownFacilityIds,
  transitionRestoreDialogs,
  timeValueToMinute,
} from "./ui";

test("converts HTML time values to integer minutes and back", () => {
  assert.equal(timeValueToMinute("09:05"), 545);
  assert.equal(minuteToTimeValue(545), "09:05");
  assert.equal(minuteToTimeValue(1440), "00:00");
  assert.equal(endTimeValueToMinute("00:00", 1380), 1440);
});

test("rejects invalid HTML time values", () => {
  assert.throws(() => timeValueToMinute("9:05"), /valid time/i);
  assert.throws(() => timeValueToMinute("24:01"), /valid time/i);
});

test("assigns deterministic columns only to strict overlaps", () => {
  const course = (id: string, startMinute: number, endMinute: number): ScheduleCourse => ({
    id,
    code: id,
    title: id,
    color: "blue",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    meetings: [{
      id: `${id}00000-0000-4000-8000-000000000000`.slice(0, 36),
      days: [1],
      startMinute,
      endMinute,
    }],
  });
  const blocks = assignMeetingColumns([
    course("a", 540, 600),
    course("b", 570, 630),
    course("c", 600, 660),
  ], 1);

  assert.deepEqual(
    blocks.map(({ course, column, columnCount }) => [course.code, column, columnCount]),
    [["a", 0, 2], ["b", 1, 2], ["c", 0, 2]],
  );
});

test("positions the full 00:00 through 24:00 meeting domain without clipping", () => {
  const midnight = getMeetingGridPosition(0, 60);
  assert.equal(midnight.topPercent, 0);
  assert.ok(Math.abs(midnight.heightPercent - 100 / 24) < 1e-10);
  const early = getMeetingGridPosition(300, 360);
  assert.ok(Math.abs(early.topPercent - 100 * 5 / 24) < 1e-10);
  const late = getMeetingGridPosition(1380, 1440);
  assert.ok(Math.abs(late.topPercent - 100 * 23 / 24) < 1e-10);
  const fullDay = getMeetingGridPosition(0, 1440);
  assert.equal(fullDay.topPercent + fullDay.heightPercent, 100);
  assert.equal(getMeetingGridPosition(1425, 1440).anchor, "bottom");
  assert.equal(getMeetingGridPosition(1439, 1440).anchor, "bottom");
  assert.equal(getMeetingGridPosition(1439, 1440).bottomPercent, 0);
});

test("describes every selected-day multi-way conflict pair once in stable order", () => {
  const course = (id: string): ScheduleCourse => ({
    id,
    code: id.toUpperCase(),
    title: id,
    color: "blue",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    meetings: [{ id: `${id}00000-0000-4000-8000-000000000000`.slice(0, 36), days: [1], startMinute: 540, endMinute: 600 }],
  });
  assert.deepEqual(
    selectedDayConflictNotices([course("a"), course("b"), course("c")], 1).map((notice) => notice.label),
    [
      "A conflicts with B, 9:00 AM–10:00 AM.",
      "A conflicts with C, 9:00 AM–10:00 AM.",
      "B conflicts with C, 9:00 AM–10:00 AM.",
    ],
  );
});

test("bounds conflict details at maximum valid schedule cardinality", () => {
  const courses = Array.from({ length: 200 }, (_, courseIndex): ScheduleCourse => ({
    id: `course-${courseIndex}`,
    code: `C${courseIndex}`,
    title: `Course ${courseIndex}`,
    color: "blue",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    meetings: Array.from({ length: 8 }, (_, meetingIndex) => ({
      id: `meeting-${courseIndex}-${meetingIndex}`,
      days: [1],
      startMinute: 540,
      endMinute: 600,
    })),
  }));
  const started = performance.now();
  const analysis = analyzeDayConflicts(courses, 1);
  const elapsed = performance.now() - started;
  assert.equal(analysis.totalPairCount, 1_273_600);
  assert.equal(analysis.notices.length, 100);
  assert.equal(analysis.remainingPairCount, 1_273_500);
  assert.equal(analysis.conflictMeetingIds.size, 1600);
  assert.ok(elapsed < 250, `analysis took ${elapsed.toFixed(1)}ms`);
});

test("weekly grid preflight skips all expensive work above its occurrence budget", () => {
  const courses = Array.from({ length: 200 }, (_, courseIndex): ScheduleCourse => ({
    id: `week-course-${courseIndex}`,
    code: `W${courseIndex}`,
    title: "Week",
    color: "blue",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    meetings: Array.from({ length: 8 }, (_, meetingIndex) => ({
      id: `week-meeting-${courseIndex}-${meetingIndex}`,
      days: [1, 2, 3, 4, 5, 6, 7],
      startMinute: 540,
      endMinute: 600,
    })),
  }));
  let analyzerCalls = 0;
  let layoutCalls = 0;
  const started = performance.now();
  const model = buildWeekGridModel(courses, {
    analyzeDay: () => {
      analyzerCalls += 1;
      throw new Error("analyzer must not run");
    },
    layoutDay: () => {
      layoutCalls += 1;
      throw new Error("layout must not run");
    },
  });
  const elapsed = performance.now() - started;
  assert.equal(model.kind, "fallback");
  assert.equal(model.occurrenceCount, 11_200);
  assert.equal(analyzerCalls, 0);
  assert.equal(layoutCalls, 0);
  assert.ok(elapsed < 50, `preflight took ${elapsed.toFixed(1)}ms`);
});

test("weekly grid renders at its budget and falls back one occurrence above", () => {
  const coursesForOccurrences = (occurrences: number): ScheduleCourse[] =>
    Array.from({ length: Math.ceil(occurrences / 8) }, (_, courseIndex) => ({
      id: `boundary-${courseIndex}`,
      code: "BOUND",
      title: "Boundary",
      color: "blue",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      meetings: Array.from(
        {
          length: Math.min(8, occurrences - courseIndex * 8),
        },
        (_, meetingIndex) => ({
          id: `boundary-meeting-${courseIndex}-${meetingIndex}`,
          days: [1],
          startMinute: 540,
          endMinute: 600,
        }),
      ),
    }));
  let calls = 0;
  const hooks = {
    analyzeDay: () => {
      calls += 1;
      return { conflictMeetingIds: new Set<string>(), totalPairCount: 0, notices: [], remainingPairCount: 0 };
    },
    layoutDay: () => {
      calls += 1;
      return [];
    },
  };
  assert.equal(buildWeekGridModel(coursesForOccurrences(MAX_WEEK_GRID_OCCURRENCES), hooks).kind, "grid");
  assert.ok(calls > 0);
  calls = 0;
  assert.equal(buildWeekGridModel(coursesForOccurrences(MAX_WEEK_GRID_OCCURRENCES + 1), hooks).kind, "fallback");
  assert.equal(calls, 0);
});

test("maps domain validation issues to visible controls for each location mode", () => {
  assert.deepEqual(mapScheduleIssuesToFormErrors([
    { field: "code", message: "This field is required." },
    { field: "title", message: "Use 120 characters or fewer." },
    { field: "meetings.0.days", message: "Choose at least one weekday." },
    { field: "meetings.0.time", message: "Choose a valid start and end time." },
    { field: "meetings.0.locationLabel", message: "Enter a location." },
    { field: "meetings.1.facilityId", message: "Select a valid facility." },
  ], ["facility", "text"]), {
    code: "This field is required.",
    title: "Use 120 characters or fewer.",
    "meetings.0.days": "Choose at least one weekday.",
    "meetings.0.start": "Choose a valid start and end time.",
    "meetings.0.end": "Choose a valid start and end time.",
    "meetings.0.facilityDetail": "Enter a location.",
    "meetings.1.facilityId": "Select a valid facility.",
  });
});

test("validates the combined facility label at the domain UTF-16 length boundary", () => {
  const exact = buildFacilityLocationLabel("A".repeat(157), "");
  assert.equal(exact.label.length, 157);
  assert.equal(exact.error, undefined);
  const exactWithDetail = buildFacilityLocationLabel("A".repeat(155), "BC");
  assert.equal(exactWithDetail.label.length, 160);
  assert.equal(exactWithDetail.error, undefined);
  assert.match(buildFacilityLocationLabel("A".repeat(156), "BC").error ?? "", /160/);
  assert.equal(buildFacilityLocationLabel("A".repeat(155), "😀").label.length, 160);
  assert.match(buildFacilityLocationLabel("A".repeat(156), "😀").error ?? "", /160/);
});

test("requires a selected facility to match the loaded facility options", () => {
  assert.equal(facilitySelectionError("facility", "", ["known"]), "Choose a valid campus facility.");
  assert.equal(facilitySelectionError("facility", "stale", ["known"]), "Choose a valid campus facility.");
  assert.equal(facilitySelectionError("facility", "known", ["known"]), undefined);
  assert.equal(facilitySelectionError("text", "", ["known"]), undefined);
});

test("cached facility handoff survives refresh failure and live refresh replaces it", () => {
  assert.deepEqual([...reconcileKnownFacilityIds(["cached"], undefined)], ["cached"]);
  assert.deepEqual([...reconcileKnownFacilityIds(["cached"], ["live"])], ["live"]);
});

test("facility option status distinguishes loading, cached fallback, and unavailable data", () => {
  assert.deepEqual(
    getFacilityOptionsStatus({
      source: "empty",
      loading: true,
      error: null,
      facilityCount: 0,
    }),
    { message: "Loading campus facilities…", tone: "muted" },
  );
  assert.deepEqual(
    getFacilityOptionsStatus({
      source: "cache",
      loading: true,
      error: null,
      facilityCount: 2,
    }),
    { message: "Showing saved facilities while refreshing…", tone: "muted" },
  );
  assert.deepEqual(
    getFacilityOptionsStatus({
      source: "cache",
      loading: false,
      error: "safe error",
      facilityCount: 2,
    }),
    { message: "Showing saved facilities. Refresh unavailable.", tone: "warning" },
  );
  assert.deepEqual(
    getFacilityOptionsStatus({
      source: "empty",
      loading: false,
      error: "safe error",
      facilityCount: 0,
    }),
    { message: "Campus facilities are unavailable right now.", tone: "warning" },
  );
  assert.equal(
    getFacilityOptionsStatus({
      source: "remote",
      loading: false,
      error: null,
      facilityCount: 2,
    }),
    null,
  );
});

test("restore confirmation never overlaps the transfer dialog", () => {
  assert.deepEqual(transitionRestoreDialogs("transfer", "restore-ready"), "confirm");
  assert.deepEqual(transitionRestoreDialogs("confirm", "cancel"), "transfer");
  assert.deepEqual(transitionRestoreDialogs("confirm", "confirmed"), "closed");
});

test("TBA meetings have one timed agenda row and an aggregate advisory", () => {
  const course: ScheduleCourse = {
    id: "course",
    code: "TBA1",
    title: "TBA course",
    color: "blue",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    meetings: [{ id: "meeting", days: [1], startMinute: 540, endMinute: 600, locationLabel: "TBA" }],
  };
  const data = getDayAgendaData([course], 1);
  assert.equal(data.entries.length, 1);
  assert.equal(data.tbaCount, 1);
});

test("guards oversized restore files before reading", () => {
  assert.doesNotThrow(() => assertScheduleFileSize(4 * 1024 * 1024));
  assert.throws(() => assertScheduleFileSize(4 * 1024 * 1024 + 1), /too large/i);
});
