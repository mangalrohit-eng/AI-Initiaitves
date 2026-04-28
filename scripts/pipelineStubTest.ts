/**
 * pipelineStubTest — drives the curationPipeline orchestrator (Phase 1 stub
 * mode) over a queued row and verifies the post-run row has:
 *
 *   1. l4Items populated, with at least one entry.
 *   2. l4Activities mirrored from l4Items[*].name (so the next hash compute
 *      matches curationContentHash exactly).
 *   3. curationStage === "done", curationGeneratedAt populated.
 *   4. curationContentHash equal to computeCurationContentHash on the new
 *      l4Activities — guarantees the selector's Path 0 cache hit.
 *   5. Selector picks up the cached items via the l4Items source-mix counter.
 *
 * Setup: a Node-side `window.localStorage` stub. localStore.ts (and therefore
 * curationPipeline.ts) reads/writes through the real getAssessProgram /
 * setTowerAssess against this in-memory store, so the test exercises the
 * exact same code paths that ship to the browser.
 *
 *   `npx tsx scripts/pipelineStubTest.ts`
 */

// ----- localStorage stub (must run before any localStore import) -----
const memStorage = new Map<string, string>();
const fakeStorage = {
  getItem: (k: string) => (memStorage.has(k) ? memStorage.get(k)! : null),
  setItem: (k: string, v: string) => {
    memStorage.set(k, v);
  },
  removeItem: (k: string) => {
    memStorage.delete(k);
  },
  clear: () => memStorage.clear(),
  key: (i: number) => Array.from(memStorage.keys())[i] ?? null,
  get length() {
    return memStorage.size;
  },
};
Object.defineProperty(globalThis, "window", {
  value: { localStorage: fakeStorage, addEventListener: () => {}, removeEventListener: () => {} },
  configurable: true,
});

import { towers } from "../src/data/towers";
import { buildSeededAssessProgramV2 } from "../src/data/assess/seedAssessProgram";
import {
  computeCurationContentHash,
} from "../src/lib/initiatives/curationHash";
import { getAssessProgram, setAssessProgram } from "../src/lib/localStore";
import { runForRows } from "../src/lib/assess/curationPipeline";
import { selectInitiativesForTower } from "../src/lib/initiatives/select";
import type { TowerId } from "../src/data/assess/types";

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

// Seed the stubbed localStorage with the bootstrapped seeded program.
setAssessProgram(buildSeededAssessProgramV2());
let program = getAssessProgram(); // bootstraps hashes via migrateBootstrapCurationHash

// Pick a tower with at least one l4Activities-bearing row.
const tower = towers.find(
  (t) =>
    program.towers[t.id as TowerId]?.l3Rows.some(
      (r) => (r.l4Activities ?? []).length > 0,
    ) ?? false,
);
if (!tower) {
  console.error("No tower with non-empty l4Activities — cannot run test.");
  process.exit(2);
}
const towerId = tower.id as TowerId;
const targetRow = program.towers[towerId]!.l3Rows.find(
  (r) => (r.l4Activities ?? []).length > 0,
)!;

console.log(`\nDriving stub pipeline against:`);
console.log(`  tower:  ${towerId}`);
console.log(`  L2:     ${targetRow.l2}`);
console.log(`  L3:     ${targetRow.l3}`);
console.log(
  `  L4 list: ${(targetRow.l4Activities ?? []).join(", ").slice(0, 120)}...`,
);

// Mark the row queued by mutating its stage directly through setAssessProgram
// (so the change persists into our localStorage stub).
{
  const next = {
    ...program,
    towers: {
      ...program.towers,
      [towerId]: {
        ...program.towers[towerId]!,
        l3Rows: program.towers[towerId]!.l3Rows.map((r) =>
          r.id === targetRow.id ? { ...r, curationStage: "queued" as const } : r,
        ),
      },
    },
  };
  setAssessProgram(next);
}

(async () => {
  const summary = await runForRows({ towerId, rowIds: [targetRow.id] });
  console.log(`\nSummary: ${JSON.stringify(summary)}`);

  program = getAssessProgram();
  const fresh = program.towers[towerId]!.l3Rows.find(
    (r) => r.id === targetRow.id,
  )!;

  check(
    "row has l4Items populated",
    Array.isArray(fresh.l4Items) && fresh.l4Items.length > 0,
    `l4Items.length=${fresh.l4Items?.length}`,
  );
  check(
    "l4Activities mirrors l4Items[*].name",
    JSON.stringify(fresh.l4Activities) ===
      JSON.stringify((fresh.l4Items ?? []).map((x) => x.name)),
  );
  check(
    "curationStage === 'done' (not queued, not running, not failed)",
    fresh.curationStage === "done",
    `stage=${fresh.curationStage}`,
  );
  check(
    "curationGeneratedAt populated",
    typeof fresh.curationGeneratedAt === "string" &&
      fresh.curationGeneratedAt.length > 0,
  );
  const expectedHash = computeCurationContentHash(
    fresh.l2,
    fresh.l3,
    fresh.l4Activities ?? [],
  );
  check(
    "curationContentHash matches the new l4Activities footprint",
    fresh.curationContentHash === expectedHash,
    `stored=${fresh.curationContentHash} expected=${expectedHash}`,
  );

  // Selector picks up the cache (Path 0).
  const result = selectInitiativesForTower(towerId, program, tower);
  check(
    "selector source-mix counts l4Items > 0 (cache hit on Path 0)",
    result.diagnostics.sourceMix.l4Items > 0,
    `sourceMix=${JSON.stringify(result.diagnostics.sourceMix)}`,
  );

  // Post-refresh split (postRefreshSplitTest folded in here).
  const eligibleCount = (fresh.l4Items ?? []).filter((i) => i.aiEligible).length;
  console.log(
    `\nPost-refresh: ${eligibleCount} of ${fresh.l4Items?.length ?? 0} L4s are AI-eligible.`,
  );
  check(
    "post-refresh split is internally consistent (eligible + needReview = succeeded)",
    summary.eligibleRows + summary.needReviewRows === summary.succeeded,
    `${summary.eligibleRows} + ${summary.needReviewRows} vs ${summary.succeeded}`,
  );

  // Re-run a second time on the SAME row — should NOT re-stale, because the
  // hash now matches and the row is `done`.
  const summaryReplay = await runForRows({ towerId, rowIds: [targetRow.id] });
  check(
    "second run of pipeline on done row still succeeds (idempotent)",
    summaryReplay.succeeded === 1 && summaryReplay.failed === 0,
    JSON.stringify(summaryReplay),
  );

  console.log("\n========================================");
  console.log(`pipeline stub: ${pass} passed, ${fail} failed.`);
  if (fail > 0) process.exit(1);
})().catch((err) => {
  console.error(err);
  process.exit(2);
});
