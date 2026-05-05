/**
 * POST /api/assess/generate-l4
 *
 * (URL kept for back-compat; semantics are now generate-L5 — one batch per
 * Activity Group, returning L5 Activity names.)
 *
 * Body:
 *   {
 *     towerId: TowerId,
 *     rows: [
 *       { l2: string,   // L2 Job Grouping (prompt context)
 *         l3: string,   // L3 Job Family   (prompt context)
 *         l4?: string,  // L4 Activity Group — the row being scored. Optional
 *                       // for legacy v4 callers; if omitted we treat l3 as
 *                       // the parent.
 *         feedback?: string },
 *       ...
 *     ]
 *   }
 *
 * Returns:
 *   {
 *     ok: true,
 *     source: "llm" | "fallback",
 *     groups: [{ l2, l3, l4, activities: string[] }, ...],
 *     warning?: string
 *   }
 *
 * Behaviour:
 *   - Always returns a `groups` array of the same length as `rows`, in order.
 *   - Tries OpenAI first when OPENAI_API_KEY is configured.
 *   - Falls back to the canonical capability map for matching (l3 Job Family,
 *     l4 Activity Group) pairs (or, for v4 callers, `(l2, l3)`); for rows
 *     not in the canonical map, falls back to a 3-item generic list derived
 *     from the parent name. The route NEVER returns an empty group.
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, isValidSessionToken } from "@/lib/auth";
import {
  generateL4ActivitiesWithLLM,
  isLLMConfigured,
  type LLMGenerateL4Row,
  type LLMGenerateL4Result,
} from "@/lib/assess/generateL4ActivitiesLLM";
import { getCapabilityMapForTower } from "@/data/capabilityMap/maps";
import { resolveRowDescriptions } from "@/data/capabilityMap/descriptions";
import type { TowerId } from "@/data/assess/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ROWS = 200;
const MAX_FEEDBACK_CHARS = 600;

type GenerateL4Body = {
  towerId?: unknown;
  rows?: unknown;
};

type GroupResult = {
  l2: string;
  l3: string;
  /** L4 Activity Group; empty string for legacy v4 callers (no `l4` in input). */
  l4: string;
  activities: string[];
};

export async function POST(req: Request) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: GenerateL4Body;
  try {
    body = (await req.json()) as GenerateL4Body;
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
      { ok: true, source: "fallback" as const, groups: [] },
      { status: 200 },
    );
  }
  if (body.rows.length > MAX_ROWS) {
    return NextResponse.json(
      { error: `Too many rows (${body.rows.length}); max ${MAX_ROWS} per request.` },
      { status: 413 },
    );
  }

  const rows: LLMGenerateL4Row[] = body.rows.map((raw) => {
    const r = (raw ?? {}) as Record<string, unknown>;
    const fbRaw = typeof r.feedback === "string" ? r.feedback.trim() : "";
    const feedback = fbRaw ? fbRaw.slice(0, MAX_FEEDBACK_CHARS) : undefined;
    const l4 = typeof r.l4 === "string" ? r.l4 : "";
    const l2 = typeof r.l2 === "string" ? r.l2 : "";
    const l3 = typeof r.l3 === "string" ? r.l3 : "";
    // Resolve per-row L2/L3/L4 narrative context from the canonical
    // map. Empty bundle (towers without descriptions) is skipped in
    // the LLM module's prompt builder — no behavior change there.
    const desc = resolveRowDescriptions(towerId, l2, l3, l4 || undefined);
    return {
      l2,
      l3,
      ...(l4 ? { l4 } : {}),
      ...(feedback ? { feedback } : {}),
      ...(desc.l2Description ? { l2Description: desc.l2Description } : {}),
      ...(desc.l3Description ? { l3Description: desc.l3Description } : {}),
      ...(desc.l4Description ? { l4Description: desc.l4Description } : {}),
    };
  });

  let llmGroups: LLMGenerateL4Result[] | null = null;
  let warning: string | undefined;
  if (isLLMConfigured()) {
    try {
      llmGroups = await generateL4ActivitiesWithLLM(towerId, rows);
    } catch (e) {
      warning =
        "AI generation unavailable; used canonical capability map. " +
        (e instanceof Error ? e.message : "Unknown LLM error.") +
        ` [env=${describeRuntimeEnv()}]`;
      llmGroups = null;
    }
  } else {
    warning =
      "OPENAI_API_KEY not set on this deployment; used canonical capability map." +
      ` [env=${describeRuntimeEnv()}]`;
  }

  if (llmGroups && llmGroups.length === rows.length) {
    const groups: GroupResult[] = llmGroups.map((g, i) => ({
      l2: rows[i].l2,
      l3: rows[i].l3,
      l4: rows[i].l4 ?? "",
      activities:
        g.activities.length > 0 ? g.activities : fallbackActivities(towerId, rows[i]),
    }));
    return NextResponse.json(
      { ok: true, source: "llm" as const, groups },
      { status: 200 },
    );
  }

  try {
    const groups: GroupResult[] = rows.map((r) => ({
      l2: r.l2,
      l3: r.l3,
      l4: r.l4 ?? "",
      activities: fallbackActivities(towerId, r),
    }));
    return NextResponse.json(
      { ok: true, source: "fallback" as const, groups, warning },
      { status: 200 },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Fallback generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * Deterministic fallback: look up the canonical capability map for this
 * tower and pull L5 Activity names whose (L3 Job Family, L4 Activity Group)
 * match (case-insensitive). For legacy v4 callers (no `l4` in input), treat
 * `l3` as the parent and walk the canonical map's L4 names instead.
 *
 * When no canonical match is found, return a SINGLE-element list whose name
 * mirrors the L4 Activity Group label (or the deepest available parent).
 * Pre-PR2 we returned three synthetic suffixes (`"— execution"`, `"— review
 * and exception handling"`, `"— reporting"`) which read as filler and
 * polluted Step 4 with repetitive look-alike L5s. The honest signal when
 * we have no map coverage is "the activity itself is the only leaf" — one
 * row, named after the Activity Group, which Step 4 then scores as a
 * single AI initiative candidate.
 */
function fallbackActivities(towerId: TowerId, row: LLMGenerateL4Row): string[] {
  const map = getCapabilityMapForTower(towerId);
  const l4Name = row.l4 ?? "";
  if (map) {
    if (l4Name) {
      // V5 path: walk to the matching Activity Group and emit its L5 list.
      for (const l2 of map.l2) {
        for (const l3 of l2.l3) {
          if (l3.name.trim().toLowerCase() !== row.l3.trim().toLowerCase()) {
            continue;
          }
          const l4Match = l3.l4.find(
            (x) => x.name.trim().toLowerCase() === l4Name.trim().toLowerCase(),
          );
          if (l4Match && l4Match.l5.length > 0) {
            return l4Match.l5.map((x) => x.name);
          }
        }
      }
    } else {
      // V4 fallback: caller only sent (l2, l3); walk to that L3 and emit
      // the L4 names (which used to be the leaf level pre-migration).
      const l2Match = map.l2.find(
        (x) => x.name.trim().toLowerCase() === row.l2.trim().toLowerCase(),
      );
      if (l2Match) {
        const l3Match = l2Match.l3.find(
          (x) => x.name.trim().toLowerCase() === row.l3.trim().toLowerCase(),
        );
        if (l3Match && l3Match.l4.length > 0) {
          return l3Match.l4.map((x) => x.name);
        }
      }
    }
  }
  const base = (l4Name || row.l3 || "Activities").trim();
  return [base];
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
