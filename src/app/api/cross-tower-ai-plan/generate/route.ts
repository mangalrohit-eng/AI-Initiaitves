/**
 * POST /api/cross-tower-ai-plan/generate
 *
 * Cross-Tower AI Plan v3 — per-L4 fan-out + program-synthesis workflow.
 *
 * Request body:
 *   {
 *     inputHash: string;                  // selectInitiativesForProgram inputHash
 *     assumptionsHash: string;            // hashAssumptions(...)
 *     cohorts: L4Cohort[];                // pre-grouped by buildL4Cohorts() (engine-owned)
 *     assumptions: CrossTowerAssumptions; // for synthesis prompt timing context + lens emphases + briefDepth
 *     modelId?: string;                   // default gpt-5.5 via env chain
 *     forceRegenerate?: boolean;          // bypass all caches
 *     retryCohortIds?: string[];          // bypass cache for selected cohorts only (per-card retry)
 *   }
 *
 * Response:
 *   {
 *     ok: true;
 *     plan: CrossTowerAiPlanLLM | null;            // .projects[] + .synthesis
 *     cohortStatus: { l4RowId, status }[];
 *     synthesisStatus: "ok" | "stub" | "cache";
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
 *   - When LLM is not configured, returns a 200 with `plan: null`, every
 *     cohort marked `stub`, synthesis `stub`, and a single `warning`. The
 *     client renders the deterministic stubs.
 *   - On any LLM exception inside `generateCrossTowerPlan`, the page still
 *     renders — the errored cohorts return `status: "stub"` while the
 *     others return `status: "ok"` or `status: "cache"`.
 *   - Logs metadata only — never the prompt body or generated text.
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, isValidSessionToken } from "@/lib/auth";
import {
  generateCrossTowerPlan,
  isLLMConfigured,
  resolveModelId,
  PROMPT_VERSION,
  type CohortStatus,
  type SynthesisStatus,
} from "@/lib/llm/crossTowerPlanLLM";
import type { L4Cohort } from "@/lib/cross-tower/aiProjects";
import {
  clampAssumptions,
  type CrossTowerAssumptions,
} from "@/lib/cross-tower/assumptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Allow up to 5 minutes — covers the per-L4 fan-out (parallel) + the
// program-synthesis call + a structured-repair retry on each.
export const maxDuration = 300;

const MAX_COHORTS = 60;
const MAX_INITIATIVES_PER_COHORT = 25;

type Body = {
  inputHash?: unknown;
  assumptionsHash?: unknown;
  cohorts?: unknown;
  assumptions?: unknown;
  modelId?: unknown;
  forceRegenerate?: unknown;
  retryCohortIds?: unknown;
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

  const cohorts = sanitizeCohorts(body.cohorts);
  if (!cohorts) {
    return NextResponse.json(
      { error: "Missing or invalid cohorts" },
      { status: 400 },
    );
  }
  if (cohorts.length === 0) {
    return NextResponse.json(
      { error: "cohorts must not be empty" },
      { status: 400 },
    );
  }
  if (cohorts.length > MAX_COHORTS) {
    return NextResponse.json(
      {
        error: `Too many cohorts (${cohorts.length}); max ${MAX_COHORTS}.`,
      },
      { status: 413 },
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
  const forceRegenerate = body.forceRegenerate === true;
  const retryCohortIds = sanitizeRetryCohortIds(body.retryCohortIds);
  const modelId = resolveModelId(modelOverride);

  // ---- LLM not configured -> deterministic-only stubs --------------------
  if (!isLLMConfigured()) {
    return NextResponse.json({
      ok: true,
      plan: { projects: [], synthesis: null },
      cohortStatus: cohorts.map((c) => ({
        l4RowId: c.l4RowId,
        status: "stub" as const,
        reason: "OPENAI_API_KEY not set",
      })) as CohortStatus[],
      synthesisStatus: "stub" as SynthesisStatus,
      modelId,
      promptVersion: PROMPT_VERSION,
      inputHash,
      assumptionsHash,
      latencyMs: 0,
      generatedAt: new Date().toISOString(),
      warnings: [
        "OPENAI_API_KEY not set on this deployment; serving deterministic-only view.",
      ],
    });
  }

  // ---- Generate ----------------------------------------------------------
  try {
    const result = await generateCrossTowerPlan({
      cohorts,
      assumptions,
      inputHash,
      modelOverride,
      forceRegenerate,
      retryCohortIds,
    });
    logMetadata("ok", {
      modelId: result.modelId,
      promptVersion: result.promptVersion,
      inputHash,
      latencyMs: result.totalLatencyMs,
      cohortCount: cohorts.length,
      stubCount: result.cohortStatus.filter((c) => c.status === "stub").length,
    });
    return NextResponse.json({
      ok: true,
      plan: result.plan,
      cohortStatus: result.cohortStatus,
      synthesisStatus: result.synthesisStatus,
      modelId: result.modelId,
      promptVersion: result.promptVersion,
      inputHash,
      assumptionsHash,
      latencyMs: result.totalLatencyMs,
      generatedAt: new Date().toISOString(),
      warnings: result.warnings.length > 0 ? result.warnings : undefined,
    });
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : "Unknown LLM error";
    logMetadata("failure", {
      modelId,
      promptVersion: PROMPT_VERSION,
      inputHash,
      latencyMs: 0,
      cohortCount: cohorts.length,
      stubCount: cohorts.length,
    });
    return NextResponse.json({
      ok: true,
      plan: { projects: [], synthesis: null },
      cohortStatus: cohorts.map((c) => ({
        l4RowId: c.l4RowId,
        status: "stub" as const,
        reason: errMsg,
      })) as CohortStatus[],
      synthesisStatus: "stub" as SynthesisStatus,
      modelId,
      promptVersion: PROMPT_VERSION,
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

function sanitizeCohorts(raw: unknown): L4Cohort[] | null {
  if (!Array.isArray(raw)) return null;
  const out: L4Cohort[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const l4RowId = typeof r.l4RowId === "string" ? r.l4RowId.trim() : "";
    const l4Name = typeof r.l4Name === "string" ? r.l4Name.trim() : "";
    const l3JobFamilyName =
      typeof r.l3JobFamilyName === "string" ? r.l3JobFamilyName.trim() : "";
    const towerId = typeof r.towerId === "string" ? r.towerId.trim() : "";
    const towerName =
      typeof r.towerName === "string" ? r.towerName.trim() : "";
    const l4AiUsd =
      typeof r.l4AiUsd === "number" && Number.isFinite(r.l4AiUsd)
        ? Math.max(0, r.l4AiUsd)
        : 0;
    const attributedAiUsdTotal =
      typeof r.attributedAiUsdTotal === "number" &&
      Number.isFinite(r.attributedAiUsdTotal)
        ? Math.max(0, r.attributedAiUsdTotal)
        : 0;
    if (!l4RowId || !l4Name || !towerId || !towerName) continue;
    const initsRaw = Array.isArray(r.l5Initiatives) ? r.l5Initiatives : [];
    const l5Initiatives: L4Cohort["l5Initiatives"] = [];
    for (const ii of initsRaw) {
      if (!ii || typeof ii !== "object") continue;
      const i = ii as Record<string, unknown>;
      const id = typeof i.id === "string" ? i.id.trim() : "";
      const name = typeof i.name === "string" ? i.name.trim() : "";
      const rationale =
        typeof i.rationale === "string" ? i.rationale.trim() : undefined;
      const attributedAiUsd =
        typeof i.attributedAiUsd === "number" && Number.isFinite(i.attributedAiUsd)
          ? Math.max(0, i.attributedAiUsd)
          : 0;
      const programTier = sanitizeProgramTier(i.programTier);
      if (!id || !name) continue;
      l5Initiatives.push({
        id,
        name,
        rationale,
        attributedAiUsd,
        programTier,
      });
      if (l5Initiatives.length >= MAX_INITIATIVES_PER_COHORT) break;
    }
    if (l5Initiatives.length === 0) continue;
    out.push({
      l4RowId,
      l4Name,
      l3JobFamilyName,
      towerId: towerId as L4Cohort["towerId"],
      towerName,
      l4AiUsd,
      attributedAiUsdTotal,
      l5Initiatives,
    });
  }
  return out;
}

function sanitizeProgramTier(
  raw: unknown,
): "P1" | "P2" | "P3" | "Deprioritized" {
  if (raw === "P1" || raw === "P2" || raw === "P3" || raw === "Deprioritized") {
    return raw;
  }
  return "P1";
}

function sanitizeAssumptions(raw: unknown): CrossTowerAssumptions | null {
  if (!raw || typeof raw !== "object") return null;
  return clampAssumptions(raw as Partial<CrossTowerAssumptions>);
}

function sanitizeRetryCohortIds(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (trimmed) out.push(trimmed);
  }
  return out.length > 0 ? out : undefined;
}

async function isAuthed(): Promise<boolean> {
  const token = cookies().get(AUTH_COOKIE_NAME)?.value;
  return isValidSessionToken(token);
}

function logMetadata(
  event: string,
  meta: {
    modelId: string;
    promptVersion: string;
    inputHash: string;
    latencyMs: number;
    cohortCount: number;
    stubCount: number;
  },
): void {
  if (process.env.NODE_ENV === "test") return;
  const fields = [
    `event=${event}`,
    `modelId=${meta.modelId}`,
    `promptVersion=${meta.promptVersion}`,
    `inputHash=${meta.inputHash}`,
    `latencyMs=${meta.latencyMs}`,
    `cohorts=${meta.cohortCount}`,
    `stubs=${meta.stubCount}`,
  ];
  // eslint-disable-next-line no-console
  console.info(`[forge.crossTowerAiPlan.v3] ${fields.join(" ")}`);
}
