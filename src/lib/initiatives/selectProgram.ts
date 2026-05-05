/**
 * Cross-Tower AI Plan — program-level selector.
 *
 * Pure function that loops every Versant tower and assembles the deterministic
 * substrate for the Cross-Tower AI Plan page (`/program/cross-tower-ai-plan`):
 *
 *   - Ranked initiative roster across the 13 towers (used as the LLM's
 *     selection ground truth — the model picks from this list, can't invent).
 *   - **Program-level priority via the 2x2 over `(feasibility, parent-L4
 *     Activity Group business impact)`.** See `lib/initiatives/programTier.ts`
 *     for the full classification rule. Tiering is centralized at the program
 *     layer so a P1 in Finance and a P1 in Editorial are directly comparable
 *     — unlike the legacy per-tower P-tier, which was tower-local and made
 *     cross-tower sequencing arguments non-defensible.
 *   - Phase buckets (P1 / P2 / P3 / Deprioritized). Phase membership is
 *     deterministic; the LLM is not allowed to move an initiative across
 *     tiers — it ranks within them and adds narrative.
 *   - 24-month cumulative modeled $ buildup, ramped per phase. Phase start
 *     months match `PHASE_START_MONTHS` in `buildScaleModel.ts` (P1=M1,
 *     P2=M6, P3=M12), aligned with Cross-Tower AI Plan assumptions. Tier
 *     labels (Quick Wins / Fill-ins / Strategic Builds) come from the 2x2.
 *   - Architecture roll-up: orchestration pattern mix, agent type mix, and a
 *     deduped vendor stack drawn from `Process.workbench.post` + named
 *     vendors on agent toolsUsed. Scoped to in-plan (P1+P2+P3 whose parent
 *     L4 Activity Group prize clears the `aiUsdThreshold`) — Deprioritized
 *     rows do NOT contribute.
 *   - Tower-in-scope set: every tower that contributes a non-zero AI $ pool.
 *
 * Routes every $ through `selectInitiativesForTower` + `programImpactSummary`
 * — no new arithmetic. Mirrors the financial-integrity contract documented at
 * the top of `select.ts`.
 *
 * `aiUsdThreshold` is preserved from the legacy model. It runs as a
 * **secondary** filter on top of the 2x2 and operates at the **same grain
 * as the 2x2 — the parent L4 Activity Group's full `aiUsd` (the L4
 * Activity Group prize)**, NOT the even-split per-L5 Activity attribution.
 * Reason: dividing the L4 Activity Group prize by the surfaced-L5 count is
 * purely a display convenience; an L5 Activity with $250K of attribution
 * doesn't represent a $250K opportunity, it represents one shipping path
 * into a multi-million-dollar L4 Activity Group prize. Filtering on the
 * post-split number was structurally killing P2 (HF + LBI), which by
 * definition lives just below the median and gets sliced into per-L5
 * crumbs that the threshold then strips out. Operating on `l3.aiUsd`
 * (field name retained from V4; semantically the L4 Activity Group prize
 * under V5) keeps both signals at the same grain — the threshold is a
 * "minimum L4 Activity Group prize for inclusion" knob.
 *
 * In-plan rule (post-2x2): `programTier !== "Deprioritized"` AND
 * `parent l3.aiUsd >= aiUsdThreshold`. Both exclusion paths are surfaced
 * separately on the KPI strip so an executive can see "below the line by
 * 2x2" vs "below the L4 Activity Group dollar threshold" as distinct buckets.
 */
import type {
  AgentOrchestration,
  ProgramTier,
  Process,
  Tower,
} from "@/data/types";
import type { AssessProgramV2, TowerId } from "@/data/assess/types";
import { towers } from "@/data/towers";
import {
  selectInitiativesForTower,
  type InitiativeL3,
  type InitiativeL4,
  type SelectInitiativesResult,
} from "@/lib/initiatives/select";
import { findAiInitiative } from "@/lib/utils";
import { tierFromProgramTier, type Tier } from "@/lib/priority";
import { programTierLabel, programTierRank } from "@/lib/programTierLabels";
import {
  computeProgramTiers,
  BUSINESS_IMPACT_FLOOR_USD,
} from "@/lib/initiatives/programTier";
import {
  programImpactSummary,
  type ProgramImpactSummary,
} from "@/lib/assess/scenarioModel";
import {
  computeBuildScale,
  PHASE_START_MONTHS,
  type BuildScaleResult,
  type BuildScaleInputRow,
} from "@/lib/initiatives/buildScaleModel";

// ===========================================================================
//   View-model types
// ===========================================================================

export type ProgramInitiativeRow = {
  /** Stable id: prefers `initiativeId` (full 4-lens), then `briefSlug`, then synthetic. */
  id: string;
  towerId: TowerId;
  towerName: string;
  /** Display name — uses InitiativeL4.name (the activity-level label). */
  name: string;
  /**
   * L2 / L3 capability path, denormalized for one-line rendering.
   * Field names retained for back-compat; under V5 these carry the
   * **L3 Job Family / L4 Activity Group** pair.
   */
  l2Name: string;
  l3Name: string;
  /**
   * @deprecated Legacy P-tier string carried only for back-compat snapshots
   * and overlay-debug tooling. Cross-tower priority lives on `programTier`.
   */
  aiPriority?: string;
  /**
   * Program-level priority from the deterministic 2x2 over
   * `(feasibility, parent-L4 Activity Group business impact)`. Always
   * defined — every initiative falls into one of P1/P2/P3/Deprioritized.
   */
  programTier: ProgramTier;
  /** Human-readable explanation of the tiering decision; powers tooltips. */
  programTierReason: string;
  /**
   * Visual `Tier` (`P1` / `P2` / `P3` / `null` for Deprioritized). Convenience
   * derivation of `programTier` for callers that key off the legacy 3-tier
   * color palette; the underlying truth is `programTier`.
   */
  tier: Tier | null;
  /** Versant-grounded rationale (short). */
  aiRationale?: string;
  /** Per-L4 Activity Group modeled AI $ this initiative contributes to (deterministic). */
  aiUsd: number;
  /**
   * Even-split share of `l3.aiUsd` across non-placeholder L4s under the same
   * L3. Used for any sum-of-initiatives math (Gantt, run-rate). Sums to ≈
   * `programImpact.ai` across the program (modulo L3s where every L4 is a
   * placeholder — those L3s contribute to `programImpact.ai` but have no
   * surfaced initiative to attribute against).
   */
  attributedAiUsd: number;
  /** Click-through to the full 4-lens initiative when available. */
  initiativeId?: string;
  /** Click-through to a hand-curated AIProcessBrief when available. */
  briefSlug?: string;
  /** Resolved Process when `initiativeId` matches a Process on the tower. */
  initiative?: Process;
  /** Underlying L4 view-model — useful for downstream UI (badges, etc.). */
  l4: InitiativeL4;
  /** Underlying L3 view-model — useful for downstream UI. */
  l3: InitiativeL3;
};

export type PhaseBucket = {
  /** `null` for the Deprioritized bucket; carries the visual Tier otherwise. */
  tier: Tier | null;
  /** The full `ProgramTier` value — distinguishes Deprioritized from "no tier". */
  programTier: ProgramTier;
  /** Display label, e.g. "P1 — Quick Wins (HF · HBI)". */
  label: string;
  /** Time window string, e.g. "0–6 months · high feasibility, high impact". */
  window: string;
  /** Initiatives whose deterministic 2x2 lands in this bucket. */
  initiatives: ProgramInitiativeRow[];
  /** Sum of `attributedAiUsd` across initiatives in this bucket. */
  aiUsd: number;
};

/** Deterministic 24-month cumulative AI $ buildup. */
export type ValueBuildupPoint = {
  /** 1-indexed month, 1..24. */
  month: number;
  /** Cumulative modeled AI $ in-flight by end of this month. */
  cumulativeAiUsd: number;
  /** Tier whose ramp is currently active for this month. */
  activeTier: Tier;
};

export type OrchestrationMix = {
  pattern: AgentOrchestration["pattern"];
  count: number;
};

export type AgentTypeMix = {
  type: "Orchestrator" | "Specialist" | "Monitor" | "Router" | "Executor";
  count: number;
};

export type VendorStackEntry = {
  vendor: string;
  /** How many initiatives across the program reference this vendor/platform. */
  count: number;
};

export type TowerInScope = {
  id: TowerId;
  name: string;
  /** Modeled AI $ for this tower (sum of L3 `aiUsd`). */
  aiUsd: number;
  /** Number of curated initiatives surfaced for this tower. */
  initiativeCount: number;
};

export type ProgramArchitecture = {
  orchestrationMix: OrchestrationMix[];
  agentTypeMix: AgentTypeMix[];
  /** Top vendor stack entries, sorted by count desc, capped at 12 for display. */
  vendorStack: VendorStackEntry[];
  /** Total agents across resolved Processes in-scope. */
  totalAgents: number;
};

/**
 * Plan threshold metadata. The threshold is a SECONDARY filter that runs on
 * top of the 2x2 and operates at the same grain — the parent L4 Activity
 * Group's full `aiUsd` (the L4 Activity Group prize). A row stays in plan
 * only when both `programTier !== "Deprioritized"` AND its parent
 * `l3.aiUsd >= aiUsdThreshold` (field name `l3.aiUsd` retained for back-compat
 * — semantically the L4 Activity Group prize under V5). The KPI strip surfaces
 * below-threshold $ as a distinct bucket from below-the-line-by-2x2 $, so the
 * executive can see why each excluded $ was dropped.
 */
export type PlanThreshold = {
  /**
   * Minimum parent-L4 Activity Group `aiUsd` (the L4 Activity Group prize)
   * for the L5 Activity initiatives under it to be in plan. Operates at L4
   * grain so it doesn't double-jeopardise P2 rows whose per-L5 attribution
   * would sit below any reasonable dollar floor by definition.
   */
  aiUsdThreshold: number;
  /** L5 Activity initiatives dropped because their parent L4 Activity Group prize fell below the threshold. */
  excludedCount: number;
  /**
   * Sum of `attributedAiUsd` across the dropped L5 Activity initiatives —
   * equal to the sum of the dropped L4 Activity Group prizes (even-split
   * rolls back up).
   */
  excludedAiUsd: number;
  /** Towers that lost their last in-plan initiative because of the threshold. */
  excludedTowerCount: number;
};

/**
 * Diagnostics surfaced from the program-tier 2x2 for the KPI strip and any
 * "why is this Deprioritized?" tooltip.
 */
export type ProgramTierDiagnostics = {
  /**
   * Median of `l3.aiUsd` across the active L4 Activity Group sample.
   * Field name retained for back-compat; semantically the L4 Activity Group
   * prize under V5.
   */
  medianL3Usd: number;
  /** $1M absolute floor below which an L4 Activity Group is never "high impact." */
  floorUsd: number;
  /** Effective threshold actually applied: max(median, floor). */
  thresholdUsd: number;
  /** Unique active L4 Activity Group count contributing to the median sample. */
  activeL3Count: number;
  /** True when N < 4 active L4 Activity Groups — median is volatile at this scale. */
  medianVolatilityWarning: boolean;
  /** Sum of `attributedAiUsd` across initiatives the 2x2 dropped to Deprioritized. */
  deprioritizedAiUsd: number;
  /** Count of initiatives the 2x2 dropped to Deprioritized. */
  deprioritizedCount: number;
};

export type SelectProgramResult = {
  /** Curated initiative roster (in-plan only — passes BOTH the 2x2 and the threshold). */
  initiatives: ProgramInitiativeRow[];
  /**
   * Initiatives the 2x2 routed to Deprioritized. Carried separately so the UI
   * can show a "below the line" panel without polluting the in-plan roster.
   * Threshold filter is NOT applied here — these are the rows the 2x2 itself
   * disqualified.
   */
  deprioritized: ProgramInitiativeRow[];
  /** Initiatives bucketed by deterministic 2x2 tier (in-plan rows only). */
  phases: {
    p1: PhaseBucket;
    p2: PhaseBucket;
    p3: PhaseBucket;
    deprioritized: PhaseBucket;
  };
  /** Towers contributing curated initiatives to the in-plan set. */
  towersInScope: TowerInScope[];
  /**
   * Program-wide modeled impact. `programImpact.ai` is the in-plan total
   * (sum of `attributedAiUsd` across `initiatives`) — so KPI tiles, Gantt
   * full-scale, and the chart all reconcile to the same in-plan number.
   * Other fields (weightedAiPct, opex, workforce) stay scenario-level.
   */
  programImpact: ProgramImpactSummary;
  /**
   * Per-initiative build/ramp/at-scale rows + 24-month run-rate series + tail
   * metadata. Single source of truth for the Gantt, run-rate chart, KPI strip
   * M24 tile, and BuildScaleSummary. Built from in-plan initiatives only —
   * Deprioritized rows are never sequenced.
   */
  buildScale: BuildScaleResult;
  /**
   * 24 monthly $ points for the value buildup chart. Derived from
   * `buildScale.monthly` so legacy consumers stay stable.
   */
  valueBuildup: ValueBuildupPoint[];
  /** Aggregated architecture rollup across the in-plan Processes. */
  architecture: ProgramArchitecture;
  /** Threshold metadata — what's been deferred by the dollar floor. */
  threshold: PlanThreshold;
  /** 2x2 diagnostics — drives the median / volatility surface in the KPI strip. */
  programTierDiagnostics: ProgramTierDiagnostics;
  /** Hash of the deterministic input — used as the LLM cache key. */
  inputHash: string;
};

export type SelectProgramOptions = {
  /**
   * Minimum parent-L4 Activity Group `aiUsd` (L4 Activity Group prize) an
   * initiative's parent L4 Activity Group must clear to be in plan. L5
   * Activities rolling up to a smaller-prize L4 Activity Group are dropped
   * from `initiatives`, `phases`, `buildScale`, `architecture`, and the
   * LLM input — they're treated as opportunistic, not part of the
   * cross-tower plan. Operates at L4 Activity Group grain so it stays
   * compatible with the 2x2 (which also classifies on `l3.aiUsd`, where
   * `l3` is the V4 field name preserved for back-compat). Default: 0
   * (no filter).
   */
  aiUsdThreshold?: number;
};

// ===========================================================================
//   Public selector
// ===========================================================================

/**
 * Build the cross-tower AI plan substrate for one program state.
 *
 * Pure function of `(program, options)`. Loops `towers` (the canonical 13) and
 * reuses `selectInitiativesForTower` per tower so every $ flows through the
 * same pipeline as `/summary`, the per-tower roadmap, and
 * `programImpactSummary`.
 *
 * `options.aiUsdThreshold` filters the surfaced initiatives to those whose
 * **parent-L4 Activity Group prize** clears the threshold — anything rolling
 * up to a smaller L4 Activity Group is opportunistic and not part of the
 * plan. Same grain as the 2x2 so the two signals don't conflict. The
 * downstream computations (phases, buildScale, architecture,
 * programImpact.ai, inputHash) are all recomputed from the post-filter set
 * so the page reconciles end-to-end.
 */
export function selectInitiativesForProgram(
  program: AssessProgramV2,
  options: SelectProgramOptions = {},
): SelectProgramResult {
  const aiUsdThreshold = Math.max(0, options.aiUsdThreshold ?? 0);
  const allInitiatives: ProgramInitiativeRow[] = [];
  const allTowersInScope: TowerInScope[] = [];

  for (const tower of towers) {
    const result: SelectInitiativesResult = selectInitiativesForTower(
      tower.id as TowerId,
      program,
      tower,
    );
    let towerInitiativeCount = 0;
    for (const l2 of result.l2s) {
      for (const l3 of l2.l3s) {
        // Even-split attribution across non-placeholder L4s in this L3. The
        // L3 carries the modeled $; the L4s within an L3 are typically
        // substitute approaches or sequential phases of the same capability.
        // Splitting evenly avoids over-claiming any one path and is the only
        // defensible attribution given the L3-level $ source.
        const surfacedL4Count = l3.l4s.filter((x) => !x.isPlaceholder).length;
        const attributedAiUsd =
          surfacedL4Count > 0 ? l3.aiUsd / surfacedL4Count : 0;
        for (const l4 of l3.l4s) {
          if (l4.isPlaceholder) continue;
          // Surface real curated rows only — placeholders carry no plan value.
          const initiative = resolveInitiativeProcess(tower, l4);
          allInitiatives.push({
            id: l4.initiativeId ?? l4.briefSlug ?? `${tower.id}:${l3.rowId}:${l4.id}`,
            towerId: tower.id as TowerId,
            towerName: tower.name,
            // Prefer the AI-initiative-style headline ("what AI does") over
            // the underlying activity label so cross-tower views read as a
            // plan of initiatives rather than a list of activities. Falls
            // back to the L5 name when no initiativeName was emitted.
            name: l4.initiativeName ?? l4.name,
            l2Name: l3.l2Name,
            l3Name: l3.l3.name,
            aiPriority: l4.aiPriority,
            // Tiering is stamped in a second pass once we have the full
            // sample — placeholder values here, overwritten by
            // `computeProgramTiers()` below.
            programTier: "Deprioritized",
            programTierReason: "",
            tier: null,
            aiRationale: l4.aiRationale,
            aiUsd: l3.aiUsd,
            attributedAiUsd,
            initiativeId: l4.initiativeId,
            briefSlug: l4.briefSlug,
            initiative,
            l4,
            l3,
          });
          towerInitiativeCount += 1;
        }
      }
    }
    if (result.towerAiUsd > 0 || towerInitiativeCount > 0) {
      allTowersInScope.push({
        id: tower.id as TowerId,
        name: tower.name,
        aiUsd: result.towerAiUsd,
        initiativeCount: towerInitiativeCount,
      });
    }
  }

  // ---- 2x2 program tiering --------------------------------------------------
  //
  // Stamp every initiative with `programTier` + `programTierReason` based on
  // (feasibility, parent-L4 Activity Group business impact). Sample is the
  // FULL post-tower scan — pre-threshold — so the threshold doesn't change
  // which Activity Groups define the median. Otherwise, lowering the
  // threshold would re-shuffle tier assignments unrelated to the threshold's
  // purpose.
  const tierResult = computeProgramTiers(
    allInitiatives.map((r) => ({
      id: r.id,
      l3RowId: r.l3.rowId,
      l3AiUsd: r.aiUsd,
      feasibility: r.l4.feasibility,
    })),
  );
  for (const r of allInitiatives) {
    const pt = tierResult.tierById.get(r.id) ?? "Deprioritized";
    r.programTier = pt;
    r.programTierReason =
      tierResult.reasonById.get(r.id) ??
      "Deprioritized — tiering input missing.";
    r.tier = tierFromProgramTier(pt);
  }

  // Deterministic ranking — by ProgramTier (P1 > P2 > P3 > Deprioritized),
  // then by AI $ desc, then alphabetically by tower then initiative name.
  // The LLM ranks within this surface; this initial order is the fallback
  // the page renders before a generation completes.
  allInitiatives.sort((a, b) => {
    const tierDelta = programTierRank(a.programTier) - programTierRank(b.programTier);
    if (tierDelta !== 0) return tierDelta;
    const usdDelta = b.attributedAiUsd - a.attributedAiUsd;
    if (Math.abs(usdDelta) > 1) return usdDelta;
    const towerDelta = a.towerName.localeCompare(b.towerName);
    if (towerDelta !== 0) return towerDelta;
    return a.name.localeCompare(b.name);
  });

  // ---- 2x2 + threshold split ------------------------------------------------
  //
  // Two distinct exclusion paths, both at the SAME grain (parent L4 Activity
  // Group prize):
  //
  //   a) `programTier === "Deprioritized"`     — 2x2 dropped this row
  //                                              (LF + L4 Activity Group
  //                                              prize below max(median,
  //                                              $1M floor)).
  //   b) parent `l3.aiUsd < aiUsdThreshold`    — dollar threshold dropped it
  //                                              (L4 Activity Group prize too
  //                                              small to warrant cross-tower
  //                                              track). `l3.aiUsd` field
  //                                              name retained from V4.
  //
  // The threshold operates on `r.aiUsd` (the full L4 Activity Group prize),
  // NOT on `r.attributedAiUsd` (the even-split per-L5 Activity attribution).
  // Filtering on the post-split number was structurally killing P2 — by
  // definition P2 is HF + LBI, which means the L4 Activity Group sits just
  // below the median; once that L4 is sliced across 2-4 L5 children, every
  // per-L5 number lands well under any reasonable threshold and the entire
  // P2 column went empty.
  //
  // The KPI strip surfaces both buckets so the executive can see what's
  // excluded for which reason. `excludedAiUsd` is reported as the rolled-up
  // attributed-$ sum, which (because even-split rolls back up cleanly) equals
  // the sum of the dropped L4 Activity Group prizes — the number stays
  // meaningful.
  const deprioritized = allInitiatives.filter(
    (r) => r.programTier === "Deprioritized",
  );
  const aboveLine = allInitiatives.filter(
    (r) => r.programTier !== "Deprioritized",
  );
  const initiatives = aboveLine.filter(
    (r) => r.aiUsd >= aiUsdThreshold,
  );
  const belowThreshold = aboveLine.filter(
    (r) => r.aiUsd < aiUsdThreshold,
  );
  const belowThresholdAiUsd = belowThreshold.reduce(
    (s, r) => s + r.attributedAiUsd,
    0,
  );
  const deprioritizedAiUsd = deprioritized.reduce(
    (s, r) => s + r.attributedAiUsd,
    0,
  );

  const inPlanTowerIds = new Set(initiatives.map((r) => r.towerId));
  const towersInScope = allTowersInScope
    .filter((t) => inPlanTowerIds.has(t.id))
    .map((t) => ({
      ...t,
      initiativeCount: initiatives.filter((r) => r.towerId === t.id).length,
    }));
  const excludedTowerCount = allTowersInScope.length - towersInScope.length;
  const threshold: PlanThreshold = {
    aiUsdThreshold,
    excludedCount: belowThreshold.length,
    excludedAiUsd: belowThresholdAiUsd,
    excludedTowerCount,
  };

  const phases = bucketByPhase(initiatives, deprioritized);
  const scenarioImpact = programImpactSummary(program);
  // Recompute `programImpact.ai` from in-plan rows (post-2x2 + post-threshold)
  // so KPI tiles, Gantt full-scale, and the chart all reconcile to the same
  // in-plan number. Other fields stay scenario-level.
  const inPlanAiTotal = initiatives.reduce(
    (s, r) => s + r.attributedAiUsd,
    0,
  );
  const programImpact: ProgramImpactSummary = {
    ...scenarioImpact,
    ai: inPlanAiTotal,
  };
  const buildScale = computeBuildScale(
    initiatives.map(toBuildScaleInputRow),
    programImpact,
  );
  const valueBuildup = monthlyToValueBuildup(buildScale);
  const architecture = aggregateArchitecture(initiatives);

  const programTierDiagnostics: ProgramTierDiagnostics = {
    medianL3Usd: tierResult.medianL3Usd,
    floorUsd: tierResult.floorUsd,
    thresholdUsd: tierResult.thresholdUsd,
    activeL3Count: tierResult.activeL3Count,
    medianVolatilityWarning: tierResult.medianVolatilityWarning,
    deprioritizedAiUsd,
    deprioritizedCount: deprioritized.length,
  };

  // Dev-mode invariants — every in-plan initiative must carry a real
  // ProgramTier (P1/P2/P3, never Deprioritized in `initiatives`); every
  // Deprioritized row must NOT appear in `initiatives`.
  if (process.env.NODE_ENV !== "production") {
    assertProgramTierConsistency({
      initiatives,
      deprioritized,
      diagnostics: programTierDiagnostics,
    });
  }

  return {
    initiatives,
    deprioritized,
    phases,
    towersInScope,
    programImpact,
    buildScale,
    valueBuildup,
    architecture,
    threshold,
    programTierDiagnostics,
    inputHash: hashProgramInput({
      initiatives,
      programImpact,
      towersInScope,
      aiUsdThreshold,
    }),
  };
}

function toBuildScaleInputRow(row: ProgramInitiativeRow): BuildScaleInputRow {
  return {
    id: row.id,
    name: row.name,
    towerId: row.towerId,
    towerName: row.towerName,
    programTier: row.programTier,
    attributedAiUsd: row.attributedAiUsd,
    timelineMonths: row.initiative?.timelineMonths,
  };
}

/**
 * Translate the per-month run-rate series into the legacy `ValueBuildupPoint`
 * shape so existing chart consumers keep rendering. The semantics are now
 * "in-month modeled run-rate" rather than a phase-ramp cumulative — which
 * matches what the chart label has always claimed ("Modeled AI run-rate").
 *
 * `activeTier` is computed by inspecting which phase is currently *driving*
 * the curve at month m: the latest P1/P2/P3 phase whose build-start month
 * (from `PHASE_START_MONTHS`) is <= m — same boundary logic as Cross-Tower
 * program charts, derived from a single constant source.
 */
function activeTierForProgramMonth(month: number): "P1" | "P2" | "P3" {
  const p2 = PHASE_START_MONTHS.P2;
  const p3 = PHASE_START_MONTHS.P3;
  if (month >= p3) return "P3";
  if (month >= p2) return "P2";
  return "P1";
}

function monthlyToValueBuildup(buildScale: BuildScaleResult): ValueBuildupPoint[] {
  return buildScale.monthly.map(({ month, runRateAiUsd }) => ({
    month,
    cumulativeAiUsd: runRateAiUsd,
    activeTier: activeTierForProgramMonth(month),
  }));
}

// ===========================================================================
//   Helpers
// ===========================================================================

function resolveInitiativeProcess(
  tower: Tower,
  l4: InitiativeL4,
): Process | undefined {
  if (!l4.initiativeId) return undefined;
  // Reuse the same overlay-aware resolver used by `select.ts` so we don't
  // surface an initiative that the overlay doesn't want exposed (e.g. a
  // sub-process row tagged "related" instead of "primary").
  const tp = tower.workCategories
    .flatMap((c) => c.processes)
    .find((p) => p.aiInitiativeId === l4.initiativeId);
  if (!tp) {
    // Fall back to a direct lookup — the overlay row may not exist on the L4
    // composer path, but the underlying Process is the same instance the
    // tower page renders.
    return tower.processes.find((p) => p.id === l4.initiativeId);
  }
  return findAiInitiative(tower, tp);
}

function bucketByPhase(
  inPlan: ProgramInitiativeRow[],
  deprioritized: ProgramInitiativeRow[],
): SelectProgramResult["phases"] {
  const buckets: Record<ProgramTier, ProgramInitiativeRow[]> = {
    P1: [],
    P2: [],
    P3: [],
    Deprioritized: [],
  };
  for (const init of inPlan) {
    if (init.programTier === "Deprioritized") continue;
    buckets[init.programTier].push(init);
  }
  // Deprioritized bucket is tracked separately because the in-plan filter
  // already strips it — pass through directly.
  buckets.Deprioritized = deprioritized.slice();
  return {
    p1: makePhaseBucket("P1", buckets.P1),
    p2: makePhaseBucket("P2", buckets.P2),
    p3: makePhaseBucket("P3", buckets.P3),
    deprioritized: makePhaseBucket("Deprioritized", buckets.Deprioritized),
  };
}

function makePhaseBucket(
  programTier: ProgramTier,
  initiatives: ProgramInitiativeRow[],
): PhaseBucket {
  const label = programTierLabel(programTier);
  return {
    tier: tierFromProgramTier(programTier),
    programTier,
    label: label.axisLabel,
    window: label.longLabel,
    initiatives,
    aiUsd: initiatives.reduce((s, i) => s + i.attributedAiUsd, 0),
  };
}

function aggregateArchitecture(
  initiatives: ProgramInitiativeRow[],
): ProgramArchitecture {
  const orchMap = new Map<AgentOrchestration["pattern"], number>();
  const agentMap = new Map<AgentTypeMix["type"], number>();
  const vendorMap = new Map<string, number>();
  let totalAgents = 0;

  // Track Processes once even when surfaced under multiple L4s, so a single
  // initiative doesn't double-count its agents/vendors in the rollup.
  const seenProcessIds = new Set<string>();
  for (const init of initiatives) {
    const p = init.initiative;
    if (!p) continue;
    if (seenProcessIds.has(p.id)) continue;
    seenProcessIds.add(p.id);

    const pattern = p.agentOrchestration.pattern;
    orchMap.set(pattern, (orchMap.get(pattern) ?? 0) + 1);

    for (const agent of p.agents) {
      totalAgents += 1;
      agentMap.set(agent.type, (agentMap.get(agent.type) ?? 0) + 1);
      for (const tool of agent.toolsUsed ?? []) {
        bumpVendor(vendorMap, tool);
      }
    }

    // Workbench post-state tools — the named vendor stack the initiative
    // converges on. We deliberately use `post` (target state), not `pre`.
    for (const t of p.workbench.post) {
      bumpVendor(vendorMap, t.tool);
    }
    // Required platforms named on the digital core lens.
    for (const plat of p.digitalCore.requiredPlatforms) {
      bumpVendor(vendorMap, plat.platform);
      for (const ex of plat.examples ?? []) bumpVendor(vendorMap, ex);
    }
  }

  const orchestrationMix: OrchestrationMix[] = (
    [
      "Pipeline",
      "Hub-and-Spoke",
      "Parallel",
      "Sequential",
      "Hierarchical",
    ] as const
  )
    .map((pattern) => ({ pattern, count: orchMap.get(pattern) ?? 0 }))
    .filter((row) => row.count > 0);

  const agentTypeMix: AgentTypeMix[] = (
    ["Orchestrator", "Specialist", "Monitor", "Router", "Executor"] as const
  )
    .map((type) => ({ type, count: agentMap.get(type) ?? 0 }))
    .filter((row) => row.count > 0);

  const vendorStack: VendorStackEntry[] = Array.from(vendorMap.entries())
    .map(([vendor, count]) => ({ vendor, count }))
    .sort((a, b) => b.count - a.count || a.vendor.localeCompare(b.vendor))
    .slice(0, 12);

  return { orchestrationMix, agentTypeMix, vendorStack, totalAgents };
}

function bumpVendor(map: Map<string, number>, raw: string): void {
  if (!raw) return;
  const trimmed = raw.trim();
  // Reject obvious noise — generic tokens like "TBD", "manual", "n/a".
  if (!trimmed) return;
  const lower = trimmed.toLowerCase();
  if (
    lower === "tbd" ||
    lower === "tbd — subject to discovery" ||
    lower === "manual" ||
    lower === "n/a" ||
    lower === "none"
  ) {
    return;
  }
  map.set(trimmed, (map.get(trimmed) ?? 0) + 1);
}

/**
 * Build a stable, content-derived hash for the deterministic input the LLM
 * grounds against. Used as part of the cache key so two clients running the
 * same scenario hit the same cached plan.
 */
function hashProgramInput(input: {
  initiatives: ProgramInitiativeRow[];
  programImpact: ProgramImpactSummary;
  towersInScope: TowerInScope[];
  aiUsdThreshold: number;
}): string {
  // Capture only the fields the LLM actually grounds against. We deliberately
  // round AI $ to the nearest $1k so jitter from floating-point recombination
  // doesn't bust the cache for what is the same scenario.
  const compact = {
    init: input.initiatives.map((r) => ({
      i: r.id,
      t: r.towerId,
      n: r.name,
      // Hash on programTier (the active priority signal); legacy aiPriority
      // would key the cache against a deprecated field and give us false
      // cache hits across the migration.
      p: r.programTier,
      u: Math.round(r.attributedAiUsd / 1000),
    })),
    impact: {
      ai: Math.round(input.programImpact.ai / 1000),
      pool: Math.round(input.programImpact.totalPool / 1000),
      pct: Math.round(input.programImpact.weightedAiPct * 100) / 100,
    },
    towers: input.towersInScope.map((t) => ({ id: t.id, c: t.initiativeCount })),
    // Threshold (rounded to nearest $1k). Different thresholds → different
    // in-plan sets → different cached LLM plans.
    th: Math.round(input.aiUsdThreshold / 1000),
  };
  return djb2(JSON.stringify(compact));
}

/** Tiny, dependency-free string hash. Good enough for cache keys. */
function djb2(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  }
  // Format as unsigned base-36 to keep keys short and url-safe.
  return (h >>> 0).toString(36);
}

/**
 * Dev-mode invariant check — every row must land in exactly one of the
 * `initiatives` (P1/P2/P3) or `deprioritized` lists, never both, and the
 * 2x2 must produce real labels (no empty `programTierReason`).
 *
 * Throws in development; silent in production.
 */
function assertProgramTierConsistency(args: {
  initiatives: ProgramInitiativeRow[];
  deprioritized: ProgramInitiativeRow[];
  diagnostics: ProgramTierDiagnostics;
}): void {
  const { initiatives, deprioritized } = args;
  const inPlanIds = new Set(initiatives.map((r) => r.id));
  const depIds = new Set(deprioritized.map((r) => r.id));

  for (const r of initiatives) {
    if (r.programTier === "Deprioritized") {
      throw new Error(
        `[forge.selectProgram] In-plan row "${r.id}" carries programTier="Deprioritized" — bucketing logic regression.`,
      );
    }
    if (!r.programTierReason) {
      throw new Error(
        `[forge.selectProgram] In-plan row "${r.id}" has empty programTierReason — programTier output dropped on the floor.`,
      );
    }
  }
  for (const r of deprioritized) {
    if (r.programTier !== "Deprioritized") {
      throw new Error(
        `[forge.selectProgram] Deprioritized row "${r.id}" carries programTier="${r.programTier}" — bucketing logic regression.`,
      );
    }
    if (inPlanIds.has(r.id)) {
      throw new Error(
        `[forge.selectProgram] Row "${r.id}" appears in both initiatives + deprioritized lists.`,
      );
    }
  }
  // Floor sanity — should match the constant exposed by programTier.ts.
  if (args.diagnostics.floorUsd !== BUSINESS_IMPACT_FLOOR_USD) {
    throw new Error(
      `[forge.selectProgram] floorUsd diagnostic (${args.diagnostics.floorUsd}) doesn't match BUSINESS_IMPACT_FLOOR_USD (${BUSINESS_IMPACT_FLOOR_USD}).`,
    );
  }
  // Cross-check the `depIds` set is internally consistent (no dup ids).
  if (depIds.size !== deprioritized.length) {
    throw new Error(
      `[forge.selectProgram] Deprioritized list has duplicate ids — selector dedup regression.`,
    );
  }
}
