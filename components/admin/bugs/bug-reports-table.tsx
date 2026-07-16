"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { deleteBugReportAction } from "@/app/admin/bugs/actions";
import type { BugReport, BugStatus } from "@/lib/types/bug-report";
import { format } from "date-fns";
import { Loader2, Bug, CheckCircle2, AlertCircle, XCircle, Clock, Trash2 } from "lucide-react";
import { toast } from "sonner";


import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DialogScaffoldBody,
  DialogScaffoldContent,
  DialogScaffoldHeader,
} from "@/components/ui/dialog-scaffold";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";

const STATUS_ICONS = {
  OPEN: AlertCircle,
  IN_PROGRESS: Clock,
  RESOLVED: CheckCircle2,
  CLOSED: XCircle,
};

const SEVERITY_COLORS = {
  LOW: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300",
  MEDIUM: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-500",
  HIGH: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-500",
  CRITICAL: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-500",
};

const StatusBadge = ({ status }: { status: BugStatus }) => {
  const Icon = STATUS_ICONS[status];
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="w-4 h-4" />
      <span className="capitalize">{status.toLowerCase().replace('_', ' ')}</span>
    </div>
  );
};

export function BugReportsTable() {
  const [reports, setReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<BugReport | null>(null);
  const [reportToDelete, setReportToDelete] = useState<BugReport | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      const supabase = createClient();
      const { data, error } = await supabase
        .from("bug_reports")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setReports(data as BugReport[]);
    } catch (error) {
      console.error("Error fetching bug reports:", error);
      toast.error("Failed to load bug reports");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const updateStatus = async (id: string, newStatus: BugStatus) => {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("bug_reports")
        .update({ status: newStatus })
        .eq("id", id);

      if (error) throw error;

      setReports((prev) =>
        prev.map((report) =>
          report.id === id ? { ...report, status: newStatus } : report
        )
      );

      // Update selected report if it's the one being modified
      if (selectedReport?.id === id) {
        setSelectedReport(prev => prev ? { ...prev, status: newStatus } : null);
      }

      toast.success("Status updated");
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    }
  };

  const deleteReport = async () => {
    if (!reportToDelete) return;

    try {
      setDeletingId(reportToDelete.id);
      const result = await deleteBugReportAction(reportToDelete.id);
      if (result.error) throw new Error(result.error);

      setReports((prev) => prev.filter((report) => report.id !== reportToDelete.id));
      setSelectedReport((prev) => prev?.id === reportToDelete.id ? null : prev);
      setReportToDelete(null);
      toast.success("Bug report deleted");
    } catch (error) {
      console.error("Error deleting bug report:", error);
      toast.error("Failed to delete bug report");
    } finally {
      setDeletingId(null);
    }
  };



  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Bug className="h-12 w-12 mb-4 opacity-20" />
        <p>No bug reports found.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Severity</TableHead>
            <TableHead>Title</TableHead>
            <TableHead className="hidden md:table-cell">Description</TableHead>
            <TableHead className="w-[100px]">Screenshot</TableHead>
            <TableHead className="w-[140px]">Status</TableHead>
            <TableHead className="w-[140px]">Date</TableHead>
            <TableHead className="w-[72px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reports.map((report) => (
            <TableRow
              key={report.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => setSelectedReport(report)}
            >
              <TableCell>
                <div className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${SEVERITY_COLORS[report.severity]}`}>
                  {report.severity}
                </div>
              </TableCell>
              <TableCell className="font-medium">
                {report.title}
                <div className="md:hidden text-xs text-muted-foreground mt-1 truncate max-w-[200px]">
                  {report.description}
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell max-w-xs truncate">
                {report.description}
              </TableCell>
              <TableCell>
                {report.screenshot_url ? (
                  <div className="relative h-8 w-12 rounded border overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={report.screenshot_url} alt="Screenshot" className="object-cover w-full h-full" />
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">None</span>
                )}
              </TableCell>
              <TableCell>
                <div onClick={(e) => e.stopPropagation()}>
                  <Select
                    defaultValue={report.status}
                    onValueChange={(value) => updateStatus(report.id, value as BugStatus)}
                  >
                    <SelectTrigger className="h-8 w-[130px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OPEN">Open</SelectItem>
                      <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                      <SelectItem value="RESOLVED">Resolved</SelectItem>
                      <SelectItem value="CLOSED">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {format(new Date(report.created_at), "MMM d, yyyy")}
              </TableCell>
              <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  title="Delete bug report"
                  aria-label={`Delete bug report ${report.title}`}
                  onClick={() => setReportToDelete(report)}
                  disabled={deletingId === report.id}
                >
                  {deletingId === report.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={!!selectedReport} onOpenChange={(open) => !open && setSelectedReport(null)}>
        <DialogScaffoldContent className="max-w-3xl max-h-[90vh]">
          <DialogScaffoldHeader>
            <DialogTitle className="flex items-start justify-between gap-4">
              <span className="text-xl flex-1 truncate">{selectedReport?.title}</span>
              {selectedReport && (
                <div className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${SEVERITY_COLORS[selectedReport.severity]}`}>
                  {selectedReport.severity}
                </div>
              )}
            </DialogTitle>
            <DialogDescription>
              Reported on {selectedReport && format(new Date(selectedReport.created_at), "PPP p")}
            </DialogDescription>
          </DialogScaffoldHeader>

          <DialogScaffoldBody className="py-4">
            <div className="space-y-6">
              {/* Status Section */}
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium text-muted-foreground">Status:</span>
                {selectedReport && <StatusBadge status={selectedReport.status} />}
              </div>

              {/* Description Section */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">Description</h3>
                <div className="p-4 rounded-md bg-muted/50 text-sm whitespace-pre-wrap">
                  {selectedReport?.description}
                </div>
              </div>

              {/* Screenshot Section */}
              {selectedReport?.screenshot_url && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">Screenshot</h3>
                  <div className="relative rounded-lg border overflow-hidden bg-muted/20">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selectedReport.screenshot_url}
                      alt="Bug report screenshot"
                      className="w-full h-auto max-h-[500px] object-contain"
                    />
                  </div>
                </div>
              )}

              {/* Device Info Section */}
              {selectedReport?.device_info && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">Device Information</h3>
                  <div className="grid grid-cols-2 gap-2 text-xs p-3 rounded-md bg-muted/30">
                    {Object.entries(selectedReport.device_info).map(([key, value]) => (
                      <div key={key} className="flex flex-col">
                        <span className="text-muted-foreground capitalize">{key}</span>
                        <span className="font-medium truncate" title={String(value)}>{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </DialogScaffoldBody>
        </DialogScaffoldContent>
      </Dialog>

      <ConfirmDialog
        open={!!reportToDelete}
        title="Delete bug report?"
        description={reportToDelete ? `This permanently removes "${reportToDelete.title}" from admin reports.` : undefined}
        confirmLabel="Delete"
        loading={!!deletingId}
        onConfirm={deleteReport}
        onCancel={() => setReportToDelete(null)}
      />
    </div>
  );
}
