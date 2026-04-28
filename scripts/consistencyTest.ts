/**
 * Cross-step consistency harness.
 *
 * Steps in the assessment workflow:
 *
 *   Step 1  Capability Map         /capability-map/tower/[id]
 *   Step 2  Configure Impact Levers /impact-levers/tower/[id]
 *   Step 3  Impact Estimate         /impact-levers/summary
 *   Step 4  AI Initiatives          /tower/[slug]
 *
 * These four steps must agree on:
 *
 *   A) Hierarchy.   Step 4's L2/L3 panels must come from the same canonical
 *                   capability map shown on Step 1 (or be synthesized from
 *                   the user's L3WorkforceRow when the row's name doesn't
 *                   match the canonical map).
 *
 *   B) Per-L3 $.    Per-L3 AI savings on Step 4 must equal `rowModeledSaving`
 *                   used by Step 2's L3LeverRow. There is one savings model
 *                   in the app — `lib/assess/scenarioModel.ts` — and every
 *                   step routes through it.
 *
 *   C) Tower $.     Step 2's `modeledSavingsForTower(...).ai` ===
 *                   Step 4's `selectInitiativesForTower(...).towerAiUsd`.
 *                   They must match within sub-dollar tolerance.
 *
 *   D) Program $.   Step 3's `programImpactSummary(program).ai` ===
 *                   sum of every tower's Step 2 AI total ===
 *                   sum of every tower's Step 4 `towerAiUsd`.
 *
 *   E) Coverage.    Every L3 with `aiPct > 0` must surface on Step 4 —
 *                   either with a curated L4 or with a "Discovery activity"
 *                   placeholder. No L3 with positive AI $ may silently drop.
 *
 *   F) View shape.  Every InitiativeL3.aiUsd must exactly match the underlying
 *                   row's `rowModeledSaving(...).ai`.
 *
 * Run via `npx tsx scripts/consistencyTest.ts`. Exits non-zero on any failure.
 */

import { towers } from "../src/data/towers";
import { buildSeededAssessProgramV2 } from "../src/data/assess/seedAssessProgram";
import { getCapabilityMapForTower } from "../src/data/capabilityMap/maps";
import {
  rowModeledSaving,
  modeledSavingsForTower,
  programImpactSummary,
  towerOutcomeForState,
} from "../src/lib/assess/scenarioModel";
import { selectInitiativesForTower } from "../src/lib/initiatives/select";
import {
  defaultGlobalAssessAssumptions,
  defaultTowerBaseline,
  type AssessProgramV2,
  type TowerId,
} from "../src/data/assess/types";

// ---------------------------------------------------------------------------
//  Tolerances + helpers
// ---------------------------------------------------------------------------

const DOLLAR_TOLERANCE = 1; // sub-dollar floating-point drift is allowed.

type Failure = {
  tower: string;
  contract: "A" | "B" | "C" | "D" | "E" | "F";
  detail: string;
};

const failures: Failure[] = [];

function fail(tower: string, contract: Failure["contract"], detail: string) {
  failures.push({ tower, contract, detail });
}

function nameKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function assertCloseEnough(
  tower: string,
  contract: Failure["contract"],
  label: string,
  a: number,
  b: number,
) {
  const diff = Math.abs(a - b);
  if (diff > DOLLAR_TOLERANCE) {
    fail(
      tower,
      contract,
      `${label}: $${a.toFixed(2)} vs $${b.toFixed(2)} (drift $${diff.toFixed(2)})`,
    );
  }
}

// ---------------------------------------------------------------------------
//  Per-tower run
// ---------------------------------------------------------------------------

type TowerReport = {
  towerId: string;
  l3Rows: number;
  step2AiUsd: number;
  step4AiUsd: number;
  step4L2Sum: number;
  step4L3Sum: number;
  step4Curated: number;
  step4Placeholders: number;
  step4Ghost: number;
  step1L2Count: number;
  step1L3Count: number;
  step1L4Count: number;
  rowsMatchingCanonical: number;
  rowsSynthesized: number;
};

function runTower(
  towerId: TowerId,
  program: AssessProgramV2,
): TowerReport {
  const tower = towers.find((t) => t.id === towerId);
  if (!tower) throw new Error(`Unknown tower ${towerId}`);

  const tState = program.towers[towerId];
  const baseline = tState?.baseline ?? defaultTowerBaseline;
  const global = program.global ?? defaultGlobalAssessAssumptions;
  const rows = tState?.l3Rows ?? [];

  // Step 1 — canonical capability map
  const map = getCapabilityMapForTower(towerId);
  let step1L2Count = 0;
  let step1L3Count = 0;
  let step1L4Count = 0;
  const canonL3NameSet = new Set<string>();
  if (map) {
    step1L2Count = map.l2.length;
    for (const l2 of map.l2) {
      for (const l3 of l2.l3) {
        if (l3.relatedTowerIds && !l3.relatedTowerIds.includes(towerId)) continue;
        step1L3Count += 1;
        canonL3NameSet.add(`${nameKey(l2.name)}::${nameKey(l3.name)}`);
        for (const l4 of l3.l4) {
          if (l4.relatedTowerIds && !l4.relatedTowerIds.includes(towerId)) continue;
          step1L4Count += 1;
        }
      }
    }
  }

  // Step 2 — per-L3 + tower modeled savings
  const towerSummary = rows.length
    ? modeledSavingsForTower(rows, baseline, global)
    : { pool: 0, offshorePct: 0, aiPct: 0, offshore: 0, ai: 0, combined: 0 };
  const step2AiUsd = towerSummary.ai;

  let step2RowSum = 0;
  let rowsWithAi = 0;
  const positiveRowAiByRowId = new Map<string, number>();
  let rowsMatchingCanonical = 0;
  let rowsSynthesized = 0;
  for (const r of rows) {
    const s = rowModeledSaving(r, baseline, global);
    step2RowSum += s.ai;
    if (s.ai > 0) {
      rowsWithAi += 1;
      positiveRowAiByRowId.set(r.id, s.ai);
    }
    if (canonL3NameSet.has(`${nameKey(r.l2)}::${nameKey(r.l3)}`)) {
      rowsMatchingCanonical += 1;
    } else {
      rowsSynthesized += 1;
    }
  }

  // (B) Step 2 sum-of-rows must match towerSummary.ai
  assertCloseEnough(
    towerId,
    "B",
    "Step 2 sum(rowModeledSaving.ai) vs modeledSavingsForTower.ai",
    step2RowSum,
    step2AiUsd,
  );

  // Step 4 — selector
  const step4 = selectInitiativesForTower(towerId, program, tower);
  const step4AiUsd = step4.towerAiUsd;
  const step4L2Sum = step4.l2s.reduce((s, l2) => s + l2.totalAiUsd, 0);
  const step4L3Sum = step4.l2s.reduce(
    (s, l2) => s + l2.l3s.reduce((ss, l3) => ss + l3.aiUsd, 0),
    0,
  );

  // (C) Step 2 vs Step 4 — tower AI
  assertCloseEnough(
    towerId,
    "C",
    "Step 2 modeledSavingsForTower.ai vs Step 4 towerAiUsd",
    step2AiUsd,
    step4AiUsd,
  );

  // (B) Step 4 internal — l2 sum vs tower total
  assertCloseEnough(
    towerId,
    "B",
    "Step 4 sum(l2.totalAiUsd) vs Step 4 towerAiUsd",
    step4L2Sum,
    step4AiUsd,
  );

  // (B) Step 4 internal — l3 sum vs tower total
  assertCloseEnough(
    towerId,
    "B",
    "Step 4 sum(l3.aiUsd) vs Step 4 towerAiUsd",
    step4L3Sum,
    step4AiUsd,
  );

  // (E) Coverage — every row with AI > 0 surfaces in Step 4
  const surfacedRowIds = new Set<string>();
  for (const l2 of step4.l2s) {
    for (const l3 of l2.l3s) {
      surfacedRowIds.add(l3.rowId);
    }
  }
  for (const [rowId, dollars] of positiveRowAiByRowId) {
    if (!surfacedRowIds.has(rowId)) {
      fail(
        towerId,
        "E",
        `Row "${rowId}" has $${dollars.toFixed(0)} AI on Step 2 but does not appear on Step 4`,
      );
    }
  }

  // (F) View-model shape — each InitiativeL3.aiUsd matches its row's saving.ai
  const rowById = new Map(rows.map((r) => [r.id, r]));
  for (const l2 of step4.l2s) {
    for (const l3 of l2.l3s) {
      const r = rowById.get(l3.rowId);
      if (!r) {
        fail(
          towerId,
          "F",
          `InitiativeL3.rowId "${l3.rowId}" has no underlying L3WorkforceRow`,
        );
        continue;
      }
      const expected = rowModeledSaving(r, baseline, global).ai;
      assertCloseEnough(
        towerId,
        "F",
        `InitiativeL3.aiUsd for row "${l3.rowId}"`,
        l3.aiUsd,
        expected,
      );
      // Every InitiativeL3 must carry at least one L4 view (curated or placeholder)
      if (l3.l4s.length === 0) {
        fail(
          towerId,
          "F",
          `InitiativeL3 "${l3.l3.name}" (row ${l3.rowId}) has zero l4 views`,
        );
      }
      // Every curated L4 (non-placeholder) must have a name + priority + rationale
      for (const l4 of l3.l4s) {
        if (l4.isPlaceholder) continue;
        if (!l4.name) {
          fail(towerId, "F", `Curated L4 missing name (id=${l4.id})`);
        }
        if (!l4.aiPriority) {
          fail(
            towerId,
            "F",
            `Curated L4 "${l4.name}" missing aiPriority`,
          );
        }
        if (!l4.aiRationale) {
          fail(
            towerId,
            "F",
            `Curated L4 "${l4.name}" missing aiRationale`,
          );
        }
      }
    }
  }

  // (A) Hierarchy provenance — Step 4 L2 ids should be canonical or synthesized.
  // We don't fail on synthesized L2s (they're legal when an upload has a row
  // whose L2 name isn't on the canonical map) — but we count them so reports
  // surface unexpected drift.
  if (map) {
    const canonL2Ids = new Set(map.l2.map((l2) => l2.id));
    for (const l2 of step4.l2s) {
      const isCanonical = canonL2Ids.has(l2.l2.id);
      const isSynthesized = l2.l2.id.startsWith("__row-l2:");
      if (!isCanonical && !isSynthesized) {
        fail(
          towerId,
          "A",
          `Step 4 L2 "${l2.l2.name}" (id=${l2.l2.id}) is neither canonical nor synthesized`,
        );
      }
    }
  }

  void rowsWithAi; // surfaced via positiveRowAiByRowId

  return {
    towerId,
    l3Rows: rows.length,
    step2AiUsd,
    step4AiUsd,
    step4L2Sum,
    step4L3Sum,
    step4Curated: step4.diagnostics.l4Curated,
    step4Placeholders: step4.diagnostics.l4Placeholders,
    step4Ghost: step4.diagnostics.l3GhostPlaceholders,
    step1L2Count,
    step1L3Count,
    step1L4Count,
    rowsMatchingCanonical,
    rowsSynthesized,
  };
}

// ---------------------------------------------------------------------------
//  Program-wide run
// ---------------------------------------------------------------------------

function main() {
  const program = buildSeededAssessProgramV2();
  const reports: TowerReport[] = [];
  for (const t of towers) {
    reports.push(runTower(t.id as TowerId, program));
  }

  // (D) Step 3 program total === sum of Step 2 tower totals === sum of Step 4 tower totals
  const summary = programImpactSummary(program);
  const sumStep2 = reports.reduce((s, r) => s + r.step2AiUsd, 0);
  const sumStep4 = reports.reduce((s, r) => s + r.step4AiUsd, 0);
  if (Math.abs(summary.ai - sumStep2) > DOLLAR_TOLERANCE) {
    fail(
      "(program)",
      "D",
      `programImpactSummary.ai $${summary.ai.toFixed(0)} vs sum-of-step2 $${sumStep2.toFixed(0)}`,
    );
  }
  if (Math.abs(summary.ai - sumStep4) > DOLLAR_TOLERANCE) {
    fail(
      "(program)",
      "D",
      `programImpactSummary.ai $${summary.ai.toFixed(0)} vs sum-of-step4 $${sumStep4.toFixed(0)}`,
    );
  }

  // Also assert that programImpactSummary's tower-level computation matches
  // towerOutcomeForState — guards against a bug where the rollup uses
  // different math than the per-tower call.
  for (const t of towers) {
    const outcome = towerOutcomeForState(t.id as TowerId, program);
    if (!outcome) continue;
    const r = reports.find((x) => x.towerId === t.id);
    if (!r) continue;
    if (Math.abs(outcome.ai - r.step2AiUsd) > DOLLAR_TOLERANCE) {
      fail(
        t.id,
        "D",
        `towerOutcomeForState.ai $${outcome.ai.toFixed(0)} vs modeledSavingsForTower.ai $${r.step2AiUsd.toFixed(0)}`,
      );
    }
  }

  // ---- Render ----
  const fmt = (n: number) => `$${(n / 1_000_000).toFixed(2)}M`;
  const pct = (a: number, b: number) =>
    b === 0 ? "0%" : `${((a / b) * 100).toFixed(1)}%`;

  console.log("\n================ PER-TOWER ================");
  console.log(
    [
      "tower".padEnd(22),
      "rows",
      "canon",
      "synth",
      "step1L4".padEnd(7),
      "step2$".padEnd(8),
      "step4$".padEnd(8),
      "delta",
      "curated",
      "ghost",
    ].join(" "),
  );
  for (const r of reports) {
    const delta = Math.abs(r.step2AiUsd - r.step4AiUsd);
    console.log(
      [
        r.towerId.padEnd(22),
        String(r.l3Rows).padStart(4),
        String(r.rowsMatchingCanonical).padStart(5),
        String(r.rowsSynthesized).padStart(5),
        String(r.step1L4Count).padEnd(7),
        fmt(r.step2AiUsd).padEnd(8),
        fmt(r.step4AiUsd).padEnd(8),
        delta < 1 ? "ok".padEnd(5) : `$${delta.toFixed(0)}`.padEnd(5),
        String(r.step4Curated).padStart(7),
        String(r.step4Ghost).padStart(5),
      ].join(" "),
    );
  }

  console.log("\n================ PROGRAM ROLLUP ================");
  console.log(`Step 3 programImpactSummary.ai : ${fmt(summary.ai)}`);
  console.log(`Sum of step 2 tower AI         : ${fmt(sumStep2)}`);
  console.log(`Sum of step 4 tower AI         : ${fmt(sumStep4)}`);
  console.log(
    `Step 2 ↔ Step 3 drift          : ${fmt(Math.abs(summary.ai - sumStep2))} (${pct(Math.abs(summary.ai - sumStep2), summary.ai)})`,
  );
  console.log(
    `Step 3 ↔ Step 4 drift          : ${fmt(Math.abs(summary.ai - sumStep4))} (${pct(Math.abs(summary.ai - sumStep4), summary.ai)})`,
  );

  // ---- Verdict ----
  if (failures.length === 0) {
    console.log(
      "\nAll consistency contracts (A) hierarchy, (B) row totals, (C) tower totals, (D) program totals, (E) coverage, (F) view-model shape pass across all 13 towers.",
    );
    process.exit(0);
  }

  console.log(`\n================ FAILURES (${failures.length}) ================`);
  const byContract = new Map<string, Failure[]>();
  for (const f of failures) {
    const key = f.contract;
    if (!byContract.has(key)) byContract.set(key, []);
    byContract.get(key)!.push(f);
  }
  for (const [contract, list] of Array.from(byContract.entries()).sort()) {
    console.log(`\nContract (${contract}) — ${list.length} failure${list.length === 1 ? "" : "s"}:`);
    for (const f of list) {
      console.log(`  [${f.tower}] ${f.detail}`);
    }
  }
  process.exit(1);
}

main();
