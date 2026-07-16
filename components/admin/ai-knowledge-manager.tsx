"use client";

import * as React from "react";
import { Brain, Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  createAiKnowledgeAction,
  deleteAiKnowledgeAction,
  updateAiKnowledgeAction,
} from "@/app/admin/ai-knowledge/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import type { AiKnowledgeEntry } from "@/lib/types/ai-knowledge";

type FormState = {
  title: string;
  content: string;
  keywords: string;
  source: string;
  priority: number;
  isActive: boolean;
};

const emptyForm: FormState = {
  title: "",
  content: "",
  keywords: "",
  source: "",
  priority: 0,
  isActive: true,
};

function toForm(entry: AiKnowledgeEntry): FormState {
  return {
    title: entry.title,
    content: entry.content,
    keywords: entry.keywords.join(", "),
    source: entry.source ?? "",
    priority: entry.priority,
    isActive: entry.isActive,
  };
}

function toPayload(form: FormState) {
  return {
    title: form.title,
    content: form.content,
    keywords: form.keywords
      .split(",")
      .map((keyword) => keyword.trim())
      .filter(Boolean),
    source: form.source.trim() || null,
    priority: form.priority,
    isActive: form.isActive,
  };
}

export function AiKnowledgeManager({ entries }: { entries: AiKnowledgeEntry[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(emptyForm);
  const [editingEntry, setEditingEntry] = React.useState<AiKnowledgeEntry | null>(null);
  const [deleteEntry, setDeleteEntry] = React.useState<AiKnowledgeEntry | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const startCreate = () => {
    setEditingEntry(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const startEdit = (entry: AiKnowledgeEntry) => {
    setEditingEntry(entry);
    setForm(toForm(entry));
    setOpen(true);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const payload = toPayload(form);
      const result = editingEntry
        ? await updateAiKnowledgeAction(editingEntry.id, payload)
        : await createAiKnowledgeAction(payload);

      if (result.error) throw new Error(result.error);

      toast.success(editingEntry ? "Knowledge entry updated" : "Knowledge entry added");
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save knowledge entry");
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteEntry) return;
    setIsDeleting(true);

    try {
      const result = await deleteAiKnowledgeAction(deleteEntry.id);
      if (result.error) throw new Error(result.error);

      toast.success("Knowledge entry deleted");
      setDeleteEntry(null);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete knowledge entry");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="flex justify-end">
        <Button type="button" onClick={startCreate} data-tour="ai-add">
          <Plus className="h-4 w-4" />
          Add Knowledge
        </Button>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Entry</TableHead>
              <TableHead className="hidden md:table-cell">Keywords</TableHead>
              <TableHead className="w-24">Status</TableHead>
              <TableHead className="w-24">Priority</TableHead>
              <TableHead className="w-16">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                  <Brain className="mx-auto mb-3 h-8 w-8 opacity-40" />
                  No knowledge entries yet.
                </TableCell>
              </TableRow>
            ) : (
              entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    <div className="max-w-xl space-y-1">
                      <p className="font-medium">{entry.title}</p>
                      <p className="line-clamp-2 text-sm text-muted-foreground">
                        {entry.content}
                      </p>
                      {entry.source && (
                        <p className="text-xs text-muted-foreground">Source: {entry.source}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex max-w-xs flex-wrap gap-1">
                      {entry.keywords.slice(0, 4).map((keyword) => (
                        <Badge key={keyword} variant="outline">
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={entry.isActive ? "default" : "outline"}>
                      {entry.isActive ? "Active" : "Hidden"}
                    </Badge>
                  </TableCell>
                  <TableCell>{entry.priority}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onSelect={() => startEdit(entry)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onSelect={() => setDeleteEntry(entry)}
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogScaffoldContent className="sm:max-w-2xl">
          <DialogScaffoldHeader>
            <DialogTitle>{editingEntry ? "Edit Knowledge" : "Add Knowledge"}</DialogTitle>
            <DialogDescription>
              Use concise, verified facts. The chatbot receives only relevant active entries.
            </DialogDescription>
          </DialogScaffoldHeader>
          <DialogScaffoldBody>
            <form id="ai-knowledge-form" className="space-y-4" onSubmit={submit}>
              <div className="space-y-2">
                <Label htmlFor="knowledge-title">Title</Label>
                <Input
                  id="knowledge-title"
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="Registrar transcript requests"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="knowledge-content">Content</Label>
                <Textarea
                  id="knowledge-content"
                  value={form.content}
                  onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
                  placeholder="Students can request transcripts at..."
                  className="min-h-36"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="knowledge-keywords">Keywords</Label>
                  <Input
                    id="knowledge-keywords"
                    value={form.keywords}
                    onChange={(event) => setForm((prev) => ({ ...prev, keywords: event.target.value }))}
                    placeholder="registrar, transcript, records"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="knowledge-priority">Priority</Label>
                  <Input
                    id="knowledge-priority"
                    type="number"
                    min={0}
                    max={100}
                    value={form.priority}
                    onChange={(event) => setForm((prev) => ({ ...prev, priority: Number(event.target.value) }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="knowledge-source">Source</Label>
                <Input
                  id="knowledge-source"
                  value={form.source}
                  onChange={(event) => setForm((prev) => ({ ...prev, source: event.target.value }))}
                  placeholder="Office memo, website, or admin note"
                />
              </div>
              <label className="flex items-center gap-2 text-sm font-medium">
                <Checkbox
                  checked={form.isActive}
                  onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isActive: checked === true }))}
                />
                Active in chatbot
              </label>
            </form>
          </DialogScaffoldBody>
          <DialogScaffoldFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" form="ai-knowledge-form" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogScaffoldFooter>
        </DialogScaffoldContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteEntry}
        title="Delete knowledge entry?"
        description={deleteEntry ? `This removes "${deleteEntry.title}" from chatbot context.` : undefined}
        confirmLabel="Delete"
        loading={isDeleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteEntry(null)}
      />
    </>
  );
}
