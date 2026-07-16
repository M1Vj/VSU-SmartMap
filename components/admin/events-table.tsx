"use client";

import * as React from "react";
import { format } from "date-fns";
import { MoreHorizontal, Pencil, Trash2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Event } from "@/lib/types/events";
import { deleteEvent } from "@/lib/actions/events";
import { AdminEditEventDialog } from "@/components/admin/admin-edit-event-dialog";

interface EventsTableProps {
  events: Event[];
  emptyMessage?: string;
}

export function EventsTable({
  events,
  emptyMessage = "No events found.",
}: EventsTableProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = React.useState<string | null>(null);
  const [editOpen, setEditOpen] = React.useState(false);
  const [selectedEvent, setSelectedEvent] = React.useState<Event | null>(null);

  const handleEdit = (event: Event) => {
    setSelectedEvent(event);
    setEditOpen(true);
  };

  const handleEditOpenChange = (open: boolean) => {
    setEditOpen(open);
    if (!open) {
      setSelectedEvent(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setIsDeleting(id);
      const result = await deleteEvent(id);
      
      if (result.error) {
        throw new Error(result.error.message);
      }
      
      toast.success("Event deleted successfully");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete event");
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Date & Time</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="w-[70px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              events.map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span>{event.title}</span>
                      {event.description && (
                        <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {event.description}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {event.category}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>{format(new Date(event.startTime), "MMM d, yyyy")}</div>
                      <div className="text-muted-foreground text-xs">
                        {format(new Date(event.startTime), "h:mm a")} -{" "}
                        {format(new Date(event.endTime), "h:mm a")}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <MapPin className="mr-1 h-3 w-3" />
                      <span className="truncate max-w-[150px]">
                        {event.locationText || "See details"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onSelect={() => handleEdit(event)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          disabled={isDeleting === event.id}
                          onSelect={() => void handleDelete(event.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AdminEditEventDialog
        open={editOpen}
        onOpenChange={handleEditOpenChange}
        event={selectedEvent}
      />
    </>
  );
}
