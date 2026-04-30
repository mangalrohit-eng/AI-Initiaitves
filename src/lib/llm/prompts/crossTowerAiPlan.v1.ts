/**
 * Cross-Tower AI Plan — prompt template, output schema, and grounding catalog.
 *
 * Versioned: bump `PROMPT_VERSION` on every material change to system/user
 * prompts, schema, or catalogs. The cache key uses this version so callers
 * pick up the new prompt without manual invalidation.
 *
 * Determinism boundary (enforced server-side, not via prompting alone):
 *   LLM authors:    initiative selection/ranking, narrative, milestones,
 *                   dependency descriptions, risk mitigations, architecture
 *                   commentary, executive summary headline.
 *   LLM never authors: $/% figures, FTE counts, dates beyond phase labels,
 *                   brand/people/vendor names not on the allow-lists.
 *
 * Server validation rejects any string field containing a `$`, `%`, or a
 * digit cluster of length ≥2 in disallowed fields. One repair retry is
 * permitted; on second failure the route falls back to deterministic-only.
 */

import type { Tier } from "@/lib/priority";
import { VENDOR_ALLOW_LIST } from "@/lib/assess/curateInitiativesLLM";

export const PROMPT_VERSION = "v1.0.0";

// ---------------------------------------------------------------------------
//   Static, doc-grounded risk + dependency catalog
//
//   The LLM is shown this list verbatim and may only author *mitigation*
//   language for these risk ids. Any risk id not on this list is rejected.
//   Sourced from `docs/context.md` (TSA expiration, BB- credit, split rights,
//   MS NOW positioning, brand & editorial discipline). Mitigation copy in the
//   schema is what GPT-5.5 fills in.
// ---------------------------------------------------------------------------

export type ProgramRisk = {
  id: string;
  name: string;
  /** What the risk is, in declarative voice — never hedging. */
  why: string;
  /** Tower(s) most directly affected (display only). */
  towerIds: string[];
};

export const PROGRAM_RISK_CATALOG: ProgramRisk[] = [
  {
    id: "tsa-expiration",
    name: "NBCU TSA expiration",
    why: "Versant runs on NBCU shared services until the Transition Services Agreement expires (~2028). Ad sales, finance close, IT, payroll, broadcast operations all need standalone capability before the carve-out.",
    towerIds: [
      "finance",
      "hr",
      "tech-engineering",
      "operations-technology",
      "sales",
    ],
  },
  {
    id: "bb-credit-covenant",
    name: "BB- credit + covenant exposure",
    why: "Versant inherits $2.75B debt at BB- with a $0.375 quarterly dividend commitment. Treasury, covenant monitoring, and run-rate cost discipline are existential — every initiative must respect the covenant ceiling.",
    towerIds: ["finance", "corp-services"],
  },
  {
    id: "kardashians-split-rights",
    name: "Split entertainment rights complexity",
    why: "Kardashians-style on-air/streaming split (on-air retained, streaming to Hulu) creates rights-management edge cases. Any rights-adjacent initiative must reconcile both windows.",
    towerIds: ["legal", "programming-dev"],
  },
  {
    id: "ms-now-positioning",
    name: "MS NOW progressive brand positioning",
    why: "MS NOW carries a politically progressive brand — automated content moderation, advertiser brand-safety models, and crisis-detection signals must respect editorial intent without flattening voice.",
    towerIds: ["editorial-news", "marketing-comms", "sales"],
  },
  {
    id: "editorial-judgment-floor",
    name: "Editorial / news judgment floor",
    why: "Anchors, reporters, fact-checking, news judgment, political coverage stay onshore + human. AI in the newsroom is co-pilot, never byline.",
    towerIds: ["editorial-news"],
  },
  {
    id: "live-broadcast-physical-floor",
    name: "Live broadcast physical floor",
    why: "Master control, on-air ops, in-studio production are physical, US-located, talent-relationship-driven. Automation targets surrounding workflow, not the operator's seat.",
    towerIds: ["operations-technology", "production"],
  },
  {
    id: "new-public-company-sec",
    name: "New-public-company SEC obligations",
    why: "Versant is a fresh NASDAQ issuer. 10-K, disclosure controls, internal audit, segment reporting all need standalone process — no waiting on NBCU shared services.",
    towerIds: ["finance", "legal"],
  },
];

// ---------------------------------------------------------------------------
//   Allow-lists shown to the model
// ---------------------------------------------------------------------------

/** Real Versant brands — the LLM may name these in copy. */
export const ALLOWED_BRANDS: readonly string[] = [
  "Versant",
  "Versant Media Group",
  "MS NOW",
  "CNBC",
  "Golf Channel",
  "GolfNow",
  "GolfPass",
  "USA Network",
  "E!",
  "Syfy",
  "Oxygen True Crime",
  "Fandango",
  "Rotten Tomatoes",
  "SportsEngine",
  "Free TV Networks",
  "NBCU",
  "Hulu",
];

/** Real Versant people — the LLM may name these in copy. */
export const ALLOWED_PEOPLE: readonly string[] = [
  "Mark Lazarus",
  "Anand Kini",
  "Deep Bagchee",
  "Rebecca Kutler",
  "KC Sullivan",
  "Brian Carovillano",
  "Nate Balogh",
];

/** Vendors the LLM is permitted to name in commentary. */
export const ALLOWED_VENDORS: readonly string[] = VENDOR_ALLOW_LIST;

// ---------------------------------------------------------------------------
//   Output schema (TypeScript + JSON shape)
// ---------------------------------------------------------------------------

export type LLMKeyInitiative = {
  /** Must equal one of the program-supplied initiative ids. */
  initiativeId: string;
  /** 1-indexed within its phase (P1, P2, P3) — lower is higher priority. */
  ranking: number;
  /** Versant-specific rationale; ≤30 words; no $/%/digits ≥2; no hedging. */
  why: string;
  /** Names of supporting initiatives this one depends on; ≤4. */
  dependsOn: string[];
};

export type LLMRoadmapPhase = {
  /** Cohesive narrative for the phase; ≤50 words; no $/%/digits ≥2. */
  narrative: string;
  /** 3–5 milestones; each ≤14 words; no $/%/digits ≥2. */
  milestones: string[];
  /** 1–3 owner notes naming towers and lead roles in declarative voice. */
  ownerNotes: string[];
};

export type LLMRoadmapPhases = {
  p1: LLMRoadmapPhase;
  p2: LLMRoadmapPhase;
  p3: LLMRoadmapPhase;
};

export type LLMArchitectureNarrative = {
  /** ≤45 words on orchestration patterns at program scope. */
  orchestrationCommentary: string;
  /** ≤45 words on the converged vendor stack; only allowed-list vendors. */
  vendorStackCommentary: string;
  /** ≤45 words on data fabric / digital core. */
  dataCoreCommentary: string;
};

export type LLMRiskMitigation = {
  /** Must equal one of `PROGRAM_RISK_CATALOG[*].id`. */
  riskId: string;
  /** ≤30 words; no $/%/digits ≥2; declarative; named brands/people allowed. */
  mitigation: string;
};

export type CrossTowerAiPlanLLM = {
  /** ≤55 words; the page header narrative. */
  executiveSummary: string;
  keyInitiatives: LLMKeyInitiative[];
  roadmapPhases: LLMRoadmapPhases;
  architectureNarrative: LLMArchitectureNarrative;
  riskMitigations: LLMRiskMitigation[];
};

// ---------------------------------------------------------------------------
//   Prompt builders
// ---------------------------------------------------------------------------

export type PromptKeyInitiative = {
  id: string;
  towerName: string;
  name: string;
  /** L2 / L3 capability path. */
  capabilityPath: string;
  tier: Tier | null;
  aiPriority?: string;
  rationale?: string;
};

export type BuildPromptInput = {
  initiatives: PromptKeyInitiative[];
  /**
   * Phase membership map — id → tier. The LLM is told to never move an
   * initiative across phases; the validator double-checks against this map.
   */
  phaseMembership: Record<string, Tier | null>;
  towersInScope: { id: string; name: string; initiativeCount: number }[];
  vendorStack: { vendor: string; count: number }[];
  orchestrationMix: { pattern: string; count: number }[];
};

export function buildSystemPrompt(): string {
  return [
    "You are the Cross-Tower AI Plan author for Versant Media Group (NASDAQ: VSNT) — a recently spun-off media company carrying ~$6.7B revenue, ~$2.4B Adj. EBITDA, $2.75B debt at BB-, with NBCU shared services in place until the Transition Services Agreement expires.",
    "",
    "Versant's brands include MS NOW, CNBC, Golf Channel, GolfNow, GolfPass, USA Network, E!, Syfy, Oxygen True Crime, Fandango, Rotten Tomatoes, SportsEngine, Free TV Networks. The plan you author must read as Versant-specific — never generic 'media-company' copy.",
    "",
    "DETERMINISM CONTRACT — read carefully:",
    "  - Numbers, $ figures, %, FTE counts, headcount, and concrete dates are owned by the deterministic engine, NOT you. Do NOT include '$', '%', or any digit cluster of length 2+ in your output. Do not write '$2.43B', '12 weeks', or '95%'. Phase labels (P1/P2/P3) and the strings 'P1', 'P2', 'P3' are allowed.",
    "  - Initiative ids and tower ids in your output MUST come verbatim from the provided lists. Never invent ids.",
    "  - Risk ids in `riskMitigations` MUST equal one of the catalog ids provided.",
    "  - Vendor names in `architectureNarrative.vendorStackCommentary` MUST be from the provided allow-list (or the verbatim string 'TBD — subject to discovery').",
    "",
    "TONE:",
    "  - Declarative voice. State what the program does and the evidence it works.",
    "  - Name real brands (MS NOW, CNBC, Golf Channel, etc.) and real Versant people when relevant (Mark Lazarus, Anand Kini, Deep Bagchee, Rebecca Kutler, KC Sullivan, Brian Carovillano, Nate Balogh).",
    "  - Forbidden hedge phrases: 'potentially', 'could possibly', 'may help to', 'leverage AI', 'harness the power of AI', 'transformative impact'.",
    "  - Never write copy that could apply to 'any media company' — if Versant is swappable, rewrite.",
    "",
    "VERSANT-SPECIFIC ANGLES TO LEAN INTO:",
    "  - NBCU TSA expiration → ad sales is greenfield post-carveout; finance close + payroll + IT all need standalone capability.",
    "  - BB- credit + $0.375 quarterly dividend → covenant monitoring is existential; cost discipline matters per dollar.",
    "  - Kardashians-style split rights (on-air retained, streaming to Hulu) → rights management has real edge cases.",
    "  - MS NOW progressive positioning → crisis detection / brand safety models must respect editorial intent.",
    "  - Editorial / news judgment / on-air talent / political coverage → stay onshore + human; AI is co-pilot only.",
    "  - Live broadcast / master control / in-studio production → physical floor; automate around the operator, not the seat.",
    "",
    "RANKING + SELECTION:",
    "  - You receive the full deterministic initiative roster grouped by tier.",
    "  - Pick the strongest cross-tower set for `keyInitiatives` (target 8–12 rows). Each row must echo a `initiativeId` from the input.",
    "  - Rank within each tier, with `ranking` 1-indexed (1 = first).",
    "  - You may NOT move an initiative across tiers. The deterministic engine owns phase membership.",
    "",
    "DEPENDENCIES:",
    "  - For each `keyInitiative`, list 0–4 supporting initiative ids in `dependsOn`. Use the same id strings from the input. Self-reference is forbidden.",
    "",
    "ROADMAP PHASES (P1/P2/P3 → 0-6mo / 6-12mo / 12-24mo):",
    "  - For each phase, write a tight narrative (≤50 words), 3–5 concrete milestones, and 1–3 owner notes naming the towers / people accountable. No numerics — talk in qualitative shifts (e.g. 'close cycle compresses', 'ad sales pipeline becomes self-serve').",
    "",
    "ARCHITECTURE NARRATIVE:",
    "  - Three short paragraphs (≤45 words each): orchestration patterns, vendor stack convergence, data + digital core implications. Vendors must be allow-listed.",
    "",
    "RISK MITIGATIONS:",
    "  - Author one mitigation per supplied risk id. Each ≤30 words, declarative, naming the relevant tower/people/vendors.",
    "",
    "EXECUTIVE SUMMARY:",
    "  - ≤55 words. Lead with what the program delivers across 24 months, in Versant terms. No numbers.",
    "",
    "OUTPUT — return STRICT JSON ONLY, no prose, in exactly this shape:",
    "{",
    '  "executiveSummary": "<≤55 words>",',
    '  "keyInitiatives": [',
    '    { "initiativeId": "<from input>", "ranking": <int>, "why": "<≤30 words>", "dependsOn": ["<initiativeId>", ...] }',
    "  ],",
    '  "roadmapPhases": {',
    '    "p1": { "narrative": "<≤50 words>", "milestones": ["...", "..."], "ownerNotes": ["...", "..."] },',
    '    "p2": { "narrative": "<≤50 words>", "milestones": [...], "ownerNotes": [...] },',
    '    "p3": { "narrative": "<≤50 words>", "milestones": [...], "ownerNotes": [...] }',
    "  },",
    '  "architectureNarrative": {',
    '    "orchestrationCommentary": "<≤45 words>",',
    '    "vendorStackCommentary": "<≤45 words; allow-listed vendors only>",',
    '    "dataCoreCommentary": "<≤45 words>"',
    "  },",
    '  "riskMitigations": [',
    '    { "riskId": "<from catalog>", "mitigation": "<≤30 words>" }',
    "  ]",
    "}",
    "",
    "Do not include any text outside the JSON object.",
  ].join("\n");
}

export function buildUserPrompt(input: BuildPromptInput): string {
  const lines: string[] = [];
  lines.push("CROSS-TOWER INITIATIVE ROSTER (deterministic — pick from this list):");
  lines.push("");
  for (const init of input.initiatives) {
    const tierStr = init.tier ?? "unranked";
    const rationale = init.rationale ? ` — ${init.rationale}` : "";
    lines.push(
      `  - id="${init.id}" tower="${init.towerName}" tier=${tierStr} ${init.capabilityPath} :: ${init.name}${rationale}`,
    );
  }
  lines.push("");

  lines.push("PHASE MEMBERSHIP (id → tier; you cannot move an id across tiers):");
  for (const [id, tier] of Object.entries(input.phaseMembership)) {
    lines.push(`  - ${id}: ${tier ?? "unranked"}`);
  }
  lines.push("");

  lines.push("TOWERS IN SCOPE:");
  for (const t of input.towersInScope) {
    lines.push(
      `  - ${t.name} (${t.id}) — ${t.initiativeCount} curated initiative${t.initiativeCount === 1 ? "" : "s"}`,
    );
  }
  lines.push("");

  if (input.vendorStack.length) {
    lines.push("VENDOR STACK CONVERGENCE (deterministic — name only these in vendorStackCommentary):");
    for (const v of input.vendorStack.slice(0, 12)) {
      lines.push(`  - ${v.vendor}`);
    }
    lines.push("");
  }

  if (input.orchestrationMix.length) {
    lines.push("ORCHESTRATION PATTERN MIX (deterministic — qualitative reference for orchestrationCommentary):");
    for (const o of input.orchestrationMix) {
      lines.push(`  - ${o.pattern}`);
    }
    lines.push("");
  }

  lines.push("ALLOWED BRANDS (use freely in copy):");
  lines.push(`  ${ALLOWED_BRANDS.join(", ")}`);
  lines.push("");

  lines.push("ALLOWED PEOPLE (named only when relevant):");
  lines.push(`  ${ALLOWED_PEOPLE.join(", ")}`);
  lines.push("");

  lines.push("RISK CATALOG (author mitigation only — riskId must echo verbatim):");
  for (const r of PROGRAM_RISK_CATALOG) {
    lines.push(`  - ${r.id} :: ${r.name} :: ${r.why}`);
  }
  lines.push("");

  lines.push(
    "Return the strict JSON object described in the system prompt. No prose outside the JSON.",
  );

  return lines.join("\n");
}
