import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AdminSubmission } from "@/lib/admin/dashboard";
import { cn } from "@/lib/utils";
import { formatDateShortPH } from "@/lib/utils/date";

interface RecentSubmissionsProps {
  submissions: AdminSubmission[];
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-900",
  APPROVED: "bg-emerald-100 text-emerald-900",
  REJECTED: "bg-rose-100 text-rose-900",
};

export function RecentActivity({ submissions }: RecentSubmissionsProps) {
  return (
    <Card className="border shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Recent Activity</CardTitle>
        <p className="text-sm text-muted-foreground">
          Latest facility updates and user suggestions.
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
          {submissions.length === 0 && (
            <p className="text-sm text-muted-foreground">No recent activity.</p>
          )}
          {submissions.map((submission) => {
            const isAdmin = submission.source === "ADMIN";
            const typeLabel = submission.type.replace(/_/g, " ").toLowerCase();

            return (
              <Link
                key={submission.id}
                href={`/admin/suggestions/${submission.id}`}
                className={cn(
                  "flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50",
                  isAdmin
                    ? "bg-slate-50 border-slate-200 dark:bg-slate-900/50 dark:border-slate-800"
                    : "bg-blue-50/50 border-blue-100 dark:bg-blue-900/20 dark:border-blue-800"
                )}
              >
                 <div className="flex flex-col gap-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{submission.suggestedName}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium uppercase tracking-wider shrink-0 ${isAdmin ? "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200" : "bg-blue-100 text-blue-700 dark:bg-blue-800 dark:text-blue-200"
                        }`}
                    >
                      {isAdmin ? "System" : "User"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="capitalize truncate">{typeLabel}</span>
                    <span className="shrink-0">•</span>
                    <span className="shrink-0">{formatDateShortPH(submission.createdAt)}</span>
                  </div>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium shrink-0 ml-2 ${STATUS_COLORS[submission.status] ?? "bg-muted text-foreground"}`}
                >
                  {submission.status}
                </span>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
