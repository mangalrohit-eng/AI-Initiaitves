/**
 * End-to-end checks for L4-headcount-weighted initiative attribution.
 *
 * Run: `npx tsx scripts/attributeInitiativeE2e.ts`
 * Exits non-zero on failure.
 */
import type { L3Initiative, L3WorkforceRowV6, L4WorkforceRow } from "../src/data/assess/types";
import type { AssessProgramV2, TowerId } from "../src/data/assess/types";
import { towers } from "../src/data/towers";
import { buildSeededAssessProgramV2 } from "./lib/seedFixture";
import { deriveL3Rows } from "../src/lib/assess/deriveL3Rows";
import {
  attributeAiUsdAcrossInitiatives,
  computeL3FteDataMissing,
} from "../src/lib/initiatives/attributeL3AiUsd";
import { rowModeledSaving } from "../src/lib/assess/scenarioModel";
import {
  defaultTowerBaseline,
  defaultTowerRates,
} from "../src/data/assess/types";
import { selectInitiativesV6ForTower } from "../src/lib/initiatives/selectV6";
import { selectInitiativesV6ForProgram } from "../src/lib/initiatives/selectV6Program";

const EPS = 1;

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

function assertClose(a: number, b: number, msg: string) {
  assert(Math.abs(a - b) <= EPS, `${msg} (got ${a}, expected ~${b})`);
}

// ---------------------------------------------------------------------------
// 1) Pure helper
// ---------------------------------------------------------------------------

const l4a: L4WorkforceRow = {
  id: "l4-a",
  l2: "G",
  l3: "J",
  l4: "A1",
  fteOnshore: 10,
  fteOffshore: 0,
  contractorOnshore: 0,
  contractorOffshore: 0,
};
const l4b: L4WorkforceRow = {
  id: "l4-b",
  l2: "G",
  l3: "J",
  l4: "A2",
  fteOnshore: 30,
  fteOffshore: 0,
  contractorOnshore: 0,
  contractorOffshore: 0,
};
const l4ById = new Map<string, L4WorkforceRow>([
  [l4a.id, l4a],
  [l4b.id, l4b],
]);

{
  const m = attributeAiUsdAcrossInitiatives({
    rowAiUsd: 100,
    childL4RowIds: [l4a.id, l4b.id],
    l4ById,
    initiatives: [
      { id: "i1", coversL4RowIds: [l4a.id], isPlaceholder: false },
      { id: "i2", coversL4RowIds: [l4b.id], isPlaceholder: false },
    ],
  });
  assertClose(m.get("i1") ?? 0, 25, "disjoint 10:30 split first");
  assertClose(m.get("i2") ?? 0, 75, "disjoint 10:30 split second");
}

{
  const m = attributeAiUsdAcrossInitiatives({
    rowAiUsd: 100,
    childL4RowIds: [l4a.id, l4b.id],
    l4ById,
    initiatives: [
      { id: "x", coversL4RowIds: [], isPlaceholder: false },
      { id: "y", coversL4RowIds: [], isPlaceholder: false },
    ],
  });
  assertClose(m.get("x") ?? 0, 50, "whole-L3 even when both claim all mass");
  assertClose(m.get("y") ?? 0, 50, "whole-L3 even second");
}

{
  const z4: L4WorkforceRow = {
    ...l4a,
    id: "l4-z",
    fteOnshore: 0,
    fteOffshore: 0,
    contractorOnshore: 0,
    contractorOffshore: 0,
  };
  const m = attributeAiUsdAcrossInitiatives({
    rowAiUsd: 99,
    childL4RowIds: [z4.id],
    l4ById: new Map([[z4.id, z4]]),
    initiatives: [
      { id: "p", coversL4RowIds: [z4.id], isPlaceholder: false },
      { id: "q", coversL4RowIds: [z4.id], isPlaceholder: false },
    ],
  });
  assertClose(m.get("p") ?? 0, 49.5, "zero-mass even split first");
  assertClose(m.get("q") ?? 0, 49.5, "zero-mass even split second");
}

{
  const saving = { pool: 0, ai: 0 };
  const row = {
    fteOnshore: 0,
    fteOffshore: 0,
    contractorOnshore: 0,
    contractorOffshore: 0,
  };
  assert(computeL3FteDataMissing(row, saving), "FTE missing when hc+pool+ai all 0");
  assert(
    !computeL3FteDataMissing(
      { ...row, fteOnshore: 1 },
      { pool: 1000, ai: 50 },
    ),
    "not FTE missing when workforce exists",
  );
}

console.log("OK: pure attribution helper + l3FteDataMissing");

// ---------------------------------------------------------------------------
// 2) Seeded program → selectV6 → selectV6Program invariants
// ---------------------------------------------------------------------------

const towerId = "finance" as TowerId;
const program: AssessProgramV2 = buildSeededAssessProgramV2();
const state = program.towers[towerId];
assert(!!state && state.l4Rows.length > 0, "seed finance tower");

const l3Rows = deriveL3Rows(state.l4Rows, towerId);
const target = l3Rows.find((r) => r.childL4RowIds.length >= 2);
assert(!!target, "need one L3 row with 2+ L4 children for split test");

const id0 = target.childL4RowIds[0]!;
const id1 = target.childL4RowIds[1]!;

const iso = "2026-05-01T00:00:00.000Z";
const mkInit = (id: string, name: string, covers: string[]): L3Initiative => ({
  id,
  solutionName: name,
  tagline: "E2E attribution probe.",
  aiRationale:
    "BlackLine anchors intercompany matching across Versant entities; probe only.",
  feasibility: "High",
  coversL4RowIds: covers,
  source: "manual",
  generatedAt: iso,
});

const patchedL3: L3WorkforceRowV6[] = l3Rows.map((r) => {
  if (r.id !== target.id) {
    return {
      ...r,
      curationStage: "done",
      aiImpactAssessmentPct: 25,
      offshoreAssessmentPct: 15,
    };
  }
  return {
    ...r,
    curationStage: "done",
    aiImpactAssessmentPct: 35,
    offshoreAssessmentPct: 20,
    l3Initiatives: [
      mkInit("e2e-init-a", "Agentic AI Close Reconciliation Co-Pilot", [id0]),
      mkInit("e2e-init-b", "Agentic AI Treasury Cash Forecasting Assistant", [id1]),
    ],
  };
});

program.towers[towerId] = {
  ...state,
  l3Rows: patchedL3,
};

const towerMeta = towers.find((t) => t.id === towerId)!;
const v6 = selectInitiativesV6ForTower(towerId, program, towerMeta);
const hit = v6.l3Rows.find((r) => r.id === target.id);
assert(!!hit, "selector returns patched row");
const reals = hit.initiatives.filter((i) => !i.isPlaceholder);
assert(reals.length === 2, "two initiatives on target row");

const baseline = state.baseline ?? defaultTowerBaseline;
const rates = state.rates ?? defaultTowerRates(towerId);
const rawL3 = patchedL3.find((r) => r.id === target.id)!;
const saving = rowModeledSaving(rawL3, baseline, rates);
let sumAttr = 0;
for (const c of reals) {
  sumAttr += c.attributedAiUsd;
  assert(
    c.l3FteDataMissing === computeL3FteDataMissing(rawL3, saving),
    "card mirrors row FTE-missing flag",
  );
}
assertClose(sumAttr, saving.ai, "sum(attributed) === row.aiUsd on seeded row");

const prog = selectInitiativesV6ForProgram(program, { aiUsdThreshold: 0 });
const a = prog.initiatives.find((i) => i.id === "e2e-init-a");
const b = prog.initiatives.find((i) => i.id === "e2e-init-b");
assert(!!a && !!b, "program roster includes e2e initiatives");
assertClose(a.attributedAiUsd + b.attributedAiUsd, saving.ai, "program copies same split");

let financeAttributed = 0;
let financeAiOnRowsWithRealCards = 0;
for (const row of v6.l3Rows) {
  const hasReal = row.initiatives.some((i) => !i.isPlaceholder);
  for (const init of row.initiatives) {
    if (!init.isPlaceholder) financeAttributed += init.attributedAiUsd;
  }
  if (hasReal) financeAiOnRowsWithRealCards += row.aiUsd;
}
assertClose(
  financeAttributed,
  financeAiOnRowsWithRealCards,
  "finance: sum attributed === sum row.aiUsd on rows with ≥1 real initiative",
);

console.log("OK: selectV6 + selectV6Program + programImpactSummary alignment");
console.log("All attribution E2E checks passed.");
