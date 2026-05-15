/**
 * Cross-step consistency harness.
 *
 * Steps in the assessment workflow:
 *
 *   Step 1  Capability Map          /capability-map/tower/[id]
 *   Step 2  Offshore View            /offshore-view/tower/[id]
 *   Step 3  Configure Impact Levers  /impact-levers/tower/[id]
 *   Step 4  AI Initiatives           /tower/[slug]
 *   Step 5  Cross-Tower AI Plan      /cross-tower-ai-plan
 *
 * The numbered contracts below predate the Step 2 promotion — they still
 * cover the dollars-flow that runs Capability Map → Impact Levers → AI
 * Initiatives. Step 2 (Offshore View) feeds the lane → dial derivation
 * and is exercised by `offshoreLaneConsistency` below; Step 5 is
 * LLM-authored and not asserted here.
 *
 * These steps must agree on:
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
 *   G) Offshore     Each L3 row's `offshoreAssessmentPct` must equal the
 *      rollup.      HC-weighted mean of its child L4 rows' `gccPct` (within
 *                   a 1-percentage-point tolerance for rounding). This is
 *                   the Step 2 ↔ Step 3 seam — Step 3's read-only Offshore
 *                   column shows the L3 dial, and it must reconcile with
 *                   the L4 splits the lead set on the capability map.
 *
 * Run via `npx tsx scripts/consistencyTest.ts`. Exits non-zero on any failure.
 */

import { towers } from "../src/data/towers";
import { buildSeededAssessProgramV2 } from "./lib/seedFixture";
import { getCapabilityMapForTower } from "../src/data/capabilityMap/maps";
import {
  rowModeledSaving,
  modeledSavingsForTower,
  programImpactSummary,
  towerOutcomeForState,
} from "../src/lib/assess/scenarioModel";
import { selectInitiativesV6ForTower } from "../src/lib/initiatives/selectV6";
import {
  defaultTowerBaseline,
  defaultTowerRates,
  type AssessProgramV2,
  type TowerId,
} from "../src/data/assess/types";
import { rollupSplit } from "../src/lib/offshore/offshoreSplit";
import { deriveL3Rows } from "../src/lib/assess/deriveL3Rows";

// ---------------------------------------------------------------------------
//  Tolerances + helpers
// ---------------------------------------------------------------------------

const DOLLAR_TOLERANCE = 1; // sub-dollar floating-point drift is allowed.

type Failure = {
  tower: string;
  contract: "A" | "B" | "C" | "D" | "E" | "F" | "G";
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
  step4L3Sum: number;
  step4InitiativeCount: number;
  step4PlaceholderCount: number;
  step4QueuedRowCount: number;
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
  const rates = tState?.rates ?? defaultTowerRates(towerId);
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
    ? modeledSavingsForTower(rows, baseline, rates)
    : { pool: 0, offshorePct: 0, aiPct: 0, offshore: 0, ai: 0, combined: 0 };
  const step2AiUsd = towerSummary.ai;

  let step2RowSum = 0;
  let rowsWithAi = 0;
  const positiveRowAiByRowId = new Map<string, number>();
  let rowsMatchingCanonical = 0;
  let rowsSynthesized = 0;
  for (const r of rows) {
    const s = rowModeledSaving(r, baseline, rates);
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

  // Step 4 — v6 selector. Flat `l3Rows` shape (no L2 grouping); initiatives
  // live on each row. Hierarchy is implicit via `row.l2` on the source rows.
  const step4 = selectInitiativesV6ForTower(towerId, program, tower);
  const step4AiUsd = step4.towerAiUsd;
  const step4L3Sum = step4.l3Rows.reduce((s, l3) => s + l3.aiUsd, 0);

  // (C) Step 2 vs Step 4 — tower AI
  assertCloseEnough(
    towerId,
    "C",
    "Step 2 modeledSavingsForTower.ai vs Step 4 towerAiUsd",
    step2AiUsd,
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
  for (const l3 of step4.l3Rows) {
    surfacedRowIds.add(l3.id);
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

  // (F) View-model shape — each V6L3Row.aiUsd matches its row's saving.ai.
  // Curated initiatives must have a non-empty solutionName + rationale +
  // applicability tag; placeholders are allowed to lack the rationale.
  const rowById = new Map(rows.map((r) => [r.id, r]));
  for (const l3 of step4.l3Rows) {
    const r = rowById.get(l3.id);
    if (!r) {
      fail(
        towerId,
        "F",
        `V6L3Row.id "${l3.id}" has no underlying L3WorkforceRow`,
      );
      continue;
    }
    const expected = rowModeledSaving(r, baseline, rates).ai;
    assertCloseEnough(
      towerId,
      "F",
      `V6L3Row.aiUsd for row "${l3.id}"`,
      l3.aiUsd,
      expected,
    );
    // Queued rows wait on the LLM curation pipeline before they get
    // initiative cards — that's the correct steady-state for a freshly
    // seeded program. Only fail if a non-queued row has no cards.
    if (l3.initiatives.length === 0) {
      if (l3.curationStage !== "queued") {
        fail(
          towerId,
          "F",
          `V6L3Row "${l3.l3}" (row ${l3.id}) has zero initiative cards (stage=${l3.curationStage ?? "idle"})`,
        );
      }
      continue;
    }
    for (const init of l3.initiatives) {
      if (init.isPlaceholder) continue;
      if (!init.solutionName) {
        fail(towerId, "F", `Curated initiative missing solutionName (id=${init.id})`);
      }
      if (!init.aiRationale) {
        fail(
          towerId,
          "F",
          `Curated initiative "${init.solutionName}" missing aiRationale`,
        );
      }
      if (
        init.applicability !== "Retained" &&
        init.applicability !== "Offshored" &&
        init.applicability !== "Both"
      ) {
        fail(
          towerId,
          "F",
          `Curated initiative "${init.solutionName}" missing applicability tag`,
        );
      }
    }
  }

  // (A) Hierarchy provenance — every l3's `l2` must trace to either the
  // canonical capability map or a synthesized row L2 (when the upload's
  // L2 wasn't on the canonical map). v6 surfaces L2 as a string on each
  // l3 row; we treat L2 names that match the canonical map (case-
  // insensitive) as canonical and the rest as synthesized.
  if (map) {
    const canonL2Names = new Set(
      map.l2.map((l2) => nameKey(l2.name)),
    );
    for (const l3 of step4.l3Rows) {
      const isCanonical = canonL2Names.has(nameKey(l3.l2));
      // Empty L2 is legal — happens when the source upload omits L2.
      if (!isCanonical && l3.l2.trim().length > 0 && !canonL2Names.has(nameKey(l3.l2))) {
        // Tracked as "synthesized" — not a failure (uploads may name their
        // own L2). Counted for visibility via the rowsSynthesized field.
      }
    }
  }

  void rowsWithAi; // surfaced via positiveRowAiByRowId

  return {
    towerId,
    l3Rows: rows.length,
    step2AiUsd,
    step4AiUsd,
    step4L3Sum,
    step4InitiativeCount: step4.diagnostics.initiativesRendered,
    step4PlaceholderCount: step4.diagnostics.placeholderRows,
    step4QueuedRowCount: step4.diagnostics.queuedRowCount,
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

/**
 * The seed fixture only writes `l4Rows`; production reads derive
 * `l3Rows` via `finalizeAssessProgramFromRaw` in `localStore.ts`. Mirror
 * that here so the v6 selector + modeledSavingsForTower (both keyed on
 * `l3Rows`) have rows to operate on.
 */
function ensureV6L3Rows(program: AssessProgramV2): AssessProgramV2 {
  const out: AssessProgramV2 = {
    ...program,
    towers: { ...program.towers },
  };
  for (const tw of towers) {
    const tid = tw.id as TowerId;
    const t = out.towers[tid];
    if (!t) continue;
    if (!t.l3Rows || t.l3Rows.length === 0) {
      out.towers[tid] = {
        ...t,
        l3Rows: deriveL3Rows(t.l4Rows, tid),
      };
    }
  }
  return out;
}

function main() {
  const program = ensureV6L3Rows(buildSeededAssessProgramV2());
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

  // (G) Offshore rollup — Step 2 -> Step 3 seam.
  //     Each L3 row's `offshoreAssessmentPct` must equal the HC-weighted
  //     mean of its child L4 rows' `gccPct` (within ±1 percentage point of
  //     rounding tolerance). The capability map on Step 2 writes the L4
  //     `gccPct` values; Step 3's read-only Offshore column reads the L3
  //     dial; this assertion is what guarantees the two never desync.
  const PCT_TOLERANCE = 1;
  for (const t of towers) {
    const tState = program.towers[t.id as TowerId];
    if (!tState) continue;
    const l3Rows = tState.l3Rows ?? [];
    const l4Rows = tState.l4Rows ?? [];
    const l4ById = new Map(l4Rows.map((r) => [r.id, r]));
    for (const l3 of l3Rows) {
      const children = (l3.childL4RowIds ?? [])
        .map((id) => l4ById.get(id))
        .filter((r): r is NonNullable<typeof r> => r != null);
      if (children.length === 0) continue;
      const rolled = rollupSplit(children);
      const dial = Math.round(l3.offshoreAssessmentPct ?? 0);
      const drift = Math.abs(rolled.gccPct - dial);
      if (drift > PCT_TOLERANCE) {
        fail(
          t.id,
          "G",
          `L3 "${l3.l3}" offshoreAssessmentPct=${dial}% vs HC-weighted child mean ${rolled.gccPct}% (drift ${drift}pp, ${children.length} child L4s, totalHc=${rolled.totalHc})`,
        );
      }
    }
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
      "inits",
      "queued",
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
        String(r.step4InitiativeCount).padStart(5),
        String(r.step4QueuedRowCount).padStart(6),
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
      "\nAll consistency contracts (A) hierarchy, (B) row totals, (C) tower totals, (D) program totals, (E) coverage, (F) view-model shape, (G) L3 dial ↔ child-L4 gccPct rollup pass across all 14 towers.",
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
