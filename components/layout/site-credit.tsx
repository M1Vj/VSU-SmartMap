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
  if (pathname === "/") return null;

  const hasMobileNavigation =
    reserveMobileNavigation && shouldShowStudentNavigation(pathname);

  return (
    <footer
      className={cn(
        "relative z-20 -mt-6 flex h-6 shrink-0 items-center justify-center bg-transparent px-3 text-center text-[10px] leading-none text-foreground",
        hasMobileNavigation && "hidden md:flex",
      )}
    >
      <a
        href="https://github.com/M1Vj"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-6 items-center rounded-sm px-1 underline-offset-2 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-1"
      >
        Developed by Vj F Mabansag
      </a>
    </footer>
  );
}
