import * as XLSX from "xlsx";

export type OffshoreClassificationRowOverride = {
  rowId: string;
  /** Display-only audit fields — used to flag mismatches against the tower's current map. */
  l2?: string;
  l3?: string;
  l4?: string;
  /** Headcount column from the upload (audit only — never written to the row's HC fields). */
  totalHc?: number;
  /** Integer 0-100. The new offshore signal. */
  gccPct: number;
  /** Optional free-text rationale (<=200 chars after trim). */
  reason?: string;
};

export type ParseOffshoreClassificationResult =
  | {
      ok: true;
      rows: OffshoreClassificationRowOverride[];
      /** Soft warnings — malformed values, missing rowIds, etc. */
      warnings: string[];
    }
  | { ok: false; error: string };

function normalizeHeader(h: string): string {
  return h.toLowerCase().trim().replace(/\s+/g, "");
}

function rowToObject(headers: string[], row: unknown[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  headers.forEach((h, i) => {
    out[normalizeHeader(h)] = row[i];
  });
  return out;
}

function parsePct(raw: unknown): number | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;
  // Strip a trailing percent sign and any commas / whitespace.
  s = s.replace(/[,\s]/g, "").replace(/%$/, "");
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  // Accept 0-1 fractional values (e.g. 0.7 → 70%) when the cell looks like
  // a decimal share rather than an explicit percentage.
  const pct = n > 0 && n < 1 ? n * 100 : n;
  if (pct < 0 || pct > 100) return null;
  return Math.round(pct);
}

/**
 * Parse the Step 2 Offshore Classification override template (xlsx or csv).
 *
 * Accepted columns (case-insensitive, in any order):
 *   - `rowId`  (required) — matches an existing L4WorkforceRow.id.
 *   - `gccPct` (required) — integer 0-100 (also accepts "70%", "0.7",
 *                            decimals 0-1 are scaled by 100).
 *   - `reason` (optional) — free-text rationale (<=200 chars after trim).
 *   - `l2` / `l3` / `l4` (optional, audit only) — used to surface a row-mismatch
 *                            warning if the labels in the upload don't match
 *                            the current map.
 *   - `totalHc` (optional, audit only) — used only to flag rows where the
 *                            upload's HC differs from the current map.
 *
 * The parser does NOT mutate program state — the caller diffs the parsed
 * overrides against the current rows and uses `ReplaceUploadConfirmDialog`
 * to confirm before committing.
 */
export function parseOffshoreClassificationXlsx(
  buffer: ArrayBuffer,
): ParseOffshoreClassificationResult {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "array", cellDates: false });
  } catch {
    return { ok: false, error: "Could not read the file." };
  }
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { ok: false, error: "The workbook has no sheets." };
  }
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    return { ok: false, error: "Could not read the first worksheet." };
  }

  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
  });
  if (raw.length === 0) {
    return { ok: false, error: "The sheet is empty." };
  }
  const headerRow = raw[0]?.map((v) => String(v ?? "")) ?? [];
  if (!headerRow.length) {
    return { ok: false, error: "Missing header row." };
  }
  const normalizedHeaders = headerRow.map(normalizeHeader);
  if (!normalizedHeaders.includes("rowid")) {
    return { ok: false, error: "Template missing required column 'rowId'." };
  }
  if (!normalizedHeaders.includes("gccpct")) {
    return {
      ok: false,
      error:
        "Template missing required column 'gccPct'. Use an integer 0-100, a percent like \"70%\", or a decimal between 0 and 1.",
    };
  }
  const warnings: string[] = [];
  const rows: OffshoreClassificationRowOverride[] = [];
  for (let i = 1; i < raw.length; i++) {
    const cells = raw[i] ?? [];
    if (cells.every((c) => c == null || String(c).trim() === "")) continue;
    const obj = rowToObject(headerRow, cells as unknown[]);
    const rowId = String(obj.rowid ?? "").trim();
    if (!rowId) {
      warnings.push(`Row ${i + 1}: missing rowId — skipped.`);
      continue;
    }
    const pct = parsePct(obj.gccpct);
    if (pct == null) {
      warnings.push(
        `Row ${i + 1} (${rowId}): gccPct "${obj.gccpct}" is not 0-100 — skipped.`,
      );
      continue;
    }
    const reasonRaw =
      typeof obj.reason === "string" ? obj.reason.trim() : "";
    const reason = reasonRaw.length > 0 ? reasonRaw.slice(0, 200) : undefined;
    const totalHcRaw = obj.totalhc;
    const totalHc =
      typeof totalHcRaw === "number" && Number.isFinite(totalHcRaw)
        ? totalHcRaw
        : typeof totalHcRaw === "string" && totalHcRaw.trim()
          ? Number(totalHcRaw)
          : NaN;
    rows.push({
      rowId,
      l2: typeof obj.l2 === "string" ? (obj.l2 as string) : undefined,
      l3: typeof obj.l3 === "string" ? (obj.l3 as string) : undefined,
      l4: typeof obj.l4 === "string" ? (obj.l4 as string) : undefined,
      totalHc: Number.isFinite(totalHc) ? totalHc : undefined,
      gccPct: pct,
      reason,
    });
  }
  if (rows.length === 0) {
    return {
      ok: false,
      error:
        "No valid override rows parsed — every row had a missing rowId or an out-of-range gccPct.",
    };
  }
  return { ok: true, rows, warnings };
}
