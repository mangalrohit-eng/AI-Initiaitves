import type {
  AssessProgramV2,
  L3WorkforceRowV6,
  L4WorkforceRow,
  TowerId,
  TowerRates,
} from "@/data/assess/types";
import { mergeLeadDeadlines, parseLeadDeadlines } from "@/lib/program/leadDeadlines";
import {
  buildDefaultProgramLeadDeadlines,
  defaultTowerBaseline,
  defaultTowerRates,
  defaultTowerState,
} from "@/data/assess/types";
import { towers } from "@/data/towers";
import { coerceInitiativeReviews } from "@/lib/localStore";
import { parseAiReadinessIntakeFromUnknown } from "@/lib/assess/towerReadinessIntake";
import { deriveL3Rows } from "@/lib/assess/deriveL3Rows";

/**
 * Envelope label for newly written backups. We accept reading older labels
 * (`-v5`, `-v3`, `-v2`) since legitimate v6 program backups exist with the
 * older `-v5` envelope label from before the v5 schema retirement, but the
 * inner `program.version` MUST be 6.
 */
export const ASSESS_PROGRAM_FILE_FORMAT = "forge-assess-program-v6" as const;
const SUPPORTED_PROGRAM_VERSIONS: ReadonlyArray<number> = [6];
const ACCEPTED_ENVELOPE_LABELS: ReadonlySet<string> = new Set([
  "forge-assess-program-v6",
  "forge-assess-program-v5",
]);

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

function asL4Row(x: unknown): L4WorkforceRow | null {
  if (!isRecord(x)) return null;
  const id = x.id;
  // v6 input: rows carry `l2` (Job Grouping), `l3` (Job Family), and `l4`
  // (Activity Group) explicitly. Rows missing l3 or l4 are malformed and
  // dropped.
  const l2 = typeof x.l2 === "string" ? x.l2 : "";
  const l3 = typeof x.l3 === "string" ? x.l3 : "";
  const l4 = typeof x.l4 === "string" ? x.l4 : "";
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
  // v6 writes `l5Activities`. Older Postgres rows / JSON exports may carry
  // `l4Activities` from the v4 migration window — accept either so the
  // hierarchy renders cleanly during cutover.
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
 * Coalesce a per-tower rates blob, defaulting any missing field to the
 * tower's seeded rate (`defaultTowerRates(towerId)`). Used by the per-tower
 * import loop to populate `TowerAssessState.rates` from JSON exports.
 */
function parseRates(x: unknown, towerId: TowerId): TowerRates {
  const d = defaultTowerRates(towerId);
  if (!isRecord(x)) return d;
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
  if (typeof raw.format === "string" && ACCEPTED_ENVELOPE_LABELS.has(raw.format)) {
    if (
      !isRecord(raw.program) ||
      typeof raw.program.version !== "number" ||
      !SUPPORTED_PROGRAM_VERSIONS.includes(raw.program.version)
    ) {
      return {
        ok: false,
        error:
          "Invalid export: program.version must be 6. Files from before the v6 schema launch are no longer supported — re-export from a current session.",
      };
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
        "Unrecognized file: use a Forge backup (.json) exported from a current v6 session.",
    };
  }

  if (!isRecord(programRaw)) {
    return { ok: false, error: "Program payload is not an object." };
  }
  if (
    typeof programRaw.version !== "number" ||
    !SUPPORTED_PROGRAM_VERSIONS.includes(programRaw.version)
  ) {
    return {
      ok: false,
      error: `Unsupported program version: ${String(programRaw.version)} — only version 6 is accepted.`,
    };
  }

  const program: AssessProgramV2 = {
    version: 6,
    towers: {},
  };

  const towersObj = programRaw.towers;
  if (towersObj !== null && isRecord(towersObj)) {
    for (const [k, v] of Object.entries(towersObj)) {
      if (!isTowerId(k) || !isRecord(v)) continue;
      const base = defaultTowerState(k);
      // v6: rows live under `l4Rows`, carrying explicit l2/l3/l4 names.
      const l4Rows: L4WorkforceRow[] = Array.isArray(v.l4Rows)
        ? (v.l4Rows.map(asL4Row).filter(Boolean) as L4WorkforceRow[])
        : base.l4Rows;
      const bRaw = isRecord(v.baseline) ? { ...defaultTowerBaseline, ...v.baseline } : defaultTowerBaseline;
      const st = v.status;
      const status = st === "empty" || st === "data" || st === "complete" ? st : base.status;
      // Tower-lead validate/reject decisions on AI initiatives. Strictly
      // additive — older exports have no entries and every L4 reads as
      // "pending". Round-trip preserved here so the API GET/PUT pipeline
      // doesn't silently strip the field on the way to / from Postgres.
      const reviews = coerceInitiativeReviews(v.initiativeReviews);
      const aiReadinessIntake = parseAiReadinessIntakeFromUnknown(v.aiReadinessIntake);

      // Per-tower rates: prefer the snapshot's own `rates` blob; otherwise
      // fall back to the tower's seeded defaults.
      const rates: TowerRates = isRecord(v.rates)
        ? parseRates(v.rates, k)
        : defaultTowerRates(k);

      // Preserve persisted L3 rows verbatim from a v6 import. The defensive
      // post-derivation step (below the towers loop) re-derives them when a
      // tower has L4 rows but is missing `l3Rows` (malformed backup).
      const persistedL3Rows: L3WorkforceRowV6[] | undefined = Array.isArray(
        v.l3Rows,
      )
        ? (v.l3Rows as L3WorkforceRowV6[])
        : undefined;

      program.towers[k] = {
        l4Rows,
        ...(persistedL3Rows ? { l3Rows: persistedL3Rows } : {}),
        baseline: {
          baselineOffshorePct: coalesceNumber(
            bRaw.baselineOffshorePct,
            defaultTowerBaseline.baselineOffshorePct,
          ),
          baselineAIPct: coalesceNumber(bRaw.baselineAIPct, defaultTowerBaseline.baselineAIPct),
        },
        rates,
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
        ...(aiReadinessIntake ? { aiReadinessIntake } : {}),
      };
    }
  }

  // Always overlay the canonical default deadlines so that programs parsed
  // here are normalized identically to those produced by the client-side
  // `migrateAssessProgram` in `localStore.ts`. Without this symmetry, the
  // route's `validateTowerScopedMutation` would see a `leadDeadlines` diff
  // every time a non-admin saves against a DB blob that was persisted
  // before this normalization existed (DB has no/partial deadlines; the
  // client-side PUT body has the full default set), and reject the save
  // with a misleading 403 "lead-deadlines updates are admin-only".
  const parsedLeadDeadlines =
    isRecord(programRaw) && Object.prototype.hasOwnProperty.call(programRaw, "leadDeadlines")
      ? parseLeadDeadlines(programRaw.leadDeadlines)
      : undefined;
  const baseDeadlines = mergeLeadDeadlines(
    buildDefaultProgramLeadDeadlines(),
    options?.mergeLeadDeadlinesFrom?.leadDeadlines,
  );
  const mergedDeadlines = mergeLeadDeadlines(baseDeadlines, parsedLeadDeadlines);
  if (mergedDeadlines && Object.keys(mergedDeadlines).length > 0) {
    program.leadDeadlines = mergedDeadlines;
  }

  // Defensive post-derivation: if a tower has L4 rows but no `l3Rows` (a
  // malformed v6 backup, which shouldn't happen in practice), re-derive
  // them so Step 2 / Step 4 don't render blank. Strips dial fields from
  // each L4 context row since dials live on `l3Rows` under v6 — leaving
  // stale L4 dial values would surface wrong numbers in any code path
  // that still reads `l4Rows[*].offshoreAssessmentPct`.
  let touchedDerivation = false;
  const towersOut: AssessProgramV2["towers"] = {};
  for (const [k, t] of Object.entries(program.towers)) {
    if (!t) continue;
    const towerId = k as TowerId;
    const needsFreshDerivation = !t.l3Rows || t.l3Rows.length === 0;
    if (needsFreshDerivation && t.l4Rows.length > 0) {
      const cleanedL4Rows = t.l4Rows.map((r) => {
        const next: typeof r = {
          id: r.id,
          l2: r.l2,
          l3: r.l3,
          l4: r.l4,
          fteOnshore: r.fteOnshore,
          fteOffshore: r.fteOffshore,
          contractorOnshore: r.contractorOnshore,
          contractorOffshore: r.contractorOffshore,
        };
        if (r.annualSpendUsd != null) next.annualSpendUsd = r.annualSpendUsd;
        if (r.l5Activities && r.l5Activities.length > 0) {
          next.l5Activities = r.l5Activities;
        }
        return next;
      });
      const l3Rows = deriveL3Rows(cleanedL4Rows, towerId);
      towersOut[towerId] = { ...t, l4Rows: cleanedL4Rows, l3Rows };
      touchedDerivation = true;
    } else {
      towersOut[towerId] = t;
    }
  }
  if (touchedDerivation) {
    program.towers = towersOut;
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
