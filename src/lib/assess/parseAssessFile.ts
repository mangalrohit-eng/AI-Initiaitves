import type { L3WorkforceRow } from "@/data/assess/types";
import * as XLSX from "xlsx";

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
    ["l2", ["l2", "level_2", "level2", "pillar", "l2_name", "l_2"]],
    ["l3", ["l3", "level_3", "level3", "l3_name", "l_3", "sub_tower", "subtower", "capability", "sub_capability"]],
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
  rows: L3WorkforceRow[];
  errors: string[];
  rawRowCount: number;
};

type Resolved = {
  l2: string;
  l3: string;
  fteOnshore: number;
  fteOffshore: number;
  contractorOnshore: number;
  contractorOffshore: number;
  annualSpendUsd?: number;
};

/**
 * Read first sheet of .xlsx or .csv. Required columns: L2, L3 and four
 * FTE/contractor counts. Optional: annual_spend.
 *
 * Tower leads upload at L3 granularity — one row per (L2, L3). Duplicate
 * (L2, L3) keys are summed (handy when a sheet was authored at a finer grain
 * and then collapsed). L4 activities are NOT part of the upload; they're
 * generated separately on the Capability Map page.
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
      if (field === "l2" || field === "l3") {
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
    if (!r.l2?.trim() && !r.l3?.trim()) return;
    if (!r.l2?.trim() || !r.l3?.trim()) {
      errors.push(
        `Line ${line}: L2 and L3 are required (got L2=${r.l2 || "—"}, L3=${r.l3 || "—"}).`,
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
    const key = `${l2Norm.toLowerCase()}\u0000${l3Norm.toLowerCase()}`;
    let acc = groups.get(key);
    if (!acc) {
      acc = {
        l2: l2Norm,
        l3: l3Norm,
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

  const rows: L3WorkforceRow[] = order.map((k) => {
    const a = groups.get(k)!;
    const out: L3WorkforceRow = {
      id: `${slugify(a.l2)}::${slugify(a.l3)}`,
      l2: a.l2,
      l3: a.l3,
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
