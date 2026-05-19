/**
 * Parse a user-uploaded list of AI Solutions for the Step 4 enrichment
 * pipeline. Accepts CSV or XLSX with the following columns (header
 * matching is forgiving — see `mapHeader`):
 *
 *   L3 (optional)         → `l3Raw`            — Job Family this maps to
 *   Solution Name         → `solutionName`     — required, passed through
 *   Solution Description  → `solutionDescription` — required, seed for tagline + rationale
 *   Tech (optional)       → `tech`             — chosen vendor / stack
 *
 * Rows missing `solutionName` or `solutionDescription` are excluded with
 * a hard error. Soft diagnostics surface vendor-allow-list mismatches
 * and L3-roster mismatches so the user can correct the file before
 * triggering enrichment — no automatic LLM substitution happens at
 * parse time.
 *
 * Mirrors the shape of `parseAssessFile.ts` (XLSX library, header
 * normalization, accumulating diagnostics array) so the upload UX
 * stays consistent with Step 1 / Step 2 / Step 4 intake.
 */

import * as XLSX from "xlsx";
import { ALLOWED_VENDORS } from "@/lib/llm/prompts/versantPromptKit";

export type ParsedInitiativeUploadRow = {
  /** 1-based index into the original file (after the header row). */
  index: number;
  /** L3 text as typed by the user; empty string when blank. */
  l3Raw: string;
  /** Required — user's solution name. */
  solutionName: string;
  /** Required — user's description (seed for LLM polish). */
  solutionDescription: string;
  /** Optional — user-supplied vendor / stack. Empty string when blank. */
  tech: string;
  /** Soft, per-row diagnostics — surfaced in the preview modal. */
  diagnostics: string[];
};

export type ParsedInitiativeUploadFile = {
  rows: ParsedInitiativeUploadRow[];
  /** Hard errors — rows that were dropped (missing required column). */
  errors: string[];
  /** Total rows read from the file (including dropped). */
  rawRowCount: number;
};

const MAX_ROWS = 200;
const MAX_NAME_CHARS = 240;
const MAX_DESCRIPTION_CHARS = 1200;
const MAX_TECH_CHARS = 80;

const VENDOR_ALLOW_LOWER = new Set(
  ALLOWED_VENDORS.map((v) => v.toLowerCase()),
);

function normKey(s: string): string {
  return s
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function mapHeader(n: string): keyof RowMap | null {
  const m: [keyof RowMap, string[]][] = [
    [
      "l3",
      [
        "l3",
        "l3_job_family",
        "job_family",
        "jobfamily",
        "family",
        "l3_name",
        "pillar",
      ],
    ],
    [
      "solutionName",
      [
        "solution_name",
        "solutionname",
        "name",
        "solution",
        "initiative",
        "initiative_name",
        "ai_solution",
        "aisolution",
        "ai_solution_name",
        "title",
      ],
    ],
    [
      "solutionDescription",
      [
        "solution_description",
        "solutiondescription",
        "description",
        "desc",
        "what_it_does",
        "whatitdoes",
        "summary",
        "narrative",
      ],
    ],
    [
      "tech",
      [
        "tech",
        "technology",
        "vendor",
        "primary_vendor",
        "primaryvendor",
        "platform",
        "stack",
        "chosen_vendor",
      ],
    ],
  ];
  for (const [canonical, aliases] of m) {
    if (aliases.includes(n)) return canonical;
  }
  return null;
}

type RowMap = {
  l3: string;
  solutionName: string;
  solutionDescription: string;
  tech: string;
};

/**
 * Normalize an L3 string for matching (lowercase, collapse whitespace
 * and punctuation). Re-exported so the orchestrator can apply the same
 * normalization client-side when pre-matching against the tower's roster.
 */
export function normalizeL3ForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function parseInitiativeUploadFileBuffer(
  data: ArrayBuffer,
  fileName: string,
  l3RosterLabels: ReadonlyArray<string> = [],
): ParsedInitiativeUploadFile {
  const isCsv = fileName.toLowerCase().endsWith(".csv");
  const wb = XLSX.read(data, {
    type: "array",
    raw: false,
    codepage: isCsv ? 65001 : undefined,
  });
  const name = wb.SheetNames[0];
  if (!name) {
    return {
      rows: [],
      errors: ["No sheet found in workbook."],
      rawRowCount: 0,
    };
  }
  const sheet = wb.Sheets[name];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  const errors: string[] = [];
  const rows: ParsedInitiativeUploadRow[] = [];
  const rosterNormalized = new Set(
    l3RosterLabels.map((l) => normalizeL3ForMatch(l)).filter((s) => s.length > 0),
  );

  if (json.length === 0) {
    errors.push("File is empty — no rows below the header.");
    return { rows: [], errors, rawRowCount: 0 };
  }

  if (json.length > MAX_ROWS) {
    errors.push(
      `Too many rows (${json.length}); max ${MAX_ROWS} per upload. Only the first ${MAX_ROWS} were processed.`,
    );
  }

  json.slice(0, MAX_ROWS).forEach((obj, i) => {
    const line = i + 2; // header is line 1
    const r: Partial<RowMap> = {};
    for (const [k, v] of Object.entries(obj)) {
      const nk = normKey(k);
      const field = mapHeader(nk);
      if (!field) continue;
      r[field] = String(v ?? "").trim();
    }

    const solutionName = (r.solutionName ?? "").trim();
    const solutionDescription = (r.solutionDescription ?? "").trim();
    if (!solutionName) {
      errors.push(`Line ${line}: missing required column "Solution Name".`);
      return;
    }
    if (!solutionDescription) {
      errors.push(
        `Line ${line}: missing required column "Solution Description" for "${solutionName}".`,
      );
      return;
    }

    const diagnostics: string[] = [];
    const l3Raw = (r.l3 ?? "").trim();
    if (l3Raw) {
      const normalized = normalizeL3ForMatch(l3Raw);
      if (rosterNormalized.size > 0 && !rosterNormalized.has(normalized)) {
        diagnostics.push(
          `L3 "${l3Raw}" doesn't match any Job Family in this tower — LLM will pick the best-fit L3.`,
        );
      }
    }

    const tech = (r.tech ?? "").trim();
    if (tech) {
      const parts = tech.split(/\s*\+\s*/).map((p) => p.trim()).filter(Boolean);
      const offAllowlist = parts.filter(
        (p) => !VENDOR_ALLOW_LOWER.has(p.toLowerCase()),
      );
      if (offAllowlist.length > 0) {
        diagnostics.push(
          `Vendor "${offAllowlist.join(", ")}" is not on the Versant allow-list — LLM will substitute and note your value in the rationale.`,
        );
      }
    }

    if (solutionName.length > MAX_NAME_CHARS) {
      diagnostics.push(
        `Solution Name is over ${MAX_NAME_CHARS} characters — truncated for the card.`,
      );
    }
    if (solutionDescription.length > MAX_DESCRIPTION_CHARS) {
      diagnostics.push(
        `Solution Description is over ${MAX_DESCRIPTION_CHARS} characters — truncated for the prompt.`,
      );
    }
    if (tech.length > MAX_TECH_CHARS) {
      diagnostics.push(
        `Tech is over ${MAX_TECH_CHARS} characters — truncated.`,
      );
    }

    rows.push({
      index: line,
      l3Raw,
      solutionName: solutionName.slice(0, MAX_NAME_CHARS),
      solutionDescription: solutionDescription.slice(0, MAX_DESCRIPTION_CHARS),
      tech: tech.slice(0, MAX_TECH_CHARS),
      diagnostics,
    });
  });

  return {
    rows,
    errors,
    rawRowCount: json.length,
  };
}

export async function parseInitiativeUploadFile(
  file: File,
  l3RosterLabels: ReadonlyArray<string> = [],
): Promise<ParsedInitiativeUploadFile> {
  const data = await file.arrayBuffer();
  return parseInitiativeUploadFileBuffer(data, file.name, l3RosterLabels);
}

/**
 * Build a downloadable CSV template seeded with sample rows derived
 * from the live tower's L3 roster. Deterministic — no LLM call.
 * Returns the CSV string; caller wraps in a Blob + anchor click.
 */
export function buildInitiativeUploadTemplateCsv(
  l3RosterLabels: ReadonlyArray<string>,
): string {
  const sample: Array<{
    l3: string;
    name: string;
    desc: string;
    tech: string;
  }> = [];
  // Three sample rows. Pick the first three roster entries if we have
  // them; otherwise fall back to generic stand-ins. The descriptions
  // intentionally mirror the Versant-voice contract (concrete savings,
  // specific brand context where applicable) so users see the bar.
  const examples: ReadonlyArray<{ desc: string; tech: string }> = [
    {
      desc: "Matches intercompany transactions across the 7+ Versant entities using fuzzy matching, auto-resolves timing differences, flags exceptions for human review. Target: compress month-end close from 12-18 days to 5-7.",
      tech: "BlackLine",
    },
    {
      desc: "Triages multi-brand customer cases by intent and routes to the right care queue for CNBC Pro, GolfPass, MS NOW community. Target: 60% first-touch resolution on Tier 1 cases.",
      tech: "Salesforce",
    },
    {
      desc: "Drafts a first-pass on-air rundown from the morning's wire stories for MS NOW, surfacing the angles a producer would otherwise hand-search. Standards & Editorial signs off on every gate.",
      tech: "Reuters Connect + OpenAI",
    },
  ];
  const usableRoster = l3RosterLabels.slice(0, 3);
  for (let i = 0; i < 3; i += 1) {
    const e = examples[i]!;
    const l3 = usableRoster[i] ?? (i === 0 ? "" : "");
    sample.push({
      l3,
      name:
        i === 0
          ? "Intercompany Close Reconciliation Co-Pilot"
          : i === 1
            ? "Multi-Brand Customer Triage & Routing Suite"
            : "MS NOW Newsroom Briefing Co-Pilot",
      desc: e.desc,
      tech: e.tech,
    });
  }

  const escape = (s: string): string => {
    if (/[",\n]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const header = ["L3 (Job Family) — optional", "Solution Name", "Solution Description", "Tech (optional)"];
  const lines = [header.join(",")];
  for (const row of sample) {
    lines.push(
      [escape(row.l3), escape(row.name), escape(row.desc), escape(row.tech)].join(","),
    );
  }
  // Trailing blank guidance row so the user understands the shape.
  lines.push(
    [
      escape(""),
      escape("(Your solution name — preserved verbatim)"),
      escape("(2-4 sentences describing what the AI does and the target)"),
      escape("(Optional — a specific vendor from the Versant allow-list)"),
    ].join(","),
  );
  return lines.join("\n");
}
