"use client";

import { MapPin, Pencil, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { IsoWeekday, ScheduleCourse } from "@/lib/schedule/types";
import { DAY_LABELS, formatMinuteOfDay, isMeetingTba } from "@/lib/schedule/time";
import { analyzeDayConflicts, getDayAgendaData } from "@/lib/schedule/ui";

export function ScheduleAgenda({
  courses,
  selectedDay,
  onDayChange,
  onEdit,
  onDelete,
  onMap,
  isLiveFacility,
}: {
  courses: readonly ScheduleCourse[];
  selectedDay: IsoWeekday;
  onDayChange: (day: IsoWeekday) => void;
  onEdit: (course: ScheduleCourse) => void;
  onDelete: (course: ScheduleCourse) => void;
  onMap: (facilityId: string) => void;
  isLiveFacility: (facilityId: string) => boolean;
}) {
  const days: IsoWeekday[] = [1, 2, 3, 4, 5, 6, 7];
  const { entries, tbaCount } = getDayAgendaData(courses, selectedDay);
  const conflictAnalysis = analyzeDayConflicts(courses, selectedDay);

  return (
    <section aria-labelledby="agenda-heading" className="space-y-4">
      <div className="flex items-center justify-between"><h2 id="agenda-heading" className="text-xl font-semibold">Agenda</h2><span className="text-sm text-muted-foreground">{DAY_LABELS[selectedDay]}</span></div>
      <div className="flex snap-x gap-2 overflow-x-auto pb-1" aria-label="Agenda weekday">
        {days.map((day) => <Button key={day} type="button" size="sm" variant={day === selectedDay ? "default" : "outline"} aria-pressed={day === selectedDay} onClick={() => onDayChange(day)} className="shrink-0 snap-start">{DAY_LABELS[day].slice(0, 3)}</Button>)}
      </div>
      {conflictAnalysis.totalPairCount > 0 ? (
        <section aria-labelledby="conflicts-heading" className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <h3 id="conflicts-heading" className="flex items-center gap-2 font-semibold text-destructive"><TriangleAlert className="h-4 w-4" />Schedule conflicts</h3>
          <ul className="mt-2 space-y-1 text-sm">{conflictAnalysis.notices.map((notice) => <li key={notice.key}>{notice.label}</li>)}</ul>
          {conflictAnalysis.remainingPairCount > 0 ? <p className="mt-2 text-sm font-medium">Plus {conflictAnalysis.remainingPairCount.toLocaleString()} more conflicts on {DAY_LABELS[selectedDay]}.</p> : null}
        </section>
      ) : null}
      {entries.length === 0 ? <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No scheduled meetings for {DAY_LABELS[selectedDay]}.</p> : (
        <ol className="space-y-3">
          {entries.map(({ course, meeting }) => {
            return (
              <li key={`${course.id}-${meeting.id}`} className="rounded-lg border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="font-semibold">{course.code} <span className="font-normal text-muted-foreground">· {course.title}</span></p><p className="mt-1 text-sm">{formatMinuteOfDay(meeting.startMinute)}–{formatMinuteOfDay(meeting.endMinute)}</p><p className="text-sm text-muted-foreground">{meeting.locationLabel || "TBA"}{isMeetingTba(meeting) ? <Badge variant="secondary" className="ml-2">TBA</Badge> : null}</p></div>
                  <div className="flex gap-1">{meeting.facilityId && isLiveFacility(meeting.facilityId) ? <Button size="sm" variant="outline" onClick={() => onMap(meeting.facilityId!)}><MapPin className="mr-1 h-4 w-4" />Map</Button> : null}<Button size="icon" variant="ghost" aria-label={`Edit ${course.code}`} onClick={() => onEdit(course)}><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" aria-label={`Delete ${course.code}`} onClick={() => onDelete(course)}><Trash2 className="h-4 w-4" /></Button></div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {tbaCount > 0 ? <p className="rounded-lg border px-4 py-3 text-sm text-muted-foreground">{tbaCount} timed {tbaCount === 1 ? "meeting has" : "meetings have"} a TBA location. The meeting remains in the agenda above.</p> : null}
    </section>
  );
}
