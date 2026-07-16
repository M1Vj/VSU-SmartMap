'use client';

import { useState, useEffect } from 'react';
import { MoreHorizontal, Pencil, Trash2, Home, History } from 'lucide-react';
import type { Facility } from '@/lib/types/facility';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { FacilityHistoryDialog } from './facility-history-dialog';

interface FacilityRowActionsProps {
  facility: Facility;
  onEdit?: (facility: Facility) => void;
  onManageRooms?: (facility: Facility) => void;
  onDelete?: (facility: Facility) => void;
  disabled?: boolean;
}

export function FacilityRowActions({
  facility,
  onEdit,
  onManageRooms,
  onDelete,
  disabled,
}: FacilityRowActionsProps) {
  const [mounted, setMounted] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleEdit = () => onEdit?.(facility);
  const handleRooms = () => onManageRooms?.(facility);
  const handleDelete = () => onDelete?.(facility);

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="h-8 w-8" disabled>
        <MoreHorizontal className="h-4 w-4" aria-hidden />
        <span className="sr-only">Open row actions</span>
      </Button>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={disabled}>
            <MoreHorizontal className="h-4 w-4" aria-hidden />
            <span className="sr-only">Open row actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onSelect={handleEdit} disabled={disabled || !onEdit}>
            <Pencil className="h-4 w-4" aria-hidden />
            Edit
          </DropdownMenuItem>
          {facility.hasRooms && (
            <DropdownMenuItem onSelect={handleRooms} disabled={disabled || !onManageRooms}>
              <Home className="h-4 w-4" aria-hidden />
              Manage Rooms
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => setShowHistory(true)}>
            <History className="h-4 w-4" aria-hidden />
            History
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={handleDelete}
            disabled={disabled || !onDelete}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <FacilityHistoryDialog
        facilityId={facility.id}
        facilityName={facility.name}
        open={showHistory}
        onOpenChange={setShowHistory}
      />
    </>
  );
}
