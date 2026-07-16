"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";

const DialogScaffoldContent = React.forwardRef<
  React.ElementRef<typeof DialogContent>,
  React.ComponentPropsWithoutRef<typeof DialogContent> & { overlayClassName?: string }
>(({ className, overlayClassName, ...props }, ref) => (
  <DialogContent
    ref={ref}
    overlayClassName={overlayClassName}
    className={cn("max-h-[85dvh] p-0 flex flex-col gap-0 overflow-hidden", className)}
    {...props}
  />
));
DialogScaffoldContent.displayName = "DialogScaffoldContent";

function DialogScaffoldHeader({
  className,
  ...props
}: React.ComponentProps<typeof DialogHeader>) {
  return (
    <DialogHeader
      className={cn("p-6 pb-2 shrink-0", className)}
      {...props}
    />
  );
}

function DialogScaffoldBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex-1 overflow-y-auto px-6 py-2", className)}
      {...props}
    />
  );
}

function DialogScaffoldFooter({
  className,
  ...props
}: React.ComponentProps<typeof DialogFooter>) {
  return (
    <DialogFooter
      className={cn("p-6 pt-2 shrink-0 border-t", className)}
      {...props}
    />
  );
}

export {
  DialogScaffoldContent,
  DialogScaffoldHeader,
  DialogScaffoldBody,
  DialogScaffoldFooter,
};
