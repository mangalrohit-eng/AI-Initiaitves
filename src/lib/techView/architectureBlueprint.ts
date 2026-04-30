/**
 * Cross-Tower Tech View — static, doc-grounded blueprint.
 *
 * Three exports power the three Tech View sub-views on the
 * `/program/cross-tower-ai-plan` page:
 *
 *   - `ARCHITECTURE_LAYERS`  — six-layer top-down stack (Workbench → Cloud
 *                              foundation), each layer with named vendors
 *                              and a TSA carve-out flag where relevant.
 *   - `REQUEST_FLOW_STEPS`   — eight-step end-to-end flow from a tower
 *                              lead's question to an audited agent action.
 *   - `TOWER_AGENT_MAP`      — one row per Versant tower (13 rows). Each
 *                              row names the lead agent, primary LLM use
 *                              case, and the source-system vendors that
 *                              specific tower depends on.
 *
 * Vendor names ALL come from `VENDOR_ALLOW_LIST` in
 * `forge-tower-explorer/src/lib/assess/curateInitiativesLLM.ts`. Cloud-of-
 * record stays `TBD — subject to discovery` per workspace rule.
 *
 * Determinism contract: this file is fully deterministic. The LLM does not
 * author Tech View content; the page joins this static blueprint with the
 * live `program.architecture` counts to produce numbers without fabrication.
 */
import type { TowerId } from "@/data/assess/types";

export const VENDOR_TBD = "TBD — subject to discovery";

// ===========================================================================
//   Sub-view A: layered architecture stack
// ===========================================================================

export type LayerVendor = {
  /** Display name — must match `VENDOR_ALLOW_LIST` or be `VENDOR_TBD`. */
  name: string;
  /** One-liner on what the vendor does in this layer (Versant-specific). */
  role: string;
};

export type ArchitectureLayer = {
  id: string;
  /** Display name, e.g. "Workbench". */
  name: string;
  /** One-line summary that lands the layer's role. */
  summary: string;
  /** Named vendors / capabilities in this layer (allow-listed). */
  vendors: LayerVendor[];
  /**
   * True when this layer's source-of-truth is still under NBCU shared
   * services until the TSA expires. The Stack diagram surfaces the carve-out
   * callout adjacent to these layers.
   */
  affectedByTSA: boolean;
};

export const ARCHITECTURE_LAYERS: ArchitectureLayer[] = [
  {
    id: "workbench",
    name: "Workbench",
    summary:
      "Tower-lead consoles, executive dashboards, and human-in-loop approval queues — where Versant operators meet the agent fleet.",
    vendors: [
      {
        name: "Versant Forge Program",
        role: "Cross-tower AI capability map, scenario modeling, plan workspace.",
      },
      {
        name: "Cursor",
        role: "Tower-lead developer workbench for agent code review and prompt evals.",
      },
      {
        name: "GitHub Copilot",
        role: "In-IDE assist for finance, tech, and ops engineering teams.",
      },
      {
        name: "ServiceNow",
        role: "Approval queues, change tickets, and incident workflows for HR / IT / Service.",
      },
    ],
    affectedByTSA: false,
  },
  {
    id: "agents",
    name: "Agents",
    summary:
      "Per-tower agent fleet — orchestrators, specialists, monitors, routers, and executors. Color-coded by Agent.type (purple / teal / amber / pink / green).",
    vendors: [
      {
        name: "Reconciliation, Editorial Standards, Talent Match, Brand-Safety, Crisis-Detection (named per tower)",
        role: "Specialist agents grounded in Versant capability map; counts pulled live from program.architecture.",
      },
      {
        name: "Router & Orchestrator agents",
        role: "Classify tower-lead questions and dispatch to the right specialist; enforce phase scope.",
      },
      {
        name: "Monitor agents",
        role: "Track covenant ceilings, brand-safety drift, and editorial-judgment alerts continuously.",
      },
    ],
    affectedByTSA: false,
  },
  {
    id: "ai-platform",
    name: "AI Platform",
    summary:
      "LLM hosting, evals, routing, vector store, and the guardrail layer that enforces the determinism contract on every model output.",
    vendors: [
      { name: "OpenAI", role: "GPT-5.5 hosting for cross-tower plan generation and tower-level briefs." },
      { name: "Azure OpenAI", role: "Enterprise-tenant hosting option pending Versant procurement decision." },
      { name: "LangSmith", role: "Eval harness, tracing, regression detection on agent outputs." },
      { name: "LiteLLM", role: "Provider-agnostic routing and rate-limit smoothing across model fleet." },
      { name: "Pinecone", role: "Vector store backing semantic retrieval over the capability map and content lake." },
    ],
    affectedByTSA: false,
  },
  {
    id: "data-fabric",
    name: "Data Fabric",
    summary:
      "Event ingestion, semantic layer over the capability map, content lake (transcripts, briefs, evidence), and the tamper-evident audit log every agent action writes to.",
    vendors: [
      {
        name: "Pinecone",
        role: "Vector index over Versant transcripts (Descript), evidence clusters, and curated briefs.",
      },
      {
        name: "Iron Mountain",
        role: "Records management for retained newsroom and finance archives — TSA carve-out adjacent.",
      },
      {
        name: "Deepgram",
        role: "Transcription pipeline for live broadcast and podcast catalogs (CNBC, Golf Channel).",
      },
      { name: VENDOR_TBD, role: "Lakehouse + semantic layer selection — subject to Versant data architecture review." },
    ],
    affectedByTSA: true,
  },
  {
    id: "source-systems",
    name: "Source systems",
    summary:
      "Versant operational systems-of-record — agents read from and write back into these. NBCU TSA carve-out callouts apply where shared-services data still flows through NBCU until the TSA expires.",
    vendors: [
      { name: "BlackLine", role: "Finance close, intercompany reconciliation across the 7+ Versant entities." },
      { name: "Workday", role: "HR core — payroll, benefits, headcount of record." },
      { name: "Eightfold", role: "Talent intelligence and skills inference for HR / Talent." },
      { name: "Salesforce", role: "Ad sales CRM, deal stages, account hierarchy." },
      { name: "FreeWheel", role: "Linear ad sales orders + reconciliation." },
      { name: "Operative", role: "Ad order management and revenue forecast." },
      { name: "Amagi", role: "Cloud playout for Free TV Networks and FAST." },
      { name: "Telestream", role: "Broadcast media processing, transcoding, QC." },
      { name: "Reuters Connect", role: "Wire and footage feed into the newsroom." },
      { name: "AP API", role: "AP wire and event coverage for CNBC / MS NOW." },
      { name: "Piano", role: "DTC subscription, paywall, audience entitlement." },
      { name: "LiveRamp", role: "Audience identity resolution across DTC properties." },
      { name: "DocuSign CLM", role: "Contract lifecycle for talent, vendor, rights deals." },
      { name: "OneTrust", role: "Privacy and consent — DTC + ad sales surfaces." },
      { name: "Cresta", role: "Service center conversational coaching and quality." },
      { name: "Zendesk", role: "Service ticketing across DTC properties." },
      { name: "Optimove", role: "Lifecycle marketing for retained subscribers (GolfPass, Peacock-adjacent FAST)." },
      { name: "Coupa", role: "Procurement and supplier spend." },
      { name: "Kyriba", role: "Treasury and covenant monitoring against the BB- credit facility." },
      { name: "Anaplan", role: "FP&A planning, segment reporting prep for the new public company." },
      { name: "Workiva", role: "10-K / 10-Q workpaper and disclosure controls — new-public-company SEC obligation." },
    ],
    affectedByTSA: true,
  },
  {
    id: "cloud-foundation",
    name: "Cloud foundation",
    summary:
      "Identity, access governance, security, observability, and CI — the substrate every layer above depends on. Cloud-of-record stays TBD pending Versant decision.",
    vendors: [
      { name: "Okta", role: "Federated identity for tower leads and external advisors." },
      { name: "ConductorOne", role: "Access governance and just-in-time elevation for sensitive surfaces." },
      { name: "CrowdStrike", role: "Endpoint security." },
      { name: "Abnormal Security", role: "Email and identity threat protection." },
      { name: "Datadog", role: "Observability across agents, source-system integrations, and the LLM platform." },
      { name: "PagerDuty", role: "On-call rotation and incident response for tower-lead pods." },
      { name: "GitHub Actions", role: "CI for agent code, prompt files, and capability-map data." },
      { name: "Buildkite", role: "Heavier build pipelines for content-lake ETL and eval jobs." },
      { name: VENDOR_TBD, role: "Cloud of record (AWS / Azure / GCP) — subject to discovery." },
    ],
    affectedByTSA: true,
  },
];

// ===========================================================================
//   Sub-view B: end-to-end request flow
// ===========================================================================

export type RequestFlowStep = {
  index: number;
  title: string;
  detail: string;
  /** Which side of the determinism boundary this step lives on. */
  determinism:
    | "deterministic" // Code, lookups, no LLM authorship
    | "llm" // LLM authors content
    | "guardrail" // Validation / enforcement layer
    | "human"; // Human approver in the loop
};

export const REQUEST_FLOW_STEPS: RequestFlowStep[] = [
  {
    index: 1,
    title: "Tower lead poses question",
    detail:
      "From the Forge Program console — example: KC Sullivan asks for the next-quarter ad-sales pipeline view.",
    determinism: "deterministic",
  },
  {
    index: 2,
    title: "Router agent classifies",
    detail:
      "Routes to the right specialist — Reconciliation Agent for finance, Editorial Standards Agent for news, Brand-Safety Agent for advertiser surfaces.",
    determinism: "deterministic",
  },
  {
    index: 3,
    title: "Specialist queries data fabric",
    detail:
      "Retrieves grounded context from Pinecone vector store + the relevant source system (BlackLine, Reuters Connect, Salesforce, FreeWheel).",
    determinism: "deterministic",
  },
  {
    index: 4,
    title: "LLM synthesizes response",
    detail:
      "GPT-5.5 (OpenAI / Azure OpenAI) generates the answer or proposed action — narrative only; numerics are deterministic and passed through, never authored.",
    determinism: "llm",
  },
  {
    index: 5,
    title: "Guardrail layer validates",
    detail:
      "Vendor allow-list, numeric-token rejection, brand and people allow-lists. Reject + repair-retry on validation failure; full failure falls back to deterministic-only view.",
    determinism: "guardrail",
  },
  {
    index: 6,
    title: "Human-in-loop approval",
    detail:
      "Brian Carovillano on editorial decisions for MS NOW / CNBC; Anand Kini on treasury / covenant-touching actions; tower lead on tower-scoped operational changes.",
    determinism: "human",
  },
  {
    index: 7,
    title: "Action executes",
    detail:
      "Writes back to source system (BlackLine close cycle, Salesforce account, DocuSign CLM contract) or returns the answer to the tower lead.",
    determinism: "deterministic",
  },
  {
    index: 8,
    title: "Audit log captures provenance",
    detail:
      "Tamper-evident log writes: model id, prompt version, scenario hash, retrieved sources, approver identity, and outcome — durable for SEC and internal-audit review.",
    determinism: "deterministic",
  },
];

// ===========================================================================
//   Sub-view C: per-tower agent / vendor map
// ===========================================================================

export type TowerAgentRow = {
  /** Tower id — must match a real tower in `data/towers.ts`. */
  id: TowerId;
  /** Display name (mirrors tower.name). */
  name: string;
  /** Lead agent the tower fields. Versant-named, declarative. */
  leadAgent: string;
  /** Source-system vendors this tower's initiatives depend on (allow-listed). */
  sourceSystems: string[];
  /** One-line declarative on the primary LLM use case. */
  primaryLLMUseCase: string;
  /**
   * When set, surfaces the BB- / TSA / editorial floor / live-broadcast
   * floor that constrains AI deployment in this tower.
   */
  versantConstraint?: string;
};

export const TOWER_AGENT_MAP: TowerAgentRow[] = [
  {
    id: "finance",
    name: "Finance",
    leadAgent: "Reconciliation Agent",
    sourceSystems: ["BlackLine", "Workiva", "Anaplan", "Kyriba", "Coupa"],
    primaryLLMUseCase:
      "Match intercompany transactions across the 7+ Versant entities, auto-resolve timing differences, flag exceptions for Anand Kini's queue.",
    versantConstraint:
      "BB- credit + $0.375 quarterly dividend → covenant ceiling drives every action.",
  },
  {
    id: "hr",
    name: "HR & Talent",
    leadAgent: "Talent Match Agent",
    sourceSystems: ["Workday", "Eightfold", "ServiceNow"],
    primaryLLMUseCase:
      "Skills inference and internal mobility match across the 13 towers; surface candidates for tower-lead pods running P1 builds.",
  },
  {
    id: "research-analytics",
    name: "Research & Analytics",
    leadAgent: "Audience Insights Agent",
    sourceSystems: ["Piano", "LiveRamp", "Brandwatch", "Cision"],
    primaryLLMUseCase:
      "Cross-brand audience cohort analysis spanning MS NOW, CNBC, Golf Channel, USA Network, E!, Syfy without leaking PII.",
  },
  {
    id: "legal",
    name: "Legal & Business Affairs",
    leadAgent: "Rights & Contracts Agent",
    sourceSystems: ["DocuSign CLM", "OneTrust", "Iron Mountain"],
    primaryLLMUseCase:
      "Reconcile split-rights deals (Kardashians-style on-air retained / streaming to Hulu); pre-flag NBCU TSA expiration touchpoints.",
    versantConstraint:
      "Split-rights complexity + new-public-company SEC obligations → human review on every material contract.",
  },
  {
    id: "corp-services",
    name: "Corporate Services",
    leadAgent: "Spend & Vendor Agent",
    sourceSystems: ["Coupa", "ServiceNow", "DocuSign CLM"],
    primaryLLMUseCase:
      "Vendor contract review and procurement workflow — flag covenant-impacting commitments for treasury sign-off.",
  },
  {
    id: "tech-engineering",
    name: "Technology & Engineering",
    leadAgent: "Platform Reliability Agent",
    sourceSystems: ["Datadog", "PagerDuty", "GitHub Actions", "Buildkite", "CrowdStrike"],
    primaryLLMUseCase:
      "Incident triage across the agent fleet and source-system integrations; deflect routine ops work from on-call rotation.",
  },
  {
    id: "operations-technology",
    name: "Operations & Technology",
    leadAgent: "Broadcast Operations Agent",
    sourceSystems: ["Amagi", "Telestream", "Datadog"],
    primaryLLMUseCase:
      "Surrounding-workflow automation: schedule reconciliation, QC exception triage, ad-break verification — never replaces the master-control operator's seat.",
    versantConstraint:
      "Live broadcast physical floor — automation supports, never substitutes for the on-air operator.",
  },
  {
    id: "sales",
    name: "Sales",
    leadAgent: "Pipeline & Pricing Agent",
    sourceSystems: ["Salesforce", "FreeWheel", "Operative", "LiveRamp"],
    primaryLLMUseCase:
      "Greenfield ad-sales pipeline post-NBCU TSA — deal stage progression, audience-segment match, MS NOW brand-safety scoring.",
    versantConstraint:
      "MS NOW progressive brand positioning → brand-safety models must respect editorial intent.",
  },
  {
    id: "marketing-comms",
    name: "Marketing & Communications",
    leadAgent: "Campaign Brand-Safety Agent",
    sourceSystems: ["Cision", "Brandwatch", "Optimove", "Piano"],
    primaryLLMUseCase:
      "Cross-brand campaign performance and crisis-detection signals across MS NOW, CNBC, Golf Channel, USA Network — never flattens brand voice.",
  },
  {
    id: "service",
    name: "Service",
    leadAgent: "Subscriber Save Agent",
    sourceSystems: ["Cresta", "Zendesk", "Optimove", "Piano"],
    primaryLLMUseCase:
      "DTC support across GolfPass, Fandango, Rotten Tomatoes — deflect routine inquiries, prioritize save-team handoff for high-LTV cohorts.",
  },
  {
    id: "editorial-news",
    name: "Editorial & News",
    leadAgent: "Editorial Standards Agent",
    sourceSystems: ["Reuters Connect", "AP API", "Deepgram", "Descript"],
    primaryLLMUseCase:
      "Co-pilot for fact-check assist and crisis-detection on MS NOW / CNBC. Never byline; always reviewed by Brian Carovillano's editorial standards team.",
    versantConstraint:
      "Editorial / news judgment floor — anchors, reporters, fact-checking, political coverage stay onshore + human.",
  },
  {
    id: "production",
    name: "Production",
    leadAgent: "Post-Production Workflow Agent",
    sourceSystems: ["Telestream", "Descript", "Deepgram"],
    primaryLLMUseCase:
      "Post-production orchestration — transcript-driven edit prep, lower-thirds suggestion, automated QC pre-pass for non-news long-form.",
    versantConstraint:
      "Talent relationships drive production — agent supports the editor's decision, doesn't substitute for it.",
  },
  {
    id: "programming-dev",
    name: "Programming & Development",
    leadAgent: "Programming Strategy Agent",
    sourceSystems: ["Anaplan", "Brandwatch", "Cision"],
    primaryLLMUseCase:
      "Cross-network slate analysis and audience-fit modeling across USA, E!, Syfy, Oxygen True Crime; rights-window optimization with split-rights awareness.",
  },
];
