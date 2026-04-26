import type {
  AssessProgramV2,
  GlobalAssessAssumptions,
  L4WorkforceRow,
  TowerBaseline,
  TowerId,
} from "@/data/assess/types";
import { towers } from "@/data/towers";

export type RowCostResult = { row: L4WorkforceRow; annualCost: number };

/** $ pool for one L4 row. Uses annualSpendUsd or blended rates (illustrative). */
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
 * Cost-weighted offshore / AI levers from per-L4 assessments, falling back to tower baseline.
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

/** Cost share by L2 name. */
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

/**
 * Modeled $ from tower pool, offshore %, AI %, and global weights.
 * Not Versant-reported; illustrative band math.
 */
export function modeledSavingsForTower(
  pool: number,
  offshorePct: number,
  aiPct: number,
  g: GlobalAssessAssumptions,
): { offshore: number; ai: number; combined: number } {
  if (pool <= 0) return { offshore: 0, ai: 0, combined: 0 };
  const o = (offshorePct / 100) * g.offshoreLeverWeight * pool;
  const a = (aiPct / 100) * g.aiLeverWeight * pool;
  let combined = o + a;
  if (g.combineMode === "capped") {
    const cap = (g.combinedCapPct / 100) * pool;
    combined = Math.min(combined, cap);
  }
  return { offshore: o, ai: a, combined };
}

export function towerOutcomeForState(
  towerId: TowerId,
  state: AssessProgramV2,
): {
  pool: number;
  baseline: { offshorePct: number; aiPct: number; combined: number };
  scenario: { offshorePct: number; aiPct: number; combined: number };
} | null {
  const t = state.towers[towerId];
  if (!t?.l4Rows.length) return null;
  const pool = towerPoolUsd(t.l4Rows, state.global);
  const b = t.baseline;
  const w = weightedTowerLevers(t.l4Rows, b, state.global);
  const sOff = state.scenarios[towerId]?.scenarioOffshorePct ?? w.offshorePct;
  const sAi = state.scenarios[towerId]?.scenarioAIPct ?? w.aiPct;
  const base = modeledSavingsForTower(pool, w.offshorePct, w.aiPct, state.global);
  const sc = modeledSavingsForTower(pool, sOff, sAi, state.global);
  return {
    pool,
    baseline: { offshorePct: w.offshorePct, aiPct: w.aiPct, combined: base.combined },
    scenario: { offshorePct: sOff, aiPct: sAi, combined: sc.combined },
  };
}

export function allTowerIdsValid(id: string): id is TowerId {
  return towers.some((t) => t.id === id);
}

/** Sensitivity: delta combined if +10 pts to offshore, holding AI fixed (and reverse). */
export function sensitivityDeltas(
  pool: number,
  offshorePct: number,
  aiPct: number,
  g: GlobalAssessAssumptions,
): { dOff10: number; dAi10: number } {
  const current = modeledSavingsForTower(pool, offshorePct, aiPct, g).combined;
  const offB = Math.min(100, offshorePct + 10);
  const aiB = Math.min(100, aiPct + 10);
  return {
    dOff10: modeledSavingsForTower(pool, offB, aiPct, g).combined - current,
    dAi10: modeledSavingsForTower(pool, offshorePct, aiB, g).combined - current,
  };
}

export function buildExportCsv(program: AssessProgramV2): string {
  const lines: string[] = [
    "towerId,towerName,poolUsd,baselineOff,baselineAI,baselineModelUsd,scOff,scAI,scModelUsd",
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
        o.baseline.offshorePct,
        o.baseline.aiPct,
        o.baseline.combined.toFixed(0),
        o.scenario.offshorePct,
        o.scenario.aiPct,
        o.scenario.combined.toFixed(0),
      ].join(","),
    );
  }
  return lines.join("\n");
}
