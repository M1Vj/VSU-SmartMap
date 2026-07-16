import type { Metadata } from "next";
import { Bell, CircleAlert, MailPlus, Trash2 } from "lucide-react";

import { AdminBreadcrumbs } from "@/components/admin/admin-breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  addNotificationRecipientForm,
  deleteNotificationRecipientForm,
  updateNotificationRecipientForm,
} from "@/app/admin/notifications/actions";
import {
  listNotificationDeliveryLogs,
  listNotificationRecipients,
} from "@/lib/notifications/service";
import {
  NOTIFICATION_EVENTS,
  notificationEventLabel,
} from "@/lib/notifications/routing";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Notifications | Campus SmartMap for VSU Admin",
  description: "Manage admin email notification recipients.",
};

export default async function AdminNotificationsPage() {
  const { client } = await getSupabaseAdminClient({ requireServiceRole: true }).catch(
    (error) => {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY is required for the admin notifications page. Add it to .env.local and restart dev server.",
        { cause: error },
      );
    },
  );

  const [recipients, deliveryLogs] = await Promise.all([
    listNotificationRecipients(client),
    listNotificationDeliveryLogs(client, 20),
  ]);
  const gmailConfigured = Boolean(
    process.env.GMAIL_CLIENT_ID &&
      process.env.GMAIL_CLIENT_SECRET &&
      process.env.GMAIL_REFRESH_TOKEN &&
      process.env.GMAIL_FROM,
  );
  const resendConfigured = Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
  const providerConfigured = gmailConfigured || resendConfigured;
  const providerLabel = gmailConfigured ? "Gmail API" : resendConfigured ? "Resend" : null;

  return (
    <div className="space-y-6">
      <AdminBreadcrumbs />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">Notifications</h1>
          <p className="text-muted-foreground">
            Manage who receives admin email alerts for suggestions and boarding-house reviews.
          </p>
        </div>
        <Badge
          variant={providerConfigured ? "secondary" : "outline"}
          className="gap-2 px-3 py-1.5"
        >
          {providerConfigured ? `${providerLabel} configured` : "Email provider not configured"}
        </Badge>
      </div>

      {!providerConfigured ? (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            Add Gmail OAuth settings (`GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`,
            `GMAIL_REFRESH_TOKEN`, and `GMAIL_FROM`) in the deployment environment to
            send emails. Until then, notification attempts are logged as skipped.
          </p>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MailPlus className="h-5 w-5" aria-hidden />
            Add recipient
          </CardTitle>
          <CardDescription>
            Recipients only receive the event types selected below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={addNotificationRecipientForm} className="grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="admin@example.com" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="label">Label</Label>
              <Input id="label" name="label" placeholder="Admissions desk" />
            </div>
            <div className="flex items-end">
              <Button type="submit" className="w-full lg:w-auto">
                Add
              </Button>
            </div>
            <fieldset className="space-y-3 lg:col-span-3">
              <legend className="text-sm font-medium">Events</legend>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {NOTIFICATION_EVENTS.map((event) => (
                  <label
                    key={event.value}
                    className="flex items-start gap-3 rounded-md border p-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      name="eventTypes"
                      value={event.value}
                      defaultChecked
                      className="mt-1 h-4 w-4 rounded border-input"
                    />
                    <span>
                      <span className="block font-medium">{event.label}</span>
                      <span className="block text-muted-foreground">{event.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="flex items-center gap-2 text-sm lg:col-span-3">
              <input
                type="checkbox"
                name="enabled"
                defaultChecked
                className="h-4 w-4 rounded border-input"
              />
              Enabled
            </label>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" aria-hidden />
            Recipients
          </CardTitle>
          <CardDescription>
            Emails listed here receive selected admin notifications.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recipients.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              No admin notification recipients are configured.
            </div>
          ) : (
            <div className="space-y-4">
              {recipients.map((recipient) => (
                <form
                  key={recipient.id}
                  action={updateNotificationRecipientForm}
                  className="rounded-lg border p-4"
                >
                  <input type="hidden" name="id" value={recipient.id} />
                  <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_auto]">
                    <div>
                      <p className="text-sm font-semibold">{recipient.email}</p>
                      <p className="text-xs text-muted-foreground">
                        Added {formatDate(recipient.createdAt)}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`label-${recipient.id}`}>Label</Label>
                      <Input
                        id={`label-${recipient.id}`}
                        name="label"
                        defaultValue={recipient.label}
                        placeholder="Recipient label"
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <Button type="submit" variant="outline">
                        Save
                      </Button>
                      <Button
                        type="submit"
                        form={`delete-recipient-${recipient.id}`}
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${recipient.email}`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {NOTIFICATION_EVENTS.map((event) => (
                      <label
                        key={event.value}
                        className="flex items-start gap-3 rounded-md border p-3 text-sm"
                      >
                        <input
                          type="checkbox"
                          name="eventTypes"
                          value={event.value}
                          defaultChecked={recipient.eventTypes.includes(event.value)}
                          className="mt-1 h-4 w-4 rounded border-input"
                        />
                        <span>
                          <span className="block font-medium">{event.label}</span>
                          <span className="block text-muted-foreground">{event.description}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                  <label className="mt-4 flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="enabled"
                      defaultChecked={recipient.enabled}
                      className="h-4 w-4 rounded border-input"
                    />
                    Enabled
                  </label>
                </form>
              ))}
              {recipients.map((recipient) => (
                <form
                  key={`delete-${recipient.id}`}
                  id={`delete-recipient-${recipient.id}`}
                  action={deleteNotificationRecipientForm}
                >
                  <input type="hidden" name="id" value={recipient.id} />
                </form>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent delivery log</CardTitle>
          <CardDescription>
            Latest notification attempts, including skipped delivery when provider settings are missing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Subject</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deliveryLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No delivery attempts yet.
                  </TableCell>
                </TableRow>
              ) : (
                deliveryLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>{formatDate(log.createdAt)}</TableCell>
                    <TableCell>{notificationEventLabel(log.eventType)}</TableCell>
                    <TableCell>{log.recipientEmail}</TableCell>
                    <TableCell>
                      <Badge variant={log.status === "failed" ? "destructive" : "outline"}>
                        {log.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="line-clamp-2">{log.subject}</span>
                      {log.errorMessage ? (
                        <span className="block text-xs text-muted-foreground">
                          {log.errorMessage}
                        </span>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
