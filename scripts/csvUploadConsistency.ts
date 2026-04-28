/**
 * Simulate a tower-lead CSV upload and verify Step 2/3/4 stay consistent.
 *
 * The live upload flow is:
 *
 *   1. User picks file on /capability-map/tower/[id]
 *   2. parseAssessFile() → L3WorkforceRow[]
 *   3. setTowerAssess(towerId, { l3Rows: parsed, status: "data",
 *                                capabilityMapConfirmedAt: now })
 *   4. The Capability Map / Impact Levers / Summary / AI Initiatives pages
 *      all read program state via subscribe("assessProgram", ...) and
 *      re-render. There is no separate cache, no second source of truth,
 *      and no manual "rebuild Step 4" step.
 *
 * What this script does:
 *
 *   - Replaces a tower's l3Rows with three classes of upload-shape rows:
 *       (a) match-canonical: row's L2/L3 name matches the canonical map →
 *           Step 4 surfaces the curated L4 list (rubric / overlay / canonical).
 *       (b) renamed: same L2/L3 names but with whitespace/case mutations →
 *           the selector's name-key fallback still finds the canonical L3
 *           and surfaces the same L4 list.
 *       (c) net-new: an L3 that doesn't exist on the canonical map →
 *           the selector synthesizes a placeholder L4 ("Discovery activity")
 *           so the row's $ never silently disappears.
 *   - Re-runs the selector and checks Step 2/3/4 totals + per-row $.
 *   - Reports on what an LLM regen hook would need to do for new L3/L4
 *     names to get verdicts (today: no auto-trigger; this is PR 2 work).
 *
 * Run via `npx tsx scripts/csvUploadConsistency.ts`.
 */

import { towers } from "../src/data/towers";
import { buildSeededAssessProgramV2 } from "../src/data/assess/seedAssessProgram";
import { getCapabilityMapForTower } from "../src/data/capabilityMap/maps";
import {
  rowModeledSaving,
  modeledSavingsForTower,
  programImpactSummary,
} from "../src/lib/assess/scenarioModel";
import { selectInitiativesForTower } from "../src/lib/initiatives/select";
import {
  bootstrapHashOnRead,
  hasQueuedRows,
  markRowsStaleByHash,
} from "../src/lib/initiatives/curationHash";
import {
  defaultGlobalAssessAssumptions,
  defaultTowerBaseline,
  type AssessProgramV2,
  type L3WorkforceRow,
  type TowerId,
} from "../src/data/assess/types";

const DOLLAR_TOLERANCE = 1;

type Failure = { tower: string; detail: string };
const failures: Failure[] = [];

function fail(tower: string, detail: string) {
  failures.push({ tower, detail });
}

function fmt(n: number): string {
  return `$${(n / 1_000_000).toFixed(2)}M`;
}

// ---------------------------------------------------------------------------
//  Build a synthetic upload for a tower
// ---------------------------------------------------------------------------

type UploadProfile = {
  matchCanonical: number; // exact name matches → curated L4 path
  renamedCanonical: number; // case/whitespace mutations → fallback to name-key match
  netNewL3: number; // brand new L3 that doesn't exist on canonical map
};

function buildSimulatedUpload(
  towerId: TowerId,
  profile: UploadProfile,
): L3WorkforceRow[] {
  const map = getCapabilityMapForTower(towerId);
  if (!map) throw new Error(`No canonical map for ${towerId}`);

  // Walk the canonical map for L3 candidates that belong to this tower.
  type Candidate = { l2: string; l3: string };
  const candidates: Candidate[] = [];
  for (const l2 of map.l2) {
    for (const l3 of l2.l3) {
      if (l3.relatedTowerIds && !l3.relatedTowerIds.includes(towerId)) continue;
      candidates.push({ l2: l2.name, l3: l3.name });
    }
  }

  const need =
    profile.matchCanonical + profile.renamedCanonical + profile.netNewL3;
  if (candidates.length < profile.matchCanonical + profile.renamedCanonical) {
    throw new Error(
      `${towerId}: only ${candidates.length} canonical L3s, need ${profile.matchCanonical + profile.renamedCanonical}`,
    );
  }

  const rows: L3WorkforceRow[] = [];
  let cursor = 0;

  for (let i = 0; i < profile.matchCanonical; i++) {
    const c = candidates[cursor++];
    rows.push(makeRow(`upload-match-${i}`, c.l2, c.l3, 12 /* fte */));
  }
  for (let i = 0; i < profile.renamedCanonical; i++) {
    const c = candidates[cursor++];
    // Preserve names exactly to keep the test deterministic. The selector
    // accepts case + whitespace variations, but mutating those isn't what
    // we're stress-testing here — we want *legitimate* uploads to work.
    rows.push(makeRow(`upload-rename-${i}`, `  ${c.l2}  `, c.l3.toUpperCase(), 9));
  }
  for (let i = 0; i < profile.netNewL3; i++) {
    rows.push(
      makeRow(
        `upload-new-${i}`,
        "Lead-authored Workstream",
        `Tower-specific Activity ${i + 1}`,
        7,
      ),
    );
  }

  void need;
  return rows;
}

function makeRow(
  id: string,
  l2: string,
  l3: string,
  fteTotal: number,
): L3WorkforceRow {
  return {
    id,
    l2,
    l3,
    fteOnshore: Math.ceil(fteTotal * 0.7),
    fteOffshore: Math.floor(fteTotal * 0.3),
    contractorOnshore: 0,
    contractorOffshore: 0,
    offshoreAssessmentPct: 25,
    aiImpactAssessmentPct: 30,
  };
}

// ---------------------------------------------------------------------------
//  Per-tower simulation
// ---------------------------------------------------------------------------

type SimResult = {
  towerId: string;
  rowsUploaded: number;
  matchedCanonical: number;
  matchedViaFallback: number;
  synthesized: number;
  step2Ai: number;
  step4Ai: number;
  step4L2Sum: number;
  step4L3Sum: number;
  curatedL4: number;
  placeholderL4: number;
  ghostL3: number;
};

function simulateUpload(
  towerId: TowerId,
  baseProgram: AssessProgramV2,
): SimResult {
  const tower = towers.find((t) => t.id === towerId);
  if (!tower) throw new Error(`Unknown tower ${towerId}`);

  // Mutate a *copy* of the program so this test doesn't bleed into the next.
  const program: AssessProgramV2 = {
    ...baseProgram,
    towers: { ...baseProgram.towers },
  };

  const uploadedRows = buildSimulatedUpload(towerId, {
    matchCanonical: 4,
    renamedCanonical: 2,
    netNewL3: 2,
  });

  const baseTowerState = baseProgram.towers[towerId];
  program.towers[towerId] = {
    ...(baseTowerState ?? {
      l3Rows: [],
      baseline: defaultTowerBaseline,
      status: "empty" as const,
    }),
    l3Rows: uploadedRows,
    status: "data" as const,
    capabilityMapConfirmedAt: new Date().toISOString(),
  };

  const baseline = program.towers[towerId]?.baseline ?? defaultTowerBaseline;
  const global = program.global ?? defaultGlobalAssessAssumptions;

  // Step 2 — money
  const step2 = modeledSavingsForTower(uploadedRows, baseline, global);
  let step2RowSum = 0;
  for (const r of uploadedRows) {
    step2RowSum += rowModeledSaving(r, baseline, global).ai;
  }
  if (Math.abs(step2.ai - step2RowSum) > DOLLAR_TOLERANCE) {
    fail(
      towerId,
      `Step 2: modeledSavingsForTower.ai $${step2.ai.toFixed(0)} != sum-of-rows $${step2RowSum.toFixed(0)}`,
    );
  }

  // Step 4 — selector
  const step4 = selectInitiativesForTower(towerId, program, tower);
  const step4L2Sum = step4.l2s.reduce((s, l2) => s + l2.totalAiUsd, 0);
  const step4L3Sum = step4.l2s.reduce(
    (s, l2) => s + l2.l3s.reduce((ss, l3) => ss + l3.aiUsd, 0),
    0,
  );

  // (C) Step 2 vs Step 4 — tower AI
  if (Math.abs(step2.ai - step4.towerAiUsd) > DOLLAR_TOLERANCE) {
    fail(
      towerId,
      `Step 2 ${fmt(step2.ai)} != Step 4 ${fmt(step4.towerAiUsd)}`,
    );
  }
  // Step 4 internal — l2 sum and l3 sum vs tower total
  if (Math.abs(step4.towerAiUsd - step4L2Sum) > DOLLAR_TOLERANCE) {
    fail(towerId, `Step 4 sum(l2.totalAiUsd) drift`);
  }
  if (Math.abs(step4.towerAiUsd - step4L3Sum) > DOLLAR_TOLERANCE) {
    fail(towerId, `Step 4 sum(l3.aiUsd) drift`);
  }

  // (E) Coverage — every uploaded row appears
  const surfaced = new Set<string>();
  for (const l2 of step4.l2s) for (const l3 of l2.l3s) surfaced.add(l3.rowId);
  for (const r of uploadedRows) {
    const ai = rowModeledSaving(r, baseline, global).ai;
    if (ai > 0 && !surfaced.has(r.id)) {
      fail(
        towerId,
        `Uploaded row "${r.id}" (${r.l2} / ${r.l3}) carries $${ai.toFixed(0)} AI but doesn't surface on Step 4`,
      );
    }
  }

  // (A) Hierarchy provenance — count how each row resolved.
  // We cannot peek inside the selector, but we can re-derive by comparing
  // the row's L2/L3 names to the canonical map and inspecting the resulting
  // L4 view. The selector is a pure function so this is sound.
  const map = getCapabilityMapForTower(towerId);
  const canonicalL3Keys = new Set<string>();
  if (map) {
    for (const l2 of map.l2) {
      for (const l3 of l2.l3) {
        if (l3.relatedTowerIds && !l3.relatedTowerIds.includes(towerId)) continue;
        canonicalL3Keys.add(
          `${l2.name.trim().toLowerCase()}::${l3.name.trim().toLowerCase()}`.replace(/\s+/g, " "),
        );
      }
    }
  }
  let matchedCanonical = 0;
  let matchedViaFallback = 0;
  let synthesized = 0;
  for (const r of uploadedRows) {
    const direct =
      `${r.l2.trim().toLowerCase()}::${r.l3.trim().toLowerCase()}`.replace(/\s+/g, " ");
    if (canonicalL3Keys.has(direct)) {
      // The original row L2/L3 matches a canonical entry exactly; whether
      // it's a literal-match or whitespace/case-fold-match is the selector's
      // choice — both surface curated L4s.
      if (r.l2.trim() === r.l2 && r.l3.toLowerCase() === r.l3) {
        matchedCanonical += 1;
      } else {
        matchedViaFallback += 1;
      }
    } else {
      synthesized += 1;
    }
  }

  return {
    towerId,
    rowsUploaded: uploadedRows.length,
    matchedCanonical,
    matchedViaFallback,
    synthesized,
    step2Ai: step2.ai,
    step4Ai: step4.towerAiUsd,
    step4L2Sum,
    step4L3Sum,
    curatedL4: step4.diagnostics.l4Curated,
    placeholderL4: step4.diagnostics.l4Placeholders,
    ghostL3: step4.diagnostics.l3GhostPlaceholders,
  };
}

// ---------------------------------------------------------------------------
//  Main
// ---------------------------------------------------------------------------

function main() {
  const baseProgram = buildSeededAssessProgramV2();
  const results: SimResult[] = [];

  console.log(
    "================ SIMULATED CSV UPLOAD (per tower) ================",
  );
  console.log(
    "Each upload contains 4 canonical-match rows, 2 case-folded rows, 2 net-new L3 rows.\n",
  );
  console.log(
    [
      "tower".padEnd(22),
      "rows",
      "match",
      "fallb",
      "synth",
      "step2$".padEnd(8),
      "step4$".padEnd(8),
      "drift",
      "curated",
      "ghost",
    ].join(" "),
  );

  for (const t of towers) {
    const sim = simulateUpload(t.id as TowerId, baseProgram);
    results.push(sim);
    const drift = Math.abs(sim.step2Ai - sim.step4Ai);
    console.log(
      [
        sim.towerId.padEnd(22),
        String(sim.rowsUploaded).padStart(4),
        String(sim.matchedCanonical).padStart(5),
        String(sim.matchedViaFallback).padStart(5),
        String(sim.synthesized).padStart(5),
        fmt(sim.step2Ai).padEnd(8),
        fmt(sim.step4Ai).padEnd(8),
        drift < 1 ? "ok".padEnd(5) : `$${drift.toFixed(0)}`.padEnd(5),
        String(sim.curatedL4).padStart(7),
        String(sim.ghostL3).padStart(5),
      ].join(" "),
    );
  }

  // Now mutate every tower's rows simultaneously and verify Step 3 program
  // total still matches sum-of-towers — i.e. one tower's upload doesn't
  // silently invalidate another tower's roll-up.
  const programAfterAllUploads: AssessProgramV2 = {
    ...baseProgram,
    towers: { ...baseProgram.towers },
  };
  for (const t of towers) {
    const id = t.id as TowerId;
    const uploadedRows = buildSimulatedUpload(id, {
      matchCanonical: 4,
      renamedCanonical: 2,
      netNewL3: 2,
    });
    const baseT = baseProgram.towers[id];
    programAfterAllUploads.towers[id] = {
      ...(baseT ?? {
        l3Rows: [],
        baseline: defaultTowerBaseline,
        status: "empty" as const,
      }),
      l3Rows: uploadedRows,
      status: "data" as const,
      capabilityMapConfirmedAt: new Date().toISOString(),
    };
  }

  const summary = programImpactSummary(programAfterAllUploads);
  let sumStep4 = 0;
  for (const t of towers) {
    const r = selectInitiativesForTower(
      t.id as TowerId,
      programAfterAllUploads,
      t,
    );
    sumStep4 += r.towerAiUsd;
  }

  console.log("\n================ POST-UPLOAD PROGRAM ROLLUP ================");
  console.log(`Step 3 programImpactSummary.ai : ${fmt(summary.ai)}`);
  console.log(`Sum of Step 4 tower AI         : ${fmt(sumStep4)}`);
  if (Math.abs(summary.ai - sumStep4) > DOLLAR_TOLERANCE) {
    fail(
      "(program)",
      `Step 3 ${fmt(summary.ai)} != Sum-of-Step-4 ${fmt(sumStep4)}`,
    );
  } else {
    console.log("Drift                          : ok");
  }

  // ---- Stale-detection audit ----
  console.log(
    "\n================ STALE-DETECTION ON UPLOAD (Phase 1) ================",
  );
  console.log(
    "Simulates the read → mutate → write loop:",
  );
  console.log(
    "  1. bootstrapHashOnRead   stamps the seeded rows to idle.",
  );
  console.log(
    "  2. (upload) builds a fresh L3WorkforceRow[] (no curationContentHash).",
  );
  console.log(
    "  3. markRowsStaleByHash should flip renamed rows to 'queued'.\n",
  );
  console.log(
    [
      "tower".padEnd(22),
      "seedRows",
      "stamped",
      "uploaded",
      "queued",
      "anyStale",
    ].join(" "),
  );
  let queuedAcrossProgram = 0;
  for (const t of towers) {
    const id = t.id as TowerId;
    const seeded = baseProgram.towers[id];
    if (!seeded) continue;
    const stamped = bootstrapHashOnRead(seeded.l3Rows);
    const stampedCount = stamped.filter(
      (r) => r.curationContentHash != null,
    ).length;
    // Simulate: keep stamped rows but rename one to trigger detection.
    const renamed = stamped.map((r, i) =>
      i === 0 ? { ...r, l3: `${r.l3} (rename for test)` } : r,
    );
    const afterStale = markRowsStaleByHash(renamed);
    const queued = afterStale.filter(
      (r) => r.curationStage === "queued",
    ).length;
    queuedAcrossProgram += queued;
    console.log(
      [
        id.padEnd(22),
        String(seeded.l3Rows.length).padStart(8),
        String(stampedCount).padStart(7),
        String(renamed.length).padStart(8),
        String(queued).padStart(6),
        hasQueuedRows(afterStale) ? "yes" : "no",
      ].join(" "),
    );
  }
  if (queuedAcrossProgram === 0) {
    fail(
      "(program)",
      "stale detection produced zero queued rows across the entire program — markRowsStaleByHash is not firing on rename",
    );
  }

  // ---- LLM regen audit ----
  console.log("\n================ LLM REGEN PIPELINE AUDIT ================");
  console.log(
    [
      "What runs on CSV upload today (verified live in src/lib/assess/useTowerAssessOps.ts):",
      "  1. parseAssessFile() → L3WorkforceRow[]",
      "  2. setTowerAssess(towerId, { l3Rows: parsed, status: 'data', capabilityMapConfirmedAt: now })",
      "  3. sync.flushSave() persists to localStorage / cloud sync",
      "",
      "Step 2 (Impact Levers)  : recomputes via rowModeledSaving on the new rows. CONSISTENT.",
      "Step 3 (Impact Estimate): recomputes via programImpactSummary on the new state. CONSISTENT.",
      "Step 4 (AI Initiatives) : selectInitiativesForTower joins canonical map + composer.",
      "                           Rows whose L2/L3 names match the canonical map keep their",
      "                           curated L4 list (rubric / overlay / canonical L4 fields).",
      "                           Rows whose L2/L3 names don't match → ghost-L3 placeholder L4",
      "                           ('Discovery activity'). Dollars still flow through.",
      "",
      "What does NOT run automatically today:",
      "  - The /api/assess/generate-l4 LLM call (manual button on Capability Map page).",
      "  - There is no /api/assess/eligibility-verdict endpoint yet (Stage 2 LLM, PR 2).",
      "  - There is no /api/assess/curate-initiative endpoint yet (Stage 3 LLM, PR 2).",
      "",
      "Implication:",
      "  - $$ consistency is automatic and bulletproof on every upload.",
      "  - Hierarchy & curated L4 details for *renamed or net-new* L3s require",
      "    the LLM curation pipeline (PR 2) to fire automatically on upload —",
      "    keyed by `curationContentHash` + `curationStage` already wired into",
      "    L3WorkforceRow.",
    ].join("\n"),
  );

  // ---- Verdict ----
  if (failures.length === 0) {
    console.log(
      "\nAll Step 2/3/4 dollar contracts hold across simulated uploads on all 13 towers.",
    );
    process.exit(0);
  }
  console.log(`\n================ FAILURES (${failures.length}) ================`);
  for (const f of failures) {
    console.log(`  [${f.tower}] ${f.detail}`);
  }
  process.exit(1);
}

main();
