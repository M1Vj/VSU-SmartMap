CREATE TABLE IF NOT EXISTS ai_knowledge_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  keywords TEXT[] NOT NULL DEFAULT '{}',
  source TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_knowledge_entries_active_priority
  ON ai_knowledge_entries(is_active, priority DESC, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_knowledge_entries_keywords
  ON ai_knowledge_entries USING GIN (keywords);

CREATE INDEX IF NOT EXISTS idx_ai_knowledge_entries_search
  ON ai_knowledge_entries USING GIN (
    to_tsvector('english'::regconfig, coalesce(title, '') || ' ' || coalesce(content, ''))
  );

ALTER TABLE ai_knowledge_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read active knowledge entries" ON ai_knowledge_entries;
CREATE POLICY "Public read active knowledge entries"
  ON ai_knowledge_entries
  FOR SELECT
  TO public
  USING (is_active = true);

DROP POLICY IF EXISTS "Admins manage knowledge entries" ON ai_knowledge_entries;
CREATE POLICY "Admins manage knowledge entries"
  ON ai_knowledge_entries
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND raw_user_meta_data->>'role' = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND raw_user_meta_data->>'role' = 'admin'
    )
  );

DROP TRIGGER IF EXISTS ai_knowledge_entries_updated_at ON ai_knowledge_entries;
CREATE TRIGGER ai_knowledge_entries_updated_at
  BEFORE UPDATE ON ai_knowledge_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
