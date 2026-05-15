/**
 * Strategist outputs — server-only LLM workflow.
 *
 * Single LLM call authors:
 *   1. Business Outcome Clusters
 *   2. Discrete AI Initiatives
 *   3. Orchestration & Data Layer requirements
 *
 * Modeled on `programSynthesisV6LLM` — strict-JSON output, validator
 * enforces determinism + slug-based ids, deterministic stub fallback
 * on any failure.
 */
import {
  STRATEGIST_PROMPT_VERSION,
  buildStrategistSystemPrompt,
  buildStrategistUserPrompt,
  type StrategistPromptInput,
} from "@/lib/llm/prompts/strategistOutputs.v1";
import {
  buildLLMRequest,
  isLLMConfigured as kitIsLLMConfigured,
  resolveModelId as kitResolveModelId,
  HEDGE_PHRASES,
  VersantLLMError,
} from "@/lib/llm/prompts/versantPromptKit";
import type {
  OrchestrationBlock,
  OutcomeCluster,
  StrategistInitiative,
  StrategistOutputs,
  ValueCategory,
  ValueSizingTier,
} from "@/lib/strategist/types";
import { slugifyForId } from "@/lib/strategist/types";
import type { TowerId } from "@/data/assess/types";
import { towers as ALL_TOWERS } from "@/data/towers";

// 120s was tripping every full-program run on gpt-5.5 with medium reasoning
// — the grounded prompt is ~12K chars + ~16K output tokens, so end-to-end
// wall-clock regularly lands in the 90-180s band. Bumped to 240s with a
// 16K output ceiling. Tune via OPENAI_STRATEGIST_TIMEOUT_MS if needed.
const DEFAULT_TIMEOUT_MS = Number(process.env.OPENAI_STRATEGIST_TIMEOUT_MS) || 240_000;
const DEFAULT_MAX_TOKENS = 16_000;
const VALID_TOWER_IDS = new Set<string>(ALL_TOWERS.map((t) => t.id));
const VALID_VALUE_CATEGORIES: ReadonlySet<ValueCategory> = new Set<ValueCategory>([
  "Cost avoidance",
  "FTE redeployment",
  "Revenue acceleration",
  "Risk reduction",
]);

export type GenerateStrategistOutputsOptions = {
  input: StrategistPromptInput;
  inputHash: string;
  modelOverride?: string;
};

export type GenerateStrategistOutputsResult = {
  status: "ok" | "stub";
  outputs: StrategistOutputs | null;
  modelId: string;
  promptVersion: string;
  latencyMs: number;
  warnings: string[];
};

export function isLLMConfigured(): boolean {
  return kitIsLLMConfigured();
}

export function resolveModelId(override?: string): string {
  return kitResolveModelId(override);
}

export async function generateStrategistOutputs(
  options: GenerateStrategistOutputsOptions,
): Promise<GenerateStrategistOutputsResult> {
  const startedAt = Date.now();
  const modelId = resolveModelId(options.modelOverride);
  const warnings: string[] = [];

  if (options.input.towers.length === 0) {
    return {
      status: "stub",
      outputs: null,
      modelId,
      promptVersion: STRATEGIST_PROMPT_VERSION,
      latencyMs: 0,
      warnings: ["No towers in scope — strategist skipped."],
    };
  }

  try {
    const systemPrompt = buildStrategistSystemPrompt();
    const userPrompt = buildStrategistUserPrompt(options.input);
    const result = await buildLLMRequest({
      systemPrompt,
      userPrompt,
      model: modelId,
      timeoutMs: DEFAULT_TIMEOUT_MS,
      maxOutputTokens: DEFAULT_MAX_TOKENS,
      reasoningEffort: "medium",
    });
    const validation = validateStrategistOutputs(result.parsed);
    if (!validation.ok) {
      warnings.push(
        `Strategist validation failed: ${validation.reasons.join("; ")} — returning deterministic stub.`,
      );
      return {
        status: "stub",
        outputs: null,
        modelId,
        promptVersion: STRATEGIST_PROMPT_VERSION,
        latencyMs: Date.now() - startedAt,
        warnings,
      };
    }
    return {
      status: "ok",
      outputs: {
        ...validation.outputs,
        modelId,
        promptVersion: STRATEGIST_PROMPT_VERSION,
        generatedAt: new Date().toISOString(),
        inputHash: options.inputHash,
      },
      modelId,
      promptVersion: STRATEGIST_PROMPT_VERSION,
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
    warnings.push(`Strategist call failed: ${reason} — returning deterministic stub.`);
    return {
      status: "stub",
      outputs: null,
      modelId,
      promptVersion: STRATEGIST_PROMPT_VERSION,
      latencyMs: Date.now() - startedAt,
      warnings,
    };
  }
}

// ===========================================================================
//   Validation
// ===========================================================================

type ValidateResult =
  | {
      ok: true;
      outputs: Pick<StrategistOutputs, "clusters" | "initiatives" | "orchestration">;
    }
  | { ok: false; reasons: string[] };

function validateStrategistOutputs(raw: unknown): ValidateResult {
  const reasons: string[] = [];
  if (!raw || typeof raw !== "object") {
    return { ok: false, reasons: ["Payload is not an object"] };
  }
  const r = raw as Record<string, unknown>;

  const clusters = sanitizeClusters(r.clusters, reasons);
  if (clusters.length < 3) reasons.push("Need at least 3 clusters");

  const clusterIds = new Set(clusters.map((c) => c.id));
  const initiatives = sanitizeInitiatives(r.initiatives, clusterIds, reasons);
  if (initiatives.length < 6) reasons.push("Need at least 6 initiatives total");

  const orchestration = sanitizeOrchestration(
    r.orchestration,
    new Set(initiatives.map((i) => i.id)),
    reasons,
  );
  if (!orchestration) reasons.push("Missing or invalid orchestration block");

  if (reasons.length > 0) return { ok: false, reasons };
  return {
    ok: true,
    outputs: { clusters, initiatives, orchestration: orchestration! },
  };
}

function sanitizeClusters(
  raw: unknown,
  reasons: string[],
): OutcomeCluster[] {
  if (!Array.isArray(raw)) {
    reasons.push("`clusters` is not an array");
    return [];
  }
  const out: OutcomeCluster[] = [];
  const seenIds = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const title = stringField(r.title);
    if (!title) {
      reasons.push("Cluster missing title");
      continue;
    }
    if (!passesDeterminismGuard(title)) {
      reasons.push(`Cluster title "${title}" violates determinism guard`);
      continue;
    }
    const narrative = stringField(r.narrative);
    if (!narrative) {
      reasons.push(`Cluster "${title}" missing narrative`);
      continue;
    }
    if (!passesDeterminismGuard(narrative)) {
      reasons.push(`Cluster "${title}" narrative violates determinism guard`);
      continue;
    }
    const id = slugifyForId(title);
    if (seenIds.has(id)) {
      reasons.push(`Duplicate cluster id "${id}"`);
      continue;
    }
    seenIds.add(id);
    const towers = sanitizeTowerIds(r.towers);
    if (towers.length < 2) {
      reasons.push(`Cluster "${title}" must span ≥2 towers (got ${towers.length})`);
      continue;
    }
    const headlineMetric = stringFieldOrUndefined(r.headlineMetric);
    if (headlineMetric && !passesDeterminismGuard(headlineMetric)) {
      reasons.push(
        `Cluster "${title}" headlineMetric violates determinism guard`,
      );
      continue;
    }
    out.push({ id, title, narrative, towers, headlineMetric });
  }
  return out;
}

function sanitizeInitiatives(
  raw: unknown,
  validClusterIds: ReadonlySet<string>,
  reasons: string[],
): StrategistInitiative[] {
  if (!Array.isArray(raw)) {
    reasons.push("`initiatives` is not an array");
    return [];
  }
  const out: StrategistInitiative[] = [];
  const seenIds = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const name = stringField(r.name);
    if (!name) continue;
    if (!passesDeterminismGuard(name)) {
      reasons.push(`Initiative "${name}" violates determinism guard`);
      continue;
    }
    const id = slugifyForId(name);
    if (seenIds.has(id)) {
      reasons.push(`Duplicate initiative id "${id}"`);
      continue;
    }
    seenIds.add(id);
    const clusterIdRaw = stringField(r.clusterId);
    if (!clusterIdRaw) {
      reasons.push(`Initiative "${name}" missing clusterId`);
      continue;
    }
    // Coerce to slug — the model is supposed to emit slugs already.
    const clusterId = slugifyForId(clusterIdRaw);
    if (!validClusterIds.has(clusterId)) {
      reasons.push(
        `Initiative "${name}" references unknown clusterId "${clusterId}"`,
      );
      continue;
    }
    const currentState = stringField(r.currentState);
    const futureState = stringField(r.futureState);
    if (!currentState || !futureState) {
      reasons.push(`Initiative "${name}" missing currentState / futureState`);
      continue;
    }
    if (
      !passesDeterminismGuard(currentState) ||
      !passesDeterminismGuard(futureState)
    ) {
      reasons.push(`Initiative "${name}" violates determinism guard`);
      continue;
    }
    const towers = sanitizeTowerIds(r.towers);
    if (towers.length === 0) {
      reasons.push(`Initiative "${name}" must touch at least 1 tower`);
      continue;
    }
    const valueCategories = sanitizeValueCategories(r.valueCategories);
    if (valueCategories.length === 0) {
      reasons.push(`Initiative "${name}" missing valueCategories`);
      continue;
    }
    const valueTier = sanitizeValueTier(r.valueTier);
    if (!valueTier) {
      reasons.push(`Initiative "${name}" missing valueTier`);
      continue;
    }
    const dependencies = sanitizeStringArray(r.dependencies);
    out.push({
      id,
      clusterId,
      name,
      towers,
      currentState,
      futureState,
      valueCategories,
      valueTier,
      dependencies,
    });
  }
  return out;
}

function sanitizeOrchestration(
  raw: unknown,
  validInitiativeIds: ReadonlySet<string>,
  reasons: string[],
): OrchestrationBlock | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const dataFlows = stringField(r.dataFlows);
  const identityResolution = stringField(r.identityResolution);
  const agentApis = stringField(r.agentApis);
  const governance = stringField(r.governance);
  const whyShared = stringField(r.whyShared);
  for (const [name, val] of [
    ["dataFlows", dataFlows],
    ["identityResolution", identityResolution],
    ["agentApis", agentApis],
    ["governance", governance],
    ["whyShared", whyShared],
  ] as const) {
    if (!val) {
      reasons.push(`orchestration.${name} is empty`);
      return null;
    }
    if (!passesDeterminismGuard(val)) {
      reasons.push(`orchestration.${name} violates determinism guard`);
      return null;
    }
  }
  const blockedRaw = Array.isArray(r.blockedInitiativeIds)
    ? r.blockedInitiativeIds
    : [];
  const blockedInitiativeIds: string[] = [];
  for (const v of blockedRaw) {
    if (typeof v !== "string") continue;
    const slug = slugifyForId(v);
    if (validInitiativeIds.has(slug)) {
      blockedInitiativeIds.push(slug);
    }
  }
  return {
    dataFlows,
    identityResolution,
    agentApis,
    governance,
    whyShared,
    blockedInitiativeIds,
  };
}

// ---------------------------------------------------------------------------
//   Small helpers
// ---------------------------------------------------------------------------

function stringField(v: unknown): string {
  if (typeof v !== "string") return "";
  return v.trim();
}

function stringFieldOrUndefined(v: unknown): string | undefined {
  const s = stringField(v);
  return s.length > 0 ? s : undefined;
}

function sanitizeTowerIds(v: unknown): TowerId[] {
  if (!Array.isArray(v)) return [];
  const out: TowerId[] = [];
  for (const t of v) {
    if (typeof t !== "string") continue;
    if (VALID_TOWER_IDS.has(t)) out.push(t as TowerId);
  }
  return Array.from(new Set(out));
}

function sanitizeValueCategories(v: unknown): ValueCategory[] {
  if (!Array.isArray(v)) return [];
  const out: ValueCategory[] = [];
  for (const c of v) {
    if (typeof c !== "string") continue;
    if (VALID_VALUE_CATEGORIES.has(c as ValueCategory)) {
      out.push(c as ValueCategory);
    }
  }
  return Array.from(new Set(out));
}

function sanitizeValueTier(v: unknown): ValueSizingTier | null {
  if (v === "HIGH" || v === "MEDIUM" || v === "LOW") return v;
  return null;
}

function sanitizeStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .map((x) => x.trim());
}

const HEDGE_LOWER = new Set(HEDGE_PHRASES.map((h) => h.toLowerCase()));
const DIGIT_CLUSTER = /\d{2,}/;
const CURRENCY = /\$|%/;

function passesDeterminismGuard(s: string): boolean {
  if (!s) return false;
  if (CURRENCY.test(s)) return false;
  if (DIGIT_CLUSTER.test(s)) return false;
  const lower = s.toLowerCase();
  for (const hedge of Array.from(HEDGE_LOWER)) {
    if (lower.includes(hedge)) return false;
  }
  return true;
}
