/**
 * Manual AI-curation overlay — explicit P1 deep-curation + rubric overrides.
 *
 * Why this file exists:
 *   - The deterministic rubric (`lib/initiatives/eligibilityRubric.ts`) classifies
 *     all 489 canonical L4s by name keywords. It's the **default** verdict.
 *   - This overlay carries **explicit overrides** — used in two cases:
 *       1. **P1 deep-curation** — Versant-flagship initiatives (close, code-dev,
 *          covenant monitoring, paywall, etc.) that warrant the full curation
 *          surface (frequency, criticality, maturity, vendor, agentOneLine)
 *          and a hand-authored Versant-grounded rationale.
 *       2. **Rubric corrections** — L4s where the keyword rubric guesses wrong.
 *          E.g. "Strategic Sourcing" matches `strategic-exercise` (not eligible)
 *          but actually IS AI-eligible at Versant via spend-analytics agents.
 *
 * Composer precedence:
 *   1. Canonical L4 carries `aiCurationStatus` directly  →  highest priority
 *   2. This overlay has an entry                          →  second
 *   3. Rubric output                                      →  fallback
 *
 * The LLM pipeline (PR 2) — when it lands — writes to `L3WorkforceRow.l4Items`
 * and overrides every layer below. This file remains as the deterministic
 * floor for offline / no-API-key environments.
 */

import type {
  AiPriority,
  TowerProcessCriticality,
  TowerProcessFrequency,
  TowerProcessMaturity,
} from "@/data/types";
import type { AiCurationStatus } from "./types";
import type { NotEligibleReason } from "@/data/assess/types";

export type AiCurationOverride = {
  /**
   * Status — when supplied, overrides both the canonical L4 and the rubric.
   * Most overrides set this to "curated" (P1 deep-dive promoted from rubric's
   * P2 default) or "reviewed-not-eligible" (correcting a rubric false positive).
   */
  aiCurationStatus: AiCurationStatus;
  /** Required when `aiCurationStatus === "curated"`. */
  aiPriority?: AiPriority;
  /** Required when `aiCurationStatus === "reviewed-not-eligible"`. */
  notEligibleReason?: NotEligibleReason;
  /** Hand-authored Versant-grounded one-liner — required. */
  aiRationale: string;
  // ----- Curation fields (only meaningful when `curated`) -----
  frequency?: TowerProcessFrequency;
  criticality?: TowerProcessCriticality;
  currentMaturity?: TowerProcessMaturity;
  primaryVendor?: string;
  agentOneLine?: string;
  /** Optional click-through to existing 4-lens initiative or brief. */
  initiativeId?: string;
  briefSlug?: string;
};

/**
 * Hand-curated overlay map keyed by canonical `CapabilityL4.id`. Add entries
 * here to promote rubric P2s to P1 with full curation, or to correct a wrong
 * rubric verdict.
 */
export const aiCurationOverlay: Record<string, AiCurationOverride> = {
  // =======================================================================
  //   FINANCE — close / consolidation / treasury
  // =======================================================================
  "finance-l4-month-end-close": {
    aiCurationStatus: "curated",
    aiPriority: "P1 — Immediate (0-6mo)",
    aiRationale:
      "Month-end close orchestration across Versant's 7+ legal entities (Fandango, Nikkei CNBC JV, Golf operations, NBCU TSA carve-outs) — current 12-18 day cycle is the binding constraint on faster Versant SEC filings. Orchestrator agents drive the close calendar; reconciliation agents clear sub-ledgers; humans handle exceptions.",
    frequency: "Monthly",
    criticality: "Mission-critical",
    currentMaturity: "Semi-automated",
    primaryVendor: "BlackLine",
    agentOneLine:
      "Close Orchestrator schedules and tracks ~200 monthly close tasks across 7+ entities, surfacing exception queues only when reconciliation agents can't auto-resolve.",
  },
  "finance-l4-multi-entity-consolidation": {
    aiCurationStatus: "curated",
    aiPriority: "P1 — Immediate (0-6mo)",
    aiRationale:
      "Multi-entity consolidation hits the Fandango / Nikkei CNBC JV / Golf operations boundary every period — minority-interest math, JV revenue splits, and intercompany allocations are deterministic but high-touch today. Orchestrator agents drive consolidation; humans review minority-interest variance.",
    frequency: "Monthly",
    criticality: "Mission-critical",
    currentMaturity: "Semi-automated",
    primaryVendor: "BlackLine + Workiva",
    agentOneLine:
      "Consolidation Agent sequences sub-ledger pulls, currency translation, and JV-share computation across the multi-entity legal structure on the close calendar.",
  },
  "finance-l4-intercompany-eliminations": {
    aiCurationStatus: "curated",
    aiPriority: "P1 — Immediate (0-6mo)",
    aiRationale:
      "Intercompany eliminations across Versant's 7+ entities are a primary driver of close-cycle length. Fuzzy-match agents pair JE legs, flag timing differences, and auto-resolve the modal case so finance leads only see the ~10% truly-anomalous mismatches.",
    frequency: "Monthly",
    criticality: "Mission-critical",
    currentMaturity: "Semi-automated",
    primaryVendor: "BlackLine",
    agentOneLine:
      "Intercompany Agent matches JE legs across entities using vendor / amount / date fuzzy matching, auto-resolves timing diffs, escalates only true mismatches.",
  },
  "finance-l4-balance-sheet-recons": {
    aiCurationStatus: "curated",
    aiPriority: "P1 — Immediate (0-6mo)",
    aiRationale:
      "Balance-sheet recons across the Versant entity stack are BlackLine's core domain — straight-through processing on the modal flow, exception queues for the rest. 85%+ STP achievable on the high-volume accounts.",
    frequency: "Monthly",
    criticality: "High",
    currentMaturity: "Semi-automated",
    primaryVendor: "BlackLine",
    agentOneLine:
      "Reconciliation Agent matches GL balances against sub-ledger detail, surfaces unreconciled items with proposed resolutions for the controller's queue.",
  },
  "finance-l4-covenant-monitoring": {
    aiCurationStatus: "curated",
    aiPriority: "P1 — Immediate (0-6mo)",
    aiRationale:
      "Versant's BB- credit rating makes covenant monitoring existential — a single missed test against the $2.75B debt facility creates re-rate risk. Continuous-monitoring agents test EBITDA / leverage / interest-coverage thresholds nightly against the covenant package.",
    frequency: "Continuous",
    criticality: "Mission-critical",
    currentMaturity: "Manual",
    primaryVendor: "Kyriba",
    agentOneLine:
      "Covenant Monitor agent tests Versant's debt covenants (leverage, interest coverage, EBITDA) nightly against current actuals + 90-day forecast and alerts CFO ahead of breach.",
  },
  "finance-l4-cash-flow-forecast": {
    aiCurationStatus: "curated",
    aiPriority: "P1 — Immediate (0-6mo)",
    aiRationale:
      "30 / 60 / 90-day cash forecasting feeds Versant's $1.09B cash + dividend ($0.375/share quarterly) + buyback ($1B program) calendar — ML on AR / AP patterns is well-trodden territory and replaces a TBD-day FP&A cycle today.",
    frequency: "Daily",
    criticality: "Mission-critical",
    currentMaturity: "Semi-automated",
    primaryVendor: "Kyriba",
    agentOneLine:
      "Cash Forecast Agent rolls AR / AP / treasury feeds forward 90 days, attaches confidence bands, surfaces dividend / buyback timing risks.",
  },
  "finance-l4-invoice-3way": {
    aiCurationStatus: "curated",
    aiPriority: "P1 — Immediate (0-6mo)",
    aiRationale:
      "Invoice processing + 3-way matching across Versant's six business units is high-volume transactional work — vendor agents extract, validate, and route 85%+ straight-through.",
    frequency: "Daily",
    criticality: "High",
    currentMaturity: "Semi-automated",
    primaryVendor: "BlackLine + Coupa",
    agentOneLine:
      "AP Agent extracts invoice fields, matches against PO + receipt, auto-codes the modal flow, queues exceptions for AP analyst review.",
  },
  "finance-l4-xbrl-tagging": {
    aiCurationStatus: "curated",
    aiPriority: "P1 — Immediate (0-6mo)",
    aiRationale:
      "XBRL tagging on Versant's first 10-K / 10-Q filings is a structured high-volume task — Workiva's tagging assistant handles the modal cases, controllers review novel disclosures.",
    frequency: "Quarterly",
    criticality: "Mission-critical",
    currentMaturity: "Semi-automated",
    primaryVendor: "Workiva",
    agentOneLine:
      "XBRL Tagging Agent applies the US GAAP taxonomy to financial line items + footnote disclosures, flags novel concepts for human review.",
  },
  "finance-l4-10k-10q-drafting": {
    aiCurationStatus: "curated",
    aiPriority: "P1 — Immediate (0-6mo)",
    aiRationale:
      "10-K / 10-Q narrative drafting for Versant's first reporting cycles as a public company — LLM agents produce a structured first draft tied to the trial balance, controller team edits for tone and emerging risks.",
    frequency: "Quarterly",
    criticality: "Mission-critical",
    currentMaturity: "Manual",
    primaryVendor: "Workiva + LLM",
    agentOneLine:
      "Drafting Agent assembles the prior-period filing diff + current-period actuals into a structured narrative draft with embedded citations.",
  },

  // =======================================================================
  //   TECH-ENGINEERING — engineering productivity / SRE / cyber
  // =======================================================================
  "tech-l4-code-development": {
    aiCurationStatus: "curated",
    aiPriority: "P1 — Immediate (0-6mo)",
    aiRationale:
      "Engineering-productivity AI (Cursor / Copilot / Claude Code) is the single largest cycle-time lever at Versant — Nate Balogh's CIO org owns the rollout to the ~TBD engineering population during the NBCU TSA exit.",
    frequency: "Continuous",
    criticality: "High",
    currentMaturity: "Semi-automated",
    primaryVendor: "Cursor + GitHub Copilot",
    agentOneLine:
      "Coding Agent drafts, reviews, and refactors code in the IDE against Versant's evolving codebase; engineers focus on architecture and edge cases.",
  },
  "tech-l4-cicd": {
    aiCurationStatus: "curated",
    aiPriority: "P1 — Immediate (0-6mo)",
    aiRationale:
      "CI/CD and deployment automation across the new-public-company Versant tech estate — coding agents observe pipeline failures, propose fixes, and gate releases against quality budgets so the deploy frequency keeps climbing through TSA exit.",
    frequency: "Continuous",
    criticality: "High",
    currentMaturity: "Semi-automated",
    primaryVendor: "GitHub Actions + Buildkite",
    agentOneLine:
      "Deploy Agent watches build / test / deploy pipelines, proposes remediations on failure, and enforces release-quality gates.",
  },
  "tech-l4-incident-response": {
    aiCurationStatus: "curated",
    aiPriority: "P1 — Immediate (0-6mo)",
    aiRationale:
      "SRE incident detection and triage across the Versant streaming + ad-tech + broadcast TOC — agents watch the signal, page only on real incidents, and draft the post-incident review against the runbook.",
    frequency: "Continuous",
    criticality: "Mission-critical",
    currentMaturity: "Semi-automated",
    primaryVendor: "PagerDuty + Datadog",
    agentOneLine:
      "Incident Agent triages alerts against the runbook, suppresses duplicates, drafts the post-incident review for the SRE on-call.",
  },
  "tech-l4-threat-detection": {
    aiCurationStatus: "curated",
    aiPriority: "P1 — Immediate (0-6mo)",
    aiRationale:
      "SOC threat detection at the new-public-company Versant attack surface — CrowdStrike + Abnormal agents triage low-severity events at machine speed, humans handle hands-on response on the rest.",
    frequency: "Continuous",
    criticality: "Mission-critical",
    currentMaturity: "Semi-automated",
    primaryVendor: "CrowdStrike + Abnormal Security",
    agentOneLine:
      "SOC Agent correlates EDR + email + identity signals into incident candidates, auto-resolves the modal false positive, escalates the rest to the SOC analyst.",
  },
  "tech-l4-iam": {
    aiCurationStatus: "curated",
    aiPriority: "P1 — Immediate (0-6mo)",
    aiRationale:
      "IAM and access-review automation at Versant — the new-public-company SOX environment requires evidence on quarterly access certification across thousands of systems, which today is a manual sweep.",
    frequency: "Continuous",
    criticality: "Mission-critical",
    currentMaturity: "Manual",
    primaryVendor: "ConductorOne + Okta",
    agentOneLine:
      "IAM Agent runs access certification campaigns, consolidates manager attestations, evidences SOX controls, and auto-revokes stale grants.",
  },
  "tech-l4-llm-gateway": {
    aiCurationStatus: "curated",
    aiPriority: "P1 — Immediate (0-6mo)",
    aiRationale:
      "Versant's LLM gateway is the substrate every other AI initiative depends on — observability, cost guardrails, prompt-asset versioning, and A/B testing all run through it. Build it once for the AI-on-Versant program.",
    frequency: "Continuous",
    criticality: "Mission-critical",
    currentMaturity: "Not yet established",
    primaryVendor: "LangSmith + LiteLLM",
    agentOneLine:
      "LLM Gateway routes / observes / costs every LLM call across Versant agents, applies budget guardrails, and surfaces eval-quality regressions.",
  },

  // =======================================================================
  //   HR — workforce flow
  // =======================================================================
  // (Note: "hr-loc-l4-recruiting-hiring" is currently rubric-classified as
  // "judgment-judgment" via the talent-judgment exclusion. Override here to
  // mark recruiting screen / triage as eligible — the human stays in the
  // hiring loop for the relationship-and-judgment edge.)
  "hr-loc-l4-new-joiner-onboarding": {
    aiCurationStatus: "curated",
    aiPriority: "P1 — Immediate (0-6mo)",
    aiRationale:
      "Onboarding orchestration across Versant entities — first-day system access, equipment, mandatory training, and HR Business Partner meet-and-greet — runs through a standard checklist that ServiceNow + Workday agents drive end-to-end.",
    frequency: "Per hire",
    criticality: "High",
    currentMaturity: "Semi-automated",
    primaryVendor: "ServiceNow + Workday",
    agentOneLine:
      "Onboarding Orchestrator sequences IT, HR, payroll, and security tasks across the new-joiner journey for the modal hire and escalates exceptions.",
  },

  // =======================================================================
  //   OPERATIONS-TECHNOLOGY — broadcast playout
  // =======================================================================
  "ops-l4-playout-monitoring": {
    aiCurationStatus: "curated",
    aiPriority: "P1 — Immediate (0-6mo)",
    aiRationale:
      "Live playout monitoring across Versant's 4 free TV networks (USA, E!, Syfy, Oxygen True Crime) — Amagi + custom agents watch QC signals (loss-of-audio, freeze-frame, captioning fail), trigger fall-back automations, and page only on real outages.",
    frequency: "Continuous",
    criticality: "Mission-critical",
    currentMaturity: "Semi-automated",
    primaryVendor: "Amagi",
    agentOneLine:
      "Playout Monitor watches video / audio / caption signals across the 4 FTV channels, triggers auto-fallback on QC failure, pages master control on the rest.",
  },
  "ops-l4-broadcast-qa": {
    aiCurationStatus: "curated",
    aiPriority: "P2 — Near-term (6-12mo)",
    aiRationale:
      "Broadcast QA — automated video / audio / caption validation against SCTE / ATSC / SMPTE thresholds — replaces line-by-line eyeballs in the QC suite. Versant's 4 FTV channels each cycle thousands of QC events daily.",
    frequency: "Continuous",
    criticality: "High",
    currentMaturity: "Semi-automated",
    primaryVendor: "Amagi + Telestream",
    agentOneLine:
      "QA Agent runs spec / loudness / caption validation against the master file, flags exceptions for human spot-check.",
  },

  // =======================================================================
  //   SALES — ad sales / DTC paywall (post-NBCU TSA greenfield)
  // =======================================================================
  "sales-l4-yield-optimization": {
    aiCurationStatus: "curated",
    aiPriority: "P1 — Immediate (0-6mo)",
    aiRationale:
      "Yield optimization on Versant's ~$1.58B ad business is the post-NBCU TSA greenfield — pricing agents on inventory + demand patterns lift fill rate without leaving margin on the table.",
    frequency: "Daily",
    criticality: "High",
    currentMaturity: "Semi-automated",
    primaryVendor: "FreeWheel + Operative",
    agentOneLine:
      "Yield Agent prices linear + digital + addressable inventory dynamically against advertiser demand, surfaces upsell signals to AEs.",
  },
  "sales-l4-paywall-conversion": {
    aiCurationStatus: "curated",
    aiPriority: "P1 — Immediate (0-6mo)",
    aiRationale:
      "Dynamic paywall + conversion optimization across CNBC Pro and GolfPass — Piano agents test the price / message / placement combination against modal user, conversion-team sets the brand guard-rails.",
    frequency: "Continuous",
    criticality: "High",
    currentMaturity: "Semi-automated",
    primaryVendor: "Piano",
    agentOneLine:
      "Paywall Agent serves the optimal price / pitch / surface to each visitor, observes conversion, retunes daily.",
  },
  "sales-l4-proposal-generation": {
    aiCurationStatus: "curated",
    aiPriority: "P1 — Immediate (0-6mo)",
    aiRationale:
      "Ad-sales proposal generation on Versant's post-TSA standalone book — RAG + LLM agents assemble brand-fit decks from advertiser brief + Versant package library, AEs spend their hours on the relationship.",
    frequency: "Continuous",
    criticality: "High",
    currentMaturity: "Manual",
    primaryVendor: "FreeWheel + LLM",
    agentOneLine:
      "Proposal Agent reads the advertiser brief, assembles a Versant brand-fit deck with audience numbers, prior-campaign benchmarks, and creative options.",
  },

  // =======================================================================
  //   SERVICE — DTC support
  // =======================================================================
  "service-l4-chat-email": {
    aiCurationStatus: "curated",
    aiPriority: "P1 — Immediate (0-6mo)",
    aiRationale:
      "First-line chat / email support for CNBC Pro + GolfPass + Fandango — RAG agents on the Versant knowledge base resolve ~50% of tickets straight-through, agents handle the rest. Volumes scale with NBCU TSA exit.",
    frequency: "Continuous",
    criticality: "High",
    currentMaturity: "Semi-automated",
    primaryVendor: "Zendesk + Cresta",
    agentOneLine:
      "Support Agent resolves modal subscriber questions (billing, login, plan change) end-to-end on the KB; escalates the long tail.",
  },
  "service-l4-churn-prediction": {
    aiCurationStatus: "curated",
    aiPriority: "P1 — Immediate (0-6mo)",
    aiRationale:
      "Churn prediction across CNBC Pro + GolfPass + SportsEngine subscriber bases — ML on engagement signal flags at-risk subscribers for save-offer agents and retention humans before the cancel button hits.",
    frequency: "Daily",
    criticality: "High",
    currentMaturity: "Semi-automated",
    primaryVendor: "Optimove",
    agentOneLine:
      "Churn Agent scores subscriber risk daily, triggers save-offer flow on high-risk segments, learns from outcome.",
  },

  // =======================================================================
  //   EDITORIAL-NEWS — wire intake / fact-check
  // =======================================================================
  "ed-l4-wire-intake": {
    aiCurationStatus: "curated",
    aiPriority: "P1 — Immediate (0-6mo)",
    aiRationale:
      "Wire-service intake (AP / Reuters / Bloomberg) at the MSNBC News Group desks — agents triage, dedupe, and route the firehose to the right desk at machine speed, freeing desk editors for judgment work.",
    frequency: "Continuous",
    criticality: "High",
    currentMaturity: "Semi-automated",
    primaryVendor: "AP / Reuters Connect API",
    agentOneLine:
      "Wire Agent ingests AP / Reuters / Bloomberg, dedupes, classifies by beat, routes to the desk; reporters pick up at the brief.",
  },
  "ed-l4-real-time-fact-check": {
    aiCurationStatus: "curated",
    aiPriority: "P1 — Immediate (0-6mo)",
    aiRationale:
      "Real-time fact verification on MS NOW broadcast lower-thirds and CNBC tickers is high-stakes — Brian Carovillano's standards desk needs the source dossier in seconds, not minutes. Vector-search + retrieval agents surface authoritative sources for the on-air team to confirm.",
    frequency: "Continuous",
    criticality: "Mission-critical",
    currentMaturity: "Manual",
    primaryVendor: "Pinecone + LLM",
    agentOneLine:
      "Fact-Check Agent searches the live archive + authoritative sources, surfaces 3-source corroboration, escalates contested claims to Standards.",
  },

  // =======================================================================
  //   PRODUCTION — post-production
  // =======================================================================
  "prod-l4-rough-cutting": {
    aiCurationStatus: "curated",
    aiPriority: "P1 — Immediate (0-6mo)",
    aiRationale:
      "Automated rough-cutting and clip creation across Versant production — Descript / Runway agents handle the modal trim against transcript markers, editors focus on hero pieces for MS NOW / CNBC / Sport.",
    frequency: "Daily",
    criticality: "High",
    currentMaturity: "Semi-automated",
    primaryVendor: "Descript",
    agentOneLine:
      "Rough-Cut Agent cuts the long-form against transcript timecodes + AI edit decision list, hands the editor a near-final timeline.",
  },

  // =======================================================================
  //   MARKETING-COMMS — crisis early warning
  // =======================================================================
  "mkt-l4-crisis-detection": {
    aiCurationStatus: "curated",
    aiPriority: "P1 — Immediate (0-6mo)",
    aiRationale:
      "Crisis detection across MS NOW progressive-positioning brand + CNBC + Golf brands — social + search + dark-traffic agents flag emerging narratives before they trend, giving comms hours instead of minutes to set the response.",
    frequency: "Continuous",
    criticality: "Mission-critical",
    currentMaturity: "Manual",
    primaryVendor: "Cision + Brandwatch",
    agentOneLine:
      "Crisis Sentinel watches social / search / dark-traffic signals across Versant brands, alerts comms on emerging narratives with confidence + projected reach.",
  },

  // =======================================================================
  //   LEGAL — structured filings
  // =======================================================================
  "legal-l4-disclosure-mgmt": {
    aiCurationStatus: "curated",
    aiPriority: "P1 — Immediate (0-6mo)",
    aiRationale:
      "SEC disclosure management at the new-public-company Versant — every 10-K / 10-Q / 8-K cycle is a high-volume document orchestration task. Workiva + LLM agents draft, version, and route, the disclosure committee approves.",
    frequency: "Quarterly",
    criticality: "Mission-critical",
    currentMaturity: "Manual",
    primaryVendor: "Workiva",
    agentOneLine:
      "Disclosure Agent drafts the 10-K / 10-Q / 8-K against the prior-period diff + current-period MD&A, routes to the disclosure committee.",
  },
  "legal-l4-edgar-filings": {
    aiCurationStatus: "curated",
    aiPriority: "P2 — Near-term (6-12mo)",
    aiRationale:
      "EDGAR filing coordination at Versant's new-public-company cadence — agents drive the submit / validate / re-file loop to the second, freeing the SEC reporting team for novel disclosures.",
    frequency: "Quarterly",
    criticality: "High",
    currentMaturity: "Semi-automated",
    primaryVendor: "Workiva",
    agentOneLine:
      "EDGAR Filing Agent validates XBRL + free-text filings against EDGAR rules, submits on the deadline, surfaces any rejection back to legal.",
  },
  "legal-l4-fcc-compliance": {
    aiCurationStatus: "curated",
    aiPriority: "P2 — Near-term (6-12mo)",
    aiRationale:
      "FCC broadcast compliance across the 4 FTV networks — political-window timing, kid-vid quotas, EAS testing, and station-issue / programs lists are deterministic obligations that benefit from a continuous-monitoring agent.",
    frequency: "Quarterly",
    criticality: "Mission-critical",
    currentMaturity: "Manual",
    primaryVendor: "Workiva",
    agentOneLine:
      "FCC Compliance Agent watches political-window / kid-vid / EAS obligations across stations, evidences each filing on time.",
  },
};
