"use client";

import * as XLSX from "xlsx";
import { getTowerSeedRows } from "@/data/assess/seedAssessProgram";
import type { L4WorkforceRow, TowerId } from "@/data/assess/types";
import { towers } from "@/data/towers";

const HEADER = [
  "L2",
  "L3",
  "L4",
  "FTE_onshore",
  "FTE_offshore",
  "contractor_onshore",
  "contractor_offshore",
  "annual_spend_usd",
  "l4_offshoring_assessment",
  "l4_ai_impact_assessment",
] as const;

function rowToArray(r: L4WorkforceRow): (string | number)[] {
  return [
    r.l2,
    r.l3,
    r.l4,
    r.fteOnshore,
    r.fteOffshore,
    r.contractorOnshore,
    r.contractorOffshore,
    r.annualSpendUsd ?? "",
    r.l4OffshoreAssessmentPct ?? "",
    r.l4AiImpactAssessmentPct ?? "",
  ];
}

function safeSheetName(id: string): string {
  const s = id.replace(/[:\\/?*[\]]/g, "-").slice(0, 31);
  return s || "sheet";
}

/** Multiline CSV with header for one tower (seed sample or custom rows). */
export function buildAssessTowerCsv(rows: L4WorkforceRow[]): string {
  const lines = [HEADER.join(",")];
  for (const r of rows) {
    const esc = (x: string) => (x.includes(",") || x.includes('"') ? `"${x.replace(/"/g, '""')}"` : x);
    lines.push(
      [
        esc(r.l2),
        esc(r.l3),
        esc(r.l4),
        r.fteOnshore,
        r.fteOffshore,
        r.contractorOnshore,
        r.contractorOffshore,
        r.annualSpendUsd != null ? r.annualSpendUsd : "",
        r.l4OffshoreAssessmentPct ?? "",
        r.l4AiImpactAssessmentPct ?? "",
      ].join(","),
    );
  }
  return lines.join("\n");
}

export function downloadBlob(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadSingleTowerSampleCsv(towerId: TowerId, fileBase: string): void {
  const rows = getTowerSeedRows(towerId);
  const csv = buildAssessTowerCsv(rows);
  downloadBlob(`${fileBase.replace(/[^a-z0-9-_]+/gi, "-")}-sample.csv`, csv, "text/csv;charset=utf-8");
}

/**
 * One workbook, one sheet per tower, same columns as the empty template; cells use the current seed.
 */
export function downloadAllTowersSampleWorkbook(): void {
  const wb = XLSX.utils.book_new();
  for (const t of towers) {
    const id = t.id as TowerId;
    const rows = getTowerSeedRows(id);
    const aoa: (string | number)[][] = [Array.from(HEADER), ...rows.map(rowToArray)];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(wb, ws, safeSheetName(t.id));
  }
  XLSX.writeFile(wb, "forge-tower-footprint-samples-13-towers.xlsx");
}
