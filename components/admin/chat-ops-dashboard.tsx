import Link from "next/link";

import { reviewChatOpsRecordFormAction } from "@/app/admin/chat-ops/actions";
import type { ChatOpsDashboardData, ChatOpsFilters } from "@/lib/supabase/queries/chat-ops.server";

function Metric({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return <div className="rounded-md border bg-card p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div>;
}

function Entries({ values, empty = "None" }: { values: Record<string, number>; empty?: string }) {
  const entries = Object.entries(values).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return <ul className="space-y-2">{entries.map(([label, count]) => <li className="flex items-center justify-between gap-3 text-sm" key={label}><span className="truncate">{label.replaceAll("_", " ")}</span><span className="rounded-full bg-muted px-2 py-0.5 font-medium">{count}</span></li>)}</ul>;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(value));
}

export function ChatOpsDashboard({ data, filters }: { data: ChatOpsDashboardData; filters?: ChatOpsFilters }) {
  const { summary, turns, feedback, page } = data;
  if (!turns.length && !feedback.length) {
    return <div className="rounded-md border bg-card py-16 text-center"><h2 className="font-semibold">No chat operations captured yet</h2><p className="mt-1 text-sm text-muted-foreground">Recent assistant turns and feedback will appear after operational records are written.</p></div>;
  }
  const percent = (value: number) => summary.totalTurns ? `${Math.round(value / summary.totalTurns * 100)}%` : "0%";
  const nextOffset = page.offset + page.limit;
  const previousOffset = Math.max(0, page.offset - page.limit);
  const filterParams = new URLSearchParams();
  if (filters?.outcome) filterParams.set("outcome", filters.outcome);
  if (filters?.model) filterParams.set("model", filters.model);
  if (filters?.validation) filterParams.set("validation", filters.validation);
  if (filters?.reviewStatus) filterParams.set("reviewStatus", filters.reviewStatus);
  if (filters?.windowHours) filterParams.set("windowHours", String(filters.windowHours));
  const pageHref = (offset: number) => { const params = new URLSearchParams(filterParams); params.set("offset", String(offset)); return `/admin/chat-ops?${params}`; };

  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-3 rounded-md border bg-card p-4"><form className="flex flex-wrap items-end gap-2" method="get"><label className="text-xs">Window<select className="ml-2 rounded border bg-background p-2" name="windowHours" defaultValue={filters?.windowHours ?? 24}><option value="1">1h</option><option value="6">6h</option><option value="24">24h</option><option value="72">3d</option><option value="168">7d</option></select></label><label className="text-xs">Outcome<select className="ml-2 rounded border bg-background p-2" name="outcome" defaultValue={filters?.outcome ?? ""}><option value="">All</option>{["live","cached","recovered","generated_fallback","static_fallback","disabled_fallback","rate_limited","validation_failed","error","synthetic"].map((value) => <option key={value}>{value}</option>)}</select></label><label className="text-xs">Model<select className="ml-2 rounded border bg-background p-2" name="model" defaultValue={filters?.model ?? ""}><option value="">All</option>{["gemini-3.1-flash-lite","gemini-3.5-flash","gemini-2.5-flash-lite","gemini-2.5-flash"].map((value) => <option key={value}>{value}</option>)}</select></label><label className="text-xs">Validation<select className="ml-2 rounded border bg-background p-2" name="validation" defaultValue={filters?.validation ?? ""}><option value="">All</option><option>pass</option><option>warn</option><option>fail</option></select></label><label className="text-xs">Review<select className="ml-2 rounded border bg-background p-2" name="reviewStatus" defaultValue={filters?.reviewStatus ?? ""}><option value="">All</option><option>unreviewed</option><option>reviewing</option><option>resolved</option><option>dismissed</option></select></label><button className="rounded bg-primary px-3 py-2 text-xs font-medium text-primary-foreground" type="submit">Apply</button></form><a className="text-sm font-medium text-primary hover:underline" href={`/api/admin/chat-ops/export?${filterParams}`}>Export safe CSV</a></div>
    <p className="text-xs text-muted-foreground">Metrics summarize this bounded {filters?.windowHours ?? 24}-hour page of {summary.totalTurns} turn(s), not all-time traffic.</p>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Latency p50 / p95" value={`${summary.latencyP50Ms ?? "—"} / ${summary.latencyP95Ms ?? "—"} ms`} detail={`TTFT p50 / p95: ${summary.ttftP50Ms ?? "—"} / ${summary.ttftP95Ms ?? "—"} ms`} />
      <Metric label="Cache" value={summary.cacheHits} detail={`${percent(summary.cacheHits)} of sampled turns`} />
      <Metric label="Fallback / error rate" value={`${Math.round(summary.fallbackRate * 100)}% / ${Math.round(summary.errorRate * 100)}%`} detail={`Negative feedback: ${Math.round(summary.negativeFeedbackRate * 100)}%`} />
      <Metric label="Grounding" value={summary.groundedTurns} detail={`${percent(summary.groundedTurns)} grounded · ${summary.validationWarnings} validation attention`} />
    </div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <section className="rounded-md border bg-card p-4"><h2 className="mb-3 font-semibold">Chat outcomes</h2><Entries values={summary.outcomes} /></section>
      <section className="rounded-md border bg-card p-4"><h2 className="mb-3 font-semibold">Models</h2><Entries values={summary.models} /></section>
      <section className="rounded-md border bg-card p-4"><h2 className="mb-3 font-semibold">Prompt-injection signals</h2><Entries values={summary.injectionSignals} empty="No heuristic signals" /></section>
      <section className="rounded-md border bg-card p-4"><h2 className="mb-3 font-semibold">Feedback</h2><Entries values={{ positive: summary.positiveFeedback, negative: summary.negativeFeedback }} /></section>
    </div>
    <section className="overflow-hidden rounded-md border bg-card">
      <div className="border-b px-4 py-3"><h2 className="font-semibold">Recent sanitized turns</h2><p className="text-xs text-muted-foreground">Sensitive-looking contact and credential strings are masked; excerpts are truncated.</p></div>
      <div className="divide-y">{turns.map((turn) => <article className="space-y-3 p-4" key={turn.id}>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><time dateTime={turn.createdAt}>{formatTime(turn.createdAt)}</time><span>{turn.outcome.replaceAll("_", " ")} · {turn.selectedModel ?? turn.requestedModel ?? "No model"} · {turn.latencyMs ?? "—"} ms</span></div>
        <div className="grid gap-3 lg:grid-cols-2"><div><h3 className="text-xs font-semibold uppercase text-muted-foreground">Question</h3><p className="mt-1 text-sm">{turn.userMessage}</p></div><div><h3 className="text-xs font-semibold uppercase text-muted-foreground">Answer</h3><p className="mt-1 text-sm">{turn.assistantMessage ?? "No answer recorded"}</p></div></div>
        <dl className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4"><div><dt className="text-muted-foreground">Request ID</dt><dd className="truncate font-mono">{turn.requestId}</dd></div><div><dt className="text-muted-foreground">Retrieved IDs</dt><dd className="break-all">{turn.retrievedRecordIds.join(", ") || "None"}</dd></div><div><dt className="text-muted-foreground">Validation reasons</dt><dd>{turn.validationReasons.join(", ") || "None"}</dd></div><div><dt className="text-muted-foreground">Error / review</dt><dd>{turn.errorClass ?? "None"} · {turn.reviewStatus}</dd></div></dl>
        <div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-muted px-2 py-1">{turn.grounded ? "Grounded" : "No retrieved records"}</span><span className="rounded-full bg-muted px-2 py-1">Validation: {turn.validationStatus}</span>{turn.injectionSignals.map((signal) => <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200" key={signal}>{signal.replaceAll("_", " ")}</span>)}</div>
        <form action={reviewChatOpsRecordFormAction} className="flex flex-wrap items-end gap-2"><input type="hidden" name="target" value="turn"/><input type="hidden" name="id" value={turn.id}/><select aria-label="Turn review status" className="rounded border bg-background p-2 text-xs" name="status" defaultValue={turn.reviewStatus}><option>unreviewed</option><option>reviewing</option><option>resolved</option><option>dismissed</option></select><input aria-label="Turn review note" className="min-w-64 rounded border bg-background p-2 text-xs" maxLength={2000} name="note" placeholder="Optional review note"/><button className="rounded border px-3 py-2 text-xs font-medium" type="submit">Save review</button></form>
      </article>)}</div>
    </section>
    <section className="overflow-hidden rounded-md border bg-card"><div className="border-b px-4 py-3"><h2 className="font-semibold">Recent feedback</h2></div>{feedback.length ? <div className="divide-y">{feedback.map((item) => <article className="space-y-2 p-4" key={item.id}><div className="flex flex-wrap justify-between gap-2"><p className="text-sm font-medium">{item.rating === "positive" ? "Positive" : "Negative"}{item.reason ? ` · ${item.reason.replaceAll("_", " ")}` : ""}</p><time className="text-xs text-muted-foreground" dateTime={item.createdAt}>{formatTime(item.createdAt)}</time></div>{item.comment && <p className="text-sm text-muted-foreground">{item.comment}</p>}<form action={reviewChatOpsRecordFormAction} className="flex flex-wrap items-end gap-2"><input type="hidden" name="target" value="feedback"/><input type="hidden" name="id" value={item.id}/><select aria-label="Feedback review status" className="rounded border bg-background p-2 text-xs" name="status" defaultValue={item.reviewStatus}><option>unreviewed</option><option>reviewing</option><option>resolved</option><option>dismissed</option></select><input aria-label="Feedback review note" className="min-w-64 rounded border bg-background p-2 text-xs" maxLength={2000} name="note" placeholder="Optional review note"/><button className="rounded border px-3 py-2 text-xs font-medium" type="submit">Save review</button></form></article>)}</div> : <p className="p-4 text-sm text-muted-foreground">No feedback in this page.</p>}</section>
    <aside className="rounded-md border bg-muted/40 p-4 text-sm"><h2 className="font-semibold">Retention & alerts</h2><p className="mt-1 text-muted-foreground">Turns and feedback are retained for {data.retention.turnsDays} days; alert claims for {data.retention.alertClaimsDays} days. Alert deduplication uses {data.retention.alertWindowMinutes}-minute windows.</p></aside>
    <nav aria-label="Chat operations pages" className="flex justify-between"><span>{page.offset > 0 ? <Link className="text-sm font-medium text-primary hover:underline" href={pageHref(previousOffset)}>Previous page</Link> : null}</span><span>{page.hasMoreTurns || page.hasMoreFeedback ? <Link className="text-sm font-medium text-primary hover:underline" href={pageHref(nextOffset)}>Next page</Link> : null}</span></nav>
  </div>;
}
