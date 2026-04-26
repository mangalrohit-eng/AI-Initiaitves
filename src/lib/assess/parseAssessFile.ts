import type { L4WorkforceRow } from "@/data/assess/types";
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
    ["l3", ["l3", "level_3", "level3", "l3_name", "l_3", "sub_tower", "subtower"]],
    ["l4", ["l4", "level_4", "level4", "l4_name", "l_4", "activity", "capability", "l4_activity"]],
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
    [
      "l4OffshoreAssessmentPct",
      [
        "l4_offshoring_assessment",
        "offshoring_assessment",
        "l4_offshore",
        "offshoring_pct",
        "assess_offshoring",
      ],
    ],
    [
      "l4AiImpactAssessmentPct",
      [
        "l4_ai_impact_assessment",
        "ai_impact_assessment",
        "l4_ai_impact",
        "ai_impact_pct",
        "assess_ai",
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

export type ParseAssessFileResult = {
  ok: boolean;
  rows: L4WorkforceRow[];
  errors: string[];
  rawRowCount: number;
};

type Resolved = {
  l2: string;
  l3: string;
  l4: string;
  fteOnshore: number;
  fteOffshore: number;
  contractorOnshore: number;
  contractorOffshore: number;
  annualSpendUsd?: number;
  l4OffshoreAssessmentPct?: number;
  l4AiImpactAssessmentPct?: number;
};

/**
 * Read first sheet of .xlsx or .csv. Required: L2, L3, L4 and four FTE/contractor columns.
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
  const rows: L4WorkforceRow[] = [];

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
      if (field === "l4OffshoreAssessmentPct" || field === "l4AiImpactAssessmentPct") {
        const s = String(v ?? "").trim();
        if (s === "") continue;
        const n = toNum(v);
        if (n === null) {
          errors.push(`Line ${line}: ${field} is not a number.`);
          return;
        }
        (r as Record<string, number>)[field] = Math.min(100, Math.max(0, n));
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
    if (!r.l2?.trim() && !r.l3?.trim() && !r.l4?.trim()) return;
    if (!r.l2?.trim() || !r.l3?.trim() || !r.l4?.trim()) {
      errors.push(
        `Line ${line}: L2, L3, and L4 are required (got L2=${r.l2 || "—"}, L3=${r.l3 || "—"}, L4=${r.l4 || "—"}).`,
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
    const id = `l4-${i}-${[rFull.l2, rFull.l3, rFull.l4]
      .map((s) => s.slice(0, 24).replace(/\s/g, "-"))
      .join("-")}`;
    const out: L4WorkforceRow = {
      id,
      l2: rFull.l2,
      l3: rFull.l3,
      l4: rFull.l4,
      fteOnshore: rFull.fteOnshore,
      fteOffshore: rFull.fteOffshore,
      contractorOnshore: rFull.contractorOnshore,
      contractorOffshore: rFull.contractorOffshore,
    };
    if (rFull.annualSpendUsd != null) out.annualSpendUsd = rFull.annualSpendUsd;
    if (rFull.l4OffshoreAssessmentPct != null) {
      out.l4OffshoreAssessmentPct = rFull.l4OffshoreAssessmentPct;
    }
    if (rFull.l4AiImpactAssessmentPct != null) {
      out.l4AiImpactAssessmentPct = rFull.l4AiImpactAssessmentPct;
    }
    rows.push(out);
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
