import type {
  AssessProgramV2,
  TowerAssessState,
  TowerBaseline,
  TowerId,
  TowerRates,
} from "@/data/assess/types";
import { defaultTowerRates } from "@/data/assess/types";
import { towers } from "@/data/towers";
import { IS_V6 } from "@/lib/schemaFlag";

/**
 * Structural type covering both v5 `L4WorkforceRow` (= `L3WorkforceRow`)
 * and v6 `L3WorkforceRowV6`. The savings model only ever reads the seven
 * fields below, so widening to this interface lets every helper accept
 * either row shape without conditional branching at the call site.
 *
 * Phase 7 cleanup will rename this to `WorkforceRow` once the L3
 * vs. L4 distinction is gone.
 */
export type DialBearingRow = {
  /**
   * Used by `l2Concentration` to bucket rows by Job Grouping. v5 L4
   * rows carry the L2 Job Grouping name here directly; v6 L3 rows carry
   * the same value (derived from the L4 children at upload time).
   */
  l2: string;
  fteOnshore: number;
  fteOffshore: number;
  contractorOnshore: number;
  contractorOffshore: number;
  annualSpendUsd?: number;
  offshoreAssessmentPct?: number;
  aiImpactAssessmentPct?: number;
};

export type RowCostResult = { row: DialBearingRow; annualCost: number };

/* =====================================================================
 * SAVINGS MODEL — single source of truth
 *
 * Every $ in the app routes through `rowModeledSaving` (per row),
 * `modeledSavingsForTower` (per tower), or `programImpactSummary`
 * (program total). Every rate read pulls from the tower's own
 * `TowerRates` — `state.towers[towerId].rates` — never a global. There
 * are no magic lever weights, caps, or combine-mode toggles in this
 * file by design.
 *
 * Math (per L4 row, with `r: TowerRates` for that tower):
 *   POOL  = annualSpendUsd  if set, else
 *           fteOn  × r.blendedFteOnshore
 *         + fteOff × r.blendedFteOffshore
 *         + ctrOn  × r.blendedContractorOnshore
 *         + ctrOff × r.blendedContractorOffshore
 *
 *   OFFSHORE  =  movableFte        × (r.blendedFteOnshore        − r.blendedFteOffshore)
 *             +  movableContractor × (r.blendedContractorOnshore − r.blendedContractorOffshore)
 *     where  movableFte        = max(0, (fteOn + fteOff) × dial − fteOff)
 *            movableContractor = max(0, (ctrOn + ctrOff) × dial − ctrOff)
 *     fallback when no headcount but annualSpendUsd is set:
 *       OFFSHORE = annualSpendUsd × dial × (1 − r.blendedFteOffshore / r.blendedFteOnshore)
 *
 *   AI = pool × aiDial
 *
 *   COMBINED (sequential — AI removes work first, offshore on the rest):
 *     combined = ai + offshore × (1 − aiDial)
 *
 * ==================================================================== */

/** $ pool for one row — sum of rates × headcount, or annualSpendUsd override. */
export function rowAnnualCost(
  row: DialBearingRow,
  rates: TowerRates,
): number {
  if (row.annualSpendUsd != null && row.annualSpendUsd > 0) {
    return row.annualSpendUsd;
  }
  return (
    row.fteOnshore * rates.blendedFteOnshore +
    row.fteOffshore * rates.blendedFteOffshore +
    row.contractorOnshore * rates.blendedContractorOnshore +
    row.contractorOffshore * rates.blendedContractorOffshore
  );
}

export function towerPoolUsd(
  rows: ReadonlyArray<DialBearingRow>,
  rates: TowerRates,
): number {
  return rows.reduce((s, r) => s + rowAnnualCost(r, rates), 0);
}

/**
 * Cost-weighted offshore / AI dials across rows. Used for *display only*
 * (e.g., "this tower averages 32% offshore"). Not used to compute $ —
 * the $ comes from per-row math summed, not from these aggregates.
 */
export function weightedTowerLevers(
  rows: ReadonlyArray<DialBearingRow>,
  baseline: TowerBaseline,
  rates: TowerRates,
): { offshorePct: number; aiPct: number } {
  let w = 0;
  let wO = 0;
  let wA = 0;
  for (const r of rows) {
    const c = rowAnnualCost(r, rates);
    if (c <= 0) continue;
    w += c;
    wO += c * (r.offshoreAssessmentPct ?? baseline.baselineOffshorePct);
    wA += c * (r.aiImpactAssessmentPct ?? baseline.baselineAIPct);
  }
  if (w <= 0) {
    return { offshorePct: baseline.baselineOffshorePct, aiPct: baseline.baselineAIPct };
  }
  return { offshorePct: wO / w, aiPct: wA / w };
}

/** Cost share by L2 name — drives the concentration tile on tower pages. */
export function l2Concentration(
  rows: ReadonlyArray<DialBearingRow>,
  rates: TowerRates,
): { l2: string; sharePct: number; subtotal: number }[] {
  const byL2 = new Map<string, number>();
  for (const r of rows) {
    const c = rowAnnualCost(r, rates);
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
 * tower baseline. All rates come from the tower's `TowerRates`.
 *
 * Accepts both v5 `L4WorkforceRow` and v6 `L3WorkforceRowV6` via the
 * `DialBearingRow` structural type — every field the math needs lives
 * on both shapes.
 */
export function rowModeledSaving(
  row: DialBearingRow,
  baseline: TowerBaseline,
  rates: TowerRates,
): RowSavings {
  const pool = rowAnnualCost(row, rates);
  const offshorePct = row.offshoreAssessmentPct ?? baseline.baselineOffshorePct;
  const aiPct = row.aiImpactAssessmentPct ?? baseline.baselineAIPct;
  const offshore = computeRowOffshore(row, offshorePct, rates);
  const ai = pool * (aiPct / 100);
  const combined = ai + offshore * (1 - aiPct / 100);
  return { pool, offshorePct, aiPct, offshore, ai, combined };
}

/**
 * Offshore $ for one row at a given dial. Pure function of (row, dial, rates).
 * Two branches: headcount-based (preferred) and annualSpendUsd fallback.
 */
function computeRowOffshore(
  row: DialBearingRow,
  offshoreDialPct: number,
  rates: TowerRates,
): number {
  const dial = clamp01(offshoreDialPct / 100);
  if (dial <= 0) return 0;

  const fteTotal = row.fteOnshore + row.fteOffshore;
  const ctrTotal = row.contractorOnshore + row.contractorOffshore;

  if (fteTotal <= 0 && ctrTotal <= 0) {
    if (row.annualSpendUsd == null || row.annualSpendUsd <= 0) return 0;
    const onshoreRate = rates.blendedFteOnshore;
    if (onshoreRate <= 0) return 0;
    const wageGapFactor = Math.max(0, 1 - rates.blendedFteOffshore / onshoreRate);
    return row.annualSpendUsd * dial * wageGapFactor;
  }

  const targetOffFte = fteTotal * dial;
  const movableFte = Math.max(0, targetOffFte - row.fteOffshore);
  const fteSavings =
    movableFte * Math.max(0, rates.blendedFteOnshore - rates.blendedFteOffshore);

  const targetOffCtr = ctrTotal * dial;
  const movableCtr = Math.max(0, targetOffCtr - row.contractorOffshore);
  const ctrSavings =
    movableCtr *
    Math.max(0, rates.blendedContractorOnshore - rates.blendedContractorOffshore);

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
 *
 * Polymorphic over row shape: passes through any `DialBearingRow[]` so v5
 * (L4-grain) and v6 (L3-grain) callers share the same totals helper.
 */
export function modeledSavingsForTower(
  rows: ReadonlyArray<DialBearingRow>,
  baseline: TowerBaseline,
  rates: TowerRates,
): TowerSavings {
  let pool = 0;
  let offshore = 0;
  let ai = 0;
  let combined = 0;
  for (const r of rows) {
    const s = rowModeledSaving(r, baseline, rates);
    pool += s.pool;
    offshore += s.offshore;
    ai += s.ai;
    combined += s.combined;
  }
  const w = weightedTowerLevers(rows, baseline, rates);
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

/**
 * Resolve the rates a tower uses. Always returns a populated `TowerRates`
 * — falls back to `defaultTowerRates(towerId)` when the tower's state is
 * absent or its `rates` field hasn't been backfilled yet (e.g. an
 * in-flight migration). All math callers route through this helper so a
 * missing rates blob never produces NaN $ figures downstream.
 */
export function towerRatesFromState(
  towerId: TowerId,
  state: AssessProgramV2,
): TowerRates {
  return state.towers[towerId]?.rates ?? defaultTowerRates(towerId);
}

/**
 * Pick the dial-bearing rows for a tower under the active schema:
 *   - v6: `l3Rows` if present (the L3-grain dials own the math).
 *   - v5: `l4Rows` (the L4-grain dials).
 *
 * v6 falls through to `l4Rows` when `l3Rows` hasn't been derived yet
 * (e.g. mid-migration first read) so the math layer never returns null
 * just because the post-processor hasn't run. Phase 7 cleanup tightens
 * this to "v6 always reads l3Rows" once the migration is permanent.
 */
export function dialBearingRowsForTower(
  state: TowerAssessState,
): ReadonlyArray<DialBearingRow> {
  if (IS_V6 && state.l3Rows && state.l3Rows.length > 0) {
    return state.l3Rows;
  }
  return state.l4Rows;
}

/** Single per-tower outcome — no scenario stress-test overlay. */
export function towerOutcomeForState(
  towerId: TowerId,
  state: AssessProgramV2,
): TowerOutcome | null {
  const t = state.towers[towerId];
  if (!t) return null;
  const rows = dialBearingRowsForTower(t);
  if (rows.length === 0) return null;
  return modeledSavingsForTower(rows, t.baseline, towerRatesFromState(towerId, state));
}

export function allTowerIdsValid(id: string): id is TowerId {
  return towers.some((t) => t.id === id);
}

/**
 * Per-row sensitivity: what's the delta combined $ if this row's offshore
 * (or AI) dial bumped +10 pts? Used by tooltips next to a row.
 */
export function rowSensitivityDeltas(
  row: DialBearingRow,
  baseline: TowerBaseline,
  rates: TowerRates,
): { dOff10: number; dAi10: number } {
  const cur = rowModeledSaving(row, baseline, rates).combined;
  const offDial = (row.offshoreAssessmentPct ?? baseline.baselineOffshorePct) + 10;
  const aiDial = (row.aiImpactAssessmentPct ?? baseline.baselineAIPct) + 10;
  const offBumped = rowModeledSaving(
    { ...row, offshoreAssessmentPct: Math.min(100, offDial) },
    baseline,
    rates,
  ).combined;
  const aiBumped = rowModeledSaving(
    { ...row, aiImpactAssessmentPct: Math.min(100, aiDial) },
    baseline,
    rates,
  ).combined;
  return { dOff10: offBumped - cur, dAi10: aiBumped - cur };
}

export type ProgramImpactSummary = {
  /** Tower ids with at least one L3 row contributing to the program total. */
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
 * Program-level sensitivity ribbon: net $ if every dial-bearing row's
 * offshore (or AI) dial bumped +10 pts. Each row holds one dial pair, so
 * summing the +10 delta across every row is exactly the program-wide +10
 * sensitivity.
 *
 * Under v6, "every row" means every `L3WorkforceRowV6`. Under v5 it
 * means every `L4WorkforceRow`. `dialBearingRowsForTower` picks the
 * right shape per tower.
 */
export function programSensitivityDeltas(state: AssessProgramV2): {
  dOff10: number;
  dAi10: number;
} {
  let dOff10 = 0;
  let dAi10 = 0;
  for (const t of towers) {
    const st = state.towers[t.id];
    if (!st) continue;
    const rows = dialBearingRowsForTower(st);
    if (rows.length === 0) continue;
    const rates = towerRatesFromState(t.id, state);
    for (const r of rows) {
      const d = rowSensitivityDeltas(r, st.baseline, rates);
      dOff10 += d.dOff10;
      dAi10 += d.dAi10;
    }
  }
  return { dOff10, dAi10 };
}

const CSV_REDACT = "—";

export function buildExportCsv(
  program: AssessProgramV2,
  options?: { redact?: boolean },
): string {
  const redact = options?.redact === true;
  const lines: string[] = [
    "towerId,towerName,fteOnshoreRateUsd,fteOffshoreRateUsd,contractorOnshoreRateUsd,contractorOffshoreRateUsd,poolUsd,weightedOffPct,weightedAiPct,modeledOffshoreUsd,modeledAiUsd,modeledCombinedUsd",
  ];
  for (const t of towers) {
    const st = program.towers[t.id];
    if (!st) continue;
    const rows = dialBearingRowsForTower(st);
    if (rows.length === 0) continue;
    const o = towerOutcomeForState(t.id, program);
    if (!o) continue;
    const rates = towerRatesFromState(t.id, program);
    lines.push(
      [
        t.id,
        `"${t.name.replace(/"/g, '""')}"`,
        redact ? CSV_REDACT : rates.blendedFteOnshore.toFixed(0),
        redact ? CSV_REDACT : rates.blendedFteOffshore.toFixed(0),
        redact ? CSV_REDACT : rates.blendedContractorOnshore.toFixed(0),
        redact ? CSV_REDACT : rates.blendedContractorOffshore.toFixed(0),
        redact ? CSV_REDACT : o.pool.toFixed(0),
        o.offshorePct.toFixed(1),
        o.aiPct.toFixed(1),
        redact ? CSV_REDACT : o.offshore.toFixed(0),
        redact ? CSV_REDACT : o.ai.toFixed(0),
        redact ? CSV_REDACT : o.combined.toFixed(0),
      ].join(","),
    );
  }
  return lines.join("\n");
}
