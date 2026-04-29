/**
 * POST /api/assess/curate-brief
 *
 * Body:
 *   {
 *     towerId: TowerId,
 *     l2: string,
 *     l3: string,
 *     l4Name: string,
 *     l4Id: string,
 *     aiRationale: string,
 *     agentOneLine?: string,
 *     primaryVendor?: string,
 *   }
 *
 * Returns:
 *   {
 *     ok: true,
 *     source: "llm" | "fallback",
 *     generatedProcess: { process: Process, generatedAt, source },
 *     warning?: string,
 *   }
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, isValidSessionToken } from "@/lib/auth";
import {
  buildFallbackProcess,
  curateBriefWithLLM,
  getCurateBriefInferenceMeta,
  isLLMConfigured,
  type CurateBriefLLMInput,
} from "@/lib/assess/curateBriefLLM";
import type { GeneratedProcessCache, TowerId } from "@/data/assess/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Body = {
  towerId?: unknown;
  l2?: unknown;
  l3?: unknown;
  l4Name?: unknown;
  l4Id?: unknown;
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
  const l4Id = typeof body.l4Id === "string" ? body.l4Id.trim() : "";
  const aiRationale =
    typeof body.aiRationale === "string" ? body.aiRationale.trim() : "";
  if (!l2 || !l3 || !l4Name || !l4Id || !aiRationale) {
    return NextResponse.json(
      { error: "Missing l2 / l3 / l4Name / l4Id / aiRationale" },
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
    l4Id,
    aiRationale,
    agentOneLine,
    primaryVendor,
  };

  let warning: string | undefined;
  if (isLLMConfigured()) {
    try {
      const process = await curateBriefWithLLM(input);
      const inf = getCurateBriefInferenceMeta();
      const generatedProcess: GeneratedProcessCache = {
        process,
        generatedAt: new Date().toISOString(),
        source: "llm",
        inference: { model: inf.model, mode: inf.mode },
      };
      return NextResponse.json(
        { ok: true, source: "llm" as const, generatedProcess },
        { status: 200 },
      );
    } catch (e) {
      warning =
        "AI process generation unavailable; rendered the deterministic placeholder. " +
        (e instanceof Error ? e.message : "Unknown LLM error.") +
        ` [env=${describeRuntimeEnv()}]`;
    }
  } else {
    warning =
      "OPENAI_API_KEY not set on this deployment; rendered the deterministic placeholder." +
      ` [env=${describeRuntimeEnv()}]`;
  }

  const process = buildFallbackProcess(input);
  const generatedProcess: GeneratedProcessCache = {
    process,
    generatedAt: new Date().toISOString(),
    source: "fallback",
  };

  return NextResponse.json(
    { ok: true, source: "fallback" as const, generatedProcess, warning },
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
