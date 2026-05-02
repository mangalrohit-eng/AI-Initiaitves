/**
 * Program digest builder — pure function over `AssessProgramV5` plus the
 * scenario model. Produces a compact view ready to inject into the LLM
 * prompt: per-tower roll-ups, top-N aggregates, and program totals.
 *
 * ClientMode handling: when `clientMode` is true, every modeled-$ field is
 * replaced with `null`. The render layer also redacts at display time, so
 * this is defense-in-depth against accidentally serializing $ to the LLM.
 *
 * No "server-only" import — this runs client-side off `getAssessProgram()`
 * AND is safe to call server-side from the API route as a re-validation
 * step (it doesn't touch DOM globals).
 */

import type { AssessProgramV5, L4WorkforceRow, TowerId } from "@/data/assess/types";
import { towers } from "@/data/towers";
import {
  modeledSavingsForTower,
  rowAnnualCost,
  rowModeledSaving,
  towerRatesFromState,
} from "@/lib/assess/scenarioModel";
import type { ProgramDigest, ProgramTopAggregates, ProgramTotals, TowerDigest } from "./types";

export function buildProgramDigest(
  program: AssessProgramV5,
  options: { clientMode: boolean },
): ProgramDigest {
  const redact = options.clientMode === true;

  const perTower: TowerDigest[] = [];
  const totals: MutableTotals = newMutableTotals();
  let lastUpdatedTs = 0;

  for (const tower of towers) {
    const state = program.towers[tower.id];
    if (!state || state.l4Rows.length === 0) {
      // Still record the tower as "loaded but empty" for the totals — but
      // don't push a perTower entry that would clutter the digest.
      continue;
    }
    const rates = towerRatesFromState(tower.id, program);
    const towerSav = modeledSavingsForTower(state.l4Rows, state.baseline, rates);

    let fteOnshore = 0;
    let fteOffshore = 0;
    let contractorOnshore = 0;
    let contractorOffshore = 0;
    for (const row of state.l4Rows) {
      fteOnshore += row.fteOnshore;
      fteOffshore += row.fteOffshore;
      contractorOnshore += row.contractorOnshore;
      contractorOffshore += row.contractorOffshore;
    }
    const totalHeadcount = fteOnshore + fteOffshore + contractorOnshore + contractorOffshore;

    // Top L3 by headcount (within tower).
    const byL3 = new Map<string, { totalHeadcount: number; rowCount: number }>();
    for (const row of state.l4Rows) {
      const key = row.l3 || "(unspecified)";
      const cur = byL3.get(key) ?? { totalHeadcount: 0, rowCount: 0 };
      cur.totalHeadcount += rowHeadcount(row);
      cur.rowCount += 1;
      byL3.set(key, cur);
    }
    const topL3sByHeadcount = Array.from(byL3.entries())
      .map(([l3, v]) => ({ l3, ...v }))
      .sort((a, b) => b.totalHeadcount - a.totalHeadcount)
      .slice(0, 5);

    // Top L4 by offshore plan %.
    const topL4sByOffshorePct = state.l4Rows
      .map((r) => ({
        l4Id: r.id,
        l4: r.l4,
        l3: r.l3,
        offshorePct: r.offshoreAssessmentPct ?? state.baseline.baselineOffshorePct,
        totalHeadcount: rowHeadcount(r),
      }))
      .sort((a, b) => b.offshorePct - a.offshorePct)
      .slice(0, 5);

    // Top L4 by modeled combined saving.
    const rowSavings = state.l4Rows.map((r) => ({
      r,
      sav: rowModeledSaving(r, state.baseline, rates),
    }));
    const topL4sByModeledSaving = rowSavings
      .sort((a, b) => b.sav.combined - a.sav.combined)
      .slice(0, 5)
      .map(({ r, sav }) => ({
        l4Id: r.id,
        l4: r.l4,
        l3: r.l3,
        modeledCombinedUsd: redact ? null : sav.combined,
        totalHeadcount: rowHeadcount(r),
      }));

    perTower.push({
      towerId: tower.id,
      towerName: tower.name,
      rowCount: state.l4Rows.length,
      fteOnshore,
      fteOffshore,
      contractorOnshore,
      contractorOffshore,
      totalHeadcount,
      poolUsd: redact ? null : towerSav.pool,
      weightedOffshorePct: round1(towerSav.offshorePct),
      weightedAiPct: round1(towerSav.aiPct),
      modeledOffshoreUsd: redact ? null : towerSav.offshore,
      modeledAiUsd: redact ? null : towerSav.ai,
      modeledCombinedUsd: redact ? null : towerSav.combined,
      topL3sByHeadcount,
      topL4sByOffshorePct,
      topL4sByModeledSaving,
    });

    totals.contributingTowerCount += 1;
    totals.l4RowCount += state.l4Rows.length;
    totals.fteOnshore += fteOnshore;
    totals.fteOffshore += fteOffshore;
    totals.contractorOnshore += contractorOnshore;
    totals.contractorOffshore += contractorOffshore;
    totals.totalHeadcount += totalHeadcount;
    totals.poolUsd += towerSav.pool;
    totals.modeledOffshoreUsd += towerSav.offshore;
    totals.modeledAiUsd += towerSav.ai;
    totals.modeledCombinedUsd += towerSav.combined;
    totals.weightedOffshoreNum += towerSav.pool * towerSav.offshorePct;
    totals.weightedAiNum += towerSav.pool * towerSav.aiPct;
    totals.weightedDen += towerSav.pool;

    if (state.lastUpdated) {
      const ts = Date.parse(state.lastUpdated);
      if (Number.isFinite(ts) && ts > lastUpdatedTs) {
        lastUpdatedTs = ts;
      }
    }
  }

  const programTotals: ProgramTotals = {
    towerCount: towers.length,
    contributingTowerCount: totals.contributingTowerCount,
    l4RowCount: totals.l4RowCount,
    fteOnshore: totals.fteOnshore,
    fteOffshore: totals.fteOffshore,
    contractorOnshore: totals.contractorOnshore,
    contractorOffshore: totals.contractorOffshore,
    totalHeadcount: totals.totalHeadcount,
    poolUsd: redact ? null : totals.poolUsd,
    modeledOffshoreUsd: redact ? null : totals.modeledOffshoreUsd,
    modeledAiUsd: redact ? null : totals.modeledAiUsd,
    modeledCombinedUsd: redact ? null : totals.modeledCombinedUsd,
    weightedOffshorePct:
      totals.weightedDen > 0 ? round1(totals.weightedOffshoreNum / totals.weightedDen) : 0,
    weightedAiPct:
      totals.weightedDen > 0 ? round1(totals.weightedAiNum / totals.weightedDen) : 0,
  };

  const topAggregates = buildTopAggregates(program, perTower, redact);

  return {
    hasWorkshopData: totals.contributingTowerCount > 0,
    lastUpdated: lastUpdatedTs > 0 ? new Date(lastUpdatedTs).toISOString() : undefined,
    totals: programTotals,
    perTower,
    topAggregates,
    clientModeRedacted: redact,
  };
}

/** Compact prompt-friendly serialization. */
export function programDigestForPrompt(d: ProgramDigest): string {
  const lines: string[] = [];
  lines.push("# WORKSHOP STATE");
  lines.push(
    `Workshop: ${d.hasWorkshopData ? `${d.totals.contributingTowerCount} of ${d.totals.towerCount} towers populated, ${d.totals.l4RowCount} L4 rows` : "EMPTY — no L4 rows entered"}`,
  );
  if (d.clientModeRedacted) {
    lines.push("ClientMode: ON — modeled $ figures are redacted (null) below; never emit dollar values in answers.");
  } else {
    lines.push("ClientMode: OFF — modeled $ figures may be cited.");
  }
  if (d.lastUpdated) {
    lines.push(`Last workshop update: ${d.lastUpdated}`);
  }

  lines.push("");
  lines.push("# PROGRAM TOTALS");
  lines.push(`Total headcount: ${d.totals.totalHeadcount.toLocaleString()} (FTE on/off: ${d.totals.fteOnshore.toLocaleString()}/${d.totals.fteOffshore.toLocaleString()}, contractor on/off: ${d.totals.contractorOnshore.toLocaleString()}/${d.totals.contractorOffshore.toLocaleString()})`);
  lines.push(`Pool $: ${fmtUsdNullable(d.totals.poolUsd)} | Modeled offshore: ${fmtUsdNullable(d.totals.modeledOffshoreUsd)} | Modeled AI: ${fmtUsdNullable(d.totals.modeledAiUsd)} | Modeled combined: ${fmtUsdNullable(d.totals.modeledCombinedUsd)}`);
  lines.push(`Weighted offshore %: ${d.totals.weightedOffshorePct} | Weighted AI %: ${d.totals.weightedAiPct}`);

  lines.push("");
  lines.push("# PER-TOWER ROLL-UPS");
  for (const t of d.perTower) {
    lines.push(
      `[${t.towerId}] ${t.towerName} — rows=${t.rowCount}, FTE total=${t.totalHeadcount.toLocaleString()} (on/off ${t.fteOnshore}/${t.fteOffshore}, ctr ${t.contractorOnshore}/${t.contractorOffshore}), pool=${fmtUsdNullable(t.poolUsd)}, off%=${t.weightedOffshorePct}, ai%=${t.weightedAiPct}, modeledCombined=${fmtUsdNullable(t.modeledCombinedUsd)}`,
    );
    if (t.topL3sByHeadcount.length > 0) {
      lines.push(
        `  Top L3 by headcount: ${t.topL3sByHeadcount.map((x) => `${x.l3}(${x.totalHeadcount.toLocaleString()})`).join("; ")}`,
      );
    }
    if (t.topL4sByOffshorePct.length > 0) {
      lines.push(
        `  Top L4 by offshore%: ${t.topL4sByOffshorePct.map((x) => `${x.l4} [${x.l4Id}] @ ${x.offshorePct}%`).join("; ")}`,
      );
    }
    if (t.topL4sByModeledSaving.length > 0) {
      lines.push(
        `  Top L4 by modeled saving: ${t.topL4sByModeledSaving.map((x) => `${x.l4} [${x.l4Id}] = ${fmtUsdNullable(x.modeledCombinedUsd)}`).join("; ")}`,
      );
    }
  }

  lines.push("");
  lines.push("# TOP AGGREGATES (program-wide)");
  lines.push(
    `Top towers by headcount: ${d.topAggregates.topTowersByHeadcount.map((t) => `${t.towerName}=${t.totalHeadcount.toLocaleString()}`).join("; ")}`,
  );
  lines.push(
    `Top towers by modeled saving: ${d.topAggregates.topTowersByModeledSaving.map((t) => `${t.towerName}=${fmtUsdNullable(t.modeledCombinedUsd)}`).join("; ")}`,
  );
  lines.push(
    `Top towers by offshore%: ${d.topAggregates.topTowersByOffshorePct.map((t) => `${t.towerName}=${t.weightedOffshorePct}%`).join("; ")}`,
  );
  if (d.topAggregates.topL4sByOffshorePct.length > 0) {
    lines.push("Top L4 by offshore%:");
    for (const r of d.topAggregates.topL4sByOffshorePct) {
      lines.push(`  - [${r.l4Id}] ${r.l4} (${r.towerName} > ${r.l3}) @ ${r.offshorePct}% — ${r.totalHeadcount.toLocaleString()} ppl`);
    }
  }
  if (d.topAggregates.topL4sByModeledSaving.length > 0) {
    lines.push("Top L4 by modeled saving:");
    for (const r of d.topAggregates.topL4sByModeledSaving) {
      lines.push(
        `  - [${r.l4Id}] ${r.l4} (${r.towerName} > ${r.l3}) = ${fmtUsdNullable(r.modeledCombinedUsd)} — ${r.totalHeadcount.toLocaleString()} ppl`,
      );
    }
  }

  return lines.join("\n");
}

/* ------------------------ helpers ------------------------ */

function buildTopAggregates(
  program: AssessProgramV5,
  perTower: TowerDigest[],
  redact: boolean,
): ProgramTopAggregates {
  // Top towers.
  const topTowersByHeadcount = perTower
    .map((t) => ({
      towerId: t.towerId,
      towerName: t.towerName,
      totalHeadcount: t.totalHeadcount,
    }))
    .sort((a, b) => b.totalHeadcount - a.totalHeadcount)
    .slice(0, 5);

  const topTowersByModeledSaving = perTower
    .filter((t) => t.modeledCombinedUsd != null || redact)
    .map((t) => ({
      towerId: t.towerId,
      towerName: t.towerName,
      modeledCombinedUsd: t.modeledCombinedUsd,
    }))
    .sort((a, b) => (b.modeledCombinedUsd ?? 0) - (a.modeledCombinedUsd ?? 0))
    .slice(0, 5);

  const topTowersByOffshorePct = perTower
    .map((t) => ({
      towerId: t.towerId,
      towerName: t.towerName,
      weightedOffshorePct: t.weightedOffshorePct,
    }))
    .sort((a, b) => b.weightedOffshorePct - a.weightedOffshorePct)
    .slice(0, 5);

  // Program-wide L4 aggregates — collect rows then sort.
  type RowAgg = {
    towerId: TowerId;
    towerName: string;
    l4Id: string;
    l4: string;
    l3: string;
    offshorePct: number;
    modeledCombinedUsd: number | null;
    totalHeadcount: number;
  };
  const allRows: RowAgg[] = [];
  for (const tower of towers) {
    const state = program.towers[tower.id];
    if (!state?.l4Rows.length) continue;
    const rates = towerRatesFromState(tower.id, program);
    for (const row of state.l4Rows) {
      const sav = rowModeledSaving(row, state.baseline, rates);
      allRows.push({
        towerId: tower.id,
        towerName: tower.name,
        l4Id: row.id,
        l4: row.l4,
        l3: row.l3,
        offshorePct: row.offshoreAssessmentPct ?? state.baseline.baselineOffshorePct,
        modeledCombinedUsd: redact ? null : sav.combined,
        totalHeadcount: rowHeadcount(row),
      });
    }
  }

  const topL4sByOffshorePct = [...allRows]
    .sort((a, b) => b.offshorePct - a.offshorePct)
    .slice(0, 10);

  const topL4sByModeledSaving = [...allRows]
    .sort((a, b) => (b.modeledCombinedUsd ?? 0) - (a.modeledCombinedUsd ?? 0))
    .slice(0, 10);

  return {
    topTowersByHeadcount,
    topTowersByModeledSaving,
    topTowersByOffshorePct,
    topL4sByOffshorePct,
    topL4sByModeledSaving,
  };
}

function rowHeadcount(row: L4WorkforceRow): number {
  return row.fteOnshore + row.fteOffshore + row.contractorOnshore + row.contractorOffshore;
}

function round1(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 10) / 10;
}

function fmtUsdNullable(n: number | null): string {
  if (n == null) return "redacted";
  return `$${Math.round(n).toLocaleString()}`;
}

type MutableTotals = {
  contributingTowerCount: number;
  l4RowCount: number;
  fteOnshore: number;
  fteOffshore: number;
  contractorOnshore: number;
  contractorOffshore: number;
  totalHeadcount: number;
  poolUsd: number;
  modeledOffshoreUsd: number;
  modeledAiUsd: number;
  modeledCombinedUsd: number;
  weightedOffshoreNum: number;
  weightedAiNum: number;
  weightedDen: number;
};

function newMutableTotals(): MutableTotals {
  return {
    contributingTowerCount: 0,
    l4RowCount: 0,
    fteOnshore: 0,
    fteOffshore: 0,
    contractorOnshore: 0,
    contractorOffshore: 0,
    totalHeadcount: 0,
    poolUsd: 0,
    modeledOffshoreUsd: 0,
    modeledAiUsd: 0,
    modeledCombinedUsd: 0,
    weightedOffshoreNum: 0,
    weightedAiNum: 0,
    weightedDen: 0,
  };
}

// Suppressed unused — `rowAnnualCost` is still exported by scenarioModel; we
// rely on `rowModeledSaving.pool` (which uses it internally). Kept here only
// as an intent comment.
void rowAnnualCost;
