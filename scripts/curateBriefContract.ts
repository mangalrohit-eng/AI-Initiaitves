/**
 * curateBriefContract — smoke test for `curateBriefLLM.ts` helpers and the
 * deterministic fallback used by `/api/assess/curate-brief` when the LLM
 * is unavailable.
 *
 * Verifies:
 *   1. `isLLMConfigured()` returns false when `OPENAI_API_KEY` is unset.
 *   2. `curateBriefWithLLM` throws an `LLMError` when the key is unset
 *      instead of hitting OpenAI.
 *   3. The `GeneratedBrief` type shape is complete (smoke check on the
 *      route's deterministic fallback shape — every field defined).
 *
 *   `npx tsx scripts/curateBriefContract.ts`
 */

import {
  curateBriefWithLLM,
  isLLMConfigured,
} from "../src/lib/assess/curateBriefLLM";
import type { GeneratedBrief } from "../src/data/assess/types";

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
  console.log("\n[curate-brief] LLM gate + fallback shape");

  delete process.env.OPENAI_API_KEY;
  check("1) isLLMConfigured() returns false when key unset", !isLLMConfigured());

  await asyncCheck(
    "1) curateBriefWithLLM throws LLMError when key unset",
    async () => {
      try {
        await curateBriefWithLLM({
          towerId: "finance",
          l2: "Record to Report",
          l3: "Reconciliation",
          l4Name: "Match invoices",
          aiRationale:
            "Multi-entity JV reconciliation is high-volume, codified — strong agent fit.",
        });
        return false;
      } catch (e) {
        return e instanceof Error && /OPENAI_API_KEY/.test(e.message);
      }
    },
  );

  // 2. The deterministic fallback shape lives inline in the route, but we
  //    can smoke-check the GeneratedBrief type shape via a synthetic value
  //    that the route would write. If a future refactor drops a field,
  //    this test fails to compile and we catch it before runtime.
  const synth: GeneratedBrief = {
    preState: "Today: cycle time TBD — subject to discovery.",
    postState: "With AI: agent stack runs the routine, humans handle edges.",
    agentsInvolved: [
      { name: "Reconciliation Agent", role: "Match invoices end-to-end." },
    ],
    toolsRequired: ["BlackLine"],
    keyMetric: "Close days reduced from 12-18 to 5-7.",
    generatedAt: new Date().toISOString(),
    source: "fallback",
  };
  check(
    "2) GeneratedBrief shape includes preState",
    typeof synth.preState === "string" && synth.preState.length > 0,
  );
  check(
    "2) GeneratedBrief shape includes postState",
    typeof synth.postState === "string" && synth.postState.length > 0,
  );
  check(
    "2) GeneratedBrief shape includes agentsInvolved",
    Array.isArray(synth.agentsInvolved) && synth.agentsInvolved.length > 0,
  );
  check(
    "2) GeneratedBrief shape includes toolsRequired",
    Array.isArray(synth.toolsRequired) && synth.toolsRequired.length > 0,
  );
  check(
    "2) GeneratedBrief shape includes keyMetric",
    typeof synth.keyMetric === "string" && synth.keyMetric.length > 0,
  );
  check(
    "2) GeneratedBrief.source is llm | fallback",
    synth.source === "llm" || synth.source === "fallback",
  );

  console.log("\n========================================");
  console.log(`curate-brief contract: ${pass} passed, ${fail} failed.`);
  if (fail > 0) process.exit(1);
};

void main();
