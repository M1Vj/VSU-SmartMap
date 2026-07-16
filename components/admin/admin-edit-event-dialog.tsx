"use client";

import * as React from "react";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import {
  Dialog,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DialogScaffoldBody,
  DialogScaffoldContent,
  DialogScaffoldFooter,
  DialogScaffoldHeader,
} from "@/components/ui/dialog-scaffold";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FacilitySelectorUnified } from "@/components/facility/facility-selector-unified";
import { updateEvent } from "@/lib/actions/events";
import { EVENT_CATEGORIES, type Event } from "@/lib/types/events";

const formSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters"),
  description: z.string().optional(),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  locationText: z.string().min(1, "Location is required"),
  locationId: z.string().uuid().optional().nullable(),
  category: z.enum(EVENT_CATEGORIES),
});

interface AdminEditEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: Event | null;
}

export function AdminEditEventDialog({
  open,
  onOpenChange,
  event,
}: AdminEditEventDialogProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const router = useRouter();

  const defaultValues = React.useMemo<z.infer<typeof formSchema>>(
    () => ({
      title: event?.title ?? "",
      description: event?.description ?? "",
      startTime: event
        ? format(new Date(event.startTime), "yyyy-MM-dd'T'HH:mm")
        : "",
      endTime: event ? format(new Date(event.endTime), "yyyy-MM-dd'T'HH:mm") : "",
      locationText: event?.locationText ?? "",
      locationId: event?.locationId ?? null,
      category: event?.category ?? "academic",
    }),
    [event]
  );

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  const locationId = form.watch("locationId");

  React.useEffect(() => {
    if (!open) return;
    form.reset(defaultValues);
  }, [defaultValues, form, open]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!event) return;

    setIsSubmitting(true);
    try {
      const result = await updateEvent(event.id, {
        ...values,
        startTime: new Date(values.startTime).toISOString(),
        endTime: new Date(values.endTime).toISOString(),
      });

      if (result.error) {
        throw new Error(result.error.message || "Failed to update event");
      }

      toast.success("Event updated successfully!");
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogScaffoldContent className="sm:max-w-[600px]">
        <DialogScaffoldHeader>
          <DialogTitle>Edit Event</DialogTitle>
          <DialogDescription>
            Update event details. Changes are published immediately.
          </DialogDescription>
        </DialogScaffoldHeader>

        <DialogScaffoldBody>
          <Form {...form}>
            <form
              id="admin-edit-event-form"
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4"
            >
              <input type="hidden" {...form.register("locationId")} />
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Event Title</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. VSU Anniversary" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe the event..."
                        className="resize-none h-20"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Time</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Time</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {EVENT_CATEGORIES.map((cat) => (
                            <SelectItem key={cat} value={cat}>
                              {cat.charAt(0).toUpperCase() + cat.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="locationText"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <FormControl>
                        <FacilitySelectorUnified
                          value={locationId ?? field.value}
                          onSelect={(f) => {
                            field.onChange(f.name);
                            form.setValue("locationId", f.id, {
                              shouldDirty: true,
                              shouldValidate: true,
                            });
                          }}
                          onCustomEntry={(val) => {
                            field.onChange(val);
                            form.setValue("locationId", null, {
                              shouldDirty: true,
                              shouldValidate: true,
                            });
                          }}
                          allowCustom
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </form>
          </Form>
        </DialogScaffoldBody>

        <DialogScaffoldFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="admin-edit-event-form"
            disabled={isSubmitting || !event}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </DialogScaffoldFooter>
      </DialogScaffoldContent>
    </Dialog>
  );
}
