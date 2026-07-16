'use client';

import { Dialog, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import {
  DialogScaffoldContent,
  DialogScaffoldFooter,
  DialogScaffoldHeader,
} from '@/components/ui/dialog-scaffold';
import { Button } from '@/components/ui/button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  loading?: boolean;
  contentClassName?: string;
  overlayClassName?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmVariant = 'destructive',
  loading = false,
  contentClassName,
  overlayClassName,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && loading) return;
        if (!next) onCancel();
      }}
    >
      <DialogScaffoldContent className={contentClassName} overlayClassName={overlayClassName}>
        <DialogScaffoldHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogScaffoldHeader>
        <DialogScaffoldFooter className="gap-2 sm:gap-0 border-t-0">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button type="button" variant={confirmVariant} onClick={onConfirm} disabled={loading}>
            {loading ? 'Working...' : confirmLabel}
          </Button>
        </DialogScaffoldFooter>
      </DialogScaffoldContent>
    </Dialog>
  );
}
