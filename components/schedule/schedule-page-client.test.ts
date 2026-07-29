import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readPageSource() {
  return readFile(
    new URL("./schedule-page-client.tsx", import.meta.url),
    "utf8",
  );
}

test("schedule planner appears before optional account sync information", async () => {
  const source = await readPageSource();
  const agenda = source.indexOf("<ScheduleAgenda");
  const calendar = source.indexOf("<ScheduleWeekGrid");
  const syncCard = source.lastIndexOf("<ScheduleAccountPanel");

  assert.notEqual(agenda, -1);
  assert.notEqual(calendar, -1);
  assert.notEqual(syncCard, -1);
  assert.ok(syncCard > agenda, "sync card must follow the schedule agenda");
  assert.ok(syncCard > calendar, "sync card must follow the weekly calendar");
});

test("schedule page keeps one backup action and omits the technical storage notice", async () => {
  const source = await readPageSource();

  assert.equal(source.match(/Backup & export/g)?.length, 1);
  assert.doesNotMatch(source, /Your class routine stays/);
  assert.doesNotMatch(source, /\bIndexedDB\b/);
});
