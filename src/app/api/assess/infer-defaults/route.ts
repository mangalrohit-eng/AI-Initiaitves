/**
 * POST /api/assess/infer-defaults
 *
 * Body:
 *   {
 *     towerId: TowerId,
 *     rows: [{ l2: string, l3: string, l4: string }, ...]
 *   }
 *
 * Returns:
 *   {
 *     ok: true,
 *     source: "llm" | "heuristic",
 *     defaults: [{ offshorePct: number, aiPct: number, rationale?: string }, ...],
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
  inferL4Defaults,
  type L4Defaults,
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

type RowDefault = L4Defaults & { rationale?: string };

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
    return {
      l2: typeof r.l2 === "string" ? r.l2 : "",
      l3: typeof r.l3 === "string" ? r.l3 : "",
      l4: typeof r.l4 === "string" ? r.l4 : "",
    };
  });

  // Try LLM first when configured. On ANY failure, fall back to the
  // deterministic heuristic — the workshop must never lose this CTA.
  let llmDefaults: LLMRowResult[] | null = null;
  let warning: string | undefined;
  if (isLLMConfigured()) {
    try {
      llmDefaults = await inferTowerDefaultsWithLLM(towerId, rows);
    } catch (e) {
      warning =
        "AI inference unavailable; used deterministic heuristic. " +
        (e instanceof Error ? e.message : "Unknown LLM error.");
      llmDefaults = null;
    }
  } else {
    warning = "OPENAI_API_KEY not set; used deterministic heuristic.";
  }

  if (llmDefaults && llmDefaults.length === rows.length) {
    const defaults: RowDefault[] = llmDefaults.map((d) => ({
      offshorePct: d.offshorePct,
      aiPct: d.aiPct,
      rationale: d.rationale,
    }));
    return NextResponse.json(
      { ok: true, source: "llm" as const, defaults },
      { status: 200 },
    );
  }

  // Heuristic fallback. Wrapped in try/catch only because it's the last line
  // of defence — if the heuristic itself throws, that IS a 500.
  try {
    const defaults: RowDefault[] = rows.map((r) => inferL4Defaults(towerId, r.l2, r.l3, r.l4));
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
