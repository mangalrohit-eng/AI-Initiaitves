/**
 * POST /api/assess/generate-l4
 *
 * Body:
 *   {
 *     towerId: TowerId,
 *     rows: [{ l2: string, l3: string }, ...]
 *   }
 *
 * Returns:
 *   {
 *     ok: true,
 *     source: "llm" | "fallback",
 *     groups: [{ l2, l3, activities: string[] }, ...],
 *     warning?: string
 *   }
 *
 * Behaviour:
 *   - Always returns a `groups` array of the same length as `rows`, in order.
 *   - Tries OpenAI first when OPENAI_API_KEY is configured.
 *   - Falls back to the canonical capability map for matching (l2, l3) pairs;
 *     for L3s not in the canonical map, falls back to a 3-item generic list
 *     derived from the L3 name. The route NEVER returns an empty group.
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
import type { TowerId } from "@/data/assess/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ROWS = 200;

type GenerateL4Body = {
  towerId?: unknown;
  rows?: unknown;
};

type GroupResult = { l2: string; l3: string; activities: string[] };

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
    return {
      l2: typeof r.l2 === "string" ? r.l2 : "",
      l3: typeof r.l3 === "string" ? r.l3 : "",
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
      activities: g.activities.length > 0 ? g.activities : fallbackActivities(towerId, rows[i]),
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
 * Deterministic fallback: look up the canonical capability map for this tower
 * and pull L4 names whose (l2, l3) match (case-insensitive). When no match is
 * found, return three generic verb-noun activities derived from the L3 name.
 */
function fallbackActivities(towerId: TowerId, row: LLMGenerateL4Row): string[] {
  const map = getCapabilityMapForTower(towerId);
  if (map) {
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
  const base = row.l3.trim() || "Activities";
  return [
    `${base} — execution`,
    `${base} — review and exception handling`,
    `${base} — reporting`,
  ];
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
