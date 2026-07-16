'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import type { LatLng } from '@/lib/types/common';
import { MAP_DEFAULT_CENTER } from '@/lib/constants/map';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DialogScaffoldBody,
  DialogScaffoldContent,
  DialogScaffoldFooter,
  DialogScaffoldHeader,
} from '@/components/ui/dialog-scaffold';

const CoordinatePickerMap = dynamic(() => import('./coordinate-picker-map').then((m) => m.CoordinatePickerMap), {
  ssr: false,
});

interface CoordinatePickerProps {
  value?: LatLng;
  onChange: (coords: LatLng) => void;
}

export function CoordinatePicker({ value, onChange }: CoordinatePickerProps) {
  const [open, setOpen] = useState(false);
  const [tempCoords, setTempCoords] = useState<LatLng>(value ?? MAP_DEFAULT_CENTER);

  useEffect(() => {
    if (value) {
      setTempCoords(value);
    }
  }, [value]);

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setTempCoords(value ?? MAP_DEFAULT_CENTER);
    }
    setOpen(newOpen);
  };

  const handleConfirm = () => {
    onChange(tempCoords);
    setOpen(false);
  };

  const formatted =
    value ? `${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}` : 'Select location';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full justify-start">
          {formatted}
        </Button>
      </DialogTrigger>
      <DialogScaffoldContent className="max-w-4xl">
        <DialogScaffoldHeader>
          <DialogTitle>Select location</DialogTitle>
          <DialogDescription>Click on the map to set coordinates.</DialogDescription>
        </DialogScaffoldHeader>

        <DialogScaffoldBody className="py-4">
          <div className="space-y-4">
            <div className="h-[420px] overflow-hidden rounded-lg border">
              <CoordinatePickerMap value={tempCoords} onChange={setTempCoords} />
            </div>

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Lat: {tempCoords.lat.toFixed(5)}, Lng: {tempCoords.lng.toFixed(5)}
              </span>
            </div>
          </div>
        </DialogScaffoldBody>

        <DialogScaffoldFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>
            Use coordinates
          </Button>
        </DialogScaffoldFooter>
      </DialogScaffoldContent>
    </Dialog>
  );
}
