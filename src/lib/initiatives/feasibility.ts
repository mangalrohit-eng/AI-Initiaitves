/**
 * Feasibility derivation — single source of truth for the binary
 * `Feasibility` signal that feeds the cross-tower 2x2.
 *
 * Source stack (highest priority first):
 *
 *   1. **Explicit override** — when an upstream layer (overlay, canonical L4,
 *      or LLM-curated `L4Item`) carries `feasibility` directly, honor it
 *      verbatim.
 *   2. **Legacy `aiPriority` map** — for back-compat with rows that haven't
 *      been re-curated yet. P1 → "High"; P2 → "Low"; P3 → "Low".
 *      The asymmetric collapse reflects original P-tier semantics: P1 was
 *      reserved for "rules-based + named vendor ready, ships now." P2/P3
 *      mixed real opportunities with longer build horizons; defaulting to
 *      Low is the safer back-compat call until the next curation pass.
 *   3. **Heuristic fallback** — when neither is set, inspect:
 *        - `currentMaturity`     ("Automated" / "Semi-automated" → High)
 *        - `frequency`           ("Continuous" / "Daily" / "Weekly" → +1)
 *        - `primaryVendor`       (named vendor present → +1)
 *      A score >= 2 returns "High"; otherwise "Low". Heuristic is intentional-
 *      ly conservative — when the rubric and overlays both fall through, we
 *      lean Low so the program 2x2 doesn't accidentally over-promote a row
 *      that no editor has touched.
 *
 * `criticality` is **deliberately excluded** from feasibility — it's an
 * importance signal (mission-critical / high / medium / low), not a
 * ship-readiness signal. It feeds the business-impact axis indirectly via
 * the parent-L4 Activity Group dollar pool, and never the feasibility axis.
 */

import type {
  AiPriority,
  Feasibility,
  TowerProcessFrequency,
  TowerProcessMaturity,
} from "@/data/types";
import { feasibilityFromAiPriority } from "./composeVerdict";

export type ComputeFeasibilityInput = {
  /** Explicit override (overlay / canonical / LLM-curated L4Item). */
  feasibility?: Feasibility;
  /** Legacy P-tier — used only when `feasibility` is not set. */
  aiPriority?: AiPriority;
  /** Heuristic inputs — only consulted when both above fall through. */
  currentMaturity?: TowerProcessMaturity;
  frequency?: TowerProcessFrequency;
  /** Truthy when a named vendor is attached (BlackLine, Eightfold, etc.). */
  primaryVendor?: string;
};

const HIGH_FREQUENCY_VALUES: ReadonlySet<TowerProcessFrequency> = new Set<TowerProcessFrequency>([
  "Continuous",
  "Daily",
  "Weekly",
  "Bi-weekly",
  "Event-driven",
]);

/**
 * Resolve binary feasibility for a single L4. Pure function — safe inside
 * any selector loop. See file-level docs for the precedence chain.
 */
export function computeFeasibility(
  input: ComputeFeasibilityInput,
): Feasibility | undefined {
  // 1. Explicit override always wins.
  if (input.feasibility) return input.feasibility;

  // 2. Legacy P-tier back-compat.
  const fromPriority = feasibilityFromAiPriority(input.aiPriority);
  if (fromPriority) return fromPriority;

  // 3. Heuristic fallback. Conservative scoring — needs >= 2 positive
  //    signals to land "High" so an unlabeled row doesn't sneak into the
  //    Quick Wins bucket on heuristics alone.
  const maturityHigh =
    input.currentMaturity === "Automated" ||
    input.currentMaturity === "Semi-automated";
  const cadenceHigh = input.frequency
    ? HIGH_FREQUENCY_VALUES.has(input.frequency)
    : false;
  const vendorPresent = Boolean(
    input.primaryVendor &&
      input.primaryVendor.trim().length > 0 &&
      input.primaryVendor.trim().toLowerCase() !== "tbd — subject to discovery",
  );

  // If we have NOTHING (no maturity, no frequency, no vendor) we can't
  // honestly say anything about feasibility — return undefined and let the
  // program tier computation surface that as "feasibility unknown" rather
  // than guessing.
  if (!input.currentMaturity && !input.frequency && !input.primaryVendor) {
    return undefined;
  }

  const score = (maturityHigh ? 1 : 0) + (cadenceHigh ? 1 : 0) + (vendorPresent ? 1 : 0);
  return score >= 2 ? "High" : "Low";
}
