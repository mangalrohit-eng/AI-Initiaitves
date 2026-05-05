/**
 * Versant Prompt Kit — single source of truth for LLM grounding across
 * Steps 1, 2, 4, 5, plus Cross-Tower Plan, Offshore Plan, and Ask Forge.
 *
 * Why this exists:
 *   Before this kit, every server-side LLM module re-declared the Versant
 *   identity paragraph, brand list, per-tower context table, vendor
 *   allow-list, hedge-phrase blacklist, and Chat-vs-Responses-API request
 *   shaping. The result was 5+ subtly-different copies (Step 1's
 *   `inferDefaultsLLM` had a 4-tower table; Step 2's `generateL4ActivitiesLLM`
 *   had vendor hints per tower; Step 4's `curateInitiativesLLM` only listed
 *   editorial restrictions; Step 5's `curateBriefProcessLLM` used
 *   `TOWER_BRAND_HINT`; cross-tower used a richer but disjoint
 *   `VERSANT_CONTEXT_BLOCK`). The kit consolidates them so every LLM call
 *   speaks the same Versant.
 *
 * What lives here:
 *   - Identity / brand / people / per-tower context constants
 *   - Vendor allow-list + canonical NotEligibleReason set
 *   - Blacklist of consulting hedge phrases
 *   - AI-forward naming guidance (initiative + project variants)
 *   - Section builders (preamble, L4 context block, voice-rule block, etc.)
 *   - `buildLLMRequest` — the one true Chat-vs-Responses-API helper
 *   - `getInferenceMeta` — `{ model, mode }` tuple for UI footers
 *
 * Per the program rule "no path-specific routes," every consumer hits
 * `gpt-5.5` via the Responses API + reasoning. The single `OPENAI_MODEL`
 * env var still acts as a global escape hatch; per-route `OPENAI_*_MODEL`
 * overrides have been removed from every caller.
 */

import type { TowerId, NotEligibleReason } from "@/data/assess/types";
import { resolveOpenAiBaseUrl } from "@/lib/llm/openaiBase";

// ===========================================================================
//   Versioning — bump when prompt content changes materially
// ===========================================================================

/**
 * Kit version — embed in prompts that benefit from cache-busting (curation
 * hash inputs, brief cache keys, cross-tower cache keys). Bump when the
 * Versant identity, per-tower context, vendor allow-list, voice rules, or
 * naming guidance change in a way that would flip outputs.
 */
export const VERSANT_PROMPT_KIT_VERSION = "vpk-2026-05-05a";

// ===========================================================================
//   Defaults — the single Versant model + reasoning bar
// ===========================================================================

export type ReasoningEffort = "minimal" | "low" | "medium" | "high";

/** Default model for every Versant LLM call. */
export const VERSANT_DEFAULT_MODEL = "gpt-5.5";

/**
 * Default reasoning effort for Versant calls. `"medium"` balances quality
 * against latency for the per-L4 batch shape (≤14 L5 rows / call). Light
 * batch sizes can drop to `"low"` for hot paths; deep multi-lens briefs go
 * to `"high"`.
 */
export const VERSANT_DEFAULT_REASONING_EFFORT: ReasoningEffort = "medium";

/**
 * Default response timeout for Versant calls. Cross-tower synthesis and
 * deep briefs override to a longer ceiling.
 */
export const VERSANT_DEFAULT_TIMEOUT_MS = 90_000;

/**
 * Default max output tokens. Per-row curation calls comfortably fit; brief
 * authoring overrides upward.
 */
export const VERSANT_DEFAULT_MAX_OUTPUT_TOKENS = 6_000;

/**
 * Resolves the model id. `options.model` (test override) wins, then the
 * single global `OPENAI_MODEL` env var, then `VERSANT_DEFAULT_MODEL`.
 * Per-route env overrides (e.g. `OPENAI_CURATE_INITIATIVES_MODEL`) are
 * intentionally not honored — every Versant call uses the same model.
 */
export function resolveModelId(override?: string): string {
  return (
    override?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    VERSANT_DEFAULT_MODEL
  );
}

/**
 * `gpt-5*`, `o1*`, `o3*`, `o4*` go via Responses API (which supports the
 * reasoning effort knob). Everything else (`gpt-4o`, `gpt-4*`, future
 * dense models) goes via Chat Completions. A single emergency env var
 * (`OPENAI_FORCE_CHAT_COMPLETIONS=1`) flips every Versant caller back to
 * Chat Completions in case Responses API has an outage.
 */
export function shouldUseResponsesApi(modelId: string): boolean {
  if (process.env.OPENAI_FORCE_CHAT_COMPLETIONS === "1") return false;
  const m = modelId.toLowerCase();
  return (
    m.startsWith("gpt-5") ||
    m.startsWith("o1") ||
    m.startsWith("o3") ||
    m.startsWith("o4")
  );
}

export type InferenceMode = "responses" | "chat";

export type InferenceMeta = {
  model: string;
  mode: InferenceMode;
  reasoningEffort: ReasoningEffort | null;
  promptKitVersion: string;
};

export function getInferenceMeta(
  override?: string,
  reasoningEffort: ReasoningEffort | null = VERSANT_DEFAULT_REASONING_EFFORT,
): InferenceMeta {
  const model = resolveModelId(override);
  const mode: InferenceMode = shouldUseResponsesApi(model) ? "responses" : "chat";
  return {
    model,
    mode,
    reasoningEffort: mode === "responses" ? reasoningEffort : null,
    promptKitVersion: VERSANT_PROMPT_KIT_VERSION,
  };
}

// ===========================================================================
//   Versant identity
// ===========================================================================

/**
 * Short identity paragraph — used by per-row callers (Steps 1, 2, 4
 * verdict). Keep tight; the Step-5 brief and Cross-Tower plan use the
 * fuller `VERSANT_CONTEXT_BLOCK` instead.
 */
export const VERSANT_IDENTITY_PARAGRAPH =
  "Versant Media Group (NASDAQ: VSNT) is the publicly-traded spin-off of NBCUniversal's news, sports, streaming, and digital portfolio: MS NOW, CNBC, Golf Channel, GolfNow, GolfPass, USA Network, E!, Syfy, Oxygen True Crime, Fandango, Rotten Tomatoes, SportsEngine, Free TV Networks. ~$6.7B revenue, ~$2.4B Adj. EBITDA, ~$2.75B debt rated BB- (junk), ~$1B authorised buyback, $0.375/share quarterly dividend. Runs on NBCU shared-services TSAs (ad sales, finance close, payroll, IT, broadcast ops) until cutover ~2028. Must be AI-native by Day 1 — there is no 'add AI later'.";

/**
 * Long program-grain context block — financials framing, brand portfolio,
 * leadership, structural constraints. Used by Step-5 brief authoring,
 * Cross-Tower plan, and Ask Forge. Sourced verbatim from
 * `docs/context.md`.
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
].join("\n");

// ===========================================================================
//   Brand / people / vendor allow-lists
// ===========================================================================

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

/**
 * Real vendors the LLM is allowed to name in post-state Workbench /
 * Digital Core / Agents `toolsUsed`. Pre-state tools may name legacy
 * systems freely. The literal `"TBD — subject to discovery"` is always
 * permitted as a fallback.
 *
 * Curated to vendors that already appear in the operating model or have
 * been validated as reasonable Versant fits. When we add a new vendor to
 * a brief, add it here too.
 */
export const ALLOWED_VENDORS: readonly string[] = [
  // Finance / close / treasury
  "BlackLine",
  "Workiva",
  "FloQast",
  "Vena",
  "Trintech",
  "Anaplan",
  "Pigment",
  "Tipalti",
  "Bill.com",
  "AppZen",
  "Stampli",
  "Coupa",
  "Concur",
  "SAP S/4HANA",
  "Oracle Fusion",
  "NetSuite",
  "Workday Financials",
  "Sage Intacct",
  "Kyriba",
  "GTreasury",
  "Ramp",
  "Brex",
  // HR / people
  "Workday HCM",
  "Workday Adaptive",
  "Eightfold",
  "Phenom",
  "Beamery",
  "Visier",
  "Lattice",
  "Culture Amp",
  "Greenhouse",
  "Lever",
  "ADP",
  // Content / editorial
  "Descript",
  "Veritone",
  "Deepgram",
  "AssemblyAI",
  "Speechmatics",
  "Wisecut",
  "Captions.ai",
  "Adobe Premiere Pro",
  "Adobe Audition",
  "Adobe Sensei",
  "Avid Media Composer",
  "iNEWS",
  "ENPS",
  "Reuters Connect",
  "AP",
  "Factiva",
  "Bloomberg Terminal",
  "OpenAI",
  "Anthropic",
  "Google Gemini",
  "Mistral",
  "ElevenLabs",
  "Runway",
  "Sora",
  // Broadcast / playout / distribution
  "Amagi",
  "Imagine Communications",
  "Evertz",
  "Grass Valley",
  "Telestream",
  "Vizrt",
  "Ross Video",
  "AWS Elemental",
  "Akamai",
  // Ad sales / monetization / DTC
  "FreeWheel",
  "Operative",
  "Mediaocean",
  "Magnite",
  "Yahoo DSP",
  "The Trade Desk",
  "LiveRamp",
  "Iterable",
  "Braze",
  "Piano",
  "Zuora",
  "Salesforce",
  "Salesforce Marketing Cloud",
  "Adobe Experience Platform",
  "Segment",
  "Snowflake",
  "Databricks",
  "Looker",
  "Tableau",
  "Power BI",
  // Rights / royalties
  "Rightsline",
  "FilmTrack",
  "Whip Media",
  "Vistex",
  // Marketing / brand / measurement
  "Sprinklor",
  "Sprinklr",
  "Brandwatch",
  "Quid",
  "NewsWhip",
  "Comscore",
  "Nielsen",
  "iSpot.tv",
  "Samba TV",
  // Legal / compliance / contracts
  "Ironclad",
  "Evisort",
  "Harvey",
  "DocuSign",
  "DocuSign CLM",
  "OneTrust",
  // IT / cybersecurity
  "ServiceNow",
  "Atlassian",
  "Jira",
  "Confluence",
  "GitHub",
  "GitHub Copilot",
  "CrowdStrike",
  "Abnormal Security",
  "Wiz",
  "Snyk",
  "Datadog",
  "Splunk",
  "Microsoft 365",
  "Microsoft Sentinel",
  "Microsoft Purview",
  "Microsoft Copilot",
  "Okta",
  "PagerDuty",
  "Cloudflare",
  // Cloud
  "AWS",
  "Azure",
  "Google Cloud",
  // Hyperscaler AI
  "AWS Bedrock",
  "Azure OpenAI",
  "Vertex AI",
  // Agentic / orchestration platforms
  "LangChain",
  "LangGraph",
  "LlamaIndex",
  "CrewAI",
  "Pinecone",
  "Weaviate",
  "Glean",
  "Hebbia",
];

/**
 * Canonical "why not AI" reasons. Every `reviewed-not-eligible` L5 must
 * fall back to one of these strings — LLM paraphrase is rejected. Mirrors
 * `NotEligibleReason` in `data/assess/types.ts` (sourced from
 * `docs/context.md` §9).
 */
export const NOT_ELIGIBLE_REASONS: readonly NotEligibleReason[] = [
  "Requires human editorial judgment",
  "Fundamentally relationship-driven",
  "Already automated via existing tools",
  "Low volume — ROI doesn't justify AI investment",
  "Strategic exercise requiring executive judgment",
];

// ===========================================================================
//   Per-tower context — the richest version, reconciled across all callers
// ===========================================================================

/**
 * Tower-grain context paragraph. Every per-row call (Steps 1/2/4) injects
 * this for the active tower. Reconciles the previously-divergent tower
 * hints in `inferDefaultsLLM`, `generateL4ActivitiesLLM`,
 * `curateInitiativesLLM`, and the `TOWER_BRAND_HINT` in
 * `curateBriefProcessLLM`. Each entry covers:
 *   - what the tower owns at Versant,
 *   - the structural constraint(s) that shape its AI agenda,
 *   - the named vendors / platforms that anchor its post-state.
 */
export const TOWER_CONTEXT: Record<TowerId, string> = {
  finance:
    "Finance (Versant leads Greg Wright + Andre Hale). NBCU TSA covers finance close, treasury, payroll until ~2028; Versant must stand up its own close (target 5-7 days down from 12-18) under CFO Anand Kini and ensure BB- covenant compliance — covenant breach is existential. New-public-company SEC obligations: maiden 10-K landed FY2025, segment reporting, disclosure controls, internal audit. Multi-entity consolidation across 7+ brands plus Fandango JV (75/25 WBD) and Nikkei CNBC JV. Content-rights amortization across hundreds of deals. Vendor stack tilts toward BlackLine, Workiva, FloQast, Trintech, Tipalti, AppZen, SAP S/4HANA / Oracle Fusion / NetSuite, Workday Financials, Vena, Anaplan, Pigment, Kyriba, GTreasury.",
  hr:
    "HR & Talent. Carve-out year — building standalone HR off NBCU TSAs while landing every Versant employee on a single Workday HCM. CEO Mark Lazarus owns the talent strategy; named-talent contracts (anchors, on-air, executives) are relationship-driven — AI assists drafting, intelligence, and analytics, not negotiation. Hard floor: editorial talent (MS NOW, CNBC), live-event talent (Golf, Olympics) is name-by-name. Vendor stack tilts toward Workday HCM / Adaptive, Eightfold, Phenom, Beamery, Greenhouse / Lever, Visier, Lattice, Culture Amp, ADP.",
  "research-analytics":
    "Research & Analytics. Powers the audience, ratings, ad-research, content-performance signal across MS NOW, CNBC, USA Network, E!, Syfy, Oxygen True Crime, Golf Channel, Fandango, Rotten Tomatoes, SportsEngine. Inputs to ad sales (yield), programming (commissioning), marketing (campaigns), and editorial (audience strategy). Election-cycle 2026 audience modeling is high-stakes for MS NOW. Vendor stack tilts toward Comscore, Nielsen, iSpot.tv, Samba TV, Snowflake, Databricks, Looker, Tableau, Power BI, Brandwatch, Quid, NewsWhip.",
  legal:
    "Legal & Business Affairs. Contract surge from spin-off: vendor renegotiation, JV docs (Fandango 75/25 WBD, Nikkei CNBC), talent agreements (anchors, on-air, athletes), rights deals (USGA through 2032, Olympics windows, Kardashians-style split rights). New-public-company SEC + governance posture under Board Chair David Novak. CISO Caroline Richardson partners on data-protection / privacy. Hard floor: AI drafts and reviews, never signs. Vendor stack tilts toward Ironclad, Evisort, Harvey, DocuSign / DocuSign CLM, OneTrust, Bloomberg Terminal.",
  "corp-services":
    "Corporate Services (Procurement / Real Estate / Facilities / Travel / Internal Operations). New-public-company posture: SOX-grade controls, vendor master data discipline, real-estate footprint reset post-spin. Procurement standing up its own SaaS sourcing motion off NBCU. Vendor stack tilts toward Coupa, Concur, ServiceNow, Microsoft 365, Workday Financials, DocuSign.",
  "tech-engineering":
    "Technology & Engineering (CIO Nate Balogh). Standalone IT stand-up: identity, endpoint, network, SecOps, developer platforms — all carved out from NBCU. CISO Caroline Richardson owns cybersecurity. Engineering is the spine for every other tower's AI delivery — agentic platforms, RAG infrastructure, vector stores, model governance, hyperscaler footprint. Vendor stack tilts toward Microsoft 365 / Sentinel / Purview / Copilot, Okta, ServiceNow, Atlassian / Jira / Confluence, GitHub Copilot, CrowdStrike, Abnormal Security, Wiz, Snyk, Datadog, Splunk, AWS / Azure / GCP, AWS Bedrock / Azure OpenAI / Vertex AI, LangChain, LangGraph, Pinecone, Weaviate, Glean.",
  "operations-technology":
    "Operations & Technology (Broadcast Ops / Master Control / Distribution / Affiliate Engineering). Live-broadcast physical floor: master control, on-air ops, in-studio production are physical, US-located, talent-relationship-driven. Versant must replicate NBCU's affiliate distribution and broadcast ops standalone before TSA cutover (~2028). Winter Olympics on USA/CNBC, USGA through 2032, NHL/NFL windows — high-stakes live operational moments where downtime is unacceptable. Vendor stack tilts toward Amagi, Imagine Communications, Evertz, Grass Valley, Telestream, Vizrt, Ross Video, AWS Elemental, Akamai.",
  sales:
    "Sales (Ad Sales & Sponsorships). Ad sales is greenfield — NBCU sells Versant inventory under TSA until ~2028, then Versant must run upfronts, scatter, sponsorships, programmatic, DTC monetization standalone. ~$1.58B advertising revenue at risk if cutover stumbles. CMO Frank Tanki (Entertainment & Sports) and CMO Tom Clendenin (CNBC & MS NOW) own client-facing positioning. Election-cycle 2026 capture is critical for MS NOW; Olympics on USA/CNBC drives premium upfront. Vendor stack tilts toward FreeWheel, Operative, Mediaocean, Magnite, Yahoo DSP, The Trade Desk, LiveRamp, Salesforce, Comscore, Nielsen, iSpot.tv, Samba TV.",
  "marketing-comms":
    "Marketing & Communications. Multi-brand orchestration across MS NOW, CNBC, Golf Channel, USA Network, E!, Syfy, Oxygen True Crime, Fandango, Rotten Tomatoes, SportsEngine. CMOs split: Frank Tanki (Entertainment & Sports), Tom Clendenin (CNBC & MS NOW). DTC growth motion: MS NOW community launching summer 2026, CNBC Pro, GolfPass, Fandango. Election-cycle 2026 brand-safety stakes are high for MS NOW; progressive editorial voice must be preserved. Vendor stack tilts toward Sprinklr, Brandwatch, Quid, NewsWhip, Iterable, Braze, Piano, Salesforce Marketing Cloud, Adobe Experience Platform, LiveRamp.",
  service:
    "Service (Customer Care / DTC Subscriber Service / Affiliate Service). Stand-up of standalone subscriber care for CNBC Pro, GolfPass, MS NOW community (summer 2026), Fandango. Affiliate service for distribution partners. Hard floor: brand-defining moments stay human, AI handles deflection, intent classification, knowledge retrieval, and case routing. Vendor stack tilts toward Salesforce, ServiceNow, Iterable, Braze, OpenAI / Anthropic for grounded RAG.",
  "editorial-news":
    "Editorial & News (President MS NOW Rebecca Kutler, President CNBC KC Sullivan, CPTO News Deep Bagchee). Owns MS NOW (progressive politics, DTC community launching summer 2026, election-night audience leader), CNBC (global #1 business news, CNBC Pro, Kalshi partnership, StockStory acquisition integration in flight, Nikkei CNBC JV), and Sports News under Matthew Hong. Editorial AI gatekeeper is Brian Carovillano (SVP Standards & Editorial). Hard floor: anchors, reporters, fact-checking, political coverage stay onshore and human — AI is co-pilot in the newsroom, never byline. Crisis detection on MS NOW must respect progressive voice without flattening it. Vendor stack tilts toward Reuters Connect, AP, Factiva, Bloomberg Terminal, iNEWS, ENPS, Veritone, Deepgram, AssemblyAI, Speechmatics, Descript.",
  production:
    "Production. Owns in-studio production, post-production, live event production, sports production (USGA through 2032, Olympics windows on USA/CNBC, Rory McIlroy / Firethorn JV, NHL/NFL where applicable). ~$2.45B programming and production cost — biggest single OpEx line — most of which lives across this tower and Programming & Development. Live production is physical and talent-relationship-driven; post-production is the highest-leverage automation surface (transcription, rough cuts, captioning, archive search). Vendor stack tilts toward Avid Media Composer, Adobe Premiere / Audition / Sensei, Veritone, Descript, Wisecut, Captions.ai, Vizrt, Ross Video, Telestream, ElevenLabs, Runway, Sora.",
  "programming-dev":
    "Programming & Development. Owns commissioning, scheduling, content acquisition, talent deal-shape (relationship-driven), and rights administration. Split-rights complexity (Kardashians-style: on-air retained at Versant, streaming sold to Hulu) means rights and metadata reconciliation is non-trivial. Sports rights anchor the schedule (USGA through 2032, Olympics windows on USA/CNBC, Rory McIlroy / Firethorn JV). Hard floor: greenlight and talent negotiation is human; AI accelerates research, treatment evaluation, scheduling optimization, and rights tracking. Vendor stack tilts toward Rightsline, FilmTrack, Whip Media, Vistex, Avid, Adobe Sensei, Bloomberg Terminal.",
};

/** Helper: returns a tower's context paragraph or a safe fallback string. */
export function getTowerContext(towerId: TowerId | string): string {
  const block = (TOWER_CONTEXT as Record<string, string | undefined>)[towerId];
  return (
    block ??
    "Versant Forge tower — context not yet authored in versantPromptKit; treat as TBD and fall back to the program-grain identity."
  );
}

// ===========================================================================
//   Voice rules — the consulting-fluff blacklist
// ===========================================================================

/**
 * Hedge / fluff phrases the LLM must never produce. The Cross-Tower
 * validator hard-rejects these; Steps 1/2/4/5 use them as authoring rules.
 * Lower-cased for case-insensitive matching.
 */
export const HEDGE_PHRASES: readonly string[] = [
  "potentially",
  "could possibly",
  "may help to",
  "leverage ai",
  "leverage the power",
  "harness the power of ai",
  "transformative impact",
  "synergy",
  "best-in-class",
  "world-class",
  "future-proof",
  "step change",
  "game-changer",
  "game-changing",
  "paradigm shift",
];

/**
 * Voice rules — declarative, Versant-specific, anti-hedge. Apply to every
 * narrative field across Steps 1, 2, 4, 5, and Cross-Tower.
 */
export const VERSANT_VOICE_RULES = [
  "VOICE — declarative, executive-grade, Versant-specific.",
  "  - Write in present tense. Describe what the AI does and the evidence it works.",
  "  - Name a Versant brand, person, or structural constraint in every paragraph. If you could swap 'Versant' for 'any media company' and the sentence still works, rewrite it.",
  "  - Quantify only when the deterministic engine has not already rendered the number. Do NOT echo dollars, percentages, headcount totals, or revenue figures from the Versant context block — the engine prints those.",
  "  - Forbidden hedge / fluff phrases (case-insensitive): " +
    HEDGE_PHRASES.join(", ") +
    ".",
  "  - Avoid 'AI will help to', 'enables', 'empowers', 'unlocks', 'streamlines'. State the action: 'reconciles intercompany transactions across 7+ Versant entities' beats 'streamlines reconciliation'.",
  "  - When the metric or fact is not in the Versant context block, use the literal 'TBD — subject to discovery' rather than inventing a number.",
].join("\n");

// ===========================================================================
//   AI-forward naming guidance — the Step 4 / Step 5 anchor
// ===========================================================================

/**
 * Naming guidance for AI initiatives (Step 4 L5 leaves) and AI projects
 * (Step 5 L4 cohorts). The same principle — name what the AI does, not
 * the activity it lives inside — but with different word caps.
 *
 * The contrast examples are drawn from `docs/context.md` so the LLM has a
 * concrete shape to anchor on, not a generic principle.
 */
export const AI_INITIATIVE_NAMING_RULES = [
  "AI-FORWARD NAMING — for `initiativeName` (the Step 4 display title).",
  "  - Required shape: a noun-led phrase (3-7 words) describing what the AI does, not the underlying activity.",
  "  - The AI initiative name MUST be semantically distinct from the L5 Activity inventory label. If they read identically, rewrite the AI name to lead with the AI capability.",
  "  - Contrast examples (L5 Activity → initiativeName):",
  "      'Vendor MDM — execution'                 → 'Vendor master data automation'",
  "      'Bank Reconciliations'                   → 'Bank reconciliation auto-match'",
  "      'MD&A Narrative Drafting'                → 'MD&A first-draft generator'",
  "      'Talent Acquisition — sourcing'          → 'Sourcing & shortlist agent'",
  "      'News Briefing Production'               → 'Newsroom briefing co-pilot'",
  "      'Ad Inventory Yield Optimization'        → 'Inventory yield optimizer'",
  "      'Workforce Planning'                     → 'Workforce planning copilot'",
  "  - Forbidden openers: 'Automate', 'Improve', 'Enhance', 'Accelerate', 'Transform', 'Modernize'.",
  "  - Forbidden patterns: starting with a verb-ing form ('Automating ...', 'Driving ...'). Use noun forms instead.",
  "  - Forbidden suffixes: '— execution', '— review and exception handling', '— reporting'. The AI initiative is the unit; do not echo a stage decomposition.",
].join("\n");

export const AI_PROJECT_NAMING_RULES = [
  "AI-FORWARD NAMING — for cross-tower `name` (the Step 5 / Cross-Tower project title).",
  "  - Required shape: ≤8 words; declarative; describes the AI project's solution, not the work it replaces.",
  "  - Examples: 'Agentic AI Financial Close', 'Editorial Crisis-Detection Mesh', 'Ad Sales Yield & Pacing Mesh', 'DTC Conversion & Retention Engine'.",
  "  - Forbidden openers: 'Automate', 'Improve', 'Enhance', 'Accelerate', 'Transform', 'Modernize'.",
  "  - The project name MUST be Versant-specific or Versant-evocative — generic project titles like 'Finance Transformation' are rejected.",
].join("\n");

// ===========================================================================
//   Prompt section builders
// ===========================================================================

export type PreambleGrain = "row" | "program";

/**
 * Builds the opening identity block. Use `grain: "row"` for per-row
 * callers (Steps 1/2/4 verdict, Step 5 brief authoring's micro-context),
 * `grain: "program"` for the full Step-5 brief, Cross-Tower plan, and Ask
 * Forge — anywhere the leadership table and structural constraints belong
 * in the prompt.
 */
export function buildVersantPreamble(opts: { grain: PreambleGrain }): string {
  if (opts.grain === "program") {
    return [
      "===========================================================================",
      "VERSANT CONTEXT (single source of truth — do not echo numerics in output)",
      "===========================================================================",
      VERSANT_CONTEXT_BLOCK,
    ].join("\n");
  }
  return [
    "===========================================================================",
    "VERSANT IDENTITY",
    "===========================================================================",
    VERSANT_IDENTITY_PARAGRAPH,
  ].join("\n");
}

/**
 * Builds the per-tower context block. Pass the active tower id; falls back
 * to a TBD line for unknown ids.
 */
export function buildTowerContextBlock(towerId: TowerId | string): string {
  return [
    "===========================================================================",
    `TOWER CONTEXT — ${towerId}`,
    "===========================================================================",
    getTowerContext(towerId),
  ].join("\n");
}

/**
 * Builds the voice / forbidden-phrases block. Reusable across every prompt.
 */
export function buildVoiceRulesBlock(): string {
  return [
    "===========================================================================",
    "VOICE RULES (apply to every narrative field)",
    "===========================================================================",
    VERSANT_VOICE_RULES,
  ].join("\n");
}

/**
 * Builds the brand / people / vendor allow-list block. Use for any prompt
 * whose output names brands, people, or post-state vendors.
 */
export function buildAllowListsBlock(opts?: {
  includePeople?: boolean;
  includeVendors?: boolean;
}): string {
  const includePeople = opts?.includePeople ?? true;
  const includeVendors = opts?.includeVendors ?? true;
  const parts: string[] = [
    "===========================================================================",
    "ALLOWED BRANDS (use these names verbatim when referencing Versant brands)",
    "===========================================================================",
    ALLOWED_BRANDS.join(", "),
  ];
  if (includePeople) {
    parts.push(
      "",
      "===========================================================================",
      "ALLOWED PEOPLE (only when relevant to the active tower)",
      "===========================================================================",
      ALLOWED_PEOPLE.join(", "),
    );
  }
  if (includeVendors) {
    parts.push(
      "",
      "===========================================================================",
      "ALLOWED VENDORS (post-state Workbench, Digital Core examples, Agents toolsUsed)",
      "===========================================================================",
      ALLOWED_VENDORS.join(", "),
    );
  }
  return parts.join("\n");
}

/**
 * Builds the not-eligible-reason whitelist. For Step-4 curation only —
 * paraphrase of these is rejected.
 */
export function buildNotEligibleReasonsBlock(): string {
  return [
    "===========================================================================",
    "ALLOWED `notEligibleReason` STRINGS (exact match; LLM paraphrase is rejected)",
    "===========================================================================",
    NOT_ELIGIBLE_REASONS.map((r) => `  - ${r}`).join("\n"),
  ].join("\n");
}

/** Builds the AI-initiative naming-rules block. For Step 4 L5 callers. */
export function buildInitiativeNamingBlock(): string {
  return [
    "===========================================================================",
    "AI INITIATIVE NAMING (the `initiativeName` field)",
    "===========================================================================",
    AI_INITIATIVE_NAMING_RULES,
  ].join("\n");
}

/** Builds the AI-project naming-rules block. For Step-5 / Cross-Tower callers. */
export function buildProjectNamingBlock(): string {
  return [
    "===========================================================================",
    "AI PROJECT NAMING (the `name` field)",
    "===========================================================================",
    AI_PROJECT_NAMING_RULES,
  ].join("\n");
}

// ===========================================================================
//   buildLLMRequest — the one true Chat-vs-Responses-API helper
// ===========================================================================

export type BuildLLMRequestArgs = {
  /** System / instructions content. */
  systemPrompt: string;
  /** User / input content. The Responses API call wraps it with a JSON-mode reminder. */
  userPrompt: string;
  /** Override the resolved model (test injection). */
  model?: string;
  /** Reasoning effort — only used when the resolved model goes via Responses API. */
  reasoningEffort?: ReasoningEffort;
  /** Cap on output tokens. */
  maxOutputTokens?: number;
  /** Chat Completions temperature. Ignored on Responses API. */
  temperature?: number;
  /** Hard timeout for the network call, in ms. */
  timeoutMs?: number;
  /** Verbosity for Responses API. */
  verbosity?: "low" | "medium" | "high";
  /** Caller-supplied AbortSignal. Combined with the timeout signal. */
  signal?: AbortSignal;
};

export type BuildLLMRequestResult = {
  /** Parsed JSON body returned by the model. Always a non-null object. */
  parsed: unknown;
  /** Raw string content as returned by the model (pre-parse). */
  rawContent: string;
  /** Resolved model id. */
  model: string;
  /** Which API surface was used. */
  mode: InferenceMode;
  /** Reasoning effort applied (`null` on Chat Completions). */
  reasoningEffort: ReasoningEffort | null;
  /** End-to-end latency in ms. */
  latencyMs: number;
  /** Token usage if the API returned it. */
  tokenUsage?: { prompt?: number; completion?: number; total?: number };
};

/**
 * Single LLM call shape used by every Versant module. Picks Chat
 * Completions vs Responses API by model prefix; handles JSON-mode,
 * timeouts, abort propagation, and Responses-API output extraction.
 *
 * Throws `VersantLLMError` on any failure. Callers are expected to wrap
 * with their own validation / repair-retry loop.
 */
export class VersantLLMError extends Error {
  code:
    | "rate_limit"
    | "api_key_missing"
    | "prompt_too_large"
    | "network"
    | "timeout"
    | "empty_content"
    | "non_json_response"
    | "responses_failed"
    | "unknown";
  retriable: boolean;
  status?: number;
  constructor(
    message: string,
    code: VersantLLMError["code"] = "unknown",
    opts: { retriable?: boolean; status?: number; cause?: unknown } = {},
  ) {
    super(message);
    this.name = "VersantLLMError";
    this.code = code;
    this.retriable = opts.retriable ?? false;
    this.status = opts.status;
    if (opts.cause !== undefined) {
      (this as { cause?: unknown }).cause = opts.cause;
    }
  }
}

export async function buildLLMRequest(
  args: BuildLLMRequestArgs,
): Promise<BuildLLMRequestResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new VersantLLMError("OPENAI_API_KEY not set", "api_key_missing");
  }

  const model = resolveModelId(args.model);
  const mode: InferenceMode = shouldUseResponsesApi(model) ? "responses" : "chat";
  const timeoutMs = args.timeoutMs ?? VERSANT_DEFAULT_TIMEOUT_MS;
  const maxOutputTokens = args.maxOutputTokens ?? VERSANT_DEFAULT_MAX_OUTPUT_TOKENS;
  const reasoningEffort: ReasoningEffort =
    args.reasoningEffort ?? VERSANT_DEFAULT_REASONING_EFFORT;
  const verbosity = args.verbosity ?? "medium";

  // Combine caller signal with our timeout signal.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onCallerAbort = () => controller.abort();
  if (args.signal) {
    if (args.signal.aborted) {
      controller.abort();
    } else {
      args.signal.addEventListener("abort", onCallerAbort);
    }
  }

  const startedAt = Date.now();
  let res: Response;
  try {
    if (mode === "responses") {
      res = await fetch(`${resolveOpenAiBaseUrl()}/v1/responses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          instructions: args.systemPrompt,
          input: `Return a single JSON object exactly per the instructions.\n\n${args.userPrompt}`,
          reasoning: { effort: reasoningEffort },
          max_output_tokens: maxOutputTokens,
          text: {
            format: { type: "json_object" },
            verbosity,
          },
        }),
        signal: controller.signal,
      });
    } else {
      res = await fetch(`${resolveOpenAiBaseUrl()}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: args.temperature ?? 0.2,
          max_completion_tokens: maxOutputTokens,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: args.systemPrompt },
            { role: "user", content: args.userPrompt },
          ],
        }),
        signal: controller.signal,
      });
    }
  } catch (e) {
    clearTimeout(timer);
    if (args.signal) args.signal.removeEventListener("abort", onCallerAbort);
    if ((e as { name?: string })?.name === "AbortError") {
      // Distinguish caller-abort from our timeout.
      if (args.signal?.aborted) {
        throw new VersantLLMError("Caller aborted", "unknown", { retriable: false, cause: e });
      }
      throw new VersantLLMError(
        `OpenAI call timed out after ${timeoutMs}ms`,
        "timeout",
        { retriable: true, cause: e },
      );
    }
    throw new VersantLLMError("OpenAI network error", "network", {
      retriable: true,
      cause: e,
    });
  }
  clearTimeout(timer);
  if (args.signal) args.signal.removeEventListener("abort", onCallerAbort);

  const latencyMs = Date.now() - startedAt;
  const rawText = await res.text().catch(() => "");

  if (!res.ok) {
    const code: VersantLLMError["code"] =
      res.status === 429
        ? "rate_limit"
        : res.status === 413
          ? "prompt_too_large"
          : res.status >= 500
            ? "network"
            : "unknown";
    throw new VersantLLMError(
      `OpenAI ${res.status}: ${rawText.slice(0, 400) || res.statusText}`,
      code,
      { retriable: code === "rate_limit" || code === "network", status: res.status },
    );
  }

  let body: unknown;
  try {
    body = rawText ? JSON.parse(rawText) : {};
  } catch (e) {
    throw new VersantLLMError("OpenAI returned non-JSON body", "non_json_response", {
      cause: e,
    });
  }

  let content: string | null = null;
  let tokenUsage: BuildLLMRequestResult["tokenUsage"];

  if (mode === "responses") {
    const status = (body as { status?: string }).status;
    if (status === "failed" || status === "cancelled") {
      const err = (body as { error?: { message?: string } }).error?.message;
      throw new VersantLLMError(
        `OpenAI Responses status ${status}${err ? `: ${err}` : ""}`,
        "responses_failed",
      );
    }
    content = extractResponsesOutputText(body);
    const u = (body as {
      usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number };
    }).usage;
    if (u) {
      tokenUsage = {
        prompt: u.input_tokens,
        completion: u.output_tokens,
        total: u.total_tokens,
      };
    }
  } else {
    content =
      (body as { choices?: { message?: { content?: string } }[] })?.choices?.[0]?.message
        ?.content ?? null;
    const u = (body as {
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    }).usage;
    if (u) {
      tokenUsage = {
        prompt: u.prompt_tokens,
        completion: u.completion_tokens,
        total: u.total_tokens,
      };
    }
  }

  if (typeof content !== "string" || !content.trim()) {
    throw new VersantLLMError("OpenAI returned empty content", "empty_content");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    throw new VersantLLMError("OpenAI content was not valid JSON", "non_json_response", {
      cause: e,
    });
  }

  return {
    parsed,
    rawContent: content,
    model,
    mode,
    reasoningEffort: mode === "responses" ? reasoningEffort : null,
    latencyMs,
    tokenUsage,
  };
}

function extractResponsesOutputText(body: unknown): string | null {
  const b = body as {
    output_text?: string;
    output?: Array<{
      type?: string;
      content?: Array<{ type?: string; text?: string }>;
    }>;
  };
  if (typeof b.output_text === "string" && b.output_text.trim()) {
    return b.output_text;
  }
  for (const item of b.output ?? []) {
    if (item.type !== "message") continue;
    for (const part of item.content ?? []) {
      if (
        part.type === "output_text" &&
        typeof part.text === "string" &&
        part.text.trim()
      ) {
        return part.text;
      }
    }
  }
  return null;
}

// ===========================================================================
//   isLLMConfigured — single check for "is OPENAI_API_KEY set?"
// ===========================================================================

/**
 * Single check used by every server-side caller to decide whether to skip
 * the LLM and fall back to deterministic content. Mirrors the prior
 * per-module `isLLMConfigured()` helpers.
 */
export function isLLMConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}
