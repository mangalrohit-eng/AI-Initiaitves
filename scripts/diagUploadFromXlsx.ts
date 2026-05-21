/**
 * Diagnostic script — reproduce / sanity-check the Step 4 upload pipeline
 * against an arbitrary user xlsx. NOT part of the regular test suite;
 * run manually when investigating an "uploaded N, only M visible" report.
 *
 * What it does:
 *   1. Polyfills `window.localStorage` (Node has no DOM).
 *   2. Reads the xlsx from disk and parses it through the real parser.
 *   3. Seeds a synthetic Finance tower whose L3 roster spans every L3
 *      label the user typed (so the LLM stub's `roster[0]` fallback
 *      doesn't artificially collapse every row to one L3).
 *   4. Stubs fetch with a deterministic NDJSON stream that emits one
 *      `row` event per upload (no LLM, no skipped rows by construction).
 *   5. Runs the orchestrator under `DEBUG_UPLOAD_ENRICH=1` and dumps the
 *      summary + the actual storage state.
 *   6. Asserts storage card count == parsed upload count, then runs a
 *      second pass with 5 pre-existing rejected reviews seeded on the
 *      first 5 upload names to validate the "wipe clears stale reviews"
 *      semantics. If the gallery-side filter would hide any card, the
 *      script flags it.
 *
 * Run: `npx tsx scripts/diagUploadFromXlsx.ts <path/to/initiatives.xlsx>`
 */

// ---------------------------------------------------------------------------
// localStorage polyfill BEFORE importing anything that reaches into the store.
// ---------------------------------------------------------------------------
{
  const mem = new Map<string, string>();
  const storage = {
    getItem: (k: string): string | null => mem.has(k) ? mem.get(k)! : null,
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

import * as fs from "node:fs";
import * as path from "node:path";

import { parseInitiativeUploadFileBuffer } from "../src/lib/assess/parseInitiativeUploadFile";
import { runEnrichmentFromUpload } from "../src/lib/assess/curationPipelineV6";
import {
  encodeEnrichUploadStreamEvent,
  type EnrichUploadStreamEvent,
} from "../src/lib/assess/curateL3InitiativesStreamProtocol";
import {
  getAssessProgram,
  setAssessProgram,
  setInitiativeReview,
} from "../src/lib/localStore";
import {
  defaultTowerBaseline,
  defaultTowerRates,
  type AssessProgramV2,
  type L3WorkforceRowV6,
  type L4WorkforceRow,
  type TowerId,
} from "../src/data/assess/types";

const TOWER: TowerId = "finance";

const xlsxPath = process.argv[2];
if (!xlsxPath) {
  console.error(
    "Usage: npx tsx scripts/diagUploadFromXlsx.ts <path/to/initiatives.xlsx>",
  );
  console.error(
    "  (provide the same Excel file the user uploaded into the app)",
  );
  process.exit(2);
}

// Flip the global debug flag so curationPipelineV6 emits its [upload-enrich]
// breadcrumbs throughout the run.
(globalThis as { __DEBUG_UPLOAD_ENRICH?: boolean }).__DEBUG_UPLOAD_ENRICH = true;

function buildSyntheticFinanceTower(l3Labels: ReadonlyArray<string>): void {
  const uniqLabels = Array.from(new Set(l3Labels.filter((s) => s.trim().length > 0)));
  // Map every distinct user-typed L3 to its own synthetic row.
  // Slug as id so the orchestrator can pre-match by normalized L3 name.
  const slug = (s: string): string =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  const childL4: L4WorkforceRow[] = [];
  const l3Rows: L3WorkforceRowV6[] = uniqLabels.map((label, i) => {
    const rowId = `finance::${slug(label)}`;
    const l4Id = `${rowId}::activities`;
    childL4.push({
      id: l4Id,
      l1: "Finance",
      l2: "Synthetic",
      l3: label,
      l4: "All Activities",
      fteOnshore: 5,
      fteOffshore: 1,
      contractorOnshore: 0,
      contractorOffshore: 0,
      gccPct: 20,
      gccPctSetAt: new Date().toISOString(),
      gccPctSource: "seed",
      gccReason: "diagnostic synthetic seed",
    });
    return {
      id: rowId,
      l1: "Finance",
      l2: "Synthetic",
      l3: label,
      fteOnshore: 5 + i,
      fteOffshore: 1,
      contractorOnshore: 0,
      contractorOffshore: 0,
      aiImpactAssessmentPct: 40,
      childL4RowIds: [l4Id],
      l3Initiatives: [],
    };
  });

  const program: AssessProgramV2 = {
    version: 6,
    towers: {
      [TOWER]: {
        l4Rows: childL4,
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

/**
 * Deterministic LLM stub: emits one `row` event per upload, attached to
 * the `preMatchedL3RowId` if set (which the orchestrator pre-matches
 * client-side when the user-typed L3 normalizes to a roster L3), or to
 * `roster[0]` otherwise — matches the real route's fallback contract.
 */
function installFetchStub(streamSource: "llm" | "fallback"): void {
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
    const events: EnrichUploadStreamEvent[] = [
      { kind: "started", totalUploads: body.uploads.length },
      ...body.uploads.map((u) => ({
        kind: "row" as const,
        uploadRowId: u.uploadRowId,
        matchedRowId: u.preMatchedL3RowId ?? body.l3Roster[0]!.rowId,
        payload: {
          id: `mocked::${u.preMatchedL3RowId ?? body.l3Roster[0]!.rowId}::${u.solutionName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 48)}`,
          solutionName: u.solutionName,
          tagline: "Diag tagline.",
          aiRationale: "Diag rationale.",
          feasibility: "High" as const,
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

function countStoredCards(): {
  total: number;
  perRow: Array<{ rowId: string; count: number }>;
  allIds: string[];
} {
  const tower = getAssessProgram().towers[TOWER];
  const perRow: Array<{ rowId: string; count: number }> = [];
  const allIds: string[] = [];
  let total = 0;
  for (const r of tower?.l3Rows ?? []) {
    const c = r.l3Initiatives?.length ?? 0;
    perRow.push({ rowId: r.id, count: c });
    total += c;
    for (const it of r.l3Initiatives ?? []) allIds.push(it.id);
  }
  return { total, perRow, allIds };
}

async function main(): Promise<void> {
  console.log(`\nDiagnostic — Step 4 upload pipeline on ${xlsxPath}`);
  if (!fs.existsSync(xlsxPath)) {
    console.error(`Excel file not found: ${xlsxPath}`);
    process.exit(2);
  }

  const buf = fs.readFileSync(xlsxPath);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  const fileName = path.basename(xlsxPath);
  // Parse with no roster initially so we just discover how many usable
  // rows the parser yields.
  const initialParsed = parseInitiativeUploadFileBuffer(ab, fileName, []);
  console.log(`Parsed: ${initialParsed.rows.length} rows / ${initialParsed.rawRowCount} raw / ${initialParsed.errors.length} errors`);
  for (const e of initialParsed.errors) console.log(`  parse-error: ${e}`);

  const uniqueL3Labels = Array.from(
    new Set(initialParsed.rows.map((r) => r.l3Raw).filter((s) => s.length > 0)),
  );
  console.log(`Distinct user-typed L3 labels: ${uniqueL3Labels.length}`);
  uniqueL3Labels.forEach((l) => console.log(`  • ${l}`));

  buildSyntheticFinanceTower(uniqueL3Labels);
  // Re-parse against the synthetic roster so pre-match diagnostics fire
  // (they don't affect what's uploaded — pre-match just hints the LLM).
  const finalParsed = parseInitiativeUploadFileBuffer(ab, fileName, uniqueL3Labels);
  console.log(`After roster-aware re-parse: ${finalParsed.rows.length} usable rows`);

  installFetchStub("llm");

  console.log("\n--- runEnrichmentFromUpload (DEBUG enabled) ---\n");
  const summary = await runEnrichmentFromUpload({
    towerId: TOWER,
    parsedRows: finalParsed.rows,
  });

  console.log("\n--- summary ---");
  console.log(JSON.stringify(summary, null, 2));

  const stored = countStoredCards();
  console.log("\n--- storage ---");
  console.log(`Total stored cards: ${stored.total}`);
  console.log(`Expected: ${finalParsed.rows.length}`);
  const uniqueStoredIds = new Set(stored.allIds);
  console.log(`Unique stored ids: ${uniqueStoredIds.size}`);
  if (uniqueStoredIds.size !== stored.allIds.length) {
    console.log(`⚠ Duplicate ids in storage: ${stored.allIds.length - uniqueStoredIds.size}`);
  }
  console.log("Per-row:");
  for (const r of stored.perRow) {
    console.log(`  ${r.rowId.padEnd(60)} → ${r.count}`);
  }

  const ok = stored.total === finalParsed.rows.length;
  console.log(`\n${ok ? "PASS" : "FAIL"}: ${stored.total} stored vs ${finalParsed.rows.length} parsed.`);
  if (!ok) {
    console.log(
      "\nThe orchestrator dropped rows. Scroll up to the [upload-enrich] log lines for the per-row breadcrumb.",
    );
  }

  // ===========================================================================
  // Second pass: replay the upload but with 5 PRE-EXISTING REJECTED reviews
  // that name-match cards in the user's xlsx. This tests the "stale rejection
  // survives wipe" hypothesis — the gallery's `useInitiativeReviewsV6` filter
  // could quietly hide newly uploaded cards if their `id` collides with a
  // rejected entry (possible via the brief-cache id-reuse path).
  // ===========================================================================
  console.log("\n=== Second pass: simulate 5 pre-existing rejected reviews ===");
  // Silence per-row breadcrumbs during the second pass — we only care
  // about the final tally here.
  (globalThis as { __DEBUG_UPLOAD_ENRICH?: boolean }).__DEBUG_UPLOAD_ENRICH = false;
  buildSyntheticFinanceTower(uniqueL3Labels);

  // Reach in and stamp 5 LLM-discovered cards directly on the tower, with
  // the EXACT names + ids the orchestrator would derive on the first 5
  // user uploads — then reject them via the same code path the UI uses.
  // This is the cleanest way to seed a "user rejected, then re-uploads
  // with the same name" scenario.
  const first5 = finalParsed.rows.slice(0, 5);
  const program = getAssessProgram();
  const tower = program.towers[TOWER]!;
  const newL3Rows = tower.l3Rows!.map((r) => ({ ...r }));
  function slug(s: string): string {
    return s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48);
  }
  for (const u of first5) {
    const rowSlug = u.l3Raw
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const rowId = `finance::${rowSlug}`;
    const row = newL3Rows.find((r) => r.id === rowId);
    if (!row) {
      console.log(`(no matching synthetic row for ${u.l3Raw} — skipping seed)`);
      continue;
    }
    const id = `mocked::${rowId}::${slug(u.solutionName)}`;
    const seed = {
      id,
      solutionName: u.solutionName,
      tagline: "Old discovery card.",
      aiRationale: "Old discovery card.",
      feasibility: "Low" as const,
      source: "llm" as const,
      generatedAt: "2026-04-01T00:00:00.000Z",
    };
    row.l3Initiatives = [...(row.l3Initiatives ?? []), seed];
  }
  setAssessProgram({
    ...program,
    towers: { ...program.towers, [TOWER]: { ...tower, l3Rows: newL3Rows } },
  });
  for (const u of first5) {
    const rowSlug = u.l3Raw
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const id = `mocked::finance::${rowSlug}::${slug(u.solutionName)}`;
    setInitiativeReview(
      TOWER,
      id,
      "rejected",
      {
        name: u.solutionName,
        l2Name: "Synthetic",
        l3Name: u.l3Raw,
        l4Name: "covers full Job Family",
        rowId: `finance::${rowSlug}`,
      },
      "diagnostic",
    );
  }
  const reviewsBeforeUpload = getAssessProgram().towers[TOWER]!.initiativeReviews ?? {};
  console.log(`Seeded ${Object.keys(reviewsBeforeUpload).length} rejected reviews.`);

  installFetchStub("llm");
  const summary2 = await runEnrichmentFromUpload({
    towerId: TOWER,
    parsedRows: finalParsed.rows,
  });
  console.log(`\nsecond-pass summary: enriched=${summary2.enriched} failed=${summary2.failed} wipedCount=${summary2.wipedCount} briefsPreserved=${summary2.briefsPreservedCount}`);

  const after = getAssessProgram().towers[TOWER]!;
  const stored2Total = (after.l3Rows ?? []).reduce(
    (acc, r) => acc + (r.l3Initiatives?.length ?? 0),
    0,
  );
  const reviewsAfter = after.initiativeReviews ?? {};
  const rejectedIdsAfter = Object.entries(reviewsAfter)
    .filter(([, r]) => r.status === "rejected")
    .map(([k]) => k);
  // Simulate the gallery filter — count cards that SURVIVE the rejection
  // filter (i.e., what the user would actually see).
  let visibleCards = 0;
  const hiddenByRejection: string[] = [];
  for (const r of after.l3Rows ?? []) {
    for (const it of r.l3Initiatives ?? []) {
      if (reviewsAfter[it.id]?.status === "rejected") {
        hiddenByRejection.push(it.solutionName + " | " + it.id);
        continue;
      }
      visibleCards += 1;
    }
  }
  console.log(`\nstored cards: ${stored2Total}`);
  console.log(`rejected review entries surviving wipe: ${rejectedIdsAfter.length}`);
  console.log(`visible cards (after rejection filter): ${visibleCards}`);
  console.log(`hidden by stale rejection:`);
  for (const h of hiddenByRejection) console.log(`  • ${h}`);

  const hypothesisConfirmed =
    stored2Total === finalParsed.rows.length &&
    visibleCards < finalParsed.rows.length &&
    hiddenByRejection.length > 0;

  if (hypothesisConfirmed) {
    console.log(
      "\nHYPOTHESIS CONFIRMED: stale rejected reviews hide newly uploaded cards.",
    );
    console.log(
      `  ${stored2Total} cards in storage, but only ${visibleCards} visible. ${hiddenByRejection.length} hidden by rejection filter.`,
    );
  } else {
    console.log(
      "\nHypothesis NOT confirmed by this synthetic — visible cards match stored count.",
    );
  }

  process.exit(ok ? 0 : 1);
}

void main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(2);
});
