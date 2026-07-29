"use client";

import { useEffect, useRef, useState } from "react";
import {
  type FieldPath,
  useFieldArray,
  useForm,
  useWatch,
} from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { FacilitySearchCombobox } from "@/components/facility/facility-search-combobox";
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
import {
  applyFacilitySearchSelection,
  buildFacilityDisplayQueries,
  buildFacilityLocationLabel,
  endTimeValueToMinute,
  facilitySelectionError,
  firstFacilityErrorIndex,
  getActiveFacilityQuery,
  getFacilityOptionsStatus,
  mapScheduleIssuesToFormErrors,
  minuteToTimeValue,
  shouldClearFacilitySelection,
  timeValueToMinute,
} from "@/lib/schedule/ui";
import type { FacilitySearchOption } from "@/lib/map/facility-search-model";
import { DAY_SHORT_LABELS } from "@/lib/schedule/time";
import { ScheduleValidationError } from "@/lib/schedule/validation";
import type {
  IsoWeekday,
  ScheduleColor,
  ScheduleCourse,
} from "@/lib/schedule/types";
import type { Facility } from "@/lib/types";
import type { SearchDataSource } from "@/lib/map/facility-search-loader";

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
const COLORS: ScheduleColor[] = [
  "blue", "green", "violet", "amber", "rose", "cyan", "slate",
];
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
      facilityDetail:
        meeting.facilityId && meeting.locationLabel?.includes(" · ")
          ? meeting.locationLabel.split(" · ").slice(1).join(" · ")
          : "",
    })) ?? [blankMeeting()],
  };
}

function InlineError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className="mt-1 text-sm text-destructive">{message}</p>
  ) : null;
}

export function CourseDialog({
  open,
  course,
  facilities,
  facilityOptions,
  facilityOptionsQuery,
  facilitySource,
  facilitiesLoading,
  facilitiesError,
  saving,
  onFacilityQueryChange,
  onClose,
  onSave,
}: {
  open: boolean;
  course?: ScheduleCourse;
  facilities: readonly Facility[];
  facilityOptions: readonly FacilitySearchOption[];
  facilityOptionsQuery: string;
  facilitySource: SearchDataSource;
  facilitiesLoading: boolean;
  facilitiesError: string | null;
  saving: boolean;
  onFacilityQueryChange: (query: string) => void;
  onClose: () => void;
  onSave: (value: unknown) => Promise<void>;
}) {
  const form = useForm<CourseForm>({ defaultValues: defaults(course) });
  const meetings = useFieldArray({ control: form.control, name: "meetings" });
  const watchedMeetings = useWatch({ control: form.control, name: "meetings" });
  const [facilityQueries, setFacilityQueries] = useState<string[]>([]);
  const [errorSummary, setErrorSummary] = useState("");
  const summaryRef = useRef<HTMLDivElement>(null);
  const courseContentKey = JSON.stringify(course ?? null);
  const facilityStatus = getFacilityOptionsStatus({
    source: facilitySource,
    loading: facilitiesLoading,
    error: facilitiesError,
    facilityCount: facilities.length,
  });

  useEffect(() => {
    if (open) {
      const courseSnapshot =
        courseContentKey === "null"
          ? undefined
          : JSON.parse(courseContentKey) as ScheduleCourse;
      const nextDefaults = defaults(courseSnapshot);
      form.reset(nextDefaults);
      setFacilityQueries(nextDefaults.meetings.map(() => ""));
      onFacilityQueryChange("");
      setErrorSummary("");
    }
  }, [courseContentKey, form, onFacilityQueryChange, open]);
  useEffect(() => {
    if (!open) return;
    const currentMeetings = form.getValues("meetings");
    setFacilityQueries((current) =>
      buildFacilityDisplayQueries(currentMeetings, facilities).map(
        (savedName, index) => current[index] || savedName,
      ),
    );
  }, [courseContentKey, facilities, form, open]);
  useEffect(() => {
    if (errorSummary) summaryRef.current?.focus();
  }, [errorSummary]);

  const focusSummary = () => {
    setErrorSummary("Review the highlighted schedule fields.");
  };
  const errorFor = (field: FieldPath<CourseForm>) =>
    form.getFieldState(field, form.formState).error?.message;
  const focusFacilityInput = (index: number) => {
    document.getElementById(`facility-${index}`)?.focus();
  };

  const submit = form.handleSubmit(async (value) => {
    const knownFacilityIds = facilities.map((facility) => facility.id);
    const missingFacility = value.meetings.findIndex((meeting) =>
      facilitySelectionError(
        meeting.locationMode,
        meeting.facilityId,
        knownFacilityIds,
      ),
    );
    if (missingFacility >= 0) {
      form.setError(
        `meetings.${missingFacility}.facilityId`,
        { type: "validate", message: "Choose a valid campus facility." },
        { shouldFocus: false },
      );
      focusFacilityInput(missingFacility);
      focusSummary();
      return;
    }

    try {
      await onSave({
        ...(course ?? {}),
        code: value.code,
        title: value.title,
        instructor: value.instructor,
        notes: value.notes,
        color: value.color,
        meetings: value.meetings.map((meeting) => {
          const facility = facilities.find(
            (item) => item.id === meeting.facilityId,
          );
          const facilityLocation = facility
            ? buildFacilityLocationLabel(facility.name, meeting.facilityDetail)
            : undefined;
          const startMinute = timeValueToMinute(meeting.start);
          return {
            ...(meeting.id ? { id: meeting.id } : {}),
            days: meeting.days,
            startMinute,
            endMinute: endTimeValueToMinute(meeting.end, startMinute),
            ...(meeting.locationMode === "facility" && facility
              ? {
                  facilityId: facility.id,
                  locationLabel: facilityLocation!.label,
                }
              : meeting.locationMode === "text"
                ? { locationLabel: meeting.locationLabel }
                : { locationLabel: "TBA" }),
          };
        }),
      });
      setErrorSummary("");
    } catch (error) {
      if (error instanceof ScheduleValidationError) {
        Object.entries(
          mapScheduleIssuesToFormErrors(
            error.issues,
            value.meetings.map((meeting) => meeting.locationMode),
          ),
        ).forEach(
          ([field, message], index) => {
            form.setError(
              field as FieldPath<CourseForm>,
              { type: "validate", message },
              { shouldFocus: index === 0 },
            );
          },
        );
        focusSummary();
      }
    }
  }, (errors) => {
    const invalidFacility = firstFacilityErrorIndex(errors.meetings);
    if (invalidFacility >= 0) {
      focusFacilityInput(invalidFacility);
      return;
    }
    focusSummary();
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !saving && onClose()}>
      <DialogScaffoldContent
        className="w-[calc(100%-1rem)] motion-reduce:animate-none motion-reduce:transition-none sm:max-w-2xl [&_button]:min-h-11 [&_button]:min-w-11 [&_input]:min-h-11 [&_select]:min-h-11"
        overlayClassName="motion-reduce:animate-none motion-reduce:transition-none"
      >
        <DialogScaffoldHeader>
          <DialogTitle>{course ? "Edit course" : "Add course"}</DialogTitle>
          <DialogDescription>
            Add one to eight recurring meeting patterns.
          </DialogDescription>
        </DialogScaffoldHeader>
        <form onSubmit={submit} className="contents" noValidate>
          <DialogScaffoldBody className="space-y-5 px-4 sm:px-6">
            {errorSummary ? (
              <div
                ref={summaryRef}
                tabIndex={-1}
                role="alert"
                className="rounded-md border border-destructive p-3 text-sm text-destructive"
              >
                {errorSummary}
              </div>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="course-code">Course code</Label>
                <Input
                  id="course-code"
                  maxLength={24}
                  aria-invalid={Boolean(errorFor("code"))}
                  aria-describedby={errorFor("code") ? "course-code-error" : undefined}
                  {...form.register("code", {
                    required: "Enter a course code.",
                    maxLength: { value: 24, message: "Use 24 characters or fewer." },
                  })}
                />
                <InlineError id="course-code-error" message={errorFor("code")} />
              </div>
              <div>
                <Label htmlFor="course-title">Title</Label>
                <Input
                  id="course-title"
                  maxLength={120}
                  aria-invalid={Boolean(errorFor("title"))}
                  aria-describedby={errorFor("title") ? "course-title-error" : undefined}
                  {...form.register("title", {
                    required: "Enter a course title.",
                    maxLength: { value: 120, message: "Use 120 characters or fewer." },
                  })}
                />
                <InlineError id="course-title-error" message={errorFor("title")} />
              </div>
              <div>
                <Label htmlFor="course-instructor">Instructor</Label>
                <Input
                  id="course-instructor"
                  maxLength={100}
                  aria-invalid={Boolean(errorFor("instructor"))}
                  aria-describedby={errorFor("instructor") ? "course-instructor-error" : undefined}
                  {...form.register("instructor", {
                    maxLength: { value: 100, message: "Use 100 characters or fewer." },
                  })}
                />
                <InlineError id="course-instructor-error" message={errorFor("instructor")} />
              </div>
              <div>
                <Label htmlFor="course-color">Color</Label>
                <select
                  id="course-color"
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  {...form.register("color")}
                >
                  {COLORS.map((color) => (
                    <option key={color} value={color}>{color}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <Label htmlFor="course-notes">Notes</Label>
              <Textarea
                id="course-notes"
                maxLength={500}
                aria-invalid={Boolean(errorFor("notes"))}
                aria-describedby={errorFor("notes") ? "course-notes-error" : undefined}
                {...form.register("notes", {
                  maxLength: { value: 500, message: "Use 500 characters or fewer." },
                })}
              />
              <InlineError id="course-notes-error" message={errorFor("notes")} />
            </div>
            <fieldset className="space-y-4">
              <legend className="text-sm font-semibold">Meetings</legend>
              {meetings.fields.map((field, index) => {
                const days = watchedMeetings[index]?.days ?? [];
                const locationMode =
                  watchedMeetings[index]?.locationMode ?? "tba";
                const daysError = errorFor(`meetings.${index}.days`);
                const startError = errorFor(`meetings.${index}.start`);
                const endError = errorFor(`meetings.${index}.end`);
                const facilityError = errorFor(`meetings.${index}.facilityId`);
                const facilityDetailError = errorFor(
                  `meetings.${index}.facilityDetail`,
                );
                const locationError = errorFor(`meetings.${index}.locationLabel`);
                return (
                  <section
                    key={field.id}
                    className="space-y-3 rounded-lg border p-3"
                    aria-label={`Meeting ${index + 1}`}
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">Meeting {index + 1}</h3>
                      {meetings.fields.length > 1 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            meetings.remove(index);
                            setFacilityQueries((current) =>
                              current.filter((_, queryIndex) => queryIndex !== index),
                            );
                          }}
                        >
                          <Trash2 className="mr-1 h-4 w-4" />Remove
                        </Button>
                      ) : null}
                    </div>
                    <input
                      type="hidden"
                      {...form.register(`meetings.${index}.days`, {
                        validate: (value) =>
                          value.length > 0 || "Choose at least one weekday.",
                      })}
                    />
                    <div
                      className="flex flex-wrap gap-1"
                      aria-label="Weekdays"
                      aria-invalid={Boolean(daysError)}
                      aria-describedby={daysError ? `days-${index}-error` : undefined}
                    >
                      {WEEKDAYS.map((day) => {
                        const pressed = days.includes(day);
                        return (
                          <Button
                            key={day}
                            type="button"
                            size="sm"
                            variant={pressed ? "default" : "outline"}
                            aria-pressed={pressed}
                            onClick={() => {
                              form.setValue(
                                `meetings.${index}.days`,
                                pressed
                                  ? days.filter((item) => item !== day)
                                  : [...days, day].sort(),
                                { shouldValidate: true },
                              );
                            }}
                          >
                            {DAY_SHORT_LABELS[day]}
                          </Button>
                        );
                      })}
                    </div>
                    <InlineError id={`days-${index}-error`} message={daysError} />
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor={`start-${index}`}>Start</Label>
                        <Input
                          id={`start-${index}`}
                          type="time"
                          aria-invalid={Boolean(startError)}
                          aria-describedby={startError ? `start-${index}-error` : undefined}
                          {...form.register(`meetings.${index}.start`, {
                            required: "Choose a start time.",
                          })}
                        />
                        <InlineError id={`start-${index}-error`} message={startError} />
                      </div>
                      <div>
                        <Label htmlFor={`end-${index}`}>End</Label>
                        <Input
                          id={`end-${index}`}
                          type="time"
                          aria-invalid={Boolean(endError)}
                          aria-describedby={endError ? `end-${index}-error` : undefined}
                          {...form.register(`meetings.${index}.end`, {
                            required: "Choose an end time.",
                          })}
                        />
                        <InlineError id={`end-${index}-error`} message={endError} />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor={`mode-${index}`}>Location</Label>
                      <select
                        id={`mode-${index}`}
                        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                        {...form.register(`meetings.${index}.locationMode`, {
                          onChange: () => {
                            form.clearErrors([
                              `meetings.${index}.facilityId`,
                              `meetings.${index}.facilityDetail`,
                              `meetings.${index}.locationLabel`,
                            ]);
                          },
                        })}
                      >
                        <option value="facility">Campus facility</option>
                        <option value="text">Other location</option>
                        <option value="tba">TBA</option>
                      </select>
                    </div>
                    {locationMode === "facility" ? (
                      <div className="space-y-3">
                        <div>
                          <Label htmlFor={`facility-${index}`}>Facility</Label>
                          <input
                            type="hidden"
                            {...form.register(`meetings.${index}.facilityId`, {
                              validate: (facilityId) =>
                                facilitySelectionError(
                                  "facility",
                                  facilityId,
                                  facilities.map((facility) => facility.id),
                                ),
                            })}
                          />
                          <FacilitySearchCombobox
                            id={`facility-${index}`}
                            label="Search campus facility"
                            query={facilityQueries[index] ?? ""}
                            optionsQuery={facilityOptionsQuery}
                            options={facilityOptions}
                            selectedFacilityId={
                              watchedMeetings[index]?.facilityId || undefined
                            }
                            loading={facilitiesLoading}
                            unavailable={
                              Boolean(facilitiesError) && facilities.length === 0
                            }
                            unavailableMessage="Facility search is unavailable. Try again online or choose Other location."
                            ariaInvalid={Boolean(facilityError)}
                            ariaDescribedBy={[
                              facilityError ? `facility-${index}-error` : null,
                              facilityStatus && facilitySource === "cache"
                                ? `facility-${index}-status`
                                : null,
                            ].filter(Boolean).join(" ") || undefined}
                            placeholder="Search by building, code, alias, or room..."
                            inputClassName={
                              facilityError
                                ? "border-destructive focus-visible:ring-destructive"
                                : undefined
                            }
                            onQueryChange={(query) => {
                              const selectedFacilityId = form.getValues(
                                `meetings.${index}.facilityId`,
                              );
                              const selectedFacility = facilities.find(
                                (facility) => facility.id === selectedFacilityId,
                              );
                              if (
                                shouldClearFacilitySelection(
                                  query,
                                  selectedFacilityId,
                                  selectedFacility?.name,
                                )
                              ) {
                                form.setValue(
                                  `meetings.${index}.facilityId`,
                                  "",
                                  { shouldDirty: true, shouldValidate: true },
                                );
                              }
                              setFacilityQueries((current) => {
                                const next = [...current];
                                next[index] = query;
                                return next;
                              });
                              onFacilityQueryChange(query);
                            }}
                            onFocusChange={(focused) => {
                              if (!focused) return;
                              onFacilityQueryChange(
                                getActiveFacilityQuery(facilityQueries, index),
                              );
                            }}
                            onSelect={(facility) => {
                              const selected = applyFacilitySearchSelection(
                                {
                                  facilityId: form.getValues(
                                    `meetings.${index}.facilityId`,
                                  ),
                                  facilityDetail: form.getValues(
                                    `meetings.${index}.facilityDetail`,
                                  ),
                                },
                                facility.id,
                              );
                              form.setValue(
                                `meetings.${index}.facilityId`,
                                selected.facilityId,
                                { shouldDirty: true, shouldValidate: true },
                              );
                              form.clearErrors(
                                `meetings.${index}.facilityId`,
                              );
                              setFacilityQueries((current) => {
                                const next = [...current];
                                next[index] = facility.name;
                                return next;
                              });
                              onFacilityQueryChange(facility.name);
                            }}
                          />
                          {facilityStatus && facilitySource === "cache" ? (
                            <p
                              id={`facility-${index}-status`}
                              role={facilityStatus.tone === "warning" ? "status" : undefined}
                              className={
                                facilityStatus.tone === "warning"
                                  ? "mt-1 text-sm text-amber-700 dark:text-amber-400"
                                  : "mt-1 text-sm text-muted-foreground"
                              }
                            >
                              {facilityStatus.message}
                            </p>
                          ) : null}
                          <InlineError id={`facility-${index}-error`} message={facilityError} />
                        </div>
                        <div>
                          <Label htmlFor={`facility-detail-${index}`}>Room or detail (optional)</Label>
                          <Input
                            id={`facility-detail-${index}`}
                            maxLength={160}
                            aria-invalid={Boolean(facilityDetailError)}
                            aria-describedby={
                              facilityDetailError
                                ? `facility-detail-${index}-error`
                                : undefined
                            }
                            {...form.register(`meetings.${index}.facilityDetail`, {
                              maxLength: { value: 160, message: "Use 160 characters or fewer." },
                              validate: (detail) => {
                                const facilityId = form.getValues(
                                  `meetings.${index}.facilityId`,
                                );
                                const facility = facilities.find(
                                  (item) => item.id === facilityId,
                                );
                                return (
                                  !facility ||
                                  buildFacilityLocationLabel(
                                    facility.name,
                                    detail,
                                  ).error ||
                                  true
                                );
                              },
                              onChange: () => {
                                form.clearErrors(
                                  `meetings.${index}.facilityDetail`,
                                );
                              },
                            })}
                          />
                          <InlineError
                            id={`facility-detail-${index}-error`}
                            message={facilityDetailError}
                          />
                        </div>
                      </div>
                    ) : locationMode === "text" ? (
                      <div>
                        <Label htmlFor={`location-${index}`}>Location details</Label>
                        <Input
                          id={`location-${index}`}
                          maxLength={160}
                          aria-invalid={Boolean(locationError)}
                          aria-describedby={locationError ? `location-${index}-error` : undefined}
                          {...form.register(`meetings.${index}.locationLabel`, {
                            required: "Enter a location or choose TBA.",
                            maxLength: { value: 160, message: "Use 160 characters or fewer." },
                          })}
                        />
                        <InlineError id={`location-${index}-error`} message={locationError} />
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        This meeting stays visible as unscheduled.
                      </p>
                    )}
                  </section>
                );
              })}
              {meetings.fields.length < 8 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    meetings.append(blankMeeting());
                    setFacilityQueries((current) => [...current, ""]);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />Add meeting
                </Button>
              ) : null}
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
