/**
 * POST /api/cross-tower-ai-plan/generate
 *
 * Cross-Tower AI Plan v6 — single program-synthesis call against the
 * curated L3 AI Solution roster.
 *
 * Request body:
 *   {
 *     inputHash: string;                  // selectInitiativesForProgramV6 inputHash
 *     assumptionsHash: string;            // hashAssumptions(...)
 *     initiatives: SynthesisV6PromptInitiative[];
 *     towers: { id: string; name: string }[];
 *     assumptions: CrossTowerAssumptions;
 *     modelId?: string;
 *     synthesisIntakeDigest?: string;
 *   }
 *
 * Response:
 *   {
 *     ok: true;
 *     schema: "v6";
 *     synthesis: ProgramSynthesisV6 | null;
 *     narratives: V6Narrative[];
 *     synthesisStatus: "ok" | "stub";
 *     modelId: string;
 *     promptVersion: string;
 *     inputHash: string;
 *     assumptionsHash: string;
 *     latencyMs: number;
 *     generatedAt: string;
 *     warnings?: string[];
 *   }
 *
 * Behaviour:
 *   - Auth: same `forge_session` cookie as the rest of /api routes.
 *   - When LLM is not configured, returns a 200 with `synthesis: null`,
 *     `synthesisStatus: "stub"`, and a single `warning`. The client
 *     renders the deterministic-only view.
 *   - On any LLM exception inside `generateProgramSynthesisV6`, the page
 *     still renders — the response carries `synthesisStatus: "stub"`.
 *   - Logs metadata only — never the prompt body or generated text.
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, isValidSessionToken } from "@/lib/auth";
import {
  generateProgramSynthesisV6,
  PROGRAM_SYNTHESIS_V6_PROMPT_VERSION,
  isLLMConfigured as isLLMConfiguredV6,
  resolveModelId as resolveModelIdV6,
  type ProgramSynthesisV6Status,
} from "@/lib/llm/programSynthesisV6LLM";
import {
  clampAssumptions,
  type CrossTowerAssumptions,
} from "@/lib/cross-tower/assumptions";
import { TOWER_READINESS_MAX_DIGEST_CHARS } from "@/lib/assess/towerReadinessIntake";
import type { SynthesisV6PromptInitiative } from "@/lib/llm/prompts/crossTowerInitiativePlan.v1";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Allow up to 5 minutes — covers the program-synthesis call + a
// structured-repair retry.
export const maxDuration = 300;

const MAX_INITIATIVES_V6 = 200;
const MAX_TOWERS_V6 = 13;

type Body = {
  inputHash?: unknown;
  assumptionsHash?: unknown;
  initiatives?: unknown;
  towers?: unknown;
  assumptions?: unknown;
  modelId?: unknown;
  synthesisIntakeDigest?: unknown;
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
  const assumptionsHash =
    typeof body.assumptionsHash === "string" ? body.assumptionsHash : "";
  if (!assumptionsHash) {
    return NextResponse.json(
      { error: "Missing assumptionsHash" },
      { status: 400 },
    );
  }

  const assumptions = sanitizeAssumptions(body.assumptions);
  if (!assumptions) {
    return NextResponse.json(
      { error: "Missing or invalid assumptions" },
      { status: 400 },
    );
  }

  const modelOverride =
    typeof body.modelId === "string" ? body.modelId : undefined;
  const digestRaw =
    typeof body.synthesisIntakeDigest === "string"
      ? body.synthesisIntakeDigest.trim()
      : "";
  const synthesisIntakeDigest = digestRaw
    ? digestRaw.slice(0, TOWER_READINESS_MAX_DIGEST_CHARS * 2)
    : undefined;

  const v6Initiatives = sanitizeInitiativesV6(body.initiatives);
  const v6Towers = sanitizeTowersV6(body.towers);
  if (!v6Initiatives) {
    return NextResponse.json(
      { error: "Missing or invalid initiatives" },
      { status: 400 },
    );
  }
  if (!v6Towers) {
    return NextResponse.json(
      { error: "Missing or invalid towers" },
      { status: 400 },
    );
  }
  const modelId = resolveModelIdV6(modelOverride);
  if (v6Initiatives.length === 0) {
    return NextResponse.json({
      ok: true,
      schema: "v6" as const,
      synthesis: null,
      narratives: [],
      synthesisStatus: "stub" as ProgramSynthesisV6Status,
      modelId,
      promptVersion: PROGRAM_SYNTHESIS_V6_PROMPT_VERSION,
      inputHash,
      assumptionsHash,
      latencyMs: 0,
      generatedAt: new Date().toISOString(),
      warnings: [
        "No in-plan initiatives — adjust the threshold in Assumptions to include more L3 Job Family rows.",
      ],
    });
  }

  if (!isLLMConfiguredV6()) {
    return NextResponse.json({
      ok: true,
      schema: "v6" as const,
      synthesis: null,
      narratives: [],
      synthesisStatus: "stub" as ProgramSynthesisV6Status,
      modelId,
      promptVersion: PROGRAM_SYNTHESIS_V6_PROMPT_VERSION,
      inputHash,
      assumptionsHash,
      latencyMs: 0,
      generatedAt: new Date().toISOString(),
      warnings: [
        "OPENAI_API_KEY not set on this deployment; serving deterministic-only view.",
      ],
    });
  }

  try {
    const result = await generateProgramSynthesisV6({
      initiatives: v6Initiatives,
      towers: v6Towers,
      assumptions,
      modelOverride,
      synthesisIntakeDigest,
    });
    logMetadataV6("ok", {
      modelId: result.modelId,
      promptVersion: result.promptVersion,
      inputHash,
      latencyMs: result.latencyMs,
      initiativeCount: v6Initiatives.length,
      synthesisStatus: result.status,
    });
    return NextResponse.json({
      ok: true,
      schema: "v6" as const,
      synthesis: result.synthesis,
      narratives: result.narratives,
      synthesisStatus: result.status,
      modelId: result.modelId,
      promptVersion: result.promptVersion,
      inputHash,
      assumptionsHash,
      latencyMs: result.latencyMs,
      generatedAt: new Date().toISOString(),
      warnings: result.warnings.length > 0 ? result.warnings : undefined,
    });
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : "Unknown LLM error";
    logMetadataV6("failure", {
      modelId,
      promptVersion: PROGRAM_SYNTHESIS_V6_PROMPT_VERSION,
      inputHash,
      latencyMs: 0,
      initiativeCount: v6Initiatives.length,
      synthesisStatus: "stub",
    });
    return NextResponse.json({
      ok: true,
      schema: "v6" as const,
      synthesis: null,
      narratives: [],
      synthesisStatus: "stub" as ProgramSynthesisV6Status,
      modelId,
      promptVersion: PROGRAM_SYNTHESIS_V6_PROMPT_VERSION,
      inputHash,
      assumptionsHash,
      latencyMs: 0,
      generatedAt: new Date().toISOString(),
      warnings: [`Generation unavailable — showing data-only view. ${errMsg}`],
    });
  }
}

// ===========================================================================
//   Sanitization
// ===========================================================================

function sanitizeAssumptions(raw: unknown): CrossTowerAssumptions | null {
  if (!raw || typeof raw !== "object") return null;
  return clampAssumptions(raw as Partial<CrossTowerAssumptions>);
}

async function isAuthed(): Promise<boolean> {
  const token = cookies().get(AUTH_COOKIE_NAME)?.value;
  return isValidSessionToken(token);
}

function logMetadataV6(
  event: string,
  meta: {
    modelId: string;
    promptVersion: string;
    inputHash: string;
    latencyMs: number;
    initiativeCount: number;
    synthesisStatus: string;
  },
): void {
  if (process.env.NODE_ENV === "test") return;
  const fields = [
    `event=${event}`,
    `modelId=${meta.modelId}`,
    `promptVersion=${meta.promptVersion}`,
    `inputHash=${meta.inputHash}`,
    `latencyMs=${meta.latencyMs}`,
    `initiatives=${meta.initiativeCount}`,
    `synthesis=${meta.synthesisStatus}`,
  ];
  // eslint-disable-next-line no-console
  console.info(`[forge.crossTowerAiPlan.v6] ${fields.join(" ")}`);
}

function sanitizeInitiativesV6(
  raw: unknown,
): SynthesisV6PromptInitiative[] | null {
  if (!Array.isArray(raw)) return null;
  const out: SynthesisV6PromptInitiative[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const id = stringField(r.id);
    const towerName = stringField(r.towerName);
    const l3FamilyName = stringField(r.l3FamilyName);
    const solutionName = stringField(r.solutionName);
    const tagline = stringField(r.tagline);
    const aiRationale = stringField(r.aiRationale);
    if (!id || !towerName || !l3FamilyName || !solutionName) continue;
    const feasibility =
      r.feasibility === "High" || r.feasibility === "Low"
        ? r.feasibility
        : "High";
    const quadrantRaw = r.quadrant;
    const quadrant =
      quadrantRaw === "Quick Win" ||
      quadrantRaw === "Strategic Bet" ||
      quadrantRaw === "Fill-in" ||
      quadrantRaw === "Deprioritize"
        ? quadrantRaw
        : "Quick Win";
    const programTier =
      r.programTier === "P1" || r.programTier === "P2" || r.programTier === "P3"
        ? r.programTier
        : "P1";
    const primaryVendor = stringField(r.primaryVendor) || undefined;
    out.push({
      id,
      towerName,
      l3FamilyName,
      solutionName,
      tagline,
      aiRationale,
      feasibility,
      quadrant,
      programTier,
      primaryVendor,
    });
    if (out.length >= MAX_INITIATIVES_V6) break;
  }
  return out;
}

function sanitizeTowersV6(raw: unknown): { id: string; name: string }[] | null {
  if (!Array.isArray(raw)) return null;
  const out: { id: string; name: string }[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const id = stringField(r.id);
    const name = stringField(r.name);
    if (!id || !name) continue;
    out.push({ id, name });
    if (out.length >= MAX_TOWERS_V6) break;
  }
  return out;
}

function stringField(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
