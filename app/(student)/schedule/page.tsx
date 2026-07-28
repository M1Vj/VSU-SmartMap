import type { Metadata } from "next";
import { CalendarClock } from "lucide-react";

export const metadata: Metadata = {
  title: "Schedule | VSU SmartMap",
  description: "Student schedule planner for VSU SmartMap.",
};

export default function SchedulePage() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-4xl items-center px-4 py-12 sm:px-6">
      <section className="w-full rounded-2xl border bg-card p-8 text-card-foreground shadow-sm sm:p-12">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <CalendarClock className="h-6 w-6" aria-hidden />
        </div>
        <p className="mb-2 text-sm font-medium text-primary">Student schedule</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Your local planner is being prepared
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
          This branch is setting up the schedule experience. Planner editing and
          local saving will arrive with the complete schedule workspace.
        </p>
      </section>
    </div>
  );
}
