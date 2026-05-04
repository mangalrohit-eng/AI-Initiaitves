import * as React from "react";
import type { BriefDepth } from "@/lib/cross-tower/aiProjects";

/**
 * Cross-Tower AI Plan v3 — user-editable assumptions.
 *
 * Every knob the executive can edit lives here. The plan only re-applies
 * assumptions when the user clicks **Regenerate** — knob edits flag the plan
 * stale but never silently mutate the rendered numbers.
 *
 * The split between LLM-affecting and timing-only knobs matters for cost.
 * Timing knobs (`programStartMonth`, per-phase start/build months, `rampMonths`)
 * are 0-token operations — we recompose deterministically without hitting the
 * model. LLM-affecting knobs (`planThresholdUsd`, `briefDepth`, the four
 * lens-emphasis toggles) change the prompt input and DO require a regeneration
 * call.
 *
 * `hashAssumptions` returns a deterministic key that the API route folds
 * into the per-cohort cache key — so toggling lens emphases or threshold
 * properly invalidates per-cohort caches without invalidating the program
 * synthesis cache for other cohorts.
 */

export type CrossTowerAssumptions = {
  /**
   * Minimum parent L4 Activity Group prize for inclusion in plan. Same grain
   * as the program-tier 2x2 (which classifies on the L4 prize). Migrated from
   * the legacy header `PlanThresholdInput` so plan inclusion is a single
   * Assumptions-tab knob alongside timing.
   */
  planThresholdUsd: number;

  // ------- Program window -------------------------------------------------
  /** Month 1 of the program (1-indexed). Shifts all phase anchors together. */
  programStartMonth: number;
  /** Adoption ramp window after build completes, in months (linear to full $). */
  rampMonths: number;

  // ------- Phase timing (program tier P1 / P2 / P3) -------------------------
  /** First calendar month of the plan window when P1-tier projects start build (1-indexed). */
  p1PhaseStartMonth: number;
  /** First calendar month when P2-tier projects start build (1-indexed). */
  p2PhaseStartMonth: number;
  /** First calendar month when P3-tier projects start build (1-indexed). */
  p3PhaseStartMonth: number;
  /** Build duration for P1-tier projects, months. */
  p1BuildMonths: number;
  /** Build duration for P2-tier projects, months. */
  p2BuildMonths: number;
  /** Build duration for P3-tier projects, months. */
  p3BuildMonths: number;

  // ------- Brief depth (LLM cost knob) -----------------------------------
  /**
   * "Concise" → tighter per-lens row counts, lower token spend per cohort.
   * "Full"   → richer briefs (more steps per work-state, more agents). Use for
   * client read-outs where the project brief is the centerpiece.
   */
  briefDepth: BriefDepth;

  // ------- Versant-lens emphases (LLM-affecting) -------------------------
  /** TSA expiration → standalone capability urgency (Sales, Finance, IT, HR). */
  emphasizeTsaReadiness: boolean;
  /** BB- credit + dividend → covenant + cost discipline (Finance, Corp Services). */
  emphasizeBbCreditDiscipline: boolean;
  /** Editorial floor → human-judgment guardrails (Editorial, MS NOW, Production). */
  emphasizeEditorialIntegrity: boolean;
  /** Live-broadcast resilience floor (Operations & Technology, Production). */
  emphasizeBroadcastResilience: boolean;
};

export const DEFAULT_ASSUMPTIONS: CrossTowerAssumptions = {
  planThresholdUsd: 1_000_000,
  programStartMonth: 1,
  rampMonths: 6,
  p1PhaseStartMonth: 1,
  p2PhaseStartMonth: 6,
  p3PhaseStartMonth: 12,
  p1BuildMonths: 4,
  p2BuildMonths: 6,
  p3BuildMonths: 4,
  briefDepth: "Concise",
  emphasizeTsaReadiness: true,
  emphasizeBbCreditDiscipline: true,
  emphasizeEditorialIntegrity: true,
  emphasizeBroadcastResilience: true,
};

const STORAGE_KEY = "forge.crossTowerPlan.assumptions.v3";
/** Legacy header threshold — drained on first read so users keep their value. */
const LEGACY_THRESHOLD_KEY = "forge.crossTowerPlan.aiUsdThreshold.v2";

// ---------------------------------------------------------------------------
//   Hash + serialization
// ---------------------------------------------------------------------------

/**
 * LLM-affecting subset only. Timing knobs are deliberately excluded — the
 * compose step recomputes Gantt timing client-side without an LLM call,
 * so we don't bust per-cohort caches when only timing changes.
 *
 * Result is a short hash string the API route folds into per-cohort cache
 * keys.
 */
export function hashAssumptions(a: CrossTowerAssumptions): string {
  const compact = {
    th: Math.round(a.planThresholdUsd / 1_000),
    bd: a.briefDepth,
    et: a.emphasizeTsaReadiness ? 1 : 0,
    eb: a.emphasizeBbCreditDiscipline ? 1 : 0,
    ee: a.emphasizeEditorialIntegrity ? 1 : 0,
    er: a.emphasizeBroadcastResilience ? 1 : 0,
  };
  return djb2(JSON.stringify(compact));
}

function djb2(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

// ---------------------------------------------------------------------------
//   Clamping + validation
// ---------------------------------------------------------------------------

const MAX_THRESHOLD_USD = 100_000_000;
const MAX_MONTHS = 36;

export function clampAssumptions(
  partial: Partial<CrossTowerAssumptions>,
): CrossTowerAssumptions {
  const merged = { ...DEFAULT_ASSUMPTIONS, ...partial };
  let p1s = clampInt(merged.p1PhaseStartMonth, 1, MAX_MONTHS);
  let p2s = clampInt(merged.p2PhaseStartMonth, 1, MAX_MONTHS);
  let p3s = clampInt(merged.p3PhaseStartMonth, 1, MAX_MONTHS);
  if (p2s < p1s) p2s = p1s;
  if (p3s < p2s) p3s = p2s;

  return {
    planThresholdUsd: clampInt(merged.planThresholdUsd, 0, MAX_THRESHOLD_USD),
    programStartMonth: clampInt(merged.programStartMonth, 1, MAX_MONTHS),
    rampMonths: clampInt(merged.rampMonths, 0, 18),
    p1PhaseStartMonth: p1s,
    p2PhaseStartMonth: p2s,
    p3PhaseStartMonth: p3s,
    p1BuildMonths: clampInt(merged.p1BuildMonths, 1, MAX_MONTHS),
    p2BuildMonths: clampInt(merged.p2BuildMonths, 1, MAX_MONTHS),
    p3BuildMonths: clampInt(merged.p3BuildMonths, 1, MAX_MONTHS),
    briefDepth: merged.briefDepth === "Full" ? "Full" : "Concise",
    emphasizeTsaReadiness: Boolean(merged.emphasizeTsaReadiness),
    emphasizeBbCreditDiscipline: Boolean(merged.emphasizeBbCreditDiscipline),
    emphasizeEditorialIntegrity: Boolean(merged.emphasizeEditorialIntegrity),
    emphasizeBroadcastResilience: Boolean(merged.emphasizeBroadcastResilience),
  };
}

function clampInt(n: unknown, min: number, max: number): number {
  const x = typeof n === "number" && Number.isFinite(n) ? Math.round(n) : NaN;
  if (Number.isNaN(x)) return min;
  return Math.max(min, Math.min(max, x));
}

// ---------------------------------------------------------------------------
//   Persistence
// ---------------------------------------------------------------------------

function readStored(): CrossTowerAssumptions {
  if (typeof window === "undefined") return DEFAULT_ASSUMPTIONS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object") {
        return clampAssumptions(parsed as Partial<CrossTowerAssumptions>);
      }
    }
    // Legacy threshold drain — first-load migration.
    const legacy = window.localStorage.getItem(LEGACY_THRESHOLD_KEY);
    if (legacy !== null) {
      const n = Number.parseInt(legacy, 10);
      if (Number.isFinite(n) && n >= 0) {
        const migrated = clampAssumptions({
          ...DEFAULT_ASSUMPTIONS,
          planThresholdUsd: n,
        });
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
          window.localStorage.removeItem(LEGACY_THRESHOLD_KEY);
        } catch {
          // non-fatal
        }
        return migrated;
      }
    }
  } catch {
    // localStorage unavailable — fall through.
  }
  return DEFAULT_ASSUMPTIONS;
}

function writeStored(value: CrossTowerAssumptions): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // non-fatal
  }
}

// ---------------------------------------------------------------------------
//   React hook — single source of truth for assumptions on the page
// ---------------------------------------------------------------------------

export type UseCrossTowerAssumptionsResult = {
  /** Current draft assumptions — UI binds inputs to this. */
  assumptions: CrossTowerAssumptions;
  /** Update one or more knobs at once. */
  update: (patch: Partial<CrossTowerAssumptions>) => void;
  /** Reset to `DEFAULT_ASSUMPTIONS`. */
  reset: () => void;
  /** True until the first client-side hydrate completes. */
  hydrating: boolean;
};

export function useCrossTowerAssumptions(): UseCrossTowerAssumptionsResult {
  const [hydrating, setHydrating] = React.useState(true);
  const [assumptions, setAssumptions] = React.useState<CrossTowerAssumptions>(
    DEFAULT_ASSUMPTIONS,
  );
  React.useEffect(() => {
    const stored = readStored();
    setAssumptions(stored);
    setHydrating(false);
  }, []);
  const update = React.useCallback(
    (patch: Partial<CrossTowerAssumptions>) => {
      setAssumptions((prev) => {
        const next = clampAssumptions({ ...prev, ...patch });
        writeStored(next);
        return next;
      });
    },
    [],
  );
  const reset = React.useCallback(() => {
    writeStored(DEFAULT_ASSUMPTIONS);
    setAssumptions(DEFAULT_ASSUMPTIONS);
  }, []);
  return { assumptions, update, reset, hydrating };
}
