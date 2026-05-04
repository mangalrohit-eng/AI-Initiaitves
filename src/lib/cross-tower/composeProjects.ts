/**
 * Cross-Tower AI Plan v3 — deterministic project composition.
 *
 * Given:
 *   - the engine-built cohorts (the structural truth: L5 → L4),
 *   - the LLM-authored projects (or `null` per cohort on failure), and
 *   - the user's assumption knobs,
 *
 * produce the full `AIProjectResolved[]` view-model the UI renders.
 *
 * What lives here vs in the prompt:
 *
 *   - **Engine owns**: the cohort, the dollar rollup (`attributedAiUsd`),
 *     timing (start month, build months, value-start month), and the 2x2
 *     quadrant derivation.
 *   - **LLM owns**: project name, narrative, brief, value/effort buckets +
 *     rationales, agent fleet, dependsOn / risks / roadmap narrative
 *     (the synthesis layer).
 *
 * Stubs surface for cohorts where authoring failed. They render in the UI
 * with a muted card frame and a "retry this project" CTA — they never enter
 * the Gantt or the value buildup curve.
 */

import type {
  AIProjectLLM,
  AIProjectResolved,
  EffortBucket,
  EffortDriversLLM,
  L4Cohort,
  Quadrant,
  ValueBucket,
} from "@/lib/cross-tower/aiProjects";
import { projectIdFor } from "@/lib/cross-tower/aiProjects";
import type { CrossTowerAssumptions } from "@/lib/cross-tower/assumptions";
import type { ProgramInitiativeRow } from "@/lib/initiatives/selectProgram";
import type { CohortStatus } from "@/lib/llm/crossTowerPlanLLM";

export type ComposeProjectsInput = {
  cohorts: L4Cohort[];
  projects: AIProjectLLM[];
  cohortStatus: CohortStatus[];
  initiativesById: Map<string, ProgramInitiativeRow>;
  assumptions: CrossTowerAssumptions;
};

export function composeProjects(input: ComposeProjectsInput): AIProjectResolved[] {
  const { cohorts, projects, cohortStatus, initiativesById, assumptions } = input;
  const projectByCohortId = new Map<string, AIProjectLLM>();
  for (const p of projects) projectByCohortId.set(p.parentL4ActivityGroupId, p);
  const statusByCohortId = new Map<string, CohortStatus>();
  for (const s of cohortStatus) statusByCohortId.set(s.l4RowId, s);

  // -------------------------------------------------------------------------
  //  Portfolio-level median split for Value × Effort buckets.
  //
  //  Why this lives here and not in the prompt:
  //  Each cohort is authored in its own LLM call with no peer context, so the
  //  model rates almost every project as High value / Low effort in isolation.
  //  That collapses the 2×2 to one quadrant. Splitting at the program median
  //  gives an actual portfolio view — without inventing any new signal:
  //    - Value score = `attributedAiUsd` (the engine-owned L4 prize)
  //    - Effort score = weighted sum of the LLM's own `effortDrivers`
  //  All prose (briefs, rationales, narratives) stays 100% LLM-authored;
  //  only the High/Low LABEL is reassigned. With < 2 scored projects we fall
  //  back to the LLM's bucket (median is degenerate).
  // -------------------------------------------------------------------------
  const scorable: Array<{
    cohortId: string;
    valueScore: number;
    effortScore: number;
  }> = [];
  for (const cohort of cohorts) {
    const llm = projectByCohortId.get(cohort.l4RowId);
    const status = statusByCohortId.get(cohort.l4RowId);
    const isStub = !llm || status?.status === "stub";
    if (isStub || !llm.effortDrivers) continue;
    scorable.push({
      cohortId: cohort.l4RowId,
      valueScore: cohort.l4AiUsd,
      effortScore: computeEffortScore(llm.effortDrivers),
    });
  }
  const valueMedian = median(scorable.map((s) => s.valueScore));
  const effortMedian = median(scorable.map((s) => s.effortScore));
  const useMedianSplit = scorable.length >= 2;

  const resolved: AIProjectResolved[] = cohorts.map((cohort) => {
    const llm = projectByCohortId.get(cohort.l4RowId) ?? null;
    const status = statusByCohortId.get(cohort.l4RowId);
    const isStub = !llm || status?.status === "stub";

    const constituents: ProgramInitiativeRow[] = cohort.l5Initiatives
      .map((l5) => initiativesById.get(l5.id))
      .filter((r): r is ProgramInitiativeRow => Boolean(r));

    // Dollar rollup — the L4 prize. Engine-owned, never fabricated by the LLM.
    const attributedAiUsd = cohort.l4AiUsd;

    let valueBucket: ValueBucket | null = llm?.valueBucket ?? null;
    let effortBucket: EffortBucket | null = llm?.effortBucket ?? null;
    if (!isStub && llm && useMedianSplit && llm.effortDrivers) {
      const valueScore = cohort.l4AiUsd;
      const effortScore = computeEffortScore(llm.effortDrivers);
      valueBucket = valueScore >= valueMedian ? "High" : "Low";
      effortBucket = effortScore >= effortMedian ? "High" : "Low";
    }
    const quadrant: Quadrant | null = isStub
      ? null
      : deriveQuadrant(valueBucket, effortBucket);
    const isDeprioritized = quadrant === "Deprioritize";

    const buildMonths = effortBucket
      ? effortBucket === "High"
        ? assumptions.highEffortBuildMonths
        : assumptions.lowEffortBuildMonths
      : assumptions.lowEffortBuildMonths;
    const baseValueStart = effortBucket
      ? effortBucket === "High"
        ? assumptions.highEffortValueStartMonth
        : assumptions.lowEffortValueStartMonth
      : assumptions.lowEffortValueStartMonth;
    const fillInOffset = quadrant === "Fill-in" ? assumptions.fillInStartOffsetMonths : 0;
    const startMonth = Math.max(
      1,
      assumptions.programStartMonth + fillInOffset,
    );
    const valueStartMonth = isStub
      ? Math.max(startMonth + buildMonths, baseValueStart)
      : effortBucket === "High"
        ? Math.max(startMonth + buildMonths, baseValueStart)
        : Math.max(startMonth + buildMonths, baseValueStart);

    return {
      id: projectIdFor(cohort.l4RowId),
      parentL4ActivityGroupId: cohort.l4RowId,
      parentL4ActivityGroupName: cohort.l4Name,
      primaryTowerId: cohort.towerId,
      primaryTowerName: cohort.towerName,
      name: llm?.name ?? `${cohort.l4Name} — Agentic AI`,
      narrative:
        llm?.narrative ??
        "Project narrative pending plan generation. Constituents and L4 grouping are deterministic; click Regenerate to author the project brief.",
      brief: llm?.brief ?? null,
      perInitiativeRationale: llm?.perInitiativeRationale ?? [],
      constituentInitiativeIds: cohort.l5Initiatives.map((i) => i.id),
      constituents,
      effortDrivers: llm?.effortDrivers ?? null,
      valueBucket,
      effortBucket,
      valueRationale: llm?.valueRationale ?? "",
      effortRationale: llm?.effortRationale ?? "",
      quadrant,
      attributedAiUsd,
      startMonth,
      buildMonths,
      rampMonths: assumptions.rampMonths,
      valueStartMonth,
      isStub,
      isDeprioritized,
    };
  });

  // Sort by quadrant priority (Quick Wins → Strategic Bets → Fill-ins →
  // Deprioritize → Stubs) then by $ desc within group, so the cards read
  // top-down in the order the executive should engage them.
  return resolved.sort(compareResolved);
}

function deriveQuadrant(
  valueBucket: ValueBucket | null,
  effortBucket: EffortBucket | null,
): Quadrant | null {
  if (!valueBucket || !effortBucket) return null;
  if (valueBucket === "High" && effortBucket === "Low") return "Quick Win";
  if (valueBucket === "High" && effortBucket === "High") return "Strategic Bet";
  if (valueBucket === "Low" && effortBucket === "Low") return "Fill-in";
  return "Deprioritize";
}

/**
 * Effort score from the LLM's own brief signals. Higher = more effort.
 * Weights are intentionally simple so the score is auditable.
 *
 *   complexity:        Low=0, Medium=2, High=4    (the dominant signal)
 *   integrationCount:  +1 per integration
 *   agentCount:        +1 per agent
 *   platformCount:     +0.5 per platform
 *   provenElsewhere:   −1.5 if true (less risk = less effort)
 */
function computeEffortScore(drivers: EffortDriversLLM): number {
  const complexityWeight =
    drivers.complexity === "High"
      ? 4
      : drivers.complexity === "Medium"
        ? 2
        : 0;
  return (
    complexityWeight +
    Math.max(0, drivers.integrationCount) +
    Math.max(0, drivers.agentCount) +
    Math.max(0, drivers.platformCount) * 0.5 +
    (drivers.provenElsewhere ? -1.5 : 0)
  );
}

/**
 * Median of a numeric array. Returns 0 for an empty array (caller checks
 * length first when this matters). Stable across reruns because the input
 * order is engine-determined.
 */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function quadrantRank(q: Quadrant | null, isStub: boolean): number {
  if (isStub) return 99;
  switch (q) {
    case "Quick Win":
      return 0;
    case "Strategic Bet":
      return 1;
    case "Fill-in":
      return 2;
    case "Deprioritize":
      return 3;
    default:
      return 90;
  }
}

function compareResolved(a: AIProjectResolved, b: AIProjectResolved): number {
  const qa = quadrantRank(a.quadrant, a.isStub);
  const qb = quadrantRank(b.quadrant, b.isStub);
  if (qa !== qb) return qa - qb;
  const usd = b.attributedAiUsd - a.attributedAiUsd;
  if (Math.abs(usd) > 1) return usd;
  const tower = a.primaryTowerName.localeCompare(b.primaryTowerName);
  if (tower !== 0) return tower;
  return a.parentL4ActivityGroupName.localeCompare(b.parentL4ActivityGroupName);
}

// ---------------------------------------------------------------------------
//   Value buildup curve (project-driven, deterministic)
// ---------------------------------------------------------------------------

export type BuildupPoint = {
  month: number;
  /** In-month annualised AI run-rate across all in-flight projects. */
  cumulativeAiUsd: number;
};

const HORIZON_MONTHS = 24;

/**
 * Per-project ramp curve:
 *
 *   - Months before `startMonth`:                contribution = 0
 *   - Months between `startMonth` and `valueStartMonth` (build):
 *                                                contribution = 0
 *   - Months in adoption ramp (linear over `rampMonths`):
 *                                                fraction grows 0 → 1
 *   - Months after ramp completes:               contribution = full $
 *
 * Stub and Deprioritized projects do NOT contribute to the curve.
 */
export function buildProjectsBuildScale(
  projects: AIProjectResolved[],
): BuildupPoint[] {
  const points: BuildupPoint[] = [];
  for (let m = 1; m <= HORIZON_MONTHS; m++) {
    let total = 0;
    for (const p of projects) {
      if (p.isStub) continue;
      if (p.isDeprioritized) continue;
      total += projectContributionAtMonth(p, m);
    }
    points.push({ month: m, cumulativeAiUsd: total });
  }
  return points;
}

function projectContributionAtMonth(
  p: AIProjectResolved,
  month: number,
): number {
  if (month < p.valueStartMonth) return 0;
  const monthsInRamp = month - p.valueStartMonth;
  if (p.rampMonths <= 0) return p.attributedAiUsd;
  if (monthsInRamp >= p.rampMonths) return p.attributedAiUsd;
  const fraction = (monthsInRamp + 1) / p.rampMonths;
  return p.attributedAiUsd * Math.min(1, fraction);
}

// ---------------------------------------------------------------------------
//   Aggregate KPIs from resolved projects
// ---------------------------------------------------------------------------

export type ProjectKpis = {
  totalProjects: number;
  liveProjects: number;
  stubProjects: number;
  deprioritizedProjects: number;
  quickWinCount: number;
  strategicBetCount: number;
  fillInCount: number;
  totalAttributedAiUsd: number;
  liveAttributedAiUsd: number;
  m24RunRateUsd: number;
  fullScaleRunRateUsd: number;
  agentsArchitected: number;
  towersInScope: number;
};

export function summarizeProjects(
  projects: AIProjectResolved[],
): ProjectKpis {
  const live = projects.filter((p) => !p.isStub && !p.isDeprioritized);
  const stub = projects.filter((p) => p.isStub);
  const dep = projects.filter((p) => !p.isStub && p.isDeprioritized);
  const quick = projects.filter((p) => p.quadrant === "Quick Win");
  const bets = projects.filter((p) => p.quadrant === "Strategic Bet");
  const fillIns = projects.filter((p) => p.quadrant === "Fill-in");
  const towers = new Set(live.map((p) => p.primaryTowerId));
  let agents = 0;
  for (const p of live) {
    if (p.brief) agents += p.brief.agents.length;
  }
  const buildup = buildProjectsBuildScale(live);
  const m24 = buildup[buildup.length - 1]?.cumulativeAiUsd ?? 0;
  const fullScale = live.reduce((s, p) => s + p.attributedAiUsd, 0);
  const totalAttributed = projects.reduce((s, p) => s + p.attributedAiUsd, 0);
  return {
    totalProjects: projects.length,
    liveProjects: live.length,
    stubProjects: stub.length,
    deprioritizedProjects: dep.length,
    quickWinCount: quick.length,
    strategicBetCount: bets.length,
    fillInCount: fillIns.length,
    totalAttributedAiUsd: totalAttributed,
    liveAttributedAiUsd: fullScale,
    m24RunRateUsd: m24,
    fullScaleRunRateUsd: fullScale,
    agentsArchitected: agents,
    towersInScope: towers.size,
  };
}
