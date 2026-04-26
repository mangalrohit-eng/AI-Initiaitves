-- Forge Assess: single-workshop JSON document (dev: Neon/Supabase/Vercel Postgres).
-- Run once: npm run db:migrate (requires DATABASE_URL in .env.local)

CREATE TABLE IF NOT EXISTS assess_workshop (
  id text PRIMARY KEY,
  program jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE assess_workshop IS 'Stores AssessProgramV2 JSON for the /assess product; id default is default.';
