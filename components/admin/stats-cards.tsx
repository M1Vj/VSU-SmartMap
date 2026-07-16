import { Building, DoorOpen, Inbox, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AdminStats } from '@/lib/admin/dashboard';

const ICONS = {
  facilities: Building,
  rooms: DoorOpen,
  events: Calendar,
  pendingReviews: Inbox,
} as const;

const CARD_STYLES = {
  facilities:
    "from-emerald-50 via-white to-white border-emerald-100 text-emerald-900 dark:from-emerald-950/40 dark:via-background dark:to-background dark:border-emerald-900 dark:text-emerald-100",
  rooms:
    "from-sky-50 via-white to-white border-sky-100 text-sky-900 dark:from-sky-950/40 dark:via-background dark:to-background dark:border-sky-900 dark:text-sky-100",
  events:
    "from-violet-50 via-white to-white border-violet-100 text-violet-900 dark:from-violet-950/40 dark:via-background dark:to-background dark:border-violet-900 dark:text-violet-100",
  pendingReviews:
    "from-amber-50 via-white to-white border-amber-100 text-amber-900 dark:from-amber-950/40 dark:via-background dark:to-background dark:border-amber-900 dark:text-amber-100",
} as const;

interface StatsCardsProps {
  stats: AdminStats;
}

export function StatsCards({ stats }: StatsCardsProps) {
  const pendingReviews = stats.pendingSubmissions + stats.pendingEventSuggestions;

  const items = [
    {
      key: "facilities",
      label: "Facilities",
      value: stats.facilities,
      icon: ICONS.facilities,
      description: "Live count",
    },
    {
      key: "rooms",
      label: "Rooms",
      value: stats.rooms,
      icon: ICONS.rooms,
      description: "Live count",
    },
    {
      key: "events",
      label: "Events",
      value: stats.events,
      icon: ICONS.events,
      description: "Published total",
    },
    {
      key: "pendingReviews",
      label: "Pending reviews",
      value: pendingReviews,
      icon: ICONS.pendingReviews,
      description: `Facilities/rooms: ${stats.pendingSubmissions}, events: ${stats.pendingEventSuggestions}`,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <Card
          key={item.key}
          className={`border bg-gradient-to-br ${CARD_STYLES[item.key as keyof typeof CARD_STYLES]
            } shadow-sm`}
        >
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <div className="space-y-1">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {item.label}
              </CardTitle>
              <div className="text-2xl font-semibold text-foreground">
                {item.value}
              </div>
            </div>
            <div className="rounded-full bg-white/70 p-2 shadow-inner dark:bg-white/5">
              <item.icon className="h-5 w-5 text-foreground" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground">{item.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
