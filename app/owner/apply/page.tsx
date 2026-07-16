import { redirect } from "next/navigation";

import { getAuthorizedSession } from "@/lib/auth/server";
import { canAccessOwnerArea } from "@/lib/auth/roles";
import { OwnerApplicationForm } from "@/components/owner/owner-application-form";

export default async function OwnerApplyPage() {
  const session = await getAuthorizedSession();
  if (!session) redirect("/owner/login");
  if (canAccessOwnerArea(session.roles)) redirect("/owner");

  return (
    <main className="min-h-[100dvh] bg-muted/30 px-4 py-6">
      <div className="mx-auto max-w-3xl">
        <header className="mb-5">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Apply as a boarding house owner</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Verification means SmartMap reviewed your identity and authority to manage the listing. It does not mean the university endorses or inspects the property.
          </p>
        </header>
        <OwnerApplicationForm email={session.user.email ?? ""} />
      </div>
    </main>
  );
}
