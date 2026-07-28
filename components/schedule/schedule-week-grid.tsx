import type { CSSProperties } from "react";
import type { IsoWeekday, ScheduleCourse } from "@/lib/schedule/types";
import { DAY_SHORT_LABELS, formatMinuteOfDay } from "@/lib/schedule/time";
import { assignMeetingColumns } from "@/lib/schedule/ui";

const DAYS: IsoWeekday[] = [1, 2, 3, 4, 5, 6, 7];
const START = 6 * 60;
const END = 21 * 60;

export function ScheduleWeekGrid({ courses }: { courses: readonly ScheduleCourse[] }) {
  return (
    <section aria-labelledby="week-heading" className="hidden lg:block">
      <h2 id="week-heading" className="mb-4 text-xl font-semibold">Weekly timetable</h2>
      <p className="sr-only">Meetings that overlap are displayed in separate columns and include conflict text in the agenda.</p>
      <div className="overflow-x-auto rounded-lg border">
        <div className="grid min-w-[900px] grid-cols-[4.5rem_repeat(7,minmax(0,1fr))] bg-card">
          <div className="border-b p-2" />
          {DAYS.map((day) => <div key={day} className="border-b border-l p-2 text-center text-sm font-semibold">{DAY_SHORT_LABELS[day]}</div>)}
          <div className="relative h-[900px] border-r">
            {Array.from({ length: 16 }, (_, index) => START + index * 60).map((minute) => <span key={minute} className="absolute right-2 -translate-y-1/2 text-xs text-muted-foreground" style={{ top: `${((minute - START) / (END - START)) * 100}%` }}>{formatMinuteOfDay(minute)}</span>)}
          </div>
          {DAYS.map((day) => (
            <div key={day} className="relative h-[900px] border-l">
              {assignMeetingColumns(courses, day).map(({ course, meeting, column, columnCount }) => {
                const top = Math.max(0, ((meeting.startMinute - START) / (END - START)) * 100);
                const height = Math.max(2, ((Math.min(meeting.endMinute, END) - Math.max(meeting.startMinute, START)) / (END - START)) * 100);
                const style = { top: `${top}%`, height: `${height}%`, left: `${(column / columnCount) * 100}%`, width: `${100 / columnCount}%` } satisfies CSSProperties;
                return <article key={`${course.id}-${meeting.id}`} className="absolute overflow-hidden border border-background bg-primary p-1 text-xs text-primary-foreground motion-reduce:transition-none" style={style} title={`${course.code}, ${formatMinuteOfDay(meeting.startMinute)} to ${formatMinuteOfDay(meeting.endMinute)}`}><strong className="block truncate">{course.code}</strong><span className="block truncate">{meeting.locationLabel || "TBA"}</span></article>;
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
