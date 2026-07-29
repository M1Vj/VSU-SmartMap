import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { StudentTabs } from "@/components/student-tabs";
import { AppProvider } from "@/lib/context/app-context";
import { FacilitySheet } from "@/components/facility/facility-sheet";
import { SiteCredit } from "@/components/layout/site-credit";

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense>
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
