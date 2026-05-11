/**
 * Cross-Tower AI Plan — program-level selector.
 *
 * AI initiatives are authored at L3 Job Family grain — there is no
 * L4-cohort consolidation step. This selector fans out
 * `selectInitiativesV6ForTower` across every tower, flattens each
 * tower's `V6L3Row.initiatives` into a single program roster, then runs:
 *
 *   - **Deterministic 2x2 program tier** via `computeProgramTiers`, where
 *     "business impact" is the L3 row's modeled $ and "feasibility" is the
 *     `L3Initiative.feasibility` flag the curator already authored.
 *   - **24-month build-scale** via `computeBuildScale` over the in-plan
 *     initiatives — phase windows from `programTier`.
 *   - **Threshold filter** at the L3-row $ grain so a sibling-initiative
 *     pair on the same row can't be half-included by accident.
 *
 * What this selector deliberately does not produce:
 *   - `architecture` orchestration mix / agent-fleet rollups — these read
 *     from `Process.agents`/`Process.workbench`, which only exist after the
 *     deep-dive page generates a Process for an initiative on first click.
 *     Returns empty arrays; ProgramArchitecturePanel renders the LLM
 *     synthesis text and a vendor count derived from `primaryVendor` chips.
 *   - Deeply nested per-initiative L4/L5 view-models. The L3 row is a
 *     clean, flat record — anyone who needs the full L3Initiative
 *     deep-dive opens it via
 *     `/tower/<towerId>/initiative/<l3RowId>/<id>`.
 */
import type { ProgramTier, ImpactTier } from "@/data/types";
import type { Feasibility } from "@/data/types";
import type { AssessProgramV2, TowerId } from "@/data/assess/types";
import { towers } from "@/data/towers";
import { selectInitiativesV6ForTower } from "@/lib/initiatives/selectV6";
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
  type BuildScaleResult,
  type BuildScaleInputRow,
} from "@/lib/initiatives/buildScaleModel";
import type {
  PhaseBucket,
  PlanThreshold,
  ProgramArchitecture,
  ProgramTierDiagnostics,
  TowerInScope,
  ValueBuildupPoint,
  SelectProgramOptions,
} from "@/lib/initiatives/programTypes";

// ===========================================================================
//   View-model types (V6)
// ===========================================================================

/**
 * Flat program-level row — one entry per non-placeholder L3 initiative.
 * Anyone who needs the full L3Initiative deep-dive opens it via
 * `/tower/<towerId>/initiative/<l3RowId>/<id>`.
 */
export type ProgramInitiativeRowV6 = {
  /** `L3Initiative.id` — stable across re-curations. */
  id: string;
  towerId: TowerId;
  towerName: string;
  /** `L3WorkforceRowV6.id` — the dial-bearing row this initiative attaches to. */
  l3RowId: string;
  /** L2 Job Grouping. */
  l2Name: string;
  /** L3 Job Family display name. */
  l3Name: string;
  /** AI Solution name (the product Versant could build/buy). */
  solutionName: string;
  /** 1-line solution tagline. */
  tagline: string;
  /** Versant-grounded rationale (2-4 sentences). */
  aiRationale: string;
  /** Named primary vendor or short stack ("BlackLine + HighRadius"). */
  primaryVendor?: string;
  /** Binary ship-readiness — drives the cross-tower 2x2 effort axis. */
  feasibility: Feasibility;
  /**
   * Program-level priority from the deterministic 2x2 over
   * `(feasibility, parent-L3-row business impact)`. Always defined.
   */
  programTier: ProgramTier;
  /** Human-readable explanation of the tiering decision. */
  programTierReason: string;
  /** Visual `Tier` (`P1` / `P2` / `P3` / `null` for Deprioritized). */
  tier: Tier | null;
  /** Parent L3 row's modeled AI $ (the prize). */
  aiUsd: number;
  /**
   * Even-split share of `aiUsd` across non-placeholder initiatives on the
   * same L3 row. Sum across the program === `programImpactSummary(...).ai`.
   */
  attributedAiUsd: number;
  /**
   * `display tier` — useful for tooling that needs the legacy 3-tier
   * label. Same value as `tier` here.
   */
  aiPriority?: string;
  /** Compatibility bridge — most surfaces only need a single string, not a Process. */
  impactTier?: ImpactTier;
};

/**
 * Cross-tower selector result. The cross-tower client + downstream
 * modules read shared fields (`inputHash`, `threshold`, `programImpact`,
 * `phases`, `buildScale`, `valueBuildup`, etc.) directly off this shape.
 */
export type SelectProgramResultV6 = {
  initiatives: ProgramInitiativeRowV6[];
  deprioritized: ProgramInitiativeRowV6[];
  phases: {
    p1: PhaseBucketV6;
    p2: PhaseBucketV6;
    p3: PhaseBucketV6;
    deprioritized: PhaseBucketV6;
  };
  towersInScope: TowerInScope[];
  programImpact: ProgramImpactSummary;
  buildScale: BuildScaleResult;
  valueBuildup: ValueBuildupPoint[];
  /**
   * Architecture rollups. Empty under v6 (Process bodies live on
   * `L3Initiative.generatedProcess`, populated lazily by the deep-dive
   * page). `ProgramArchitecturePanel` falls back to LLM synthesis text +
   * a `primaryVendor` count it derives directly.
   */
  architecture: ProgramArchitecture;
  threshold: PlanThreshold;
  programTierDiagnostics: ProgramTierDiagnostics;
  inputHash: string;
};

export type PhaseBucketV6 = PhaseBucket & {
  initiatives: ProgramInitiativeRowV6[];
};

// ===========================================================================
//   Public selector
// ===========================================================================

export function selectInitiativesV6ForProgram(
  program: AssessProgramV2,
  options: SelectProgramOptions = {},
): SelectProgramResultV6 {
  const aiUsdThreshold = Math.max(0, options.aiUsdThreshold ?? 0);
  const allInitiatives: ProgramInitiativeRowV6[] = [];
  const allTowersInScope: TowerInScope[] = [];

  for (const tower of towers) {
    const result = selectInitiativesV6ForTower(
      tower.id as TowerId,
      program,
      tower,
    );
    let towerInitiativeCount = 0;
    for (const row of result.l3Rows) {
      const realInitiatives = row.initiatives.filter((i) => !i.isPlaceholder);
      const splitCount = realInitiatives.length;
      const attributedAiUsd =
        splitCount > 0 ? row.aiUsd / splitCount : row.aiUsd;
      for (const card of realInitiatives) {
        // Brief-first: initiatives without a stamped brief have no card.feasibility.
        // Tier conservatively as Low until curate-brief stamps Buy vs Build/Discover.
        const feasibilityForTier = card.feasibility ?? "Low";
        allInitiatives.push({
          id: card.id,
          towerId: tower.id as TowerId,
          towerName: tower.name,
          l3RowId: row.id,
          l2Name: row.l2,
          l3Name: row.l3,
          solutionName: card.solutionName,
          tagline: card.tagline,
          aiRationale: card.aiRationale,
          primaryVendor: card.primaryVendor,
          feasibility: feasibilityForTier,
          // Tier is stamped in the second pass once we have the full sample.
          programTier: "Deprioritized",
          programTierReason: "",
          tier: null,
          aiUsd: row.aiUsd,
          attributedAiUsd,
        });
        towerInitiativeCount += 1;
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
  const tierResult = computeProgramTiers(
    allInitiatives.map((r) => ({
      id: r.id,
      l3RowId: r.l3RowId,
      l3AiUsd: r.aiUsd,
      feasibility: r.feasibility,
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
  // then by attributed AI $ desc, then alphabetically by tower then name.
  allInitiatives.sort((a, b) => {
    const tierDelta =
      programTierRank(a.programTier) - programTierRank(b.programTier);
    if (tierDelta !== 0) return tierDelta;
    const usdDelta = b.attributedAiUsd - a.attributedAiUsd;
    if (Math.abs(usdDelta) > 1) return usdDelta;
    const towerDelta = a.towerName.localeCompare(b.towerName);
    if (towerDelta !== 0) return towerDelta;
    return a.solutionName.localeCompare(b.solutionName);
  });

  // ---- 2x2 + threshold split ------------------------------------------------
  // Two distinct exclusion paths, both at the L3-row $ grain (the prize):
  //   a) `programTier === "Deprioritized"`     — 2x2 dropped this row
  //   b) parent `aiUsd < aiUsdThreshold`       — dollar threshold dropped it
  const deprioritized = allInitiatives.filter(
    (r) => r.programTier === "Deprioritized",
  );
  const aboveLine = allInitiatives.filter(
    (r) => r.programTier !== "Deprioritized",
  );
  const initiatives = aboveLine.filter((r) => r.aiUsd >= aiUsdThreshold);
  const belowThreshold = aboveLine.filter((r) => r.aiUsd < aiUsdThreshold);
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

  // V6 architecture rollups intentionally empty — see file-level docs.
  const architecture: ProgramArchitecture = {
    orchestrationMix: [],
    agentTypeMix: [],
    vendorStack: [],
    totalAgents: 0,
  };

  const programTierDiagnostics: ProgramTierDiagnostics = {
    medianL3Usd: tierResult.medianL3Usd,
    floorUsd: tierResult.floorUsd,
    thresholdUsd: tierResult.thresholdUsd,
    activeL3Count: tierResult.activeL3Count,
    medianVolatilityWarning: tierResult.medianVolatilityWarning,
    deprioritizedAiUsd,
    deprioritizedCount: deprioritized.length,
  };

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

function toBuildScaleInputRow(row: ProgramInitiativeRowV6): BuildScaleInputRow {
  return {
    id: row.id,
    name: row.solutionName,
    towerId: row.towerId,
    towerName: row.towerName,
    programTier: row.programTier,
    attributedAiUsd: row.attributedAiUsd,
    // No Process.timelineMonths under v6 — defaults from phase apply.
  };
}

// ---------------------------------------------------------------------------
//   Phase buckets
// ---------------------------------------------------------------------------

function bucketByPhase(
  inPlan: ProgramInitiativeRowV6[],
  deprioritized: ProgramInitiativeRowV6[],
): SelectProgramResultV6["phases"] {
  const buckets: Record<ProgramTier, ProgramInitiativeRowV6[]> = {
    P1: [],
    P2: [],
    P3: [],
    Deprioritized: [],
  };
  for (const init of inPlan) {
    if (init.programTier === "Deprioritized") continue;
    buckets[init.programTier].push(init);
  }
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
  initiatives: ProgramInitiativeRowV6[],
): PhaseBucketV6 {
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

// ---------------------------------------------------------------------------
//   Value buildup — translates monthly run-rate into the legacy point shape
// ---------------------------------------------------------------------------

import { PHASE_START_MONTHS } from "@/lib/initiatives/buildScaleModel";

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

// ---------------------------------------------------------------------------
//   Hash / diagnostics
// ---------------------------------------------------------------------------

function hashProgramInput(input: {
  initiatives: ProgramInitiativeRowV6[];
  programImpact: ProgramImpactSummary;
  towersInScope: TowerInScope[];
  aiUsdThreshold: number;
}): string {
  const compact = {
    init: input.initiatives.map((r) => ({
      i: r.id,
      t: r.towerId,
      n: r.solutionName,
      p: r.programTier,
      f: r.feasibility,
      u: Math.round(r.attributedAiUsd / 1000),
    })),
    impact: {
      ai: Math.round(input.programImpact.ai / 1000),
      pool: Math.round(input.programImpact.totalPool / 1000),
      pct: Math.round(input.programImpact.weightedAiPct * 100) / 100,
    },
    towers: input.towersInScope.map((t) => ({
      id: t.id,
      c: t.initiativeCount,
    })),
    th: Math.round(input.aiUsdThreshold / 1000),
    schema: "v6",
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

// Avoid unused-import linter warnings on `BUSINESS_IMPACT_FLOOR_USD`. Kept
// imported because dev-mode invariant assertions in callers compare against
// the constant we use through `programTier.ts`.
void BUSINESS_IMPACT_FLOOR_USD;
