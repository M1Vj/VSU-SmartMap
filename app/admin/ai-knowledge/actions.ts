"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { revalidateAiKnowledgeCache } from "@/lib/supabase/queries/ai-knowledge.server";
import {
  createAiKnowledgeEntry,
  deleteAiKnowledgeEntry,
  updateAiKnowledgeEntry,
} from "@/lib/supabase/queries/ai-knowledge";
import {
  assertAdminAction,
} from "@/lib/auth/server";

type ActionResult<T> = {
  data?: T;
  error?: string;
};

const knowledgeSchema = z.object({
  title: z.string().trim().min(2, "Title must be at least 2 characters"),
  content: z.string().trim().min(10, "Content must be at least 10 characters"),
  keywords: z.array(z.string().trim().min(1)).max(20).default([]),
  source: z.string().trim().max(160).optional().nullable(),
  isActive: z.boolean().default(true),
  priority: z.coerce.number().int().min(0).max(100).default(0),
});

async function requireAdmin() {
  const admin = await assertAdminAction();
  if ("error" in admin) return admin;
  return { client: admin.serviceClient };
}

export async function createAiKnowledgeAction(input: unknown): Promise<ActionResult<unknown>> {
  const parsed = knowledgeSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid knowledge entry. Check the title, content, and priority." };
  }

  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  const result = await createAiKnowledgeEntry(parsed.data, admin.client);
  if (result.error) return { error: result.error.message };

  await revalidateAiKnowledgeCache();
  revalidatePath("/admin/ai-knowledge");
  return { data: result.data };
}

export async function updateAiKnowledgeAction(
  id: string,
  input: unknown
): Promise<ActionResult<unknown>> {
  const parsed = knowledgeSchema.partial().safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid knowledge entry. Check the title, content, and priority." };
  }

  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  const result = await updateAiKnowledgeEntry(id, parsed.data, admin.client);
  if (result.error) return { error: result.error.message };

  await revalidateAiKnowledgeCache();
  revalidatePath("/admin/ai-knowledge");
  return { data: result.data };
}

export async function deleteAiKnowledgeAction(id: string): Promise<ActionResult<void>> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  const result = await deleteAiKnowledgeEntry(id, admin.client);
  if (result.error) return { error: result.error.message };

  await revalidateAiKnowledgeCache();
  revalidatePath("/admin/ai-knowledge");
  return {};
}
