import type { Metadata } from "next";
import { SchedulePageClient } from "@/components/schedule/schedule-page-client";

export const metadata: Metadata = {
  title: "My Schedule",
  description: "Plan recurring classes and open their campus locations.",
};

export default function SchedulePage() {
  return <SchedulePageClient />;
}
