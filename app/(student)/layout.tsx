import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { StudentTabs } from "@/components/student-tabs";
import { AppProvider } from "@/lib/context/app-context";
import { FacilitySheet } from "@/components/facility/facility-sheet";
import { SiteCredit } from "@/components/layout/site-credit";

function StudentLoadingFallback() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="flex min-h-[100dvh] w-full items-center justify-center bg-background px-6 text-muted-foreground"
    >
      <span className="rounded-lg border border-border/60 bg-card/80 px-4 py-3 text-sm shadow-sm">
        Loading SmartMap…
      </span>
    </div>
  );
}

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<StudentLoadingFallback />}>
      <AppProvider>
        <div className="flex h-[100dvh] flex-col overflow-hidden bg-background">
          <AppHeader tabsSlot={<StudentTabs placement="inline" />} />
          <main id="main-content" tabIndex={-1} className="flex-1 relative w-full overflow-hidden outline-none">
            {children}
            <FacilitySheet />
          </main>
          <SiteCredit />
          <StudentTabs placement="bottom" />
        </div>
      </AppProvider>
    </Suspense>
  );
}
