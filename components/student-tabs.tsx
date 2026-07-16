"use client";

import { useCallback } from "react";
import { CalendarDays, Home, ListOrdered, MapPinned, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/context/app-context";
import { usePathname } from "next/navigation";

type TabId = "map" | "boarding" | "directory" | "events" | "chat";
type Placement = "inline" | "bottom";

interface StudentTab {
  id: TabId;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface StudentTabsProps {
  tabs?: StudentTab[];
  className?: string;
  placement?: Placement;
}

const defaultTabs: StudentTab[] = [
  { id: "map", label: "Map", icon: MapPinned },
  { id: "boarding", label: "Boarding", icon: Home },
  { id: "events", label: "Events", icon: CalendarDays },
  { id: "directory", label: "Directory", icon: ListOrdered },
  { id: "chat", label: "Chat", icon: MessageSquare },
];

export function StudentTabs({
  tabs = defaultTabs,
  className,
  placement = "inline",
}: StudentTabsProps) {
  const { activeTab, setActiveTab } = useApp();
  const pathname = usePathname();
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      const lastIndex = tabs.length - 1;
      let nextIndex = index;

      if (event.key === "ArrowRight") nextIndex = index === lastIndex ? 0 : index + 1;
      if (event.key === "ArrowLeft") nextIndex = index === 0 ? lastIndex : index - 1;
      if (event.key === "Home") nextIndex = 0;
      if (event.key === "End") nextIndex = lastIndex;

      if (nextIndex !== index) {
        event.preventDefault();
        setActiveTab(tabs[nextIndex].id as TabId, { clearSelection: true });
      }
    },
    [tabs, setActiveTab],
  );

  const isInline = placement === "inline";

  if (pathname === "/info") {
    return null;
  }

  // Desktop: Clean nav links, Mobile: Fixed bottom bar
  const wrapperClasses = isInline
    ? "hidden md:block" // Removed borders/bg for header integration
    : "md:hidden fixed inset-x-0 bottom-0 z-20 border-t border-border/80 bg-background/95 backdrop-blur pb-[calc(16px+env(safe-area-inset-bottom,0px))] pt-2 transition-transform duration-300";

  const innerClasses = isInline
    ? "flex items-center gap-0.5"
    : "flex items-center justify-around px-4";

  return (
    <nav
      role="tablist"
      aria-label="Student navigation"
      className={cn(wrapperClasses, className)}
    >
      <div className={innerClasses}>
        {tabs.map((tab, index) => {
          const Icon = tab.icon;
          const isActive = tab.id === activeTab;
          const tabIndex = isActive ? 0 : -1;

          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={`${tab.id}-panel`}
              tabIndex={tabIndex}
              type="button"
              onClick={() => setActiveTab(tab.id, { clearSelection: true })}
              onKeyDown={(event) => handleKeyDown(event, index)}
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
