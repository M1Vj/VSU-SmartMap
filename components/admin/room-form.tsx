'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { roomSchema, type RoomFormValues } from '@/lib/validation/room';
import { STORAGE_LIMITS } from '@/lib/constants/storage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ImageZoomDialog } from '@/components/ui/image-zoom-dialog';
import { FieldHelp } from '@/components/ui/field-help';

interface RoomFormProps {
  facilityId: string;
  facilityCode?: string;
  initialValues?: Partial<RoomFormValues>;
  onSubmit: (
    values: RoomFormValues,
    options?: { file?: File | null; clearImage?: boolean }
  ) => Promise<void> | void;
  onCancel: () => void;
  submitting?: boolean;
}

export function RoomForm({
  facilityId,
  facilityCode,
  initialValues,
  onSubmit,
  onCancel,
  submitting,
}: RoomFormProps) {
  const [values, setValues] = useState<RoomFormValues>({
    facilityId,
    roomCode: initialValues?.roomCode ?? (facilityCode ? `${facilityCode} ` : ''),
    name: initialValues?.name ?? '',
    description: initialValues?.description ?? '',
    floor: initialValues?.floor,
    imageUrl: initialValues?.imageUrl ?? '',
  });
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(initialValues?.imageUrl ?? null);
  const [clearImage, setClearImage] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);

  useEffect(() => {
    setValues({
      facilityId,
      roomCode: initialValues?.roomCode ?? (facilityCode ? `${facilityCode} ` : ''),
      name: initialValues?.name ?? '',
      description: initialValues?.description ?? '',
      floor: initialValues?.floor,
      imageUrl: initialValues?.imageUrl ?? '',
    });
    setFile(null);
    setPreview((prev) => {
      if (prev && prev.startsWith('blob:')) {
        URL.revokeObjectURL(prev);
      }
      return initialValues?.imageUrl ?? null;
    });
    setClearImage(false);
  }, [facilityId, initialValues, facilityCode]);

  useEffect(() => {
    if (preview && preview.startsWith('blob:')) {
      return () => URL.revokeObjectURL(preview);
    }
  }, [preview]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const parsed = roomSchema.safeParse(values);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Invalid room data';
      setError(message);
      return;
    }

    await onSubmit(parsed.data, { file, clearImage });
  };

  return (
    <>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="flex items-center justify-between pb-4 border-b mb-4">
          <h3 className="text-lg font-bold text-primary">
            {initialValues?.roomCode ? 'Edit Room' : 'Add New Room'}
          </h3>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <div className="flex items-center gap-1">
              <Label htmlFor="roomCode">Room code</Label>
              <FieldHelp content="The unique identifier for the room, often including the facility code (e.g., ICT 101)." />
            </div>
            <Input
              id="roomCode"
              value={values.roomCode}
              onChange={(event) => setValues({ ...values, roomCode: event.target.value })}
              required
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-1">
              <Label htmlFor="floor">Floor (optional)</Label>
              <FieldHelp content="The floor level where this room is located (e.g., 1 for ground floor, 2 for second floor)." />
            </div>
            <Input
              id="floor"
              type="number"
              inputMode="numeric"
              min={-10}
              max={100}
              value={values.floor ?? ''}
              onChange={(event) =>
                setValues({
                  ...values,
                  floor:
                    event.target.value === ''
                      ? undefined
                      : Math.min(100, Math.max(-10, Number(event.target.value))),
                })
              }
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-1">
            <Label htmlFor="name">Name (optional)</Label>
            <FieldHelp content="A descriptive name for the room (e.g., Computer Lab 1, Dean's Office)." />
          </div>
          <Input
            id="name"
            value={values.name ?? ''}
            onChange={(event) => setValues({ ...values, name: event.target.value })}
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-1">
            <Label htmlFor="description">Description (optional)</Label>
            <FieldHelp content="Additional details about the room's purpose, equipment, or availability." />
          </div>
          <Textarea
            id="description"
            value={values.description ?? ''}
            onChange={(event) => setValues({ ...values, description: event.target.value })}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-1">
            <Label htmlFor="roomImage">Image (optional)</Label>
            <FieldHelp content="A photo of the room interior or entrance to help users find it." />
          </div>
          {preview && (
            <div className="rounded-lg border p-3 flex items-center gap-3">
              <button
                type="button"
                className="cursor-zoom-in hover:ring-2 hover:ring-primary/50 rounded-md transition-shadow"
                onClick={() => setZoomOpen(true)}
              >
                <Image
                  src={preview}
                  alt="Room image"
                  width={64}
                  height={64}
                  className="h-16 w-16 rounded-md object-cover border"
                />
              </button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  if (preview && preview.startsWith('blob:')) {
                    URL.revokeObjectURL(preview);
                  }
                  setPreview(null);
                  setFile(null);
                  setClearImage(true);
                  setValues({ ...values, imageUrl: '' });
                }}
              >
                Remove image
              </Button>
            </div>
          )}
          <Input
            id="roomImage"
            type="file"
            accept={STORAGE_LIMITS.acceptedTypes.join(',')}
            onChange={(event) => {
              const nextFile = event.target.files?.[0];
              if (nextFile) {
                if (preview && preview.startsWith('blob:')) {
                  URL.revokeObjectURL(preview);
                }
                setFile(nextFile);
                setPreview(URL.createObjectURL(nextFile));
                setClearImage(false);
              }
            }}
          />
          <p className="text-xs text-muted-foreground">
            Max {STORAGE_LIMITS.inputMaxMB}MB. Types: {STORAGE_LIMITS.acceptedTypes.join(', ')}.
          </p>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            {submitting ? 'Saving...' : 'Save room'}
          </Button>
        </div>
      </form>

      {preview && (
        <ImageZoomDialog
          open={zoomOpen}
          onOpenChange={setZoomOpen}
          src={preview}
          alt="Room image"
        />
      )}
    </>
  );
}
