/**
 * Lightweight checks for lead deadline classification (run: npx tsx scripts/leadStepStatusTest.ts).
 */
import assert from "node:assert/strict";
import {
  classifyLeadDeadline,
  endOfLocalDayFromYmd,
  isLeadStepDone,
} from "../src/lib/program/leadStepStatus";
import { mergeLeadDeadlines } from "../src/lib/program/leadDeadlines";
import type { TowerAssessState } from "../src/data/assess/types";

const baseTower = (): TowerAssessState => ({
  l3Rows: [],
  baseline: { baselineOffshorePct: 20, baselineAIPct: 15 },
  status: "data",
});

// Step 1 done when l1L3TreeValidatedAt set
{
  const t = { ...baseTower(), l1L3TreeValidatedAt: "2026-01-01T00:00:00.000Z" };
  assert.equal(isLeadStepDone(1, t), true);
  assert.equal(isLeadStepDone(1, { ...baseTower() }), false);
}

// Past due: now after end of due day
{
  const due = "2020-01-15";
  const end = endOfLocalDayFromYmd(due);
  assert.ok(end);
  const past = new Date(end.getTime() + 60_000);
  assert.equal(classifyLeadDeadline(due, false, past), "past_due");
}

// Due soon: within 7 days before end
{
  const due = "2030-12-31";
  const end = endOfLocalDayFromYmd(due)!;
  const soon = new Date(end.getTime() - 3 * 24 * 60 * 60 * 1000);
  assert.equal(classifyLeadDeadline(due, false, soon), "due_soon");
}

// Pending: more than 7 days before end
{
  const due = "2030-12-31";
  const end = endOfLocalDayFromYmd(due)!;
  const early = new Date(end.getTime() - 20 * 24 * 60 * 60 * 1000);
  assert.equal(classifyLeadDeadline(due, false, early), "pending");
}

// Merge preserves base when incoming empty
{
  type Tid = "finance";
  const base = { finance: { step1Due: "2026-05-01" } } as Record<Tid, { step1Due?: string }>;
  const merged = mergeLeadDeadlines(base, {});
  assert.deepEqual(merged, base);
}

// Merge overlays per tower
{
  type Tid = "finance" | "hr";
  const base = { finance: { step1Due: "2026-05-01" } } as Record<Tid, { step1Due?: string; step2Due?: string }>;
  const inc = { finance: { step2Due: "2026-06-01" }, hr: { step1Due: "2026-04-01" } } as Record<
    Tid,
    { step1Due?: string; step2Due?: string }
  >;
  const merged = mergeLeadDeadlines(base, inc);
  assert.equal(merged?.finance?.step1Due, "2026-05-01");
  assert.equal(merged?.finance?.step2Due, "2026-06-01");
  assert.equal(merged?.hr?.step1Due, "2026-04-01");
}

console.log("leadStepStatusTest: ok");
