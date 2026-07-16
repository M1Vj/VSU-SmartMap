import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
  xl: "h-12 w-12",
} as const;

interface SpinnerProps {
  size?: keyof typeof sizeClasses;
  className?: string;
  label?: string;
}

export function Spinner({ size = "md", className, label }: SpinnerProps) {
  return (
    <div className="flex items-center justify-center gap-2" role="status">
      <Loader2
        className={cn("animate-spin text-muted-foreground", sizeClasses[size], className)}
        aria-hidden="true"
      />
      {label && <span className="text-sm text-muted-foreground">{label}</span>}
      <span className="sr-only">{label || "Loading..."}</span>
    </div>
  );
}
