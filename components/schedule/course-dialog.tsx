"use client";

import { useEffect } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  DialogScaffoldBody,
  DialogScaffoldContent,
  DialogScaffoldFooter,
  DialogScaffoldHeader,
} from "@/components/ui/dialog-scaffold";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Facility } from "@/lib/types";
import type { IsoWeekday, ScheduleColor, ScheduleCourse } from "@/lib/schedule/types";
import { endTimeValueToMinute, minuteToTimeValue, timeValueToMinute } from "@/lib/schedule/ui";
import { DAY_SHORT_LABELS } from "@/lib/schedule/time";

type LocationMode = "facility" | "text" | "tba";
interface MeetingForm {
  id?: string;
  days: IsoWeekday[];
  start: string;
  end: string;
  locationMode: LocationMode;
  facilityId: string;
  locationLabel: string;
  facilityDetail: string;
}
interface CourseForm {
  code: string;
  title: string;
  instructor: string;
  notes: string;
  color: ScheduleColor;
  meetings: MeetingForm[];
}

const WEEKDAYS: IsoWeekday[] = [1, 2, 3, 4, 5, 6, 7];
const COLORS: ScheduleColor[] = ["blue", "green", "violet", "amber", "rose", "cyan", "slate"];
const blankMeeting = (): MeetingForm => ({
  days: [1],
  start: "08:00",
  end: "09:00",
  locationMode: "tba",
  facilityId: "",
  locationLabel: "",
  facilityDetail: "",
});

function defaults(course?: ScheduleCourse): CourseForm {
  return {
    code: course?.code ?? "",
    title: course?.title ?? "",
    instructor: course?.instructor ?? "",
    notes: course?.notes ?? "",
    color: course?.color ?? "blue",
    meetings: course?.meetings.map((meeting) => ({
      id: meeting.id,
      days: meeting.days,
      start: minuteToTimeValue(meeting.startMinute),
      end: minuteToTimeValue(meeting.endMinute),
      locationMode: meeting.facilityId
        ? "facility"
        : meeting.locationLabel?.toLowerCase() === "tba" || !meeting.locationLabel
          ? "tba"
          : "text",
      facilityId: meeting.facilityId ?? "",
      locationLabel: meeting.locationLabel ?? "",
      facilityDetail: meeting.facilityId && meeting.locationLabel?.includes(" · ")
        ? meeting.locationLabel.split(" · ").slice(1).join(" · ")
        : "",
    })) ?? [blankMeeting()],
  };
}

export function CourseDialog({
  open,
  course,
  facilities,
  saving,
  onClose,
  onSave,
}: {
  open: boolean;
  course?: ScheduleCourse;
  facilities: readonly Facility[];
  saving: boolean;
  onClose: () => void;
  onSave: (value: unknown) => Promise<void>;
}) {
  const form = useForm<CourseForm>({ defaultValues: defaults(course) });
  const meetings = useFieldArray({ control: form.control, name: "meetings" });
  const watchedMeetings = useWatch({ control: form.control, name: "meetings" });
  useEffect(() => {
    if (open) form.reset(defaults(course));
  }, [course, form, open]);

  const submit = form.handleSubmit(async (value) => {
    try {
      await onSave({
        ...(course ?? {}),
        code: value.code,
        title: value.title,
        instructor: value.instructor,
        notes: value.notes,
        color: value.color,
        meetings: value.meetings.map((meeting) => {
          const facility = facilities.find((item) => item.id === meeting.facilityId);
          const detail = meeting.facilityDetail.trim();
          const startMinute = timeValueToMinute(meeting.start);
          return {
            ...(meeting.id ? { id: meeting.id } : {}),
            days: meeting.days,
            startMinute,
            endMinute: endTimeValueToMinute(meeting.end, startMinute),
            ...(meeting.locationMode === "facility" && facility
              ? { facilityId: facility.id, locationLabel: detail ? `${facility.name} · ${detail}` : facility.name }
              : meeting.locationMode === "text"
                ? { locationLabel: meeting.locationLabel }
                : { locationLabel: "TBA" }),
          };
        }),
      });
    } catch {
      // The parent keeps the dialog mounted so react-hook-form retains every value.
    }
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !saving && onClose()}>
      <DialogScaffoldContent className="w-[calc(100%-1rem)] sm:max-w-2xl">
        <DialogScaffoldHeader>
          <DialogTitle>{course ? "Edit course" : "Add course"}</DialogTitle>
          <DialogDescription>Add one to eight recurring meeting patterns.</DialogDescription>
        </DialogScaffoldHeader>
        <form onSubmit={submit} className="contents">
          <DialogScaffoldBody className="space-y-5 px-4 sm:px-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label htmlFor="course-code">Course code</Label><Input id="course-code" maxLength={24} required {...form.register("code")} /></div>
              <div><Label htmlFor="course-title">Title</Label><Input id="course-title" maxLength={120} required {...form.register("title")} /></div>
              <div><Label htmlFor="course-instructor">Instructor</Label><Input id="course-instructor" maxLength={100} {...form.register("instructor")} /></div>
              <div>
                <Label htmlFor="course-color">Color</Label>
                <select id="course-color" className="h-10 w-full rounded-md border bg-background px-3 text-sm" {...form.register("color")}>
                  {COLORS.map((color) => <option key={color} value={color}>{color}</option>)}
                </select>
              </div>
            </div>
            <div><Label htmlFor="course-notes">Notes</Label><Textarea id="course-notes" maxLength={500} {...form.register("notes")} /></div>
            <fieldset className="space-y-4">
              <legend className="text-sm font-semibold">Meetings</legend>
              {meetings.fields.map((field, index) => {
                const days = watchedMeetings[index]?.days ?? [];
                const locationMode = watchedMeetings[index]?.locationMode ?? "tba";
                return (
                  <section key={field.id} className="space-y-3 rounded-lg border p-3" aria-label={`Meeting ${index + 1}`}>
                    <div className="flex items-center justify-between"><h3 className="font-medium">Meeting {index + 1}</h3>{meetings.fields.length > 1 ? <Button type="button" variant="ghost" size="sm" onClick={() => meetings.remove(index)}><Trash2 className="mr-1 h-4 w-4" />Remove</Button> : null}</div>
                    <div className="flex flex-wrap gap-1" aria-label="Weekdays">
                      {WEEKDAYS.map((day) => {
                        const pressed = days.includes(day);
                        return <Button key={day} type="button" size="sm" variant={pressed ? "default" : "outline"} aria-pressed={pressed} onClick={() => form.setValue(`meetings.${index}.days`, pressed ? days.filter((item) => item !== day) : [...days, day].sort())}>{DAY_SHORT_LABELS[day]}</Button>;
                      })}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label htmlFor={`start-${index}`}>Start</Label><Input id={`start-${index}`} type="time" required {...form.register(`meetings.${index}.start`)} /></div>
                      <div><Label htmlFor={`end-${index}`}>End</Label><Input id={`end-${index}`} type="time" required {...form.register(`meetings.${index}.end`)} /></div>
                    </div>
                    <div>
                      <Label htmlFor={`mode-${index}`}>Location</Label>
                      <select id={`mode-${index}`} className="h-10 w-full rounded-md border bg-background px-3 text-sm" {...form.register(`meetings.${index}.locationMode`)}>
                        <option value="facility">Campus facility</option><option value="text">Other location</option><option value="tba">TBA</option>
                      </select>
                    </div>
                    {locationMode === "facility" ? (
                      <div className="space-y-3"><div><Label htmlFor={`facility-${index}`}>Facility</Label><select id={`facility-${index}`} required className="h-10 w-full rounded-md border bg-background px-3 text-sm" {...form.register(`meetings.${index}.facilityId`)}><option value="">Choose a facility</option>{facilities.map((facility) => <option key={facility.id} value={facility.id}>{facility.name}</option>)}</select></div><div><Label htmlFor={`facility-detail-${index}`}>Room or detail (optional)</Label><Input id={`facility-detail-${index}`} maxLength={160} {...form.register(`meetings.${index}.facilityDetail`)} /></div></div>
                    ) : locationMode === "text" ? (
                      <div><Label htmlFor={`location-${index}`}>Location details</Label><Input id={`location-${index}`} required maxLength={160} {...form.register(`meetings.${index}.locationLabel`)} /></div>
                    ) : <p className="text-sm text-muted-foreground">This meeting stays visible as unscheduled.</p>}
                  </section>
                );
              })}
              {meetings.fields.length < 8 ? <Button type="button" variant="outline" onClick={() => meetings.append(blankMeeting())}><Plus className="mr-2 h-4 w-4" />Add meeting</Button> : null}
            </fieldset>
          </DialogScaffoldBody>
          <DialogScaffoldFooter className="px-4 sm:px-6">
            <Button type="button" variant="ghost" disabled={saving} onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save course"}</Button>
          </DialogScaffoldFooter>
        </form>
      </DialogScaffoldContent>
    </Dialog>
  );
}
