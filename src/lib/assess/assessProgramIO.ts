import type {
  AssessProgramV2,
  GlobalAssessAssumptions,
  L3WorkforceRow,
  TowerId,
} from "@/data/assess/types";
import { defaultGlobalAssessAssumptions, defaultTowerBaseline, defaultTowerState } from "@/data/assess/types";
import { towers } from "@/data/towers";
import { groupL4RowsToL3RowsForImport } from "@/lib/localStore";

export const ASSESS_PROGRAM_FILE_FORMAT = "forge-assess-program-v4" as const;
const SUPPORTED_PROGRAM_VERSIONS: ReadonlyArray<number> = [2, 3, 4];

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

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24) || "x"
  );
}

function asL3Row(x: unknown): L3WorkforceRow | null {
  if (!isRecord(x)) return null;
  const id = x.id;
  const l2 = x.l2;
  const l3 = x.l3;
  if (typeof l2 !== "string" || typeof l3 !== "string") return null;
  const clamp01 = (v: number) => Math.min(100, Math.max(0, v));
  const out: L3WorkforceRow = {
    id: typeof id === "string" && id ? id : `${slugify(l2)}::${slugify(l3)}`,
    l2,
    l3,
    fteOnshore: coalesceNumber(x.fteOnshore, 0),
    fteOffshore: coalesceNumber(x.fteOffshore, 0),
    contractorOnshore: coalesceNumber(x.contractorOnshore, 0),
    contractorOffshore: coalesceNumber(x.contractorOffshore, 0),
  };
  const sp = (() => {
    const n = coalesceNumber(x.annualSpendUsd, NaN);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  })();
  if (sp != null) out.annualSpendUsd = sp;
  const off = (() => {
    const raw = x.offshoreAssessmentPct;
    if (raw === undefined) return undefined;
    const n = coalesceNumber(raw, NaN);
    return Number.isFinite(n) ? clamp01(n) : undefined;
  })();
  if (off != null) out.offshoreAssessmentPct = off;
  const ai = (() => {
    const raw = x.aiImpactAssessmentPct;
    if (raw === undefined) return undefined;
    const n = coalesceNumber(raw, NaN);
    return Number.isFinite(n) ? clamp01(n) : undefined;
  })();
  if (ai != null) out.aiImpactAssessmentPct = ai;
  if (Array.isArray(x.l4Activities)) {
    const names = (x.l4Activities as unknown[])
      .filter((n): n is string => typeof n === "string" && n.trim().length > 0)
      .map((n) => n.trim());
    if (names.length > 0) out.l4Activities = names;
  }
  return out;
}

/**
 * Coalesce the global assumptions blob, ignoring fields that no longer exist
 * (offshoreLeverWeight, aiLeverWeight, combineMode, combinedCapPct from v2).
 * v2 / v3 exports load cleanly — the obsolete fields are silently dropped.
 */
function parseGlobal(x: unknown): GlobalAssessAssumptions {
  if (!isRecord(x)) return { ...defaultGlobalAssessAssumptions };
  const d = defaultGlobalAssessAssumptions;
  return {
    blendedFteOnshore: coalesceNumber(x.blendedFteOnshore, d.blendedFteOnshore),
    blendedFteOffshore: coalesceNumber(x.blendedFteOffshore, d.blendedFteOffshore),
    blendedContractorOnshore: coalesceNumber(x.blendedContractorOnshore, d.blendedContractorOnshore),
    blendedContractorOffshore: coalesceNumber(x.blendedContractorOffshore, d.blendedContractorOffshore),
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
  if (
    raw.format === ASSESS_PROGRAM_FILE_FORMAT ||
    raw.format === "forge-assess-program-v3" ||
    raw.format === "forge-assess-program-v2"
  ) {
    if (
      !isRecord(raw.program) ||
      typeof raw.program.version !== "number" ||
      !SUPPORTED_PROGRAM_VERSIONS.includes(raw.program.version)
    ) {
      return { ok: false, error: "Invalid export: missing or wrong program.version." };
    }
    programRaw = raw.program;
  } else if (
    typeof raw.version === "number" &&
    SUPPORTED_PROGRAM_VERSIONS.includes(raw.version)
  ) {
    programRaw = raw;
  } else {
    return {
      ok: false,
      error:
        "Unrecognized file: use a Forge export (.json) with program version 2, 3, or 4.",
    };
  }

  if (!isRecord(programRaw)) {
    return { ok: false, error: "Program payload is not an object." };
  }
  if (
    typeof programRaw.version !== "number" ||
    !SUPPORTED_PROGRAM_VERSIONS.includes(programRaw.version)
  ) {
    return { ok: false, error: `Unsupported program version: ${String(programRaw.version)}.` };
  }

  const inputVersion = programRaw.version;

  const program: AssessProgramV2 = {
    version: 4,
    global: parseGlobal(programRaw.global),
    towers: {},
  };

  const towersObj = programRaw.towers;
  if (towersObj !== null && isRecord(towersObj)) {
    for (const [k, v] of Object.entries(towersObj)) {
      if (!isTowerId(k) || !isRecord(v)) continue;
      const base = defaultTowerState();
      let l3Rows: L3WorkforceRow[];
      if (inputVersion >= 4 && Array.isArray(v.l3Rows)) {
        l3Rows = (v.l3Rows.map((r) => asL3Row(r)).filter(Boolean) as L3WorkforceRow[]);
      } else if (Array.isArray(v.l4Rows)) {
        l3Rows = groupL4RowsToL3RowsForImport(v.l4Rows as unknown[]);
      } else {
        l3Rows = base.l3Rows;
      }
      const bRaw = isRecord(v.baseline) ? { ...defaultTowerBaseline, ...v.baseline } : defaultTowerBaseline;
      const st = v.status;
      const status = st === "empty" || st === "data" || st === "complete" ? st : base.status;
      program.towers[k] = {
        l3Rows,
        baseline: {
          baselineOffshorePct: coalesceNumber(
            bRaw.baselineOffshorePct,
            defaultTowerBaseline.baselineOffshorePct,
          ),
          baselineAIPct: coalesceNumber(bRaw.baselineAIPct, defaultTowerBaseline.baselineAIPct),
        },
        status,
        lastUpdated: typeof v.lastUpdated === "string" ? v.lastUpdated : base.lastUpdated,
        capabilityMapConfirmedAt:
          typeof v.capabilityMapConfirmedAt === "string"
            ? v.capabilityMapConfirmedAt
            : undefined,
        headcountConfirmedAt:
          typeof v.headcountConfirmedAt === "string" ? v.headcountConfirmedAt : undefined,
        offshoreConfirmedAt:
          typeof v.offshoreConfirmedAt === "string" ? v.offshoreConfirmedAt : undefined,
        aiConfirmedAt:
          typeof v.aiConfirmedAt === "string" ? v.aiConfirmedAt : undefined,
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
