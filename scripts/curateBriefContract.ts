/**
 * curateBriefContract — smoke test for `curateBriefLLM.ts` and the
 * deterministic `buildFallbackProcess` used by `/api/assess/curate-brief` when
 * the LLM is unavailable.
 *
 *   `npx tsx scripts/curateBriefContract.ts`
 */

import {
  buildFallbackProcess,
  curateBriefWithLLM,
  isLLMConfigured,
} from "../src/lib/assess/curateBriefLLM";
import type { Process } from "../src/data/types";

let pass = 0;
let fail = 0;

function check(label: string, cond: boolean, detail?: string) {
  if (cond) {
    pass += 1;
    console.log(`  PASS  ${label}`);
  } else {
    fail += 1;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function asyncCheck(
  label: string,
  fn: () => Promise<boolean>,
  detail?: string,
): Promise<void> {
  try {
    const ok = await fn();
    if (ok) {
      pass += 1;
      console.log(`  PASS  ${label}`);
    } else {
      fail += 1;
      console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
    }
  } catch (e) {
    fail += 1;
    console.log(`  FAIL  ${label} — threw: ${(e as Error).message}`);
  }
}

const main = async () => {
  console.log("\n[curate-brief] LLM gate + fallback Process shape");

  delete process.env.OPENAI_API_KEY;
  check("1) isLLMConfigured() returns false when key unset", !isLLMConfigured());

  const baseInput = {
    towerId: "finance" as const,
    l2: "Record to Report",
    l3: "Reconciliation",
    l4Name: "Match invoices",
    l4Id: "contract-l4-1",
    aiRationale:
      "Multi-entity JV reconciliation is high-volume, codified — strong agent fit.",
  };

  await asyncCheck(
    "1) curateBriefWithLLM throws when key unset",
    async () => {
      try {
        await curateBriefWithLLM(baseInput);
        return false;
      } catch (e) {
        return e instanceof Error && /OPENAI_API_KEY/.test(e.message);
      }
    },
  );

  const fb: Process = buildFallbackProcess(baseInput);
  check("2) fallback Process.id is stable", fb.id.startsWith("llm-"));
  check("2) fallback has ≥2 agents", fb.agents.length >= 2);
  check("2) fallback has workforceImpactSummary", fb.workforce.workforceImpactSummary.length > 0);
  check("2) fallback has work.pre.steps", fb.work.pre.steps.length >= 2);
  check(
    "2) impactTier is High|Medium|Low",
    fb.impactTier === "High" || fb.impactTier === "Medium" || fb.impactTier === "Low",
  );

  console.log("\n========================================");
  console.log(`curate-brief contract: ${pass} passed, ${fail} failed.`);
  if (fail > 0) process.exit(1);
};

void main();
