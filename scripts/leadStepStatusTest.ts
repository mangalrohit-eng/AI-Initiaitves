/**
 * Lightweight checks for lead deadline classification (run: npx tsx scripts/leadStepStatusTest.ts).
 */
import assert from "node:assert/strict";
import {
  classifyLeadDeadline,
  deadlineChipCopy,
  endOfLocalDayFromYmd,
  isLeadStepDone,
  leadStepCompletedAtIso,
} from "../src/lib/program/leadStepStatus";
import { isCapabilityMapJourneyStepDone } from "../src/lib/assess/capabilityMapStepStatus";
import { mergeLeadDeadlines } from "../src/lib/program/leadDeadlines";
import { defaultTowerRates } from "../src/data/assess/types";
import type { TowerAssessState } from "../src/data/assess/types";

const baseTower = (): TowerAssessState => ({
  l4Rows: [],
  baseline: { baselineOffshorePct: 20, baselineAIPct: 15 },
  rates: defaultTowerRates("finance"),
  status: "data",
});

// ---------- isLeadStepDone ----------

// Step 1 done when l1L5TreeValidatedAt set
{
  const t: TowerAssessState = {
    ...baseTower(),
    l1L5TreeValidatedAt: "2026-01-01T00:00:00.000Z",
  };
  assert.equal(isLeadStepDone(1, t), true);
  assert.equal(isLeadStepDone(1, { ...baseTower() }), false);
}

// Step 1 done via legacy l1L3TreeValidatedAt alias (v4 → v5 migration window)
{
  const t: TowerAssessState = {
    ...baseTower(),
    l1L3TreeValidatedAt: "2026-01-01T00:00:00.000Z",
  };
  assert.equal(isLeadStepDone(1, t), true);
}

// Step 1 NO LONGER follows Step 2's `status === "complete"` — invalidating
// Step 1 must work even when the tower is Step-2-signed-off. (The legacy
// fallback was moved into a one-shot read-time migration in localStore.ts.)
{
  const t: TowerAssessState = { ...baseTower(), status: "complete" };
  assert.equal(
    isCapabilityMapJourneyStepDone(t),
    false,
    "Step 1 must be strictly timestamp-driven — Step 2 status should not leak through",
  );
  assert.equal(isLeadStepDone(1, t), false);
}

// ---------- leadStepCompletedAtIso ----------

{
  const iso = "2026-04-20T15:30:00.000Z";
  const t: TowerAssessState = { ...baseTower(), l1L5TreeValidatedAt: iso };
  assert.equal(leadStepCompletedAtIso(1, t), iso);
}

{
  // Step 2: requires status === "complete" AND one of the section timestamps
  const iso = "2026-04-21T12:00:00.000Z";
  const done: TowerAssessState = {
    ...baseTower(),
    status: "complete",
    aiConfirmedAt: iso,
  };
  assert.equal(leadStepCompletedAtIso(2, done), iso);
  // When not complete yet, returns undefined even if a section timestamp exists
  const pending: TowerAssessState = {
    ...baseTower(),
    aiConfirmedAt: iso,
  };
  assert.equal(leadStepCompletedAtIso(2, pending), undefined);
}

{
  const iso = "2026-04-22T10:00:00.000Z";
  const t: TowerAssessState = { ...baseTower(), impactEstimateValidatedAt: iso };
  assert.equal(leadStepCompletedAtIso(3, t), iso);
  // Invalidated → undefined
  assert.equal(
    leadStepCompletedAtIso(3, { ...baseTower() }),
    undefined,
    "Clearing impactEstimateValidatedAt must drop the completion stamp",
  );
}

{
  const iso = "2026-04-23T08:00:00.000Z";
  const t: TowerAssessState = { ...baseTower(), aiInitiativesValidatedAt: iso };
  assert.equal(leadStepCompletedAtIso(4, t), iso);
  assert.equal(leadStepCompletedAtIso(4, { ...baseTower() }), undefined);
}

// ---------- classifyLeadDeadline ----------

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

// ---------- deadlineChipCopy ----------

// When pending, dueDisplay is the due-date YMD and ariaLabel says "due"
{
  const due = "2030-12-31";
  const end = endOfLocalDayFromYmd(due)!;
  const early = new Date(end.getTime() - 20 * 24 * 60 * 60 * 1000);
  const copy = deadlineChipCopy("Finance", 1, due, false, early);
  assert.equal(copy.urgency, "pending");
  assert.equal(copy.dueDisplay, due);
  assert.ok(copy.ariaLabel.includes("due 2030-12-31"));
}

// When done with completedAtIso, dueDisplay is the formatted completion date
// and ariaLabel says "validated"
{
  const due = "2030-12-31";
  const completed = "2026-04-30T18:00:00.000Z";
  const now = new Date("2026-05-01T12:00:00.000Z");
  const copy = deadlineChipCopy("Finance", 1, due, true, now, undefined, completed);
  assert.equal(copy.urgency, "done");
  // Expect something like "Apr 30" — format is locale-dependent, so just
  // verify it's NOT the raw due-date YMD (which was the old bug).
  assert.notEqual(copy.dueDisplay, due);
  assert.ok(copy.dueDisplay && copy.dueDisplay.length > 0);
  assert.ok(
    copy.ariaLabel.includes("validated"),
    `ariaLabel should say 'validated' when done; got: ${copy.ariaLabel}`,
  );
  assert.ok(!copy.ariaLabel.includes("due"));
}

// When done with NO completedAtIso, fall back to showing due date
// (defensive — caller should always pass completedAtIso)
{
  const due = "2030-12-31";
  const now = new Date("2026-05-01T12:00:00.000Z");
  const copy = deadlineChipCopy("Finance", 1, due, true, now);
  assert.equal(copy.urgency, "done");
  assert.equal(copy.dueDisplay, due);
}

// ---------- mergeLeadDeadlines ----------

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
