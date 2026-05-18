/**
 * POST /api/cross-tower-ai-plan/strategist
 *
 * Body:
 *   {
 *     inputHash: string,                   // client-computed; includes scope
 *     forceRegenerate?: boolean,           // bypass server cache
 *     modelId?: string,                    // override env-resolved model
 *     input: StrategistPromptInput,        // built by buildStrategistInput()
 *   }
 *
 * Returns:
 *   {
 *     ok: true,
 *     source: "llm" | "cache" | "stub",
 *     outputs: StrategistOutputs | null,
 *     modelId: string,
 *     promptVersion: string,
 *     generatedAt: string,
 *     warnings?: string[],
 *   }
 *
 * Never 500s on LLM-side errors — falls back to a deterministic stub so
 * the page always renders.
 */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, isValidSessionToken } from "@/lib/auth";
import {
  generateStrategistOutputs,
  resolveModelId as resolveStrategistModel,
} from "@/lib/llm/strategistOutputsLLM";
import {
  getCachedStrategistOutputs,
  putCachedStrategistOutputs,
} from "@/lib/llm/strategistOutputsCache";
import { STRATEGIST_PROMPT_VERSION } from "@/lib/llm/prompts/strategistOutputs.v1";
import type { StrategistPromptInput } from "@/lib/llm/prompts/strategistOutputs.v1";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TOWERS = 20;

type StrategistBody = {
  inputHash?: unknown;
  forceRegenerate?: unknown;
  modelId?: unknown;
  input?: unknown;
};

export async function POST(req: Request) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: StrategistBody;
  try {
    body = (await req.json()) as StrategistBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const inputHash = typeof body.inputHash === "string" ? body.inputHash : null;
  if (!inputHash) {
    return NextResponse.json({ error: "Missing inputHash" }, { status: 400 });
  }
  const input = sanitizeInput(body.input);
  if (!input) {
    return NextResponse.json({ error: "Missing or malformed input" }, { status: 400 });
  }
  if (input.towers.length > MAX_TOWERS) {
    return NextResponse.json(
      { error: `Too many towers (${input.towers.length}); max ${MAX_TOWERS}.` },
      { status: 413 },
    );
  }
  const modelOverride =
    typeof body.modelId === "string" && body.modelId.trim()
      ? body.modelId.trim()
      : undefined;
  const modelId = resolveStrategistModel(modelOverride);
  const forceRegenerate = body.forceRegenerate === true;

  if (!forceRegenerate) {
    const cached = getCachedStrategistOutputs(
      inputHash,
      modelId,
      STRATEGIST_PROMPT_VERSION,
    );
    if (cached) {
      return NextResponse.json(
        {
          ok: true,
          source: "cache" as const,
          outputs: cached,
          modelId: cached.modelId,
          promptVersion: cached.promptVersion,
          generatedAt: cached.generatedAt,
        },
        { status: 200 },
      );
    }
  }

  const result = await generateStrategistOutputs({
    input,
    inputHash,
    modelOverride,
  });

  if (result.status === "ok" && result.outputs) {
    putCachedStrategistOutputs(result.outputs);
    return NextResponse.json(
      {
        ok: true,
        source: "llm" as const,
        outputs: result.outputs,
        modelId: result.modelId,
        promptVersion: result.promptVersion,
        generatedAt: result.outputs.generatedAt,
        warnings: result.warnings,
      },
      { status: 200 },
    );
  }

  // Stub fallback — emit an empty payload with the warnings so the UI can
  // explain why no clusters are rendering.
  return NextResponse.json(
    {
      ok: true,
      source: "stub" as const,
      outputs: null,
      modelId: result.modelId,
      promptVersion: result.promptVersion,
      generatedAt: new Date().toISOString(),
      warnings: result.warnings,
    },
    { status: 200 },
  );
}

async function isAuthed(): Promise<boolean> {
  const token = cookies().get(AUTH_COOKIE_NAME)?.value;
  return isValidSessionToken(token);
}

function sanitizeInput(raw: unknown): StrategistPromptInput | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const baseScopeLabel =
    typeof r.baseScopeLabel === "string" ? r.baseScopeLabel : "";
  if (!baseScopeLabel) return null;
  const towers = sanitizeTowers(r.towers);
  if (!towers) return null;
  const inFlightInitiatives = sanitizeInFlight(r.inFlightInitiatives);
  return { baseScopeLabel, towers, inFlightInitiatives };
}

function sanitizeTowers(raw: unknown): StrategistPromptInput["towers"] | null {
  if (!Array.isArray(raw)) return null;
  const out: StrategistPromptInput["towers"] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id : "";
    const name = typeof o.name === "string" ? o.name : "";
    if (!id || !name) continue;
    const hc =
      typeof o.inScopeHc === "number" && Number.isFinite(o.inScopeHc)
        ? o.inScopeHc
        : 0;
    const families = sanitizeFamilies(o.jobFamilies);
    out.push({
      id: id as StrategistPromptInput["towers"][number]["id"],
      name,
      inScopeHc: hc,
      jobFamilies: families,
    });
  }
  return out;
}

function sanitizeFamilies(
  raw: unknown,
): StrategistPromptInput["towers"][number]["jobFamilies"] {
  if (!Array.isArray(raw)) return [];
  const out: Array<{
    l2: string;
    l3: string;
    activities: string[];
    aiTools: string;
    constraints: string;
  }> = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const l2 = typeof o.l2 === "string" ? o.l2 : "";
    const l3 = typeof o.l3 === "string" ? o.l3 : "";
    if (!l3) continue;
    const activities = Array.isArray(o.activities)
      ? (o.activities as unknown[]).filter(
          (a): a is string => typeof a === "string",
        )
      : [];
    out.push({
      l2,
      l3,
      activities,
      aiTools: typeof o.aiTools === "string" ? o.aiTools : "",
      constraints: typeof o.constraints === "string" ? o.constraints : "",
    });
  }
  return out;
}

function sanitizeInFlight(
  raw: unknown,
): StrategistPromptInput["inFlightInitiatives"] {
  if (!Array.isArray(raw)) return [];
  const out: Array<{
    id: string;
    towerName: string;
    l3: string;
    solutionName: string;
    vendor?: string;
  }> = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id : "";
    const towerName = typeof o.towerName === "string" ? o.towerName : "";
    const l3 = typeof o.l3 === "string" ? o.l3 : "";
    const solutionName = typeof o.solutionName === "string" ? o.solutionName : "";
    // `id` was added in strategist.v1.1 so the LLM can anchor cross-
    // tower initiatives back to the tower-specific solution rows that
    // power them. Drop entries missing it — they're either pre-v1.1
    // payloads or malformed input.
    if (!id || !towerName || !l3 || !solutionName) continue;
    out.push({
      id,
      towerName,
      l3,
      solutionName,
      vendor: typeof o.vendor === "string" ? o.vendor : undefined,
    });
  }
  return out;
}
