/**
 * Cross-Tower AI Plan — V6 persistence layer (v2 doc shape).
 *
 * Sibling of `persistedPlan.ts` (v1, used under v5). Under v6 there are no
 * "AI Projects" at all — the cross-tower plan is a 1-to-1 reflection of the
 * curated `L3Initiative` roster from each tower. The persisted document
 * therefore stores:
 *
 *   - `initiativeRefs`: a compact pointer list (`towerId`, `l3RowId`, `id`,
 *     `solutionName`) that lets us reconstruct the live ProgramInitiativeRowV6
 *     set from the current AssessProgramV2 — even if the tower-side curation
 *     has drifted since (the staleness banner lights when the input hashes
 *     don't match).
 *   - `synthesis`: the LLM-authored `ProgramSynthesisLLMV6` (or null when
 *     the synthesis call fell back to a stub).
 *   - `appliedAssumptions`, `inputHash`, `assumptionsHash`, `generatedAt`,
 *     `modelId`, `promptVersion`: same provenance fingerprints as v1.
 *
 * The validator hard-rejects v1 documents (so a stale v5 row doesn't render
 * under v6 — the page falls through to the empty-state regenerate flow).
 */

import {
  clampAssumptions,
  type CrossTowerAssumptions,
} from "@/lib/cross-tower/assumptions";
import type {
  ProgramSynthesisLLMV6,
  InitiativeNarrativeV6,
} from "@/lib/cross-tower/composeProjectsV6";

export const PERSISTED_CROSS_TOWER_PLAN_VERSION_V2 = 2 as const;

export type InitiativeRefV6 = {
  /** Tower id (must match a TowerId in `towers.ts`). */
  towerId: string;
  /** Parent L3WorkforceRowV6 row id. */
  l3RowId: string;
  /** L3Initiative id. */
  id: string;
  /** Solution name at the time the plan was authored — informational only. */
  solutionName: string;
};

export type PersistedCrossTowerAiPlanV2 = {
  version: typeof PERSISTED_CROSS_TOWER_PLAN_VERSION_V2;
  schema: "v6";
  /** Compact pointer list — full rows are reconstituted from the live program. */
  initiativeRefs: InitiativeRefV6[];
  /** Program-level LLM synthesis (or null on stub). */
  synthesis: ProgramSynthesisLLMV6 | null;
  /** Per-initiative narrative overlays (subset; matched by `initiativeId`). */
  narratives: InitiativeNarrativeV6[];
  modelId: string;
  promptVersion: string;
  warnings: string[];
  appliedAssumptions: CrossTowerAssumptions;
  inputHash: string;
  assumptionsHash: string;
  generatedAt: string;
};

export type ValidatePersistedPlanV2Result =
  | { ok: true; plan: PersistedCrossTowerAiPlanV2 }
  | { ok: false; error: string };

export function validatePersistedPlanV2(
  raw: unknown,
): ValidatePersistedPlanV2Result {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Persisted plan must be an object." };
  }
  const r = raw as Record<string, unknown>;

  if (r.version !== PERSISTED_CROSS_TOWER_PLAN_VERSION_V2) {
    return {
      ok: false,
      error: `Unsupported persisted plan version: ${String(r.version)} (expected ${PERSISTED_CROSS_TOWER_PLAN_VERSION_V2}).`,
    };
  }
  if (r.schema !== "v6") {
    return { ok: false, error: "Persisted plan must declare schema=\"v6\"." };
  }

  const initiativeRefs = sanitizeRefs(r.initiativeRefs);
  if (initiativeRefs === null) {
    return { ok: false, error: "Field `initiativeRefs` must be an array." };
  }

  const synthesis = sanitizeSynthesis(r.synthesis);
  const narratives = sanitizeNarratives(r.narratives);

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
      version: PERSISTED_CROSS_TOWER_PLAN_VERSION_V2,
      schema: "v6",
      initiativeRefs,
      synthesis,
      narratives,
      modelId,
      promptVersion,
      warnings,
      appliedAssumptions,
      inputHash,
      assumptionsHash,
      generatedAt,
    },
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

function sanitizeRefs(v: unknown): InitiativeRefV6[] | null {
  if (!Array.isArray(v)) return null;
  const out: InitiativeRefV6[] = [];
  for (const item of v) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const towerId = stringField(r.towerId);
    const l3RowId = stringField(r.l3RowId);
    const id = stringField(r.id);
    const solutionName = stringField(r.solutionName);
    if (!towerId || !l3RowId || !id) continue;
    out.push({ towerId, l3RowId, id, solutionName });
  }
  return out;
}

function sanitizeSynthesis(v: unknown): ProgramSynthesisLLMV6 | null {
  if (!v || typeof v !== "object") return null;
  const r = v as Record<string, unknown>;
  const executiveSummary = stringField(r.executiveSummary);
  const architectureVendors = stringField(r.architectureVendors);
  const architectureDataCore = stringField(r.architectureDataCore);
  const architectureDelivery = stringField(r.architectureDelivery);
  if (!executiveSummary) return null;
  const risks = sanitizeRisks(r.risks);
  const roadmapNarrative = sanitizeRoadmap(r.roadmapNarrative);
  return {
    executiveSummary,
    risks,
    roadmapNarrative,
    architectureVendors,
    architectureDataCore,
    architectureDelivery,
  };
}

function sanitizeRisks(v: unknown): ProgramSynthesisLLMV6["risks"] {
  if (!Array.isArray(v)) return [];
  const out: ProgramSynthesisLLMV6["risks"] = [];
  for (const item of v) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const title = stringField(r.title);
    const description = stringField(r.description);
    const mitigation = stringField(r.mitigation);
    if (!title || !description || !mitigation) continue;
    out.push({ title, description, mitigation });
  }
  return out;
}

function sanitizeRoadmap(
  v: unknown,
): ProgramSynthesisLLMV6["roadmapNarrative"] {
  if (!v || typeof v !== "object") {
    return { overall: "", ladder: "", milestones: [], ownerNotes: [] };
  }
  const r = v as Record<string, unknown>;
  return {
    overall: stringField(r.overall),
    ladder: stringField(r.ladder),
    milestones: sanitizeStringArray(r.milestones),
    ownerNotes: sanitizeStringArray(r.ownerNotes),
  };
}

function sanitizeNarratives(v: unknown): InitiativeNarrativeV6[] {
  if (!Array.isArray(v)) return [];
  const out: InitiativeNarrativeV6[] = [];
  for (const item of v) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const initiativeId = stringField(r.initiativeId);
    const narrative = stringField(r.narrative);
    const valueRationale = stringField(r.valueRationale);
    const effortRationale = stringField(r.effortRationale);
    if (!initiativeId || !narrative || !valueRationale || !effortRationale) continue;
    out.push({ initiativeId, narrative, valueRationale, effortRationale });
  }
  return out;
}
