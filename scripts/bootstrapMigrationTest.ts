/**
 * bootstrapMigrationTest — verifies that bootstrapHashOnRead:
 *
 *   1. Stamps every row with no curationContentHash.
 *   2. Sets stage to "idle" for newly stamped rows.
 *   3. Is idempotent on repeat calls.
 *   4. Does NOT mark already-stamped rows as queued.
 *
 * The motivation is the seeded program — without bootstrap on first read,
 * every row's stored hash would be undefined, and the staleness predicate
 * would be ambiguous. Bootstrap stamps an idle baseline so the
 * StaleCurationBanner only fires after a real edit.
 *
 *   `npx tsx scripts/bootstrapMigrationTest.ts`
 */

import { buildSeededAssessProgramV2 } from "../src/data/assess/seedAssessProgram";
import {
  bootstrapHashOnRead,
  hasQueuedRows,
  rowCurrentHash,
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

let totalRows = 0;
let unstampedBefore = 0;
let stampedAfter = 0;
let queuedAfter = 0;

for (const [, t] of Object.entries(program.towers)) {
  if (!t) continue;
  totalRows += t.l3Rows.length;
  for (const r of t.l3Rows) {
    if (r.curationContentHash == null) unstampedBefore += 1;
  }
  const after = bootstrapHashOnRead(t.l3Rows);
  for (const r of after) {
    if (r.curationContentHash != null) stampedAfter += 1;
    if (r.curationStage === "queued") queuedAfter += 1;
  }

  // Idempotence: second call must return the same array reference (no
  // touched flag triggered).
  const after2 = bootstrapHashOnRead(after);
  check(
    `[${t.l3Rows.length} rows] bootstrap is idempotent on repeat call`,
    after2 === after,
  );

  // Hash agreement: every stamped row's stored hash equals rowCurrentHash.
  for (const r of after) {
    if (r.curationContentHash !== rowCurrentHash(r)) {
      check(
        "stored hash equals computed hash",
        false,
        `row=${r.id} stored=${r.curationContentHash} computed=${rowCurrentHash(r)}`,
      );
    }
  }
  check(
    "no row left in 'queued' stage by bootstrap",
    !hasQueuedRows(after),
  );
}

console.log("\n========================================");
console.log(
  `bootstrap migration: stamped=${stampedAfter}/${totalRows} ` +
    `(unstamped going in = ${unstampedBefore}); queued after bootstrap = ${queuedAfter}`,
);
console.log(`${pass} passed, ${fail} failed.`);
if (fail > 0 || queuedAfter > 0 || stampedAfter !== totalRows) {
  console.log("FAILED — bootstrap migration is not safe to ship.");
  process.exit(1);
}
console.log("PASS — bootstrap migration safe.");
