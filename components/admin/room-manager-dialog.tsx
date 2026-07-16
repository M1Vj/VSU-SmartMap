'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import type { Facility } from '@/lib/types/facility';
import { getRoomsByFacility } from '@/lib/supabase/queries/rooms';
import { Button } from '@/components/ui/button';
import { Dialog, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import {
  DialogScaffoldBody,
  DialogScaffoldContent,
  DialogScaffoldHeader,
} from '@/components/ui/dialog-scaffold';
import { RoomForm } from './room-form';
import { RoomList, type RoomRecord } from './room-list';
import {
  createRoomAction,
  deleteRoomAction,
  updateRoomAction,
} from '@/app/admin/facilities/actions';
import { uploadRoomImageClient } from '@/lib/supabase/storage-client';
import { useRouter } from 'next/navigation';
import type { RoomFormValues } from '@/lib/validation/room';
import { ConfirmDialog } from './confirm-dialog';
import { toast } from 'sonner';

interface RoomManagerDialogProps {
  open: boolean;
  facility?: Facility;
  onOpenChange: (open: boolean) => void;
}



type RoomRowLike = {
  id: string;
  room_code: string;
  name?: string | null;
  description?: string | null;
  floor?: number | null;
  updated_at?: string | null;
  image_url?: string | null;
};

const toRoomRecord = (row: RoomRowLike): RoomRecord => ({
  id: row.id,
  roomCode: row.room_code,
  name: row.name ?? undefined,
  description: row.description ?? undefined,
  floor: row.floor ?? undefined,
  updatedAt: row.updated_at ?? undefined,
  imageUrl: row.image_url ?? undefined,
});

export function RoomManagerDialog({ open, facility, onOpenChange }: RoomManagerDialogProps) {
  const [rooms, setRooms] = useState<RoomRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [mode, setMode] = useState<'create' | 'edit'>('create');
  const [selectedRoom, setSelectedRoom] = useState<RoomRecord | null>(null);
  const [isPending, startTransition] = useTransition();
  const [roomToDelete, setRoomToDelete] = useState<RoomRecord | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const router = useRouter();

  const title = useMemo(() => facility?.name ?? 'Rooms', [facility]);

  useEffect(() => {
    if (!open || !facility) return;

    const load = async () => {
      setLoading(true);
      setError(null);
      const { data, error: roomsError } = await getRoomsByFacility({
        facilityId: facility.id,
      });

      if (roomsError) {
        setError(roomsError.message);
      } else if (data) {
        setRooms(data.map(toRoomRecord));
      } else {
        setRooms([]);
      }
      setLoading(false);
    };

    load();
  }, [facility, open]);

  const handleCreate = () => {
    setMode('create');
    setSelectedRoom(null);
    setFormOpen(true);
  };

  const handleEdit = (room: RoomRecord) => {
    setMode('edit');
    setSelectedRoom(room);
    setFormOpen(true);
  };

  const syncRoomImage = async (room: RoomRecord | RoomRowLike, file?: File | null, clearImage?: boolean) => {
    if (clearImage && !file) {
      const result = await updateRoomAction(room.id, { imageUrl: null });
      if (result.error) throw new Error(result.error);
      return result.data ? toRoomRecord(result.data as RoomRowLike) : { ...room, imageUrl: undefined } as RoomRecord;
    }

    if (!file) return room as RoomRecord;

    const upload = await uploadRoomImageClient(facility!.id, room.id, file);
    if (upload.error) throw new Error(upload.error.message);

    const publicUrl = upload.data?.publicUrl ?? undefined;
    const updateResult = await updateRoomAction(room.id, { imageUrl: publicUrl });
    if (updateResult.error) throw new Error(updateResult.error);

    return updateResult.data ? toRoomRecord(updateResult.data) : { ...room, imageUrl: publicUrl } as RoomRecord;
  };

  const handleRoomSubmit = async (
    values: RoomFormValues,
    options?: { file?: File | null; clearImage?: boolean }
  ) => {
    if (!facility) return;
    setError(null);
    const file = options?.file ?? null;
    const clearImage = options?.clearImage ?? false;



    try {
      if (mode === 'create') {
        const result = await createRoomAction({ ...values, facilityId: facility.id });
        if (result.error) {
          setError(result.error);
          toast.error('Failed to create room');
          return;
        }
        if (result.data) {
          const created = await syncRoomImage(result.data as RoomRowLike, file, clearImage);
          setRooms((prev) => [...prev, created]);
          toast.success('Room created successfully');
        }
      } else if (selectedRoom) {

        const result = await updateRoomAction(selectedRoom.id, { ...values, facilityId: facility.id });
        if (result.error) {
          setError(result.error);
          toast.error('Failed to update room');
          return;
        }

        let updated = result.data ? toRoomRecord(result.data) : selectedRoom;
        updated = await syncRoomImage(updated, file, clearImage);

        setRooms((prev) => prev.map((room) => (room.id === updated.id ? updated : room)));
        toast.success('Room updated successfully');
      }

      setFormOpen(false);
      startTransition(() => router.refresh());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(message);
      toast.error('Failed to save room');
    }
  };

  const handleDelete = (room: RoomRecord) => {
    setError(null);
    setRoomToDelete(room);
  };

  const confirmDelete = async () => {
    if (!roomToDelete) {
      return;
    }

    setDeleteLoading(true);
    const result = await deleteRoomAction(roomToDelete.id);
    if (result.error) {
      setError(result.error);
      toast.error('Failed to delete room');
      setDeleteLoading(false);
      setRoomToDelete(null);
      return;
    }

    startTransition(() => {
      setRooms((prev) => prev.filter((item) => item.id !== roomToDelete.id));
      router.refresh();
    });

    toast.success('Room deleted successfully');
    setDeleteLoading(false);
    setRoomToDelete(null);
  };

  const cancelDelete = () => {
    if (deleteLoading) return;
    setRoomToDelete(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogScaffoldContent className="max-w-4xl">
          <DialogScaffoldHeader>
            <DialogTitle>Manage rooms</DialogTitle>
            <DialogDescription>
              {title}
            </DialogDescription>
          </DialogScaffoldHeader>

          <DialogScaffoldBody className="py-4">
            {!facility && (
              <p className="text-sm text-muted-foreground">Select a facility to manage rooms.</p>
            )}

            {facility && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm text-muted-foreground">
                    Rooms linked to {facility.name}
                  </div>
                   <Button size="sm" onClick={handleCreate} disabled={isPending} loading={isPending}>
                     Add room
                   </Button>
                </div>

                {formOpen && (
                  <RoomForm
                    facilityId={facility.id}
                    facilityCode={facility.code}
                    initialValues={selectedRoom ?? undefined}
                    submitting={isPending}
                    onSubmit={handleRoomSubmit}
                    onCancel={() => setFormOpen(false)}
                  />
                )}

                {error && <p className="text-sm text-destructive">{error}</p>}

                {loading ? (
                  <p className="text-sm text-muted-foreground">Loading rooms...</p>
                ) : (
                  <RoomList rooms={rooms} onEdit={handleEdit} onDelete={handleDelete} disabled={isPending} />
                )}
              </div>
            )}
          </DialogScaffoldBody>
        </DialogScaffoldContent>
      </Dialog>
      <ConfirmDialog
        open={Boolean(roomToDelete)}
        title="Delete room"
        description={
          roomToDelete
            ? `Delete room ${roomToDelete.roomCode}? This cannot be undone.`
            : undefined
        }
        confirmLabel={deleteLoading ? 'Deleting...' : 'Delete'}
        loading={deleteLoading}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        contentClassName="z-[3100]"
        overlayClassName="z-[3099]"
      />
    </>
  );
}
