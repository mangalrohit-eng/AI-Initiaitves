/**
 * Data-layer smoke for program defaults, tower catalog leads, and step predicates.
 * Run: npx tsx scripts/programSmokeTest.ts
 */
import assert from "node:assert/strict";
import { towers } from "../src/data/towers";
import { buildSeededAssessProgramV2 } from "../src/data/assess/seedAssessProgram";
import { buildDefaultProgramLeadDeadlines } from "../src/data/assess/types";
import { formatAccentureTowerLeadNames, formatVersantTowerLeadNames } from "../src/lib/program/towerLeadDisplay";
import { mergeLeadDeadlines } from "../src/lib/program/leadDeadlines";
import { isLeadStepDone } from "../src/lib/program/leadStepStatus";
import type { TowerId } from "../src/data/assess/types";
import { getAssessProgramHydrationSnapshot } from "../src/lib/localStore";

const seed = buildSeededAssessProgramV2();
const hydrated = getAssessProgramHydrationSnapshot();
assert.equal(hydrated.version, 4);
assert.ok(hydrated.leadDeadlines, "hydration snapshot includes leadDeadlines");
assert.equal(seed.version, 4);
assert.ok(seed.leadDeadlines, "seeded program should include default leadDeadlines");

for (const tw of towers) {
  const tid = tw.id as TowerId;
  const row = seed.leadDeadlines?.[tid];
  assert.ok(row?.step1Due && row.step2Due && row.step4Due, `deadlines row for ${tid}`);
  const name = formatVersantTowerLeadNames(tw);
  assert.ok(name.length > 0 && name !== "TBD — subject to discovery", `versant leads for ${tid}`);
  const acn = formatAccentureTowerLeadNames(tw);
  assert.ok(acn.length > 0 && acn !== "TBD — subject to discovery", `accenture leads for ${tid}`);
  const t = seed.towers[tid];
  assert.ok(t, `tower state ${tid}`);
  assert.equal(isLeadStepDone(2, t), false, `seeded tower ${tid} should not be step-2 complete`);
}

const defaults = buildDefaultProgramLeadDeadlines();
const merged = mergeLeadDeadlines(defaults, {
  finance: { step1Due: "2030-01-01" },
});
assert.equal(merged?.finance?.step1Due, "2030-01-01");
assert.equal(merged?.hr?.step1Due, defaults.hr?.step1Due);

console.log("programSmokeTest: ok");
