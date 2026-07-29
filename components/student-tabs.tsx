"use client";

import { CalendarClock, CalendarDays, Home, ListOrdered, MapPinned, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/context/app-context";
import { usePathname } from "next/navigation";
import {
  shouldShowStudentNavigation,
  STUDENT_DESTINATIONS,
  type StudentDestinationId,
} from "@/lib/navigation/student-navigation";

type Placement = "inline" | "bottom";

interface StudentTab {
  id: StudentDestinationId;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface StudentTabsProps {
  tabs?: StudentTab[];
  className?: string;
  placement?: Placement;
}

const destinationIcons: Record<StudentDestinationId, StudentTab["icon"]> = {
  map: MapPinned,
  schedule: CalendarClock,
  boarding: Home,
  events: CalendarDays,
  directory: ListOrdered,
  chat: MessageSquare,
};

const defaultTabs: StudentTab[] = STUDENT_DESTINATIONS.map((destination) => ({
  id: destination.id,
  label: destination.label,
  icon: destinationIcons[destination.id],
}));

export function StudentTabs({
  tabs = defaultTabs,
  className,
  placement = "inline",
}: StudentTabsProps) {
  const {
    activeTab,
    setActiveTab,
    visibleStudentDestinations,
    studentNavigationHydrated,
  } = useApp();
  const pathname = usePathname();
  const visibleTabs = STUDENT_DESTINATIONS.flatMap((destination) => {
    if (!visibleStudentDestinations.includes(destination.id)) return [];
    const tab = tabs.find((candidate) => candidate.id === destination.id);
    return tab ? [tab] : [];
  });

  const isInline = placement === "inline";

  if (!shouldShowStudentNavigation(pathname)) {
    return null;
  }

  // Desktop: Clean nav links, Mobile: Fixed bottom bar
  const wrapperClasses = isInline
    ? "hidden md:block" // Removed borders/bg for header integration
    : "md:hidden fixed inset-x-0 bottom-0 z-50 border-t border-border/80 bg-background/95 backdrop-blur pb-[calc(16px+env(safe-area-inset-bottom,0px))] pt-2 transition-transform duration-300";

  const innerClasses = isInline
    ? "flex items-center gap-0.5"
    : "flex items-center justify-around px-4";

  return (
    <nav
      aria-label="Student navigation"
      aria-hidden={studentNavigationHydrated ? undefined : true}
      className={cn(
        wrapperClasses,
        !studentNavigationHydrated && "invisible",
        className,
      )}
    >
      <div className={innerClasses}>
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.id === activeTab;

          return (
            <button
              key={tab.id}
              aria-current={isActive ? "page" : undefined}
              type="button"
              disabled={!studentNavigationHydrated}
              onClick={() => setActiveTab(tab.id, { clearSelection: true })}
              className={cn(
                "group relative flex items-center justify-center font-medium transition-all",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isInline
                  ? "h-8 gap-1.5 rounded-full px-2.5 text-xs"
                  : "gap-2 rounded-md px-3 py-2 text-sm",
                // Mobile specific styles
                !isInline && "flex-1 flex-col gap-1 py-1 text-xs",
                // Active states
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                // Desktop specific active background
                isInline && isActive && "bg-primary/10 shadow-sm ring-1 ring-primary/10",
              )}
            >
              {Icon ? <Icon className={cn(isInline ? "h-4 w-4" : "h-5 w-5")} aria-hidden /> : null}
              <span className={cn(isInline ? "hidden sm:inline" : "text-[10px] font-medium")}>{tab.label}</span>

              {/* Mobile Active Indicator */}
              {!isInline && isActive && (
                <span
                  aria-hidden
                  className="absolute -top-2 left-1/2 h-1 w-8 -translate-x-1/2 rounded-full bg-primary"
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
