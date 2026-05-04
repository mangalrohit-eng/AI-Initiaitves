/**
 * Cross-Tower AI Plan v3 — end-to-end probe.
 *
 * Logs in to the local dev server, builds a real L4 cohort set from the
 * deterministic assess seed, POSTs to /api/cross-tower-ai-plan/generate,
 * and writes the JSON response to disk for inspection.
 *
 * Usage (from forge-tower-explorer):
 *   BASE_URL=http://localhost:3000 npx tsx scripts/testCrossTowerPlan.ts
 *
 * Optional env:
 *   FORGE_USERNAME / FORGE_PASSWORD — override the workshop login (defaults
 *     to Towerlead / ACN2026, matching the AUTH defaults).
 *   CROSS_TOWER_PLAN_OUTPUT — path to write the JSON response. Defaults to
 *     `scripts/.out/cross-tower-plan-response.json`.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import type { AssessProgramV2 } from "@/data/assess/types";
import { getAssessProgramHydrationSnapshot } from "@/lib/localStore";
import { selectInitiativesForProgram } from "@/lib/initiatives/selectProgram";
import type {
  AIProjectLLM,
  CrossTowerAiPlanLLM,
} from "@/lib/cross-tower/aiProjects";
import { buildL4Cohorts } from "@/lib/cross-tower/aiProjects";
import {
  DEFAULT_ASSUMPTIONS,
  hashAssumptions,
} from "@/lib/cross-tower/assumptions";
import { composeProjects } from "@/lib/cross-tower/composeProjects";
import type { CohortStatus } from "@/lib/llm/crossTowerPlanLLM";

const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const USERNAME = process.env.FORGE_USERNAME ?? "Towerlead";
const PASSWORD = process.env.FORGE_PASSWORD ?? "ACN2026";
const OUT_PATH =
  process.env.CROSS_TOWER_PLAN_OUTPUT ??
  path.resolve("scripts/.out/cross-tower-plan-response.json");

function cookieHeaderFromLoginResponse(res: Response): string {
  const ns: ((this: Headers) => string[]) | undefined =
    (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie;
  const lines = typeof ns === "function" ? ns.call(res.headers) : [];
  if (lines.length === 0) {
    const single = res.headers.get("set-cookie");
    if (single) {
      return single
        .split(",")
        .map((p) => p.trim().split(";")[0])
        .join("; ");
    }
  }
  return lines.map((l) => l.split(";")[0]).join("; ");
}

async function login(): Promise<string> {
  const res = await fetch(`${BASE}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  });
  if (!res.ok) {
    throw new Error(
      `Login failed (${res.status}): ${(await res.text()).slice(0, 200)}`,
    );
  }
  const cookie = cookieHeaderFromLoginResponse(res);
  if (!cookie.includes("forge_session=")) {
    throw new Error(`Missing forge_session cookie. Got: ${cookie}`);
  }
  return cookie;
}

async function main(): Promise<void> {
  console.log(`[probe] BASE=${BASE}`);
  console.log(`[probe] Logging in as ${USERNAME}…`);
  const cookie = await login();
  console.log(`[probe] Authenticated.`);

  // ------- Build the deterministic substrate ----------------------------
  // Pull the live assess program from the DB via /api/assess so the cohorts
  // mirror what the page renders, not the empty hydration seed.
  const seed = await loadAssessProgram(cookie);
  const program = selectInitiativesForProgram(seed, {
    aiUsdThreshold: DEFAULT_ASSUMPTIONS.planThresholdUsd,
  });
  const cohorts = buildL4Cohorts(program);
  console.log(
    `[probe] Substrate ready · in-plan initiatives=${program.initiatives.length} cohorts=${cohorts.length} threshold=$${DEFAULT_ASSUMPTIONS.planThresholdUsd.toLocaleString()}`,
  );

  if (cohorts.length === 0) {
    throw new Error("No cohorts after threshold — cannot probe LLM authoring.");
  }

  // ------- POST to the generate endpoint --------------------------------
  const body = {
    inputHash: program.inputHash,
    assumptionsHash: hashAssumptions(DEFAULT_ASSUMPTIONS),
    cohorts,
    assumptions: DEFAULT_ASSUMPTIONS,
    forceRegenerate: true,
  };
  console.log(`[probe] Posting to /api/cross-tower-ai-plan/generate…`);
  const t0 = Date.now();
  const res = await fetch(`${BASE}/api/cross-tower-ai-plan/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie,
    },
    body: JSON.stringify(body),
  });
  const elapsed = Date.now() - t0;
  console.log(`[probe] Server responded in ${elapsed}ms with status ${res.status}.`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error (${res.status}): ${text.slice(0, 800)}`);
  }
  const json = (await res.json()) as Record<string, unknown>;

  // ------- Persist response ---------------------------------------------
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(json, null, 2));
  console.log(`[probe] Response written to ${OUT_PATH}`);

  // ------- Quick stdout summary -----------------------------------------
  const plan = (json.plan ?? null) as
    | { projects?: unknown[]; synthesis?: unknown }
    | null;
  const cohortStatus = (json.cohortStatus ?? []) as Array<{
    l4RowId: string;
    status: string;
    reason?: string;
  }>;
  const synthesisStatus = json.synthesisStatus as string | undefined;
  const warnings = (json.warnings ?? []) as string[];
  const projectsAuthored = Array.isArray(plan?.projects)
    ? (plan!.projects as unknown[]).length
    : 0;
  const stubCount = cohortStatus.filter((c) => c.status === "stub").length;
  const okCount = cohortStatus.filter(
    (c) => c.status === "ok" || c.status === "cache",
  ).length;

  console.log("");
  console.log(`[probe] === Summary ===`);
  console.log(`[probe] modelId=${json.modelId} promptVersion=${json.promptVersion}`);
  console.log(`[probe] cohorts requested = ${cohorts.length}`);
  console.log(`[probe] projects authored = ${projectsAuthored}`);
  console.log(`[probe] cohort status     = ok/cache:${okCount} stub:${stubCount}`);
  console.log(`[probe] synthesisStatus   = ${synthesisStatus}`);
  console.log(`[probe] server latencyMs  = ${json.latencyMs}`);
  if (warnings.length > 0) {
    console.log(`[probe] warnings (${warnings.length}):`);
    for (const w of warnings) console.log(`   - ${w}`);
  }
  if (stubCount > 0) {
    console.log("");
    console.log(`[probe] Stubbed cohorts (with reason):`);
    for (const c of cohortStatus) {
      if (c.status === "stub") {
        console.log(`   - ${c.l4RowId}: ${c.reason ?? "(no reason)"}`);
      }
    }
  }

  // ------- Compose client-side and inspect quadrant distribution -------
  const initiativesById = new Map(
    program.initiatives.map((row) => [row.id, row]),
  );
  const llmProjects = (plan?.projects ?? []) as AIProjectLLM[];
  const composed = composeProjects({
    cohorts,
    projects: llmProjects,
    cohortStatus: cohortStatus as CohortStatus[],
    initiativesById,
    assumptions: DEFAULT_ASSUMPTIONS,
  });

  // LLM-authored bucket distribution (pre-rebalance, the legacy view).
  const llmDist = { "Quick Win": 0, "Strategic Bet": 0, "Fill-in": 0, Deprioritize: 0 };
  for (const p of llmProjects) {
    const v = p.valueBucket;
    const e = p.effortBucket;
    if (v === "High" && e === "Low") llmDist["Quick Win"]++;
    else if (v === "High" && e === "High") llmDist["Strategic Bet"]++;
    else if (v === "Low" && e === "Low") llmDist["Fill-in"]++;
    else if (v === "Low" && e === "High") llmDist["Deprioritize"]++;
  }
  // Composed (median-split) distribution — what the UI now renders.
  const composedDist = {
    "Quick Win": 0,
    "Strategic Bet": 0,
    "Fill-in": 0,
    Deprioritize: 0,
    Stub: 0,
  };
  for (const p of composed) {
    if (p.isStub) {
      composedDist.Stub++;
      continue;
    }
    if (p.quadrant) composedDist[p.quadrant]++;
  }

  console.log("");
  console.log(`[probe] === Quadrant distribution ===`);
  console.log(`[probe] LLM-as-authored (pre-split):`);
  for (const [q, n] of Object.entries(llmDist)) {
    console.log(`   ${q.padEnd(15)} ${n}`);
  }
  console.log(`[probe] After portfolio median split:`);
  for (const [q, n] of Object.entries(composedDist)) {
    console.log(`   ${q.padEnd(15)} ${n}`);
  }
  console.log("");
  console.log(`[probe] Per-project bucket detail:`);
  for (const p of composed) {
    if (p.isStub) {
      console.log(`   STUB        · ${p.name}`);
      continue;
    }
    console.log(
      `   ${p.quadrant?.padEnd(15) ?? "?".padEnd(15)} V=${p.valueBucket} E=${p.effortBucket}  · ${p.name} (${p.primaryTowerName})`,
    );
  }
}

async function loadAssessProgram(cookie: string): Promise<AssessProgramV2> {
  const res = await fetch(`${BASE}/api/assess`, {
    method: "GET",
    headers: { cookie },
  });
  if (!res.ok) {
    throw new Error(
      `/api/assess failed (${res.status}): ${(await res.text()).slice(0, 300)}`,
    );
  }
  const json = (await res.json()) as {
    ok?: boolean;
    program?: AssessProgramV2 | null;
    db?: string;
  };
  if (!json.ok) {
    throw new Error(`/api/assess returned ok=false`);
  }
  if (!json.program) {
    console.warn(
      `[probe] /api/assess returned program=null (db=${json.db}); falling back to hydration seed.`,
    );
    return getAssessProgramHydrationSnapshot();
  }
  return json.program;
}

main().catch((e) => {
  console.error("[probe] FATAL:", e);
  process.exit(1);
});
