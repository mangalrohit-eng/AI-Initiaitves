/**
 * POST /api/assess/curate-initiatives
 *
 * Curates the candidate AI initiatives for each row in a tower. Under the
 * 5-layer capability map (`AssessProgramV5`) the row is an **L4 Activity
 * Group** and the leaves being scored are **L5 Activities**.
 *
 * Wire-format back-compat: the request payload accepts BOTH the new
 * `l5Activities` field and the legacy `l4Activities` field per row. The
 * response uses `l5Items` as the canonical key — older clients reading
 * `l4Items` should migrate; callers in this repo were updated as part of
 * the V5 cutover.
 *
 * Body:
 *   {
 *     towerId: TowerId,
 *     rows: [{
 *       rowId: string,
 *       l2: string,                  // V5: L2 Job Grouping
 *       l3: string,                  // V5: L3 Job Family
 *       l4?: string,                 // V5: L4 Activity Group — STRONGLY recommended;
 *                                    //     omitting it makes the LLM and the rubric
 *                                    //     misclassify L5 leaves (often as not-eligible).
 *       l5Activities?: string[],     // V5: L5 Activities to score
 *       l4Activities?: string[],     // legacy alias for `l5Activities`
 *     }, ...]
 *   }
 *
 * Returns:
 *   {
 *     ok: true,
 *     source: "llm" | "fallback",
 *     rows: [{
 *       rowId: string,
 *       l5Items: [{
 *         name, aiCurationStatus, aiEligible, feasibility?, aiRationale,
 *         notEligibleReason?, frequency?, criticality?, currentMaturity?,
 *         primaryVendor?, agentOneLine?
 *       }, ...]
 *     }, ...],
 *     warning?: string
 *   }
 *
 * Behaviour:
 *   - Always returns a `rows` array of the same length as the input, in order;
 *     each `l5Items` array is the same length as the input row's L5 Activities.
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
const MAX_FEEDBACK_CHARS = 600;

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
    // V5 L4 Activity Group — the dial-bearing parent of the L5 leaves.
    // Strongly recommended; if absent we let the LLM/rubric fall back to
    // using `l3` as the parent (legacy v4 caller path) which lowers
    // scoring fidelity but keeps the call valid.
    const l4Raw = typeof r.l4 === "string" ? r.l4.trim() : "";
    const l4 = l4Raw || undefined;
    // Accept both the new `l5Activities` (post-5-layer-migration) and the
    // legacy `l4Activities` payload key so older clients keep working
    // through the cutover. Prefer the new key when both are present.
    const rawActivities = Array.isArray(r.l5Activities)
      ? (r.l5Activities as unknown[])
      : Array.isArray(r.l4Activities)
        ? (r.l4Activities as unknown[])
        : [];
    const l5Activities = rawActivities
      .filter((n): n is string => typeof n === "string" && n.trim().length > 0)
      .map((n) => n.trim());
    const fbRaw = typeof r.feedback === "string" ? r.feedback.trim() : "";
    const feedback = fbRaw ? fbRaw.slice(0, MAX_FEEDBACK_CHARS) : undefined;
    return {
      rowId,
      l2,
      l3,
      ...(l4 ? { l4 } : {}),
      l5Activities,
      ...(feedback ? { feedback } : {}),
    };
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
  const totalL5s = rows.reduce((s, r) => s + r.l5Activities.length, 0);
  if (totalL5s > MAX_L4S_PER_CALL) {
    return NextResponse.json(
      {
        error: `Tower has ${totalL5s} L5 Activities; max ${MAX_L4S_PER_CALL} per call. Split the request.`,
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
  //
  // Layer mapping into the composer (which keeps V4-era parameter names):
  //   composer.l2Name  ←  row.l3   (V5 Job Family — the bucket signal)
  //   composer.l3Name  ←  row.l4   (V5 Activity Group — the row signal)
  //                                  Fallback: row.l3 when l4 is absent.
  //   composer.l4      ←  the L5 leaf being scored
  // Without this mapping the rubric collapsed two layers and tagged most
  // L5s as `pending-discovery` (aiEligible=false), which surfaced as "all
  // AI initiatives empty" in the UI after a regen.
  try {
    const fallback = rows.map((row) => ({
      rowId: row.rowId,
      l5Items: row.l5Activities.map((name) => {
        const verdict = composeL4Verdict({
          towerId,
          l2Name: row.l3,
          l3Name: row.l4 ?? row.l3,
          l4: { id: synthId(row.rowId, name), name },
        });
        return {
          name,
          aiCurationStatus: verdict.status,
          aiEligible: verdict.aiEligible,
          // Pass through the binary feasibility computed in composeL4Verdict.
          // We deliberately do NOT echo the legacy `aiPriority` field — the
          // CuratedL4 schema dropped it; the back-compat map runs inside
          // composeL4Verdict so feasibility is already populated for every
          // canonical / overlay / rubric path.
          feasibility: verdict.feasibility,
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
