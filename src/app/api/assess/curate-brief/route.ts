/**
 * POST /api/assess/curate-brief
 *
 * Body:
 *   {
 *     towerId: TowerId,
 *     l2: string,
 *     l3: string,
 *     l4Name: string,
 *     aiRationale: string,
 *     agentOneLine?: string,
 *     primaryVendor?: string,
 *   }
 *
 * Returns:
 *   {
 *     ok: true,
 *     source: "llm" | "fallback",
 *     brief: {
 *       preState: string,
 *       postState: string,
 *       agentsInvolved: { name: string; role: string }[],
 *       toolsRequired: string[],
 *       keyMetric: string,
 *       generatedAt: string,
 *       source: "llm" | "fallback",
 *     },
 *     warning?: string,
 *   }
 *
 * Behaviour:
 *   - Tries OpenAI first when `OPENAI_API_KEY` is configured.
 *   - Falls back to a deterministic Versant-flavored brief on any LLM
 *     failure so the page always renders. The fallback is intentionally
 *     spare — it tells the user what to fill in next, rather than
 *     fabricating financials.
 *   - Mirrors the contract of `/api/assess/curate-initiatives`. Server is
 *     stateless: input carries the L4 + parent context so we don't need to
 *     read the persisted assess program.
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, isValidSessionToken } from "@/lib/auth";
import {
  curateBriefWithLLM,
  isLLMConfigured,
  type CurateBriefLLMInput,
} from "@/lib/assess/curateBriefLLM";
import type { GeneratedBrief, TowerId } from "@/data/assess/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  towerId?: unknown;
  l2?: unknown;
  l3?: unknown;
  l4Name?: unknown;
  aiRationale?: unknown;
  agentOneLine?: unknown;
  primaryVendor?: unknown;
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
  const l2 = typeof body.l2 === "string" ? body.l2.trim() : "";
  const l3 = typeof body.l3 === "string" ? body.l3.trim() : "";
  const l4Name = typeof body.l4Name === "string" ? body.l4Name.trim() : "";
  const aiRationale =
    typeof body.aiRationale === "string" ? body.aiRationale.trim() : "";
  if (!l2 || !l3 || !l4Name || !aiRationale) {
    return NextResponse.json(
      { error: "Missing l2 / l3 / l4Name / aiRationale" },
      { status: 400 },
    );
  }
  const agentOneLine =
    typeof body.agentOneLine === "string" && body.agentOneLine.trim()
      ? body.agentOneLine.trim()
      : undefined;
  const primaryVendor =
    typeof body.primaryVendor === "string" && body.primaryVendor.trim()
      ? body.primaryVendor.trim()
      : undefined;

  const input: CurateBriefLLMInput = {
    towerId,
    l2,
    l3,
    l4Name,
    aiRationale,
    agentOneLine,
    primaryVendor,
  };

  let warning: string | undefined;
  if (isLLMConfigured()) {
    try {
      const result = await curateBriefWithLLM(input);
      const brief: GeneratedBrief = {
        ...result,
        generatedAt: new Date().toISOString(),
        source: "llm",
      };
      return NextResponse.json(
        { ok: true, source: "llm" as const, brief },
        { status: 200 },
      );
    } catch (e) {
      warning =
        "AI brief generation unavailable; rendered the deterministic placeholder. " +
        (e instanceof Error ? e.message : "Unknown LLM error.") +
        ` [env=${describeRuntimeEnv()}]`;
    }
  } else {
    warning =
      "OPENAI_API_KEY not set on this deployment; rendered the deterministic placeholder." +
      ` [env=${describeRuntimeEnv()}]`;
  }

  // Deterministic fallback. Intentionally spare — the user knows the brief
  // wasn't LLM-generated and the page surfaces the warning. We don't
  // fabricate financials or agent specifics; we hand back a placeholder
  // shape that respects the Versant content rules ("TBD — subject to
  // discovery" rather than invented dollars).
  const brief: GeneratedBrief = {
    preState: `${l3} → ${l4Name} runs manually today across ${towerId.replace(/-/g, " ")} workstreams. Cycle time, exception rate, and headcount cost — TBD — subject to discovery during the deeper assessment.`,
    postState: `${agentOneLine ?? "An agent stack"} replaces the routine work. Humans focus on review, exceptions, and edge cases. Specific savings — TBD — subject to discovery.`,
    agentsInvolved: [
      {
        name: "Primary Agent",
        role:
          agentOneLine ??
          "Executes the routine workflow end-to-end and surfaces exceptions for human review.",
      },
    ],
    toolsRequired: primaryVendor
      ? [primaryVendor]
      : ["TBD — subject to discovery"],
    keyMetric: "TBD — subject to discovery",
    generatedAt: new Date().toISOString(),
    source: "fallback",
  };

  return NextResponse.json(
    { ok: true, source: "fallback" as const, brief, warning },
    { status: 200 },
  );
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
