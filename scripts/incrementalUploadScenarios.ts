/**
 * Scenario-driven end-to-end test for the Step 4 incremental upload +
 * source-exclusivity feature.
 *
 * The companion `uploadInitiativesE2E.ts` covers the field-level units
 * (parser, fingerprint math, single-helper assertions). This script
 * covers the integrated FLOWS: multi-upload growth, mode-switching
 * round-trips, idempotent re-upload of real-shaped data, and the
 * stale-review-leak protection that closed the Finance 49→44 bug.
 *
 * Run: `npx tsx scripts/incrementalUploadScenarios.ts`
 *
 * Exit 0 only when every scenario passes. Failures print structured
 * diagnostics so the failing assertion is obvious without re-reading
 * the script.
 */

// ---------------------------------------------------------------------------
// localStorage polyfill BEFORE importing anything that reaches into the store.
// ---------------------------------------------------------------------------
{
  const mem = new Map<string, string>();
  const storage = {
    getItem: (k: string): string | null => (mem.has(k) ? mem.get(k)! : null),
    setItem: (k: string, v: string): void => {
      mem.set(k, String(v));
    },
    removeItem: (k: string): void => {
      mem.delete(k);
    },
    clear: (): void => {
      mem.clear();
    },
    key: (i: number): string | null => Array.from(mem.keys())[i] ?? null,
    get length(): number {
      return mem.size;
    },
  };
  (globalThis as unknown as { window: { localStorage: typeof storage } }).window = {
    localStorage: storage,
  };
}

import assert from "node:assert/strict";

import {
  clearLLMInitiativesForTower,
  clearManualInitiativesForTower,
  countAllManualInitiatives,
  runEnrichmentFromUpload,
  runForL3Rows,
} from "../src/lib/assess/curationPipelineV6";
import {
  encodeEnrichUploadStreamEvent,
  type EnrichUploadStreamEvent,
} from "../src/lib/assess/curateL3InitiativesStreamProtocol";
import { deriveTowerInitiativeMode } from "../src/lib/initiatives/towerMode";
import {
  getAssessProgram,
  getInitiativeReviews,
  setAssessProgram,
  setInitiativeReview,
} from "../src/lib/localStore";
import {
  computeUploadFingerprint,
  defaultTowerBaseline,
  defaultTowerRates,
  type AssessProgramV2,
  type L3WorkforceRowV6,
  type TowerId,
} from "../src/data/assess/types";
import type { ParsedInitiativeUploadRow } from "../src/lib/assess/parseInitiativeUploadFile";

const TOWER: TowerId = "finance";

// ---------------------------------------------------------------------------
// Tiny test harness — scenario-grained PASS/FAIL with structured output.
// ---------------------------------------------------------------------------
type ScenarioResult = { id: string; title: string; passed: boolean; error?: string };
const results: ScenarioResult[] = [];

async function scenario(
  id: string,
  title: string,
  fn: () => void | Promise<void>,
): Promise<void> {
  process.stdout.write(`\n[${id}] ${title}\n`);
  try {
    await fn();
    process.stdout.write(`  PASS\n`);
    results.push({ id, title, passed: true });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    process.stdout.write(`  FAIL  ${error}\n`);
    if (e instanceof Error && e.stack) {
      const lines = e.stack.split("\n").slice(1, 4);
      for (const l of lines) process.stdout.write(`        ${l.trim()}\n`);
    }
    results.push({ id, title, passed: false, error });
  }
}

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------
function buildFinanceTower(l3Labels: ReadonlyArray<string>): void {
  const slug = (s: string): string =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  const l4Rows = l3Labels.map((label) => ({
    id: `finance::${slug(label)}::activities`,
    l1: "Finance",
    l2: "Corporate Finance",
    l3: label,
    l4: "All Activities",
    fteOnshore: 5,
    fteOffshore: 1,
    contractorOnshore: 0,
    contractorOffshore: 0,
    gccPct: 20,
    gccPctSetAt: new Date().toISOString(),
    gccPctSource: "seed" as const,
    gccReason: "scenario seed",
  }));
  const l3Rows: L3WorkforceRowV6[] = l3Labels.map((label, i) => ({
    id: `finance::${slug(label)}`,
    l1: "Finance",
    l2: "Corporate Finance",
    l3: label,
    fteOnshore: 5 + i,
    fteOffshore: 1,
    contractorOnshore: 0,
    contractorOffshore: 0,
    aiImpactAssessmentPct: 40,
    childL4RowIds: [`finance::${slug(label)}::activities`],
    l3Initiatives: [],
  }));
  const program: AssessProgramV2 = {
    version: 6,
    towers: {
      [TOWER]: {
        l4Rows,
        l3Rows,
        baseline: { ...defaultTowerBaseline },
        rates: defaultTowerRates(TOWER),
        status: "ready",
      },
    },
    leadDeadlines: {},
  };
  setAssessProgram(program);
}

function buildUpload(
  index: number,
  l3: string,
  name: string,
  description: string,
  tech = "BlackLine",
): ParsedInitiativeUploadRow {
  return {
    index,
    l3Raw: l3,
    solutionName: name,
    solutionDescription: description,
    tech,
    diagnostics: [],
  };
}

function fiveSeedRows(): ParsedInitiativeUploadRow[] {
  return [
    buildUpload(
      2,
      "Close and Consolidation",
      "Intercompany Close Reconciliation Co-Pilot",
      "Matches intercompany across Versant entities; close 12-18d → 5-7d.",
    ),
    buildUpload(
      3,
      "Treasury",
      "Covenant Headroom Forecaster",
      "Daily BB- covenant breach risk signal for the CFO.",
    ),
    buildUpload(
      4,
      "FP&A",
      "Flux Variance Narrator",
      "Drafts variance narratives from actuals + plan.",
    ),
    buildUpload(
      5,
      "Accounts Payable",
      "AP Invoice Auto-Coder",
      "85%+ straight-through invoice processing for AP.",
    ),
    buildUpload(
      6,
      "Accounts Receivable",
      "AR Cash Application Agent",
      "Matches incoming payments to open AR with fuzzy keys.",
    ),
  ];
}

function getTowerRows(): L3WorkforceRowV6[] {
  return getAssessProgram().towers[TOWER]?.l3Rows ?? [];
}
function totalStoredCards(): number {
  return getTowerRows().reduce(
    (acc, r) => acc + (r.l3Initiatives?.length ?? 0),
    0,
  );
}
function allStoredIds(): string[] {
  return getTowerRows().flatMap((r) => (r.l3Initiatives ?? []).map((it) => it.id));
}
function towerMode() {
  return deriveTowerInitiativeMode(
    getTowerRows().flatMap((r) => r.l3Initiatives ?? []),
  );
}

// ---------------------------------------------------------------------------
// Fetch stubs (one for upload enrichment, one for discovery)
// ---------------------------------------------------------------------------
function installUploadFetchStub(streamSource: "llm" | "fallback"): void {
  globalThis.fetch = (async (
    _url: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const body = JSON.parse(String(init?.body ?? "{}")) as {
      uploads: Array<{
        uploadRowId: string;
        solutionName: string;
        preMatchedL3RowId?: string;
      }>;
      l3Roster: Array<{ rowId: string }>;
    };
    const slug = (s: string): string =>
      s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48);
    const events: EnrichUploadStreamEvent[] = [
      { kind: "started", totalUploads: body.uploads.length },
      ...body.uploads.map((u) => ({
        kind: "row" as const,
        uploadRowId: u.uploadRowId,
        matchedRowId: u.preMatchedL3RowId ?? body.l3Roster[0]!.rowId,
        payload: {
          id: `mocked::${u.preMatchedL3RowId ?? body.l3Roster[0]!.rowId}::${slug(u.solutionName)}`,
          solutionName: u.solutionName,
          tagline: "Stub tagline.",
          aiRationale: "Stub rationale.",
          feasibility: "Low" as const,
        },
        source: streamSource,
      })),
      { kind: "done", source: streamSource },
    ];
    const ndjson = events
      .map((ev) => new TextDecoder().decode(encodeEnrichUploadStreamEvent(ev)))
      .join("");
    return new Response(ndjson, {
      status: 200,
      headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
    });
  }) as typeof fetch;
}

function installDiscoveryFetchStub(): void {
  globalThis.fetch = (async (
    _url: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const body = JSON.parse(String(init?.body ?? "{}")) as {
      rows: Array<{ rowId: string }>;
    };
    const lines: string[] = [
      JSON.stringify({ kind: "started", totalRows: body.rows.length }) + "\n",
    ];
    for (const r of body.rows) {
      lines.push(
        JSON.stringify({
          kind: "row",
          rowId: r.rowId,
          l3Initiatives: [
            {
              id: `discovery::${r.rowId}::auto`,
              solutionName: "LLM-discovered Solution",
              tagline: "Discovery tagline.",
              aiRationale: "Discovery rationale.",
              feasibility: "Low",
            },
          ],
          source: "llm",
        }) + "\n",
      );
    }
    lines.push(JSON.stringify({ kind: "done", source: "llm" }) + "\n");
    return new Response(lines.join(""), {
      status: 200,
      headers: { "Content-Type": "application/x-ndjson" },
    });
  }) as typeof fetch;
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------
const L3_LABELS = [
  "Close and Consolidation",
  "Treasury",
  "FP&A",
  "Accounts Payable",
  "Accounts Receivable",
];

async function main(): Promise<void> {
  console.log("End-to-end scenarios — incremental upload + source-exclusivity");
  console.log("===============================================================");

  await scenario(
    "S1",
    "Fresh tower → upload 5 rows → cards stamped, fingerprinted, mode=user-uploaded",
    async () => {
      buildFinanceTower(L3_LABELS);
      installUploadFetchStub("llm");
      const rows = fiveSeedRows();
      const summary = await runEnrichmentFromUpload({
        towerId: TOWER,
        parsedRows: rows,
      });
      assert.equal(summary.totalUploads, 5);
      assert.equal(summary.enriched, 5, "all 5 stamped");
      assert.equal(summary.skippedDuplicates, 0);
      assert.equal(summary.failed, 0);
      assert.equal(totalStoredCards(), 5, "tower holds 5 cards");

      const allInits = getTowerRows().flatMap((r) => r.l3Initiatives ?? []);
      for (const it of allInits) {
        assert.equal(it.source, "manual", `${it.solutionName} stamped as manual`);
        assert.ok(
          it.uploadFingerprint,
          `${it.solutionName} carries uploadFingerprint`,
        );
      }
      // Fingerprints are computed from the raw input cells.
      for (const r of rows) {
        const fp = computeUploadFingerprint(
          r.solutionName,
          r.solutionDescription,
          r.tech,
        );
        const match = allInits.find((it) => it.uploadFingerprint === fp);
        assert.ok(match, `fingerprint round-trip for "${r.solutionName}"`);
      }
      assert.equal(towerMode(), "user-uploaded");
    },
  );

  await scenario(
    "S2",
    "Re-upload identical file → 0 new, 5 skipped, storage byte-identical",
    async () => {
      // Snapshot ids + fingerprints from current state.
      const before = getTowerRows().flatMap((r) =>
        (r.l3Initiatives ?? []).map((it) => ({
          id: it.id,
          fp: it.uploadFingerprint,
        })),
      );
      installUploadFetchStub("llm");
      const summary = await runEnrichmentFromUpload({
        towerId: TOWER,
        parsedRows: fiveSeedRows(),
      });
      assert.equal(summary.enriched, 0, "no new cards");
      assert.equal(
        summary.skippedDuplicates,
        5,
        "all 5 rows skipped on re-upload",
      );
      assert.equal(totalStoredCards(), 5, "storage card count unchanged");
      const after = getTowerRows().flatMap((r) =>
        (r.l3Initiatives ?? []).map((it) => ({
          id: it.id,
          fp: it.uploadFingerprint,
        })),
      );
      assert.deepEqual(
        after.sort((a, b) => a.id.localeCompare(b.id)),
        before.sort((a, b) => a.id.localeCompare(b.id)),
        "id + fingerprint set is byte-identical post re-upload",
      );
      assert.equal(towerMode(), "user-uploaded");
    },
  );

  await scenario(
    "S3",
    "Edit row 3 description → re-upload → 1 new (with `(2)` suffix), 4 skipped",
    async () => {
      const rows = fiveSeedRows();
      rows[2] = buildUpload(
        4,
        "FP&A",
        rows[2]!.solutionName, // SAME name
        "Edited variance narrative — now uses Anaplan plan signals.", // DIFFERENT description
        rows[2]!.tech,
      );
      installUploadFetchStub("llm");
      const summary = await runEnrichmentFromUpload({
        towerId: TOWER,
        parsedRows: rows,
      });
      assert.equal(summary.enriched, 1, "edited row stamps a new card");
      assert.equal(summary.skippedDuplicates, 4, "4 unchanged rows skip");
      assert.equal(totalStoredCards(), 6);

      const fpaRow = getTowerRows().find((r) => r.id === "finance::fp-a")!;
      const fpaNames = (fpaRow.l3Initiatives ?? [])
        .map((it) => it.solutionName)
        .sort();
      assert.deepEqual(
        fpaNames,
        ["Flux Variance Narrator", "Flux Variance Narrator (2)"],
        "same-name disambiguation via (2) suffix",
      );
    },
  );

  await scenario(
    "S4",
    "Append a new row → re-upload → 1 new card, 5 skipped, 7 cards total",
    async () => {
      const rows = fiveSeedRows();
      // Set row 3 to the S3 edited variant so it's a known duplicate
      // of the existing "Flux Variance Narrator (2)" card.
      rows[2] = buildUpload(
        4,
        "FP&A",
        rows[2]!.solutionName,
        "Edited variance narrative — now uses Anaplan plan signals.",
        rows[2]!.tech,
      );
      rows.push(
        buildUpload(
          7,
          "Close and Consolidation",
          "Audit Trail Diff Agent",
          "Diffs ledger versions and surfaces SOX-relevant changes.",
          "BlackLine",
        ),
      );
      // 5 fiveSeedRows() rows + 1 appended = 6 uploads. The 5 originals
      // all match existing fingerprints on the tower (1 of which is the
      // S3-edited variant matching the existing `(2)` card). The 6th
      // is genuinely new and should stamp.
      assert.equal(rows.length, 6, "test sanity: 6 input rows");
      installUploadFetchStub("llm");
      const summary = await runEnrichmentFromUpload({
        towerId: TOWER,
        parsedRows: rows,
      });
      assert.equal(summary.totalUploads, 6);
      assert.equal(summary.enriched, 1, "only the new row 7 stamps");
      assert.equal(summary.skippedDuplicates, 5);
      assert.equal(totalStoredCards(), 7, "S3 left 6 cards; S4 added 1");
      const auditTrailMatches = getTowerRows()
        .flatMap((r) => r.l3Initiatives ?? [])
        .filter((it) => it.solutionName === "Audit Trail Diff Agent");
      assert.equal(auditTrailMatches.length, 1);
      assert.equal(auditTrailMatches[0]!.source, "manual");
      assert.ok(auditTrailMatches[0]!.uploadFingerprint);
    },
  );

  await scenario(
    "S5",
    "Multi-batch growth — upload 25, then another 25 → 50 cards, all unique ids",
    async () => {
      buildFinanceTower(L3_LABELS);
      installUploadFetchStub("llm");

      const batchA: ParsedInitiativeUploadRow[] = Array.from(
        { length: 25 },
        (_, i) =>
          buildUpload(
            i + 2,
            L3_LABELS[i % L3_LABELS.length]!,
            `Batch A Solution ${i + 1}`,
            `Description A ${i + 1}`,
          ),
      );
      const sumA = await runEnrichmentFromUpload({
        towerId: TOWER,
        parsedRows: batchA,
      });
      assert.equal(sumA.enriched, 25);
      assert.equal(sumA.skippedDuplicates, 0);
      assert.equal(totalStoredCards(), 25);

      const batchB: ParsedInitiativeUploadRow[] = Array.from(
        { length: 25 },
        (_, i) =>
          buildUpload(
            i + 30,
            L3_LABELS[i % L3_LABELS.length]!,
            `Batch B Solution ${i + 1}`,
            `Description B ${i + 1}`,
          ),
      );
      const sumB = await runEnrichmentFromUpload({
        towerId: TOWER,
        parsedRows: batchB,
      });
      assert.equal(sumB.enriched, 25, "batch B stamps without touching batch A");
      assert.equal(sumB.skippedDuplicates, 0);
      assert.equal(totalStoredCards(), 50);

      const ids = allStoredIds();
      const unique = new Set(ids);
      assert.equal(
        unique.size,
        ids.length,
        "every stored id is unique across both batches",
      );
      assert.equal(towerMode(), "user-uploaded");
    },
  );

  await scenario(
    "S6",
    "Clear-manual → reviews on cleared ids gone, unrelated reviews kept, mode=empty",
    async () => {
      buildFinanceTower(L3_LABELS);
      installUploadFetchStub("llm");
      const rows = fiveSeedRows();
      await runEnrichmentFromUpload({ towerId: TOWER, parsedRows: rows });
      assert.equal(totalStoredCards(), 5);

      // Stamp reviews against 3 of the 5 stamped manual card ids.
      const stamped = getTowerRows().flatMap((r) => r.l3Initiatives ?? []);
      const reviewedIds = stamped.slice(0, 3).map((it) => it.id);
      for (const id of reviewedIds) {
        setInitiativeReview(TOWER, id, "rejected", {
          name: "x",
          l2Name: "x",
          l3Name: "x",
          l4Name: "x",
          rowId: stamped[0]!.id,
        });
      }
      // Also stamp an unrelated review against a card-id that's NOT on
      // the tower (defensive — must survive the clear).
      setInitiativeReview(TOWER, "unrelated::keep-me", "approved", {
        name: "y",
        l2Name: "y",
        l3Name: "y",
        l4Name: "y",
        rowId: stamped[0]!.id,
      });
      const reviewsBefore = getInitiativeReviews(TOWER);
      assert.equal(Object.keys(reviewsBefore).length, 4);

      const removed = clearManualInitiativesForTower(TOWER);
      assert.equal(removed, 5);
      assert.equal(countAllManualInitiatives(TOWER), 0);
      assert.equal(totalStoredCards(), 0);
      assert.equal(towerMode(), "empty");

      const reviewsAfter = getInitiativeReviews(TOWER);
      for (const id of reviewedIds) {
        assert.equal(
          reviewsAfter[id],
          undefined,
          `review on cleared manual id ${id} is gone`,
        );
      }
      assert.equal(
        reviewsAfter["unrelated::keep-me"]?.status,
        "approved",
        "unrelated review survives the clear",
      );
    },
  );

  await scenario(
    "S7",
    "Empty → run discovery (stubbed) → cards stamped as llm, mode=llm-discovered",
    async () => {
      // Continuing from S6 — tower is empty + has one unrelated review.
      installDiscoveryFetchStub();
      const rowIds = getTowerRows().map((r) => r.id);
      const summary = await runForL3Rows({ towerId: TOWER, rowIds });
      assert.equal(summary.succeeded, L3_LABELS.length);
      assert.equal(summary.failed, 0);

      const allInits = getTowerRows().flatMap((r) => r.l3Initiatives ?? []);
      assert.equal(allInits.length, L3_LABELS.length);
      for (const it of allInits) {
        assert.equal(it.source, "llm");
        assert.equal(it.uploadFingerprint, undefined, "LLM cards have no fingerprint");
      }
      assert.equal(towerMode(), "llm-discovered");
    },
  );

  await scenario(
    "S8",
    "Clear-LLM → LLM reviews gone, manual unaffected (none here), mode=empty",
    async () => {
      // Stamp reviews against 2 LLM cards.
      const stamped = getTowerRows().flatMap((r) => r.l3Initiatives ?? []);
      const reviewedIds = stamped.slice(0, 2).map((it) => it.id);
      for (const id of reviewedIds) {
        setInitiativeReview(TOWER, id, "approved", {
          name: "x",
          l2Name: "x",
          l3Name: "x",
          l4Name: "x",
          rowId: stamped[0]!.id,
        });
      }
      const removed = clearLLMInitiativesForTower(TOWER);
      assert.equal(removed, L3_LABELS.length);
      assert.equal(totalStoredCards(), 0);
      assert.equal(towerMode(), "empty");

      const reviewsAfter = getInitiativeReviews(TOWER);
      for (const id of reviewedIds) {
        assert.equal(reviewsAfter[id], undefined, `LLM review on ${id} cleared`);
      }
      assert.equal(
        reviewsAfter["unrelated::keep-me"]?.status,
        "approved",
        "unrelated review still surviving across both clears",
      );
    },
  );

  await scenario(
    "S9",
    "Round-trip: upload → clear-manual → discover → clear-LLM → upload again",
    async () => {
      // Already at "empty" with one unrelated review after S8. Re-upload.
      installUploadFetchStub("llm");
      const sumUpload = await runEnrichmentFromUpload({
        towerId: TOWER,
        parsedRows: fiveSeedRows(),
      });
      assert.equal(sumUpload.enriched, 5);
      assert.equal(sumUpload.skippedDuplicates, 0);
      assert.equal(totalStoredCards(), 5);
      assert.equal(towerMode(), "user-uploaded");

      const finalInits = getTowerRows().flatMap((r) => r.l3Initiatives ?? []);
      for (const it of finalInits) {
        assert.equal(it.source, "manual");
        assert.ok(it.uploadFingerprint);
      }
      // The unrelated review threaded through every prior scenario must
      // STILL survive — the clear helpers must only nuke the ids they
      // actually removed.
      assert.equal(
        getInitiativeReviews(TOWER)["unrelated::keep-me"]?.status,
        "approved",
        "unrelated review survives the full round-trip",
      );
    },
  );

  await scenario(
    "S10",
    "Stale-review leak protection — clear+re-upload makes the new card visible",
    async () => {
      buildFinanceTower(L3_LABELS);
      installUploadFetchStub("llm");
      // First upload — produces a deterministic id for the row.
      await runEnrichmentFromUpload({
        towerId: TOWER,
        parsedRows: [
          buildUpload(
            2,
            "Close and Consolidation",
            "Reconciliation Co-Pilot",
            "v1 description.",
          ),
        ],
      });
      const stampedId = getTowerRows()
        .flatMap((r) => r.l3Initiatives ?? [])
        .find((it) => it.solutionName === "Reconciliation Co-Pilot")!.id;

      // User rejects it via the gallery.
      setInitiativeReview(TOWER, stampedId, "rejected", {
        name: "Reconciliation Co-Pilot",
        l2Name: "Corporate Finance",
        l3Name: "Close and Consolidation",
        l4Name: "All Activities",
        rowId: "finance::close-and-consolidation",
      });
      assert.equal(
        getInitiativeReviews(TOWER)[stampedId]?.status,
        "rejected",
        "precondition: rejection stamped",
      );

      // Lead clears uploaded (the new user-flow for switching modes).
      const removed = clearManualInitiativesForTower(TOWER);
      assert.equal(removed, 1);
      // Stale-rejection invariant: the review must be gone too.
      assert.equal(getInitiativeReviews(TOWER)[stampedId], undefined);

      // Re-upload the SAME row name. Without the fix, a stale rejection
      // on `stampedId` would silently hide the new card.
      installUploadFetchStub("llm");
      await runEnrichmentFromUpload({
        towerId: TOWER,
        parsedRows: [
          buildUpload(
            2,
            "Close and Consolidation",
            "Reconciliation Co-Pilot",
            "v2 description with edits.",
          ),
        ],
      });
      const restamped = getTowerRows()
        .flatMap((r) => r.l3Initiatives ?? [])
        .find((it) => it.solutionName === "Reconciliation Co-Pilot")!;
      const reviewOnRestamped = getInitiativeReviews(TOWER)[restamped.id];
      assert.equal(
        reviewOnRestamped,
        undefined,
        "re-stamped card carries no stale rejection",
      );
      assert.equal(restamped.source, "manual");
      assert.equal(towerMode(), "user-uploaded");
    },
  );

  // ---------------------------------------------------------------------------
  // Report
  // ---------------------------------------------------------------------------
  console.log("\n===============================================================");
  console.log("REPORT");
  console.log("===============================================================");
  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;
  for (const r of results) {
    const marker = r.passed ? "PASS" : "FAIL";
    console.log(`  ${marker}  [${r.id}] ${r.title}`);
    if (!r.passed && r.error) {
      console.log(`         ↳ ${r.error}`);
    }
  }
  console.log(`\n${passed}/${results.length} scenarios passed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

void main().catch((e) => {
  console.error("Unexpected error:", e);
  process.exit(2);
});
