/**
 * Cross-Tower AI Plan v3 — Versant-grounded prompt builders.
 *
 * Design principles (read before editing):
 *
 *   1) **Structural grouping is engine-owned.** The cross-tower page hands
 *      the LLM one cohort per L4 Activity Group; the LLM authors the
 *      *content* of each project but never decides which L5 initiatives go
 *      together. This gives us auditable, repeatable lineage and lets the
 *      cache key fan out per cohort.
 *
 *   2) **Brief comes before scoring.** The model is told to draft the full
 *      4-lens brief first (Work / Workforce / Workbench / Digital Core +
 *      Agents + Orchestration), then derive the value/effort buckets from
 *      that brief. Effort rationale must echo brief signals (integration
 *      count, agent count, complexity, proven-elsewhere) so the score is
 *      defensible.
 *
 *   3) **Numerics belong to the deterministic engine.** No `$`, no `%`,
 *      no digit clusters of 2+. Phase-tier strings ("P1", "P2", "P3") and
 *      bare ages like "Day 1" are allowed; everything else is rejected
 *      server-side.
 *
 *   4) **Versant context is pre-curated, projects are not.** The static
 *      `VERSANT_CONTEXT_BLOCK` below is sourced from `docs/context.md` and
 *      lists the financials, brands, people, and structural constraints the
 *      model is expected to ground every project against. The model receives
 *      this verbatim every call. It does NOT receive any pre-baked project
 *      content — every project name, narrative, agent fleet, and lens
 *      payload is authored fresh per regeneration.
 *
 * Two prompt builders are exported:
 *
 *   - `buildProjectPromptForL4()` — one call per L4 cohort. The model
 *     authors a single `AIProjectLLM` object with the full brief and
 *     scoring.
 *   - `buildProgramSynthesisPrompt()` — one call after all cohorts return.
 *     Receives the compact list of authored projects and emits the
 *     program-wide narrative (executive summary, roadmap, risks, dependsOn,
 *     architecture commentary).
 *
 * `PROMPT_VERSION` bumps invalidate per-cohort and synthesis caches without
 * manual flushes.
 */

import { VENDOR_ALLOW_LIST } from "@/lib/assess/curateInitiativesLLM";
import type { CrossTowerAssumptions } from "@/lib/cross-tower/assumptions";
import type {
  AIProjectLLM,
  BriefDepth,
  L4Cohort,
} from "@/lib/cross-tower/aiProjects";

export const PROMPT_VERSION = "v3.1.0";

// ---------------------------------------------------------------------------
//   Static grounding (Versant context, brand/people/vendor allow-lists)
// ---------------------------------------------------------------------------

/**
 * Verbatim Versant context for the system prompt. Sourced from
 * `docs/context.md` (single source of truth). Update this block — and bump
 * `PROMPT_VERSION` — when context.md changes materially.
 */
export const VERSANT_CONTEXT_BLOCK = [
  "VERSANT MEDIA GROUP (NASDAQ: VSNT) — independent, publicly traded media company spun off from Comcast/NBCUniversal on January 2, 2026. The company exists to transform: linear TV revenue is declining 5–9 percent annually, and Versant must be AI-native by Day 1 — there is no 'add AI later'.",
  "",
  "FINANCIALS (FY2025 — first reported year): total revenue, distribution revenue, advertising revenue, platforms revenue, programming and production cost, adjusted EBITDA, free cash flow, gross debt at BB- (junk), quarterly dividend, and an authorised share buyback are tracked deterministically in the app. Do NOT echo any of these numbers in your output — the deterministic engine renders them.",
  "",
  "BRAND PORTFOLIO — name these specifically when relevant:",
  "  Political news: MS NOW (formerly MSNBC) — progressive editorial positioning; election-night audience leader; DTC community/membership launching in summer 2026.",
  "  Business news: CNBC — global #1 business news brand; CNBC Pro; Kalshi partnership; StockStory acquisition (small AI team) integration in flight; Nikkei CNBC JV (Japan).",
  "  Golf and sports participation: Golf Channel, GolfNow, GolfPass, SportsEngine — USGA partnership through 2032; Rory McIlroy / Firethorn JV.",
  "  Entertainment and sports: USA Network (USA Sports), E!, Syfy, Oxygen True Crime — Winter Olympics on USA/CNBC; Kardashians split rights (on-air retained at Versant; streaming sold to Hulu).",
  "  Digital platforms: Fandango (75 percent Versant, 25 percent WBD), Rotten Tomatoes, Free TV Networks, Indy Cinema Group.",
  "",
  "LEADERSHIP — name only when relevant to the project's tower:",
  "  Mark Lazarus (CEO), Anand Kini (CFO and COO), Deep Bagchee (CPTO News), Rebecca Kutler (President MS NOW), KC Sullivan (President CNBC), Matthew Hong (President Sports), Nate Balogh (EVP and CIO), Brian Carovillano (SVP Standards and Editorial — gatekeeper for editorial AI), Caroline Richardson (SVP and CISO), Frank Tanki (CMO Entertainment and Sports), Tom Clendenin (CMO CNBC and MS NOW), David Novak (Board Chair).",
  "",
  "STRUCTURAL CONSTRAINTS — these define which projects matter and why:",
  "  - NBCU TSA expiration (~2028): NBCU runs ad sales and shared services until the Transition Services Agreement expires. Versant must build standalone capability before then. Ad sales is greenfield; finance close, payroll, IT, broadcast operations all have hard cutover deadlines.",
  "  - BB- credit rating + dividend commitment: covenant compliance is existential. Treasury, monitoring, and run-rate cost discipline matter on every initiative.",
  "  - Multi-entity consolidation: 7+ brands plus the Fandango JV (75/25 with WBD) plus Nikkei CNBC JV. Intercompany reconciliation is non-trivial.",
  "  - Split rights complexity (Kardashians-style): on-air retained while streaming sold to Hulu. Any rights-adjacent project must reconcile both windows.",
  "  - MS NOW progressive positioning: brand-safety, crisis-detection, and content-moderation models must respect editorial intent without flattening voice.",
  "  - Editorial / news-judgment floor: anchors, reporters, fact-checking, political coverage stay onshore and human. AI is co-pilot in the newsroom, never byline.",
  "  - Live-broadcast physical floor: master control, on-air ops, in-studio production are physical, US-located, talent-relationship-driven. Automation targets surrounding workflow.",
  "  - New public company SEC obligations: Versant is a fresh NASDAQ issuer (2026). 10-K, disclosure controls, segment reporting, internal audit all need standalone process.",
  "",
  "TONE — declarative, never hedging. Forbidden phrases: 'potentially', 'could possibly', 'may help to', 'leverage AI', 'harness the power of AI', 'transformative impact'. If you could swap 'Versant' for 'any media company' and the sentence still works, rewrite it.",
].join("\n");

/** Real Versant brands the model may name in copy. */
export const ALLOWED_BRANDS: readonly string[] = [
  "Versant",
  "Versant Media Group",
  "MS NOW",
  "CNBC",
  "Golf Channel",
  "GolfNow",
  "GolfPass",
  "USA Network",
  "USA Sports",
  "E!",
  "Syfy",
  "Oxygen True Crime",
  "Fandango",
  "Rotten Tomatoes",
  "SportsEngine",
  "Free TV Networks",
  "Indy Cinema Group",
  "NBCU",
  "Hulu",
  "StockStory",
  "Kalshi",
  "Nikkei CNBC",
];

/** Real Versant people — used only when relevant to the cohort tower. */
export const ALLOWED_PEOPLE: readonly string[] = [
  "Mark Lazarus",
  "Anand Kini",
  "Deep Bagchee",
  "Rebecca Kutler",
  "KC Sullivan",
  "Matthew Hong",
  "Nate Balogh",
  "Brian Carovillano",
  "Caroline Richardson",
  "Frank Tanki",
  "Tom Clendenin",
  "David Novak",
];

/** Vendors the LLM is permitted to name. Mirrors the upstream curation list. */
export const ALLOWED_VENDORS: readonly string[] = VENDOR_ALLOW_LIST;

/** Hedge phrases the validator rejects. */
export const HEDGE_PHRASES: readonly string[] = [
  "potentially",
  "could possibly",
  "may help to",
  "leverage ai",
  "harness the power of ai",
  "transformative impact",
];

// ---------------------------------------------------------------------------
//   Prompt input shapes
// ---------------------------------------------------------------------------

export type ProjectPromptInput = {
  cohort: L4Cohort;
  assumptions: CrossTowerAssumptions;
};

/** Compact authored-project record fed to the synthesis call. */
export type ProgramSynthesisProject = {
  id: string;
  name: string;
  parentL4ActivityGroupName: string;
  primaryTowerName: string;
  narrative: string;
  valueBucket: AIProjectLLM["valueBucket"];
  effortBucket: AIProjectLLM["effortBucket"];
  effortDrivers: AIProjectLLM["effortDrivers"];
};

export type ProgramSynthesisPromptInput = {
  projects: ProgramSynthesisProject[];
  /** Cohorts that failed authoring — passed so synthesis can skirt them in narrative. */
  stubbedCohortNames: string[];
  assumptions: CrossTowerAssumptions;
  /** Optional per-tower questionnaire digests for program narrative (risks, roadmap tone). */
  synthesisIntakeDigest?: string;
};

// ---------------------------------------------------------------------------
//   System prompt — shared across both calls
// ---------------------------------------------------------------------------

export function buildSystemPrompt(): string {
  return [
    "You are the Cross-Tower AI Plan author for the Versant Forge Program (Accenture × Versant Media Group). You author Versant-specific, agentic-AI project content. The numerics, dollars, percentages, FTE counts, and concrete dates are owned by the deterministic engine — never by you.",
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
    "  - Vendor names in `workbench.post[].tool`, `digitalCore.requiredPlatforms[].examples`, and `agents[].toolsUsed` MUST be from the ALLOWED_VENDORS list (or the literal 'TBD — subject to discovery'). Pre-state tools may name legacy systems freely.",
    "  - Brand names in copy MUST be from the ALLOWED_BRANDS list when referenced.",
    "  - People names in copy MUST be from the ALLOWED_PEOPLE list when referenced.",
    "  - Forbidden hedge phrases: 'potentially', 'could possibly', 'may help to', 'leverage AI', 'harness the power of AI', 'transformative impact'.",
    "  - If you could replace 'Versant' with 'any media company' and the sentence still works, rewrite it. Every paragraph must name a Versant brand, person, or structural constraint.",
    "",
    "===========================================================================",
    "AI PROJECT MODEL",
    "===========================================================================",
    "An 'AI Project' is a process-level agentic AI delivery vehicle. Each project corresponds to ONE L4 Activity Group (a row that owns an AI dial on the operating model). The constituent L5 AI Initiatives are the use-cases the project must satisfy — they are provided to you verbatim by the engine. You do NOT decide grouping. You decide:",
    "  - The project name (business-specific, solution-oriented, ≤8 words; e.g. 'Agentic AI Financial Close' rather than 'Automate intercompany reconciliations').",
    "  - The narrative (1–2 sentences; ≤55 words; Versant-specific).",
    "  - The full 4-lens project brief (Work / Workforce / Workbench / Digital Core + Agents + Agent Orchestration).",
    "  - The value bucket (High or Low) with a ≤30-word rationale grounded in Versant business impact.",
    "  - The effort bucket (High or Low) with a ≤30-word rationale grounded in the brief signals (integration count, agent count, platform count, complexity, proven-elsewhere).",
    "  - A per-L5 inclusion rationale (≤22 words each; explains how the L5 use-case is satisfied within the project).",
    "",
    "Author the brief FIRST, then derive scoring. The brief is the source of truth for effort. The brief is also a customer-facing document — write it for an executive read-out.",
    "",
    "Effort guidance — High when the brief shows multi-platform integration, multi-agent orchestration with mixed types, novel patterns without proven Versant peers, or build effort spanning multiple quarters. Low when the brief shows configuration on existing vendor stacks (BlackLine, Workday, Eightfold, Amagi), single-platform anchors, fewer than four agents, and a proven adjacency.",
    "",
    "Value guidance — High when the project unblocks a structural Versant constraint (TSA cutover, BB- covenant discipline, DTC growth, election cycle ad capture, editorial speed) or scales a multi-brand asset (CNBC × MS NOW × Golf Channel × Fandango × GolfNow). Low when the project is back-office hygiene with a contained financial footprint.",
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
    "ALLOWED VENDORS (post-state Workbench, Digital Core examples, Agents toolsUsed)",
    "===========================================================================",
    ALLOWED_VENDORS.join(", "),
    "",
    "Return STRICT JSON ONLY. No prose outside the JSON object. The user message specifies the exact schema for the call you are answering.",
  ].join("\n");
}

// ---------------------------------------------------------------------------
//   Project (per-L4) prompt builder
// ---------------------------------------------------------------------------

const BRIEF_DEPTH_GUIDANCE: Record<BriefDepth, string> = {
  Concise: [
    "BRIEF DEPTH = Concise. Per-lens row counts:",
    "  Work.pre.steps:  3–4   |   Work.post.steps:  3–4   |   keyShifts: 3",
    "  Workforce.pre/post role count: 2 each              |   keyShifts: 3",
    "  Workbench.pre/post tool count: 2–3 each            |   keyShifts: 3",
    "  DigitalCore.requiredPlatforms: 3                    |   integrations: 2–3",
    "  Agents: 3–4",
  ].join("\n"),
  Full: [
    "BRIEF DEPTH = Full. Per-lens row counts:",
    "  Work.pre.steps:  4–6   |   Work.post.steps:  4–6   |   keyShifts: 4–5",
    "  Workforce.pre/post role count: 2–3 each            |   keyShifts: 4–5",
    "  Workbench.pre/post tool count: 3–4 each            |   keyShifts: 4–5",
    "  DigitalCore.requiredPlatforms: 4–5                  |   integrations: 4–5",
    "  Agents: 4–6",
  ].join("\n"),
};

function buildLensEmphasisLines(a: CrossTowerAssumptions): string[] {
  const lines: string[] = [];
  if (a.emphasizeTsaReadiness) {
    lines.push(
      "  - TSA readiness: when the cohort sits in a tower exposed to NBCU TSA cutover (Sales, Finance, HR, Tech & Engineering, Operations & Technology), name the TSA dependency and the cutover urgency in narrative or work.keyShifts.",
    );
  }
  if (a.emphasizeBbCreditDiscipline) {
    lines.push(
      "  - BB- credit + covenant discipline: when the cohort sits in Finance or Corporate Services, surface covenant monitoring or run-rate cost discipline as a constraint shaping the post-state design.",
    );
  }
  if (a.emphasizeEditorialIntegrity) {
    lines.push(
      "  - Editorial integrity: when the cohort sits in Editorial & News, Production, or Marketing & Communications, explicitly flag the human-judgment floor — agents are co-pilot, fact-check is human, byline is human. Brian Carovillano is gatekeeper for editorial AI.",
    );
  }
  if (a.emphasizeBroadcastResilience) {
    lines.push(
      "  - Live-broadcast resilience: when the cohort sits in Operations & Technology or Production, frame the post-state agents as protecting the on-air signal, never replacing the operator at the seat.",
    );
  }
  return lines;
}

export function buildProjectPromptForL4(input: ProjectPromptInput): string {
  const { cohort, assumptions } = input;
  const lines: string[] = [];

  lines.push("CALL TYPE: Author one AI Project for the L4 Activity Group cohort below.");
  lines.push("");
  lines.push("===========================================================================");
  lines.push("L4 COHORT (engine-supplied — do NOT regroup; echo ids verbatim)");
  lines.push("===========================================================================");
  lines.push(`Tower:                 ${cohort.towerName} (id: ${cohort.towerId})`);
  lines.push(`L3 Job Family:         ${cohort.l3JobFamilyName}`);
  lines.push(`L4 Activity Group:     ${cohort.l4Name}`);
  lines.push(`L4 row id:             ${cohort.l4RowId}`);
  lines.push(
    `Project id (use this verbatim): proj-${cohort.l4RowId}`,
  );
  lines.push(`Constituent L5 use cases (${cohort.l5Initiatives.length}):`);
  for (const l5 of cohort.l5Initiatives) {
    const ration = l5.rationale ? ` :: ${l5.rationale}` : "";
    lines.push(
      `  - id="${l5.id}" name="${l5.name}"${ration}`,
    );
  }
  lines.push("");
  lines.push(
    "Every L5 id above MUST appear in `constituentInitiativeIds` and have a matching entry in `perInitiativeRationale`. Do NOT add or drop ids.",
  );
  lines.push("");

  const emph = buildLensEmphasisLines(assumptions);
  if (emph.length > 0) {
    lines.push("LENS EMPHASES (apply only when the cohort tower is in scope):");
    for (const line of emph) lines.push(line);
    lines.push("");
  }

  lines.push(BRIEF_DEPTH_GUIDANCE[assumptions.briefDepth]);
  lines.push("");

  lines.push("===========================================================================");
  lines.push("OUTPUT SCHEMA — return STRICT JSON ONLY in exactly this shape:");
  lines.push("===========================================================================");
  lines.push(buildProjectSchemaSpec());
  lines.push("");
  lines.push(
    "Author the 4-lens brief FIRST, then derive `valueBucket` / `effortBucket` from it. `effortDrivers.integrationCount` MUST equal the length of `brief.digitalCore.integrations`; `effortDrivers.agentCount` MUST equal `brief.agents.length`; `effortDrivers.platformCount` MUST equal `brief.digitalCore.requiredPlatforms.length`. `effortRationale` MUST reference one or more of these counts in plain words (e.g. 'few integrations, single primary platform, three specialist agents, proven at Bloomberg').",
  );
  lines.push("");
  lines.push(
    "Project name MUST be business-specific and solution-oriented. Examples that pass: 'Agentic AI Financial Close', 'Cross-Brand Audience Intelligence Engine', 'Always-On Master Control Co-Pilot'. Examples that FAIL: 'Automate intercompany reconciliations', 'Improve audience analytics'.",
  );
  return lines.join("\n");
}

function buildProjectSchemaSpec(): string {
  return [
    "{",
    '  "id": "proj-<l4RowId verbatim>",',
    '  "name": "<≤8 words; business-specific solution-oriented title>",',
    '  "narrative": "<1–2 sentences; ≤55 words; Versant-specific>",',
    '  "parentL4ActivityGroupId": "<l4RowId verbatim>",',
    '  "parentL4ActivityGroupName": "<L4 Activity Group name verbatim>",',
    '  "primaryTowerId": "<tower id verbatim>",',
    '  "constituentInitiativeIds": ["<L5 id>", ...],',
    '  "perInitiativeRationale": [',
    '    { "initiativeId": "<L5 id>", "rationale": "<≤22 words>" }',
    "  ],",
    '  "brief": {',
    '    "framing": "<≤25 words; the brief headline>",',
    '    "currentPainPoints": ["<≤16 words>", ...],',
    '    "work": {',
    '      "pre":  { "description": "<≤45 words>", "steps": [{"step": <int>, "action": "<≤16 words>", "owner": "<role>", "duration": "<qualitative>", "isManual": <bool>}], "avgCycleTime": "<qualitative>", "touchpointsSummary": "<qualitative>", "errorRateSummary": "<qualitative>" },',
    '      "post": { ...same shape, action describes what the agents do },',
    '      "keyShifts": ["<≤18 words>", ...]',
    "    },",
    '    "workforce": {',
    '      "pre":  [{ "role": "<role>", "headcountSummary": "<qualitative>", "primaryActivities": ["<≤14 words>", ...], "skillsRequired": ["<short>", ...] }],',
    '      "post": [{ ...same shape, post-state roles >}],',
    '      "keyShifts": ["<≤18 words>", ...],',
    '      "workforceImpactTier": "High" | "Medium" | "Low",',
    '      "workforceImpactSummary": "<≤45 words>"',
    "    },",
    '    "workbench": {',
    '      "pre":  [{ "tool": "<vendor or legacy system>", "category": "<short>", "usage": "<≤14 words>" }],',
    '      "post": [{ "tool": "<allow-listed vendor or TBD — subject to discovery>", "category": "<short>", "usage": "<≤14 words>" }],',
    '      "keyShifts": ["<≤18 words>", ...]',
    "    },",
    '    "digitalCore": {',
    '      "requiredPlatforms": [{ "platform": "<generic category>", "purpose": "<≤16 words>", "priority": "Critical" | "Important" | "Nice-to-have", "examples": ["<allow-listed vendor>", ...] }],',
    '      "dataRequirements": ["<≤18 words>", ...],',
    '      "integrations": ["<system A ↔ system B>", ...],',
    '      "securityConsiderations": ["<≤18 words>", ...],',
    '      "estimatedBuildEffortSummary": "<qualitative; never months/dollars>"',
    "    },",
    '    "agents": [',
    '      { "name": "<Agent name>", "role": "<≤14 words>", "type": "Orchestrator" | "Specialist" | "Monitor" | "Router" | "Executor", "inputs": ["<short>", ...], "outputs": ["<short>", ...], "llmRequired": <bool>, "toolsUsed": ["<allow-listed vendor>", ...] }',
    "    ],",
    '    "agentOrchestration": { "pattern": "Sequential" | "Parallel" | "Hub-and-Spoke" | "Pipeline" | "Hierarchical", "description": "<≤30 words>" }',
    "  },",
    '  "valueBucket": "High" | "Low",',
    '  "valueRationale": "<≤30 words>",',
    '  "effortBucket": "High" | "Low",',
    '  "effortRationale": "<≤30 words; references brief signals>",',
    '  "effortDrivers": {',
    '    "integrationCount": <int>,',
    '    "agentCount": <int>,',
    '    "platformCount": <int>,',
    '    "complexity": "Low" | "Medium" | "High",',
    '    "provenElsewhere": <bool>,',
    '    "provenRationale": "<≤20 words>"',
    "  }",
    "}",
  ].join("\n");
}

// ---------------------------------------------------------------------------
//   Program-synthesis prompt builder (one call after fan-out)
// ---------------------------------------------------------------------------

export function buildProgramSynthesisPrompt(
  input: ProgramSynthesisPromptInput,
): string {
  const { projects, stubbedCohortNames, assumptions, synthesisIntakeDigest } =
    input;
  const lines: string[] = [];
  lines.push(
    "CALL TYPE: Author the program-level synthesis given the authored AI Projects below.",
  );
  lines.push("");
  lines.push("===========================================================================");
  lines.push("AUTHORED PROJECTS (compact summary)");
  lines.push("===========================================================================");
  for (const p of projects) {
    lines.push(
      `  - id="${p.id}" name="${p.name}" tower="${p.primaryTowerName}" L4="${p.parentL4ActivityGroupName}" value=${p.valueBucket} effort=${p.effortBucket} (proven=${p.effortDrivers.provenElsewhere}, integrations=${p.effortDrivers.integrationCount}, agents=${p.effortDrivers.agentCount})`,
    );
    lines.push(`      narrative: ${p.narrative}`);
  }
  lines.push("");
  if (stubbedCohortNames.length > 0) {
    lines.push("STUBBED COHORTS (authoring failed; refer to them only by L4 name when narratively useful):");
    for (const n of stubbedCohortNames) lines.push(`  - ${n}`);
    lines.push("");
  }

  lines.push("===========================================================================");
  lines.push("TIMING ASSUMPTIONS (for narrative alignment with the deterministic Gantt)");
  lines.push("===========================================================================");
  lines.push(
    `Program window starts at month ${assumptions.programStartMonth}. P1 cohorts: first build month M${assumptions.p1PhaseStartMonth}, build duration ${assumptions.p1BuildMonths} months. P2 cohorts: first build month M${assumptions.p2PhaseStartMonth}, build duration ${assumptions.p2BuildMonths} months. P3 cohorts: first build month M${assumptions.p3PhaseStartMonth}, build duration ${assumptions.p3BuildMonths} months. Value accrual begins immediately after each cohort's build window; linear adoption ramp ${assumptions.rampMonths} months to full run-rate.`,
  );
  lines.push(
    "Use these to align the roadmap narrative to the Gantt the engine renders. Never echo the numbers themselves in your output — you may reference 'first half-year', 'second half-year', 'second year' as qualitative anchors.",
  );
  lines.push("");

  if (synthesisIntakeDigest && synthesisIntakeDigest.trim()) {
    lines.push("===========================================================================");
    lines.push("TOWER LEAD QUESTIONNAIRES (Cross-tower)");
    lines.push("===========================================================================");
    lines.push(
      "Tower leads submitted the following Forge Tower AI Readiness Intake content. Honor constraints, no-go zones, and systems named here in executive summary, roadmap, risks, and dependency narrative. Do not contradict explicit no-go language. Never invent financial figures.",
    );
    lines.push("");
    lines.push(synthesisIntakeDigest.trim());
    lines.push("");
  }

  lines.push("===========================================================================");
  lines.push("OUTPUT SCHEMA — return STRICT JSON ONLY in exactly this shape:");
  lines.push("===========================================================================");
  lines.push(buildSynthesisSchemaSpec());
  lines.push("");
  lines.push(
    "Risks must be 3–8 entries, declarative, ranked by program-level severity. dependsOn entries MUST refer only to project ids in the AUTHORED PROJECTS list above (never stubbed-cohort names, never invented ids). Architecture commentary must reference at least one allow-listed vendor when invoking the Workbench, at least one orchestration pattern when invoking Orchestration, and at least one Versant data asset when invoking the Digital Core.",
  );
  return lines.join("\n");
}

function buildSynthesisSchemaSpec(): string {
  return [
    "{",
    '  "executiveSummary": "<≤55 words; the page header narrative; Versant-specific>",',
    '  "dependsOn": [',
    '    { "projectId": "<authored project id>", "dependsOn": ["<authored project id>", ...], "reason": "<≤22 words>" }',
    "  ],",
    '  "risks": [',
    '    { "title": "<≤6 words>", "description": "<≤30 words>", "mitigation": "<≤30 words>" }',
    "  ],",
    '  "roadmapNarrative": {',
    '    "overall": "<≤55 words; sequencing across the 24-month window>",',
    '    "ladder": "<≤45 words; how Quick Wins ladder into Strategic Bets>",',
    '    "milestones": ["<≤18 words>", ...],',
    '    "ownerNotes": ["<≤25 words>", ...]',
    "  },",
    '  "architectureOrchestration": "<≤45 words; orchestration pattern commentary>",',
    '  "architectureVendors": "<≤45 words; vendor stack convergence; allow-listed vendors only>",',
    '  "architectureDataCore": "<≤45 words; data + digital core implications>"',
    "}",
  ].join("\n");
}
