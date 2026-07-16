"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { HelpCircle, Lightbulb, PlayCircle } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getGuideForPath, type HelpGuide, type HelpSection } from "@/lib/help/guides";

const AUDIENCE_LABEL: Record<HelpGuide["audience"], string> = {
  student: "Student guide",
  owner: "Owner guide",
  admin: "Admin guide",
  general: "Guide",
};

export function HelpGuideDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const pathname = usePathname();
  const guide = getGuideForPath(pathname);
  const hasTour = Boolean(guide.tourSteps && guide.tourSteps.length > 0);

  const startInteractiveTour = () => {
    onOpenChange(false);
    const steps = guide.tourSteps;
    if (!steps || steps.length === 0) return;
    // Let the dialog close first so driver.js can spotlight the page controls.
    window.setTimeout(() => {
      void import("@/lib/help/tour").then(({ startTour }) => startTour(steps));
    }, 220);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 overflow-hidden p-0">
        <DialogHeader className="space-y-1 border-b p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            {AUDIENCE_LABEL[guide.audience]}
          </p>
          <DialogTitle className="text-xl">{guide.title}</DialogTitle>
          <DialogDescription>{guide.intro}</DialogDescription>
        </DialogHeader>

        {hasTour ? (
          <div className="border-b p-4">
            <Button className="w-full gap-2" onClick={startInteractiveTour}>
              <PlayCircle className="h-4 w-4" aria-hidden="true" />
              Start interactive tour
            </Button>
            <p className="mt-1.5 text-center text-xs text-muted-foreground">
              We&apos;ll point out each tool on this page, step by step.
            </p>
          </div>
        ) : null}

        <div className="max-h-[60vh] space-y-4 overflow-y-auto p-6">
          {guide.sections.map((section, index) => (
            <GuideSectionCard key={`${section.heading}-${index}`} section={section} />
          ))}
        </div>

        <div className="border-t bg-muted/40 p-3 text-center text-xs text-muted-foreground">
          Guide for: {guide.title}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GuideSectionCard({ section }: { section: HelpSection }) {
  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm">
      <h3 className="text-sm font-semibold">{section.heading}</h3>
      {section.body ? (
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{section.body}</p>
      ) : null}

      {section.steps && section.steps.length > 0 ? (
        <ol className="mt-3 space-y-2">
          {section.steps.map((step, index) => (
            <li key={index} className="flex gap-3 text-sm leading-6">
              <span
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
                aria-hidden="true"
              >
                {index + 1}
              </span>
              <span className="text-muted-foreground">{step}</span>
            </li>
          ))}
        </ol>
      ) : null}

      {section.tips && section.tips.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {section.tips.map((tip, index) => (
            <li key={index} className="flex gap-2 text-sm leading-6">
              <Lightbulb
                className="mt-1 h-4 w-4 shrink-0 text-amber-500"
                aria-hidden="true"
              />
              <span className="text-muted-foreground">{tip}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/**
 * Self-contained Help button + dialog for headers (admin, owner). Manages its
 * own open state and honours the ?guide=1 deep link.
 */
export function HelpGuideButton({
  variant = "ghost",
  size = "sm",
  className,
  label = "Help & guide",
  showLabel = true,
}: {
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
  label?: string;
  showLabel?: boolean;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("guide") === "1") {
      setOpen(true);
    }
  }, []);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setOpen(true)}
        className={cn("gap-2", className)}
        aria-label={label}
      >
        <HelpCircle className="h-4 w-4" aria-hidden="true" />
        {showLabel ? label : <span className="sr-only">{label}</span>}
      </Button>
      <HelpGuideDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
