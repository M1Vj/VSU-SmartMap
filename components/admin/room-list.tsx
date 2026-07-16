'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Image from 'next/image';
import { ImageZoomDialog } from '@/components/ui/image-zoom-dialog';
import { useState } from 'react';

export interface RoomRecord {
  id: string;
  roomCode: string;
  name?: string;
  description?: string;
  floor?: number;
  updatedAt?: string;
  imageUrl?: string;
}

interface RoomListProps {
  rooms: RoomRecord[];
  onEdit: (room: RoomRecord) => void;
  onDelete: (room: RoomRecord) => void;

  disabled?: boolean;
}

export function RoomList({ rooms, onEdit, onDelete, disabled }: RoomListProps) {
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  if (!rooms.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rooms</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This building has no rooms yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Rooms</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead>
              <tr className="text-left">
                <th className="px-4 py-2 font-semibold w-16">Image</th>
                <th className="px-4 py-2 font-semibold">Code</th>
                <th className="px-4 py-2 font-semibold">Name</th>
                <th className="px-4 py-2 font-semibold">Floor</th>
                <th className="px-4 py-2 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rooms.map((room) => (
                <tr key={room.id} className="hover:bg-muted/40">
                  <td className="px-4 py-3 align-middle">
                    {room.imageUrl ? (
                      <button
                        type="button"
                        onClick={() => setZoomImage(room.imageUrl!)}
                        className="relative block h-10 w-10 overflow-hidden rounded-md border hover:ring-2 hover:ring-primary/50 transition-all"
                      >
                        <Image
                          src={room.imageUrl}
                          alt={room.name || room.roomCode}
                          fill
                          className="object-cover"
                          sizes="40px"
                        />
                      </button>
                    ) : (
                      <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center text-xs text-muted-foreground/50">
                        No img
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 align-middle font-medium">{room.roomCode}</td>
                  <td className="px-4 py-3 align-middle text-muted-foreground">
                    {room.name || '—'}
                  </td>
                  <td className="px-4 py-3 align-middle text-muted-foreground">
                    {room.floor ?? '—'}
                  </td>
                  <td className="px-4 py-3 align-middle text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onEdit(room)}
                        disabled={disabled}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => onDelete(room)}
                        disabled={disabled}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>

      <ImageZoomDialog
        open={!!zoomImage}
        onOpenChange={(open) => !open && setZoomImage(null)}
        src={zoomImage ?? ''}
        alt="Room image"
      />
    </Card>
  );
}
