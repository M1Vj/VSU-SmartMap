'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Facility } from '@/lib/types/facility';
import { FacilitiesTable } from './facilities-table';
import { FacilityDialog } from './facility-dialog';
import { RoomManagerDialog } from './room-manager-dialog';
import type { UnifiedFacilityFormValues } from '@/lib/validation/facility';
import {
  createFacilityAction,
  deleteFacilityAction,
  updateFacilityAction,
} from '@/app/admin/facilities/actions';
import { uploadFacilityHeroClient } from '@/lib/supabase/storage-client';
import { ConfirmDialog } from './confirm-dialog';
import { toast } from 'sonner';

interface FacilitiesPageClientProps {
  facilities: Facility[];
}

export function FacilitiesPageClient({ facilities }: FacilitiesPageClientProps) {
  const [items, setItems] = useState<Facility[]>(facilities);
  const [message, setMessage] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mode, setMode] = useState<'create' | 'edit'>('create');
  const [selected, setSelected] = useState<Facility | undefined>();
  const [isPending, startTransition] = useTransition();
  const [roomsOpen, setRoomsOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Facility | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const router = useRouter();

  const handleAdd = () => {
    setSelected(undefined);
    setMode('create');
    setDialogOpen(true);
  };

  const handleEdit = (facility: Facility) => {
    setSelected(facility);
    setMode('edit');
    setDialogOpen(true);
  };

  const handleManageRooms = (facility: Facility) => {
    setSelected(facility);
    setRoomsOpen(true);
  };

  const syncImage = async (facility: Facility, file?: File | null, clearImage?: boolean): Promise<Facility> => {
    if (clearImage && !file) {
      const result = await updateFacilityAction(facility.id, { imageUrl: null });
      if (result.error) {
        throw new Error(result.error);
      }
      return result.data ? (result.data as Facility) : { ...facility, imageUrl: undefined } as Facility;
    }

    if (!file) {
      return facility;
    }

    const upload = await uploadFacilityHeroClient(facility.id, file);
    if (upload.error) {
      throw new Error(upload.error.message);
    }

    const publicUrl = upload.data?.publicUrl ?? undefined;
    const updateResult = await updateFacilityAction(facility.id, { imageUrl: publicUrl });
    if (updateResult.error) {
      throw new Error(updateResult.error);
    }

    if (updateResult.data) {
      return updateResult.data as Facility;
    }

    return publicUrl ? { ...facility, imageUrl: publicUrl } as Facility : facility;
  };

  const handleSubmit = async (
    values: UnifiedFacilityFormValues,
    options?: { file?: File | null; clearImage?: boolean },
  ) => {
    setMessage(null);
    const file = options?.file ?? null;
    const clearImage = options?.clearImage ?? false;

    try {
      if (mode === 'create') {
        const createResult = await createFacilityAction({ ...values, imageUrl: undefined });
        if (createResult.error) {
          throw new Error(createResult.error);
        }

        if (createResult.data) {
          const created = await syncImage(createResult.data as Facility, file, clearImage);
          startTransition(() => {
            setItems((prev) => [...prev, created]);
            router.refresh();
          });
          toast.success('Facility created successfully');
          setDialogOpen(false);
        }
        return;
      }

      if (!selected) {
        return;
      }

      const basePayload =
        clearImage && !file ? { ...values, imageUrl: null } : values;
      const updateResult = await updateFacilityAction(selected.id, basePayload);
      if (updateResult.error) {
        throw new Error(updateResult.error);
      }

      const optimisticValues: UnifiedFacilityFormValues = {
        ...values,
        code: values.code ?? undefined,
      };

      let updated: Facility =
        (updateResult.data as Facility | undefined) ??
        ({ ...selected, ...optimisticValues, ...(clearImage && !file ? { imageUrl: null } : {}) } as Facility);

      updated = await syncImage(updated, file, false);

      startTransition(() => {
        setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        router.refresh();
      });
      toast.success('Facility updated successfully');
      setDialogOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
      setMessage(message);
      toast.error('Failed to save facility');
    }
  };

  const handleDelete = (facility: Facility) => {
    setMessage(null);
    setPendingDelete(facility);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) {
      return;
    }

    setDeleteLoading(true);
    const result = await deleteFacilityAction(pendingDelete.id);

    if (result.error) {
      setMessage(result.error);
      toast.error('Failed to delete facility');
      setDeleteLoading(false);
      setPendingDelete(null);
      return;
    }

    startTransition(() => {
      setItems((prev) => prev.filter((item) => item.id !== pendingDelete.id));
      router.refresh();
    });

    toast.success('Facility deleted successfully');
    setDeleteLoading(false);
    setPendingDelete(null);
  };

  const cancelDelete = () => {
    if (deleteLoading) return;
    setPendingDelete(null);
  };

  const dialogFacility = useMemo(
    () => items.find((item) => item.id === selected?.id),
    [items, selected]
  );

  return (
    <>
      <FacilitiesTable
        facilities={items}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onManageRooms={handleManageRooms}
        onDelete={handleDelete}
        disabled={isPending}
      />
      {message && (
        <p className="mt-3 text-sm text-destructive">
          {message}
        </p>
      )}
      <FacilityDialog
        open={dialogOpen}
        mode={mode}
        facility={dialogFacility}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        onManageRooms={dialogFacility ? () => handleManageRooms(dialogFacility) : undefined}
        showSlug={true}
      />
      <RoomManagerDialog
        open={roomsOpen}
        facility={dialogFacility}
        onOpenChange={setRoomsOpen}
      />
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete facility"
        description={`Are you sure you want to delete ${pendingDelete?.name ?? 'this facility'}? This action cannot be undone.`}
        confirmLabel={deleteLoading ? 'Deleting...' : 'Delete'}
        loading={deleteLoading}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </>
  );
}
