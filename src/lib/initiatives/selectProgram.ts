/**
 * Cross-Tower AI Plan — program-level selector.
 *
 * Pure function that loops every Versant tower and assembles the deterministic
 * substrate for the Cross-Tower AI Plan page (`/program/cross-tower-ai-plan`):
 *
 *   - Ranked initiative roster across the 13 towers (used as the LLM's
 *     selection ground truth — the model picks from this list, can't invent).
 *   - Phase buckets (P1 / P2 / P3) via `priorityTier()`. Phase membership is
 *     deterministic; the LLM is not allowed to move an initiative across
 *     phases. P1 = 0–6mo, P2 = 6–12mo, P3 = 12–24mo.
 *   - 24-month cumulative modeled $ buildup, ramped per phase from
 *     `programImpactSummary`. Numbers are entirely deterministic.
 *   - Architecture roll-up: orchestration pattern mix, agent type mix, and a
 *     deduped vendor stack drawn from `Process.workbench.post` + named
 *     vendors on agent toolsUsed.
 *   - Tower-in-scope set: every tower that contributes a non-zero AI $ pool.
 *
 * Routes every $ through `selectInitiativesForTower` + `programImpactSummary`
 * — no new arithmetic. Mirrors the financial-integrity contract documented at
 * the top of `select.ts`.
 */
import type { AgentOrchestration, Process, Tower } from "@/data/types";
import type { AssessProgramV2, TowerId } from "@/data/assess/types";
import { towers } from "@/data/towers";
import {
  selectInitiativesForTower,
  type InitiativeL3,
  type InitiativeL4,
  type SelectInitiativesResult,
} from "@/lib/initiatives/select";
import { findAiInitiative } from "@/lib/utils";
import { priorityTier, type Tier } from "@/lib/priority";
import {
  programImpactSummary,
  type ProgramImpactSummary,
} from "@/lib/assess/scenarioModel";
import {
  computeBuildScale,
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
  /** L2 / L3 capability path, denormalized for one-line rendering. */
  l2Name: string;
  l3Name: string;
  /** Full priority string (e.g. "P1 — Immediate (0-6mo)") for chips/badges. */
  aiPriority?: string;
  /** Normalized tier — `null` only when the L4 has no priority assigned. */
  tier: Tier | null;
  /** Versant-grounded rationale (short). */
  aiRationale?: string;
  /** Per-L3 modeled AI $ this initiative contributes to (deterministic). */
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
  tier: Tier;
  /** Display label, e.g. "P1 — Immediate (0-6mo)". */
  label: string;
  /** Time window string, e.g. "0–6 months". */
  window: string;
  /** Initiatives whose deterministic priority lands in this phase. */
  initiatives: ProgramInitiativeRow[];
  /** Sum of `aiUsd` across initiatives in this phase. */
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
 * Plan threshold metadata — surfaces what was filtered out so the page can
 * honestly show "in plan" vs "opportunistic / below threshold". When
 * `aiUsdThreshold === 0`, no filter applied and `excluded*` are zero.
 */
export type PlanThreshold = {
  /** Minimum `attributedAiUsd` for an initiative to be in plan. */
  aiUsdThreshold: number;
  /** Initiatives dropped because they fell below the threshold. */
  excludedCount: number;
  /** Sum of `attributedAiUsd` for the dropped initiatives. */
  excludedAiUsd: number;
  /** Towers that lost their last initiative because of the threshold. */
  excludedTowerCount: number;
};

export type SelectProgramResult = {
  /** Curated initiative roster (post-threshold filter). */
  initiatives: ProgramInitiativeRow[];
  /** Initiatives bucketed by deterministic priority tier. */
  phases: { p1: PhaseBucket; p2: PhaseBucket; p3: PhaseBucket };
  /** Towers contributing curated initiatives to the in-plan set. */
  towersInScope: TowerInScope[];
  /**
   * Program-wide modeled impact. `programImpact.ai` is the in-plan total
   * (sum of `attributedAiUsd` across `initiatives`) when a threshold is
   * active — so KPI tiles, Gantt full-scale, and the chart all reconcile to
   * the same in-plan number. Other fields (weightedAiPct, opex, workforce)
   * stay scenario-level and are unaffected by the threshold.
   */
  programImpact: ProgramImpactSummary;
  /**
   * Per-initiative build/ramp/at-scale rows + 24-month run-rate series + tail
   * metadata. Single source of truth for the Gantt, run-rate chart, KPI strip
   * M24 tile, and BuildScaleSummary.
   */
  buildScale: BuildScaleResult;
  /**
   * 24 monthly $ points for the value buildup chart. Derived from
   * `buildScale.monthly` so legacy consumers stay stable.
   */
  valueBuildup: ValueBuildupPoint[];
  /** Aggregated architecture rollup across the in-scope Processes. */
  architecture: ProgramArchitecture;
  /** Threshold metadata — what's in plan, what's been deferred. */
  threshold: PlanThreshold;
  /** Hash of the deterministic input — used as the LLM cache key. */
  inputHash: string;
};

export type SelectProgramOptions = {
  /**
   * Minimum `attributedAiUsd` an initiative must clear to be in plan.
   * Initiatives below this are dropped from `initiatives`, `phases`,
   * `buildScale`, `architecture`, and the LLM input — they're treated as
   * opportunistic, not part of the cross-tower plan. Default: 0 (no filter).
   */
  aiUsdThreshold?: number;
};

// ===========================================================================
//   Public selector
// ===========================================================================

/** Display window strings — kept in lockstep with `priority.TIER_META`. */
const PHASE_WINDOWS: Record<Tier, string> = {
  P1: "0–6 months",
  P2: "6–12 months",
  P3: "12–24 months",
};

const PHASE_LABELS: Record<Tier, string> = {
  P1: "P1 — Immediate (0-6mo)",
  P2: "P2 — Near-term (6-12mo)",
  P3: "P3 — Medium-term (12-24mo)",
};

/**
 * Build the cross-tower AI plan substrate for one program state.
 *
 * Pure function of `(program, options)`. Loops `towers` (the canonical 13) and
 * reuses `selectInitiativesForTower` per tower so every $ flows through the
 * same pipeline as `/summary`, the per-tower roadmap, and
 * `programImpactSummary`.
 *
 * `options.aiUsdThreshold` filters the surfaced initiatives to those whose
 * even-split per-L4 attribution clears the threshold — anything below is
 * opportunistic and not part of the plan. The downstream computations
 * (phases, buildScale, architecture, programImpact.ai, inputHash) are all
 * recomputed from the post-filter set so the page reconciles end-to-end.
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
          const tier = priorityTier(l4.aiPriority);
          // Surface real curated rows only — placeholders carry no plan value.
          const initiative = resolveInitiativeProcess(tower, l4);
          allInitiatives.push({
            id: l4.initiativeId ?? l4.briefSlug ?? `${tower.id}:${l3.rowId}:${l4.id}`,
            towerId: tower.id as TowerId,
            towerName: tower.name,
            name: l4.name,
            l2Name: l3.l2Name,
            l3Name: l3.l3.name,
            aiPriority: l4.aiPriority,
            tier,
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

  // Deterministic ranking — by tier (P1 > P2 > P3 > unranked), then by AI $ desc,
  // then alphabetically by tower then initiative name. The LLM ranks within
  // this surface; this initial order is the fallback the page renders before
  // a generation completes.
  allInitiatives.sort((a, b) => {
    const tierDelta = tierRank(a.tier) - tierRank(b.tier);
    if (tierDelta !== 0) return tierDelta;
    const usdDelta = b.aiUsd - a.aiUsd;
    if (Math.abs(usdDelta) > 1) return usdDelta;
    const towerDelta = a.towerName.localeCompare(b.towerName);
    if (towerDelta !== 0) return towerDelta;
    return a.name.localeCompare(b.name);
  });

  // Apply the in-plan threshold. Initiatives below the floor are deferred as
  // opportunistic — they still exist in the data, but they're not in plan,
  // so they don't appear in the Gantt, KPI tiles, LLM input, or roadmap.
  const initiatives = allInitiatives.filter(
    (r) => r.attributedAiUsd >= aiUsdThreshold,
  );
  const excludedInitiatives = allInitiatives.filter(
    (r) => r.attributedAiUsd < aiUsdThreshold,
  );
  const excludedAiUsd = excludedInitiatives.reduce(
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
    excludedCount: excludedInitiatives.length,
    excludedAiUsd,
    excludedTowerCount,
  };

  const phases = bucketByPhase(initiatives);
  const scenarioImpact = programImpactSummary(program);
  // Override `programImpact.ai` with the in-plan total so KPI tiles, Gantt
  // full-scale, and the chart all reconcile to the same in-plan number when
  // a threshold is active. Other fields stay scenario-level.
  const inPlanAiTotal = initiatives.reduce(
    (s, r) => s + r.attributedAiUsd,
    0,
  );
  const programImpact: ProgramImpactSummary =
    aiUsdThreshold > 0
      ? { ...scenarioImpact, ai: inPlanAiTotal }
      : scenarioImpact;
  const buildScale = computeBuildScale(
    initiatives.map(toBuildScaleInputRow),
    programImpact,
  );
  const valueBuildup = monthlyToValueBuildup(buildScale);
  const architecture = aggregateArchitecture(initiatives);

  return {
    initiatives,
    phases,
    towersInScope,
    programImpact,
    buildScale,
    valueBuildup,
    architecture,
    threshold,
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
    tier: row.tier,
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
 * the curve at month m: the latest phase whose `phaseStartMonth <= m`. P3
 * after M13, P2 after M7, otherwise P1.
 */
function monthlyToValueBuildup(buildScale: BuildScaleResult): ValueBuildupPoint[] {
  return buildScale.monthly.map(({ month, runRateAiUsd }) => ({
    month,
    cumulativeAiUsd: runRateAiUsd,
    activeTier: month >= 13 ? "P3" : month >= 7 ? "P2" : "P1",
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

function tierRank(t: Tier | null): number {
  if (t === "P1") return 0;
  if (t === "P2") return 1;
  if (t === "P3") return 2;
  return 3;
}

function bucketByPhase(
  initiatives: ProgramInitiativeRow[],
): SelectProgramResult["phases"] {
  const buckets: Record<Tier, ProgramInitiativeRow[]> = {
    P1: [],
    P2: [],
    P3: [],
  };
  for (const init of initiatives) {
    if (init.tier === "P1" || init.tier === "P2" || init.tier === "P3") {
      buckets[init.tier].push(init);
    }
  }
  return {
    p1: makePhaseBucket("P1", buckets.P1),
    p2: makePhaseBucket("P2", buckets.P2),
    p3: makePhaseBucket("P3", buckets.P3),
  };
}

function makePhaseBucket(
  tier: Tier,
  initiatives: ProgramInitiativeRow[],
): PhaseBucket {
  return {
    tier,
    label: PHASE_LABELS[tier],
    window: PHASE_WINDOWS[tier],
    initiatives,
    aiUsd: initiatives.reduce((s, i) => s + i.aiUsd, 0),
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
      p: r.tier,
      u: Math.round(r.aiUsd / 1000),
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

