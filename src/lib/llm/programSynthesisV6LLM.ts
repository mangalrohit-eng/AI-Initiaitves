/**
 * Cross-Tower AI Plan — V6 server-only LLM workflow.
 *
 * Sibling of `crossTowerPlanLLM.ts` (the v5 fan-out + synthesis pipeline).
 * Under v6, AI initiatives are already authored at L3 grain; the cross-
 * tower page is a 1-to-1 reflection of the per-tower AI Solutions. The
 * only LLM call this module makes is a single program-level synthesis
 * that authors:
 *
 *   - The page-header executive summary.
 *   - 3-8 program risks + mitigations.
 *   - 24-month roadmap narrative.
 *   - Architecture commentary (vendors, data core, delivery cadence).
 *   - Optional per-initiative narrative / value+effort rationales.
 *
 * Determinism enforcement runs server-side — string fields with `$`, `%`,
 * digit clusters of 2+, or hedge phrases are rejected and a deterministic
 * stub returned.
 */

import {
  CROSS_TOWER_INITIATIVE_PROMPT_VERSION,
  buildSynthesisV6SystemPrompt,
  buildSynthesisV6UserPrompt,
  type SynthesisV6PromptInitiative,
} from "@/lib/llm/prompts/crossTowerInitiativePlan.v1";
import {
  buildLLMRequest,
  isLLMConfigured as kitIsLLMConfigured,
  resolveModelId as kitResolveModelId,
  HEDGE_PHRASES,
  VersantLLMError,
} from "@/lib/llm/prompts/versantPromptKit";
import type { CrossTowerAssumptions } from "@/lib/cross-tower/assumptions";
import type {
  ProgramSynthesisLLMV6,
  InitiativeNarrativeV6,
} from "@/lib/cross-tower/composeProjectsV6";

const DEFAULT_TIMEOUT_MS = 120_000;
// Roster size scales linearly with token budget — every Strategic Bet /
// Quick Win the model narrates costs ~80 output tokens. With the v6 prompt
// capping narrative authoring to Strategic Bets + Quick Wins only (≤20
// typical), 16k tokens leaves comfortable headroom for risks, roadmap,
// architecture, and the executive summary even on a fully-curated 50+
// initiative roster. Without this bump the response truncates mid-JSON
// and `JSON.parse` throws `non_json_response`.
const DEFAULT_MAX_TOKENS = 16_000;

export type GenerateProgramSynthesisV6Options = {
  initiatives: SynthesisV6PromptInitiative[];
  towers: { id: string; name: string }[];
  assumptions: CrossTowerAssumptions;
  modelOverride?: string;
  /** Tower AI readiness digest(s) for narrative grounding only. */
  synthesisIntakeDigest?: string;
};

export type ProgramSynthesisV6Status = "ok" | "stub";

export type GenerateProgramSynthesisV6Result = {
  synthesis: ProgramSynthesisLLMV6 | null;
  /** Per-initiative narrative overlays (parallel array; may be shorter than the input). */
  narratives: InitiativeNarrativeV6[];
  status: ProgramSynthesisV6Status;
  modelId: string;
  promptVersion: string;
  latencyMs: number;
  warnings: string[];
};

export const PROGRAM_SYNTHESIS_V6_PROMPT_VERSION =
  CROSS_TOWER_INITIATIVE_PROMPT_VERSION;

export function isLLMConfigured(): boolean {
  return kitIsLLMConfigured();
}

export function resolveModelId(override?: string): string {
  return kitResolveModelId(override);
}

export async function generateProgramSynthesisV6(
  options: GenerateProgramSynthesisV6Options,
): Promise<GenerateProgramSynthesisV6Result> {
  const startedAt = Date.now();
  const modelId = resolveModelId(options.modelOverride);
  const warnings: string[] = [];

  if (options.initiatives.length === 0) {
    return {
      synthesis: null,
      narratives: [],
      status: "stub",
      modelId,
      promptVersion: CROSS_TOWER_INITIATIVE_PROMPT_VERSION,
      latencyMs: 0,
      warnings: [
        "No in-plan initiatives — synthesis skipped (deterministic stub).",
      ],
    };
  }

  try {
    const userPrompt = buildSynthesisV6UserPrompt({
      initiatives: options.initiatives,
      towers: options.towers,
      assumptions: options.assumptions,
      synthesisIntakeDigest: options.synthesisIntakeDigest,
    });
    const systemPrompt = buildSynthesisV6SystemPrompt();

    const result = await buildLLMRequest({
      systemPrompt,
      userPrompt,
      model: modelId,
      timeoutMs: DEFAULT_TIMEOUT_MS,
      maxOutputTokens: DEFAULT_MAX_TOKENS,
      // Mirror the v5 synthesis call — `"low"` is plenty for a single
      // narrative-authoring pass and keeps roster-driven latency from
      // exceeding the per-call timeout on big curations.
      reasoningEffort: "low",
    });
    const validIds = new Set(options.initiatives.map((i) => i.id));
    const validation = validateSynthesisV6(result.parsed, validIds);
    if (!validation.ok) {
      warnings.push(
        `Synthesis validation failed: ${validation.reasons.join("; ")} — falling back to deterministic stub.`,
      );
      return {
        synthesis: null,
        narratives: [],
        status: "stub",
        modelId,
        promptVersion: CROSS_TOWER_INITIATIVE_PROMPT_VERSION,
        latencyMs: Date.now() - startedAt,
        warnings,
      };
    }
    return {
      synthesis: validation.synthesis,
      narratives: validation.narratives,
      status: "ok",
      modelId,
      promptVersion: CROSS_TOWER_INITIATIVE_PROMPT_VERSION,
      latencyMs: Date.now() - startedAt,
      warnings,
    };
  } catch (e) {
    const reason =
      e instanceof VersantLLMError
        ? `${e.code}: ${e.message}`
        : e instanceof Error
          ? e.message
          : "Unknown error";
    warnings.push(`Synthesis call failed: ${reason} — returning deterministic stub.`);
    return {
      synthesis: null,
      narratives: [],
      status: "stub",
      modelId,
      promptVersion: CROSS_TOWER_INITIATIVE_PROMPT_VERSION,
      latencyMs: Date.now() - startedAt,
      warnings,
    };
  }
}

// ===========================================================================
//   Validation
// ===========================================================================

type ValidateSynthesisResult =
  | {
      ok: true;
      synthesis: ProgramSynthesisLLMV6;
      narratives: InitiativeNarrativeV6[];
    }
  | { ok: false; reasons: string[] };

function validateSynthesisV6(
  raw: unknown,
  validIds: Set<string>,
): ValidateSynthesisResult {
  const reasons: string[] = [];
  if (!raw || typeof raw !== "object") {
    return { ok: false, reasons: ["Synthesis payload is not an object"] };
  }
  const r = raw as Record<string, unknown>;

  const executiveSummary = stringField(r.executiveSummary);
  if (!executiveSummary) reasons.push("`executiveSummary` is empty");
  if (!passesDeterminismGuard(executiveSummary)) {
    reasons.push("`executiveSummary` violates determinism guard");
  }

  const architectureVendors = stringField(r.architectureVendors);
  const architectureDataCore = stringField(r.architectureDataCore);
  const architectureDelivery = stringField(r.architectureDelivery);
  for (const [name, val] of [
    ["architectureVendors", architectureVendors],
    ["architectureDataCore", architectureDataCore],
    ["architectureDelivery", architectureDelivery],
  ] as const) {
    if (!val) reasons.push(`\`${name}\` is empty`);
    if (val && !passesDeterminismGuard(val)) {
      reasons.push(`\`${name}\` violates determinism guard`);
    }
  }

  const risks = sanitizeRisks(r.risks, reasons);
  if (risks.length === 0) reasons.push("`risks` must contain at least one entry");
  if (risks.length > 8) {
    // soft cap; trim rather than fail
    risks.length = 8;
  }

  const roadmapNarrative = sanitizeRoadmap(r.roadmapNarrative, reasons);

  const narratives = sanitizeNarratives(r.narratives, validIds);

  if (reasons.length > 0) return { ok: false, reasons };

  return {
    ok: true,
    synthesis: {
      executiveSummary,
      risks,
      roadmapNarrative: roadmapNarrative ?? {
        overall: "",
        ladder: "",
        milestones: [],
        ownerNotes: [],
      },
      architectureVendors,
      architectureDataCore,
      architectureDelivery,
    },
    narratives,
  };
}

function sanitizeRisks(
  raw: unknown,
  reasons: string[],
): ProgramSynthesisLLMV6["risks"] {
  if (!Array.isArray(raw)) return [];
  const out: ProgramSynthesisLLMV6["risks"] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const title = stringField(r.title);
    const description = stringField(r.description);
    const mitigation = stringField(r.mitigation);
    if (!title || !description || !mitigation) continue;
    if (!passesDeterminismGuard(title)) {
      reasons.push(`Risk title \"${title}\" violates determinism guard`);
      continue;
    }
    if (!passesDeterminismGuard(description)) {
      reasons.push(`Risk description on \"${title}\" violates determinism guard`);
      continue;
    }
    if (!passesDeterminismGuard(mitigation)) {
      reasons.push(`Risk mitigation on \"${title}\" violates determinism guard`);
      continue;
    }
    out.push({ title, description, mitigation });
  }
  return out;
}

function sanitizeRoadmap(
  raw: unknown,
  reasons: string[],
): ProgramSynthesisLLMV6["roadmapNarrative"] | null {
  if (!raw || typeof raw !== "object") {
    reasons.push("`roadmapNarrative` is not an object");
    return null;
  }
  const r = raw as Record<string, unknown>;
  const overall = stringField(r.overall);
  const ladder = stringField(r.ladder);
  if (!overall) reasons.push("`roadmapNarrative.overall` is empty");
  if (!ladder) reasons.push("`roadmapNarrative.ladder` is empty");
  if (overall && !passesDeterminismGuard(overall)) {
    reasons.push("`roadmapNarrative.overall` violates determinism guard");
  }
  if (ladder && !passesDeterminismGuard(ladder)) {
    reasons.push("`roadmapNarrative.ladder` violates determinism guard");
  }
  const milestones = sanitizeStringArray(r.milestones);
  for (const s of milestones) {
    if (!passesDeterminismGuard(s)) {
      reasons.push(`Milestone \"${s.slice(0, 40)}…\" violates determinism guard`);
    }
  }
  const ownerNotes = sanitizeStringArray(r.ownerNotes);
  for (const s of ownerNotes) {
    if (!passesDeterminismGuard(s)) {
      reasons.push(`Owner note \"${s.slice(0, 40)}…\" violates determinism guard`);
    }
  }
  return { overall, ladder, milestones, ownerNotes };
}

function sanitizeNarratives(
  raw: unknown,
  validIds: Set<string>,
): InitiativeNarrativeV6[] {
  // Narratives are an OPTIONAL overlay. A bad narrative entry should
  // silently drop (the deterministic engine still authors copy from
  // tagline + aiRationale) rather than fail the whole synthesis. The
  // top-level synthesis fails only when the executive summary, risks,
  // roadmap, or architecture commentary is missing/invalid — those are
  // load-bearing for the page.
  if (!Array.isArray(raw)) return [];
  const out: InitiativeNarrativeV6[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const initiativeId = stringField(r.initiativeId);
    if (!initiativeId || !validIds.has(initiativeId)) continue;
    const narrative = stringField(r.narrative);
    const valueRationale = stringField(r.valueRationale);
    const effortRationale = stringField(r.effortRationale);
    if (!narrative || !valueRationale || !effortRationale) continue;
    if (
      !passesDeterminismGuard(narrative) ||
      !passesDeterminismGuard(valueRationale) ||
      !passesDeterminismGuard(effortRationale)
    ) {
      continue;
    }
    out.push({ initiativeId, narrative, valueRationale, effortRationale });
  }
  return out;
}

// ===========================================================================
//   Helpers
// ===========================================================================

function stringField(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function sanitizeStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    if (typeof item === "string" && item.trim()) out.push(item.trim());
  }
  return out;
}

/**
 * Guard against the LLM authoring fabricated metrics the engine should own
 * (dollar figures, percentages, FTE counts, savings claims). The prompt
 * explicitly asks for some structural digits in places — `24-month`,
 * `14 towers`, milestone identifiers like `M24`, phase keys `P1/P2/P3` —
 * so we strip those before checking for forbidden numerics.
 */
function passesDeterminismGuard(s: string): boolean {
  if (s.includes("$") || s.includes("%")) return false;
  // Strip known-safe structural patterns before the multi-digit check.
  const stripped = s
    // Phase tier keys (P1, P2, P3)
    .replace(/\bP[123]\b/g, "")
    // Milestone identifiers (M1, M24, etc.)
    .replace(/\bM\d+\b/g, "")
    // Duration ranges/phrases: "24-month", "12 months", "two-year", etc.
    .replace(
      /\b\d+(?:[-–\s]?\d+)?[-\s](?:month|months|week|weeks|year|years|day|days|hour|hours|minute|minutes)\b/gi,
      "",
    )
    // Versant org-scale references: "14 towers", "7 entities", "4 brands"
    .replace(
      /\b\d+\s+(?:towers?|functions?|entities?|brands?|networks?|workshops?|leads?)\b/gi,
      "",
    );
  if (/\d{2,}/.test(stripped)) return false;
  const lower = s.toLowerCase();
  for (const phrase of HEDGE_PHRASES) {
    if (lower.includes(phrase.toLowerCase())) return false;
  }
  return true;
}
