import * as XLSX from "xlsx";
import type { TowerAiReadinessIntake } from "@/data/assess/types";
import {
  normalizeTowerReadinessIntakeFields,
  validateIntakeTemplateQuestionCells,
} from "@/lib/assess/towerReadinessIntake";

function cellString(sheet: XLSX.WorkSheet, addr: string): string {
  const c = sheet[addr];
  if (!c) return "";
  if (typeof c.v === "string") return c.v;
  if (typeof c.v === "number" && Number.isFinite(c.v)) return String(c.v);
  if (c.w != null && typeof c.w === "string") return c.w;
  return "";
}

function getBText(sheet: XLSX.WorkSheet, row: number): string {
  return cellString(sheet, `B${row}`);
}

export type ParseTowerReadinessXlsxResult =
  | {
      ok: true;
      intake: TowerAiReadinessIntake;
      towerLabelMismatch: boolean;
    }
  | { ok: false; error: string };

/**
 * Parse the fixed Forge Tower AI Readiness Intake workbook (sheet1).
 * `expectedTowerName` is the app display name for soft mismatch warning only.
 */
export function parseTowerReadinessXlsx(
  buffer: ArrayBuffer,
  options: {
    expectedTowerName: string;
    sourceFileName?: string;
  },
): ParseTowerReadinessXlsxResult {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "array", cellDates: false });
  } catch {
    return { ok: false, error: "Could not read the Excel file." };
  }
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { ok: false, error: "The workbook has no sheets." };
  }
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    return { ok: false, error: "Could not read the first worksheet." };
  }

  const templateCheck = validateIntakeTemplateQuestionCells((row) => getBText(sheet, row));
  if (!templateCheck.ok) {
    return { ok: false, error: templateCheck.error };
  }

  const respondentTowerLabel = cellString(sheet, "C5").trim();
  const expected = options.expectedTowerName.trim().toLowerCase();
  const labelNorm = respondentTowerLabel.toLowerCase();
  const towerLabelMismatch =
    respondentTowerLabel.length > 0 &&
    expected.length > 0 &&
    labelNorm !== expected &&
    !labelNorm.includes(expected) &&
    !expected.includes(labelNorm);

  const intake = normalizeTowerReadinessIntakeFields({
    respondentTowerLabel: respondentTowerLabel || undefined,
    systemsPlatforms: cellString(sheet, "C6"),
    currentAiTools: cellString(sheet, "C7"),
    experimentsLearnings: cellString(sheet, "C8"),
    dataRelevant: cellString(sheet, "C9"),
    constraints: cellString(sheet, "C10"),
    biggestImpact: cellString(sheet, "C11"),
    readyNow: cellString(sheet, "C12"),
    noGoAreas: cellString(sheet, "C13"),
    importedAt: new Date().toISOString(),
    sourceFileName: options.sourceFileName,
  });

  return { ok: true, intake, towerLabelMismatch };
}
