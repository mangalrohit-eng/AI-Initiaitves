/**
 * Validator coverage for the per-initiative `intakeStatus` block — the
 * server-side post-LLM check that prevents fabricated Done / In Progress
 * classifications.
 *
 * Run: `npx tsx scripts/intakeStatusValidatorTest.ts` (or
 * `npm run test:intake-status`).
 *
 * The validator is the single anti-fabrication backstop for the
 * intake-driven status filter. If this script passes, the LLM cannot
 * upgrade an initiative to `done` or `in-progress` without a verbatim
 * quote that actually appears in the named intake field, and cannot
 * sneak forward-looking sentiment (`biggestImpact`) or exclusion text
 * (`noGoAreas`) in as positive evidence.
 */
import assert from "node:assert/strict";
import {
  sanitizeIntakeStatus,
  type IntakeContextForValidator,
} from "../src/lib/assess/curateL3InitiativesLLM";

const baseIntake: IntakeContextForValidator = {
  fields: {
    currentAiTools:
      "Finance currently uses BlackLine for intercompany flux automation across all 7 Versant entities and HighRadius for collections in production.",
    experimentsLearnings:
      "We piloted FloQast for the multi-brand close last quarter and learned that consolidation rules need an editorial review for the cable carve-out.",
    readyNow:
      "We have started piloting AI-assisted invoice triage for Fandango payables — kickoff was last sprint and 4 entities are live.",
    noGoAreas:
      "Do not automate executive-level disclosure controls or anything touching the SEC 10-K narrative.",
  },
  importedAt: "2026-05-15T12:00:00.000Z",
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

console.log("\nintakeStatus validator");

// ---------- happy paths ----------

check("done with verbatim quote from currentAiTools is accepted", () => {
  const out = sanitizeIntakeStatus(
    {
      status: "done",
      evidence: "uses BlackLine for intercompany flux automation",
      evidenceField: "currentAiTools",
    },
    "Intercompany Close Reconciliation",
    baseIntake,
  );
  assert.equal(out?.status, "done");
  assert.equal(out?.evidenceField, "currentAiTools");
  assert.match(out?.evidence ?? "", /BlackLine/);
  assert.equal(out?.intakeImportedAt, baseIntake.importedAt);
  assert.ok(typeof out?.classifiedAt === "string" && out.classifiedAt.length > 0);
});

check("in-progress with verbatim quote from experimentsLearnings is accepted", () => {
  const out = sanitizeIntakeStatus(
    {
      status: "in-progress",
      evidence: "piloted FloQast for the multi-brand close last quarter",
      evidenceField: "experimentsLearnings",
    },
    "Multi-Brand Close Acceleration",
    baseIntake,
  );
  assert.equal(out?.status, "in-progress");
  assert.equal(out?.evidenceField, "experimentsLearnings");
});

check("punctuation drift (curly quotes / em-dash) still matches", () => {
  const out = sanitizeIntakeStatus(
    {
      status: "in-progress",
      // NOTE: smart-quoted version of the readyNow text
      evidence: "We have started piloting AI\u2011assisted invoice triage for Fandango payables \u2014 kickoff was last sprint",
      evidenceField: "readyNow",
    },
    "Payables Triage Co-Pilot",
    baseIntake,
  );
  assert.equal(out?.status, "in-progress");
});

// ---------- anti-fabrication backstop ----------

check("done with quote NOT in named field is downgraded to not-done", () => {
  const out = sanitizeIntakeStatus(
    {
      status: "done",
      evidence: "we have a fully autonomous Treasury Liquidity Operator in production",
      evidenceField: "currentAiTools",
    },
    "Treasury Liquidity Forecaster",
    baseIntake,
  );
  assert.equal(out?.status, "not-done");
  assert.equal(out?.evidence, "");
});

check("in-progress with paraphrased (non-substring) quote is downgraded", () => {
  const out = sanitizeIntakeStatus(
    {
      status: "in-progress",
      evidence: "we tried out FloQast software for monthly close last fiscal quarter",
      evidenceField: "experimentsLearnings",
    },
    "Multi-Brand Close",
    baseIntake,
  );
  assert.equal(out?.status, "not-done");
});

check("done with empty evidence is downgraded", () => {
  const out = sanitizeIntakeStatus(
    {
      status: "done",
      evidence: "",
      evidenceField: "currentAiTools",
    },
    "Intercompany Close",
    baseIntake,
  );
  assert.equal(out?.status, "not-done");
});

// ---------- noGoAreas negative gate ----------

check("L3 token in noGoAreas downgrades a done classification", () => {
  const out = sanitizeIntakeStatus(
    {
      status: "done",
      // valid quote in currentAiTools
      evidence: "uses BlackLine for intercompany flux automation",
      evidenceField: "currentAiTools",
    },
    // L3 label has "disclosure" — appears in noGoAreas
    "Disclosure Controls Co-Pilot",
    baseIntake,
  );
  assert.equal(out?.status, "not-done");
});

// ---------- evidenceField enum guards ----------

check("evidenceField=biggestImpact is rejected (coerced)", () => {
  const out = sanitizeIntakeStatus(
    {
      status: "done",
      evidence: "uses BlackLine for intercompany flux automation",
      evidenceField: "biggestImpact",
    },
    "Intercompany Close",
    baseIntake,
  );
  // `biggestImpact` is coerced to default `currentAiTools`. The quote happens
  // to match `currentAiTools`, so it stays `done` — which is the correct
  // behavior: the validator never accepts `biggestImpact` as a source, but
  // doesn't punish a quote that turns out to be valid against the default.
  assert.equal(out?.status, "done");
  assert.equal(out?.evidenceField, "currentAiTools");
});

check("evidenceField=noGoAreas is rejected (coerced + downgraded)", () => {
  const out = sanitizeIntakeStatus(
    {
      status: "done",
      evidence: "Do not automate executive-level disclosure controls",
      evidenceField: "noGoAreas",
    },
    "Disclosure Controls",
    baseIntake,
  );
  // Coerced to `currentAiTools`; quote isn't in `currentAiTools` → downgraded.
  assert.equal(out?.status, "not-done");
});

// ---------- no-intake mode ----------

check("absent intake → returns undefined regardless of LLM payload", () => {
  const out = sanitizeIntakeStatus(
    {
      status: "done",
      evidence: "anything",
      evidenceField: "currentAiTools",
    },
    "Any L3",
    undefined,
  );
  assert.equal(out, undefined);
});

check("status=not-done normalizes to a fresh entry with empty evidence", () => {
  const out = sanitizeIntakeStatus(
    {
      status: "not-done",
      evidence: "ignored quote that should not appear",
      evidenceField: "readyNow",
    },
    "Speculative Initiative",
    baseIntake,
  );
  assert.equal(out?.status, "not-done");
  assert.equal(out?.evidence, "");
  assert.equal(out?.evidenceField, "currentAiTools");
});

check("malformed payloads (string / null / array) → undefined when no intake; not-done otherwise", () => {
  // Without intake the validator drops everything.
  assert.equal(sanitizeIntakeStatus("nope" as unknown, "L3", undefined), undefined);
  // With intake, malformed payloads still drop because the early null/object
  // guard fires before the fabrication path.
  assert.equal(
    sanitizeIntakeStatus("nope" as unknown, "L3", baseIntake),
    undefined,
  );
  assert.equal(sanitizeIntakeStatus(null, "L3", baseIntake), undefined);
  assert.equal(sanitizeIntakeStatus([] as unknown, "L3", baseIntake), undefined);
});

// ---------- summary ----------

if (failures > 0) {
  console.error(`\n${failures} intakeStatus validator check(s) failed.`);
  process.exit(1);
}
console.log("\nAll intakeStatus validator checks passed.");
