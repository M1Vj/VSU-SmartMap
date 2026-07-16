"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DialogScaffoldBody,
  DialogScaffoldContent,
  DialogScaffoldHeader,
  DialogScaffoldFooter,
} from "@/components/ui/dialog-scaffold";
import { SuggestionForm } from "@/components/events/suggestion-form";

export function SuggestEventDialog() {
  const [open, setOpen] = React.useState(false);

  const handleSuccess = React.useCallback(() => {
    setOpen(false);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full md:w-auto" data-tour="events-suggest">
          <Plus className="mr-2 h-4 w-4" />
          Suggest Event
        </Button>
      </DialogTrigger>
      <DialogScaffoldContent className="sm:max-w-[600px]">
        <DialogScaffoldHeader>
          <DialogTitle>Suggest an Event</DialogTitle>
          <DialogDescription>
            Submit an event suggestion for the VSU community. All suggestions require admin approval.
          </DialogDescription>
        </DialogScaffoldHeader>
        
        <DialogScaffoldBody>
          <SuggestionForm onSuccess={handleSuccess} open={open} />
        </DialogScaffoldBody>
      </DialogScaffoldContent>
    </Dialog>
  );
}
