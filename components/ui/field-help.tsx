'use client';

import * as React from 'react';
import { CircleHelp } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface FieldHelpProps {
  content: string | React.ReactNode;
  className?: string;
}

export function FieldHelp({ content, className }: FieldHelpProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "inline-flex items-center justify-center rounded-full text-muted-foreground/60 hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ml-1.5 align-middle",
            className
          )}
          aria-label="Field information"
        >
          <CircleHelp className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="z-[10000] w-64 p-3 text-sm shadow-xl border-primary/10 bg-background/95 backdrop-blur-sm"
      >
        <div className="space-y-1.5">
          {typeof content === 'string' ? (
            <p className="text-muted-foreground leading-relaxed">{content}</p>
          ) : (
            content
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
