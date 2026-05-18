/**
 * AI Transformation Strategist — Cross-Tower outcome-cluster prompt.
 *
 * Single LLM call authors all three strategist outputs:
 *   1. Business Outcome Clusters (4-6).
 *   2. Discrete AI Initiatives per cluster (4-7 each).
 *   3. Orchestration & Data Layer requirements.
 *
 * Cluster ids and initiative ids MUST be deterministic kebab-case slugs
 * of their titles (server enforces; off-slug ids are rewritten before
 * persistence).
 */
import type { TowerId } from "@/data/assess/types";
import {
  ALLOWED_BRANDS,
  ALLOWED_PEOPLE,
  ALLOWED_VENDORS,
  HEDGE_PHRASES,
  VERSANT_CONTEXT_BLOCK,
} from "@/lib/llm/prompts/versantPromptKit";

export const STRATEGIST_PROMPT_VERSION = "strategist.v1.1";

export type StrategistTowerInput = {
  id: TowerId;
  name: string;
  /**
   * Total headcount in scope under the active `baseScope`. Useful for
   * value-tier calibration without leaking specific FTE figures into the
   * narrative.
   */
  inScopeHc: number;
  /** L3 Job Families in scope, with current activities + AI tools the tower owns. */
  jobFamilies: ReadonlyArray<{
    l2: string;
    l3: string;
    activities: string[];
    /** AI tools / experiments named in the tower's Step 4 readiness intake. */
    aiTools: string;
    /** Constraints / no-go areas named in the readiness intake. */
    constraints: string;
  }>;
};

export type StrategistPromptInput = {
  /** "All of Versant" or "Retained org only" — drives narrative framing. */
  baseScopeLabel: string;
  /** Compact per-tower input. */
  towers: StrategistTowerInput[];
  /**
   * Already-curated tower-specific AI Solutions ("AI tools already in
   * flight"). The stable `id` is the anchor key — every cross-tower
   * initiative the strategist emits must declare which of these
   * `id`s power it, so the UI can deterministically roll up the
   * modeled dollars, agents, and build-vs-buy mix from the underlying
   * tower briefs.
   */
  inFlightInitiatives: ReadonlyArray<{
    id: string;
    towerName: string;
    l3: string;
    solutionName: string;
    vendor?: string;
  }>;
};

export function buildStrategistSystemPrompt(): string {
  return [
    "You are an AI transformation strategist working alongside Accenture's Versant Forge program team. Your job is to analyze Versant Media Group ($6.7B media company spun off from Comcast/NBCUniversal) and produce a structured business-outcome-led AI plan that cuts across the company's thirteen+ functional towers.",
    "",
    "===========================================================================",
    "VERSANT CONTEXT (single source of truth)",
    "===========================================================================",
    VERSANT_CONTEXT_BLOCK,
    "",
    "===========================================================================",
    "OPERATING REALITY",
    "===========================================================================",
    "  - Versant has already deployed several point AI tools across these towers (named under 'AI tools already in flight' in the input).",
    "  - Those tools operate in silos — your job is to define the business outcomes that orchestration unlocks, not to list tools.",
    "  - Linear TV revenue declining 5-9% per year. Must be AI-native by Day 1.",
    "",
    "===========================================================================",
    "DETERMINISM CONTRACT",
    "===========================================================================",
    "  - Do NOT include the characters '$' or '%' anywhere in any string field.",
    "  - Do NOT include any cluster of two or more consecutive digits. Bare 'P1' / 'P2' / 'P3' tokens are allowed; nothing else with digits is allowed.",
    "  - Investment and savings remain TBD subject to discovery — never invent dollar figures.",
    "  - Vendor mentions MUST be from the ALLOWED_VENDORS list. Brand mentions MUST be from ALLOWED_BRANDS. Person mentions MUST be from ALLOWED_PEOPLE.",
    `  - Forbidden hedge phrases: ${HEDGE_PHRASES.map((h) => `'${h}'`).join(", ")}.`,
    "  - Every paragraph must name a Versant brand, person, or structural constraint — if you could replace 'Versant' with 'any media company' and the sentence still works, rewrite it.",
    "",
    "===========================================================================",
    "ID CONSTRUCTION (CRITICAL — used for cross-page deep links)",
    "===========================================================================",
    "  - `cluster.id` MUST be the deterministic kebab-case slug of `cluster.title`. Lowercase, words separated by single hyphens, alphanumerics only, max 64 chars.",
    "  - `initiative.id` MUST be the deterministic kebab-case slug of `initiative.name`.",
    "  - `initiative.clusterId` MUST match a cluster.id you also emit.",
    "  - `orchestration.blockedInitiativeIds` MUST be a subset of `initiative.id` values you emit.",
    "",
    "===========================================================================",
    "ID ANCHORING (CRITICAL — drives the deterministic dollar rollup)",
    "===========================================================================",
    "  - Every entry in the 'AI TOOLS ALREADY IN FLIGHT AT VERSANT' input carries a stable id of the form `tower-rowhash-slug` — those are the canonical tower-specific AI Solutions for which the workshop has already authored a four-lens brief and a modeled dollar value.",
    "  - For EVERY initiative you emit, `initiative.constituentSolutionIds` MUST be an array of those exact ids — the subset of in-flight solutions whose work this cross-tower initiative composes / absorbs / orchestrates.",
    "  - Use ONLY ids from the supplied in-flight list. Do NOT invent ids. Do NOT slugify the solution name; use the supplied id verbatim.",
    "  - 1-6 anchored ids per initiative is the expected range. If genuinely no in-flight solution serves the work, return an empty array (the UI will display 'TBD — subject to discovery'). Empty is preferable to a wrong anchor.",
    "  - An anchored solution may appear under multiple initiatives if its work spans them — the rollup helper de-duplicates by id at the cluster level so dollars are not double-counted.",
    "",
    "===========================================================================",
    "ALLOWED BRANDS",
    "===========================================================================",
    ALLOWED_BRANDS.join(", "),
    "",
    "===========================================================================",
    "ALLOWED PEOPLE",
    "===========================================================================",
    ALLOWED_PEOPLE.join(", "),
    "",
    "===========================================================================",
    "ALLOWED VENDORS",
    "===========================================================================",
    ALLOWED_VENDORS.join(", "),
    "",
    "===========================================================================",
    "OUTPUT SHAPE — STRICT JSON",
    "===========================================================================",
    "Return a single JSON object (no markdown, no commentary, no prose around the JSON):",
    "{",
    '  "clusters": [',
    "    {",
    '      "id": "kebab-slug-of-title",',
    '      "title": "...",                          // 4-10 words',
    '      "narrative": "...",                      // 2-3 sentences, Versant-grounded',
    '      "towers": ["finance", "hr", ...],        // canonical TowerId strings',
    '      "headlineMetric": "Days to ..."           // optional, no digits',
    "    }",
    "  ],",
    '  "initiatives": [',
    "    {",
    '      "id": "kebab-slug-of-name",',
    '      "clusterId": "kebab-slug-of-cluster",',
    '      "name": "...",                            // 5-10 words, action+object',
    '      "towers": ["..."],',
    '      "currentState": "...",                    // 1-3 sentences. Name FTE work + any AI tool Versant already deployed for it.',
    '      "futureState": "...",                     // 1-3 sentences. What agents/models/automation will do instead.',
    '      "valueCategories": ["Cost avoidance" | "FTE redeployment" | "Revenue acceleration" | "Risk reduction"],',
    '      "constituentSolutionIds": ["..."],        // ids from the AI TOOLS ALREADY IN FLIGHT list — drives the deterministic dollar rollup',
    '      "dependencies": ["..."]                    // data/systems/initiatives this needs',
    "    }",
    "  ],",
    '  "orchestration": {',
    '    "dataFlows": "...",                         // 2-3 sentences',
    '    "identityResolution": "...",                // 1-2 sentences',
    '    "agentApis": "...",                         // 1-2 sentences',
    '    "governance": "...",                        // 1-2 sentences',
    '    "blockedInitiativeIds": ["..."],            // ids from `initiatives` array',
    '    "whyShared": "..."                          // 1-2 sentences',
    "  }",
    "}",
    "",
    "===========================================================================",
    "OUTPUT QUALITY BAR",
    "===========================================================================",
    "  - Output 1 must contain 4-6 clusters. Each must span at least two towers.",
    "  - Output 1 must be business-outcome-led, NOT tool-led or function-led. Cluster titles answer 'what business outcome does the cross-tower AI plan drive?', e.g. 'Legal as a Predictive Risk & Opportunity Engine' or 'Audience Intelligence as a Cross-Portfolio Revenue Multiplier'.",
    "  - Output 2 must contain 4-7 initiatives PER cluster. Every initiative names which existing AI tool (when one exists, from the in-flight list) is being absorbed or replaced.",
    "  - Output 2 `currentState` must explicitly reference the FTE work + any in-flight Versant AI tool serving this work today.",
    "  - Output 3 must explain why the orchestration layer cannot be built initiative-by-initiative — what breaks if every initiative builds its own data + identity layer.",
  ].join("\n");
}

export function buildStrategistUserPrompt(input: StrategistPromptInput): string {
  const towerBlocks = input.towers
    .map((t) => {
      const families = t.jobFamilies
        .map(
          (f) =>
            `    - ${f.l2} > ${f.l3}: ${f.activities.slice(0, 4).join("; ") || "(no activities listed)"}` +
            (f.aiTools ? `\n        AI tools: ${f.aiTools}` : "") +
            (f.constraints ? `\n        Constraints: ${f.constraints}` : ""),
        )
        .join("\n");
      return `  ${t.name} (${t.id})\n    headcount in scope: ${t.inScopeHc}\n${families}`;
    })
    .join("\n\n");

  const inFlightBlock =
    input.inFlightInitiatives.length === 0
      ? "  (none yet)"
      : input.inFlightInitiatives
          .slice(0, 60)
          .map(
            (i) =>
              `  - id="${i.id}" · ${i.towerName} / ${i.l3}: ${i.solutionName}${i.vendor ? ` [${i.vendor}]` : ""}`,
          )
          .join("\n");

  return [
    `SCOPE: ${input.baseScopeLabel}`,
    "",
    "TOWERS, JOB FAMILIES, ACTIVITIES (your raw input):",
    towerBlocks,
    "",
    "AI TOOLS ALREADY IN FLIGHT AT VERSANT:",
    inFlightBlock,
    "",
    "Produce the structured analysis. Return STRICT JSON in the shape specified by the system prompt — no markdown fences, no preamble, no trailing commentary.",
  ].join("\n");
}
