"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function ProjectDisclaimerDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setOpen(true), 250);
    return () => window.clearTimeout(timer);
  }, []);

  const dismiss = () => {
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : dismiss())}>
      <DialogContent className="mx-4 max-w-lg gap-5 p-5 sm:p-6">
        <DialogHeader>
          <DialogTitle>A quick note</DialogTitle>
          <DialogDescription className="space-y-3 pt-1 leading-6">
            <span className="block">
              Campus SmartMap for VSU is not owned, operated, or endorsed by
              Visayas State University. Wala ni nako gi-present as an official
              university project.
            </span>
            <span className="block">
              I built it as a non-profit student project to help students find
              places on campus. I spent my own time and money on it.
            </span>
            <span className="block">
              I was told university admin may review it for possible copyright
              concerns. If this project gets taken down, sorry daan. Ako ang
              accountable for not asking the university first.
            </span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" onClick={dismiss}>
            I understand
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
