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

const PLAN_HEADERS = [
  "Project",
  "Primary Tower",
  "L4 Activity Group",
  "Quadrant",
  "Status",
  "Value Bucket",
  "Effort Bucket",
  "Start Month",
  "Build Months",
  "Value Start Month",
  "Ramp Months",
  "Full-Scale Month",
  "$ at Scale (USD)",
  "Integration Count",
  "Agent Count",
  "Platform Count",
  "Complexity",
  "Proven Elsewhere",
] as const;

const DETAIL_HEADERS = [
  "Project",
  "Primary Tower",
  "Quadrant",
  "Narrative",
  "Framing",
  "Current Pain Points",
  "Value Rationale",
  "Effort Rationale",
  "Agents",
  "Orchestration",
  "Integrations",
  "Required Platforms",
  "Data Requirements",
] as const;

const CONSTITUENT_HEADERS = [
  "Project",
  "L5 Activity Name",
  "Tower",
  "L3 Job Family",
  "Program Tier",
  "L5 Inclusion Rationale",
  "Attributed $ (USD)",
] as const;

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
 * Builds a multi-sheet .xlsx of the cross-tower plan (filtered projects) and
 * triggers a browser download. Loads `xlsx` dynamically to keep the initial
 * page bundle small.
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
    const ed = p.effortDrivers;
    return {
      Project: p.name,
      "Primary Tower": p.primaryTowerName,
      "L4 Activity Group": p.parentL4ActivityGroupName,
      Quadrant: p.quadrant ?? "",
      Status: projectStatus(p),
      "Value Bucket": p.valueBucket ?? "",
      "Effort Bucket": p.effortBucket ?? "",
      "Start Month": p.startMonth,
      "Build Months": p.buildMonths,
      "Value Start Month": p.valueStartMonth,
      "Ramp Months": p.rampMonths,
      "Full-Scale Month": fullScaleMonth,
      "$ at Scale (USD)": redactDollars ? null : p.attributedAiUsd,
      "Integration Count": ed?.integrationCount ?? "",
      "Agent Count": ed?.agentCount ?? "",
      "Platform Count": ed?.platformCount ?? "",
      Complexity: ed?.complexity ?? "",
      "Proven Elsewhere":
        ed == null ? "" : ed.provenElsewhere ? "Yes" : "No",
    };
  });

  const detailRows: Record<(typeof DETAIL_HEADERS)[number], string>[] = [];
  for (const p of sorted) {
    if (p.isStub || !p.brief) continue;
    const b = p.brief;
    detailRows.push({
      Project: p.name,
      "Primary Tower": p.primaryTowerName,
      Quadrant: p.quadrant ?? "",
      Narrative: p.narrative,
      Framing: b.framing,
      "Current Pain Points": b.currentPainPoints.join("; "),
      "Value Rationale": p.valueRationale,
      "Effort Rationale": p.effortRationale,
      Agents: b.agents.map((a) => a.name).join("; "),
      Orchestration: `${b.agentOrchestration.pattern} — ${b.agentOrchestration.description}`,
      Integrations: b.digitalCore.integrations.join("; "),
      "Required Platforms": b.digitalCore.requiredPlatforms
        .map((pr) => pr.platform)
        .join("; "),
      "Data Requirements": b.digitalCore.dataRequirements.join("; "),
    });
  }

  type ConstRow = Record<(typeof CONSTITUENT_HEADERS)[number], string | number | null>;
  const constituentRows: ConstRow[] = [];
  for (const p of sorted) {
    const rationaleById = new Map(
      p.perInitiativeRationale.map((r) => [r.initiativeId, r.rationale]),
    );
    for (const row of p.constituents) {
      const rationale =
        rationaleById.get(row.id) ?? row.aiRationale ?? "";
      constituentRows.push({
        Project: p.name,
        "L5 Activity Name": row.name,
        Tower: row.towerName,
        "L3 Job Family": row.l3Name,
        "Program Tier": row.programTier,
        "L5 Inclusion Rationale": rationale,
        "Attributed $ (USD)": redactDollars ? null : row.attributedAiUsd,
      });
    }
  }

  const towerLine =
    filterSummary.towerNames.length > 0
      ? filterSummary.towerNames.join("; ")
      : "All towers (no filter)";
  const phaseLine =
    filterSummary.phaseLabels.length > 0
      ? filterSummary.phaseLabels.join("; ")
      : "All phases (no filter)";

  const coverAoa: (string | number)[][] = [
    ["Versant Forge — Cross-Tower AI Plan"],
    [],
    ["Executive summary (full plan)", executiveSummary ?? "—"],
    [],
    ["Plan generated at", formatGeneratedAt(generatedAt)],
    ["Exported at", new Date().toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })],
    [],
    ["Active view filters"],
    ["Towers", towerLine],
    ["Phases", phaseLine],
    [],
    ["Totals (current filtered view)"],
    ["Projects (all rows)", kpis.totalProjects],
    ["Live projects", kpis.liveProjects],
    ["Stub projects", kpis.stubProjects],
    ["Deprioritized projects", kpis.deprioritizedProjects],
    [
      "Total modeled $ at full scale (live projects)",
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
    header: [...PLAN_HEADERS],
  });
  setSheetColWidths(wsPlan, [
    { wch: 36 },
    { wch: 22 },
    { wch: 36 },
    { wch: 16 },
    { wch: 14 },
    { wch: 12 },
    { wch: 12 },
    { wch: 11 },
    { wch: 11 },
    { wch: 16 },
    { wch: 11 },
    { wch: 16 },
    { wch: 16 },
    { wch: 14 },
    { wch: 11 },
    { wch: 12 },
    { wch: 12 },
    { wch: 14 },
  ]);
  applyCurrencyToColumnSync(wsPlan, XLSX, "$ at Scale (USD)");
  XLSX.utils.book_append_sheet(wb, wsPlan, "Project Plan");

  const wsDetails = XLSX.utils.json_to_sheet(detailRows, {
    header: [...DETAIL_HEADERS],
  });
  setSheetColWidths(wsDetails, [
    { wch: 32 },
    { wch: 20 },
    { wch: 16 },
    { wch: 56 },
    { wch: 44 },
    { wch: 48 },
    { wch: 40 },
    { wch: 40 },
    { wch: 40 },
    { wch: 44 },
    { wch: 40 },
    { wch: 36 },
    { wch: 40 },
  ]);
  XLSX.utils.book_append_sheet(wb, wsDetails, "Project Details");

  const wsConst = XLSX.utils.json_to_sheet(constituentRows, {
    header: [...CONSTITUENT_HEADERS],
  });
  setSheetColWidths(wsConst, [
    { wch: 32 },
    { wch: 40 },
    { wch: 20 },
    { wch: 28 },
    { wch: 16 },
    { wch: 48 },
    { wch: 18 },
  ]);
  applyCurrencyToColumnSync(wsConst, XLSX, "Attributed $ (USD)");
  XLSX.utils.book_append_sheet(wb, wsConst, "Constituent Activities");

  const filename = `versant-cross-tower-ai-plan-${todayYmd()}.xlsx`;
  XLSX.writeFile(wb, filename);
}
