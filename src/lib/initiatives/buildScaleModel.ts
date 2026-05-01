/**
 * Cross-Tower AI Plan — per-initiative build & scale model.
 *
 * Pure math layer that turns the deterministic initiative roster into:
 *
 *   - Per-initiative timing rows: phase-start month, build duration (from
 *     `Process.timelineMonths` when available, else phase default), 6-month
 *     ramp, full-scale month — plus flags for builds that extend past the
 *     24-month horizon.
 *   - 24-month program run-rate series: in each month m, the sum of every
 *     initiative's contribution given its build/ramp position.
 *   - Tail metadata: how many initiatives ramp past M24, the M24 modeled
 *     run-rate vs the full-scale program total, and the dollar gap between
 *     them — so the chart caption / KPI strip can surface the truth without
 *     fabricating it.
 *
 * Phase-start-month convention is INTENTIONALLY UNCHANGED from the legacy
 * model (P1=M1, P2=M7, P3=M13). What changed is the SEMANTIC meaning of
 * each tier — see the 2x2 in `lib/initiatives/programTier.ts`:
 *
 *   P1 — Quick Wins        (HF / HBI) → start M1; leverage proven platforms.
 *   P2 — Fill-ins          (HF / LBI) → start M7; high-feasibility but
 *                                       smaller-impact rows slot in once
 *                                       Quick Wins are in flight.
 *   P3 — Strategic Builds  (LF / HBI) → start M13. The later start reflects
 *                                       longer build / change-management
 *                                       runways, NOT lower importance —
 *                                       these are the high-impact, lower-
 *                                       feasibility rows that need the
 *                                       bigger lift.
 *   Deprioritized          (LF / LBI) → never sequenced; filtered at the
 *                                       selector layer before this model
 *                                       sees them.
 *
 * Determinism contract:
 *   - Phase windows come from `programTier`. Never moved.
 *   - Build months come from `Process.timelineMonths` (already in data) or
 *     phase-tier defaults grounded in phase semantics:
 *       P1 → 4 months: leverage already-deployed platforms (BlackLine,
 *            Salesforce, Workday) — configuration + agent-fleet rollout,
 *            not net-new platform stand-up.
 *       P2 → 6 months: mid-complexity new agent fleet on existing platform;
 *            modest data-fabric build.
 *       P3 → 9 months: heavy lifts — multi-system integrations, new vendor
 *            onboarding, larger workforce-impact change-management. Reflects
 *            the lower-feasibility nature of the LF/HBI bucket.
 *       Unphased → 6 months: median assumption when no priority set.
 *   - Ramp is a fixed 6 months for every initiative (rationale documented at
 *     the call sites + on the Gantt legend).
 *   - Linear ramp: planning convention; deliberately optimistic at the start
 *     of ramp where real adoption is typically slowest. S-curve refinement is
 *     downstream effort-estimate work.
 *   - Parallel-within-phase: every initiative in a phase starts together.
 *     Capacity sequencing is downstream (effort estimate). The Gantt caption
 *     surfaces this assumption explicitly.
 *
 * No clamping of `Process.timelineMonths`. If a build extends past M24, the
 * row carries `buildExtendsPastHorizon: true` and the Gantt renders a fade
 * + "completes Q? Y3" annotation. Honest, not lossy.
 */
import type { ProgramTier } from "@/data/types";
import type { TowerId } from "@/data/assess/types";
import { tierFromProgramTier, type Tier } from "@/lib/priority";
import type { ProgramImpactSummary } from "@/lib/assess/scenarioModel";

// ===========================================================================
//   Public constants — single source of truth for legends / tooltips
// ===========================================================================

export type BuildScalePhase = "P1" | "P2" | "P3" | "Unphased";

/** Fixed 6-month ramp across every initiative. See file-level docs. */
export const RAMP_MONTHS = 6;

/** First month of build for each phase. Parallel-within-phase. */
export const PHASE_START_MONTHS: Record<BuildScalePhase, number> = {
  P1: 1,
  P2: 7,
  P3: 13,
  Unphased: 17,
};

/** Phase-default build duration (months) when Process.timelineMonths absent. */
export const PHASE_BUILD_DEFAULTS: Record<BuildScalePhase, number> = {
  P1: 4,
  P2: 6,
  P3: 9,
  Unphased: 6,
};

/** Window string for legend / chip rendering. */
export const PHASE_WINDOWS: Record<BuildScalePhase, string> = {
  P1: "0–6 months",
  P2: "6–12 months",
  P3: "12–24 months",
  Unphased: "Late horizon",
};

/** Visual program horizon. Bars beyond this render with right-edge fade. */
export const HORIZON_MONTHS = 24;

// ===========================================================================
//   Public types
// ===========================================================================

/**
 * Thin input row — mirrors `ProgramInitiativeRow` but kept narrow so this
 * model stays decoupled from the wider selector layer.
 */
export type BuildScaleInputRow = {
  id: string;
  name: string;
  towerId: TowerId;
  towerName: string;
  /**
   * Program-level priority from the 2x2. `Deprioritized` rows are filtered
   * out before this model runs; if one slips through, `tierToPhase()`
   * routes it to "Unphased" so the math is still well-defined.
   */
  programTier: ProgramTier;
  /** Even-split share of l3.aiUsd across non-placeholder L4s. */
  attributedAiUsd: number;
  /** Process.timelineMonths when a full 4-lens initiative resolves. */
  timelineMonths?: number;
};

export type BuildScaleRow = {
  id: string;
  name: string;
  towerId: TowerId;
  towerName: string;
  programTier: ProgramTier;
  /** Visual `Tier` derived from `programTier` — `null` for Deprioritized. */
  tier: Tier | null;
  phase: BuildScalePhase;
  attributedAiUsd: number;

  phaseStartMonth: number;
  buildMonths: number;
  endBuildMonth: number;
  rampStartMonth: number;
  rampMonths: number;
  fullScaleMonth: number;

  /** True when endBuildMonth > 24 (build itself extends past horizon). */
  buildExtendsPastHorizon: boolean;
  /** True when fullScaleMonth > 24 (still ramping at end of horizon). */
  rampExtendsPastHorizon: boolean;

  /** Where buildMonths came from — informs the Gantt legend / tooltip. */
  buildSource: "process-timeline" | "phase-default";
};

export type BuildScaleMonthlyPoint = {
  /** 1-indexed month 1..24. */
  month: number;
  /** Sum of in-month contributions across every initiative. */
  runRateAiUsd: number;
};

export type BuildScaleTail = {
  /** How many rows have fullScaleMonth > 24. */
  initiativesRampingPastM24: number;
  /** Modeled run-rate at M24 = sum of contribution(i, 24). */
  runRateAtM24: number;
  /** Run-rate when every initiative reaches full scale (program total). */
  runRateAtFullScale: number;
  /** runRateAtFullScale − runRateAtM24. >= 0. */
  gapAtM24: number;
};

export type BuildScaleResult = {
  rows: BuildScaleRow[];
  monthly: BuildScaleMonthlyPoint[];
  tail: BuildScaleTail;
};

// ===========================================================================
//   Public function
// ===========================================================================

/**
 * Compute the per-initiative build/ramp/at-scale rows + the 24-month program
 * run-rate series from the ranked initiative roster.
 */
export function computeBuildScale(
  initiatives: readonly BuildScaleInputRow[],
  programImpact: ProgramImpactSummary,
): BuildScaleResult {
  const rows: BuildScaleRow[] = initiatives.map((init) => deriveRow(init));

  const monthly: BuildScaleMonthlyPoint[] = [];
  for (let m = 1; m <= HORIZON_MONTHS; m++) {
    let total = 0;
    for (const row of rows) {
      total += contributionAt(row, m);
    }
    monthly.push({ month: m, runRateAiUsd: total });
  }

  const initiativesRampingPastM24 = rows.filter(
    (r) => r.rampExtendsPastHorizon,
  ).length;
  const runRateAtM24 = monthly[monthly.length - 1]?.runRateAiUsd ?? 0;
  const runRateAtFullScale = programImpact.ai;
  const gapAtM24 = Math.max(0, runRateAtFullScale - runRateAtM24);

  return {
    rows,
    monthly,
    tail: {
      initiativesRampingPastM24,
      runRateAtM24,
      runRateAtFullScale,
      gapAtM24,
    },
  };
}

/**
 * In-month contribution for a single initiative. Linear ramp once build
 * completes; full attributed $ thereafter; zero before ramp starts.
 *
 * Exported for the Gantt tooltip and any spot-check tests.
 */
export function contributionAt(row: BuildScaleRow, month: number): number {
  if (month < row.rampStartMonth) return 0;
  if (month > row.fullScaleMonth) return row.attributedAiUsd;
  // Within the 6-month ramp window: linear from 1/6 → 6/6.
  const stepsIntoRamp = month - row.rampStartMonth + 1; // 1..rampMonths
  return (row.attributedAiUsd * stepsIntoRamp) / row.rampMonths;
}

// ===========================================================================
//   Internals
// ===========================================================================

/**
 * Map `ProgramTier` to the build-scale phase. P1/P2/P3 round-trip; the
 * "Deprioritized" bucket falls through to "Unphased" — the selector should
 * have filtered those rows out before they reach this model, but if one
 * slips in (e.g. via a stale cache), routing to Unphased keeps the math
 * well-defined and surfaces the row at the back of the queue.
 */
function tierToPhase(programTier: ProgramTier): BuildScalePhase {
  if (programTier === "P1" || programTier === "P2" || programTier === "P3") {
    return programTier;
  }
  return "Unphased";
}

function deriveRow(init: BuildScaleInputRow): BuildScaleRow {
  const phase = tierToPhase(init.programTier);
  const phaseStartMonth = PHASE_START_MONTHS[phase];

  const hasUsableTimeline =
    typeof init.timelineMonths === "number" &&
    Number.isFinite(init.timelineMonths) &&
    init.timelineMonths >= 1;
  const buildMonths = hasUsableTimeline
    ? Math.round(init.timelineMonths as number)
    : PHASE_BUILD_DEFAULTS[phase];
  const buildSource: BuildScaleRow["buildSource"] = hasUsableTimeline
    ? "process-timeline"
    : "phase-default";

  const endBuildMonth = phaseStartMonth + buildMonths - 1;
  const rampStartMonth = endBuildMonth + 1;
  const fullScaleMonth = rampStartMonth + RAMP_MONTHS - 1;

  return {
    id: init.id,
    name: init.name,
    towerId: init.towerId,
    towerName: init.towerName,
    programTier: init.programTier,
    tier: tierFromProgramTier(init.programTier),
    phase,
    attributedAiUsd: Math.max(0, init.attributedAiUsd ?? 0),

    phaseStartMonth,
    buildMonths,
    endBuildMonth,
    rampStartMonth,
    rampMonths: RAMP_MONTHS,
    fullScaleMonth,

    buildExtendsPastHorizon: endBuildMonth > HORIZON_MONTHS,
    rampExtendsPastHorizon: fullScaleMonth > HORIZON_MONTHS,

    buildSource,
  };
}
