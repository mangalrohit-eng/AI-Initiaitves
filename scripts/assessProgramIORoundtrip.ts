/**
 * Contract: `importAssessProgramFromJsonText` must preserve L3 pipeline +
 * staleness fields so GET /api/assess → setAssessProgram does not strip
 * `curationStage: "queued"`, hashes, `l4Items`, or dial rationale metadata.
 *
 * Mirrors the invariants documented in `migrateAssessProgram` (localStore).
 */
/* eslint-disable no-console */

import type { AssessProgramV2, L3WorkforceRow, L4Item } from "../src/data/assess/types";
import { importAssessProgramFromJsonText } from "../src/lib/assess/assessProgramIO";

const l4Item: L4Item = {
  id: "test-l4-1",
  name: "Test L4 activity",
  source: "llm",
  aiCurationStatus: "curated",
  aiEligible: true,
  aiPriority: "P2 — Near-term (6-12mo)",
  aiRationale: "Round-trip contract row.",
  primaryVendor: "BlackLine",
  agentOneLine: "Matches and posts draft JEs.",
};

const row: L3WorkforceRow = {
  id: "finance::close",
  l2: "Close & consolidate",
  l3: "Monthly / quarterly financial close",
  fteOnshore: 10,
  fteOffshore: 2,
  contractorOnshore: 0,
  contractorOffshore: 0,
  annualSpendUsd: 2_000_000,
  offshoreAssessmentPct: 25,
  aiImpactAssessmentPct: 30,
  l4Activities: ["Intercompany matching", "JE preparation"],
  l4Items: [l4Item],
  curationContentHash: "deadbeef",
  curationStage: "queued",
  curationGeneratedAt: "2026-04-28T12:00:00.000Z",
  offshoreRationale: "Close cycle work is partially offshoreable.",
  aiImpactRationale: "High routine volume suits agent assist.",
  dialsRationaleSource: "llm",
  dialsRationaleAt: "2026-04-28T12:05:00.000Z",
};

const program: AssessProgramV2 = {
  version: 4,
  global: {
    blendedFteOnshore: 180_000,
    blendedFteOffshore: 90_000,
    blendedContractorOnshore: 120_000,
    blendedContractorOffshore: 60_000,
  },
  towers: {
    finance: {
      l3Rows: [row],
      baseline: { baselineOffshorePct: 20, baselineAIPct: 15 },
      status: "data",
      lastUpdated: "2026-04-28T12:00:00.000Z",
      capabilityMapConfirmedAt: "2026-04-28T11:00:00.000Z",
    },
  },
};

const text = JSON.stringify(program);
const parsed = importAssessProgramFromJsonText(text);
if (!parsed.ok) {
  console.error(parsed.error);
  process.exit(1);
}

const out = parsed.program.towers.finance?.l3Rows[0];
let fail = 0;
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`  PASS  ${msg}`);
  else {
    console.log(`  FAIL  ${msg}`);
    fail += 1;
  }
}

assert(Boolean(out), "row exists after import");
if (out) {
  assert(out.curationStage === "queued", "curationStage === queued");
  assert(out.curationContentHash === "deadbeef", "curationContentHash preserved");
  assert(Array.isArray(out.l4Items) && out.l4Items?.length === 1, "l4Items length 1");
  assert(out.l4Items?.[0]?.id === l4Item.id, "l4Items[0].id preserved");
  assert(out.l4Items?.[0]?.name === l4Item.name, "l4Items[0].name preserved");
  assert(out.dialsRationaleSource === "llm", "dialsRationaleSource === llm");
  assert(
    typeof out.offshoreRationale === "string" && out.offshoreRationale.length > 0,
    "offshoreRationale preserved",
  );
  assert(
    typeof out.aiImpactRationale === "string" && out.aiImpactRationale.length > 0,
    "aiImpactRationale preserved",
  );
  assert(out.dialsRationaleAt === row.dialsRationaleAt, "dialsRationaleAt preserved");
  assert(out.curationGeneratedAt === row.curationGeneratedAt, "curationGeneratedAt preserved");
}

console.log("\n========================================");
console.log(`assessProgramIO round-trip: ${fail === 0 ? "PASS" : "FAIL"}`);
process.exit(fail === 0 ? 0 : 1);
