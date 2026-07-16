import { requireOwnerSession } from "@/lib/auth/server";
import { OwnerListingForm } from "@/components/owner/owner-listing-form";

export default async function NewOwnerListingPage() {
  await requireOwnerSession();

  return (
    <main className="min-h-[100dvh] bg-muted/30 px-4 py-6">
      <div className="mx-auto max-w-4xl">
        <header className="mb-5">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Create boarding house listing</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Drafts stay private until submitted and approved. Start with one room or bed offering.
          </p>
        </header>
        <OwnerListingForm />
      </div>
    </main>
  );
}
