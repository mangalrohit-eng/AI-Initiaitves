/**
 * End-to-end smoke for the "Upload initiatives list" feature.
 *
 * Covers every layer the new flow touches WITHOUT requiring a live
 * OpenAI key or Next.js runtime:
 *
 *   1. Parser              — `parseInitiativeUploadFileBuffer`
 *   2. Template builder    — `buildInitiativeUploadTemplateCsv`
 *   3. Stream protocol     — encode + decode roundtrip
 *   4. Deterministic LLM   — `fallbackEnrichedInitiative` (passthrough)
 *   5. Orchestrator        — `runEnrichmentFromUpload` with a stubbed
 *                            fetch that emits NDJSON events. Incremental
 *                            (no wipe) — uploads ADD to manual cards;
 *                            fingerprint dedupe skips exact re-uploads.
 *   6. Discovery guardrail — `runForL3Rows` preserves `source: "manual"`
 *   7. Clear helpers       — count, delete-one, clear-manual, clear-LLM
 *                            (each also clears associated reviews).
 *   8. Route fallback drain — `buildPendingFallbackRows` covers the
 *                             "47 of 49" prod silent-drop case.
 *   9. Mode derivation     — `deriveTowerInitiativeMode` empty / manual /
 *                            llm-discovered classification.
 *
 * Run: `npx tsx scripts/uploadInitiativesE2E.ts`
 */

// ---------------------------------------------------------------------------
// localStorage polyfill — `localStore.ts` writes through `window.localStorage`,
// which doesn't exist in Node. Install BEFORE importing any module that
// reaches into the store so writes round-trip in this script.
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

import assert from "node:assert/strict";
import * as XLSX from "xlsx";

import {
  parseInitiativeUploadFileBuffer,
  buildInitiativeUploadTemplateCsv,
  normalizeL3ForMatch,
} from "../src/lib/assess/parseInitiativeUploadFile";
import { buildPendingFallbackRows } from "../src/lib/assess/enrichUploadFallbackDrain";
import type {
  EnrichUploadRowInput,
  L3RosterEntry,
} from "../src/lib/assess/enrichUploadedInitiativesLLM";
import {
  encodeEnrichUploadStreamEvent,
  decodeEnrichUploadStreamEvents,
  type EnrichUploadStreamEvent,
} from "../src/lib/assess/curateL3InitiativesStreamProtocol";
import { fallbackEnrichedInitiative } from "../src/lib/assess/enrichUploadedInitiativesLLM";
import {
  clearLLMInitiativesForTower,
  clearManualInitiativesForTower,
  countAllManualInitiatives,
  deleteManualInitiative,
  runEnrichmentFromUpload,
  runForL3Rows,
} from "../src/lib/assess/curationPipelineV6";
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
  type GeneratedProcessCache,
  type L3Initiative,
  type L3WorkforceRowV6,
  type TowerId,
} from "../src/data/assess/types";
import { deriveTowerInitiativeMode } from "../src/lib/initiatives/towerMode";

// ===========================================================================
//   Test harness
// ===========================================================================

let failures = 0;
async function check(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    console.log(`  ok ${name}`);
  } catch (e) {
    failures += 1;
    console.error(`  FAIL ${name}`);
    console.error(`    ${(e as Error).message}`);
    if ((e as Error).stack) {
      const lines = ((e as Error).stack ?? "").split("\n").slice(1, 5);
      for (const l of lines) console.error(`    ${l.trim()}`);
    }
  }
}

const TOWER: TowerId = "finance";

type SeedInitiative = {
  name: string;
  source: "manual" | "llm" | "fallback";
  /** Tag the brief cache so tests can confirm carry-forward. */
  withBrief?: boolean;
  /** Override id (default: `seeded-${i}`). */
  id?: string;
  /**
   * Stamp an `uploadFingerprint` on the seeded card. Mirrors the
   * post-migration field stamped by `runEnrichmentFromUpload`. Tests
   * that don't pass this exercise the legacy name-only-match fallback.
   */
  fingerprintTuple?: { description: string; tech: string };
};

function seedProgramWithFinanceTower(opts?: {
  /** Cards on row A (`finance::corp-finance::close-and-consolidation`). */
  rowAInitiatives?: SeedInitiative[];
  /** Cards on row B (`finance::treasury::cash-and-covenant`). */
  rowBInitiatives?: SeedInitiative[];
  /** Legacy shorthand: manual-only entries on row A. */
  initialManualNames?: string[];
}): void {
  const rowAFromShorthand: SeedInitiative[] =
    opts?.initialManualNames?.map((name) => ({ name, source: "manual" })) ??
    [];
  const rowAList: SeedInitiative[] = [
    ...rowAFromShorthand,
    ...(opts?.rowAInitiatives ?? []),
  ];
  // Minimal stub for `GeneratedProcessCache` — the orchestrator only
  // reads the field's identity (presence + reference equality on
  // carry-forward), so the test doesn't need a full `Process` payload.
  const briefStub = {
    process: { __test: true } as unknown,
    generatedAt: "2026-05-18T00:00:00.000Z",
    source: "llm",
  } as unknown as GeneratedProcessCache;
  const buildSeeded = (
    list: SeedInitiative[],
    rowSlug: string,
  ): L3Initiative[] =>
    list.map((it, i) => {
      const base: L3Initiative = {
        id: it.id ?? `finance::${rowSlug}::seeded-${i}`,
        solutionName: it.name,
        tagline: "Pre-seeded entry for orchestrator test harness.",
        aiRationale: "Pre-seeded for the orchestrator test harness.",
        feasibility: "Low",
        source: it.source,
        generatedAt: new Date().toISOString(),
      };
      let result = it.withBrief ? { ...base, generatedProcess: briefStub } : base;
      if (it.fingerprintTuple) {
        result = {
          ...result,
          uploadFingerprint: computeUploadFingerprint(
            it.name,
            it.fingerprintTuple.description,
            it.fingerprintTuple.tech,
          ),
        };
      }
      return result;
    });

  const l3Rows: L3WorkforceRowV6[] = [
    {
      id: "finance::corp-finance::close-and-consolidation",
      l1: "Finance",
      l2: "Corporate Finance",
      l3: "Close and Consolidation",
      fteOnshore: 12,
      fteOffshore: 4,
      contractorOnshore: 2,
      contractorOffshore: 1,
      annualSpendUsd: 2_500_000,
      offshoreAssessmentPct: 30,
      aiImpactAssessmentPct: 40,
      childL4RowIds: [
        "close-and-consolidation::intercompany",
        "close-and-consolidation::flux",
      ],
      l3Initiatives: buildSeeded(rowAList, "close-and-consolidation"),
    },
    {
      id: "finance::treasury::cash-and-covenant",
      l1: "Finance",
      l2: "Treasury",
      l3: "Cash and Covenant Management",
      fteOnshore: 5,
      fteOffshore: 0,
      contractorOnshore: 0,
      contractorOffshore: 0,
      aiImpactAssessmentPct: 25,
      childL4RowIds: ["cash-and-covenant::covenant-monitoring"],
      l3Initiatives: buildSeeded(
        opts?.rowBInitiatives ?? [],
        "cash-and-covenant",
      ),
    },
  ];
  const program: AssessProgramV2 = {
    version: 6,
    towers: {
      [TOWER]: {
        l4Rows: [
          {
            id: "close-and-consolidation::intercompany",
            l1: "Finance",
            l2: "Corporate Finance",
            l3: "Close and Consolidation",
            l4: "Intercompany Reconciliations",
            fteOnshore: 6,
            fteOffshore: 2,
            contractorOnshore: 1,
            contractorOffshore: 0,
            gccPct: 25,
            gccPctSetAt: new Date().toISOString(),
            gccPctSource: "seed",
            gccReason: "seeded for test",
          },
          {
            id: "close-and-consolidation::flux",
            l1: "Finance",
            l2: "Corporate Finance",
            l3: "Close and Consolidation",
            l4: "Flux and Variance Analysis",
            fteOnshore: 6,
            fteOffshore: 2,
            contractorOnshore: 1,
            contractorOffshore: 1,
            gccPct: 35,
            gccPctSetAt: new Date().toISOString(),
            gccPctSource: "seed",
            gccReason: "seeded for test",
          },
          {
            id: "cash-and-covenant::covenant-monitoring",
            l1: "Finance",
            l2: "Treasury",
            l3: "Cash and Covenant Management",
            l4: "Covenant Monitoring",
            fteOnshore: 5,
            fteOffshore: 0,
            contractorOnshore: 0,
            contractorOffshore: 0,
            gccPct: 0,
            gccPctSetAt: new Date().toISOString(),
            gccPctSource: "seed",
            gccReason: "seeded for test",
          },
        ],
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

function getTowerRows(): L3WorkforceRowV6[] {
  return getAssessProgram().towers[TOWER]?.l3Rows ?? [];
}

// ===========================================================================
//   1. PARSER — CSV/XLSX header normalization, diagnostics, gating
// ===========================================================================

async function runParserSuite(): Promise<void> {
  console.log("\n1. Parser (parseInitiativeUploadFileBuffer)");

  const sampleCsv = [
    "L3 (Job Family),Solution Name,Solution Description,Tech",
    `"Close and Consolidation","Intercompany Close Reconciliation Co-Pilot","Matches intercompany transactions across 7+ Versant entities and compresses close from 12-18 days to 5-7","BlackLine"`,
    `"Treasury","Covenant & Liquidity Forecaster","Surfaces covenant headroom signals daily for the CFO; flags BB- breach risk early","BlackLine + FloQast"`,
    `"Not-a-real-L3","Some Hint-Miss Solution","Description here","NotAVendor"`,
    `,"Auto-Matched Solution","Description for solution with no L3","Workday"`,
    `"Close and Consolidation",,"Description without a name","Anaplan"`,
    `"Close and Consolidation","Name without description",,""`,
  ].join("\n");

  await check("parses CSV with forgiving headers", () => {
    const buf = new TextEncoder().encode(sampleCsv).buffer as ArrayBuffer;
    const result = parseInitiativeUploadFileBuffer(buf, "uploads.csv", [
      "Close and Consolidation",
      "Cash and Covenant Management",
    ]);
    assert.equal(result.rawRowCount, 6, "should read 6 raw rows");
    assert.equal(result.rows.length, 4, "should accept 4 rows (2 dropped)");
    assert.equal(
      result.errors.length,
      2,
      "should report 2 hard errors for missing required cells",
    );
    const firstRow = result.rows[0]!;
    assert.equal(firstRow.solutionName, "Intercompany Close Reconciliation Co-Pilot");
    assert.equal(firstRow.tech, "BlackLine");
    assert.equal(firstRow.l3Raw, "Close and Consolidation");
    assert.equal(firstRow.diagnostics.length, 0, "exact L3 + allow-listed vendor → no diagnostics");
  });

  await check("flags vendor off allow-list with soft diagnostic", () => {
    const buf = new TextEncoder().encode(sampleCsv).buffer as ArrayBuffer;
    const result = parseInitiativeUploadFileBuffer(buf, "uploads.csv", [
      "Close and Consolidation",
      "Cash and Covenant Management",
    ]);
    const offAllowlist = result.rows.find((r) => r.tech === "NotAVendor");
    assert.ok(offAllowlist, "row with NotAVendor should be present");
    assert.ok(
      offAllowlist!.diagnostics.some((d) => /vendor.*not on the/i.test(d)),
      "off-allowlist vendor should fire diagnostic",
    );
  });

  await check("flags L3 hint mismatch with soft diagnostic", () => {
    const buf = new TextEncoder().encode(sampleCsv).buffer as ArrayBuffer;
    const result = parseInitiativeUploadFileBuffer(buf, "uploads.csv", [
      "Close and Consolidation",
      "Cash and Covenant Management",
    ]);
    const hintMiss = result.rows.find((r) => r.l3Raw === "Not-a-real-L3");
    assert.ok(hintMiss, "row with hint-miss should be present");
    assert.ok(
      hintMiss!.diagnostics.some((d) => /doesn't match any Job Family/.test(d)),
      "hint-miss should fire diagnostic",
    );
  });

  await check("blank L3 cell parses without diagnostic", () => {
    const buf = new TextEncoder().encode(sampleCsv).buffer as ArrayBuffer;
    const result = parseInitiativeUploadFileBuffer(buf, "uploads.csv", [
      "Close and Consolidation",
    ]);
    const blank = result.rows.find((r) => r.solutionName === "Auto-Matched Solution");
    assert.ok(blank);
    assert.equal(blank!.l3Raw, "");
    assert.equal(
      blank!.diagnostics.filter((d) => /L3/.test(d)).length,
      0,
      "blank L3 should NOT raise an L3 hint diagnostic",
    );
  });

  await check("XLSX file with the same shape parses identically", () => {
    const wsData = [
      ["L3", "Solution Name", "Solution Description", "Tech"],
      [
        "Close and Consolidation",
        "Intercompany Close Reconciliation Co-Pilot",
        "Matches transactions across entities",
        "BlackLine",
      ],
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const xlsxArray = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const result = parseInitiativeUploadFileBuffer(xlsxArray, "uploads.xlsx", [
      "Close and Consolidation",
    ]);
    assert.equal(result.rows.length, 1);
    assert.equal(result.errors.length, 0);
    assert.equal(result.rows[0]!.solutionName, "Intercompany Close Reconciliation Co-Pilot");
  });

  await check("MAX_ROWS cap surfaces error", () => {
    const tooMany: string[] = [
      "L3,Solution Name,Solution Description,Tech",
    ];
    for (let i = 0; i < 220; i += 1) {
      tooMany.push(
        `Close and Consolidation,Solution ${i},Description ${i},BlackLine`,
      );
    }
    const buf = new TextEncoder().encode(tooMany.join("\n")).buffer as ArrayBuffer;
    const result = parseInitiativeUploadFileBuffer(buf, "uploads.csv", [
      "Close and Consolidation",
    ]);
    assert.equal(result.rows.length, 200, "should cap at MAX_ROWS=200");
    assert.ok(
      result.errors.some((e) => /Too many rows/.test(e)),
      "should emit a 'Too many rows' error",
    );
  });

  await check("alternate column aliases map correctly", () => {
    const alt = [
      "job_family,initiative,description,vendor",
      `"Close and Consolidation","Solution A","Desc A","BlackLine"`,
    ].join("\n");
    const buf = new TextEncoder().encode(alt).buffer as ArrayBuffer;
    const result = parseInitiativeUploadFileBuffer(buf, "uploads.csv", [
      "Close and Consolidation",
    ]);
    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0]!.solutionName, "Solution A");
    assert.equal(result.rows[0]!.tech, "BlackLine");
  });

  await check("normalizeL3ForMatch lowercases + strips non-alphanumerics", () => {
    // The impl replaces every non-[a-z0-9] run with a single space but does
    // not collapse multiple spaces. So "Close &  Consolidation!" → "close
    // consolidation" (and stays that way). Strings that already match should
    // round-trip; uppercase + trailing punctuation should normalize down.
    assert.equal(
      normalizeL3ForMatch("Close and Consolidation"),
      "close and consolidation",
    );
    assert.equal(
      normalizeL3ForMatch("  CLOSE-AND-CONSOLIDATION!!  "),
      "close and consolidation",
    );
  });
}

// ===========================================================================
//   2. TEMPLATE BUILDER — deterministic CSV
// ===========================================================================

async function runTemplateSuite(): Promise<void> {
  console.log("\n2. Template builder (buildInitiativeUploadTemplateCsv)");
  await check("emits a header + 3 seeded samples + guidance row", () => {
    const csv = buildInitiativeUploadTemplateCsv([
      "Close and Consolidation",
      "Cash and Covenant Management",
      "Vendor & Spend Management",
    ]);
    const lines = csv.split("\n").filter((l) => l.trim().length > 0);
    assert.equal(lines.length, 5, "header + 3 samples + guidance row");
    assert.match(lines[0]!, /Solution Name/);
    assert.match(lines[0]!, /Solution Description/);
    // First sample uses the first roster L3 verbatim.
    assert.match(lines[1]!, /Close and Consolidation/);
    assert.match(lines[1]!, /Intercompany/);
  });

  await check("falls back to blank L3 when roster is empty", () => {
    const csv = buildInitiativeUploadTemplateCsv([]);
    assert.match(csv, /Intercompany Close Reconciliation Co-Pilot/);
    // No header / sample should explode when the tower has no L3s yet.
  });
}

// ===========================================================================
//   3. STREAM PROTOCOL — encode + decode roundtrip
// ===========================================================================

async function runStreamProtocolSuite(): Promise<void> {
  console.log("\n3. Stream protocol roundtrip");
  await check("events encode → decode preserves shape", async () => {
    const events: EnrichUploadStreamEvent[] = [
      { kind: "started", totalUploads: 3 },
      {
        kind: "row",
        uploadRowId: "upload-1",
        matchedRowId: "row-x",
        payload: {
          id: "init-1",
          solutionName: "Sample Solution",
          tagline: "Tagline",
          aiRationale: "Rationale",
          feasibility: "Low",
        },
        source: "llm",
      },
      { kind: "done", source: "llm" },
    ];
    const chunks = events.map((ev) => encodeEnrichUploadStreamEvent(ev));
    const blob = new Uint8Array(
      chunks.reduce((sum, c) => sum + c.byteLength, 0),
    );
    let offset = 0;
    for (const c of chunks) {
      blob.set(c, offset);
      offset += c.byteLength;
    }
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(blob);
        controller.close();
      },
    });
    const decoded: EnrichUploadStreamEvent[] = [];
    for await (const ev of decodeEnrichUploadStreamEvents(body)) {
      decoded.push(ev);
    }
    assert.equal(decoded.length, 3);
    assert.equal(decoded[0]!.kind, "started");
    assert.equal(decoded[1]!.kind, "row");
    assert.equal(decoded[2]!.kind, "done");
  });
}

// ===========================================================================
//   4. DETERMINISTIC FALLBACK — `fallbackEnrichedInitiative`
// ===========================================================================

async function runFallbackSuite(): Promise<void> {
  console.log("\n4. Deterministic fallback (no LLM)");

  await check("preserves user solutionName + description verbatim", () => {
    const out = fallbackEnrichedInitiative(
      TOWER,
      {
        uploadRowId: "upload-1",
        solutionName: "My Custom Solution Name",
        solutionDescription: "User-supplied description for the AI Solution.",
        tech: "BlackLine",
      },
      { id: "finance::close-and-consolidation", l3: "Close and Consolidation" },
    );
    assert.equal(out.matchedRowId, "finance::close-and-consolidation");
    assert.equal(out.payload.solutionName, "My Custom Solution Name");
    assert.match(out.payload.tagline, /User-supplied description/);
    assert.equal(out.payload.primaryVendor, "BlackLine", "allow-list vendor passes through");
  });

  await check("off-allowlist vendor downgrades to TBD with audit note", () => {
    const out = fallbackEnrichedInitiative(
      TOWER,
      {
        uploadRowId: "upload-2",
        solutionName: "Another Solution",
        solutionDescription: "Description.",
        tech: "VendorThatDoesNotExist",
      },
      { id: "finance::treasury::cash-and-covenant", l3: "Cash and Covenant Management" },
    );
    assert.equal(out.payload.primaryVendor, "TBD — subject to discovery");
    assert.match(
      out.payload.aiRationale,
      /User-supplied vendor: VendorThatDoesNotExist\./,
      "rationale should carry the audit note",
    );
  });

  await check("stamps deterministic id from (towerId, rowId, solutionName)", () => {
    const a = fallbackEnrichedInitiative(
      TOWER,
      {
        uploadRowId: "u",
        solutionName: "Same Name",
        solutionDescription: "Desc",
        tech: "",
      },
      { id: "row-x", l3: "L3 X" },
    );
    const b = fallbackEnrichedInitiative(
      TOWER,
      {
        uploadRowId: "u",
        solutionName: "Same Name",
        solutionDescription: "Other description",
        tech: "",
      },
      { id: "row-x", l3: "L3 X" },
    );
    assert.equal(a.payload.id, b.payload.id, "id is deterministic across runs");
  });
}

// ===========================================================================
//   5. ORCHESTRATOR — stub fetch with NDJSON, verify store patches
// ===========================================================================

type FetchStubMode = "ok-llm" | "ok-fallback" | "network-error";
function installFetchStub(mode: FetchStubMode, uploadCount: number): void {
  globalThis.fetch = (async (
    _url: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    if (mode === "network-error") {
      throw new Error("Simulated network failure");
    }
    const body = JSON.parse(String(init?.body ?? "{}")) as {
      uploads: Array<{ uploadRowId: string; solutionName: string; preMatchedL3RowId?: string }>;
      l3Roster: Array<{ rowId: string }>;
    };
    const stamper = (
      uploadRowId: string,
      matchedRowId: string,
      solutionName: string,
    ) => ({
      kind: "row" as const,
      uploadRowId,
      matchedRowId,
      payload: {
        id: `mocked::${matchedRowId}::${solutionName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        solutionName,
        tagline: "Mocked tagline from stub.",
        aiRationale: "Mocked rationale from stub. Versant-grounded text would live here in prod.",
        feasibility: "High" as const,
        primaryVendor: "BlackLine",
        iconKey: "Calculator",
      },
      source: mode === "ok-llm" ? ("llm" as const) : ("fallback" as const),
    });
    const events: EnrichUploadStreamEvent[] = [
      { kind: "started", totalUploads: body.uploads.length },
      ...body.uploads.map((u) =>
        stamper(
          u.uploadRowId,
          u.preMatchedL3RowId ?? body.l3Roster[0]!.rowId,
          u.solutionName,
        ),
      ),
      { kind: "done", source: mode === "ok-llm" ? "llm" : "fallback" },
    ];
    const ndjson = events
      .map((ev) => JSON.stringify(ev) + "\n")
      .join("");
    return new Response(ndjson, {
      status: 200,
      headers: { "Content-Type": "application/x-ndjson" },
    });
  }) as typeof fetch;
  void uploadCount;
}

async function runOrchestratorSuite(): Promise<void> {
  console.log("\n5. Orchestrator (runEnrichmentFromUpload) — stubbed stream");

  await check("stamps every upload as source: 'manual' on the matched L3 row", async () => {
    seedProgramWithFinanceTower();
    installFetchStub("ok-llm", 2);
    const summary = await runEnrichmentFromUpload({
      towerId: TOWER,
      parsedRows: [
        {
          index: 2,
          l3Raw: "Close and Consolidation",
          solutionName: "Intercompany Close Reconciliation Co-Pilot",
          solutionDescription: "Reconciles intercompany.",
          tech: "BlackLine",
          diagnostics: [],
        },
        {
          index: 3,
          l3Raw: "",
          solutionName: "Covenant Forecaster (auto-matched)",
          solutionDescription: "Forecasts BB- covenant breach risk.",
          tech: "",
          diagnostics: [],
        },
      ],
    });
    assert.equal(summary.totalUploads, 2);
    assert.equal(summary.enriched, 2, "both rows should land as enriched");
    assert.equal(summary.failed, 0);
    assert.equal(summary.llmMatchedL3Count, 1, "1 row had no L3 → LLM auto-match path");
    const rows = getTowerRows();
    const closeAndConsolidation = rows.find(
      (r) => r.id === "finance::corp-finance::close-and-consolidation",
    )!;
    // Both uploads land on the same L3 row (one explicit, one auto-matched
    // to roster[0] by the stub). Expect 2 cards, both source:"manual".
    assert.equal(closeAndConsolidation.l3Initiatives?.length, 2);
    for (const it of closeAndConsolidation.l3Initiatives!) {
      assert.equal(
        it.source,
        "manual",
        "stamped source must be 'manual' even though stream said 'llm'",
      );
    }
    const names = closeAndConsolidation.l3Initiatives!.map((it) => it.solutionName);
    assert.ok(
      names.includes("Intercompany Close Reconciliation Co-Pilot"),
      "uploaded solution name preserved verbatim",
    );
    assert.ok(
      names.includes("Covenant Forecaster (auto-matched)"),
      "auto-matched solution name preserved verbatim",
    );
  });

  await check(
    "INCREMENTAL: existing manual cards are preserved; new uploads append",
    async () => {
      seedProgramWithFinanceTower({
        rowAInitiatives: [
          {
            name: "Existing Manual Card",
            source: "manual",
            id: "finance::row-a::existing",
            fingerprintTuple: {
              description: "Already on tower.",
              tech: "BlackLine",
            },
          },
        ],
      });
      installFetchStub("ok-llm", 1);
      const summary = await runEnrichmentFromUpload({
        towerId: TOWER,
        parsedRows: [
          {
            index: 2,
            l3Raw: "Close and Consolidation",
            solutionName: "Brand New Upload",
            solutionDescription: "Net-new initiative.",
            tech: "BlackLine",
            diagnostics: [],
          },
        ],
      });
      assert.equal(summary.enriched, 1, "1 new card stamped");
      assert.equal(summary.skippedDuplicates, 0, "nothing skipped");
      assert.equal(summary.totalUploads, 1);
      const rowA = getTowerRows().find(
        (r) => r.id === "finance::corp-finance::close-and-consolidation",
      )!;
      assert.equal(
        rowA.l3Initiatives!.length,
        2,
        "existing manual card was preserved, new one appended",
      );
      const names = rowA.l3Initiatives!.map((it) => it.solutionName).sort();
      assert.deepEqual(names, ["Brand New Upload", "Existing Manual Card"]);
    },
  );

  await check(
    "IDEMPOTENT re-upload: same xlsx twice = 0 new, all skipped",
    async () => {
      seedProgramWithFinanceTower();
      installFetchStub("ok-llm", 2);
      const parsedRows = [
        {
          index: 2,
          l3Raw: "Close and Consolidation",
          solutionName: "Solution Alpha",
          solutionDescription: "First initiative.",
          tech: "BlackLine",
          diagnostics: [],
        },
        {
          index: 3,
          l3Raw: "Close and Consolidation",
          solutionName: "Solution Beta",
          solutionDescription: "Second initiative.",
          tech: "FloQast",
          diagnostics: [],
        },
      ];
      const first = await runEnrichmentFromUpload({
        towerId: TOWER,
        parsedRows,
      });
      assert.equal(first.enriched, 2, "first pass stamps both");
      assert.equal(first.skippedDuplicates, 0);

      const second = await runEnrichmentFromUpload({
        towerId: TOWER,
        parsedRows,
      });
      assert.equal(second.enriched, 0, "second pass stamps nothing new");
      assert.equal(
        second.skippedDuplicates,
        2,
        "both rows skipped on idempotent re-upload",
      );
      const total = getTowerRows().reduce(
        (acc, r) => acc + (r.l3Initiatives?.length ?? 0),
        0,
      );
      assert.equal(total, 2, "tower still has exactly 2 manual cards");
    },
  );

  await check(
    "EDIT-AND-RE-UPLOAD: changed description = new card (different fingerprint)",
    async () => {
      seedProgramWithFinanceTower();
      installFetchStub("ok-llm", 1);
      // First upload.
      await runEnrichmentFromUpload({
        towerId: TOWER,
        parsedRows: [
          {
            index: 2,
            l3Raw: "Close and Consolidation",
            solutionName: "Reconciliation Agent",
            solutionDescription: "Original description.",
            tech: "BlackLine",
            diagnostics: [],
          },
        ],
      });

      // Re-upload with the SAME name but EDITED description.
      const second = await runEnrichmentFromUpload({
        towerId: TOWER,
        parsedRows: [
          {
            index: 2,
            l3Raw: "Close and Consolidation",
            solutionName: "Reconciliation Agent",
            solutionDescription: "Revised description with more depth.",
            tech: "BlackLine",
            diagnostics: [],
          },
        ],
      });
      assert.equal(
        second.enriched,
        1,
        "edited row should stamp a new card (fingerprint differs)",
      );
      assert.equal(second.skippedDuplicates, 0);

      const rowA = getTowerRows().find(
        (r) => r.id === "finance::corp-finance::close-and-consolidation",
      )!;
      assert.equal(rowA.l3Initiatives!.length, 2);
      const names = rowA.l3Initiatives!.map((it) => it.solutionName).sort();
      assert.deepEqual(
        names,
        ["Reconciliation Agent", "Reconciliation Agent (2)"],
        "same-name disambiguation via (2) suffix",
      );
    },
  );

  await check(
    "WITHIN-FILE dedupe: two identical fingerprint rows = 1 stamped + 1 skipped",
    async () => {
      seedProgramWithFinanceTower();
      installFetchStub("ok-llm", 1);
      const summary = await runEnrichmentFromUpload({
        towerId: TOWER,
        parsedRows: [
          {
            index: 2,
            l3Raw: "Close and Consolidation",
            solutionName: "Twin Solution",
            solutionDescription: "Identical description.",
            tech: "BlackLine",
            diagnostics: [],
          },
          {
            index: 3,
            l3Raw: "Close and Consolidation",
            solutionName: "Twin Solution",
            solutionDescription: "Identical description.",
            tech: "BlackLine",
            diagnostics: [],
          },
        ],
      });
      assert.equal(summary.totalUploads, 2);
      assert.equal(summary.enriched, 1, "exactly one twin landed");
      assert.equal(
        summary.skippedDuplicates,
        1,
        "second twin skipped within-file",
      );
      const row = getTowerRows().find(
        (r) => r.id === "finance::corp-finance::close-and-consolidation",
      )!;
      assert.equal(row.l3Initiatives!.length, 1);
    },
  );

  await check(
    "WITHIN-FILE same-name different-fingerprint = 2 cards, (2) suffix",
    async () => {
      seedProgramWithFinanceTower();
      installFetchStub("ok-llm", 2);
      const summary = await runEnrichmentFromUpload({
        towerId: TOWER,
        parsedRows: [
          {
            index: 2,
            l3Raw: "Close and Consolidation",
            solutionName: "Same Solution Name",
            solutionDescription: "First.",
            tech: "BlackLine",
            diagnostics: [],
          },
          {
            index: 3,
            l3Raw: "Close and Consolidation",
            solutionName: "Same Solution Name",
            solutionDescription: "Second.",
            tech: "BlackLine",
            diagnostics: [],
          },
        ],
      });
      assert.equal(summary.enriched, 2);
      assert.equal(summary.skippedDuplicates, 0);
      const row = getTowerRows().find(
        (r) => r.id === "finance::corp-finance::close-and-consolidation",
      )!;
      assert.equal(row.l3Initiatives!.length, 2);
      const names = row.l3Initiatives!.map((it) => it.solutionName).sort();
      assert.deepEqual(names, ["Same Solution Name", "Same Solution Name (2)"]);
    },
  );

  await check(
    "LEGACY name-only fallback: pre-migration manual cards skip by name",
    async () => {
      seedProgramWithFinanceTower({
        rowAInitiatives: [
          {
            // Legacy seed: no `fingerprintTuple` → no `uploadFingerprint` on
            // the stored card. Mimics manual cards stamped before this
            // migration shipped. The orchestrator must still skip a
            // re-upload of the same name.
            name: "Pre-migration Manual Card",
            source: "manual",
            id: "finance::row-a::legacy",
          },
        ],
      });
      installFetchStub("ok-llm", 1);
      const summary = await runEnrichmentFromUpload({
        towerId: TOWER,
        parsedRows: [
          {
            index: 2,
            l3Raw: "Close and Consolidation",
            solutionName: "Pre-migration Manual Card",
            solutionDescription: "Same name, fresh upload.",
            tech: "BlackLine",
            diagnostics: [],
          },
        ],
      });
      assert.equal(summary.enriched, 0);
      assert.equal(
        summary.skippedDuplicates,
        1,
        "name-only fallback should skip the legacy card",
      );
      const row = getTowerRows().find(
        (r) => r.id === "finance::corp-finance::close-and-consolidation",
      )!;
      assert.equal(
        row.l3Initiatives!.length,
        1,
        "tower still has just the legacy card",
      );
    },
  );

  await check(
    "TOWER-WIDE id-collision suffix: two distinct long names with same first-48 slug",
    async () => {
      seedProgramWithFinanceTower();
      installFetchStub("ok-llm", 2);
      // The stub computes the payload id from
      // `mocked::{matchedRowId}::{lowercase-name-with-dashes}`. The
      // orchestrator's defensive collision suffix protects against the
      // payload id colliding with an EXISTING tower id, not against
      // within-payload collisions (those rely on the route-side
      // truncation logic). To exercise the collision path here, we
      // pre-seed a card with the exact id the second upload would
      // otherwise produce.
      const collidingId =
        "mocked::finance::corp-finance::close-and-consolidation::distinct-long-solution-name-alpha";
      const prog = getAssessProgram();
      const targetRow = prog.towers[TOWER]!.l3Rows!.find(
        (r) => r.id === "finance::corp-finance::close-and-consolidation",
      )!;
      targetRow.l3Initiatives!.push({
        id: collidingId,
        solutionName: "Pre-existing card with conflicting id",
        tagline: "Stub.",
        aiRationale: "Stub.",
        feasibility: "Low",
        source: "manual",
        generatedAt: new Date().toISOString(),
        uploadFingerprint: "different|fingerprint|tuple",
      });
      setAssessProgram(prog);

      const summary = await runEnrichmentFromUpload({
        towerId: TOWER,
        parsedRows: [
          {
            index: 2,
            l3Raw: "Close and Consolidation",
            solutionName: "Distinct Long Solution Name Alpha",
            solutionDescription: "Fresh upload that would collide on id.",
            tech: "BlackLine",
            diagnostics: [],
          },
        ],
      });
      assert.equal(summary.enriched, 1);
      const row = getTowerRows().find(
        (r) => r.id === "finance::corp-finance::close-and-consolidation",
      )!;
      const ids = row.l3Initiatives!.map((it) => it.id);
      const uniqueIds = new Set(ids);
      assert.equal(
        uniqueIds.size,
        ids.length,
        "every stored id must be unique — collision suffix applied",
      );
    },
  );

  await check("server emits 'fallback' source → orchestrator marks summary.failed", async () => {
    seedProgramWithFinanceTower();
    installFetchStub("ok-fallback", 1);
    const summary = await runEnrichmentFromUpload({
      towerId: TOWER,
      parsedRows: [
        {
          index: 2,
          l3Raw: "Close and Consolidation",
          solutionName: "Test Fallback Solution",
          solutionDescription: "Description.",
          tech: "BlackLine",
          diagnostics: [],
        },
      ],
    });
    assert.equal(summary.failed, 1, "fallback source should bump summary.failed");
    assert.equal(summary.enriched, 0);
    const row = getTowerRows().find(
      (r) => r.id === "finance::corp-finance::close-and-consolidation",
    )!;
    assert.equal(
      row.l3Initiatives![0]!.source,
      "manual",
      "STORED source still 'manual' even when wire was 'fallback' (human seeded the row)",
    );
  });

  await check(
    "INCREMENTAL: network error preserves existing manual cards on the tower",
    async () => {
      seedProgramWithFinanceTower({
        rowAInitiatives: [
          {
            name: "Pre-existing Manual Card",
            source: "manual",
            id: "finance::row-a::preexisting",
            fingerprintTuple: { description: "Already here.", tech: "BlackLine" },
          },
        ],
      });
      installFetchStub("network-error", 1);
      const summary = await runEnrichmentFromUpload({
        towerId: TOWER,
        parsedRows: [
          {
            index: 2,
            l3Raw: "Close and Consolidation",
            solutionName: "Network Error Solution",
            solutionDescription: "Description.",
            tech: "BlackLine",
            diagnostics: [],
          },
        ],
      });
      assert.equal(summary.enriched, 0);
      assert.ok(
        summary.failed >= 1,
        "failed count should be at least the chunk size on hard network error",
      );
      assert.match(summary.warning ?? "", /Simulated network failure/);
      const rowA = getTowerRows().find(
        (r) => r.id === "finance::corp-finance::close-and-consolidation",
      )!;
      assert.equal(
        rowA.l3Initiatives!.length,
        1,
        "pre-existing manual card survived the failed run",
      );
      assert.equal(
        rowA.l3Initiatives![0]!.solutionName,
        "Pre-existing Manual Card",
      );
    },
  );

  await check("flushSave callback is invoked once after a successful run", async () => {
    seedProgramWithFinanceTower();
    installFetchStub("ok-llm", 1);
    let flushed = 0;
    await runEnrichmentFromUpload({
      towerId: TOWER,
      parsedRows: [
        {
          index: 2,
          l3Raw: "Close and Consolidation",
          solutionName: "Flush Save Test",
          solutionDescription: "Description.",
          tech: "BlackLine",
          diagnostics: [],
        },
      ],
      flushSave: async () => {
        flushed += 1;
      },
    });
    assert.equal(flushed, 1, "flushSave should be called exactly once");
  });

}

// ===========================================================================
//   6. REGENERATE GUARDRAIL — `runForL3Rows` preserves manual entries
// ===========================================================================

async function runRegenGuardrailSuite(): Promise<void> {
  console.log("\n6. Discovery regenerate guardrail (runForL3Rows)");

  await check("source: 'manual' initiative survives a re-run of discovery on the same row", async () => {
    seedProgramWithFinanceTower({
      initialManualNames: ["My Uploaded Card — Must Not Be Wiped"],
    });
    // Stub fetch with the curate-l3 streaming protocol (different shape
    // than enrich-upload). Two ndjson events: started + one row.
    globalThis.fetch = (async (
      _url: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<Response> => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        rows: Array<{ rowId: string }>;
      };
      const ndjsonLines: string[] = [
        JSON.stringify({ kind: "started", totalRows: body.rows.length }) + "\n",
      ];
      for (const r of body.rows) {
        ndjsonLines.push(
          JSON.stringify({
            kind: "row",
            rowId: r.rowId,
            l3Initiatives: [
              {
                id: `discovery::${r.rowId}::auto`,
                solutionName: "Newly Discovered LLM Solution",
                tagline: "Stub tagline.",
                aiRationale: "Stub rationale.",
                feasibility: "Low",
              },
            ],
            source: "llm",
          }) + "\n",
        );
      }
      ndjsonLines.push(JSON.stringify({ kind: "done", source: "llm" }) + "\n");
      return new Response(ndjsonLines.join(""), {
        status: 200,
        headers: { "Content-Type": "application/x-ndjson" },
      });
    }) as typeof fetch;

    const targetRowId = "finance::corp-finance::close-and-consolidation";
    const summary = await runForL3Rows({
      towerId: TOWER,
      rowIds: [targetRowId],
    });
    assert.equal(summary.succeeded, 1);
    assert.equal(summary.failed, 0);
    const row = getTowerRows().find((r) => r.id === targetRowId)!;
    assert.ok(row.l3Initiatives, "row should have initiatives");
    const manualNames = row.l3Initiatives!.filter((it) => it.source === "manual");
    const llmNames = row.l3Initiatives!.filter((it) => it.source === "llm");
    assert.equal(manualNames.length, 1, "manual initiative must survive the regen");
    assert.equal(
      manualNames[0]!.solutionName,
      "My Uploaded Card — Must Not Be Wiped",
    );
    assert.equal(llmNames.length, 1, "LLM solution should also be stamped");
    assert.equal(llmNames[0]!.solutionName, "Newly Discovered LLM Solution");
  });
}

// ===========================================================================
//   7. CLEAR HELPERS — count, delete-one, clear-manual, clear-LLM (each
//      with associated-review cleanup so stale rejections can't hide
//      future re-stamps of the same id, the Finance 49→44 bug)
// ===========================================================================

async function runClearHelpersSuite(): Promise<void> {
  console.log("\n7. Clear helpers");

  await check("countAllManualInitiatives sums across rows", () => {
    seedProgramWithFinanceTower({ initialManualNames: ["A", "B"] });
    // Second row currently has no manual entries. Total should be 2.
    assert.equal(countAllManualInitiatives(TOWER), 2);
  });

  await check("deleteManualInitiative removes a single manual entry by id", () => {
    seedProgramWithFinanceTower({ initialManualNames: ["A", "B"] });
    const row = getTowerRows().find(
      (r) => r.id === "finance::corp-finance::close-and-consolidation",
    )!;
    const targetId = row.l3Initiatives![0]!.id;
    const removed = deleteManualInitiative(TOWER, targetId);
    assert.equal(removed, true);
    assert.equal(countAllManualInitiatives(TOWER), 1, "one left after delete");
    const after = getTowerRows().find(
      (r) => r.id === "finance::corp-finance::close-and-consolidation",
    )!;
    assert.equal(after.l3Initiatives!.length, 1);
    assert.notEqual(after.l3Initiatives![0]!.id, targetId);
  });

  await check("deleteManualInitiative refuses non-manual entries", () => {
    seedProgramWithFinanceTower({ initialManualNames: ["A"] });
    // Mutate the seeded initiative in-place to look like an LLM one,
    // then attempt to delete by id — should be a no-op.
    const prog = getAssessProgram();
    const targetRow = prog.towers[TOWER]!.l3Rows!.find(
      (r) => r.id === "finance::corp-finance::close-and-consolidation",
    )!;
    const init = targetRow.l3Initiatives![0]!;
    init.source = "llm";
    setAssessProgram(prog);

    const removed = deleteManualInitiative(TOWER, init.id);
    assert.equal(removed, false, "must NOT delete an llm-source initiative by id");
    assert.equal(
      getTowerRows().find(
        (r) => r.id === "finance::corp-finance::close-and-consolidation",
      )!.l3Initiatives!.length,
      1,
      "row still has the (now-llm) initiative",
    );
  });

  await check("clearManualInitiativesForTower wipes only manual entries", () => {
    seedProgramWithFinanceTower({ initialManualNames: ["A", "B"] });
    // Add a fake LLM-discovered initiative to row 1 so we can verify it
    // survives the clear.
    const prog = getAssessProgram();
    const targetRow = prog.towers[TOWER]!.l3Rows!.find(
      (r) => r.id === "finance::corp-finance::close-and-consolidation",
    )!;
    targetRow.l3Initiatives!.push({
      id: "discovery::lives",
      solutionName: "Discovery Survives",
      tagline: "Discovery tagline.",
      aiRationale: "Discovery rationale.",
      feasibility: "High",
      source: "llm",
      generatedAt: new Date().toISOString(),
    });
    setAssessProgram(prog);

    const removed = clearManualInitiativesForTower(TOWER);
    assert.equal(removed, 2, "should remove the 2 manual entries");
    assert.equal(countAllManualInitiatives(TOWER), 0);
    const row = getTowerRows().find(
      (r) => r.id === "finance::corp-finance::close-and-consolidation",
    )!;
    assert.equal(row.l3Initiatives!.length, 1);
    assert.equal(row.l3Initiatives![0]!.solutionName, "Discovery Survives");
  });

  await check(
    "clearManualInitiativesForTower also clears reviews on removed cards",
    () => {
      seedProgramWithFinanceTower({
        rowAInitiatives: [
          {
            name: "Card A",
            source: "manual",
            id: "manual::row-a::card-a",
          },
          {
            name: "Card B",
            source: "manual",
            id: "manual::row-a::card-b",
          },
        ],
      });
      setInitiativeReview(TOWER, "manual::row-a::card-a", "rejected", {
        name: "Card A",
        l2Name: "Corporate Finance",
        l3Name: "Close and Consolidation",
        l4Name: "covers full Job Family",
        rowId: "finance::corp-finance::close-and-consolidation",
      });
      setInitiativeReview(TOWER, "unrelated::keep-me", "approved", {
        name: "Unrelated",
        l2Name: "Corporate Finance",
        l3Name: "Close and Consolidation",
        l4Name: "covers full Job Family",
        rowId: "finance::corp-finance::close-and-consolidation",
      });

      const removed = clearManualInitiativesForTower(TOWER);
      assert.equal(removed, 2);
      const reviewsAfter = getInitiativeReviews(TOWER);
      assert.equal(
        reviewsAfter["manual::row-a::card-a"],
        undefined,
        "review on removed manual card must be cleared",
      );
      assert.equal(
        reviewsAfter["unrelated::keep-me"]?.status,
        "approved",
        "unrelated review must survive untouched",
      );
    },
  );

  await check(
    "clearLLMInitiativesForTower removes only llm + fallback entries",
    () => {
      seedProgramWithFinanceTower({
        rowAInitiatives: [
          {
            name: "Manual Stays",
            source: "manual",
            id: "manual::row-a::stays",
            fingerprintTuple: { description: "x", tech: "y" },
          },
          { name: "LLM Goes", source: "llm", id: "llm::row-a::goes" },
          {
            name: "Fallback Also Goes",
            source: "fallback",
            id: "fallback::row-a::goes",
          },
        ],
      });

      const removed = clearLLMInitiativesForTower(TOWER);
      assert.equal(removed, 2, "removes 1 llm + 1 fallback");
      const row = getTowerRows().find(
        (r) => r.id === "finance::corp-finance::close-and-consolidation",
      )!;
      assert.equal(row.l3Initiatives!.length, 1);
      assert.equal(row.l3Initiatives![0]!.solutionName, "Manual Stays");
      assert.equal(row.l3Initiatives![0]!.source, "manual");
    },
  );

  await check(
    "clearLLMInitiativesForTower also clears reviews on removed LLM cards",
    () => {
      seedProgramWithFinanceTower({
        rowAInitiatives: [
          { name: "LLM A", source: "llm", id: "llm::row-a::a" },
          { name: "LLM B", source: "llm", id: "llm::row-a::b" },
        ],
      });
      setInitiativeReview(TOWER, "llm::row-a::a", "approved", {
        name: "LLM A",
        l2Name: "Corporate Finance",
        l3Name: "Close and Consolidation",
        l4Name: "covers full Job Family",
        rowId: "finance::corp-finance::close-and-consolidation",
      });
      setInitiativeReview(TOWER, "llm::row-a::b", "rejected", {
        name: "LLM B",
        l2Name: "Corporate Finance",
        l3Name: "Close and Consolidation",
        l4Name: "covers full Job Family",
        rowId: "finance::corp-finance::close-and-consolidation",
      });

      const removed = clearLLMInitiativesForTower(TOWER);
      assert.equal(removed, 2);
      const reviewsAfter = getInitiativeReviews(TOWER);
      assert.equal(reviewsAfter["llm::row-a::a"], undefined);
      assert.equal(reviewsAfter["llm::row-a::b"], undefined);
    },
  );
}

// ===========================================================================
//   8. ROUTE-LEVEL FALLBACK DRAIN — covers the "47 of 49" prod symptom
//      where the bounded-concurrency worker pool either threw mid-batch
//      or returned silently on an aborted signal, leaving some rows
//      unemitted. The fix is a by-uploadRowId set-difference drain that
//      runs unconditionally after the LLM step.
// ===========================================================================

async function runRouteFallbackDrainSuite(): Promise<void> {
  console.log("\n8. Route-level fallback drain (buildPendingFallbackRows)");

  const roster: L3RosterEntry[] = [
    {
      rowId: "finance::corp-finance::close-and-consolidation",
      l1: "Finance",
      l2: "Corporate Finance",
      l3: "Close and Consolidation",
      childL4Names: [],
    },
    {
      rowId: "finance::treasury::cash-and-covenant",
      l1: "Finance",
      l2: "Treasury",
      l3: "Cash and Covenant Management",
      childL4Names: [],
    },
  ];
  const makeUploads = (n: number): EnrichUploadRowInput[] =>
    Array.from({ length: n }, (_, i) => ({
      uploadRowId: `upload-${i}`,
      solutionName: `Solution ${i}`,
      solutionDescription: `Description ${i}`,
      tech: "",
      preMatchedL3RowId: roster[0]!.rowId,
    }));

  await check(
    "emits a fallback row for every input when emittedRowIds is empty",
    () => {
      const uploads = makeUploads(49);
      const out = buildPendingFallbackRows(
        "finance",
        uploads,
        roster,
        new Set<string>(),
      );
      assert.equal(out.length, 49);
      for (let i = 0; i < 49; i += 1) {
        assert.equal(out[i]!.uploadRowId, `upload-${i}`);
        assert.equal(out[i]!.source, "fallback");
      }
    },
  );

  await check("emits zero rows when every uploadRowId is already emitted", () => {
    const uploads = makeUploads(49);
    const emitted = new Set(uploads.map((u) => u.uploadRowId));
    const out = buildPendingFallbackRows("finance", uploads, roster, emitted);
    assert.equal(out.length, 0);
  });

  await check(
    "reproduces the prod 47-of-49 bug: drains the actual non-positional gaps",
    () => {
      // The bounded-concurrency worker pool can complete uploads
      // out-of-order. Simulate the actual buggy state the user saw:
      // 47 of the 49 rows emitted, but the gap is in the MIDDLE of the
      // input array (positions 12 and 35), not at the end. The OLD
      // positional `uploads.slice(emittedCount)` would have re-emitted
      // positions 47 and 48 and silently dropped 12 and 35. The new
      // set-difference drain must emit fallback for exactly 12 and 35.
      const uploads = makeUploads(49);
      const emitted = new Set<string>();
      for (let i = 0; i < 49; i += 1) {
        if (i === 12 || i === 35) continue;
        emitted.add(`upload-${i}`);
      }
      assert.equal(emitted.size, 47);

      const out = buildPendingFallbackRows("finance", uploads, roster, emitted);
      assert.equal(
        out.length,
        2,
        "drain emits exactly the 2 gaps, not the last 2 positional uploads",
      );
      const ids = out.map((r) => r.uploadRowId).sort();
      assert.deepEqual(
        ids,
        ["upload-12", "upload-35"],
        "drained ids are the actual unemitted ones",
      );
    },
  );

  await check(
    "drain attaches every row to roster[0] when no preMatchedL3RowId is set",
    () => {
      const uploads = makeUploads(3).map((u) => ({
        ...u,
        preMatchedL3RowId: undefined,
      }));
      const out = buildPendingFallbackRows(
        "finance",
        uploads,
        roster,
        new Set<string>(),
      );
      assert.equal(out.length, 3);
      for (const r of out) {
        assert.equal(
          r.matchedRowId,
          roster[0]!.rowId,
          "no preMatch → roster[0] per fallback contract",
        );
      }
    },
  );

  await check(
    "drain honors valid preMatchedL3RowId on each upload",
    () => {
      const uploads: EnrichUploadRowInput[] = [
        {
          uploadRowId: "u1",
          solutionName: "S1",
          solutionDescription: "D1",
          tech: "",
          preMatchedL3RowId: "finance::treasury::cash-and-covenant",
        },
        {
          uploadRowId: "u2",
          solutionName: "S2",
          solutionDescription: "D2",
          tech: "",
          preMatchedL3RowId: "not-in-roster",
        },
      ];
      const out = buildPendingFallbackRows(
        "finance",
        uploads,
        roster,
        new Set<string>(),
      );
      assert.equal(out.length, 2);
      assert.equal(
        out[0]!.matchedRowId,
        "finance::treasury::cash-and-covenant",
        "valid preMatch → use it",
      );
      assert.equal(
        out[1]!.matchedRowId,
        roster[0]!.rowId,
        "invalid preMatch → roster[0]",
      );
    },
  );

  await check("empty roster yields an empty drain (defensive guard)", () => {
    const out = buildPendingFallbackRows(
      "finance",
      makeUploads(3),
      [],
      new Set<string>(),
    );
    assert.equal(out.length, 0);
  });
}

// ===========================================================================
//   9. MODE DERIVATION — `deriveTowerInitiativeMode` pure derivation
// ===========================================================================

async function runModeDerivationSuite(): Promise<void> {
  console.log("\n9. Tower initiative mode derivation");

  await check("empty initiatives → empty", () => {
    assert.equal(deriveTowerInitiativeMode([]), "empty");
    assert.equal(deriveTowerInitiativeMode(undefined), "empty");
  });

  await check("only llm/fallback initiatives → llm-discovered", () => {
    const initiatives: L3Initiative[] = [
      {
        id: "a",
        solutionName: "A",
        tagline: "t",
        aiRationale: "r",
        feasibility: "Low",
        source: "llm",
        generatedAt: new Date().toISOString(),
      },
      {
        id: "b",
        solutionName: "B",
        tagline: "t",
        aiRationale: "r",
        feasibility: "Low",
        source: "fallback",
        generatedAt: new Date().toISOString(),
      },
    ];
    assert.equal(deriveTowerInitiativeMode(initiatives), "llm-discovered");
  });

  await check("any manual initiative → user-uploaded", () => {
    const initiatives: L3Initiative[] = [
      {
        id: "a",
        solutionName: "A",
        tagline: "t",
        aiRationale: "r",
        feasibility: "Low",
        source: "manual",
        generatedAt: new Date().toISOString(),
      },
    ];
    assert.equal(deriveTowerInitiativeMode(initiatives), "user-uploaded");
  });

  await check(
    "mixed (defensive): manual wins so uploads aren't silently hidden",
    () => {
      // By construction the orchestrator + clear helpers never produce
      // a mixed slate, but if upstream state ever lands mixed (bug, dev
      // tools, partial migration), manual wins so the user's upload
      // doesn't disappear behind LLM cards.
      const initiatives: L3Initiative[] = [
        {
          id: "a",
          solutionName: "A",
          tagline: "t",
          aiRationale: "r",
          feasibility: "Low",
          source: "llm",
          generatedAt: new Date().toISOString(),
        },
        {
          id: "b",
          solutionName: "B",
          tagline: "t",
          aiRationale: "r",
          feasibility: "Low",
          source: "manual",
          generatedAt: new Date().toISOString(),
        },
      ];
      assert.equal(deriveTowerInitiativeMode(initiatives), "user-uploaded");
    },
  );
}

// ===========================================================================
//   Run everything
// ===========================================================================

async function main(): Promise<void> {
  console.log("Upload-initiatives end-to-end smoke");

  await runParserSuite();
  await runTemplateSuite();
  await runStreamProtocolSuite();
  await runFallbackSuite();
  await runOrchestratorSuite();
  await runRegenGuardrailSuite();
  await runClearHelpersSuite();
  await runRouteFallbackDrainSuite();
  await runModeDerivationSuite();

  console.log();
  if (failures > 0) {
    console.error(`FAILED — ${failures} check(s) did not pass`);
    process.exit(1);
  }
  console.log("All checks passed.");
}

void main().catch((e) => {
  console.error("Unexpected error:", e);
  process.exit(2);
});
