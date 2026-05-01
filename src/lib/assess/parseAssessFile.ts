import type { L4WorkforceRow } from "@/data/assess/types";
import * as XLSX from "xlsx";

// Upload-template note (5-layer migration):
//   The new tower upload format expects three hierarchy columns —
//     L2 (Job Grouping) / L3 (Job Family) / L4 (Activity Group) —
//   plus the existing four headcount columns + optional annual_spend.
//   Legacy two-column files (`l2` + `l3`) are still accepted for back-
//   compat: they're treated as the new L3 + L4, and the caller stamps
//   `l2` with the tower's L1 Function name (Job Grouping wrapper).

function normKey(s: string): string {
  return s
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function mapHeader(n: string): string | null {
  const m: [string, string[]][] = [
    [
      "l2",
      [
        "l2",
        "level_2",
        "level2",
        "l2_name",
        "l_2",
        "job_grouping",
        "jobgrouping",
        "grouping",
      ],
    ],
    [
      "l3",
      [
        "l3",
        "level_3",
        "level3",
        "l3_name",
        "l_3",
        "pillar",
        "job_family",
        "jobfamily",
        "family",
        "sub_tower",
        "subtower",
      ],
    ],
    [
      "l4",
      [
        "l4",
        "level_4",
        "level4",
        "l4_name",
        "l_4",
        "activity_group",
        "activitygroup",
        "capability",
        "sub_capability",
      ],
    ],
    [
      "fteOnshore",
      [
        "fte_onshore",
        "fteonshore",
        "fte_on",
        "ftes_onshore",
        "onshore_fte",
        "fte_ons",
      ],
    ],
    [
      "fteOffshore",
      ["fte_offshore", "fteoffshore", "fte_off", "ftes_offshore", "offshore_fte", "fte_ofs"],
    ],
    [
      "contractorOnshore",
      [
        "contractor_onshore",
        "contractors_onshore",
        "contractor_on",
        "cons_onshore",
        "c_on",
        "c_onshore",
        "con_onshore",
      ],
    ],
    [
      "contractorOffshore",
      [
        "contractor_offshore",
        "contractors_offshore",
        "cons_offshore",
        "c_off",
        "c_offshore",
        "con_offshore",
      ],
    ],
    [
      "annualSpendUsd",
      [
        "annual_spend_usd",
        "annual_spend",
        "spend",
        "spend_usd",
        "cost_usd",
        "opex_usd",
        "pool_usd",
      ],
    ],
  ];
  for (const [canonical, aliases] of m) {
    if (aliases.includes(n)) return canonical;
  }
  return null;
}

function toNum(v: unknown): number | null {
  if (v === "" || v === null || v === undefined) return 0;
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  const s = String(v).replace(/,/g, "").trim();
  if (s === "") return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24) || "x"
  );
}

export type ParseAssessFileResult = {
  ok: boolean;
  rows: L4WorkforceRow[];
  errors: string[];
  rawRowCount: number;
};

type Resolved = {
  /** L2 Job Grouping. Empty when the file only had the legacy 2-col shape. */
  l2: string;
  /** L3 Job Family. */
  l3: string;
  /** L4 Activity Group. */
  l4: string;
  fteOnshore: number;
  fteOffshore: number;
  contractorOnshore: number;
  contractorOffshore: number;
  annualSpendUsd?: number;
};

/**
 * Read first sheet of .xlsx or .csv. Required columns: L2, L3, L4 (V5 5-layer
 * upload) and four FTE/contractor counts. Optional: annual_spend. Legacy
 * 2-column files (L2 + L3 only) are accepted for back-compat — the missing L4
 * Activity Group label is stamped from L3 so the tower keeps loading.
 *
 * Tower leads upload at L4 Activity Group granularity — one row per
 * (L2 Job Grouping, L3 Job Family, L4 Activity Group). Duplicate keys are
 * summed (handy when a sheet was authored at a finer grain and then
 * collapsed). L5 Activities are NOT part of the upload; they're generated
 * separately on the Capability Map page by the LLM.
 *
 * Impact-lever percentages are also dropped from the upload — tower leads
 * dial those on the Configure Impact Levers page after the headcount lands.
 */
export function parseAssessFileBuffer(
  data: ArrayBuffer,
  fileName: string,
): ParseAssessFileResult {
  const isCsv = fileName.toLowerCase().endsWith(".csv");
  const wb = XLSX.read(data, {
    type: "array",
    raw: false,
    codepage: isCsv ? 65001 : undefined,
  });
  const name = wb.SheetNames[0];
  if (!name) {
    return { ok: false, rows: [], errors: ["No sheet found in workbook."], rawRowCount: 0 };
  }
  const sheet = wb.Sheets[name];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });
  const errors: string[] = [];
  type Acc = {
    l2: string;
    l3: string;
    l4: string;
    fteOnshore: number;
    fteOffshore: number;
    contractorOnshore: number;
    contractorOffshore: number;
    annualSpendUsd: number;
    hasSpend: boolean;
  };
  const order: string[] = [];
  const groups = new Map<string, Acc>();

  json.forEach((obj, i) => {
    const line = i + 2;
    const r: Partial<Resolved> = {};
    for (const [k, v] of Object.entries(obj)) {
      const nk = normKey(k);
      const field = mapHeader(nk);
      if (!field) continue;
      if (field === "l2" || field === "l3" || field === "l4") {
        (r as Record<string, string>)[field] = String(v ?? "").trim();
        continue;
      }
      if (field === "annualSpendUsd") {
        const n = toNum(v);
        if (n === null) {
          errors.push(`Line ${line}: annual_spend is not a number.`);
        } else if (n > 0) {
          r.annualSpendUsd = n;
        }
        continue;
      }
      const n = toNum(v);
      if (n === null) {
        errors.push(`Line ${line}: ${field} is not a number.`);
        return;
      }
      if (n < 0) errors.push(`Line ${line}: ${field} cannot be negative.`);
      (r as Record<string, number>)[field] = n;
    }
    // Legacy 2-col files (just `l2` + `l3`) are accepted for back-compat:
    // shift them up one level (file's "l2" becomes new L3 Job Family,
    // file's "l3" becomes new L4 Activity Group), and leave the new L2
    // (Job Grouping) blank — the caller stamps it from the tower's L1
    // Function name. New 3-col files (`l2` + `l3` + `l4`) flow through
    // verbatim.
    const has2Col = !!r.l2?.trim() && !!r.l3?.trim() && !r.l4?.trim();
    if (has2Col) {
      r.l4 = r.l3;
      r.l3 = r.l2;
      r.l2 = "";
    }
    if (!r.l3?.trim() && !r.l4?.trim()) return;
    if (!r.l3?.trim() || !r.l4?.trim()) {
      errors.push(
        `Line ${line}: L3 (Job Family) and L4 (Activity Group) are required (got L3=${r.l3 || "—"}, L4=${r.l4 || "—"}).`,
      );
      return;
    }
    for (const k of [
      "fteOnshore",
      "fteOffshore",
      "contractorOnshore",
      "contractorOffshore",
    ] as const) {
      if (r[k] === undefined) {
        errors.push(`Line ${line}: missing numeric column for ${k}.`);
        return;
      }
    }
    const rFull = r as Resolved;
    const l2Norm = rFull.l2.trim();
    const l3Norm = rFull.l3.trim();
    const l4Norm = rFull.l4.trim();
    const key = `${l2Norm.toLowerCase()}\u0000${l3Norm.toLowerCase()}\u0000${l4Norm.toLowerCase()}`;
    let acc = groups.get(key);
    if (!acc) {
      acc = {
        l2: l2Norm,
        l3: l3Norm,
        l4: l4Norm,
        fteOnshore: 0,
        fteOffshore: 0,
        contractorOnshore: 0,
        contractorOffshore: 0,
        annualSpendUsd: 0,
        hasSpend: false,
      };
      groups.set(key, acc);
      order.push(key);
    }
    acc.fteOnshore += rFull.fteOnshore;
    acc.fteOffshore += rFull.fteOffshore;
    acc.contractorOnshore += rFull.contractorOnshore;
    acc.contractorOffshore += rFull.contractorOffshore;
    if (rFull.annualSpendUsd != null && rFull.annualSpendUsd > 0) {
      acc.annualSpendUsd += rFull.annualSpendUsd;
      acc.hasSpend = true;
    }
  });

  const rows: L4WorkforceRow[] = order.map((k) => {
    const a = groups.get(k)!;
    const out: L4WorkforceRow = {
      id: `${slugify(a.l3)}::${slugify(a.l4)}`,
      l2: a.l2,
      l3: a.l3,
      l4: a.l4,
      fteOnshore: a.fteOnshore,
      fteOffshore: a.fteOffshore,
      contractorOnshore: a.contractorOnshore,
      contractorOffshore: a.contractorOffshore,
    };
    if (a.hasSpend) out.annualSpendUsd = a.annualSpendUsd;
    return out;
  });

  return {
    ok: errors.length === 0,
    rows,
    errors,
    rawRowCount: json.length,
  };
}

export async function parseAssessFile(file: File): Promise<ParseAssessFileResult> {
  const data = await file.arrayBuffer();
  return parseAssessFileBuffer(data, file.name);
}
