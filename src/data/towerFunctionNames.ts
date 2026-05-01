/**
 * Single source of truth for the L1 Function name per tower.
 *
 * Used by every layer that needs to stamp the dummy L2 (Job Grouping)
 * during the 5-layer migration:
 *
 *   - `lib/localStore.ts` — `migrateProgramV4ToV5` stamps `l2 = TOWER_FUNCTION_NAME[towerId]`
 *     on every persisted L4WorkforceRow during the v4→v5 read-time migration.
 *   - `lib/assess/parseAssessFile.ts` — back-compat default for legacy 2-column
 *     uploads (no Job Grouping column → fill with the tower's function name).
 *   - `data/capabilityMap/*.ts` — the dummy L2 wrapper inside each canonical
 *     map carries this exact name (codemod ensures consistency at author time,
 *     not runtime).
 *   - `scripts/migrate-assess.cjs` — Node-side migration runner re-declares the
 *     same table for the SQL backfill. Keep both in sync; they're small.
 *
 * Names mirror `Tower.name` exactly so the dummy L2 chip in the UI reads the
 * same as the L1 Function header. A future content pass can split any tower's
 * single Job Grouping into multiple distinct names without changing this
 * module — this is only the *default* used by uploads + back-compat.
 */
import type { Tower } from "@/data/types";

export const TOWER_FUNCTION_NAME: Record<Tower["id"], string> = {
  finance: "Finance",
  hr: "HR & Talent",
  "research-analytics": "Research & Analytics",
  legal: "Legal & Business Affairs",
  "corp-services": "Corporate Services",
  "tech-engineering": "Technology & Engineering",
  "operations-technology": "Operations & Technology",
  sales: "Sales",
  "marketing-comms": "Marketing & Communications",
  service: "Service",
  "editorial-news": "Editorial & News",
  production: "Production",
  "programming-dev": "Programming & Development",
};

/**
 * Resolve the L1 Function name for a tower id, with a sane fallback for any
 * unrecognized id (e.g. an old snapshot referencing a deprecated tower).
 *
 * Used by the v4→v5 migration to stamp the dummy L2 (Job Grouping) on every
 * existing row. The fallback is intentionally generic so the UI can render
 * something rather than crashing on a missing tower.
 */
export function getTowerFunctionName(towerId: string): string {
  return (
    (TOWER_FUNCTION_NAME as Record<string, string | undefined>)[towerId] ??
    "Function"
  );
}

/**
 * Stable id for the dummy L2 wrapper inside each canonical map. Used by the
 * Phase 2 codemod and any selector that needs to reference the wrapper id.
 *
 * Format: `<towerId>-jg` (`jg` = "Job Grouping"). Stays distinct from any
 * existing L3/L4/L5 id format in the codebase.
 */
export function getDummyJobGroupingId(towerId: string): string {
  return `${towerId}-jg`;
}
