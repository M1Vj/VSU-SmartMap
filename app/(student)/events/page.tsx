import type { Metadata } from "next";
import { EventsView } from "@/components/events/events-view";
import { getEventsCached } from "@/lib/actions/events";
import type { EventCategory } from "@/lib/types/events";

export const metadata: Metadata = {
  title: "Events",
  description: "Stay updated with what's happening around VSU.",
};

export default async function EventsPage(props: { searchParams: Promise<any> }) {
  const searchParams = await props.searchParams;
  const query = searchParams?.q;
  const categoryParam = searchParams?.category;

  const category = (categoryParam && categoryParam !== "all")
    ? (categoryParam as EventCategory)
    : undefined;

  const result = await getEventsCached({
    query,
    category,
    timeframe: "upcoming",
  }).catch((err) => ({
    data: [],
    error: { message: err instanceof Error ? err.message : String(err) },
  }));

  const events = result.data || [];
  const error = result.error;

  if (error) {
    console.error("Failed to fetch events:", error);
  }

  return (
    <div className="h-full w-full overflow-y-auto bg-background">
      <div className="container mx-auto px-4 py-6 pb-24 md:pb-6">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">
            Campus Events
          </h1>
          <p className="mt-1 text-muted-foreground">
            Stay updated with what&apos;s happening around VSU
          </p>
        </header>

        {error && (
          <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <p className="font-semibold text-destructive">Events are currently unavailable.</p>
            <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
          </div>
        )}

        <EventsView events={events || []} />
      </div>
    </div>
  );
}
