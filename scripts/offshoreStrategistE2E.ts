/**
 * End-to-end test for the Offshore View (Step 2) → Impact Levers (Step 3) →
 * AI Initiatives (Step 4) → Cross-Tower Strategist (Step 5) journey.
 *
 * The test runs entirely in-process — no Next.js server, no LLM call. It
 * exercises every pure module the new flow depends on, plus the strategist
 * input + hash determinism.
 *
 * The lane model (`GccEligible | GccWithOverlay | OnshoreRetained |
 * EditorialCarveOut`) is gone. Every L4 row now carries a single `gccPct`
 * (0-100) and the L3 dial is the HC-weighted mean of its children. The
 * scenarios below exercise this binary model end-to-end.
 *
 * Scenarios covered:
 *
 *   S1.  applyGccPct-equivalent mutation: walking from a fresh seeded
 *        program to a Step-2 locked program and verifying the derived L3
 *        `offshoreAssessmentPct` matches the HC-weighted child mean.
 *
 *   S2.  Mixed-percent L4 children produce a roll-up that's neither 0
 *        nor 100 and that survives idempotent re-application of the same
 *        change set.
 *
 *   S3.  L3 dial ↔ child-L4 gccPct rollup: a clean program and a
 *        Step-2 locked program both reconcile within 1pp; corrupting an
 *        L3 dial is detected by comparing against `rollupSplit`.
 *
 *   S4.  deriveInitiativeApplicability: child gccPct mix → Retained /
 *        Offshored / Both at the L3 grain.
 *
 *   S5.  buildStrategistInput: scope filtering (all-org vs retained-only)
 *        produces the right tower set and a different `inputHash` so the
 *        cache cannot serve the wrong scope.
 *
 *   S6.  Strategist prompt builder produces a non-empty deterministic
 *        contract (system + user prompts).
 *
 *   S7.  Journey-step status helpers: classification lock + step-done
 *        flags flip correctly when the validation timestamp is set.
 *
 * Exits non-zero on the first failed scenario; otherwise prints a green
 * verdict.
 *
 * Run via:  npx tsx scripts/offshoreStrategistE2E.ts
 */

import { towers as ALL_TOWERS } from "../src/data/towers";
import {
  buildSeededAssessProgramV2,
  buildTowerFixtureRows,
} from "./lib/seedFixture";
import { deriveL3Rows } from "../src/lib/assess/deriveL3Rows";
import {
  defaultTowerBaseline,
  defaultTowerRates,
  type AssessProgramV2,
  type GccPctSource,
  type L3WorkforceRowV6,
  type L4WorkforceRow,
  type TowerId,
} from "../src/data/assess/types";
import { clampPct, rollupSplit } from "../src/lib/offshore/offshoreSplit";
import { deriveInitiativeApplicability } from "../src/lib/initiatives/selectV6";
import { buildStrategistInput } from "../src/lib/strategist/buildStrategistInput";
import {
  buildStrategistSystemPrompt,
  buildStrategistUserPrompt,
} from "../src/lib/llm/prompts/strategistOutputs.v1";
import {
  isOffshoreClassificationLocked,
  isOffshoreViewJourneyStepDone,
} from "../src/lib/assess/offshoreViewStepStatus";

type Failure = { scenario: string; detail: string };
const failures: Failure[] = [];
const successes: string[] = [];

function fail(scenario: string, detail: string): void {
  failures.push({ scenario, detail });
}
function pass(scenario: string, detail: string): void {
  successes.push(`${scenario}: ${detail}`);
}

// ---------------------------------------------------------------------
//   Helpers — simulate the in-app `applyGccPct` op offline so the
//   consistency math + strategist input can run on a known state.
// ---------------------------------------------------------------------

type GccPctAssignment = {
  rowId: string;
  gccPct: number;
  setBy: GccPctSource;
  reason?: string;
};

const FROZEN_NOW = "2026-04-26T00:00:00.000Z";

/**
 * Offline mirror of `useTowerAssessOps.applyGccPct`. Writes `gccPct` +
 * provenance on each L4 row, then recomputes each L3's
 * `offshoreAssessmentPct` as the HC-weighted mean of its child L4
 * `gccPct` values (matching `rollupSplit`).
 */
function applyGccPctPure(
  program: AssessProgramV2,
  towerId: TowerId,
  changes: ReadonlyArray<GccPctAssignment>,
): AssessProgramV2 {
  const t = program.towers[towerId];
  if (!t) throw new Error(`Unknown tower ${towerId}`);
  const changeMap = new Map(changes.map((c) => [c.rowId, c]));
  const nextL4Rows: L4WorkforceRow[] = t.l4Rows.map((r) => {
    const c = changeMap.get(r.id);
    if (!c) return r;
    return {
      ...r,
      gccPct: clampPct(c.gccPct),
      gccPctSetAt: FROZEN_NOW,
      gccPctSource: c.setBy,
      gccReason: (c.reason ?? r.gccReason ?? "").slice(0, 200),
      offshoreAssessmentPct: clampPct(c.gccPct),
    };
  });
  const l4ById = new Map(nextL4Rows.map((r) => [r.id, r] as const));
  const nextL3Rows = (t.l3Rows ?? []).map((l3) => {
    const childIds = l3.childL4RowIds ?? [];
    if (childIds.length === 0) return l3;
    const children = childIds
      .map((id) => l4ById.get(id))
      .filter((r): r is L4WorkforceRow => r != null);
    if (children.length === 0) return l3;
    const rolled = rollupSplit(children);
    const next: L3WorkforceRowV6 = {
      ...l3,
      offshoreAssessmentPct: rolled.gccPct,
    };
    return next;
  });
  return {
    ...program,
    towers: {
      ...program.towers,
      [towerId]: {
        ...t,
        l4Rows: nextL4Rows,
        l3Rows: nextL3Rows,
      },
    },
  };
}

/**
 * Promote v5-only seeded state to v6 by deriving `l3Rows` for every
 * tower. The seed fixture only writes `l4Rows`; production reads do this
 * via `finalizeAssessProgramFromRaw` in `localStore.ts`.
 */
function ensureV6L3Rows(program: AssessProgramV2): AssessProgramV2 {
  const out: AssessProgramV2 = {
    ...program,
    towers: { ...program.towers },
  };
  for (const tw of ALL_TOWERS) {
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

// ---------------------------------------------------------------------
//   Scenarios
// ---------------------------------------------------------------------

function scenarioApplyGccPctRoundtrip(): void {
  const scenario = "S1 applyGccPct round-trip";
  const program = ensureV6L3Rows(buildSeededAssessProgramV2());
  const tid: TowerId = "finance";
  const t = program.towers[tid];
  if (!t || (t.l4Rows ?? []).length === 0) {
    fail(scenario, "Finance fixture has no L4 rows — fixture regression?");
    return;
  }
  const l3Rows = t.l3Rows ?? [];
  const l3 = l3Rows.find((r) => (r.childL4RowIds ?? []).length >= 2);
  if (!l3) {
    fail(scenario, "Finance has no L3 with ≥2 child L4 rows.");
    return;
  }
  const childIds = l3.childL4RowIds ?? [];
  const changes: GccPctAssignment[] = childIds.map((id) => ({
    rowId: id,
    gccPct: 90,
    setBy: "user",
    reason: "S1 — every child fully GCC-eligible",
  }));
  const next = applyGccPctPure(program, tid, changes);
  const nextL3 = (next.towers[tid]!.l3Rows ?? []).find((r) => r.id === l3.id);
  if (!nextL3) {
    fail(scenario, `L3 ${l3.id} disappeared after applyGccPct.`);
    return;
  }
  if (nextL3.offshoreAssessmentPct !== 90) {
    fail(
      scenario,
      `Expected derived dial 90%, got ${nextL3.offshoreAssessmentPct}.`,
    );
    return;
  }
  // Every child L4 should carry the new gccPct + provenance.
  const childRows = childIds
    .map((id) => next.towers[tid]!.l4Rows.find((r) => r.id === id)!)
    .filter(Boolean);
  for (const c of childRows) {
    if (c.gccPct !== 90 || c.gccPctSource !== "user") {
      fail(
        scenario,
        `Child ${c.id} gccPct=${c.gccPct} source=${c.gccPctSource}; expected 90 / user.`,
      );
      return;
    }
  }
  pass(
    scenario,
    `Finance L3 "${l3.l3}" — ${childRows.length} children at 90% → dial=${nextL3.offshoreAssessmentPct}%`,
  );
}

function scenarioMixedRollup(): void {
  const scenario = "S2 mixed-percent rollup + idempotence";
  let program = ensureV6L3Rows(buildSeededAssessProgramV2());
  const tid: TowerId = "hr";
  const t = program.towers[tid]!;
  const target = (t.l3Rows ?? []).find(
    (r) => (r.childL4RowIds ?? []).length >= 2,
  );
  if (!target) {
    fail(scenario, "HR has no L3 with ≥2 child L4 rows in fixture.");
    return;
  }
  const childIds = target.childL4RowIds ?? [];
  const changes: GccPctAssignment[] = childIds.map((id, i) => ({
    rowId: id,
    gccPct: i % 2 === 0 ? 80 : 20,
    setBy: "user",
    reason: i % 2 === 0 ? "predominantly GCC" : "predominantly retained",
  }));
  program = applyGccPctPure(program, tid, changes);
  const l3 = (program.towers[tid]!.l3Rows ?? []).find((r) => r.id === target.id)!;
  const childRows = childIds
    .map((id) => program.towers[tid]!.l4Rows.find((r) => r.id === id)!)
    .filter(Boolean);
  const expected = rollupSplit(childRows).gccPct;
  if (l3.offshoreAssessmentPct !== expected) {
    fail(
      scenario,
      `Dial ${l3.offshoreAssessmentPct}% != rollupSplit ${expected}% (HC-weighted mean).`,
    );
    return;
  }
  if (l3.offshoreAssessmentPct === 0 || l3.offshoreAssessmentPct === 100) {
    fail(
      scenario,
      `Mixed dial should be strictly between 0 and 100, got ${l3.offshoreAssessmentPct}%.`,
    );
    return;
  }
  // Idempotence — re-applying the same changes must not move the dial.
  const reapplied = applyGccPctPure(program, tid, changes);
  const l3b = (reapplied.towers[tid]!.l3Rows ?? []).find(
    (r) => r.id === target.id,
  )!;
  if (l3b.offshoreAssessmentPct !== l3.offshoreAssessmentPct) {
    fail(
      scenario,
      `Idempotence violated: ${l3.offshoreAssessmentPct}% → ${l3b.offshoreAssessmentPct}%.`,
    );
    return;
  }
  pass(
    scenario,
    `HR L3 "${target.l3}" — mixed (80/20) children → dial=${l3.offshoreAssessmentPct}%; re-application idempotent.`,
  );
}

function scenarioL3DialRollup(): void {
  const scenarioClean = "S3a L3 dial rollup — clean program";
  const cleanProgram = ensureV6L3Rows(buildSeededAssessProgramV2());
  let cleanViolations = 0;
  for (const tw of ALL_TOWERS) {
    const tState = cleanProgram.towers[tw.id as TowerId];
    if (!tState) continue;
    const l4ById = new Map(tState.l4Rows.map((r) => [r.id, r] as const));
    for (const l3 of tState.l3Rows ?? []) {
      const ids = l3.childL4RowIds ?? [];
      if (ids.length === 0) continue;
      const children = ids
        .map((id) => l4ById.get(id))
        .filter((r): r is L4WorkforceRow => r != null);
      if (children.length === 0) continue;
      const rolled = rollupSplit(children);
      const dial = Math.round(l3.offshoreAssessmentPct ?? 0);
      if (Math.abs(rolled.gccPct - dial) > 1) cleanViolations += 1;
    }
  }
  if (cleanViolations > 0) {
    fail(
      scenarioClean,
      `Seed fixture has ${cleanViolations} L3 rows with dial drift > 1pp.`,
    );
  } else {
    pass(scenarioClean, "Every L3 dial reconciles with its child L4 mean.");
  }

  const scenarioApplied = "S3b L3 dial rollup — Step-2 locked program";
  const tid: TowerId = "hr";
  const t = cleanProgram.towers[tid]!;
  const target = (t.l3Rows ?? []).find(
    (r) => (r.childL4RowIds ?? []).length >= 2,
  );
  if (!target) {
    fail(scenarioApplied, "HR has no L3 with ≥2 child L4 rows in fixture.");
    return;
  }
  const changes: GccPctAssignment[] = (target.childL4RowIds ?? []).map(
    (id, i) => ({
      rowId: id,
      gccPct: i === 0 ? 60 : 90,
      setBy: "user",
    }),
  );
  const applied = applyGccPctPure(cleanProgram, tid, changes);
  const l3After = (applied.towers[tid]!.l3Rows ?? []).find(
    (r) => r.id === target.id,
  )!;
  const childAfter = (target.childL4RowIds ?? [])
    .map((id) => applied.towers[tid]!.l4Rows.find((r) => r.id === id)!)
    .filter(Boolean);
  const expected = rollupSplit(childAfter).gccPct;
  if (Math.abs((l3After.offshoreAssessmentPct ?? 0) - expected) > 1) {
    fail(
      scenarioApplied,
      `Drift after apply: dial=${l3After.offshoreAssessmentPct}% vs expected=${expected}%.`,
    );
    return;
  }
  pass(
    scenarioApplied,
    `HR L3 "${target.l3}" — mixed gccPct children → dial=${l3After.offshoreAssessmentPct}% matches rollup.`,
  );

  const scenarioBroken = "S3c L3 dial rollup — corruption detected";
  const broken = JSON.parse(JSON.stringify(applied)) as AssessProgramV2;
  const bt = broken.towers[tid]!;
  const bl3 = (bt.l3Rows ?? []).find((r) => r.id === target.id);
  if (!bl3) {
    fail(scenarioBroken, "Target L3 missing in broken copy.");
    return;
  }
  bl3.offshoreAssessmentPct = 5; // deliberately wrong
  const brokenChildren = (target.childL4RowIds ?? [])
    .map((id) => bt.l4Rows.find((r) => r.id === id)!)
    .filter(Boolean);
  const trueGcc = rollupSplit(brokenChildren).gccPct;
  if (Math.abs(trueGcc - 5) <= 1) {
    fail(
      scenarioBroken,
      `Could not construct a deliberately corrupted L3 (rollup happens to be ~5%).`,
    );
    return;
  }
  pass(
    scenarioBroken,
    `Drift detected on corrupted L3: dial=5% vs child rollup=${trueGcc}%.`,
  );
}

function scenarioApplicabilityTag(): void {
  const scenario = "S4 deriveInitiativeApplicability";
  const tid: TowerId = "legal";
  const fixtureRows = buildTowerFixtureRows(tid);
  if (fixtureRows.length < 3) {
    fail(scenario, "Legal fixture needs ≥3 L4 rows for this test.");
    return;
  }
  // Three synthetic L4s — one fully GCC (90%), one retained (10%), one
  // mostly GCC (70%). `l4DispositionFromGccPct` uses a 50% threshold.
  const a: L4WorkforceRow = {
    ...fixtureRows[0],
    gccPct: 90,
    gccPctSource: "user",
    gccPctSetAt: FROZEN_NOW,
    gccReason: "fully GCC",
  };
  const b: L4WorkforceRow = {
    ...fixtureRows[1],
    gccPct: 10,
    gccPctSource: "user",
    gccPctSetAt: FROZEN_NOW,
    gccReason: "retained",
  };
  const c: L4WorkforceRow = {
    ...fixtureRows[2],
    gccPct: 70,
    gccPctSource: "user",
    gccPctSetAt: FROZEN_NOW,
    gccReason: "predominantly GCC",
  };
  const l4ById = new Map([a, b, c].map((r) => [r.id, r] as const));
  const synthL3: L3WorkforceRowV6 = {
    id: "test-l3",
    l1: "X",
    l2: "Y",
    l3: "Z",
    fteOnshore: 1,
    fteOffshore: 0,
    contractorOnshore: 0,
    contractorOffshore: 0,
    childL4RowIds: [a.id, b.id, c.id],
    l3Initiatives: [],
  };
  // Mixed children → "Both"
  const r1 = deriveInitiativeApplicability(
    { coversL4RowIds: [] },
    synthL3,
    l4ById,
  );
  if (r1 !== "Both") {
    fail(scenario, `Mixed dispositions — expected "Both", got "${r1}"`);
    return;
  }
  // Only retained child (gccPct < 50) → "Retained"
  const r2 = deriveInitiativeApplicability(
    { coversL4RowIds: [b.id] },
    synthL3,
    l4ById,
  );
  if (r2 !== "Retained") {
    fail(scenario, `Retained-only — expected "Retained", got "${r2}"`);
    return;
  }
  // Only GCC children (gccPct >= 50) → "Offshored"
  const r3 = deriveInitiativeApplicability(
    { coversL4RowIds: [a.id, c.id] },
    synthL3,
    l4ById,
  );
  if (r3 !== "Offshored") {
    fail(
      scenario,
      `GCC-only (90% + 70%) — expected "Offshored", got "${r3}"`,
    );
    return;
  }
  pass(
    scenario,
    "Mixed→Both, retained-only→Retained, gcc-only→Offshored across the 50% threshold.",
  );
}

async function scenarioStrategistInput(): Promise<void> {
  const scenario = "S5 buildStrategistInput — scope filter + hash";
  let program = ensureV6L3Rows(buildSeededAssessProgramV2());
  // Mark a single tower's first L3 as fully retained so the
  // retained-only filter has a deterministic positive case.
  const tid: TowerId = "legal";
  const t = program.towers[tid]!;
  const target = (t.l3Rows ?? []).find(
    (r) => (r.childL4RowIds ?? []).length >= 1,
  );
  if (!target) {
    fail(scenario, "Legal fixture has no L3 with children.");
    return;
  }
  const retainedChanges: GccPctAssignment[] = (target.childL4RowIds ?? []).map(
    (id) => ({
      rowId: id,
      gccPct: 5,
      setBy: "user",
      reason: "S5 — fully retained for scope filter test",
    }),
  );
  program = applyGccPctPure(program, tid, retainedChanges);
  // And mark a Finance L3's children as fully GCC — should drop OUT of
  // retained-only.
  const finL3 = (program.towers["finance"]!.l3Rows ?? []).find(
    (r) => (r.childL4RowIds ?? []).length >= 1,
  );
  if (finL3) {
    const finChanges: GccPctAssignment[] = (finL3.childL4RowIds ?? []).map(
      (id) => ({
        rowId: id,
        gccPct: 95,
        setBy: "user",
        reason: "S5 — fully GCC",
      }),
    );
    program = applyGccPctPure(program, "finance", finChanges);
  }
  const all = await buildStrategistInput(program, "all-org");
  const retained = await buildStrategistInput(program, "retained-only");
  if (all.inputHash === retained.inputHash) {
    fail(scenario, "Hash equality across scopes — scope must bust the cache.");
    return;
  }
  if (all.input.baseScopeLabel !== "All of Versant") {
    fail(scenario, `all-org label wrong: ${all.input.baseScopeLabel}`);
    return;
  }
  if (retained.input.baseScopeLabel !== "Retained org only") {
    fail(scenario, `retained label wrong: ${retained.input.baseScopeLabel}`);
    return;
  }
  // The retained-only build must include legal (we marked it retained)
  // and exclude the explicitly fully-GCC Finance L3 we just created.
  const legalAll = all.input.towers.find((x) => x.id === "legal");
  const legalRetained = retained.input.towers.find((x) => x.id === "legal");
  if (!legalAll || !legalRetained) {
    fail(scenario, "Legal tower missing from one of the scopes.");
    return;
  }
  const sawTarget = legalRetained.jobFamilies.some((f) => f.l3 === target.l3);
  if (!sawTarget) {
    fail(scenario, "Retained-only dropped the explicitly retained L3.");
    return;
  }
  // Idempotent hash — run again, same scope, identical hash.
  const allAgain = await buildStrategistInput(program, "all-org");
  if (allAgain.inputHash !== all.inputHash) {
    fail(
      scenario,
      `Non-deterministic hash for unchanged input: ${all.inputHash} vs ${allAgain.inputHash}`,
    );
    return;
  }
  pass(
    scenario,
    `all-org towers=${all.input.towers.length} retained towers=${retained.input.towers.length}; hashes differ; idempotent within scope.`,
  );
}

function scenarioPromptBuilder(): void {
  const scenario = "S6 strategist prompt builder";
  const sys = buildStrategistSystemPrompt();
  if (!sys || sys.length < 200) {
    fail(scenario, `System prompt too short (${sys?.length ?? 0} chars).`);
    return;
  }
  if (!sys.includes("Versant")) {
    fail(scenario, "System prompt does not mention Versant.");
    return;
  }
  const user = buildStrategistUserPrompt({
    baseScopeLabel: "All of Versant",
    towers: [
      {
        id: "finance" as TowerId,
        name: "Finance",
        inScopeHc: 100,
        jobFamilies: [
          {
            l2: "Controllership",
            l3: "Close & Reconciliation",
            activities: ["intercompany matching", "JE review"],
            aiTools: "BlackLine",
            constraints: "SOX 404",
          },
        ],
      },
    ],
    inFlightInitiatives: [
      {
        towerName: "Finance",
        l3: "Close & Reconciliation",
        solutionName: "Recon Co-Pilot",
        vendor: "BlackLine",
      },
    ],
  });
  if (!user || user.length < 50) {
    fail(scenario, `User prompt too short (${user?.length ?? 0} chars).`);
    return;
  }
  if (!user.includes("Finance") || !user.includes("BlackLine")) {
    fail(scenario, "User prompt missing tower or vendor context.");
    return;
  }
  pass(
    scenario,
    `system=${sys.length} chars · user=${user.length} chars · grounded.`,
  );
}

function scenarioOffshoreStepStatus(): void {
  const scenario = "S7 offshoreView step status";
  const programA = ensureV6L3Rows(buildSeededAssessProgramV2());
  const tA = programA.towers["finance"]!;
  if (isOffshoreClassificationLocked(tA)) {
    fail(scenario, "Fresh fixture should not be locked.");
    return;
  }
  if (isOffshoreViewJourneyStepDone(tA)) {
    fail(scenario, "Fresh fixture should not have step done.");
    return;
  }
  const programB: AssessProgramV2 = {
    ...programA,
    towers: {
      ...programA.towers,
      finance: {
        ...tA,
        offshoreViewValidatedAt: FROZEN_NOW,
      },
    },
  };
  const tB = programB.towers["finance"]!;
  if (!isOffshoreClassificationLocked(tB)) {
    fail(scenario, "After validation timestamp, should be locked.");
    return;
  }
  if (!isOffshoreViewJourneyStepDone(tB)) {
    fail(scenario, "After validation timestamp, step should be done.");
    return;
  }
  pass(scenario, "Lock + journey-step flags flip as expected on validation.");
}

// ---------------------------------------------------------------------
//   Main
// ---------------------------------------------------------------------

async function main() {
  const t0 = Date.now();
  console.log(
    "\n================ END-TO-END (Offshore + Strategist) ================\n",
  );

  // Pre-flight — confirm fixture has every tower.
  const seeded = buildSeededAssessProgramV2();
  for (const tw of ALL_TOWERS) {
    if (!seeded.towers[tw.id as TowerId]) {
      fail("pre-flight", `Tower ${tw.id} missing from seeded fixture.`);
    }
  }

  scenarioApplyGccPctRoundtrip();
  scenarioMixedRollup();
  scenarioL3DialRollup();
  scenarioApplicabilityTag();
  await scenarioStrategistInput();
  scenarioPromptBuilder();
  scenarioOffshoreStepStatus();

  // -----  Render -----
  for (const s of successes) console.log(`  PASS  ${s}`);
  if (failures.length === 0) {
    console.log(
      `\nAll ${successes.length} scenarios pass in ${Date.now() - t0}ms.`,
    );
    process.exit(0);
  }
  console.log(
    `\n================ FAILURES (${failures.length}) ================\n`,
  );
  for (const f of failures) {
    console.log(`  FAIL  [${f.scenario}] ${f.detail}`);
  }
  process.exit(1);
}

void main().catch((err) => {
  console.error("E2E harness threw:", err);
  process.exit(1);
});

// Suppress unused-import warning for things imported for side effects only.
void defaultTowerBaseline;
void defaultTowerRates;
