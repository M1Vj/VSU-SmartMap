import type { CSSProperties } from "react";
import type { IsoWeekday, ScheduleCourse } from "@/lib/schedule/types";
import { DAY_SHORT_LABELS, formatMinuteOfDay } from "@/lib/schedule/time";
import { buildWeekGridModel, getMeetingGridPosition } from "@/lib/schedule/ui";

const DAYS: IsoWeekday[] = [1, 2, 3, 4, 5, 6, 7];

export function ScheduleWeekGrid({ courses }: { courses: readonly ScheduleCourse[] }) {
  const model = buildWeekGridModel(courses);
  if (model.kind === "fallback") {
    return (
      <section
        aria-labelledby="week-heading"
        className="hidden rounded-lg border border-dashed p-5 lg:block"
      >
        <h2 id="week-heading" className="text-xl font-semibold">
          Weekly timetable simplified
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This schedule has {model.occurrenceCount.toLocaleString()} weekly
          meeting occurrences, so the visual grid is unavailable to keep the
          planner responsive. The complete semantic agenda above remains
          available for every day.
        </p>
      </section>
    );
  }
  return (
    <section aria-labelledby="week-heading" className="hidden lg:block">
      <h2 id="week-heading" className="mb-4 text-xl font-semibold">Weekly timetable</h2>
      <p className="sr-only">Meetings that overlap are displayed in separate columns and include conflict text in the agenda.</p>
      <div className="overflow-x-auto rounded-lg border">
        <div className="grid min-w-[900px] grid-cols-[4.5rem_repeat(7,minmax(0,1fr))] bg-card">
          <div className="border-b p-2" />
          {DAYS.map((day) => <div key={day} className="border-b border-l p-2 text-center text-sm font-semibold">{DAY_SHORT_LABELS[day]}</div>)}
          <div className="relative h-[1200px] border-r">
            {Array.from({ length: 24 }, (_, index) => index * 60).map((minute) => <span key={minute} className="absolute right-2 text-xs text-muted-foreground" style={{ top: `${(minute / 1440) * 100}%` }}>{formatMinuteOfDay(minute)}</span>)}
          </div>
          {model.days.map(({ day, conflictMeetingIds, blocks }) => {
            return (
            <div key={day} className="relative h-[1200px] overflow-hidden border-l">
              {blocks.map(({ course, meeting, column, columnCount }) => {
                const position = getMeetingGridPosition(meeting.startMinute, meeting.endMinute);
                const hasConflict = conflictMeetingIds.has(
                  `${course.id}:${meeting.id}`,
                );
                const style = {
                  ...(position.anchor === "bottom"
                    ? { bottom: `${position.bottomPercent}%` }
                    : { top: `${position.topPercent}%` }),
                  height: `${position.heightPercent}%`,
                  minHeight: "2rem",
                  left: `${(column / columnCount) * 100}%`,
                  width: `${100 / columnCount}%`,
                } satisfies CSSProperties;
                return <article key={`${course.id}-${meeting.id}`} className="absolute overflow-hidden border border-background bg-primary p-1 text-xs text-primary-foreground motion-reduce:transition-none" style={style} title={`${course.code}, ${formatMinuteOfDay(meeting.startMinute)} to ${formatMinuteOfDay(meeting.endMinute)}${hasConflict ? ", conflict" : ""}`}><strong className="block truncate">{course.code}</strong><span className="block truncate">{meeting.locationLabel || "TBA"}</span>{hasConflict ? <span className="sr-only">Conflict</span> : null}</article>;
              })}
            </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
