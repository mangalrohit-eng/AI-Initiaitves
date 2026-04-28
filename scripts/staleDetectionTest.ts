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
  getTowerStaleState,
  hasQueuedRows,
  markRowsQueuedOnUpload,
  markRowsStaleByHash,
} from "../src/lib/initiatives/curationHash";
import { defaultTowerBaseline } from "../src/data/assess/types";
import type { L3WorkforceRow } from "../src/data/assess/types";

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

// ---------------------------------------------------------------------------
// 4. markRowsQueuedOnUpload — simulates the importOp atomic write.
//    Verifies that a fresh upload stamps every row queued + hashes it.
// ---------------------------------------------------------------------------
console.log("\n[upload contract] markRowsQueuedOnUpload");
{
  // Simulate a parsed CSV: rows arrive without curationContentHash /
  // curationStage / l4Items / dial overrides / rationales.
  const uploadedRows: L3WorkforceRow[] = [
    {
      id: "test-1",
      l2: "Record to Report",
      l3: "Reconciliation",
      fteOnshore: 5,
      fteOffshore: 0,
      contractorOnshore: 0,
      contractorOffshore: 0,
    },
    {
      id: "test-2",
      l2: "Record to Report",
      l3: "Intercompany",
      fteOnshore: 3,
      fteOffshore: 0,
      contractorOnshore: 0,
      contractorOffshore: 0,
    },
  ];
  const queued = markRowsQueuedOnUpload(uploadedRows);
  check(
    "4) every uploaded row is queued",
    queued.every((r) => r.curationStage === "queued"),
    `stages=${queued.map((r) => r.curationStage).join(",")}`,
  );
  check(
    "4) every uploaded row has curationContentHash",
    queued.every(
      (r) =>
        typeof r.curationContentHash === "string" &&
        r.curationContentHash.length > 0,
    ),
  );
  check(
    "4) hasQueuedRows fires after upload",
    hasQueuedRows(queued),
  );
  check(
    "4) dial overrides cleared on upload",
    queued.every(
      (r) =>
        r.offshoreAssessmentPct == null && r.aiImpactAssessmentPct == null,
    ),
  );
  check(
    "4) dial rationales cleared on upload",
    queued.every(
      (r) =>
        r.offshoreRationale == null &&
        r.aiImpactRationale == null &&
        r.dialsRationaleSource == null,
    ),
  );
  check(
    "4) l4Items cleared on upload",
    queued.every((r) => r.l4Items == null || r.l4Items.length === 0),
  );
}

// ---------------------------------------------------------------------------
// 5. getTowerStaleState — three banner predicates, one source of truth.
// ---------------------------------------------------------------------------
console.log("\n[stale state] getTowerStaleState");
{
  // Sample-loaded state — every row has dialsRationaleSource: "starter",
  // l4Activities populated, no queued rows. ALL three predicates should
  // report false.
  const sampleProgram = buildSeededAssessProgramV2();
  const sampleTower = Object.values(sampleProgram.towers).find(
    (t) => t && t.l3Rows.length > 0,
  );
  if (!sampleTower) {
    console.error("No sample tower with rows — cannot verify stale state.");
    process.exit(2);
  }
  const sampleState = getTowerStaleState(sampleTower);
  check(
    "5a) sample-loaded tower is NOT l4Stale",
    sampleState.l4Stale === false,
  );
  check(
    "5a) sample-loaded tower is NOT dialsStale",
    sampleState.dialsStale === false,
  );
  check(
    "5a) sample-loaded tower is NOT initiativesStale",
    sampleState.initiativesStale === false,
  );

  // Post-upload state — rows queued, no l4Activities, no dial rationales.
  // l4Stale + dialsStale + initiativesStale + missingL4ForRefresh all true.
  const uploadRows: L3WorkforceRow[] = [
    {
      id: "u-1",
      l2: "Record to Report",
      l3: "Reconciliation",
      fteOnshore: 5,
      fteOffshore: 0,
      contractorOnshore: 0,
      contractorOffshore: 0,
    },
  ];
  const uploadState = getTowerStaleState({
    l3Rows: markRowsQueuedOnUpload(uploadRows),
  });
  check("5b) post-upload tower is l4Stale", uploadState.l4Stale === true);
  check(
    "5b) post-upload tower is dialsStale",
    uploadState.dialsStale === true,
  );
  check(
    "5b) post-upload tower is initiativesStale",
    uploadState.initiativesStale === true,
  );
  check(
    "5b) post-upload tower has missingL4ForRefresh",
    uploadState.missingL4ForRefresh === true,
  );

  // Verify the platform default baseline is what `importOp` falls back to.
  check(
    "5c) defaultTowerBaseline holds 20% / 15%",
    defaultTowerBaseline.baselineOffshorePct === 20 &&
      defaultTowerBaseline.baselineAIPct === 15,
  );
}

console.log("\n========================================");
console.log(`stale detection: ${pass} passed, ${fail} failed.`);
if (fail > 0) process.exit(1);
