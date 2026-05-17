/**
 * Integration smoke for the intake-status flow.
 *
 * Builds a minimal `AssessProgramV2` with one tower (`finance`) carrying
 * an imported intake + two L3 rows (one with `intakeStatus`, one without),
 * then drives:
 *
 *   1. `selectInitiativesV6ForTower`  — the per-tower gallery selector.
 *   2. `selectInitiativesV6ForProgram` — the cross-tower roll-up.
 *   3. `composeProjectsV6`             — the cross-tower 2x2 composer.
 *
 * For each layer we assert that `intakeStatus` is projected through and
 * that the new `intakeMeta` block on the per-tower selector reports the
 * correct presence + import timestamp. This is the contract the gallery
 * filter, the per-card pill, the deep-dive evidence section, and the
 * cross-tower module rely on; if it breaks here, every UI surface will
 * silently miss the classification.
 *
 * Run: `npx tsx scripts/intakeStatusFlowTest.ts`.
 */
import assert from "node:assert/strict";
import type {
  AssessProgramV2,
  IntakeStatusEntry,
  L3Initiative,
  L3WorkforceRowV6,
  L4WorkforceRow,
  TowerAssessState,
  TowerId,
} from "../src/data/assess/types";
import { defaultTowerRates } from "../src/data/assess/types";
import { selectInitiativesV6ForTower } from "../src/lib/initiatives/selectV6";
import { selectInitiativesV6ForProgram } from "../src/lib/initiatives/selectV6Program";
import { composeProjectsV6 } from "../src/lib/cross-tower/composeProjectsV6";
import { towers } from "../src/data/towers";
import {
  intakeFieldLabel,
  intakeStatusIsStale,
  INTAKE_STATUS_LABELS,
  normalizeForEvidenceMatch,
} from "../src/lib/assess/towerReadinessIntake";

const TOWER_ID: TowerId = "finance" as TowerId;
const tower = towers.find((t) => (t.id as TowerId) === TOWER_ID);
if (!tower) {
  throw new Error("finance tower fixture missing — required for this script");
}

const importedAt = "2026-05-15T12:00:00.000Z";
const classifiedAt = "2026-05-15T12:01:00.000Z";

// ---------------------------------------------------------------------------
//   Fixture — one tower, two L3 rows, two initiatives
// ---------------------------------------------------------------------------

const intakeStatusDone: IntakeStatusEntry = {
  status: "done",
  evidence: "uses BlackLine for intercompany flux automation",
  evidenceField: "currentAiTools",
  classifiedAt,
  intakeImportedAt: importedAt,
};

const initiativeWithStatus: L3Initiative = {
  id: "finance::row-1::reconciliation",
  solutionName: "Intercompany Close Reconciliation Co-Pilot",
  tagline: "Auto-resolves intercompany breaks across 7+ Versant entities.",
  aiRationale: "Versant-grounded rationale.",
  feasibility: "High",
  primaryVendor: "BlackLine",
  coversL4RowIds: ["l4-row-1"],
  source: "llm",
  promptVersion: "2026-05-intake-status",
  generatedAt: classifiedAt,
  intakeStatus: intakeStatusDone,
};

const initiativeWithoutStatus: L3Initiative = {
  id: "finance::row-2::treasury",
  solutionName: "Treasury Liquidity Forecaster",
  tagline: "Plain-English variance commentary on the close pack.",
  aiRationale: "Versant-grounded rationale.",
  feasibility: "Low",
  coversL4RowIds: ["l4-row-2"],
  source: "llm",
  generatedAt: classifiedAt,
};

const l4Row1: L4WorkforceRow = {
  id: "l4-row-1",
  l1: "Finance",
  l2: "Controllership",
  l3: "Intercompany & Consolidation",
  l4: "Intercompany Reconciliation",
  fteOnshore: 12,
  fteOffshore: 4,
  contractorOnshore: 0,
  contractorOffshore: 0,
  gccPct: 25,
  l5Activities: ["Match intercompany invoices", "Resolve breaks"],
};
const l4Row2: L4WorkforceRow = {
  id: "l4-row-2",
  l1: "Finance",
  l2: "Treasury",
  l3: "Cash Forecasting",
  l4: "Liquidity Forecasting",
  fteOnshore: 6,
  fteOffshore: 2,
  contractorOnshore: 0,
  contractorOffshore: 0,
  gccPct: 25,
  l5Activities: ["13-week cash forecast", "Covenant monitoring"],
};

const l3Row1: L3WorkforceRowV6 = {
  id: "row-1",
  l1: "Finance",
  l2: "Controllership",
  l3: "Intercompany & Consolidation",
  childL4RowIds: ["l4-row-1"],
  fteOnshore: 12,
  fteOffshore: 4,
  contractorOnshore: 0,
  contractorOffshore: 0,
  gccPct: 25,
  baselineAIPctOverride: 30,
  baselineOffshorePctOverride: 25,
  curationStage: "done",
  l3Initiatives: [initiativeWithStatus],
};
const l3Row2: L3WorkforceRowV6 = {
  id: "row-2",
  l1: "Finance",
  l2: "Treasury",
  l3: "Cash Forecasting",
  childL4RowIds: ["l4-row-2"],
  fteOnshore: 6,
  fteOffshore: 2,
  contractorOnshore: 0,
  contractorOffshore: 0,
  gccPct: 25,
  baselineAIPctOverride: 20,
  baselineOffshorePctOverride: 25,
  curationStage: "done",
  l3Initiatives: [initiativeWithoutStatus],
};

const towerState: TowerAssessState = {
  l4Rows: [l4Row1, l4Row2],
  l3Rows: [l3Row1, l3Row2],
  baseline: { baselineOffshorePct: 20, baselineAIPct: 15 },
  rates: defaultTowerRates(TOWER_ID),
  status: "complete",
  aiReadinessIntake: {
    importedAt,
    sourceFileName: "fixture-intake.xlsx",
    systemsPlatforms: "Workday Financials, OneStream, BlackLine, HighRadius.",
    currentAiTools:
      "Finance currently uses BlackLine for intercompany flux automation across all 7 Versant entities and HighRadius for collections.",
    experimentsLearnings:
      "We piloted FloQast for the multi-brand close last quarter.",
    dataRelevant: "GL detail; intercompany ledger; trial balance feeds.",
    constraints:
      "BB- rating means covenant monitoring is existential; SEC reporting timelines are tight.",
    biggestImpact: "Faster month-end close.",
    readyNow:
      "We have started piloting AI-assisted invoice triage for Fandango payables.",
    noGoAreas: "Do not automate executive disclosure controls.",
  },
};

const program: AssessProgramV2 = {
  schemaVersion: 6,
  towers: { [TOWER_ID]: towerState } as AssessProgramV2["towers"],
};

let failures = 0;
function check(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ok ${name}`);
  } catch (e) {
    failures += 1;
    console.error(`  FAIL ${name}`);
    console.error(`    ${(e as Error).message}`);
  }
}

console.log("\nintakeStatus flow — selector → program → composer");

// ---------- per-tower selector ----------

const towerResult = selectInitiativesV6ForTower(TOWER_ID, program, tower);

check("selectInitiativesV6ForTower exposes intakeMeta", () => {
  assert.equal(towerResult.intakeMeta.present, true);
  assert.equal(towerResult.intakeMeta.importedAt, importedAt);
});

check("L3 row with classified initiative carries intakeStatus on its card", () => {
  const row = towerResult.l3Rows.find((r) => r.id === "row-1");
  assert.ok(row, "row-1 missing from selector output");
  const card = row.initiatives.find((c) => c.id === initiativeWithStatus.id);
  assert.ok(card, "card missing from row-1");
  assert.equal(card.intakeStatus?.status, "done");
  assert.equal(card.intakeStatus?.evidenceField, "currentAiTools");
  assert.match(card.intakeStatus?.evidence ?? "", /BlackLine/);
});

check("L3 row without classification has card.intakeStatus === undefined", () => {
  const row = towerResult.l3Rows.find((r) => r.id === "row-2");
  assert.ok(row, "row-2 missing from selector output");
  const card = row.initiatives[0];
  assert.equal(card.intakeStatus, undefined);
});

// ---------- intakeMeta.present false-path (intake stripped) ----------

check("intakeMeta.present === false when tower has no intake", () => {
  const stripped: AssessProgramV2 = {
    ...program,
    towers: {
      [TOWER_ID]: {
        ...towerState,
        aiReadinessIntake: undefined,
      },
    } as AssessProgramV2["towers"],
  };
  const r = selectInitiativesV6ForTower(TOWER_ID, stripped, tower);
  assert.equal(r.intakeMeta.present, false);
  assert.equal(r.intakeMeta.importedAt, null);
});

// ---------- helpers ----------

check("INTAKE_STATUS_LABELS has all three states", () => {
  assert.equal(INTAKE_STATUS_LABELS.done, "Done");
  assert.equal(INTAKE_STATUS_LABELS["in-progress"], "In Progress");
  assert.equal(INTAKE_STATUS_LABELS["not-done"], "Not Done");
});

check("intakeFieldLabel returns the human label", () => {
  assert.equal(
    intakeFieldLabel("currentAiTools"),
    "Current AI or automation tools",
  );
  assert.equal(
    intakeFieldLabel("experimentsLearnings"),
    "AI experiments and learnings",
  );
  assert.equal(intakeFieldLabel("readyNow"), "Ready now / low risk");
});

check("normalizeForEvidenceMatch folds curly quotes and dashes", () => {
  const a = normalizeForEvidenceMatch(
    "We \u201Cstarted\u201D piloting AI\u2011assisted triage \u2014 OK",
  );
  const b = normalizeForEvidenceMatch(
    "we \"started\" piloting ai-assisted triage - ok",
  );
  assert.equal(a, b);
});

check("intakeStatusIsStale fires when intake re-imported after classification", () => {
  const stale = intakeStatusIsStale(
    intakeStatusDone,
    "2026-05-20T00:00:00.000Z",
  );
  assert.equal(stale, true);
  const fresh = intakeStatusIsStale(intakeStatusDone, importedAt);
  assert.equal(fresh, false);
  // Accepts the full intake object too.
  const staleObj = intakeStatusIsStale(
    intakeStatusDone,
    {
      ...towerState.aiReadinessIntake!,
      importedAt: "2026-05-20T00:00:00.000Z",
    },
  );
  assert.equal(staleObj, true);
});

// ---------- program selector ----------

const programResult = selectInitiativesV6ForProgram(program);

/**
 * Both buckets carry the same row shape — the program selector only
 * decides which one a row lands in based on the L3's modeled $ vs the
 * plan threshold. The fixture's pool is too small to clear the program
 * threshold, so the rows end up in `deprioritized` here, but in
 * production-sized programs they'd land in `initiatives`. The
 * `intakeStatus` projection contract is the same for both buckets.
 */
const allProgramRows = [
  ...programResult.initiatives,
  ...programResult.deprioritized,
];

check("selectInitiativesV6ForProgram projects intakeStatus on the row", () => {
  const row = allProgramRows.find((r) => r.id === initiativeWithStatus.id);
  assert.ok(row, "classified initiative missing from program selector");
  assert.equal(row.intakeStatus?.status, "done");
  assert.equal(row.intakeStatus?.evidenceField, "currentAiTools");
});

check("program selector keeps undefined for unclassified initiatives", () => {
  const row = allProgramRows.find((r) => r.id === initiativeWithoutStatus.id);
  assert.ok(row, "unclassified initiative missing from program selector");
  assert.equal(row.intakeStatus, undefined);
});

// ---------- cross-tower composer ----------

const projects = composeProjectsV6({
  initiatives: allProgramRows,
  assumptions: {
    rampMonths: 3,
    p1: { startMonth: 1, buildMonths: 6 },
    p2: { startMonth: 7, buildMonths: 6 },
    p3: { startMonth: 13, buildMonths: 6 },
  } as Parameters<typeof composeProjectsV6>[0]["assumptions"],
});

check("composeProjectsV6 carries intakeStatus into AIProjectResolved", () => {
  const project = projects.find((p) => p.id === initiativeWithStatus.id);
  assert.ok(project, "classified project missing from composer output");
  assert.equal(project.intakeStatus?.status, "done");
  assert.equal(project.intakeStatus?.evidenceField, "currentAiTools");
  assert.match(project.intakeStatus?.evidence ?? "", /BlackLine/);
});

check("composer leaves intakeStatus undefined on unclassified initiatives", () => {
  const project = projects.find((p) => p.id === initiativeWithoutStatus.id);
  assert.ok(project, "unclassified project missing from composer output");
  assert.equal(project.intakeStatus, undefined);
});

if (failures > 0) {
  console.error(`\n${failures} intakeStatus flow check(s) failed.`);
  process.exit(1);
}
console.log("\nAll intakeStatus flow checks passed.");
