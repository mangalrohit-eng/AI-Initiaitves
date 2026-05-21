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
 *   5. PASS 1 — runs the orchestrator under `DEBUG_UPLOAD_ENRICH=1` and
 *      asserts `storage card count == parsed upload count` (every row
 *      stamped, none silently dropped).
 *   6. PASS 2 — re-runs the orchestrator with the SAME xlsx and asserts
 *      `summary.skippedDuplicates == parsed.length` AND
 *      `summary.enriched == 0` (idempotent re-upload, the new
 *      incremental contract).
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
  // Pass 2: re-upload the SAME xlsx and assert idempotency.
  //
  // The incremental contract: every row in the new upload whose
  // `(name | description | tech)` fingerprint already lives on the
  // tower is skipped. So passing the same parsed rows again must yield
  // `enriched = 0`, `skippedDuplicates = total`, and no change to
  // storage card count.
  // ===========================================================================
  console.log("\n=== Pass 2: re-upload the SAME xlsx (idempotent re-upload) ===");
  // Silence per-row breadcrumbs during the second pass — we only care
  // about the final tally here.
  (globalThis as { __DEBUG_UPLOAD_ENRICH?: boolean }).__DEBUG_UPLOAD_ENRICH = false;
  const storedBeforePass2 = countStoredCards().total;
  installFetchStub("llm");
  const summary2 = await runEnrichmentFromUpload({
    towerId: TOWER,
    parsedRows: finalParsed.rows,
  });
  console.log(
    `\nsecond-pass summary: enriched=${summary2.enriched} failed=${summary2.failed} skippedDuplicates=${summary2.skippedDuplicates} total=${summary2.totalUploads}`,
  );
  const storedAfterPass2 = countStoredCards().total;
  console.log(
    `stored cards before/after pass 2: ${storedBeforePass2} / ${storedAfterPass2}`,
  );

  const pass2Ok =
    summary2.enriched === 0 &&
    summary2.skippedDuplicates === finalParsed.rows.length &&
    storedAfterPass2 === storedBeforePass2;

  if (pass2Ok) {
    console.log(
      `\nPASS 2: idempotent re-upload — all ${finalParsed.rows.length} rows skipped, storage unchanged.`,
    );
  } else {
    console.log(`\nFAIL PASS 2: incremental contract broken.`);
    console.log(`  expected enriched=0, skipped=${finalParsed.rows.length}, stored unchanged at ${storedBeforePass2}`);
    console.log(
      `  got      enriched=${summary2.enriched}, skipped=${summary2.skippedDuplicates}, stored=${storedAfterPass2}`,
    );
  }

  process.exit(ok && pass2Ok ? 0 : 1);
}

void main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(2);
});
