/**
 * POST /api/cross-tower-ai-plan/generate
 *
 * Body shape:
 *   {
 *     inputHash: string;
 *     prompt: BuildPromptInput;     // grounded payload assembled client-side
 *     modelId?: string;             // request-scoped override
 *     forceRegenerate?: boolean;    // bypass cache
 *   }
 *
 * Response:
 *   {
 *     ok: true,
 *     source: "llm" | "cache" | "deterministic",
 *     narrativeUnavailable?: boolean,  // true on full LLM failure
 *     plan: CrossTowerAiPlanLLM | null,
 *     modelId: string,
 *     promptVersion: string,
 *     inputHash: string,
 *     latencyMs: number,
 *     generatedAt: string,
 *     warning?: string,
 *   }
 *
 * Behaviour:
 *   - Auth: same forge_session cookie as the rest of /api routes.
 *   - On cache hit: returns the cached plan immediately (`source: "cache"`).
 *   - Tries OpenAI when `OPENAI_API_KEY` is configured. ONE structured-repair
 *     retry on validation failure. On every failure path the route ALWAYS
 *     responds 200 with `narrativeUnavailable: true` so the client can render
 *     the deterministic skeleton — the page never goes blank.
 *   - Logs metadata only (`modelId`, `promptVersion`, `inputHash`,
 *     `latencyMs`, `tokenUsage`); never the prompt body or generated text.
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, isValidSessionToken } from "@/lib/auth";
import {
  generateCrossTowerPlan,
  isLLMConfigured,
  resolveModelId,
  ValidationError,
  CrossTowerPlanLLMError,
} from "@/lib/llm/crossTowerPlanLLM";
import {
  buildCacheEntry,
  getCachedPlan,
  putCachedPlan,
} from "@/lib/llm/crossTowerPlanCache";
import {
  PROMPT_VERSION,
  type BuildPromptInput,
  type PromptKeyInitiative,
} from "@/lib/llm/prompts/crossTowerAiPlan.v1";
import type { Tier } from "@/lib/priority";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Allow up to 3 minutes — covers the 120s LLM timeout plus a structured
// repair retry on validation failure. Required so Vercel doesn't kill the
// function before our internal timeout fires.
export const maxDuration = 180;

const MAX_INITIATIVES = 200;

type Body = {
  inputHash?: unknown;
  prompt?: unknown;
  modelId?: unknown;
  forceRegenerate?: unknown;
};

export async function POST(req: Request) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const inputHash = typeof body.inputHash === "string" ? body.inputHash : "";
  if (!inputHash) {
    return NextResponse.json({ error: "Missing inputHash" }, { status: 400 });
  }

  const prompt = sanitizePromptInput(body.prompt);
  if (!prompt) {
    return NextResponse.json({ error: "Missing or invalid prompt" }, { status: 400 });
  }
  if (prompt.initiatives.length === 0) {
    return NextResponse.json(
      { error: "prompt.initiatives must not be empty" },
      { status: 400 },
    );
  }
  if (prompt.initiatives.length > MAX_INITIATIVES) {
    return NextResponse.json(
      { error: `Too many initiatives (${prompt.initiatives.length}); max ${MAX_INITIATIVES}.` },
      { status: 413 },
    );
  }

  const modelOverride = typeof body.modelId === "string" ? body.modelId : undefined;
  const forceRegenerate = body.forceRegenerate === true;
  const modelId = resolveModelId(modelOverride);
  const promptVersion = PROMPT_VERSION;

  // ---- 1) Cache hit -------------------------------------------------------
  if (!forceRegenerate) {
    const cached = getCachedPlan(inputHash, modelId, promptVersion);
    if (cached) {
      logMetadata("cache-hit", {
        modelId,
        promptVersion,
        inputHash,
        latencyMs: 0,
      });
      return NextResponse.json({
        ok: true,
        source: "cache" as const,
        plan: cached.plan,
        modelId: cached.modelId,
        promptVersion: cached.promptVersion,
        inputHash: cached.inputHash,
        latencyMs: cached.latencyMs,
        generatedAt: cached.generatedAt,
      });
    }
  }

  // ---- 2) LLM not configured -> deterministic-only ------------------------
  if (!isLLMConfigured()) {
    return deterministicResponse({
      modelId,
      promptVersion,
      inputHash,
      warning:
        "OPENAI_API_KEY not set on this deployment; serving deterministic-only view.",
    });
  }

  // ---- 3) Generate (with one repair retry) --------------------------------
  let lastError: unknown = null;
  let lastValidationReasons: string[] | null = null;
  let lastRawText: string | null = null;
  let repairUsed = false;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await generateCrossTowerPlan(prompt, {
        model: modelOverride,
        repair:
          attempt === 1 && lastValidationReasons && lastRawText
            ? {
                previousOutput: lastRawText,
                reasons: lastValidationReasons,
              }
            : undefined,
      });
      // Cache only validated outputs.
      const entry = buildCacheEntry({
        plan: result.plan,
        modelId: result.modelId,
        promptVersion: result.promptVersion,
        inputHash,
        latencyMs: result.latencyMs,
        tokenUsage: result.tokenUsage,
      });
      putCachedPlan(entry);
      logMetadata(repairUsed ? "llm-repair-success" : "llm-success", {
        modelId: result.modelId,
        promptVersion: result.promptVersion,
        inputHash,
        latencyMs: result.latencyMs,
        tokenUsage: result.tokenUsage,
      });
      return NextResponse.json({
        ok: true,
        source: "llm" as const,
        plan: entry.plan,
        modelId: entry.modelId,
        promptVersion: entry.promptVersion,
        inputHash: entry.inputHash,
        latencyMs: entry.latencyMs,
        generatedAt: entry.generatedAt,
      });
    } catch (e) {
      lastError = e;
      if (e instanceof ValidationError) {
        lastValidationReasons = e.reasons;
        lastRawText = e.rawText;
        repairUsed = true;
        continue;
      }
      // Non-validation error — break and fall through to deterministic.
      break;
    }
  }

  const errMsg =
    lastError instanceof CrossTowerPlanLLMError
      ? lastError.message
      : lastError instanceof Error
        ? lastError.message
        : "Unknown LLM error";
  logMetadata("llm-failure", { modelId, promptVersion, inputHash, latencyMs: 0 });
  return deterministicResponse({
    modelId,
    promptVersion,
    inputHash,
    warning: `Generation unavailable — showing data-only view. ${errMsg}`,
  });
}

// ===========================================================================
//   Helpers
// ===========================================================================

function deterministicResponse(args: {
  modelId: string;
  promptVersion: string;
  inputHash: string;
  warning: string;
}): NextResponse {
  return NextResponse.json({
    ok: true,
    source: "deterministic" as const,
    narrativeUnavailable: true,
    plan: null,
    modelId: args.modelId,
    promptVersion: args.promptVersion,
    inputHash: args.inputHash,
    latencyMs: 0,
    generatedAt: new Date().toISOString(),
    warning: args.warning,
  });
}

function sanitizePromptInput(raw: unknown): BuildPromptInput | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const initiativesRaw = Array.isArray(r.initiatives) ? r.initiatives : [];
  const initiatives: PromptKeyInitiative[] = [];
  for (const item of initiativesRaw) {
    if (!item || typeof item !== "object") continue;
    const it = item as Record<string, unknown>;
    const id = typeof it.id === "string" ? it.id.trim() : "";
    const towerName = typeof it.towerName === "string" ? it.towerName.trim() : "";
    const name = typeof it.name === "string" ? it.name.trim() : "";
    const capabilityPath =
      typeof it.capabilityPath === "string" ? it.capabilityPath.trim() : "";
    const tier = sanitizeTier(it.tier);
    const aiPriority =
      typeof it.aiPriority === "string" ? it.aiPriority.trim() : undefined;
    const programTierReason =
      typeof it.programTierReason === "string"
        ? it.programTierReason.trim()
        : undefined;
    const rationale =
      typeof it.rationale === "string" ? it.rationale.trim() : undefined;
    if (!id || !name || !towerName) continue;
    initiatives.push({
      id,
      towerName,
      name,
      capabilityPath,
      tier,
      programTierReason,
      aiPriority,
      rationale,
    });
  }
  if (!initiatives.length) return null;

  const phaseMembership: Record<string, Tier | null> = {};
  if (r.phaseMembership && typeof r.phaseMembership === "object") {
    for (const [k, v] of Object.entries(r.phaseMembership as Record<string, unknown>)) {
      phaseMembership[k] = sanitizeTier(v);
    }
  } else {
    // Derive from initiatives if not explicitly provided.
    for (const i of initiatives) phaseMembership[i.id] = i.tier;
  }

  // Optional Deprioritized context — used only for narrative grounding.
  const deprioritizedRaw = Array.isArray(r.deprioritized) ? r.deprioritized : [];
  const deprioritized: BuildPromptInput["deprioritized"] = [];
  for (const item of deprioritizedRaw) {
    if (!item || typeof item !== "object") continue;
    const it = item as Record<string, unknown>;
    const id = typeof it.id === "string" ? it.id.trim() : "";
    const towerName = typeof it.towerName === "string" ? it.towerName.trim() : "";
    const name = typeof it.name === "string" ? it.name.trim() : "";
    const capabilityPath =
      typeof it.capabilityPath === "string" ? it.capabilityPath.trim() : "";
    const programTierReason =
      typeof it.programTierReason === "string"
        ? it.programTierReason.trim()
        : "";
    if (!id || !name || !towerName) continue;
    deprioritized.push({ id, towerName, name, capabilityPath, programTierReason });
  }

  const towersRaw = Array.isArray(r.towersInScope) ? r.towersInScope : [];
  const towersInScope: BuildPromptInput["towersInScope"] = [];
  for (const t of towersRaw) {
    if (!t || typeof t !== "object") continue;
    const tt = t as Record<string, unknown>;
    const id = typeof tt.id === "string" ? tt.id : "";
    const name = typeof tt.name === "string" ? tt.name : "";
    const initiativeCount =
      typeof tt.initiativeCount === "number" && Number.isFinite(tt.initiativeCount)
        ? Math.max(0, Math.floor(tt.initiativeCount))
        : 0;
    if (!id || !name) continue;
    towersInScope.push({ id, name, initiativeCount });
  }

  const vendorStackRaw = Array.isArray(r.vendorStack) ? r.vendorStack : [];
  const vendorStack: BuildPromptInput["vendorStack"] = [];
  for (const v of vendorStackRaw) {
    if (!v || typeof v !== "object") continue;
    const vv = v as Record<string, unknown>;
    const vendor = typeof vv.vendor === "string" ? vv.vendor.trim() : "";
    const count =
      typeof vv.count === "number" && Number.isFinite(vv.count)
        ? Math.max(0, Math.floor(vv.count))
        : 0;
    if (vendor) vendorStack.push({ vendor, count });
  }

  const orchestrationMixRaw = Array.isArray(r.orchestrationMix) ? r.orchestrationMix : [];
  const orchestrationMix: BuildPromptInput["orchestrationMix"] = [];
  for (const o of orchestrationMixRaw) {
    if (!o || typeof o !== "object") continue;
    const oo = o as Record<string, unknown>;
    const pattern = typeof oo.pattern === "string" ? oo.pattern : "";
    const count =
      typeof oo.count === "number" && Number.isFinite(oo.count)
        ? Math.max(0, Math.floor(oo.count))
        : 0;
    if (pattern) orchestrationMix.push({ pattern, count });
  }

  return {
    initiatives,
    phaseMembership,
    deprioritized: deprioritized.length > 0 ? deprioritized : undefined,
    towersInScope,
    vendorStack,
    orchestrationMix,
  };
}

function sanitizeTier(v: unknown): Tier | null {
  if (v === "P1" || v === "P2" || v === "P3") return v;
  return null;
}

async function isAuthed(): Promise<boolean> {
  const token = cookies().get(AUTH_COOKIE_NAME)?.value;
  return isValidSessionToken(token);
}

/**
 * Metadata-only logger. Captures `modelId`, `promptVersion`, `inputHash`,
 * `latencyMs`, and (optional) `tokenUsage`. Never the prompt body or
 * generated text — keeps client-confidential workshop content out of logs.
 */
function logMetadata(
  event: string,
  meta: {
    modelId: string;
    promptVersion: string;
    inputHash: string;
    latencyMs: number;
    tokenUsage?: { prompt?: number; completion?: number; total?: number };
  },
): void {
  if (process.env.NODE_ENV === "test") return;
  const fields = [
    `event=${event}`,
    `modelId=${meta.modelId}`,
    `promptVersion=${meta.promptVersion}`,
    `inputHash=${meta.inputHash}`,
    `latencyMs=${meta.latencyMs}`,
  ];
  if (meta.tokenUsage) {
    if (meta.tokenUsage.prompt != null) fields.push(`promptTokens=${meta.tokenUsage.prompt}`);
    if (meta.tokenUsage.completion != null) fields.push(`completionTokens=${meta.tokenUsage.completion}`);
    if (meta.tokenUsage.total != null) fields.push(`totalTokens=${meta.tokenUsage.total}`);
  }
  // eslint-disable-next-line no-console
  console.info(`[forge.crossTowerAiPlan] ${fields.join(" ")}`);
}
