import type { WorkSheet } from "xlsx";
import type { AIProjectResolved, Quadrant } from "@/lib/cross-tower/aiProjects";
import type { CrossTowerAssumptions } from "@/lib/cross-tower/assumptions";
import type { ProjectKpis } from "@/lib/cross-tower/composeProjects";

export type ExportProjectsExcelInput = {
  projects: AIProjectResolved[];
  assumptions: CrossTowerAssumptions;
  kpis: ProjectKpis;
  generatedAt: string | null;
  redactDollars: boolean;
  filterSummary: {
    towerNames: string[];
    phaseLabels: string[];
  };
  executiveSummary: string | null;
};

function todayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatGeneratedAt(iso: string | null): string {
  if (!iso) return "Not yet available";
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return iso;
  return t.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function quadrantRank(q: Quadrant | null, isStub: boolean): number {
  if (isStub) return 99;
  switch (q) {
    case "Quick Win":
      return 0;
    case "Strategic Bet":
      return 1;
    case "Fill-in":
      return 2;
    case "Deprioritize":
      return 3;
    default:
      return 90;
  }
}

function compareExportOrder(a: AIProjectResolved, b: AIProjectResolved): number {
  const qa = quadrantRank(a.quadrant, a.isStub);
  const qb = quadrantRank(b.quadrant, b.isStub);
  if (qa !== qb) return qa - qb;
  if (a.startMonth !== b.startMonth) return a.startMonth - b.startMonth;
  const usd = b.attributedAiUsd - a.attributedAiUsd;
  if (Math.abs(usd) > 1) return usd;
  return a.name.localeCompare(b.name);
}

function projectStatus(p: AIProjectResolved): string {
  if (p.isStub) return "Stub";
  if (p.isDeprioritized) return "Deprioritized";
  return "Active";
}

function setSheetColWidths(ws: WorkSheet, widths: { wch: number }[]): void {
  ws["!cols"] = widths;
}

/** Apply Excel currency format to numeric cells under the given header label. */
function applyCurrencyToColumnSync(
  ws: WorkSheet,
  XLSX: typeof import("xlsx"),
  headerName: string,
): void {
  const ref = ws["!ref"];
  if (!ref) return;
  const range = XLSX.utils.decode_range(ref);
  let colIdx = -1;
  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    const cell = ws[addr];
    if (cell && String(cell.v) === headerName) {
      colIdx = c;
      break;
    }
  }
  if (colIdx < 0) return;
  for (let r = 1; r <= range.e.r; r++) {
    const addr = XLSX.utils.encode_cell({ r, c: colIdx });
    const cell = ws[addr];
    if (cell && typeof cell.v === "number") {
      cell.t = "n";
      cell.z = "$#,##0";
    }
  }
}

/**
 * One row per AI Solution. No "Project Details" or "Constituent
 * Activities" sheets — the cross-tower view doesn't realize a 4-lens
 * brief; per-solution detail lives on the deep-dive page (the
 * `Deep-dive URL` column carries the link).
 */
const SOLUTION_HEADERS = [
  "Solution",
  "Primary Tower",
  "Job Family (L3)",
  "Tagline",
  "Why AI now",
  "Feasibility",
  "Primary Vendor",
  "Quadrant",
  "Status",
  "Start Month",
  "Build Months",
  "Value Start Month",
  "Ramp Months",
  "Full-Scale Month",
  "$ at Scale (USD)",
  "Deep-dive URL",
] as const;

/**
 * Builds a multi-sheet .xlsx of the cross-tower plan (filtered AI
 * Solutions) and triggers a browser download. Loads `xlsx` dynamically
 * to keep the initial page bundle small.
 */
export async function exportProjectsToExcel(
  input: ExportProjectsExcelInput,
): Promise<void> {
  const XLSX = await import("xlsx");
  const {
    projects,
    assumptions,
    kpis,
    generatedAt,
    redactDollars,
    filterSummary,
    executiveSummary,
  } = input;

  const sorted = [...projects].sort(compareExportOrder);

  const planRows = sorted.map((p) => {
    const fullScaleMonth = p.valueStartMonth + p.rampMonths;
    return {
      Solution: p.name,
      "Primary Tower": p.primaryTowerName,
      "Job Family (L3)": p.l3FamilyName ?? p.parentL4ActivityGroupName ?? "",
      Tagline: p.tagline ?? "",
      "Why AI now": p.aiRationale ?? p.narrative,
      Feasibility: p.feasibility ?? "",
      "Primary Vendor": p.primaryVendor ?? "",
      Quadrant: p.quadrant ?? "",
      Status: projectStatus(p),
      "Start Month": p.startMonth,
      "Build Months": p.buildMonths,
      "Value Start Month": p.valueStartMonth,
      "Ramp Months": p.rampMonths,
      "Full-Scale Month": fullScaleMonth,
      "$ at Scale (USD)": redactDollars ? null : p.attributedAiUsd,
      "Deep-dive URL": p.deepDiveHref ?? "",
    };
  });

  const towerLine =
    filterSummary.towerNames.length > 0
      ? filterSummary.towerNames.join("; ")
      : "All towers (no filter)";
  const phaseLine =
    filterSummary.phaseLabels.length > 0
      ? filterSummary.phaseLabels.join("; ")
      : "All phases (no filter)";

  const coverAoa: (string | number)[][] = [
    ["Versant Forge — Cross-Tower AI Plan (AI Solutions)"],
    [],
    ["Executive summary (full plan)", executiveSummary ?? "—"],
    [],
    ["Plan generated at", formatGeneratedAt(generatedAt)],
    [
      "Exported at",
      new Date().toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    ],
    [],
    ["Active view filters"],
    ["Towers", towerLine],
    ["Phases", phaseLine],
    [],
    ["Totals (current filtered view)"],
    ["AI Solutions (all rows)", kpis.totalProjects],
    ["Live solutions", kpis.liveProjects],
    ["Stub solutions", kpis.stubProjects],
    ["Deprioritized solutions", kpis.deprioritizedProjects],
    [
      "Total modeled $ at full scale (live)",
      redactDollars ? "" : kpis.liveAttributedAiUsd,
    ],
    [],
    ["Assumptions snapshot"],
    ["Program start month (M1 anchor)", assumptions.programStartMonth],
    ["Adoption ramp (months)", assumptions.rampMonths],
    [
      "P1 phase start / build (months)",
      `M${assumptions.p1PhaseStartMonth} / ${assumptions.p1BuildMonths}`,
    ],
    [
      "P2 phase start / build (months)",
      `M${assumptions.p2PhaseStartMonth} / ${assumptions.p2BuildMonths}`,
    ],
    [
      "P3 phase start / build (months)",
      `M${assumptions.p3PhaseStartMonth} / ${assumptions.p3BuildMonths}`,
    ],
    [],
  ];
  if (redactDollars) {
    coverAoa.push([
      "Dollar values are redacted in this export — numeric $ columns are left blank.",
    ]);
  }

  const wb = XLSX.utils.book_new();

  const wsCover = XLSX.utils.aoa_to_sheet(coverAoa);
  setSheetColWidths(wsCover, [{ wch: 42 }, { wch: 72 }]);
  XLSX.utils.book_append_sheet(wb, wsCover, "Cover");

  const wsPlan = XLSX.utils.json_to_sheet(planRows, {
    header: [...SOLUTION_HEADERS],
  });
  setSheetColWidths(wsPlan, [
    { wch: 36 },
    { wch: 22 },
    { wch: 30 },
    { wch: 44 },
    { wch: 64 },
    { wch: 14 },
    { wch: 22 },
    { wch: 16 },
    { wch: 14 },
    { wch: 11 },
    { wch: 11 },
    { wch: 16 },
    { wch: 11 },
    { wch: 16 },
    { wch: 16 },
    { wch: 60 },
  ]);
  applyCurrencyToColumnSync(wsPlan, XLSX, "$ at Scale (USD)");
  XLSX.utils.book_append_sheet(wb, wsPlan, "AI Solutions");

  const filename = `versant-cross-tower-ai-solutions-${todayYmd()}.xlsx`;
  XLSX.writeFile(wb, filename);
}
