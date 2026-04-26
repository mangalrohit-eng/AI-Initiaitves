import type {
  AssessProgramV2,
  GlobalAssessAssumptions,
  L4WorkforceRow,
  TowerBaseline,
  TowerId,
} from "@/data/assess/types";
import { towers } from "@/data/towers";

export type RowCostResult = { row: L4WorkforceRow; annualCost: number };

/* =====================================================================
 * SAVINGS MODEL — single source of truth
 *
 * Every $ in the app routes through `rowModeledSaving` (per row),
 * `modeledSavingsForTower` (per tower), or `programImpactSummary`
 * (program total). Every rate read pulls from `g: GlobalAssessAssumptions`
 * — i.e., the Assumptions tab. There are no magic lever weights, caps,
 * or combine-mode toggles in this file by design.
 *
 * Math (per L4 row):
 *   POOL  = annualSpendUsd  if set, else
 *           fteOn  × g.blendedFteOnshore
 *         + fteOff × g.blendedFteOffshore
 *         + ctrOn  × g.blendedContractorOnshore
 *         + ctrOff × g.blendedContractorOffshore
 *
 *   OFFSHORE  =  movableFte        × (g.blendedFteOnshore        − g.blendedFteOffshore)
 *             +  movableContractor × (g.blendedContractorOnshore − g.blendedContractorOffshore)
 *     where  movableFte        = max(0, (fteOn + fteOff) × dial − fteOff)
 *            movableContractor = max(0, (ctrOn + ctrOff) × dial − ctrOff)
 *     fallback when no headcount but annualSpendUsd is set:
 *       OFFSHORE = annualSpendUsd × dial × (1 − g.blendedFteOffshore / g.blendedFteOnshore)
 *
 *   AI = pool × aiDial
 *
 *   COMBINED (sequential — AI removes work first, offshore on the rest):
 *     combined = ai + offshore × (1 − aiDial)
 *
 * ==================================================================== */

/** $ pool for one L4 row — sum of rates × headcount, or annualSpendUsd override. */
export function rowAnnualCost(
  row: L4WorkforceRow,
  g: GlobalAssessAssumptions,
): number {
  if (row.annualSpendUsd != null && row.annualSpendUsd > 0) {
    return row.annualSpendUsd;
  }
  return (
    row.fteOnshore * g.blendedFteOnshore +
    row.fteOffshore * g.blendedFteOffshore +
    row.contractorOnshore * g.blendedContractorOnshore +
    row.contractorOffshore * g.blendedContractorOffshore
  );
}

export function towerPoolUsd(rows: L4WorkforceRow[], g: GlobalAssessAssumptions): number {
  return rows.reduce((s, r) => s + rowAnnualCost(r, g), 0);
}

/**
 * Cost-weighted offshore / AI dials across L4 rows. Used for *display only*
 * (e.g., "this tower averages 32% offshore"). Not used to compute $ —
 * the $ comes from per-row math summed, not from these aggregates.
 */
export function weightedTowerLevers(
  rows: L4WorkforceRow[],
  baseline: TowerBaseline,
  g: GlobalAssessAssumptions,
): { offshorePct: number; aiPct: number } {
  let w = 0;
  let wO = 0;
  let wA = 0;
  for (const r of rows) {
    const c = rowAnnualCost(r, g);
    if (c <= 0) continue;
    w += c;
    wO += c * (r.l4OffshoreAssessmentPct ?? baseline.baselineOffshorePct);
    wA += c * (r.l4AiImpactAssessmentPct ?? baseline.baselineAIPct);
  }
  if (w <= 0) {
    return { offshorePct: baseline.baselineOffshorePct, aiPct: baseline.baselineAIPct };
  }
  return { offshorePct: wO / w, aiPct: wA / w };
}

/** Cost share by L2 name — drives the concentration tile on tower pages. */
export function l2Concentration(
  rows: L4WorkforceRow[],
  g: GlobalAssessAssumptions,
): { l2: string; sharePct: number; subtotal: number }[] {
  const byL2 = new Map<string, number>();
  for (const r of rows) {
    const c = rowAnnualCost(r, g);
    byL2.set(r.l2, (byL2.get(r.l2) ?? 0) + c);
  }
  const total = Array.from(byL2.values()).reduce((a, b) => a + b, 0) || 1;
  return Array.from(byL2.entries())
    .map(([l2, subtotal]) => ({
      l2,
      subtotal,
      sharePct: (subtotal / total) * 100,
    }))
    .sort((a, b) => b.subtotal - a.subtotal);
}

export type RowSavings = {
  pool: number;
  offshorePct: number;
  aiPct: number;
  offshore: number;
  ai: number;
  combined: number;
};

/**
 * Per-row modeled savings. Uses the row's own dials if set; otherwise the
 * tower baseline. All rates come from `g`.
 */
export function rowModeledSaving(
  row: L4WorkforceRow,
  baseline: TowerBaseline,
  g: GlobalAssessAssumptions,
): RowSavings {
  const pool = rowAnnualCost(row, g);
  const offshorePct = row.l4OffshoreAssessmentPct ?? baseline.baselineOffshorePct;
  const aiPct = row.l4AiImpactAssessmentPct ?? baseline.baselineAIPct;
  const offshore = computeRowOffshore(row, offshorePct, g);
  const ai = pool * (aiPct / 100);
  // Sequential combine: AI removes work first, offshore arbitrage on what's left.
  const combined = ai + offshore * (1 - aiPct / 100);
  return { pool, offshorePct, aiPct, offshore, ai, combined };
}

/**
 * Offshore $ for one row at a given dial. Pure function of (row, dial, rates).
 * Two branches: headcount-based (preferred) and annualSpendUsd fallback.
 */
function computeRowOffshore(
  row: L4WorkforceRow,
  offshoreDialPct: number,
  g: GlobalAssessAssumptions,
): number {
  const dial = clamp01(offshoreDialPct / 100);
  if (dial <= 0) return 0;

  const fteTotal = row.fteOnshore + row.fteOffshore;
  const ctrTotal = row.contractorOnshore + row.contractorOffshore;

  // Fallback: row has only annualSpendUsd, no headcount counts. Use the
  // FTE wage-gap factor against the whole spend × dial. Still rate-driven.
  if (fteTotal <= 0 && ctrTotal <= 0) {
    if (row.annualSpendUsd == null || row.annualSpendUsd <= 0) return 0;
    const onshoreRate = g.blendedFteOnshore;
    if (onshoreRate <= 0) return 0;
    const wageGapFactor = Math.max(0, 1 - g.blendedFteOffshore / onshoreRate);
    return row.annualSpendUsd * dial * wageGapFactor;
  }

  // Headcount-based: only the headcount that needs to *move* offshore generates savings.
  const targetOffFte = fteTotal * dial;
  const movableFte = Math.max(0, targetOffFte - row.fteOffshore);
  const fteSavings = movableFte * Math.max(0, g.blendedFteOnshore - g.blendedFteOffshore);

  const targetOffCtr = ctrTotal * dial;
  const movableCtr = Math.max(0, targetOffCtr - row.contractorOffshore);
  const ctrSavings =
    movableCtr * Math.max(0, g.blendedContractorOnshore - g.blendedContractorOffshore);

  return fteSavings + ctrSavings;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

export type TowerSavings = {
  pool: number;
  offshorePct: number;
  aiPct: number;
  offshore: number;
  ai: number;
  combined: number;
};

/**
 * Modeled savings for a tower — the sum of `rowModeledSaving` across rows.
 * Returns the cost-weighted offshore/AI % for display (not used to compute $).
 */
export function modeledSavingsForTower(
  rows: L4WorkforceRow[],
  baseline: TowerBaseline,
  g: GlobalAssessAssumptions,
): TowerSavings {
  let pool = 0;
  let offshore = 0;
  let ai = 0;
  let combined = 0;
  for (const r of rows) {
    const s = rowModeledSaving(r, baseline, g);
    pool += s.pool;
    offshore += s.offshore;
    ai += s.ai;
    combined += s.combined;
  }
  const w = weightedTowerLevers(rows, baseline, g);
  return {
    pool,
    offshorePct: w.offshorePct,
    aiPct: w.aiPct,
    offshore,
    ai,
    combined,
  };
}

export type TowerOutcome = {
  pool: number;
  offshorePct: number;
  aiPct: number;
  offshore: number;
  ai: number;
  combined: number;
};

/** Single per-tower outcome — no scenario stress-test overlay. */
export function towerOutcomeForState(
  towerId: TowerId,
  state: AssessProgramV2,
): TowerOutcome | null {
  const t = state.towers[towerId];
  if (!t?.l4Rows.length) return null;
  return modeledSavingsForTower(t.l4Rows, t.baseline, state.global);
}

export function allTowerIdsValid(id: string): id is TowerId {
  return towers.some((t) => t.id === id);
}

/**
 * Per-row sensitivity: what's the delta combined $ if this row's offshore
 * (or AI) dial bumped +10 pts? Used by tooltips next to a row.
 */
export function rowSensitivityDeltas(
  row: L4WorkforceRow,
  baseline: TowerBaseline,
  g: GlobalAssessAssumptions,
): { dOff10: number; dAi10: number } {
  const cur = rowModeledSaving(row, baseline, g).combined;
  const offDial = (row.l4OffshoreAssessmentPct ?? baseline.baselineOffshorePct) + 10;
  const aiDial = (row.l4AiImpactAssessmentPct ?? baseline.baselineAIPct) + 10;
  const offBumped = rowModeledSaving(
    { ...row, l4OffshoreAssessmentPct: Math.min(100, offDial) },
    baseline,
    g,
  ).combined;
  const aiBumped = rowModeledSaving(
    { ...row, l4AiImpactAssessmentPct: Math.min(100, aiDial) },
    baseline,
    g,
  ).combined;
  return { dOff10: offBumped - cur, dAi10: aiBumped - cur };
}

export type ProgramImpactSummary = {
  /** Tower ids with at least one L4 row contributing to the program total. */
  contributingTowers: TowerId[];
  /** Sum of pool $ across contributing towers. */
  totalPool: number;
  /** Modeled $ (combined) across all contributing towers. */
  combined: number;
  /** Of `combined`, the pre-overlap offshore contribution. */
  offshore: number;
  /** Of `combined`, the pre-overlap AI contribution. */
  ai: number;
  /** Cost-weighted offshore % across contributing towers. */
  weightedOffshorePct: number;
  /** Cost-weighted AI % across contributing towers. */
  weightedAiPct: number;
};

/** Roll up the program-wide modeled impact. */
export function programImpactSummary(state: AssessProgramV2): ProgramImpactSummary {
  let totalPool = 0;
  let combined = 0;
  let offshore = 0;
  let ai = 0;
  let wOffNum = 0;
  let wAiNum = 0;
  let wDen = 0;
  const contributing: TowerId[] = [];
  for (const t of towers) {
    const o = towerOutcomeForState(t.id, state);
    if (!o) continue;
    contributing.push(t.id);
    totalPool += o.pool;
    combined += o.combined;
    offshore += o.offshore;
    ai += o.ai;
    wOffNum += o.pool * o.offshorePct;
    wAiNum += o.pool * o.aiPct;
    wDen += o.pool;
  }
  return {
    contributingTowers: contributing,
    totalPool,
    combined,
    offshore,
    ai,
    weightedOffshorePct: wDen > 0 ? wOffNum / wDen : 0,
    weightedAiPct: wDen > 0 ? wAiNum / wDen : 0,
  };
}

/**
 * Program-level sensitivity ribbon: net $ if every L4's offshore (or AI) dial
 * bumped +10 pts. Computed by re-running each row with the bumped dial and
 * summing the deltas.
 */
export function programSensitivityDeltas(state: AssessProgramV2): {
  dOff10: number;
  dAi10: number;
} {
  let dOff10 = 0;
  let dAi10 = 0;
  for (const t of towers) {
    const st = state.towers[t.id];
    if (!st?.l4Rows.length) continue;
    for (const r of st.l4Rows) {
      const d = rowSensitivityDeltas(r, st.baseline, state.global);
      dOff10 += d.dOff10;
      dAi10 += d.dAi10;
    }
  }
  return { dOff10, dAi10 };
}

export function buildExportCsv(program: AssessProgramV2): string {
  const lines: string[] = [
    "towerId,towerName,poolUsd,weightedOffPct,weightedAiPct,modeledOffshoreUsd,modeledAiUsd,modeledCombinedUsd",
  ];
  for (const t of towers) {
    const st = program.towers[t.id];
    if (!st?.l4Rows.length) continue;
    const o = towerOutcomeForState(t.id, program);
    if (!o) continue;
    lines.push(
      [
        t.id,
        `"${t.name.replace(/"/g, '""')}"`,
        o.pool.toFixed(0),
        o.offshorePct.toFixed(1),
        o.aiPct.toFixed(1),
        o.offshore.toFixed(0),
        o.ai.toFixed(0),
        o.combined.toFixed(0),
      ].join(","),
    );
  }
  return lines.join("\n");
}
