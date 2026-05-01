import type {
  AssessProgramV2,
  GlobalAssessAssumptions,
  L4WorkforceRow,
  TowerId,
} from "@/data/assess/types";
import { mergeLeadDeadlines, parseLeadDeadlines } from "@/lib/program/leadDeadlines";
import { defaultGlobalAssessAssumptions, defaultTowerBaseline, defaultTowerState } from "@/data/assess/types";
import { getTowerFunctionName } from "@/data/towerFunctionNames";
import { towers } from "@/data/towers";
import { coerceInitiativeReviews, groupL4RowsToL3RowsForImport } from "@/lib/localStore";

export const ASSESS_PROGRAM_FILE_FORMAT = "forge-assess-program-v5" as const;
const SUPPORTED_PROGRAM_VERSIONS: ReadonlyArray<number> = [2, 3, 4, 5];

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

function asL4Row(x: unknown, towerId: TowerId): L4WorkforceRow | null {
  if (!isRecord(x)) return null;
  const id = x.id;
  // V5 input: rows already carry `l2` (Job Grouping) + `l3` (Job Family) +
  // `l4` (Activity Group). V4 input: rows have `l2` (old Pillar) + `l3`
  // (old Capability) only — we shift those one level deeper (file's `l2` →
  // new `l3`, file's `l3` → new `l4`) and stamp the new `l2` Job Grouping
  // with the tower's L1 Function name.
  const fileL2 = typeof x.l2 === "string" ? x.l2 : "";
  const fileL3 = typeof x.l3 === "string" ? x.l3 : "";
  const fileL4 = typeof x.l4 === "string" ? x.l4 : "";
  const isV5 = !!fileL4.trim();
  const l2 = isV5 ? fileL2 : getTowerFunctionName(towerId);
  const l3 = isV5 ? fileL3 : fileL2;
  const l4 = isV5 ? fileL4 : fileL3;
  if (!l3.trim() || !l4.trim()) return null;
  const clamp01 = (v: number) => Math.min(100, Math.max(0, v));
  const out: L4WorkforceRow = {
    id: typeof id === "string" && id ? id : `${slugify(l3)}::${slugify(l4)}`,
    l2,
    l3,
    l4,
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
  // V5 prefers `l5Activities`; V4 wrote `l4Activities`. Accept either so
  // older Postgres rows + JSON exports still hydrate cleanly.
  const rawActivities = Array.isArray(x.l5Activities)
    ? x.l5Activities
    : Array.isArray(x.l4Activities)
      ? x.l4Activities
      : null;
  if (rawActivities) {
    const names = (rawActivities as unknown[])
      .filter((n): n is string => typeof n === "string" && n.trim().length > 0)
      .map((n) => n.trim());
    if (names.length > 0) out.l5Activities = names;
  }

  // ----- API / export round-trip (must mirror `migrateAssessProgram` in
  // `localStore.ts`) — Postgres GET → `importAssessProgramFromJsonText` must
  // preserve pipeline + staleness fields or Step 4 loses `queued` on every
  // reload and the StaleCurationBanner never fires after upload.
  const rawItems = Array.isArray(x.l5Items)
    ? x.l5Items
    : Array.isArray(x.l4Items)
      ? x.l4Items
      : null;
  if (rawItems) {
    out.l5Items = rawItems as L4WorkforceRow["l5Items"];
  }
  if (typeof x.curationContentHash === "string") {
    out.curationContentHash = x.curationContentHash;
  }
  // Accept both the new `running-l5` and the legacy `running-l4`
  // curationStage so V4 snapshots replay without losing pipeline state.
  if (
    x.curationStage === "idle" ||
    x.curationStage === "queued" ||
    x.curationStage === "running-l4" ||
    x.curationStage === "running-l5" ||
    x.curationStage === "running-verdict" ||
    x.curationStage === "running-curate" ||
    x.curationStage === "done" ||
    x.curationStage === "failed"
  ) {
    out.curationStage =
      x.curationStage === "running-l4" ? "running-l5" : x.curationStage;
  }
  if (typeof x.curationGeneratedAt === "string") {
    out.curationGeneratedAt = x.curationGeneratedAt;
  }
  if (typeof x.curationError === "string") {
    out.curationError = x.curationError;
  }
  if (typeof x.offshoreRationale === "string" && x.offshoreRationale.trim()) {
    out.offshoreRationale = x.offshoreRationale.trim();
  }
  if (typeof x.aiImpactRationale === "string" && x.aiImpactRationale.trim()) {
    out.aiImpactRationale = x.aiImpactRationale.trim();
  }
  if (
    x.dialsRationaleSource === "llm" ||
    x.dialsRationaleSource === "heuristic" ||
    x.dialsRationaleSource === "starter"
  ) {
    out.dialsRationaleSource = x.dialsRationaleSource;
  }
  if (typeof x.dialsRationaleAt === "string") {
    out.dialsRationaleAt = x.dialsRationaleAt;
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
  options?: { mergeLeadDeadlinesFrom?: AssessProgramV2 },
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
        "Unrecognized file: use a Forge export (.json) with program version 2, 3, 4, or 5.",
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
    version: 5,
    global: parseGlobal(programRaw.global),
    towers: {},
  };

  const towersObj = programRaw.towers;
  if (towersObj !== null && isRecord(towersObj)) {
    for (const [k, v] of Object.entries(towersObj)) {
      if (!isTowerId(k) || !isRecord(v)) continue;
      const base = defaultTowerState();
      // V5 stores rows under `l4Rows`; V4 used `l3Rows`; V2/V3 used the
      // pre-collapse `l4Rows` (per-L4-Activity granularity). All three
      // shapes round-trip through `asL4Row` / `groupL4RowsToL3RowsForImport`
      // (the latter is the legacy regrouper, which now emits L4 rows
      // stamped with the tower's L1 Function name as the new L2).
      let l4Rows: L4WorkforceRow[];
      if (inputVersion >= 5 && Array.isArray(v.l4Rows)) {
        l4Rows = v.l4Rows
          .map((r) => asL4Row(r, k))
          .filter(Boolean) as L4WorkforceRow[];
      } else if (inputVersion >= 4 && Array.isArray(v.l3Rows)) {
        l4Rows = v.l3Rows
          .map((r) => asL4Row(r, k))
          .filter(Boolean) as L4WorkforceRow[];
      } else if (Array.isArray(v.l4Rows)) {
        // Legacy V2/V3 shape: per-L4 rows that need regrouping. The grouper
        // emits L4WorkforceRow with the L1 Function name stamped into l2.
        l4Rows = groupL4RowsToL3RowsForImport(v.l4Rows as unknown[], k);
      } else {
        l4Rows = base.l4Rows;
      }
      const bRaw = isRecord(v.baseline) ? { ...defaultTowerBaseline, ...v.baseline } : defaultTowerBaseline;
      const st = v.status;
      const status = st === "empty" || st === "data" || st === "complete" ? st : base.status;
      // Tower-lead validate/reject decisions on AI initiatives. Strictly
      // additive — older exports have no entries and every L4 reads as
      // "pending". Round-trip preserved here so the API GET/PUT pipeline
      // doesn't silently strip the field on the way to / from Postgres.
      const reviews = coerceInitiativeReviews(v.initiativeReviews);

      program.towers[k] = {
        l4Rows,
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
        // 5-layer migration: v5 writes `l1L5TreeValidatedAt`; older v4
        // snapshots wrote `l1L3TreeValidatedAt`. Carry whichever lands so
        // the lock state survives the round-trip.
        l1L5TreeValidatedAt:
          typeof v.l1L5TreeValidatedAt === "string"
            ? v.l1L5TreeValidatedAt
            : typeof v.l1L3TreeValidatedAt === "string"
              ? v.l1L3TreeValidatedAt
              : undefined,
        headcountConfirmedAt:
          typeof v.headcountConfirmedAt === "string" ? v.headcountConfirmedAt : undefined,
        offshoreConfirmedAt:
          typeof v.offshoreConfirmedAt === "string" ? v.offshoreConfirmedAt : undefined,
        aiConfirmedAt:
          typeof v.aiConfirmedAt === "string" ? v.aiConfirmedAt : undefined,
        impactEstimateValidatedAt:
          typeof v.impactEstimateValidatedAt === "string"
            ? v.impactEstimateValidatedAt
            : undefined,
        aiInitiativesValidatedAt:
          typeof v.aiInitiativesValidatedAt === "string"
            ? v.aiInitiativesValidatedAt
            : undefined,
        ...(reviews ? { initiativeReviews: reviews } : {}),
      };
    }
  }

  if (isRecord(programRaw) && Object.prototype.hasOwnProperty.call(programRaw, "leadDeadlines")) {
    const parsed = parseLeadDeadlines(programRaw.leadDeadlines);
    const base = options?.mergeLeadDeadlinesFrom?.leadDeadlines;
    program.leadDeadlines = mergeLeadDeadlines(base, parsed ?? undefined);
  } else if (options?.mergeLeadDeadlinesFrom?.leadDeadlines) {
    program.leadDeadlines = options.mergeLeadDeadlinesFrom.leadDeadlines;
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

export async function readAssessProgramFile(
  file: File,
  options?: { mergeLeadDeadlinesFrom?: AssessProgramV2 },
): Promise<{ ok: true; program: AssessProgramV2 } | { ok: false; error: string }> {
  const text = await file.text();
  return importAssessProgramFromJsonText(text, options);
}
