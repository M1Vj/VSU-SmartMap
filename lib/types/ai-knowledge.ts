import type { AuditFields } from "./common";

export interface AiKnowledgeEntry extends AuditFields {
  readonly id: string;
  readonly title: string;
  readonly content: string;
  readonly keywords: readonly string[];
  readonly source: string | null;
  readonly isActive: boolean;
  readonly priority: number;
}

export interface AiKnowledgeEntryRow {
  id: string;
  title: string;
  content: string;
  keywords: string[] | null;
  source: string | null;
  is_active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface AiKnowledgeEntryInsert {
  readonly id?: string;
  readonly title: string;
  readonly content: string;
  readonly keywords?: readonly string[];
  readonly source?: string | null;
  readonly isActive?: boolean;
  readonly priority?: number;
}

export type AiKnowledgeEntryUpdate = Partial<AiKnowledgeEntryInsert>;

export type AiKnowledgeChatContext = Pick<
  AiKnowledgeEntry,
  "id" | "title" | "content" | "keywords" | "source" | "priority"
>;
