"use client";

import { usePathname } from "next/navigation";
import { shouldShowStudentNavigation } from "@/lib/navigation/student-navigation";
import { cn } from "@/lib/utils";

export function SiteCredit({
  reserveMobileNavigation = true,
}: {
  reserveMobileNavigation?: boolean;
}) {
  const pathname = usePathname();
  if (pathname === "/") {
    return (
      <div
        aria-hidden="true"
        className={cn(
          "shrink-0 md:hidden",
          reserveMobileNavigation &&
            "mb-[calc(5.25rem+env(safe-area-inset-bottom))]",
        )}
      />
    );
  }

  const hasMobileNavigation =
    reserveMobileNavigation && shouldShowStudentNavigation(pathname);

  return (
    <footer
      className={cn(
        "relative z-20 -mt-5 flex h-5 shrink-0 items-center justify-center bg-transparent px-3 text-center text-[10px] leading-none text-muted-foreground md:mb-0",
        hasMobileNavigation &&
          "mb-[calc(5.25rem+env(safe-area-inset-bottom))]",
      )}
    >
      <a
        href="https://github.com/M1Vj"
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-sm underline-offset-2 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
      >
        Developed by Vj F Mabansag
      </a>
    </footer>
  );
}
