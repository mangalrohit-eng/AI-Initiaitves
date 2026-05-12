/**
 * Cross-Tower AI Plan — V6 program-synthesis prompt builder.
 *
 * Replaces the v5 per-cohort fan-out workflow with a single program-level
 * synthesis call. Under v6 the AI initiatives are already authored at L3
 * Job Family grain (one specific AI Solution per `L3Initiative`); the LLM
 * does NOT need to re-author per-project briefs.
 *
 * What the model authors here:
 *   - Page-level executive summary (≤55 words, Versant-grounded).
 *   - 3-8 program risks (LLM-authored, no fixed catalog).
 *   - 24-month roadmap narrative (overall, ladder, milestones, owner notes).
 *   - Architecture commentary (vendors, data core, delivery — no agent
 *     orchestration mix because v6 doesn't aggregate Process bodies at
 *     the program level).
 *   - Optional per-initiative `narrative` / `valueRationale` /
 *     `effortRationale` strings the composer overlays on top of the
 *     deterministic copy.
 *
 * The model is given the full deterministic 2x2 + initiative roster the
 * page is about to render, so its narrative ladders into what the
 * executive sees on the cards. Every rationale must pass the same
 * Versant-grounding bar enforced by the v5 prompt: ALLOWED vendors /
 * brands / people, no `$` / `%` / digit clusters, no hedge phrases.
 */

import type { CrossTowerAssumptions } from "@/lib/cross-tower/assumptions";
import {
  ALLOWED_BRANDS,
  ALLOWED_PEOPLE,
  ALLOWED_VENDORS,
  HEDGE_PHRASES,
  VERSANT_CONTEXT_BLOCK,
} from "@/lib/llm/prompts/versantPromptKit";

export const CROSS_TOWER_INITIATIVE_PROMPT_VERSION = "v6.1.0";

export type SynthesisV6PromptInput = {
  /** Compact roster of in-plan initiatives — one per row from `selectV6Program`. */
  initiatives: SynthesisV6PromptInitiative[];
  /** Towers in scope (with display names) so synthesis can name them. */
  towers: { id: string; name: string }[];
  /** Assumption snapshot for narrative tone (lens emphases, brief depth). */
  assumptions: CrossTowerAssumptions;
  /** Tower AI readiness questionnaire digest, when one is available. */
  synthesisIntakeDigest?: string;
};

export type SynthesisV6PromptInitiative = {
  /** `L3Initiative.id`. */
  id: string;
  /** Tower display name (e.g. "Finance"). */
  towerName: string;
  /** L3 Job Family the initiative attaches to (e.g. "Financial Reporting"). */
  l3FamilyName: string;
  /** AI Solution name. */
  solutionName: string;
  /** Solution tagline. */
  tagline: string;
  /** Versant-grounded rationale already curated upstream. */
  aiRationale: string;
  /** Named primary vendor / short stack. */
  primaryVendor?: string;
  /** Binary feasibility (drives effort axis). */
  feasibility: "High" | "Low";
  /** Deterministic 2x2 quadrant, already computed. */
  quadrant: "Quick Win" | "Strategic Bet" | "Fill-in" | "Deprioritize";
  /** Program tier from the deterministic 2x2. */
  programTier: "P1" | "P2" | "P3";
};

export function buildSynthesisV6SystemPrompt(): string {
  return [
    "You are the Cross-Tower AI Plan synthesist for the Versant Forge Program (Accenture × Versant Media Group). You author the program-level narrative that ties the per-initiative AI Solutions into a single 24-month plan. The dollars, percentages, and per-initiative quadrant assignments are owned by the deterministic engine — never by you.",
    "",
    "===========================================================================",
    "VERSANT CONTEXT (single source of truth)",
    "===========================================================================",
    VERSANT_CONTEXT_BLOCK,
    "",
    "===========================================================================",
    "DETERMINISM CONTRACT",
    "===========================================================================",
    "  - Do NOT include the characters '$' or '%' in any string field.",
    "  - Do NOT include any cluster of two or more consecutive digits anywhere in your output. Bare 'P1' / 'P2' / 'P3' tier tokens are allowed; nothing else with digits is allowed.",
    "  - Vendor mentions in copy MUST be from the ALLOWED_VENDORS list. Brand mentions MUST be from ALLOWED_BRANDS. Person mentions MUST be from ALLOWED_PEOPLE.",
    `  - Forbidden hedge phrases: ${HEDGE_PHRASES.map((h) => `'${h}'`).join(", ")}.`,
    "  - If you could replace 'Versant' with 'any media company' and the sentence still works, rewrite it. Every paragraph must name a Versant brand, person, or structural constraint.",
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
    "ALLOWED VENDORS (use these names exactly when referenced)",
    "===========================================================================",
    ALLOWED_VENDORS.join(", "),
    "",
    "Return STRICT JSON ONLY. No prose outside the JSON object. The user message specifies the exact schema for this synthesis call.",
  ].join("\n");
}

export function buildSynthesisV6UserPrompt(
  input: SynthesisV6PromptInput,
): string {
  const lines: string[] = [];

  lines.push(
    "CALL TYPE: Author the program-level synthesis for the cross-tower AI plan below.",
  );
  lines.push("");
  lines.push("===========================================================================");
  lines.push("PROGRAM ROSTER (engine-supplied — do NOT reorder or re-quadrant)");
  lines.push("===========================================================================");
  lines.push(`Towers in scope (${input.towers.length}):`);
  for (const t of input.towers) lines.push(`  - ${t.name} (id: ${t.id})`);
  lines.push("");
  lines.push(`Initiatives (${input.initiatives.length}):`);
  for (const i of input.initiatives) {
    const vendorTail = i.primaryVendor ? `; vendor: ${i.primaryVendor}` : "";
    lines.push(
      `  - id="${i.id}" | tower="${i.towerName}" | family="${i.l3FamilyName}" | solution="${i.solutionName}" | quadrant="${i.quadrant}" | tier="${i.programTier}" | feasibility="${i.feasibility}"${vendorTail}`,
    );
    lines.push(`      tagline: ${i.tagline}`);
    lines.push(`      rationale: ${i.aiRationale}`);
  }
  lines.push("");
  // Narrative authoring is deliberately selective. Authoring a narrative
  // for every initiative on a 50+ roster (3 strings × ~70 words each)
  // overflows the JSON output budget and trips the non_json_response
  // failure mode. The deck and tab views fall back to deterministic
  // copy when no narrative overlay is present, so requesting only the
  // Strategic Bets and Quick Wins keeps the call fast and rich.
  const focusIds = input.initiatives
    .filter(
      (i) => i.quadrant === "Strategic Bet" || i.quadrant === "Quick Win",
    )
    .map((i) => i.id);
  lines.push(
    "NARRATIVES — author only for the Strategic Bet and Quick Win initiatives below. Do NOT author narratives for Fill-in or Deprioritize entries; the deterministic engine handles their copy. Each id you author MUST appear verbatim from this list (do not invent ids):",
  );
  if (focusIds.length === 0) {
    lines.push(
      "  (no Strategic Bet or Quick Win initiatives in this roster — return narratives: []).",
    );
  } else {
    for (const id of focusIds) lines.push(`  - ${id}`);
  }
  lines.push("");

  const emph = buildLensEmphasisLines(input.assumptions);
  if (emph.length > 0) {
    lines.push("LENS EMPHASES (apply only when in-scope):");
    for (const line of emph) lines.push(line);
    lines.push("");
  }

  if (input.synthesisIntakeDigest && input.synthesisIntakeDigest.trim()) {
    lines.push("===========================================================================");
    lines.push("TOWER AI READINESS DIGESTS (questionnaire input — narrative grounding only)");
    lines.push("===========================================================================");
    lines.push(input.synthesisIntakeDigest.trim());
    lines.push("");
  }

  lines.push("===========================================================================");
  lines.push("OUTPUT SCHEMA — return STRICT JSON ONLY in exactly this shape:");
  lines.push("===========================================================================");
  lines.push(buildSynthesisV6SchemaSpec());
  lines.push("");
  lines.push(
    "Author each section with Versant-grounded specificity. Cross-reference initiative ids in your narrative when it sharpens the message (e.g. 'CNBC-side risk concentrated in the financial-close family'). Never invent counts; the engine owns the numerics.",
  );
  return lines.join("\n");
}

function buildSynthesisV6SchemaSpec(): string {
  return [
    "{",
    '  "executiveSummary": "<≤55 words; Versant-grounded; names at least one brand and one structural constraint>",',
    '  "narratives": [   // ONLY for Strategic Bet + Quick Win ids listed above; may be []',
    '    {',
    '      "initiativeId": "<verbatim id from the focus list>",',
    '      "narrative": "<≤25 words; cross-tower framing — what shipping this unblocks>",',
    '      "valueRationale": "<≤22 words; ties to a Versant brand / business condition>",',
    '      "effortRationale": "<≤22 words; references vendor stack or change-management lift>"',
    "    }",
    "  ],",
    '  "risks": [',
    '    { "title": "<≤6 words>", "description": "<≤30 words>", "mitigation": "<≤30 words>" }',
    "  ],",
    '  "roadmapNarrative": {',
    '    "overall": "<≤55 words; 24-month sequencing across the 14 towers; no phase keys>",',
    '    "ladder": "<≤45 words; Quick Wins → Strategic Bets handoff>",',
    '    "milestones": ["<≤18 words>", "<≤18 words>"],',
    '    "ownerNotes": ["<≤25 words; names a tower lead from ALLOWED_PEOPLE>"]',
    "  },",
    '  "architectureVendors": "<≤45 words; vendor stack across the program; ALLOWED_VENDORS only>",',
    '  "architectureDataCore": "<≤45 words; data and digital-core commentary>",',
    '  "architectureDelivery": "<≤45 words; agentic-pattern + delivery cadence; no Process.agents counts>"',
    "}",
  ].join("\n");
}

function buildLensEmphasisLines(a: CrossTowerAssumptions): string[] {
  const lines: string[] = [];
  if (a.emphasizeTsaReadiness) {
    lines.push(
      "  - TSA readiness: when initiatives sit in towers exposed to NBCU TSA cutover (Sales, Finance, HR, Tech & Engineering, Technology Operations), name the TSA dependency and the cutover urgency.",
    );
  }
  if (a.emphasizeBbCreditDiscipline) {
    lines.push(
      "  - BB- credit + covenant discipline: when initiatives sit in Finance or Corporate Services, surface covenant monitoring or run-rate cost discipline.",
    );
  }
  if (a.emphasizeEditorialIntegrity) {
    lines.push(
      "  - Editorial integrity: when initiatives sit in Editorial & News, Production, or Marketing & Communications, flag the human-judgment floor — agents are co-pilot, fact-check is human, byline is human. Brian Carovillano is gatekeeper.",
    );
  }
  if (a.emphasizeBroadcastResilience) {
    lines.push(
      "  - Live-broadcast resilience: when initiatives sit in Technology Operations or Production, frame the post-state agents as protecting the on-air signal.",
    );
  }
  return lines;
}
