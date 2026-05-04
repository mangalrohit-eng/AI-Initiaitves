/**
 * Cross-Tower AI Plan v3 — persistence layer document shape + validator.
 *
 * Why this lives in its own module:
 *   - Both `[PUT /api/cross-tower-ai-plan/state](../../app/api/cross-tower-ai-plan/state/route.ts)`
 *     and the client hook `[useCrossTowerPlan](../llm/useCrossTowerPlan.ts)` need
 *     the same validator. Sharing one source of truth means adding a field is
 *     a one-file edit.
 *   - The validator is intentionally permissive on the LLM payload (drop
 *     orphans rather than fail the whole save) so a stale prompt or
 *     mid-deploy doc shape doesn't bury the user's last good plan. The
 *     `version` gate is the only hard reject — that's how we'd cut over to
 *     a new schema.
 *
 * What we persist (JSONB document, single row):
 *   - The LLM authorship verbatim (`plan.projects`, `plan.synthesis`).
 *   - The engine inputs the LLM saw at generation time (`cohorts`,
 *     `appliedAssumptions`) so reload re-renders WYSIWYG even if the live
 *     program substrate has drifted since.
 *   - The fingerprints (`inputHash`, `assumptionsHash`, `generatedAt`,
 *     `modelId`, `promptVersion`) the staleness banner reads.
 *
 * What we don't persist:
 *   - The compose-derived view-models (`AIProjectResolved[]`, `BuildupPoint[]`,
 *     `ProjectKpis`). These are pure functions of the persisted snapshot
 *     and are recomputed on every hydrate, so a future change to
 *     `composeProjects.ts` reflows the saved plan with no migration.
 */

import {
  clampAssumptions,
  type CrossTowerAssumptions,
} from "@/lib/cross-tower/assumptions";
import type {
  AIProjectLLM,
  CrossTowerAiPlanLLM,
  L4Cohort,
  ProgramSynthesisLLM,
} from "@/lib/cross-tower/aiProjects";
import type {
  CohortStatus,
  SynthesisStatus,
} from "@/lib/llm/crossTowerPlanLLM";
import type { CapabilityL3 } from "@/data/capabilityMap/types";
import type { InitiativeL3, InitiativeL4 } from "@/lib/initiatives/select";
import type { ProgramInitiativeRow } from "@/lib/initiatives/selectProgram";
import { tierFromProgramTier } from "@/lib/priority";

/** Bumped when the persisted document shape changes incompatibly. */
export const PERSISTED_CROSS_TOWER_PLAN_VERSION = 1 as const;

export type PersistedCrossTowerAiPlan = {
  version: typeof PERSISTED_CROSS_TOWER_PLAN_VERSION;
  /** LLM authorship — projects[] + synthesis. `synthesis` may be null. */
  plan: CrossTowerAiPlanLLM;
  cohortStatus: CohortStatus[];
  synthesisStatus: SynthesisStatus;
  modelId: string;
  promptVersion: string;
  /** Aggregated server warnings surfaced at generation time. */
  warnings: string[];
  /** Engine-built cohorts at gen-time — verbatim. */
  cohorts: L4Cohort[];
  /** Assumption snapshot that produced this plan (incl. timing knobs). */
  appliedAssumptions: CrossTowerAssumptions;
  /** Program-substrate fingerprint at gen-time. */
  inputHash: string;
  /** LLM-affecting assumption subset hash at gen-time. */
  assumptionsHash: string;
  /** ISO timestamp of generation. */
  generatedAt: string;
};

export type ValidatePersistedPlanResult =
  | { ok: true; plan: PersistedCrossTowerAiPlan }
  | { ok: false; error: string };

/**
 * Pure validator + light coercer. Both the API PUT handler and the client
 * GET handler run their input through this so the server can store a clean
 * row and the client can refuse to hydrate a doc the running build can't
 * render.
 *
 * Hard rejects:
 *   - Non-object root.
 *   - `version` not equal to `PERSISTED_PLAN_VERSION` (the cutover signal).
 *   - Missing or empty `cohorts` (a saved plan with zero cohorts is allowed
 *     — it represents a deliberate empty-state regenerate — but the field
 *     itself must exist as an array).
 *
 * Soft fixes (non-fatal):
 *   - Orphan `plan.projects[]` entries (no matching cohort) are dropped.
 *   - `cohortStatus` entries whose `status` literal is unknown are dropped.
 *   - `appliedAssumptions` runs through `clampAssumptions` so a malformed
 *     client can't poison the row with out-of-range timing.
 *   - Missing `warnings` collapses to `[]`.
 */
export function validatePersistedPlan(
  raw: unknown,
): ValidatePersistedPlanResult {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Persisted plan must be an object." };
  }
  const r = raw as Record<string, unknown>;

  const version = r.version;
  if (version !== PERSISTED_CROSS_TOWER_PLAN_VERSION) {
    return {
      ok: false,
      error: `Unsupported persisted plan version: ${String(version)} (expected ${PERSISTED_CROSS_TOWER_PLAN_VERSION}).`,
    };
  }

  const cohorts = sanitizeCohorts(r.cohorts);
  if (cohorts === null) {
    return { ok: false, error: "Field `cohorts` must be an array." };
  }

  const cohortIds = new Set(cohorts.map((c) => c.l4RowId));

  const planRaw = r.plan;
  const plan = sanitizePlan(planRaw, cohortIds);
  if (plan === null) {
    return {
      ok: false,
      error: "Field `plan` must be an object with `projects[]` array.",
    };
  }

  const cohortStatus = sanitizeCohortStatus(r.cohortStatus);
  const synthesisStatus = sanitizeSynthesisStatus(r.synthesisStatus);

  const modelId = stringField(r.modelId);
  const promptVersion = stringField(r.promptVersion);
  const inputHash = stringField(r.inputHash);
  const assumptionsHash = stringField(r.assumptionsHash);
  const generatedAt = stringField(r.generatedAt);

  if (!modelId) return { ok: false, error: "Field `modelId` must be a non-empty string." };
  if (!promptVersion) return { ok: false, error: "Field `promptVersion` must be a non-empty string." };
  if (!inputHash) return { ok: false, error: "Field `inputHash` must be a non-empty string." };
  if (!assumptionsHash) return { ok: false, error: "Field `assumptionsHash` must be a non-empty string." };
  if (!generatedAt) return { ok: false, error: "Field `generatedAt` must be a non-empty string." };

  const warnings = sanitizeStringArray(r.warnings);
  const appliedAssumptions = clampAssumptions(
    (r.appliedAssumptions ?? {}) as Partial<CrossTowerAssumptions>,
  );

  return {
    ok: true,
    plan: {
      version: PERSISTED_CROSS_TOWER_PLAN_VERSION,
      plan,
      cohortStatus,
      synthesisStatus,
      modelId,
      promptVersion,
      warnings,
      cohorts,
      appliedAssumptions,
      inputHash,
      assumptionsHash,
      generatedAt,
    },
  };
}

/**
 * Build the `initiativesById` map `composeProjects` consumes during a
 * DB-rehydrate.
 *
 *   1) Prefer the live program's `ProgramInitiativeRow` when the id matches —
 *      full denormalized shape for lineage, drawers, and tier copy.
 *   2) For any L5 id present in the saved `cohorts` but missing from the live
 *      program (drifted substrate, deleted row, etc.), synthesize a minimal
 *      stub from the cohort snapshot so constituents are not empty on reload.
 *      The page-level staleness banner still lights when
 *      `program.inputHash !== saved.inputHash`.
 */
export function buildInitiativesByIdForHydrate(
  cohorts: L4Cohort[],
  program?: { initiatives: ProgramInitiativeRow[] } | null,
): Map<string, ProgramInitiativeRow> {
  const out = new Map<string, ProgramInitiativeRow>();
  if (program?.initiatives) {
    for (const row of program.initiatives) out.set(row.id, row);
  }
  for (const cohort of cohorts) {
    for (const l5 of cohort.l5Initiatives) {
      if (out.has(l5.id)) continue;
      out.set(l5.id, stubInitiativeRowFromCohort(cohort, l5));
    }
  }
  return out;
}

function stubInitiativeRowFromCohort(
  cohort: L4Cohort,
  l5: L4Cohort["l5Initiatives"][number],
): ProgramInitiativeRow {
  const l4Vm: InitiativeL4 = {
    id: cohort.l4RowId,
    name: cohort.l4Name,
    source: "curated",
    isPlaceholder: false,
  };
  const capL3: CapabilityL3 = {
    id: `${cohort.l4RowId}-job-family`,
    name: cohort.l3JobFamilyName || cohort.l4Name,
    l4: [
      {
        id: cohort.l4RowId,
        name: cohort.l4Name,
        l5: [],
      },
    ],
  };
  const l3Vm: InitiativeL3 = {
    l3: capL3,
    l2Name: cohort.towerName,
    l2Id: `${cohort.towerId}-stub-l2`,
    rowL4Name: cohort.l4Name,
    rowId: cohort.l4RowId,
    poolUsd: cohort.l4AiUsd,
    aiPct: 0,
    aiUsd: cohort.l4AiUsd,
    l4s: [l4Vm],
  };
  return {
    id: l5.id,
    towerId: cohort.towerId,
    towerName: cohort.towerName,
    name: l5.name,
    l2Name: cohort.l3JobFamilyName || cohort.towerName,
    l3Name: cohort.l4Name,
    programTier: l5.programTier,
    programTierReason:
      "Restored from saved cross-tower plan; live assess initiative row missing for this id.",
    tier: tierFromProgramTier(l5.programTier),
    aiRationale: l5.rationale,
    aiUsd: cohort.l4AiUsd,
    attributedAiUsd: l5.attributedAiUsd,
    l3: l3Vm,
    l4: l4Vm,
  };
}

// ---------------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------------

function stringField(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function sanitizeStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    if (typeof item === "string" && item.trim()) out.push(item);
  }
  return out;
}

/**
 * Cohort sanitizer — mirrors the shape on `[L4Cohort](./aiProjects.ts)`.
 * Keeps only well-formed entries; an entry with an empty `l5Initiatives`
 * array is dropped because the engine never builds zero-L5 cohorts and a
 * downstream consumer would treat it as a stub.
 */
function sanitizeCohorts(v: unknown): L4Cohort[] | null {
  if (!Array.isArray(v)) return null;
  const out: L4Cohort[] = [];
  for (const item of v) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const l4RowId = stringField(r.l4RowId);
    const l4Name = stringField(r.l4Name);
    const towerId = stringField(r.towerId);
    const towerName = stringField(r.towerName);
    if (!l4RowId || !l4Name || !towerId || !towerName) continue;
    const initsRaw = Array.isArray(r.l5Initiatives) ? r.l5Initiatives : [];
    const l5Initiatives: L4Cohort["l5Initiatives"] = [];
    for (const ii of initsRaw) {
      if (!ii || typeof ii !== "object") continue;
      const i = ii as Record<string, unknown>;
      const id = stringField(i.id);
      const name = stringField(i.name);
      if (!id || !name) continue;
      const programTier =
        i.programTier === "P1" ||
        i.programTier === "P2" ||
        i.programTier === "P3" ||
        i.programTier === "Deprioritized"
          ? i.programTier
          : "P1";
      l5Initiatives.push({
        id,
        name,
        rationale:
          typeof i.rationale === "string" ? i.rationale : undefined,
        attributedAiUsd: numField(i.attributedAiUsd),
        programTier,
      });
    }
    if (l5Initiatives.length === 0) continue;
    out.push({
      l4RowId,
      l4Name,
      l3JobFamilyName: stringField(r.l3JobFamilyName),
      towerId: towerId as L4Cohort["towerId"],
      towerName,
      l4AiUsd: numField(r.l4AiUsd),
      attributedAiUsdTotal: numField(r.attributedAiUsdTotal),
      l5Initiatives,
    });
  }
  return out;
}

function numField(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.max(0, v) : 0;
}

/**
 * Plan sanitizer — accepts `{ projects: AIProjectLLM[], synthesis: ... | null }`.
 * Drops orphan projects (no matching cohort id) instead of failing — keeps
 * a partially-stale row hydratable while flagging the drift via the
 * existing per-cohort status machinery.
 */
function sanitizePlan(
  raw: unknown,
  cohortIds: Set<string>,
): CrossTowerAiPlanLLM | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.projects)) return null;
  const projects: AIProjectLLM[] = [];
  for (const item of r.projects) {
    if (!item || typeof item !== "object") continue;
    const p = item as Record<string, unknown> & {
      parentL4ActivityGroupId?: unknown;
      id?: unknown;
    };
    const parentId = stringField(p.parentL4ActivityGroupId);
    if (!parentId || !cohortIds.has(parentId)) continue;
    projects.push(item as AIProjectLLM);
  }
  const synthesis =
    r.synthesis && typeof r.synthesis === "object"
      ? (r.synthesis as ProgramSynthesisLLM)
      : null;
  return { projects, synthesis };
}

function sanitizeCohortStatus(raw: unknown): CohortStatus[] {
  if (!Array.isArray(raw)) return [];
  const out: CohortStatus[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const l4RowId = stringField(r.l4RowId);
    if (!l4RowId) continue;
    const status = r.status;
    if (status === "ok" || status === "cache") {
      out.push({ l4RowId, status });
    } else if (status === "stub") {
      out.push({
        l4RowId,
        status: "stub",
        reason: typeof r.reason === "string" ? r.reason : "",
      });
    }
  }
  return out;
}

function sanitizeSynthesisStatus(raw: unknown): SynthesisStatus {
  return raw === "ok" || raw === "cache" || raw === "stub" ? raw : "stub";
}
