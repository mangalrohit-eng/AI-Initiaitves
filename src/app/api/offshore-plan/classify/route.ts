/**
 * POST /api/offshore-plan/classify
 *
 * Body:
 *   {
 *     inputHash: string,                  // client-computed hash; used for caching
 *     forceRegenerate?: boolean,          // bypass cache
 *     modelId?: string,                   // override env-resolved model
 *     context: {
 *       primaryGccCity: string,
 *       secondaryGccCity: string,
 *       contactCenterHub: string,
 *     },
 *     rows: LLMOffshoreRowInput[],        // ALL rows the client wants classified
 *                                         // (carved-out rows must be filtered
 *                                         //  out before sending — this route
 *                                         //  treats every input row as
 *                                         //  classifiable).
 *   }
 *
 * Returns:
 *   {
 *     ok: true,
 *     source: "llm" | "cache" | "heuristic",
 *     rows: LLMOffshoreRowResult[],
 *     modelId: string,
 *     promptVersion: string,
 *     inputHash: string,
 *     generatedAt: string,
 *     warning?: string,
 *   }
 *
 * NEVER 500s on LLM-side errors. Falls back to a deterministic heuristic
 * matching the selector's classifyRow() so the page always renders.
 */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, isValidSessionToken } from "@/lib/auth";
import {
  buildOffshoreClassifyCacheEntry,
  getCachedOffshoreClassify,
  putCachedOffshoreClassify,
} from "@/lib/llm/offshorePlanCache";
import {
  buildOffshoreHeuristicFallback,
  inferOffshoreClassifyWithLLM,
  isOffshoreLLMConfigured,
  resolveOffshoreModel,
} from "@/lib/llm/offshorePlanLLM";
import type {
  LLMOffshoreLane,
  LLMOffshoreRowInput,
} from "@/lib/llm/prompts/offshorePlan.v1";
import { PROMPT_VERSION } from "@/lib/llm/prompts/offshorePlan.v1";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// We chunk + run in parallel server-side, so the per-request cap is
// generous. The Versant program has ~150 L3 rows total; 500 leaves
// headroom for future capability-map expansions without re-tuning.
const MAX_ROWS = 500;

const TOWER_DEFAULTS: Record<string, LLMOffshoreLane | "EditorialCarveOut"> = {
  finance: "GccEligible",
  hr: "GccEligible",
  "research-analytics": "GccWithOverlay",
  legal: "GccWithOverlay",
  "corp-services": "GccEligible",
  "tech-engineering": "GccEligible",
  "operations-technology": "GccWithOverlay",
  sales: "OnshoreRetained",
  "marketing-comms": "GccWithOverlay",
  service: "GccEligible",
  "editorial-news": "EditorialCarveOut",
  production: "EditorialCarveOut",
  "programming-dev": "OnshoreRetained",
};

type ClassifyBody = {
  inputHash?: unknown;
  forceRegenerate?: unknown;
  modelId?: unknown;
  context?: unknown;
  rows?: unknown;
};

export async function POST(req: Request) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: ClassifyBody;
  try {
    body = (await req.json()) as ClassifyBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const inputHash = typeof body.inputHash === "string" ? body.inputHash : null;
  if (!inputHash) {
    return NextResponse.json({ error: "Missing inputHash" }, { status: 400 });
  }
  const rows = sanitizeRows(body.rows);
  if (!rows) {
    return NextResponse.json({ error: "Missing rows[]" }, { status: 400 });
  }
  if (rows.length === 0) {
    return NextResponse.json(
      {
        ok: true,
        source: "heuristic" as const,
        rows: [],
        modelId: resolveOffshoreModel({}),
        promptVersion: PROMPT_VERSION,
        inputHash,
        generatedAt: new Date().toISOString(),
      },
      { status: 200 },
    );
  }
  if (rows.length > MAX_ROWS) {
    return NextResponse.json(
      { error: `Too many rows (${rows.length}); max ${MAX_ROWS} per request.` },
      { status: 413 },
    );
  }

  const ctx = sanitizeContext(body.context);
  const modelId =
    typeof body.modelId === "string" && body.modelId.trim()
      ? body.modelId.trim()
      : resolveOffshoreModel({});
  const forceRegenerate = body.forceRegenerate === true;

  // Cache hit (skip when forceRegenerate).
  if (!forceRegenerate) {
    const cached = getCachedOffshoreClassify(inputHash, modelId, PROMPT_VERSION);
    if (cached) {
      return NextResponse.json(
        {
          ok: true,
          source: "cache" as const,
          rows: cached.rows,
          modelId: cached.modelId,
          promptVersion: cached.promptVersion,
          inputHash: cached.inputHash,
          generatedAt: cached.generatedAt,
        },
        { status: 200 },
      );
    }
  }

  // LLM path.
  let warning: string | undefined;
  if (isOffshoreLLMConfigured()) {
    try {
      const result = await inferOffshoreClassifyWithLLM(rows, ctx, { model: modelId });
      const entry = buildOffshoreClassifyCacheEntry({
        rows: result.rows,
        modelId: result.modelId,
        promptVersion: result.promptVersion,
        inputHash,
        latencyMs: result.latencyMs,
        tokenUsage: result.tokenUsage,
      });
      putCachedOffshoreClassify(entry);
      return NextResponse.json(
        {
          ok: true,
          source: "llm" as const,
          rows: result.rows,
          modelId: result.modelId,
          promptVersion: result.promptVersion,
          inputHash,
          generatedAt: entry.generatedAt,
        },
        { status: 200 },
      );
    } catch (e) {
      warning =
        "AI classification unavailable; used deterministic heuristic. " +
        (e instanceof Error ? e.message : "Unknown LLM error.") +
        ` [env=${describeRuntimeEnv()}]`;
    }
  } else {
    warning =
      "OPENAI_API_KEY not set on this deployment; used deterministic heuristic." +
      ` [env=${describeRuntimeEnv()}]`;
  }

  // Surface the fallback reason in the dev server log too — operators
  // shouldn't have to open the browser and click "Heuristic fallback —
  // why?" to diagnose.
  console.warn("[offshore-plan/classify] heuristic fallback:", warning);

  // Heuristic fallback. The fallback never throws — it's a pure mapping.
  const fallbackRows = buildOffshoreHeuristicFallback(rows, TOWER_DEFAULTS);
  return NextResponse.json(
    {
      ok: true,
      source: "heuristic" as const,
      rows: fallbackRows,
      modelId,
      promptVersion: PROMPT_VERSION,
      inputHash,
      generatedAt: new Date().toISOString(),
      warning,
    },
    { status: 200 },
  );
}

async function isAuthed(): Promise<boolean> {
  const token = cookies().get(AUTH_COOKIE_NAME)?.value;
  return isValidSessionToken(token);
}

function sanitizeRows(raw: unknown): LLMOffshoreRowInput[] | null {
  if (!Array.isArray(raw)) return null;
  const out: LLMOffshoreRowInput[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    if (typeof o.rowId !== "string" || !o.rowId.trim()) continue;
    const hc = (o.headcount ?? {}) as Record<string, unknown>;
    out.push({
      rowId: o.rowId,
      towerId: typeof o.towerId === "string" ? o.towerId : "",
      towerName: typeof o.towerName === "string" ? o.towerName : "",
      l2: typeof o.l2 === "string" ? o.l2 : "",
      l3: typeof o.l3 === "string" ? o.l3 : "",
      l4Names: Array.isArray(o.l4Names)
        ? o.l4Names.filter((s): s is string => typeof s === "string")
        : [],
      headcount: {
        fteOnshore: numOr0(hc.fteOnshore),
        fteOffshore: numOr0(hc.fteOffshore),
        contractorOnshore: numOr0(hc.contractorOnshore),
        contractorOffshore: numOr0(hc.contractorOffshore),
      },
      dialPct:
        typeof o.dialPct === "number" && Number.isFinite(o.dialPct)
          ? o.dialPct
          : null,
      step2Rationale:
        typeof o.step2Rationale === "string" ? o.step2Rationale : undefined,
    });
  }
  return out;
}

function sanitizeContext(raw: unknown): {
  primaryGccCity: string;
  secondaryGccCity: string;
  contactCenterHub: string;
} {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    primaryGccCity:
      typeof o.primaryGccCity === "string" && o.primaryGccCity.trim()
        ? o.primaryGccCity
        : "Bangalore",
    secondaryGccCity:
      typeof o.secondaryGccCity === "string" && o.secondaryGccCity.trim()
        ? o.secondaryGccCity
        : "Pune",
    contactCenterHub:
      typeof o.contactCenterHub === "string" && o.contactCenterHub.trim()
        ? o.contactCenterHub
        : "Manila",
  };
}

function numOr0(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function describeRuntimeEnv(): string {
  const raw = process.env.OPENAI_API_KEY;
  const hasVar = typeof raw === "string";
  const keyLen = hasVar ? raw.trim().length : 0;
  const vercelEnv = process.env.VERCEL_ENV ?? "local";
  return `vercel=${vercelEnv}, hasVar=${hasVar}, keyLen=${keyLen}`;
}
