-- Forge Assess: 5-layer capability map cutover (V4 -> V5).
--
-- Background:
--   The capability map gained a new L2 "Job Grouping" layer between L1
--   Function and the existing layers. Field names shift one level deeper:
--     - L2 Pillar      -> L3 Job Family
--     - L3 Capability  -> L4 Activity Group   (dials + opportunity sizing live here)
--     - L4 Activity    -> L5 Activity         (where AI initiatives attach)
--
-- Storage shape:
--   `assess_workshop.program` is JSONB; the schema itself is unchanged
--   (no new columns / indices / constraints). The migration is purely a
--   payload-level rewrite inside the JSONB document.
--
-- Read-side compatibility:
--   The Next.js GET handler runs every loaded V4 row through
--   `importAssessProgramFromJsonText`, which carries V4 forward to V5
--   automatically (renames `l3Rows` -> `l4Rows`, stamps the new L2 from
--   `getTowerFunctionName(towerId)`, shifts `l4Activities`/`l4Items` to
--   `l5Activities`/`l5Items`, normalises `running-l4` curationStage to
--   `running-l5`, etc.). The PUT handler enforces `version === 5`, so
--   writes from a V5 deployment land in the canonical shape.
--
-- This script:
--   1. Updates the table COMMENT so a fresh `\d+ assess_workshop` reports
--      the current contract.
--   2. Backfills `program.version` from 4 (or anything < 5) to 5 in place
--      so the stored payload's reported version matches the runtime
--      contract. Field-level renames are intentionally NOT done in SQL —
--      the read-time migration in `localStore.migrateAssessProgram` /
--      `assessProgramIO.importAssessProgramFromJsonText` is the single
--      source of truth and runs again on the next read regardless.
--   3. Idempotent: re-running this migration on V5 rows is a no-op.
--
-- Cutover playbook (manual):
--   1. Apply this script against the dev DB first; verify GET /api/assess
--      returns the migrated payload.
--   2. Walk Steps 1–5 on Finance + Editorial News in dev to confirm
--      stale-detection, dial defaults, initiative curation, and offshore
--      planning all hydrate cleanly from the migrated rows.
--   3. Cut the `main` branch deploy to production; the v5 code re-runs the
--      read-time migration on every GET so any v4 row that landed during
--      the rollout window is silently upgraded on first load.
--   4. Apply this script against production AFTER the v5 deploy is live.
--      Order matters: applying it before the deploy would let v4 code see
--      `version: 5` and reject the payload with "version must be 4."

BEGIN;

UPDATE assess_workshop
   SET program = jsonb_set(program, '{version}', to_jsonb(5))
 WHERE COALESCE((program->>'version')::int, 0) < 5;

COMMENT ON TABLE assess_workshop IS
  'Stores AssessProgramV5 JSON for the /assess product (5-layer capability map: L1 Function / L2 Job Grouping / L3 Job Family / L4 Activity Group / L5 Activity). One row per workshop; default id is "default". Migration from V4 happens at read time in importAssessProgramFromJsonText.';

COMMIT;
