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

/**
 * Per-row modeled savings — uses the row's own offshore% / AI% if set,
 * otherwise the tower baseline. Same combine-mode + cap as the tower roll-up,
 * applied at the row level so the lever drag animation lights up cell-by-cell.
 */
export function rowModeledSaving(
  row: L4WorkforceRow,
  baseline: TowerBaseline,
  g: GlobalAssessAssumptions,
): { pool: number; offshorePct: number; aiPct: number; offshore: number; ai: number; combined: number } {
  const pool = rowAnnualCost(row, g);
  const offshorePct = row.l4OffshoreAssessmentPct ?? baseline.baselineOffshorePct;
  const aiPct = row.l4AiImpactAssessmentPct ?? baseline.baselineAIPct;
  const m = modeledSavingsForTower(pool, offshorePct, aiPct, g);
  return { pool, offshorePct, aiPct, offshore: m.offshore, ai: m.ai, combined: m.combined };
}

export type ProgramImpactSummary = {
  /** Tower ids with at least one L4 row contributing to the program total. */
  contributingTowers: TowerId[];
  /** Sum of pool $ across contributing towers. */
  totalPool: number;
  /** Modeled $ (combined) at the user's current scenario dials. */
  scenarioCombined: number;
  /** Modeled $ (combined) at the cost-weighted baseline before scenario stress. */
  baselineCombined: number;
  /** Of `scenarioCombined`, share attributable to the offshore lever. */
  scenarioOffshore: number;
  /** Of `scenarioCombined`, share attributable to the AI lever. */
  scenarioAi: number;
  /** Cost-weighted offshore % across contributing towers (scenario). */
  weightedScenarioOffshorePct: number;
  /** Cost-weighted AI % across contributing towers (scenario). */
  weightedScenarioAiPct: number;
};

/**
 * Roll up the program-wide modeled impact at the user's current scenario dials.
 *
 * Sums the per-tower combined savings rather than recomputing on the program pool,
 * so the program math respects each tower's combine mode + cap independently.
 */
export function programImpactSummary(state: AssessProgramV2): ProgramImpactSummary {
  let totalPool = 0;
  let scenarioCombined = 0;
  let baselineCombined = 0;
  let scenarioOffshore = 0;
  let scenarioAi = 0;
  let wOffNum = 0;
  let wAiNum = 0;
  let wDen = 0;
  const contributing: TowerId[] = [];
  for (const t of towers) {
    const o = towerOutcomeForState(t.id, state);
    if (!o) continue;
    contributing.push(t.id);
    totalPool += o.pool;
    scenarioCombined += o.scenario.combined;
    baselineCombined += o.baseline.combined;
    const scLevers = modeledSavingsForTower(
      o.pool,
      o.scenario.offshorePct,
      o.scenario.aiPct,
      state.global,
    );
    // Pre-cap split (when capped, the cap is applied only at the combined number,
    // so the off / ai shares stay proportional to the uncapped contributions).
    const totalUncapped = scLevers.offshore + scLevers.ai;
    if (totalUncapped > 0) {
      const fOff = scLevers.offshore / totalUncapped;
      scenarioOffshore += fOff * o.scenario.combined;
      scenarioAi += (1 - fOff) * o.scenario.combined;
    }
    wOffNum += o.pool * o.scenario.offshorePct;
    wAiNum += o.pool * o.scenario.aiPct;
    wDen += o.pool;
  }
  return {
    contributingTowers: contributing,
    totalPool,
    scenarioCombined,
    baselineCombined,
    scenarioOffshore,
    scenarioAi,
    weightedScenarioOffshorePct: wDen > 0 ? wOffNum / wDen : 0,
    weightedScenarioAiPct: wDen > 0 ? wAiNum / wDen : 0,
  };
}

/**
 * Program-level sensitivity ribbon: what's the net dollar impact if every tower's
 * scenario offshore (or AI) gained 10 pts? Computed by re-running each tower with
 * the bumped dial and summing the deltas — preserves combine-mode cap behaviour.
 */
export function programSensitivityDeltas(state: AssessProgramV2): {
  dOff10: number;
  dAi10: number;
} {
  let dOff10 = 0;
  let dAi10 = 0;
  for (const t of towers) {
    const o = towerOutcomeForState(t.id, state);
    if (!o) continue;
    const offB = Math.min(100, o.scenario.offshorePct + 10);
    const aiB = Math.min(100, o.scenario.aiPct + 10);
    const bumpOff = modeledSavingsForTower(o.pool, offB, o.scenario.aiPct, state.global).combined;
    const bumpAi = modeledSavingsForTower(o.pool, o.scenario.offshorePct, aiB, state.global).combined;
    dOff10 += bumpOff - o.scenario.combined;
    dAi10 += bumpAi - o.scenario.combined;
  }
  return { dOff10, dAi10 };
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
