/**
 * Exports all tower-level AI opportunities (4-lens Process records) to Excel.
 * Potential size: H / M / L from each initiative's qualitative `impactTier`.
 */
import * as XLSX from "xlsx";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import type { ImpactTier } from "../src/data/types";
import { towers } from "../src/data/towers";

function potentialLetter(t: ImpactTier): "H" | "M" | "L" {
  if (t === "High") return "H";
  if (t === "Medium") return "M";
  return "L";
}

function cell(s: string): string {
  return s.replace(/\r\n/g, "\n").replace(/\n/g, " ").trim();
}

type Row = {
  Tower: string;
  Opportunity: string;
  Description: string;
  "Potential size (H/M/L)": "H" | "M" | "L";
  "Tower Lead feedback (keep / remove)": string;
  "Tower Lead comment": string;
};

const leanRows: Row[] = [];

for (const t of towers) {
  for (const p of t.processes) {
    leanRows.push({
      Tower: t.name,
      Opportunity: p.name,
      Description: cell(p.description),
      "Potential size (H/M/L)": potentialLetter(p.impactTier),
      "Tower Lead feedback (keep / remove)": "",
      "Tower Lead comment": "",
    });
  }
}

const outDir = join(process.cwd(), "exports");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, "Tower-Opportunities.xlsx");
const outCsv = join(outDir, "Tower-Opportunities.csv");

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet(leanRows);
const colWidths = [
  { wch: 18 },
  { wch: 45 },
  { wch: 80 },
  { wch: 8 },
  { wch: 12 },
  { wch: 30 },
];
ws["!cols"] = colWidths;
XLSX.utils.book_append_sheet(wb, ws, "Opportunities");
XLSX.writeFile(wb, outPath);

// CSV (UTF-8 with BOM) for quick preview or tools without xlsx
const esc = (v: string) => {
  if (v.includes(",") || v.includes('"') || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
};
const headerCsv = [
  "Tower",
  "Opportunity",
  "Description",
  "Potential size (H/M/L)",
  "Tower Lead feedback (keep / remove)",
  "Tower Lead comment",
].join(",");
const dataCsv = leanRows.map((r) =>
  [
    esc(String(r.Tower)),
    esc(String(r.Opportunity)),
    esc(String(r.Description)),
    esc(String(r["Potential size (H/M/L)"])),
    esc(String(r["Tower Lead feedback (keep / remove)"])),
    esc(String(r["Tower Lead comment"])),
  ].join(","),
);
writeFileSync(outCsv, "\uFEFF" + [headerCsv, ...dataCsv].join("\r\n") + "\r\n", "utf8");

console.log("Wrote", outPath);
console.log("Wrote", outCsv);
console.log("Rows:", leanRows.length);
