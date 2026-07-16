CREATE TABLE IF NOT EXISTS public.chat_answer_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_hash TEXT NOT NULL UNIQUE,
  question TEXT NOT NULL,
  content TEXT NOT NULL,
  facilities JSONB,
  events JSONB,
  boarding_houses JSONB,
  model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE public.chat_answer_cache ENABLE ROW LEVEL SECURITY;
