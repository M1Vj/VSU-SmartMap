import type { ScheduleCourse, ScheduleMeeting } from "./types";

export interface ScheduleConflict {
  courseA: ScheduleCourse;
  meetingA: ScheduleMeeting;
  courseB: ScheduleCourse;
  meetingB: ScheduleMeeting;
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareEndpoint(
  a: readonly [string, string],
  b: readonly [string, string],
): number {
  return compareText(a[0], b[0]) || compareText(a[1], b[1]);
}

export function meetingsOverlap(
  a: ScheduleMeeting,
  b: ScheduleMeeting,
): boolean {
  const sharesDay = a.days.some((day) => b.days.includes(day));
  return sharesDay && a.startMinute < b.endMinute && b.startMinute < a.endMinute;
}

export function findScheduleConflicts(
  courses: readonly ScheduleCourse[],
): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];
  const seenPairs = new Set<string>();
  for (let courseAIndex = 0; courseAIndex < courses.length; courseAIndex += 1) {
    const courseA = courses[courseAIndex]!;
    for (
      let courseBIndex = courseAIndex + 1;
      courseBIndex < courses.length;
      courseBIndex += 1
    ) {
      const courseB = courses[courseBIndex]!;
      if (courseA.id === courseB.id) continue;
      for (const meetingA of courseA.meetings) {
        for (const meetingB of courseB.meetings) {
          const endpointA = [courseA.id, meetingA.id] as const;
          const endpointB = [courseB.id, meetingB.id] as const;
          const endpoints =
            compareEndpoint(endpointA, endpointB) <= 0
              ? [endpointA, endpointB]
              : [endpointB, endpointA];
          const pairKey = JSON.stringify(endpoints);
          if (
            !seenPairs.has(pairKey) &&
            meetingsOverlap(meetingA, meetingB)
          ) {
            seenPairs.add(pairKey);
            conflicts.push(
              endpoints[0] === endpointA
                ? { courseA, meetingA, courseB, meetingB }
                : {
                    courseA: courseB,
                    meetingA: meetingB,
                    courseB: courseA,
                    meetingB: meetingA,
                  },
            );
          }
        }
      }
    }
  }
  return conflicts.sort(
    (a, b) =>
      compareEndpoint(
        [a.courseA.id, a.meetingA.id],
        [b.courseA.id, b.meetingA.id],
      ) ||
      compareEndpoint(
        [a.courseB.id, a.meetingB.id],
        [b.courseB.id, b.meetingB.id],
      ),
  );
}
