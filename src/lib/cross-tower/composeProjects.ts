/**
 * Cross-Tower AI Plan — shared composition helpers.
 *
 * The v6 plan composes its `AIProjectResolved[]` view-model in
 * `composeProjectsV6.ts` (one project per L3 AI Solution). This module
 * is the home for cross-tower helpers that are independent of the
 * authoring path:
 *
 *   - `BuildupPoint` + `buildProjectsBuildScale` — the 24-month
 *     deterministic value-ramp curve.
 *   - `ProjectKpis`   + `summarizeProjects`      — aggregate KPI strip.
 *
 * Stub and Deprioritized projects do NOT contribute to the curve.
 */

import type { AIProjectResolved, Quadrant } from "@/lib/cross-tower/aiProjects";

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
  towersInScope: number;
};

export function summarizeProjects(
  projects: AIProjectResolved[],
): ProjectKpis {
  const live = projects.filter((p) => !p.isStub && !p.isDeprioritized);
  const stub = projects.filter((p) => p.isStub);
  const dep = projects.filter((p) => !p.isStub && p.isDeprioritized);
  const quick: AIProjectResolved[] = [];
  const bets: AIProjectResolved[] = [];
  const fillIns: AIProjectResolved[] = [];
  for (const p of projects) {
    const q: Quadrant | null = p.quadrant;
    if (q === "Quick Win") quick.push(p);
    else if (q === "Strategic Bet") bets.push(p);
    else if (q === "Fill-in") fillIns.push(p);
  }
  const towers = new Set(live.map((p) => p.primaryTowerId));
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
    towersInScope: towers.size,
  };
}
