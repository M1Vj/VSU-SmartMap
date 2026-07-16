import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Pathfinding | Campus SmartMap for VSU Admin",
  description: "Admin tools for testing and debugging pathfinding.",
};

export default function PathfindingPage() {
  redirect("/admin/navigation");
}
