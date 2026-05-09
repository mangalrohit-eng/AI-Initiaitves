/**
 * Schema flag for the v5 -> v6 cutover.
 *
 *   v5 (default) — current production: L4 Activity Group dials + L5-grain AI
 *                  initiatives. The shape that has shipped on `main`.
 *   v6 (target)  — L3 Job Family dials + 1-N specific AI Solution products
 *                  per L3 (e.g. "Agentic AI News Production Co-Pilot"). L4
 *                  rows are kept as read-only context for the LLM prompt.
 *
 * Set via `NEXT_PUBLIC_FORGE_SCHEMA` in `.env.local` (or the deployment env).
 * Defaults to `v5` when unset so existing dev environments keep working.
 *
 * The flag is read once at module load; `process.env` cannot change at
 * runtime in Next.js anyway. Phases 0-3 of the cutover land code paths
 * that compile cleanly under both v5 and v6; the flag gates which surfaces
 * are wired up. After Phase 7 cleanup, the v5 paths are removed and this
 * flag becomes vestigial.
 */
export type ForgeSchema = "v5" | "v6";

/**
 * Resolve the active schema. Reads `process.env.NEXT_PUBLIC_FORGE_SCHEMA`;
 * any value other than the literal string `"v6"` resolves to `"v5"` so a
 * misspelled flag never silently activates the cutover.
 */
export function getForgeSchema(): ForgeSchema {
  const raw = process.env.NEXT_PUBLIC_FORGE_SCHEMA;
  return raw === "v6" ? "v6" : "v5";
}

/** Snapshot at module load — safe to use as a runtime constant. */
export const FORGE_SCHEMA: ForgeSchema = getForgeSchema();

/** Convenience boolean — true when the v6 cutover is active. */
export const IS_V6: boolean = FORGE_SCHEMA === "v6";

/**
 * The current persisted-program version that v6 writes. Phase 0 declares
 * this so types and migrations have a single constant to key off; Phase 1
 * will type the program envelope to permit `version: 5 | 6`.
 */
export const PERSISTED_PROGRAM_VERSION_V6 = 6 as const;

/**
 * The legacy v5 version literal — kept here so call sites have one import
 * for both old and new. Phase 7 will inline this as `6` once v5 is dead.
 */
export const PERSISTED_PROGRAM_VERSION_V5 = 5 as const;

/** localStorage key prefix for the one-time pre-migration backup of v5 data. */
export const PRE_MIGRATION_BACKUP_PREFIX = "forge.assessProgram.preMigration." as const;

/** TTL (ms) for pre-migration backups — 30 days. */
export const PRE_MIGRATION_BACKUP_TTL_MS = 30 * 24 * 60 * 60 * 1000;
