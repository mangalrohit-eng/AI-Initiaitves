/**
 * staleDetectionTest — verifies that the curationContentHash machinery
 * actually flags a row as `queued` when its name footprint changes, and
 * leaves it alone when only the dial moves.
 *
 * Three scenarios per pass:
 *
 *   1. Dial-only edit — same L2/L3/L4 names, different aiImpactAssessmentPct.
 *      Expectation: hash unchanged, stage stays as-is, banner does NOT fire.
 *   2. L4 list edit — adds a new activity to l4Activities.
 *      Expectation: hash changes, stage flips to "queued", banner fires.
 *   3. L3 rename — l3 renamed but ids/headcount preserved.
 *      Expectation: hash changes, stage flips to "queued", banner fires.
 *
 * Pass criteria: every assertion below passes for every tower.
 *   `npx tsx scripts/staleDetectionTest.ts`
 */

import { buildSeededAssessProgramV2 } from "../src/data/assess/seedAssessProgram";
import {
  bootstrapHashOnRead,
  computeCurationContentHash,
  hasQueuedRows,
  markRowsStaleByHash,
} from "../src/lib/initiatives/curationHash";

const program = buildSeededAssessProgramV2();

let pass = 0;
let fail = 0;

function check(label: string, cond: boolean, detail?: string) {
  if (cond) {
    pass += 1;
    console.log(`  PASS  ${label}`);
  } else {
    fail += 1;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

for (const [towerId, t] of Object.entries(program.towers)) {
  if (!t || t.l3Rows.length === 0) continue;
  // Bootstrap first — the seeded rows have no curationContentHash; this
  // mirrors what localStorage's read-time migration does.
  const seeded = bootstrapHashOnRead(t.l3Rows);
  const target = seeded[0];

  console.log(`\n[${towerId}] ${target.l2} > ${target.l3}`);

  // 1. Dial-only edit.
  {
    const next = seeded.map((r) =>
      r.id === target.id ? { ...r, aiImpactAssessmentPct: 99 } : r,
    );
    const after = markRowsStaleByHash(next);
    const row = after.find((r) => r.id === target.id)!;
    check(
      "1) dial-only edit does NOT flag stale",
      row.curationStage !== "queued",
      `stage=${row.curationStage}`,
    );
    check(
      "1) dial-only edit preserves hash",
      row.curationContentHash === target.curationContentHash,
    );
  }

  // 2. L4 list edit (add a new name).
  {
    const newL4 = "Synthetic test activity — should flag";
    const next = seeded.map((r) =>
      r.id === target.id
        ? { ...r, l4Activities: [...(r.l4Activities ?? []), newL4] }
        : r,
    );
    const after = markRowsStaleByHash(next);
    const row = after.find((r) => r.id === target.id)!;
    check(
      "2) L4 list edit flags row as queued",
      row.curationStage === "queued",
      `stage=${row.curationStage}`,
    );
    check(
      "2) L4 list edit detected via hasQueuedRows",
      hasQueuedRows(after),
    );
    // Hash on the row stays as the OLD hash until the pipeline runs and
    // stamps the new one — that's the contract that protects against
    // half-applied refreshes.
    check(
      "2) old hash is preserved (pipeline will overwrite on success)",
      row.curationContentHash === target.curationContentHash,
    );
  }

  // 3. L3 rename.
  {
    const renamed = `${target.l3} (renamed for test)`;
    const next = seeded.map((r) =>
      r.id === target.id ? { ...r, l3: renamed } : r,
    );
    const after = markRowsStaleByHash(next);
    const row = after.find((r) => r.id === target.id)!;
    const newHash = computeCurationContentHash(
      row.l2,
      row.l3,
      row.l4Activities ?? [],
    );
    check(
      "3) L3 rename flags row as queued",
      row.curationStage === "queued",
      `stage=${row.curationStage}`,
    );
    check(
      "3) new content hash differs from stored",
      newHash !== row.curationContentHash,
    );
  }
}

console.log("\n========================================");
console.log(`stale detection: ${pass} passed, ${fail} failed.`);
if (fail > 0) process.exit(1);
