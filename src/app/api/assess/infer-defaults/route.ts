/**
 * POST /api/assess/infer-defaults
 *
 * Scores per-row dial defaults (offshorePct + aiPct) for the Impact Levers
 * step. After the 5-layer migration the dial grain is **L4 Activity Group**
 * (formerly L3 Capability), so the canonical input row carries the full
 * `{ l2, l3, l4 }` path. Legacy 4-layer callers may still send `{ l2, l3 }`
 * and the server will treat `l3` as the dial-row label.
 *
 * Body:
 *   {
 *     towerId: TowerId,
 *     rows: [{ l2: string, l3: string, l4?: string }, ...]
 *   }
 *
 * Returns:
 *   {
 *     ok: true,
 *     source: "llm" | "heuristic",
 *     defaults: [{
 *       offshorePct: number,
 *       aiPct: number,
 *       offshoreRationale?: string,  // LLM-only — ≤15 words
 *       aiRationale?: string,        // LLM-only — ≤15 words
 *     }, ...],
 *     warning?: string  // present when we wanted LLM but had to fall back
 *   }
 *
 * Behaviour:
 *   - Always returns a `defaults` array of the same length as `rows`, in order.
 *   - Tries OpenAI first when OPENAI_API_KEY is configured.
 *   - On any LLM failure (no key, network, timeout, malformed JSON, length mismatch)
 *     transparently falls back to the deterministic heuristic in
 *     `seedAssessmentDefaults.ts`.  The route NEVER 500s on LLM-side problems.
 *   - 4xx for malformed input / unauthorised; 5xx is reserved for unexpected
 *     server bugs (e.g., the heuristic itself throws).
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, isValidSessionToken } from "@/lib/auth";
import {
  inferL3Defaults,
  type L3Defaults,
} from "@/data/assess/seedAssessmentDefaults";
import {
  inferTowerDefaultsWithLLM,
  isLLMConfigured,
  type LLMRowInput,
  type LLMRowResult,
} from "@/lib/assess/inferDefaultsLLM";
import type { TowerId } from "@/data/assess/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ROWS = 300;

type InferDefaultsBody = {
  towerId?: unknown;
  rows?: unknown;
};

type RowDefault = L3Defaults & {
  /** ≤15-word Versant rationale for the offshore dial. */
  offshoreRationale?: string;
  /** ≤15-word Versant rationale for the AI-impact dial. */
  aiRationale?: string;
};

export async function POST(req: Request) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: InferDefaultsBody;
  try {
    body = (await req.json()) as InferDefaultsBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const towerId = typeof body.towerId === "string" ? (body.towerId as TowerId) : null;
  if (!towerId) {
    return NextResponse.json({ error: "Missing towerId" }, { status: 400 });
  }

  if (!Array.isArray(body.rows)) {
    return NextResponse.json({ error: "Missing rows[]" }, { status: 400 });
  }
  if (body.rows.length === 0) {
    return NextResponse.json(
      { ok: true, source: "heuristic" as const, defaults: [] },
      { status: 200 },
    );
  }
  if (body.rows.length > MAX_ROWS) {
    return NextResponse.json(
      { error: `Too many rows (${body.rows.length}); max ${MAX_ROWS} per request.` },
      { status: 413 },
    );
  }

  const rows: LLMRowInput[] = body.rows.map((raw) => {
    const r = (raw ?? {}) as Record<string, unknown>;
    const l4 = typeof r.l4 === "string" ? r.l4 : "";
    return {
      l2: typeof r.l2 === "string" ? r.l2 : "",
      l3: typeof r.l3 === "string" ? r.l3 : "",
      l4: l4 || undefined,
    };
  });

  // Try LLM first when configured. On ANY failure, fall back to the
  // deterministic heuristic — the program must never lose this CTA.
  let llmDefaults: LLMRowResult[] | null = null;
  let warning: string | undefined;
  if (isLLMConfigured()) {
    try {
      llmDefaults = await inferTowerDefaultsWithLLM(towerId, rows);
    } catch (e) {
      warning =
        "AI inference unavailable; used deterministic heuristic. " +
        (e instanceof Error ? e.message : "Unknown LLM error.") +
        ` [env=${describeRuntimeEnv()}]`;
      llmDefaults = null;
    }
  } else {
    warning =
      "OPENAI_API_KEY not set on this deployment; used deterministic heuristic." +
      ` [env=${describeRuntimeEnv()}]`;
  }

  if (llmDefaults && llmDefaults.length === rows.length) {
    const defaults: RowDefault[] = llmDefaults.map((d) => ({
      offshorePct: d.offshorePct,
      aiPct: d.aiPct,
      offshoreRationale: d.offshoreRationale,
      aiRationale: d.aiRationale,
    }));
    return NextResponse.json(
      { ok: true, source: "llm" as const, defaults },
      { status: 200 },
    );
  }

  // Heuristic fallback. Wrapped in try/catch only because it's the last line
  // of defence — if the heuristic itself throws, that IS a 500.
  // No rationales on the heuristic path — the client substitutes the
  // deterministic `rowStarterRationale` text and stamps `dialsRationaleSource:
  // "heuristic"`.
  try {
    // Heuristic still scores on the dial-row label. In V5, that's L4
    // (Activity Group); fall back to L3 when callers didn't send L4 (legacy
    // V4 callers) so the deterministic path still works during cutover.
    const defaults: RowDefault[] = rows.map((r) =>
      inferL3Defaults(towerId, r.l3 || r.l2, r.l4 || r.l3),
    );
    return NextResponse.json(
      { ok: true, source: "heuristic" as const, defaults, warning },
      { status: 200 },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Heuristic failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function isAuthed(): Promise<boolean> {
  const token = cookies().get(AUTH_COOKIE_NAME)?.value;
  return isValidSessionToken(token);
}

/**
 * Compact runtime env description embedded in fallback warnings so the user
 * can tell, from the toast alone, whether the OPENAI_API_KEY is missing on
 * Production vs Preview vs local, and whether the var is undefined or just
 * blank/whitespace. Never leaks the key value itself.
 */
function describeRuntimeEnv(): string {
  const raw = process.env.OPENAI_API_KEY;
  const hasVar = typeof raw === "string";
  const keyLen = hasVar ? raw.trim().length : 0;
  const vercelEnv = process.env.VERCEL_ENV ?? "local";
  return `vercel=${vercelEnv}, hasVar=${hasVar}, keyLen=${keyLen}`;
}
