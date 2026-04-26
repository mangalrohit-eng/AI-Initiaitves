import type {
  AssessProgramV2,
  GlobalAssessAssumptions,
  L4WorkforceRow,
  TowerId,
} from "@/data/assess/types";
import { defaultGlobalAssessAssumptions, defaultTowerBaseline, defaultTowerState } from "@/data/assess/types";
import { towers } from "@/data/towers";

export const ASSESS_PROGRAM_FILE_FORMAT = "forge-assess-program-v2" as const;

export type AssessProgramFileEnvelope = {
  format: typeof ASSESS_PROGRAM_FILE_FORMAT;
  /** ISO timestamp when the file was written. */
  exportedAt: string;
  /** App name for humans opening the file later. */
  app: "forge-tower-explorer";
  program: AssessProgramV2;
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === "object" && !Array.isArray(x);
}

function isTowerId(s: string): s is TowerId {
  return towers.some((t) => t.id === s);
}

function coalesceNumber(x: unknown, d: number): number {
  if (typeof x === "number" && Number.isFinite(x)) return x;
  if (typeof x === "string" && x.trim() !== "" && Number.isFinite(Number(x))) return Number(x);
  return d;
}

function asL4Row(x: unknown): L4WorkforceRow | null {
  if (!isRecord(x)) return null;
  const id = x.id;
  const l2 = x.l2;
  const l3 = x.l3;
  const l4 = x.l4;
  if (typeof l2 !== "string" || typeof l3 !== "string" || typeof l4 !== "string") return null;
  const clamp01 = (v: number) => Math.min(100, Math.max(0, v));
  return {
    id: typeof id === "string" ? id : `l4-${l2.slice(0, 12)}-${l4.slice(0, 12)}`,
    l2,
    l3,
    l4,
    fteOnshore: coalesceNumber(x.fteOnshore, 0),
    fteOffshore: coalesceNumber(x.fteOffshore, 0),
    contractorOnshore: coalesceNumber(x.contractorOnshore, 0),
    contractorOffshore: coalesceNumber(x.contractorOffshore, 0),
    annualSpendUsd: (() => {
      const n = coalesceNumber(x.annualSpendUsd, NaN);
      return Number.isFinite(n) && n > 0 ? n : undefined;
    })(),
    l4OffshoreAssessmentPct: (() => {
      const raw = x.l4OffshoreAssessmentPct ?? x["l4_offshoring_assessment"];
      if (raw === undefined) return undefined;
      const n = coalesceNumber(raw, NaN);
      return Number.isFinite(n) ? clamp01(n) : undefined;
    })(),
    l4AiImpactAssessmentPct: (() => {
      const raw = x.l4AiImpactAssessmentPct ?? x["l4_ai_impact_assessment"];
      if (raw === undefined) return undefined;
      const n = coalesceNumber(raw, NaN);
      return Number.isFinite(n) ? clamp01(n) : undefined;
    })(),
  };
}

function parseGlobal(x: unknown): GlobalAssessAssumptions {
  if (!isRecord(x)) return { ...defaultGlobalAssessAssumptions };
  const d = defaultGlobalAssessAssumptions;
  return {
    blendedFteOnshore: coalesceNumber(x.blendedFteOnshore, d.blendedFteOnshore),
    blendedFteOffshore: coalesceNumber(x.blendedFteOffshore, d.blendedFteOffshore),
    blendedContractorOnshore: coalesceNumber(x.blendedContractorOnshore, d.blendedContractorOnshore),
    blendedContractorOffshore: coalesceNumber(x.blendedContractorOffshore, d.blendedContractorOffshore),
    offshoreLeverWeight: coalesceNumber(x.offshoreLeverWeight, d.offshoreLeverWeight),
    aiLeverWeight: coalesceNumber(x.aiLeverWeight, d.aiLeverWeight),
    combineMode: x.combineMode === "additive" || x.combineMode === "capped" ? x.combineMode : d.combineMode,
    combinedCapPct: coalesceNumber(x.combinedCapPct, d.combinedCapPct),
  };
}

/** Parses and normalizes; returns an error string on failure. */
export function importAssessProgramFromJsonText(
  text: string,
):
  | { ok: true; program: AssessProgramV2 }
  | { ok: false; error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    return { ok: false, error: "File is not valid JSON." };
  }
  if (!isRecord(raw)) {
    return { ok: false, error: "Root value must be a JSON object." };
  }

  let programRaw: unknown;
  if (raw.format === ASSESS_PROGRAM_FILE_FORMAT) {
    if (!isRecord(raw.program) || raw.program.version !== 2) {
      return { ok: false, error: "Invalid export: missing or wrong program.version." };
    }
    programRaw = raw.program;
  } else if (raw.version === 2) {
    programRaw = raw;
  } else {
    return { ok: false, error: "Unrecognized file: use a Forge export (.json) or program version 2." };
  }

  if (!isRecord(programRaw)) {
    return { ok: false, error: "Program payload is not an object." };
  }
  if (programRaw.version !== 2) {
    return { ok: false, error: `Unsupported program version: ${String(programRaw.version)}.` };
  }

  const program: AssessProgramV2 = {
    version: 2,
    global: parseGlobal(programRaw.global),
    scenarios: {},
    towers: {},
  };

  const towersObj = programRaw.towers;
  if (towersObj !== null && isRecord(towersObj)) {
    for (const [k, v] of Object.entries(towersObj)) {
      if (!isTowerId(k) || !isRecord(v)) continue;
      const base = defaultTowerState();
      const l4Rows: L4WorkforceRow[] = Array.isArray(v.l4Rows)
        ? (v.l4Rows.map((r) => asL4Row(r)).filter(Boolean) as L4WorkforceRow[])
        : base.l4Rows;
      const bRaw = isRecord(v.baseline) ? { ...defaultTowerBaseline, ...v.baseline } : defaultTowerBaseline;
      const st = v.status;
      const status = st === "empty" || st === "data" || st === "complete" ? st : base.status;
      program.towers[k] = {
        l4Rows: l4Rows as typeof base.l4Rows,
        baseline: {
          baselineOffshorePct: coalesceNumber(
            bRaw.baselineOffshorePct,
            defaultTowerBaseline.baselineOffshorePct,
          ),
          baselineAIPct: coalesceNumber(bRaw.baselineAIPct, defaultTowerBaseline.baselineAIPct),
        },
        status,
        lastUpdated: typeof v.lastUpdated === "string" ? v.lastUpdated : base.lastUpdated,
      };
    }
  }

  const sc = programRaw.scenarios;
  if (isRecord(sc)) {
    for (const [k, v] of Object.entries(sc)) {
      if (!isTowerId(k) || !isRecord(v)) continue;
      program.scenarios[k] = {
        scenarioOffshorePct: coalesceNumber(v.scenarioOffshorePct, 0),
        scenarioAIPct: coalesceNumber(v.scenarioAIPct, 0),
      };
    }
  }

  return { ok: true, program };
}

export function exportAssessProgramToEnvelope(
  program: AssessProgramV2,
): AssessProgramFileEnvelope {
  return {
    format: ASSESS_PROGRAM_FILE_FORMAT,
    exportedAt: new Date().toISOString(),
    app: "forge-tower-explorer",
    program,
  };
}

export function serializeAssessProgramForDownload(program: AssessProgramV2): string {
  return JSON.stringify(exportAssessProgramToEnvelope(program), null, 2);
}

export async function readAssessProgramFile(file: File): Promise<
  { ok: true; program: AssessProgramV2 } | { ok: false; error: string }
> {
  const text = await file.text();
  return importAssessProgramFromJsonText(text);
}
