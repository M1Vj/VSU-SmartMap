export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const MAX_SCHEDULE_COURSES = 200;

export type ScheduleColor =
  | "blue"
  | "green"
  | "violet"
  | "amber"
  | "rose"
  | "cyan"
  | "slate";

export interface ScheduleMeeting {
  id: string;
  days: IsoWeekday[];
  startMinute: number;
  endMinute: number;
  facilityId?: string;
  locationLabel?: string;
}

export interface ScheduleCourse {
  id: string;
  code: string;
  title: string;
  instructor?: string;
  notes?: string;
  color: ScheduleColor;
  meetings: ScheduleMeeting[];
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleMeetingInput {
  id?: unknown;
  days?: unknown;
  startMinute?: unknown;
  endMinute?: unknown;
  facilityId?: unknown;
  locationLabel?: unknown;
}

export interface ScheduleCourseInput {
  id?: unknown;
  code?: unknown;
  title?: unknown;
  instructor?: unknown;
  notes?: unknown;
  color?: unknown;
  meetings?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}
