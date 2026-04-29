/**
 * Live smoke: calls curateBriefWithLLM (same as POST /api/assess/curate-brief core).
 * Loads .env.local for OPENAI_API_KEY. Set OPENAI_MODEL / OPENAI_CURATE_BRIEF_MODEL
 * in the shell to mirror Vercel.
 *
 *   npx tsx scripts/curate-brief-smoke.ts
 */

import { config } from "dotenv";
import { resolve } from "path";
import { writeFileSync, mkdirSync, existsSync } from "fs";

config({ path: resolve(process.cwd(), ".env.local") });
// Default: same split as Vercel recommendation (4o most / 5.5 brief) — override via shell
if (!process.env.OPENAI_MODEL?.trim()) process.env.OPENAI_MODEL = "gpt-4o";
if (!process.env.OPENAI_CURATE_BRIEF_MODEL?.trim()) {
  process.env.OPENAI_CURATE_BRIEF_MODEL = "gpt-5.5";
}

const HEDGE = /\b(potentially|could help|leverage|harness|transformative|significant(ly)?)\b/i;
const VERSANT_MARKERS = [
  "versant",
  "ms now",
  "now",
  "nbcu",
  "tsa",
  "bb-",
  "blackline",
  "golf now",
  "fandango",
  "cnbc",
];

function main() {
  const outDir = resolve(process.cwd(), "scripts", ".curate-brief-smoke-out");
  return import("../src/lib/assess/curateBriefLLM")
    .then(async ({ curateBriefWithLLM, isLLMConfigured }) => {
      console.log(
        "[curate-brief-smoke] env: OPENAI_MODEL=",
        process.env.OPENAI_MODEL,
        "OPENAI_CURATE_BRIEF_MODEL=",
        process.env.OPENAI_CURATE_BRIEF_MODEL,
        "reasoning=",
        process.env.OPENAI_CURATE_BRIEF_REASONING_EFFORT ?? "(default medium)",
        "isLLMConfigured=",
        isLLMConfigured(),
        "\n",
      );
      if (!isLLMConfigured()) {
        console.error("Set OPENAI_API_KEY in .env.local");
        process.exit(1);
      }

      const p = await curateBriefWithLLM({
        towerId: "finance",
        l2: "Record to Report",
        l3: "Intercompany reconciliation",
        l4Name: "Multi-entity match and true-up (JV)",
        l4Id: "smoke-finance-ic-1",
        aiRationale:
          "7+ legal entities; timing differences; BlackLine adjacent; good fit for matching agents and exception queue.",
        agentOneLine: "Reconciliation agent matches and explains variances.",
        primaryVendor: "BlackLine",
      });

      const blob = {
        name: p.name,
        id: p.id,
        impactTier: p.impactTier,
        work: {
          pre: {
            description: p.work.pre.description?.slice(0, 80),
            steps: p.work.pre.steps.length,
          },
          post: { steps: p.work.post.steps.length },
        },
        agents: p.agents.map((a) => ({
          id: a.id,
          name: a.name,
          type: a.type,
          toolsUsed: a.toolsUsed?.slice(0, 2),
        })),
        flowEdges: p.agentOrchestration?.flow?.length ?? 0,
        workforce: p.workforce?.workforceImpactSummary?.slice(0, 200),
        workbench: p.workbench?.keyShifts?.slice(0, 2),
        digitalCore: p.digitalCore?.requiredPlatforms?.[0],
      };
      if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
      const f = resolve(
        outDir,
        "last-smoke." + new Date().toISOString().replace(/[:.]/g, "-") + ".json",
      );
      writeFileSync(f, JSON.stringify(p, null, 2), "utf8");
      console.log("Full process JSON saved:", f);
      console.log("\n--- Sliced view ---\n", JSON.stringify(blob, null, 2));

      const allText = JSON.stringify(p);
      const hedge = HEDGE.test(allText) ? "possible hedge phrasing" : "none obvious";
      const vHits = VERSANT_MARKERS.filter(
        (m) => m.length > 3 && allText.toLowerCase().includes(m),
      );
      console.log("\n--- Heuristic pass ---\n  hedge check:", hedge);
      console.log("  Versant/brand string hits (sampled):", vHits.length ? vHits.join(", ") : "none in raw JSON string");

      const firstAction = p.work?.pre?.steps?.[0]?.action ?? "";
      console.log("  First pre step action (snippet):", firstAction.slice(0, 140) || "(empty)");

      console.log("\n--- Done (success) ---");
    })
    .catch((e: Error) => {
      console.error("FAILED:", e.message);
      if (e.stack) console.error(e.stack);
      process.exit(1);
    });
}

void main();
