"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle } from "lucide-react";

import { submitOwnerApplication } from "@/app/owner/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function OwnerApplicationForm({ email }: { email: string }) {
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(formData: FormData) {
    setError("");
    setMessage("");
    const result = await submitOwnerApplication(formData);
    if (result?.error) setError(result.error);
    if (result?.message) setMessage(result.message);
  }

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Verification application</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}
          {message && (
            <div className="rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-700">
              {message}
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Display name" name="displayName" required />
            <Field label="Phone" name="phone" required />
            <Field label="Email" name="email" type="email" defaultValue={email} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="authorityNotes">Authority notes</Label>
            <Textarea
              id="authorityNotes"
              name="authorityNotes"
              required
              placeholder="Explain your relationship to the property and who manages student inquiries."
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <FileField label="Identity document" name="identityDocument" />
            <FileField label="Proof of authority" name="authorityDocument" />
          </div>
          <SubmitButton />
        </form>
      </CardContent>
    </Card>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full rounded-full md:w-auto" loading={pending}>
      {pending ? "Submitting..." : "Submit application"}
    </Button>
  );
}

function Field(props: React.ComponentProps<typeof Input> & { label: string; name: string }) {
  const { label, name, ...inputProps } = props;
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} {...inputProps} />
    </div>
  );
}

function FileField({ label, name }: { label: string; name: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type="file"
        accept="image/png,image/jpeg,image/webp,application/pdf"
        required
      />
      <p className="text-xs text-muted-foreground">PNG, JPG, WebP, or PDF. Max 10MB.</p>
    </div>
  );
}
