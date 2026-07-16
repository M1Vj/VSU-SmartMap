'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Image from 'next/image';
import type { Facility } from '@/lib/types/facility';
import { FACILITY_CATEGORIES } from '@/lib/types/facility';
import { STORAGE_LIMITS } from '@/lib/constants/storage';
import { unifiedFacilitySchema, type UnifiedFacilityFormValues } from '@/lib/validation/facility';
import { Button } from '@/components/ui/button';
import { Dialog, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import {
  DialogScaffoldBody,
  DialogScaffoldContent,
  DialogScaffoldFooter,
  DialogScaffoldHeader,
} from '@/components/ui/dialog-scaffold';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ImageZoomDialog } from '@/components/ui/image-zoom-dialog';
import { cn } from '@/lib/utils';
import { CoordinatePicker } from './coordinate-picker';
import { MAP_DEFAULT_CENTER } from '@/lib/constants/map';
import { FieldHelp } from '@/components/ui/field-help';

type Mode = 'create' | 'edit';

interface FacilityDialogProps {
  open: boolean;
  mode: Mode;
  facility?: Facility;
  onOpenChange: (open: boolean) => void;
  onSubmit: (
    values: UnifiedFacilityFormValues,
    options?: { file?: File | null; clearImage?: boolean },
  ) => Promise<void> | void;
  onManageRooms?: () => void;
  title?: string;
  description?: string;
  submitLabel?: string;
  submittingLabel?: string;
  children?: ReactNode;
  showSlug?: boolean;
}

const defaultCoordinates = MAP_DEFAULT_CENTER;

export function FacilityDialog({
  open,
  mode,
  facility,
  onOpenChange,
  onSubmit,
  onManageRooms,
  title,
  description,
  submitLabel,
  submittingLabel,
  children,
  showSlug = false,
}: FacilityDialogProps) {
  const initialValues = useMemo<UnifiedFacilityFormValues>(() => {
    if (facility) {
      return {
        code: facility.code ?? '',
        name: facility.name,
        description: facility.description ?? '',
        category: facility.category,
        hasRooms: facility.hasRooms,
        coordinates: facility.coordinates,
        imageUrl: facility.imageUrl ?? '',
        imageCredit: facility.imageCredit ?? '',
        website: facility.website ?? '',
        facebook: facility.facebook ?? '',
        phone: facility.phone ?? '',
        slug: facility.slug,
      };
    }
    return {
      code: '',
      name: '',
      description: '',
      category: FACILITY_CATEGORIES[0],
      hasRooms: true,
      coordinates: defaultCoordinates,
      imageUrl: '',
      imageCredit: '',
      website: '',
      facebook: '',
      phone: '',
      slug: undefined,
    };
  }, [facility]);

  const [values, setValues] = useState<UnifiedFacilityFormValues>(initialValues);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(facility?.imageUrl ?? null);
  const [clearImage, setClearImage] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);

  const resolvedTitle =
    title ?? (mode === 'create' ? 'Add facility' : 'Edit facility');
  const resolvedDescription =
    description ??
    (mode === 'create'
      ? 'Create a building or point of interest.'
      : 'Update facility details.');
  const resolvedSubmit =
    submitLabel ?? (mode === 'create' ? 'Create' : 'Save changes');
  const resolvedSubmitting = submittingLabel ?? `${resolvedSubmit}...`;

  const isDefaultLocation =
    values.coordinates.lat === MAP_DEFAULT_CENTER.lat &&
    values.coordinates.lng === MAP_DEFAULT_CENTER.lng;

  useEffect(() => {
    if (preview && preview.startsWith('blob:')) {
      return () => URL.revokeObjectURL(preview);
    }
  }, [preview]);

  useEffect(() => {
    setValues(initialValues);
    setError(null);
    setFile(null);
    setPreview((previous) => {
      if (previous && previous.startsWith('blob:')) {
        URL.revokeObjectURL(previous);
      }
      return facility?.imageUrl ?? null;
    });
    setClearImage(false);
  }, [initialValues, open, facility]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const parsed = unifiedFacilitySchema.safeParse(values);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Validation failed';
      setError(message);
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(parsed.data, { file, clearImage });
    } catch (submitError) {
      console.error('Failed to save facility:', submitError);
      setError('Failed to save facility');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogScaffoldContent className="sm:max-w-3xl">
          <DialogScaffoldHeader>
            <DialogTitle>{resolvedTitle}</DialogTitle>
            <DialogDescription>
              {resolvedDescription}
            </DialogDescription>
          </DialogScaffoldHeader>

          <form className="flex flex-col flex-1 min-h-0" onSubmit={handleSubmit}>
            <DialogScaffoldBody>
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1">
                      <Label htmlFor="code">Code (optional)</Label>
                      <FieldHelp content="A short unique identifier for the facility (e.g., ICT, CAS, DALL)." />
                    </div>
                    <Input
                      id="code"
                      value={values.code ?? ''}
                      onChange={(event) => setValues({ ...values, code: event.target.value })}
                      placeholder="e.g., ICT, CAS, DALL"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1">
                      <Label htmlFor="name">Name</Label>
                      <FieldHelp content="The full name of the building or point of interest." />
                    </div>
                    <Input
                      id="name"
                      value={values.name}
                      onChange={(event) => setValues({ ...values, name: event.target.value })}
                      required
                    />
                  </div>

                  {showSlug && (
                    <div className="space-y-1.5 md:col-span-2">
                      <div className="flex items-center gap-1">
                        <Label htmlFor="slug">Slug (URL identifier)</Label>
                        <FieldHelp content="The URL-friendly identifier. If left blank, it will be automatically generated from the name." />
                      </div>
                      <Input
                        id="slug"
                        value={values.slug ?? ''}
                        onChange={(event) => setValues({ ...values, slug: event.target.value })}
                        placeholder="e.g., plant-science-building"
                      />
                      <p className="text-xs text-muted-foreground">
                        Leave blank to auto-generate from name. Must be unique.
                      </p>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1">
                      <Label htmlFor="category">Category</Label>
                      <FieldHelp content="The classification of this facility to help with filtering and icon selection." />
                    </div>
                    <Select
                      value={values.category}
                      onValueChange={(value) =>
                        setValues({
                          ...values,
                          category: value as typeof values.category,
                        })
                      }
                    >
                      <SelectTrigger id="category">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {FACILITY_CATEGORIES.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1">
                      <Label id="facility-type-label">Type</Label>
                      <FieldHelp content="Buildings can contain rooms, while Points of Interest (POI) are markers for specific locations." />
                    </div>
                    <div
                      className="flex rounded-lg border bg-muted/40 p-1"
                      role="radiogroup"
                      aria-labelledby="facility-type-label"
                    >
                      <button
                        type="button"
                        role="radio"
                        aria-checked={values.hasRooms}
                        className={cn(
                          'flex-1 px-3 py-1 text-sm rounded-md transition',
                          values.hasRooms ? 'bg-background shadow-sm' : 'text-muted-foreground'
                        )}
                        onClick={() => setValues({ ...values, hasRooms: true })}
                      >
                        Building
                      </button>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={!values.hasRooms}
                        className={cn(
                          'flex-1 px-3 py-1 text-sm rounded-md transition',
                          !values.hasRooms ? 'bg-background shadow-sm' : 'text-muted-foreground'
                        )}
                        onClick={() => setValues({ ...values, hasRooms: false })}
                      >
                        POI
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-1">
                    <Label htmlFor="description">Description</Label>
                    <FieldHelp content="Publicly visible information about the facility's purpose, history, or features." />
                  </div>
                  <Textarea
                    id="description"
                    value={values.description ?? ''}
                    onChange={(event) => setValues({ ...values, description: event.target.value })}
                    placeholder="Add context or directions for this facility"
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1">
                    <Label>Location</Label>
                    <FieldHelp content="Select the precise location on the map where this facility is located." />
                  </div>
                  <div className="relative">
                    <CoordinatePicker
                      value={values.coordinates}
                      onChange={(coords) => setValues({ ...values, coordinates: coords })}
                    />
                    <input
                      tabIndex={-1}
                      autoComplete="off"
                      value={isDefaultLocation ? '' : 'present'}
                      onChange={() => { }}
                      required={mode === 'create'}
                      className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
                      onInvalid={(e) => {
                        e.currentTarget.setCustomValidity('Please select a specific location on the map.');
                      }}
                      onInput={(e) => {
                        e.currentTarget.setCustomValidity('');
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    <Label htmlFor="image">Hero image</Label>
                    <FieldHelp content="An attractive photo of the facility's exterior or main entrance. Max 5MB." />
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
                          alt="Facility hero"
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
                          setValues({ ...values, imageUrl: '', imageCredit: '' });
                        }}
                      >
                        Remove image
                      </Button>
                    </div>
                  )}
                  <Input
                    id="image"
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

                {(preview || values.imageUrl) && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1">
                      <Label htmlFor="imageCredit">Photo credit (optional)</Label>
                      <FieldHelp content="Mention the photographer or source of the image." />
                    </div>
                    <Input
                      id="imageCredit"
                      value={values.imageCredit ?? ''}
                      onChange={(event) => setValues({ ...values, imageCredit: event.target.value })}
                      placeholder="Your name or contributor's name"
                    />
                    <p className="text-xs text-muted-foreground">
                      Credit will be displayed with the image.
                    </p>
                  </div>
                )}

                <div className="space-y-4 pt-2">
                  <h4 className="text-sm font-medium text-muted-foreground">Contact Information (optional)</h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="website">Website</Label>
                      <Input
                        id="website"
                        type="url"
                        value={values.website ?? ''}
                        onChange={(event) => setValues({ ...values, website: event.target.value })}
                        placeholder="https://example.vsu.edu.ph"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="facebook">Facebook page</Label>
                      <Input
                        id="facebook"
                        type="url"
                        value={values.facebook ?? ''}
                        onChange={(event) => setValues({ ...values, facebook: event.target.value })}
                        placeholder="https://facebook.com/page"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">Phone number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={values.phone ?? ''}
                      onChange={(event) => setValues({ ...values, phone: event.target.value })}
                      placeholder="e.g., (053) 565-0600"
                    />
                  </div>
                </div>

                {error && (
                  <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </div>
                )}
                {children}
              </div>
            </DialogScaffoldBody>

            <DialogScaffoldFooter className="gap-2 sm:gap-0">
              {mode === 'edit' && values.hasRooms && onManageRooms && (
                <div className="flex-1 flex justify-start">
                  <Button type="button" variant="outline" onClick={onManageRooms}>
                    Manage Rooms
                  </Button>
                </div>
              )}
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                 <Button type="submit" loading={submitting}>
                   {submitting ? resolvedSubmitting : resolvedSubmit}
                 </Button>
              </div>
            </DialogScaffoldFooter>
          </form>
        </DialogScaffoldContent>
      </Dialog>

      {
        preview && (
          <ImageZoomDialog
            open={zoomOpen}
            onOpenChange={setZoomOpen}
            src={preview}
            alt="Facility hero"
          />
        )
      }
    </>
  );
}
