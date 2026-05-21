/**
 * Derives whether a tower's L3 initiative slate is currently sourced
 * from user uploads or from LLM discovery. Source-exclusive by design:
 * the UI hard-greys the upload affordance when a tower is in
 * "llm-discovered" mode and hard-greys the regenerate / discover
 * affordance when a tower is in "user-uploaded" mode. Switching modes
 * requires the user to explicitly clear the existing slate (and any
 * `initiativeReviews` tied to it) through one of the `clear*` helpers
 * in `curationPipelineV6.ts`.
 *
 * Mode rules (pure derivation — call once per render):
 * - `empty`           → no `L3Initiative` rows
 * - `user-uploaded`   → at least one row with `source === "manual"`
 * - `llm-discovered`  → all rows have `source === "llm" | "fallback"`
 *
 * Mixed slates can't happen by construction (the orchestrator wipes
 * the *other* mode's cards in `clearLLMInitiativesForTower` /
 * `clearManualInitiativesForTower` before any cross-mode write). If
 * somehow a mixed slate is encountered, the manual rows win — uploads
 * always reflect user intent and should never be silently hidden by an
 * LLM rerun bug.
 */

import type { L3Initiative } from "@/data/assess/types";

export type TowerInitiativeMode =
  | "empty"
  | "user-uploaded"
  | "llm-discovered";

export function deriveTowerInitiativeMode(
  initiatives: ReadonlyArray<L3Initiative> | undefined,
): TowerInitiativeMode {
  if (!initiatives || initiatives.length === 0) return "empty";
  const hasManual = initiatives.some((row) => row.source === "manual");
  if (hasManual) return "user-uploaded";
  return "llm-discovered";
}
