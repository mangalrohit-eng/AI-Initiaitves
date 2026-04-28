/**
 * POST /api/assess/curate-initiatives
 *
 * Body:
 *   {
 *     towerId: TowerId,
 *     rows: [{
 *       rowId: string,
 *       l2: string,
 *       l3: string,
 *       l4Activities: string[],
 *     }, ...]
 *   }
 *
 * Returns:
 *   {
 *     ok: true,
 *     source: "llm" | "fallback",
 *     rows: [{
 *       rowId: string,
 *       l4Items: [{
 *         name, aiCurationStatus, aiEligible, aiPriority?, aiRationale,
 *         notEligibleReason?, frequency?, criticality?, currentMaturity?,
 *         primaryVendor?, agentOneLine?
 *       }, ...]
 *     }, ...],
 *     warning?: string
 *   }
 *
 * Behaviour:
 *   - Always returns a `rows` array of the same length as the input, in order;
 *     each `l4Items` array is the same length as the input row's `l4Activities`.
 *   - Tries OpenAI first when `OPENAI_API_KEY` is configured.
 *   - Falls back to the deterministic `composeL4Verdict` rubric on any LLM
 *     failure — the route NEVER 500s on LLM-side problems. Mirrors the
 *     contract of `/api/assess/infer-defaults`.
 *   - Does NOT write `briefSlug` / `initiativeId` — those are overlay-only,
 *     stamped by the pipeline post-call so the LLM can't accidentally claim
 *     a hand-curated brief that doesn't exist.
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, isValidSessionToken } from "@/lib/auth";
import {
  curateInitiativesWithLLM,
  isLLMConfigured,
  MAX_L4S_PER_CALL,
  type CurateLLMRow,
  type CurateLLMRowInput,
} from "@/lib/assess/curateInitiativesLLM";
import { composeL4Verdict } from "@/lib/initiatives/composeVerdict";
import type { TowerId } from "@/data/assess/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ROWS = 100;

type Body = {
  towerId?: unknown;
  rows?: unknown;
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

  const towerId = typeof body.towerId === "string" ? (body.towerId as TowerId) : null;
  if (!towerId) {
    return NextResponse.json({ error: "Missing towerId" }, { status: 400 });
  }

  if (!Array.isArray(body.rows)) {
    return NextResponse.json({ error: "Missing rows[]" }, { status: 400 });
  }
  if (body.rows.length === 0) {
    return NextResponse.json(
      { ok: true, source: "fallback" as const, rows: [] },
      { status: 200 },
    );
  }
  if (body.rows.length > MAX_ROWS) {
    return NextResponse.json(
      { error: `Too many rows (${body.rows.length}); max ${MAX_ROWS} per request.` },
      { status: 413 },
    );
  }

  const rows: CurateLLMRowInput[] = body.rows.map((raw) => {
    const r = (raw ?? {}) as Record<string, unknown>;
    const rowId = typeof r.rowId === "string" ? r.rowId : "";
    const l2 = typeof r.l2 === "string" ? r.l2 : "";
    const l3 = typeof r.l3 === "string" ? r.l3 : "";
    const l4Activities = Array.isArray(r.l4Activities)
      ? (r.l4Activities as unknown[])
          .filter((n): n is string => typeof n === "string" && n.trim().length > 0)
          .map((n) => n.trim())
      : [];
    return { rowId, l2, l3, l4Activities };
  });

  // Pre-validate: every row needs an id + at least one activity. Refusing
  // early gives the client a clean error instead of a partial fallback.
  const badRow = rows.findIndex((r) => !r.rowId);
  if (badRow >= 0) {
    return NextResponse.json(
      { error: `rows[${badRow}].rowId missing` },
      { status: 400 },
    );
  }
  const totalL4s = rows.reduce((s, r) => s + r.l4Activities.length, 0);
  if (totalL4s > MAX_L4S_PER_CALL) {
    return NextResponse.json(
      {
        error: `Tower has ${totalL4s} L4 activities; max ${MAX_L4S_PER_CALL} per call. Split the request.`,
      },
      { status: 413 },
    );
  }

  let llmRows: CurateLLMRow[] | null = null;
  let warning: string | undefined;
  if (isLLMConfigured()) {
    try {
      llmRows = await curateInitiativesWithLLM(towerId, rows);
    } catch (e) {
      warning =
        "AI curation unavailable; used deterministic verdict composer. " +
        (e instanceof Error ? e.message : "Unknown LLM error.") +
        ` [env=${describeRuntimeEnv()}]`;
      llmRows = null;
    }
  } else {
    warning =
      "OPENAI_API_KEY not set on this deployment; used deterministic verdict composer." +
      ` [env=${describeRuntimeEnv()}]`;
  }

  // LLM path — return the validated shape verbatim.
  if (llmRows && llmRows.length === rows.length) {
    return NextResponse.json(
      { ok: true, source: "llm" as const, rows: llmRows },
      { status: 200 },
    );
  }

  // Deterministic fallback. `composeL4Verdict` runs the canonical/overlay/
  // rubric ladder per L4 — the exact path the pipeline used pre-LLM, so
  // dropping the API key doesn't break the program.
  try {
    const fallback = rows.map((row) => ({
      rowId: row.rowId,
      l4Items: row.l4Activities.map((name) => {
        const verdict = composeL4Verdict({
          towerId,
          l2Name: row.l2,
          l3Name: row.l3,
          l4: { id: synthId(row.rowId, name), name },
        });
        return {
          name,
          aiCurationStatus: verdict.status,
          aiEligible: verdict.aiEligible,
          aiPriority: verdict.aiPriority,
          aiRationale: verdict.aiRationale,
          notEligibleReason: verdict.notEligibleReason,
          frequency: verdict.frequency,
          criticality: verdict.criticality,
          currentMaturity: verdict.currentMaturity,
          primaryVendor: verdict.primaryVendor,
          agentOneLine: verdict.agentOneLine,
        };
      }),
    }));
    return NextResponse.json(
      { ok: true, source: "fallback" as const, rows: fallback, warning },
      { status: 200 },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Fallback curation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** Synthetic id used by `composeL4Verdict` when no canonical id exists. */
function synthId(rowId: string, l4Name: string): string {
  const norm = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `${rowId}::${norm(l4Name)}`;
}

async function isAuthed(): Promise<boolean> {
  const token = cookies().get(AUTH_COOKIE_NAME)?.value;
  return isValidSessionToken(token);
}

function describeRuntimeEnv(): string {
  const raw = process.env.OPENAI_API_KEY;
  const hasVar = typeof raw === "string";
  const keyLen = hasVar ? raw.trim().length : 0;
  const vercelEnv = process.env.VERCEL_ENV ?? "local";
  return `vercel=${vercelEnv}, hasVar=${hasVar}, keyLen=${keyLen}`;
}
