-- Forge Cross-Tower AI Plan: single-document JSONB persistence (last regenerate wins).
--
-- Round-trip contract:
--   The Cross-Tower AI Plan page (`useCrossTowerPlan`) PUTs the full LLM
--   authorship payload + the gen-time snapshot to /api/cross-tower-ai-plan/state
--   after every successful Regenerate, and GETs it once on mount to rehydrate
--   without an LLM call. The deterministic compose layer (`composeProjects`)
--   re-derives the resolved view-models from the saved snapshot on hydrate, so
--   any future change to compose logic reflows the saved plan automatically
--   without a schema bump.
--
-- Storage shape:
--   Mirrors `assess_workshop`: one row per workshop, id default is "default",
--   document is JSONB with no enforced sub-schema (validation lives in
--   `src/lib/cross-tower/persistedPlan.ts`). Bumping the document `version`
--   field is the migration path for any breaking change to the LLM payload.
--
-- Idempotent: re-running this migration on an already-migrated database is a
-- no-op.

BEGIN;

CREATE TABLE IF NOT EXISTS cross_tower_ai_plan (
  id text PRIMARY KEY,
  document jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE cross_tower_ai_plan IS
  'Stores the latest GPT-5.5-authored Cross-Tower AI Plan as a JSONB document. One row per workshop; default id is "default". Re-derived view-models live in src/lib/cross-tower/composeProjects.ts.';

COMMIT;
