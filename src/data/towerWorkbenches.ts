/**
 * Tower Workbenches — the canonical, hand-authored, custom-built
 * user-facing app for each functional tower. Each workbench consolidates
 * the tower's point-solution L3 Initiatives behind 4-8 user verbs in the
 * tower's NATIVE vernacular (Finance teams "close" and "reconcile",
 * Production teams "cue" and "package", Ad Sales teams "pace" and
 * "yield" — not the generic legal-clerk Search/Draft/Review set).
 *
 * Quality bar — every workbench passes the "swap-name test": if you can
 * rename `Finance Workbench` to `Service Workbench` and the surfaces /
 * `whyCustomBuild` / `successMetric` still parse, it is too generic and
 * must be rewritten. Every record cites real Versant brands, leaders,
 * vendors, and financials per `docs/context.md`.
 *
 * Lives alongside the per-initiative `WorkbenchLens` (which is a tools
 * lens on a single initiative). Type names disambiguate.
 */

import type { TowerWorkbench } from "./types";

export const TOWER_WORKBENCHES: Record<string, TowerWorkbench> = {
  // ============================================================
  //   FINANCE WORKBENCH
  // ============================================================
  finance: {
    id: "finance-workbench",
    towerId: "finance",
    name: "Finance Workbench",
    tagline: "Where Versant's controllers, FP&A, and SEC reporting team close, reconcile, and forecast.",
    primaryUsers: [
      "Controllers",
      "FP&A analysts",
      "Group accountants",
      "SEC reporting team",
      "Treasury",
    ],
    surfaces: [
      {
        id: "close",
        verb: "Close",
        name: "Multi-entity close console",
        description:
          "Live close-cycle status across 7+ Versant legal entities plus the Fandango JV (75/25 with WBD) and the Nikkei CNBC JV. Blockers, owners, and inter-entity dependencies on one screen.",
        primaryAction:
          "Drive the period-end close from 12-18 days to 5-7 across every entity and JV partner.",
        poweredByCapabilities: [
          "Multi-entity close orchestration",
          "Period-end task tracker",
          "Close calendar",
        ],
        iconKey: "CalendarRange",
      },
      {
        id: "reconcile",
        verb: "Reconcile",
        name: "Intercompany & bank reconciliation queue",
        description:
          "Auto-matched intercompany and bank reconciliations across the close-orchestration and AR-automation platforms (e.g., BlackLine, HighRadius). Fuzzy-matches timing differences, auto-resolves cleared items, escalates true exceptions for human investigation.",
        primaryAction:
          "Clear 85%+ of intercompany lines straight-through; route only true exceptions to controllers.",
        poweredByCapabilities: [
          "Bank reconciliation auto-match",
          "Intercompany reconciliation",
          "Exception triage",
        ],
        iconKey: "GitMerge",
      },
      {
        id: "draft-mdna",
        verb: "Draft MD&A",
        name: "MD&A and disclosure drafter",
        description:
          "Generates first-pass MD&A narrative, variance commentary, and disclosure deltas from the trial balance, prior-period filings, and earnings-call transcripts. Versant is in its first reported year as NASDAQ: VSNT — every disclosure is being authored from scratch.",
        primaryAction:
          "First-draft the 10-Q MD&A in hours, not days; route to disclosure committee with cited source data.",
        poweredByCapabilities: [
          "MD&A first-draft generator",
          "Disclosure delta drafter",
          "Earnings narrative",
        ],
        iconKey: "ScrollText",
      },
      {
        id: "forecast",
        verb: "Forecast",
        name: "13-week cash & EBITDA forecaster",
        description:
          "Rolling 13-week cash + EBITDA forecast feeding the BB- covenant package. Models the $4.09B distribution decline (-5.4%), $1.58B ad decline (-8.9%), and Platforms growth (+3.9%).",
        primaryAction:
          "See cash and covenant headroom 13 weeks out, before treasury decisions are forced.",
        poweredByCapabilities: ["Cash flow forecast", "EBITDA forecast", "Revenue waterfall"],
        iconKey: "TrendingUp",
      },
      {
        id: "monitor-covenants",
        verb: "Monitor covenants",
        name: "Covenant headroom monitor",
        description:
          "Live tracking of leverage and interest-coverage covenants against the $2.75B gross debt at BB-. Surfaces months-to-breach scenarios under stressed revenue paths.",
        primaryAction:
          "Hold covenant compliance against a BB- credit profile across every quarter Versant exists.",
        poweredByCapabilities: ["Covenant monitor", "Debt headroom", "Leverage forecaster"],
        iconKey: "ShieldAlert",
      },
      {
        id: "audit",
        verb: "Audit",
        name: "SOX evidence & provenance pull",
        description:
          "Pulls SOX evidence for any line item with full provenance — the journal entry, the underlying transaction, the approver, the agent decision trail. Built for a brand-new public company's first audit.",
        primaryAction:
          "Answer any auditor question in minutes with a complete, immutable trail.",
        poweredByCapabilities: ["SOX evidence pull", "Audit trail", "Control testing"],
        iconKey: "FileSearch",
      },
    ],
    whyConsolidated:
      "The CFO's Finance organization is standing up SOX, SEC reporting, and a covenant-monitored close cycle simultaneously as Versant's first reported year (FY2025). Today the team would jump between close-orchestration and AR-automation platforms (e.g., BlackLine, HighRadius), the GL, the consolidation tool, Excel models, and the disclosure platform — five tools per close cycle. The Workbench is the single surface that holds the close, the covenant story, and the audit trail in one place.",
    whyCustomBuild:
      "Close-orchestration platforms (e.g., BlackLine, HighRadius, FloQast) are best-of-breed point tools, not orchestrators. No COTS app stitches them to the multi-entity ledger (7+ entities + Fandango JV + Nikkei CNBC JV), the BB- covenant package, and a first-time-public-company SOX trail. The combination is uniquely Versant; the consolidation layer is uniquely Forge-built.",
    digitalCore: {
      knowledgeStore: "Versant Financial Knowledge Graph (entities, journals, disclosures, controls)",
      identity: "Versant SSO (e.g., Okta) + finance-role RBAC + four-eyes for controllers",
      agentRouter:
        "Finance Workbench dispatcher routes close/reconcile/draft/forecast/audit intents to specialist agents and back to the user with cited source data.",
      auditLog:
        "Immutable SOX-grade journal: every agent decision, draft, approval, and override stamped with user, timestamp, and source ledger row.",
      integrations: [
        "Close orchestration (e.g., BlackLine)",
        "AR automation (e.g., HighRadius)",
        "ERP / HCM (e.g., Workday Financials)",
        "GL / Consolidation tool",
        "Regulatory filing platform (e.g., EDGAR)",
      ],
    },
    buildEffort: "Heavy custom",
    estimatedDeliveryMonths: 9,
    deliveryPodShape:
      "1 Forge eng pod (~6 FTE) + 1 Finance product owner from the CFO's office + controller-led design partner",
    workforceShift:
      "Controllers shift from spreadsheet stitching to exception triage and disclosure judgment. FP&A spends hours on commentary instead of data assembly. SEC reporting team drafts off generated first-pass MD&A instead of starting from blank pages.",
    successMetric: "Days from period-end to filed financials (target: 12-18 → 5-7)",
    rolloutPattern:
      "Pilot one entity (e.g., the parent VSNT consolidation) → expand to all 7+ entities → add the Fandango and Nikkei JVs once intercompany interfaces stabilize.",
  },

  // ============================================================
  //   HR & TALENT WORKBENCH
  // ============================================================
  hr: {
    id: "hr-workbench",
    towerId: "hr",
    name: "HR & Talent Workbench",
    tagline:
      "Where Jeff Massa and Christina Noval's team source, match, schedule, and retain talent during a hyper-hiring spin-off.",
    primaryUsers: [
      "HR business partners",
      "Recruiters",
      "People analytics",
      "Comp & benefits",
      "Talent management",
    ],
    surfaces: [
      {
        id: "source",
        verb: "Source",
        name: "Cross-pool candidate sourcer",
        description:
          "AI talent platforms (e.g., Eightfold) + LinkedIn + targeted Comcast-alumni outreach for the 1,000-5,000 hyper-hiring footprint. Auto-builds shortlists against Versant role rubrics.",
        primaryAction:
          "Stand up a vetted shortlist for any open Versant role within hours of the requisition opening.",
        poweredByCapabilities: ["Candidate sourcing", "Talent pool", "Outbound recruiting"],
        iconKey: "UserPlus",
      },
      {
        id: "match",
        verb: "Match",
        name: "Role-to-candidate matcher",
        description:
          "Ranks candidates against Versant-specific role rubrics — including the spin-off-critical skills (broadcast ops, multi-brand digital, regulated finance) that the legacy NBCU rubrics did not capture.",
        primaryAction:
          "Surface the right candidate for a Versant role, not the right candidate for an NBCU role.",
        poweredByCapabilities: ["Candidate matching", "Role rubric scoring", "Skill graph"],
        iconKey: "UserCheck",
      },
      {
        id: "benchmark",
        verb: "Benchmark",
        name: "Compensation benchmarker",
        description:
          "Live comp benchmarking against Disney, Netflix, WBD, Paramount, Fox, and tech-co peers. Critical for on-air talent and senior engineering, where Versant is competing directly.",
        primaryAction:
          "Close offers against Disney/Netflix/WBD/tech-co counter-offers with current market data.",
        poweredByCapabilities: ["Comp benchmarking", "Pay equity analysis", "Offer modeling"],
        iconKey: "DollarSign",
      },
      {
        id: "schedule",
        verb: "Schedule",
        name: "Interview-loop scheduler",
        description:
          "Coordinates panels across NYC HQ, Englewood Cliffs NJ, and remote contributors. Handles hybrid loops without the back-and-forth that loses candidates.",
        primaryAction:
          "Lock a full interview loop in one round-trip instead of five.",
        poweredByCapabilities: ["Interview scheduling", "Panel coordination", "Calendar orchestration"],
        iconKey: "CalendarRange",
      },
      {
        id: "retain",
        verb: "Retain",
        name: "Talent-flight risk monitor",
        description:
          "Monitors flight risk on spin-off-critical roles — on-air talent (most expensive and strategic), senior broadcast engineering, finance leadership, and the StockStory AI team carried over from acquisition.",
        primaryAction:
          "Get a quiet alert 90 days before a spin-off-critical hire would otherwise resign.",
        poweredByCapabilities: ["Retention risk", "Flight risk scoring", "Engagement signal"],
        iconKey: "Radar",
      },
      {
        id: "plan-surge",
        verb: "Plan surge",
        name: "DTC-launch hiring surge planner",
        description:
          "Models the headcount surge required for MS NOW summer 2026 DTC, the CNBC subscription launch, and Fandango AVOD. Identifies build-or-borrow gaps and downstream onboarding load.",
        primaryAction:
          "Land every DTC launch fully staffed without a hiring spike that breaks onboarding.",
        poweredByCapabilities: ["Workforce planning", "Hiring forecast", "Onboarding capacity"],
        iconKey: "Telescope",
      },
    ],
    whyConsolidated:
      "Versant is hyper-hiring while every other media company is contracting. Disney, Netflix, WBD, and tech-cos are competing for the same talent pool, and the Comcast TSA gives Versant 24 months to stand up an independent HR motion. Today recruiting, sourcing, benchmarking, scheduling, and retention sit in separate tools with no shared candidate context.",
    whyCustomBuild:
      "AI talent platforms (e.g., Eightfold) are strong ATS tools, but they do not model Versant's separation-from-Comcast cohort, the Disney/Netflix talent-poaching risk profile, or the DTC-launch headcount surge against an EBITDA covenant. The Workbench is what stitches the ATS to Versant's actual hiring problem.",
    digitalCore: {
      knowledgeStore: "Versant Talent Graph (people, skills, role rubrics, comp bands)",
      identity: "Versant SSO (e.g., Okta) + HR-business-partner RBAC + candidate-data CCPA scoping",
      agentRouter:
        "HR Workbench dispatcher routes source/match/benchmark/schedule/retain intents to specialist agents.",
      auditLog:
        "Hiring-decision audit trail with EEOC-friendly provenance: every match score, comp comparison, and offer recommendation recorded.",
      integrations: [
        "AI talent platform (e.g., Eightfold)",
        "HCM (e.g., Workday HCM)",
        "ATS (e.g., Greenhouse, Lever)",
        "LinkedIn Recruiter",
        "Comp benchmarking (e.g., Pave, Radford)",
      ],
    },
    buildEffort: "Medium custom",
    estimatedDeliveryMonths: 7,
    deliveryPodShape:
      "1 Forge eng pod (~5 FTE) + 1 HR product owner from Jeff Massa's office + recruiter design partner",
    workforceShift:
      "Recruiters spend less time on sourcing-and-scheduling logistics and more time on candidate selling. HR business partners gain leading-indicator retention signal instead of reacting to resignations. Comp team runs continuous benchmarks instead of annual surveys.",
    successMetric: "Time-to-fill on spin-off-critical roles (days)",
    rolloutPattern:
      "Pilot one function (e.g., the build-out of independent Ad Sales hiring against the NBCU TSA expiration) → expand to all functions.",
  },

  // ============================================================
  //   RESEARCH & ANALYTICS WORKBENCH
  // ============================================================
  "research-analytics": {
    id: "research-analytics-workbench",
    towerId: "research-analytics",
    name: "Research & Analytics Workbench",
    tagline:
      "Where Ashley Matts's team unifies CNBC viewers, GolfNow bookers, and Fandango ticket buyers into one Versant audience.",
    primaryUsers: [
      "Insights analysts",
      "Ad sales research",
      "Brand strategy",
      "Audience measurement",
      "Data scientists",
    ],
    surfaces: [
      {
        id: "profile",
        verb: "Profile",
        name: "Unified audience profile",
        description:
          "Single-customer view stitching ratings-panel data (e.g., Nielsen) + per-brand web analytics + GolfNow + GolfPass + Fandango + Rotten Tomatoes + SportsEngine + DTC subscribers into one canonical Versant identity.",
        primaryAction:
          "Resolve a CNBC.com visitor who books on GolfNow and buys movie tickets on Fandango into one cross-vertical profile.",
        poweredByCapabilities: [
          "Unified customer view",
          "Cross-brand identity resolution",
          "Audience profile",
        ],
        iconKey: "Users",
      },
      {
        id: "segment",
        verb: "Segment",
        name: "Cross-vertical segment builder",
        description:
          "Builds advertiser-pitchable segments (e.g., 'business-news viewers who also play golf and bought movie tickets in the last 90 days'). This cross-vertical combination is Versant's most underappreciated competitive asset.",
        primaryAction:
          "Build a cross-vertical advertiser segment in minutes from across the whole Versant portfolio.",
        poweredByCapabilities: ["Audience segmentation", "Lookalike modeling", "Cohort builder"],
        iconKey: "PieChart",
      },
      {
        id: "compare",
        verb: "Compare",
        name: "Linear ↔ digital ↔ DTC cohort analytics",
        description:
          "A/B and cohort analytics across linear, digital, FAST, and DTC. Critical for the 81% linear → 50/50 digital revenue mix-shift the CEO has positioned as the strategic transformation indicator.",
        primaryAction:
          "Quantify the linear-to-digital audience migration brand-by-brand, week-by-week.",
        poweredByCapabilities: ["Cohort analytics", "Audience migration", "Cross-platform reach"],
        iconKey: "LineChart",
      },
      {
        id: "score",
        verb: "Score",
        name: "Content-effect scorer",
        description:
          "Scores content lift, dwell, churn impact, and subscription propensity. Wires into the StockStory acquisition's AI methodology for CNBC content scoring.",
        primaryAction:
          "Know within 48 hours which CNBC, MS NOW, or Golf piece is moving subscriptions vs. burning attention.",
        poweredByCapabilities: ["Content effectiveness", "Engagement scoring", "Attribution"],
        iconKey: "Gauge",
      },
      {
        id: "pitch",
        verb: "Pitch",
        name: "Advertiser pitch generator",
        description:
          "Generates advertiser-ready pitch decks using the unified audience profile and cross-vertical segments. Designed for the post-TSA independent ad sales motion (~2028).",
        primaryAction:
          "Walk into an advertiser meeting with a cross-portfolio audience story no competitor can match.",
        poweredByCapabilities: ["Pitch generator", "Audience deck builder", "Reach modeling"],
        iconKey: "Sparkles",
      },
    ],
    whyConsolidated:
      "A CNBC.com visitor who uses GolfNow and buys movie tickets on Fandango exists as three separate profiles today. That fragmentation is the single biggest blocker to selling the Versant cross-portfolio audience to advertisers — and it disappears the day the Identity Graph is live and surfaced through one Workbench.",
    whyCustomBuild:
      "No measurement vendor unifies ratings-panel data (e.g., Nielsen), 7+ brand-level digital analytics, GolfNow transactions, Fandango ticketing, and DTC subscriber identity. Identity / audience platforms (e.g., Adobe Audience Manager, LiveRamp) solve pieces; nothing solves the whole problem at Versant's specific brand cross-section. The Workbench plus the Identity Graph beneath it is the asset.",
    digitalCore: {
      knowledgeStore: "Versant Audience Graph (identities, segments, content interactions)",
      identity: "Versant SSO (e.g., Okta) + analyst RBAC + CCPA/GDPR PII scoping on raw IDs",
      agentRouter:
        "R&A Workbench dispatcher routes profile/segment/compare/score/pitch intents to specialist agents.",
      auditLog:
        "Identity-resolution and segment-build audit trail — every cross-brand stitch and segment definition recorded for advertiser substantiation.",
      integrations: [
        "Ratings panel (e.g., Nielsen)",
        "Identity graph (e.g., LiveRamp)",
        "Digital analytics (e.g., Adobe Analytics)",
        "GolfNow / GolfPass data",
        "Fandango / Rotten Tomatoes data",
        "Financial-research feed (e.g., StockStory)",
      ],
    },
    buildEffort: "Heavy custom",
    estimatedDeliveryMonths: 10,
    deliveryPodShape:
      "1 Forge data-eng pod (~8 FTE) + 1 R&A product owner from Ashley Matts's office + ad-sales design partner",
    workforceShift:
      "Analysts shift from week-long brand-by-brand pulls to minute-long cross-brand queries. Ad sales research stops rebuilding segments per pitch and starts shipping segments as products. Data scientists invest in models, not in plumbing.",
    successMetric: "% of advertiser pitches anchored on a unified Versant audience profile",
    rolloutPattern:
      "Pilot one brand pair (e.g., CNBC + GolfNow — high-value B2B golfer profile) → expand to all 7+ brands.",
  },

  // ============================================================
  //   LEGAL & BUSINESS AFFAIRS WORKBENCH
  // ============================================================
  legal: {
    id: "legal-workbench",
    towerId: "legal",
    name: "Legal & Business Affairs Workbench",
    tagline:
      "Where Jonathan Gottlieb's team searches inherited NBCU contracts, drafts deals, redlines, and tracks active M&A.",
    primaryUsers: [
      "In-house counsel",
      "Business Affairs paralegals",
      "M&A diligence team",
      "Compliance",
      "Litigation",
    ],
    surfaces: [
      {
        id: "search",
        verb: "Search",
        name: "Contract & precedent search",
        description:
          "Natural-language search across 1,000+ inherited NBCU contracts, including split-rights deals (Kardashians on-air retained, streaming sold to Hulu) and sports rights through 2032 (USGA, WNBA, Winter Olympics).",
        primaryAction:
          "Find a precedent clause across thousands of inherited agreements in seconds instead of days.",
        poweredByCapabilities: [
          "Contract search",
          "Precedent retrieval",
          "Clause library",
        ],
        iconKey: "FileSearch",
      },
      {
        id: "draft",
        verb: "Draft",
        name: "Agreement drafter",
        description:
          "First-pass NDA, talent agreement, license, and production deal drafter. Pulls from Versant precedent rather than generic templates that don't match the brand's split-rights and JV structures.",
        primaryAction:
          "Draft a Versant-specific agreement in minutes rather than starting from a stale NBCU template.",
        poweredByCapabilities: ["Contract drafting", "NDA generator", "License agreement drafter"],
        iconKey: "PenTool",
      },
      {
        id: "redline",
        verb: "Redline",
        name: "Clause-by-clause redline",
        description:
          "Redlines an inbound third-party paper against the Versant playbook. Flags non-standard reps, missing carve-outs (Fandango JV with WBD, Nikkei CNBC JV), and standards-affecting language for MS NOW.",
        primaryAction:
          "Get a Versant-grade redline back in 10 minutes instead of overnight.",
        poweredByCapabilities: ["Redline assistant", "Clause comparison", "Playbook enforcement"],
        iconKey: "Gavel",
      },
      {
        id: "ask",
        verb: "Ask",
        name: "Legal Knowledge Graph Q&A",
        description:
          "Ask the Versant Legal Knowledge Graph anything: 'do we have streaming rights to the Kardashians?', 'when does the USGA agreement expire?', 'what are our covenants on the BB- notes?'. Cites the underlying contract section.",
        primaryAction:
          "Answer 'do we have rights to X?' in seconds with the contract section pinned.",
        poweredByCapabilities: ["Contract Q&A", "Rights question answering", "Clause retrieval"],
        iconKey: "Brain",
      },
      {
        id: "track-ma",
        verb: "Track M&A",
        name: "Active deal & diligence tracker",
        description:
          "State of every active M&A move — Free TV Networks (done), Indy Cinema Group (done), StockStory (done), Vox Media (exploring). Tracks diligence-room state, regulatory clock, and integration readiness.",
        primaryAction:
          "See the active M&A book and where each deal sits — without chasing five teams for status.",
        poweredByCapabilities: ["M&A tracker", "Diligence room", "Deal calendar"],
        iconKey: "Handshake",
      },
      {
        id: "comply",
        verb: "Comply",
        name: "SEC / FCC / AI-regulation surveillance",
        description:
          "Monitors SEC reporting obligations (Versant is in its first reported year), FCC broadcast compliance, and the emerging AI regulation surface against the active contract and deal pipeline.",
        primaryAction:
          "Stay ahead of regulatory shifts before they hit a covenant or a broadcast license.",
        poweredByCapabilities: ["Regulatory monitor", "Compliance surveillance", "Filing tracker"],
        iconKey: "ShieldCheck",
      },
    ],
    whyConsolidated:
      "Jonathan Gottlieb's team inherited 1,000+ contracts from NBCU, is managing the split-rights complexity around Kardashians and other library titles, holding sports rights through 2032 (USGA / WNBA / Olympics), executing on a live M&A pipeline (Free TV Networks done, Vox exploring), and standing up SEC reporting for a brand-new public company. Five disconnected legal tools would be malpractice; one Workbench is the bar.",
    whyCustomBuild:
      "Legal AI, discovery, and CLM platforms (e.g., Harvey, RelativityOne) each solve one slice. No COTS stitches them together against Versant's specific split-rights catalog, multi-JV structures (Fandango 75/25 WBD, Nikkei CNBC), and new-public-company SEC obligations. The Workbench plus the Legal Knowledge Graph beneath it is the differentiator.",
    digitalCore: {
      knowledgeStore: "Versant Legal Knowledge Graph (contracts, parties, rights, obligations, deadlines)",
      identity: "Versant SSO (e.g., Okta) + matter-scoped RBAC + privilege-aware ACLs",
      agentRouter:
        "Legal Workbench dispatcher routes search/draft/redline/ask/track/comply intents to specialist agents.",
      auditLog:
        "Immutable redline + decision log — every clause change, deal note, and agent recommendation timestamped and attributable. SEC-, SOX-, and privilege-ready.",
      integrations: [
        "Legal AI (e.g., Harvey)",
        "Discovery platform (e.g., RelativityOne)",
        "CLM (e.g., Ironclad, DocuSign CLM)",
        "e-Signature (e.g., DocuSign)",
        "Regulatory filing platform (e.g., EDGAR)",
      ],
    },
    buildEffort: "Heavy custom",
    estimatedDeliveryMonths: 9,
    deliveryPodShape:
      "1 Forge eng pod (~6 FTE) + 1 Legal product owner from Jonathan Gottlieb's office + counsel design partner",
    workforceShift:
      "Counsel shifts from clause-hunting to judgment calls. Paralegals stop rebuilding clause libraries and start owning deal-room operations. M&A diligence runs against a queryable contract corpus rather than a one-time read of Hundreds of PDFs.",
    successMetric: "% of lawyer work hours spent inside the Workbench",
    rolloutPattern:
      "Pilot one practice area (e.g., Content Licensing — the highest-volume, most-inherited-NBCU surface) → expand to corporate, M&A, regulatory.",
  },

  // ============================================================
  //   CORPORATE SERVICES WORKBENCH
  // ============================================================
  "corp-services": {
    id: "corp-services-workbench",
    towerId: "corp-services",
    name: "Corporate Services Workbench",
    tagline:
      "Where Rina Patel and Mike Lukan's team runs facilities, vendors, and physical security across NYC HQ, Englewood Cliffs, and the DC bureau.",
    primaryUsers: [
      "Facilities managers",
      "Physical security ops",
      "Vendor management",
      "Real estate",
      "Travel",
    ],
    surfaces: [
      {
        id: "triage-facilities",
        verb: "Triage",
        name: "Facilities request intake",
        description:
          "Single inbox for facilities requests across NYC HQ (229 W 43rd), Englewood Cliffs NJ broadcast, and the leased DC bureau. Routes by site, urgency, and TSA-dependence.",
        primaryAction:
          "Get a maintenance ticket to the right site team in minutes, not days of email forwarding.",
        poweredByCapabilities: ["Facilities ticketing", "Service request routing", "Site triage"],
        iconKey: "Inbox",
      },
      {
        id: "manage-vendors",
        verb: "Manage",
        name: "Non-content vendor MDM",
        description:
          "Master data, payment status, and contract expiry across the non-content vendor base (cleaning, catering, security firms, building services). The post-Comcast vendor base is being rebuilt from scratch.",
        primaryAction:
          "Onboard a new vendor with the right paperwork the first time, not the third.",
        poweredByCapabilities: ["Vendor master data", "Vendor onboarding", "Contract expiry"],
        iconKey: "Briefcase",
      },
      {
        id: "respond-security",
        verb: "Respond",
        name: "Physical-security incident response",
        description:
          "Real-time incident response surface — MS NOW journalists face politically motivated threats, and the CISO function extends into the physical-security envelope around news sites and on-air talent.",
        primaryAction:
          "Coordinate a same-hour response to a credible journalist threat across security firms, NYPD liaison, and on-air talent ops.",
        poweredByCapabilities: ["Threat response", "Incident triage", "Site security"],
        iconKey: "ShieldAlert",
      },
      {
        id: "track-tsa",
        verb: "Track TSA",
        name: "Comcast TSA-exit tracker",
        description:
          "Tracks the handover of shared services from Comcast — real estate (NBC sublease in DC), facilities management, payroll, IT separation milestones — against the contractual TSA expiration clock.",
        primaryAction:
          "Hit every TSA-exit milestone before the contractual clock runs out and pricing escalates.",
        poweredByCapabilities: ["TSA tracker", "Transition milestones", "Separation status"],
        iconKey: "Clock",
      },
      {
        id: "audit-access",
        verb: "Audit",
        name: "Access & visitor audit",
        description:
          "Badge access, visitor logs, OSHA, and contractor access audit trail. Important for news-org sites that are targets of motivated actors.",
        primaryAction:
          "Pull a complete access audit for any site, any window, with no manual spreadsheet stitching.",
        poweredByCapabilities: ["Access audit", "Visitor logging", "Compliance audit"],
        iconKey: "ClipboardCheck",
      },
    ],
    whyConsolidated:
      "Corporate Services is operating across three high-profile sites (NYC HQ, Englewood Cliffs broadcast, and a DC bureau leased from NBC) while exiting Comcast shared services on a TSA clock. Today facilities ITSM, vendor management, physical security, and TSA tracking live in five separate tools — when an incident touches more than one, coordination collapses.",
    whyCustomBuild:
      "Workplace ITSM platforms (e.g., ServiceNow, Eptura) handle facilities tickets. None of them model the Comcast TSA-exit milestones, the MS-NOW-journalist threat profile, or the multi-site security envelope that the CISO function needs to extend into. The Workbench is the layer that wires those together.",
    digitalCore: {
      knowledgeStore: "Versant Operations Graph (sites, vendors, contracts, access events, incidents)",
      identity: "Versant SSO (e.g., Okta) + site-scoped RBAC + security-cleared access for incident drawer",
      agentRouter:
        "Corp Services Workbench dispatcher routes triage/manage/respond/track/audit intents.",
      auditLog:
        "Compliance-grade audit trail (badge access, visitor logs, vendor approvals, incident responses) attestation-ready.",
      integrations: [
        "ITSM (e.g., ServiceNow)",
        "Procurement (e.g., Coupa, Ariba)",
        "Building access control (e.g., Lenel, Genetec)",
        "Travel platform (e.g., Concur, Egencia)",
      ],
    },
    buildEffort: "Medium custom",
    estimatedDeliveryMonths: 6,
    deliveryPodShape:
      "1 Forge eng pod (~4 FTE) + 1 Corp Services product owner from Rina Patel's office + site-ops design partner",
    workforceShift:
      "Site managers stop coordinating by email and start orchestrating from one queue. Physical security ops gets a fast lane into news-org-specific threat response. Vendor management runs continuous, not annual.",
    successMetric: "% of TSA-exit milestones on track",
    rolloutPattern:
      "Pilot the NYC HQ + Englewood Cliffs facilities surface → add DC bureau and physical-security incident drawer.",
  },

  // ============================================================
  //   TECH & ENGINEERING WORKBENCH
  // ============================================================
  "tech-engineering": {
    id: "tech-engineering-workbench",
    towerId: "tech-engineering",
    name: "Technology & Engineering Workbench",
    tagline:
      "Where the Tech & Engineering leadership team stands up the post-Comcast tech stack from scratch.",
    primaryUsers: [
      "Engineering managers",
      "Site reliability engineers",
      "Architects",
      "IT operations",
      "Security engineering",
    ],
    surfaces: [
      {
        id: "triage-incidents",
        verb: "Triage",
        name: "Engineering incident triage",
        description:
          "Production engineering incident triage across the legacy WordPress + PHP stack (per ZoomInfo) and the new cloud build-out. Routes incidents by service ownership and TSA-dependence.",
        primaryAction:
          "Page the right engineer in the right org for any incident across legacy and greenfield stacks.",
        poweredByCapabilities: ["Incident triage", "On-call routing", "Service ownership"],
        iconKey: "Activity",
      },
      {
        id: "decide-architecture",
        verb: "Decide",
        name: "Architecture decision log & ADR generator",
        description:
          "Every architecture decision Versant makes in 2026 is foundational — there is no legacy 'we've always done it this way.' The surface generates and tracks ADRs against the post-Comcast greenfield.",
        primaryAction:
          "Make and record an architecture decision once, with full Versant context, that compounds for years.",
        poweredByCapabilities: ["Architecture decisions", "ADR generator", "Tech radar"],
        iconKey: "GitBranch",
      },
      {
        id: "cutover",
        verb: "Cutover",
        name: "Comcast TSA technology-separation checklist",
        description:
          "Live state of TSA cutover for technology — identity, email, data warehouses, ad sales platforms, broadcast tech. Standing up independent tech infrastructure under the CIO.",
        primaryAction:
          "Execute every TSA cutover on a known clock, with the technical dependency graph visible.",
        poweredByCapabilities: ["TSA cutover", "Separation tracker", "Technical dependencies"],
        iconKey: "Workflow",
      },
      {
        id: "monitor-cost",
        verb: "Monitor",
        name: "Cloud cost & commit pacing",
        description:
          "Cloud spend monitoring and commit pacing across the build-out. Critical because $1.09B cash and a BB- credit rating make every cloud commitment a covenant-relevant decision.",
        primaryAction:
          "Catch cloud spend drift in the week it happens, not the quarter.",
        poweredByCapabilities: ["Cloud cost", "Commit pacing", "FinOps"],
        iconKey: "Cloud",
      },
      {
        id: "manage-identity",
        verb: "Manage",
        name: "SSO & IAM operations",
        description:
          "Identity and access management console — the SSO + role-based ACL backbone for every Workbench. Migrates 1,000-5,000 employees from Comcast directories to Versant SSO on the TSA schedule.",
        primaryAction:
          "Onboard, off-board, and reorg headcount without manual ticketing across 13 tower workbenches.",
        poweredByCapabilities: ["Identity ops", "SSO administration", "IAM"],
        iconKey: "KeyRound",
      },
    ],
    whyConsolidated:
      "Versant is a publicly traded company with 1,000-5,000 employees running 7+ networks on a legacy WordPress + PHP stack while standing up a cloud-native data platform from scratch. The CIO and the Chief Product & Technology Officer (News) are running parallel motions on an aggressive TSA clock. Today engineering visibility lives in tickets, Slack threads, and a dozen vendor consoles.",
    whyCustomBuild:
      "Standard ITSM (e.g., ServiceNow, Atlassian) and FinOps tools handle generic engineering ops. None of them model the post-Comcast greenfield — the TSA cutover dependency graph, the Versant-specific ADR portfolio, or the BB-credit-aware cloud commit posture. The Workbench is the layer that ties them together for Versant's specific moment.",
    digitalCore: {
      knowledgeStore: "Versant Engineering Graph (services, dependencies, ADRs, on-call ownership)",
      identity: "Versant SSO (e.g., Okta) + engineering-RBAC + production-access break-glass workflow",
      agentRouter:
        "Tech Workbench dispatcher routes triage/decide/cutover/monitor/manage intents to specialist agents.",
      auditLog:
        "Engineering change + access audit trail — every production change, ADR, and access grant timestamped for SOX IT-control attestation.",
      integrations: [
        "ITSM (e.g., ServiceNow)",
        "On-call (e.g., PagerDuty)",
        "Issue tracking (e.g., Atlassian Jira, Confluence)",
        "Identity provider (e.g., Okta)",
        "FinOps (e.g., AWS, Azure)",
        "SCM (e.g., GitHub, Bitbucket)",
      ],
    },
    buildEffort: "Medium custom",
    estimatedDeliveryMonths: 7,
    deliveryPodShape:
      "1 Forge eng pod (~6 FTE) + 1 Tech product owner from the engineering leadership team + SRE design partner",
    workforceShift:
      "Engineering managers stop chasing status across tools and start running their org from one queue. SREs spend more time on resilience and less on routing. Architects make decisions against a tracked, queryable history.",
    successMetric: "# of TSA dependencies eliminated per quarter",
    rolloutPattern:
      "Pilot one engineering surface (e.g., identity / SSO cutover — a TSA blocker for every other workbench) → expand to incidents, ADRs, FinOps.",
  },

  // ============================================================
  //   OPERATIONS & TECHNOLOGY (BROADCAST OPS) WORKBENCH
  // ============================================================
  "operations-technology": {
    id: "operations-technology-workbench",
    towerId: "operations-technology",
    name: "Operations & Technology Workbench",
    tagline:
      "Where the master-control operators keep 7+ networks on air 24/7/365 from Englewood Cliffs.",
    primaryUsers: [
      "Master control operators",
      "Technical ops managers",
      "Broadcast engineers",
      "Distribution ops",
      "Event ops",
    ],
    surfaces: [
      {
        id: "monitor-air",
        verb: "Monitor",
        name: "7-network 24/7 broadcast console",
        description:
          "Live air-status, signal quality, and distribution health across MS NOW, CNBC, Golf Channel, USA, E!, Syfy, and Oxygen True Crime. 24/7/365 from Englewood Cliffs NJ.",
        primaryAction:
          "See the state of every Versant network at a glance — and route a problem to the right desk in seconds.",
        poweredByCapabilities: ["Broadcast monitoring", "Signal quality", "Air status"],
        iconKey: "MonitorPlay",
      },
      {
        id: "detect-insertion",
        verb: "Detect",
        name: "Commercial insertion error detector",
        description:
          "Continuous audio-fingerprinting and commercial-insertion verification across 7+ feeds. Each missed insertion is a direct $10K-$100K+ revenue loss against a $1.58B ad pool — the math is non-negotiable.",
        primaryAction:
          "Catch a bad insertion within seconds, route the makegood, protect every dollar of ad revenue.",
        poweredByCapabilities: [
          "Commercial insertion verification",
          "Audio fingerprinting",
          "Makegood automation",
        ],
        iconKey: "Radar",
      },
      {
        id: "operate-fast",
        verb: "Operate",
        name: "FAST channel & OTA rundown",
        description:
          "FAST channel programming and operations including the Free TV Networks acquisition (OTA + FAST channels). One operator surface for the new free-streaming and OTA portfolio.",
        primaryAction:
          "Run the FAST + OTA portfolio at parity with the linear cable feeds.",
        poweredByCapabilities: ["FAST operations", "Channel rundown", "OTA operations"],
        iconKey: "Tv",
      },
      {
        id: "triage-off-air",
        verb: "Triage",
        name: "Off-air incident & failover",
        description:
          "Zero-tolerance off-air incident triage with multi-network failover orchestration. Versant has zero tolerance for off-air incidents — distribution revenue is $4.09B (81% of total).",
        primaryAction:
          "Restore air in under a minute with the right failover path for the impacted network.",
        poweredByCapabilities: ["Off-air response", "Failover orchestration", "Incident management"],
        iconKey: "AlertTriangle",
      },
      {
        id: "plan-events",
        verb: "Plan",
        name: "Major-event operations planner",
        description:
          "Multi-network event ops planning — Winter Olympics on USA/CNBC, election cycles (MS NOW 2026 midterms, $200M+ ad opportunity), golf majors on Golf Channel (USGA through 2032).",
        primaryAction:
          "Stand up a major-event operating plan that holds across 7+ networks and 60% of viewership.",
        poweredByCapabilities: ["Event operations", "Major-event planning", "Live event ops"],
        iconKey: "CalendarRange",
      },
      {
        id: "reconcile-distribution",
        verb: "Reconcile",
        name: "Distribution & MVPD carriage",
        description:
          "MVPD carriage and distribution reconciliation against 126M US households. Critical against -5.4% linear-distribution declines and the BB- credit covenant exposure.",
        primaryAction:
          "Hold every MVPD carriage agreement true to plan, hour-by-hour.",
        poweredByCapabilities: ["Distribution reconciliation", "MVPD carriage", "Affiliate ops"],
        iconKey: "Share2",
      },
    ],
    whyConsolidated:
      "Operating 7+ networks 24/7/365 from Englewood Cliffs against a -5.4% linear-distribution decline and a -8.9% advertising decline means every off-air second and every missed commercial costs material money. Today ops teams jump between disconnected playout, signal, and graphics vendor consoles per network (e.g., Amagi, Evertz, Imagine) with no unified state.",
    whyCustomBuild:
      "Playout platforms (e.g., Amagi) handle playout. Signal-management vendors (e.g., Evertz) handle signal. No COTS platform stitches playout + 7 linear feeds + FAST library + Free TV Networks OTA into a single operator console with Versant's specific event book (Olympics, elections, golf majors) and revenue exposure model. The Workbench is the operator-facing layer.",
    digitalCore: {
      knowledgeStore: "Versant Broadcast Telemetry Store (signals, schedules, insertions, incidents)",
      identity: "Versant SSO (e.g., Okta) + master-control-ops RBAC + on-air break-glass",
      agentRouter:
        "Ops Workbench dispatcher routes monitor/detect/operate/triage/plan/reconcile intents.",
      auditLog:
        "Broadcast-grade incident + insertion log — every off-air event and commercial discrepancy stamped for FCC and advertiser-makegood substantiation.",
      integrations: [
        "Playout platform (e.g., Amagi)",
        "Signal management (e.g., Evertz)",
        "Broadcast operations (e.g., Imagine Communications)",
        "Ad/Traffic system (e.g., Wideorbit)",
        "MVPD carriage data feeds",
      ],
    },
    buildEffort: "Heavy custom",
    estimatedDeliveryMonths: 10,
    deliveryPodShape:
      "1 Forge broadcast-eng pod (~7 FTE) + 1 Ops product owner from the CIO's office + master-control design partner",
    workforceShift:
      "Master-control operators run 7 networks from one console instead of seven. Distribution ops gets a single reconciliation surface instead of MVPD-by-MVPD spreadsheets. Event ops plans Olympics or elections against a fact-checked production graph.",
    successMetric: "Off-air seconds per month across the 7-network portfolio",
    rolloutPattern:
      "Pilot one network (e.g., MS NOW — election-cycle exposure forces tight ops) → expand to the full 7-network portfolio plus FAST and OTA.",
  },

  // ============================================================
  //   AD SALES WORKBENCH
  // ============================================================
  "ad-sales": {
    id: "ad-sales-workbench",
    towerId: "ad-sales",
    name: "Ad Sales Workbench",
    tagline:
      "Where Versant's post-TSA independent ad sales operation paces, yields, pitches, and reconciles inventory across linear, digital, FAST, DTC, and podcast.",
    primaryUsers: [
      "Sellers (per-vertical)",
      "Pricing & yield",
      "Pitch / packaging",
      "Brand-safety analysts",
      "Inventory ops",
    ],
    surfaces: [
      {
        id: "pace",
        verb: "Pace",
        name: "Cross-platform pacing",
        description:
          "Pacing across linear, digital, FAST, OTA, DTC, and podcast inventory in one view. NBCU runs ad sales via a 2-year TSA expiring around 2028 — Versant must build independent pacing visibility from Day 1.",
        primaryAction:
          "See pace against goal across every inventory class in real time, every day.",
        poweredByCapabilities: ["Inventory pacing", "Sell-through tracking", "Goal attainment"],
        iconKey: "Gauge",
      },
      {
        id: "yield",
        verb: "Yield",
        name: "Yield optimization",
        description:
          "Yield optimization against the $1.58B ad pool (declining 8.9% YoY). Considers election-cycle dynamics, MS NOW progressive-positioning sensitivity, and cross-portfolio bundle math.",
        primaryAction:
          "Lift effective yield on declining linear inventory and growing digital inventory simultaneously.",
        poweredByCapabilities: ["Yield optimization", "Inventory pricing", "Revenue management"],
        iconKey: "TrendingUp",
      },
      {
        id: "plan-cycles",
        verb: "Plan cycles",
        name: "Election & event cycle planner",
        description:
          "Election-cycle revenue planner ($200M+ for MS NOW in 2026 midterms; presidential 2028 modeled forward), Winter Olympics planner (USA/CNBC), golf majors planner (Golf Channel, USGA through 2032).",
        primaryAction:
          "Pre-sell every event cycle against the right inventory mix before the cycle starts.",
        poweredByCapabilities: ["Cycle planning", "Event revenue planning", "Pre-sell modeling"],
        iconKey: "CalendarRange",
      },
      {
        id: "score-brand-safety",
        verb: "Score",
        name: "Advertiser brand-safety scoring",
        description:
          "Brand-safety scoring tuned for MS NOW's progressive editorial positioning and CNBC's market-moving environment. Distinguishes routine political controversy from genuine advertiser risk.",
        primaryAction:
          "Keep advertisers in the right adjacencies without over-blocking MS NOW or CNBC inventory.",
        poweredByCapabilities: ["Brand safety", "Contextual scoring", "Ad adjacency"],
        iconKey: "ShieldCheck",
      },
      {
        id: "pitch",
        verb: "Pitch",
        name: "Cross-portfolio pitch builder",
        description:
          "Builds advertiser bundles across linear + digital + FAST + DTC + podcast + sports + business + entertainment. Leverages the cross-vertical audience profile from the R&A Workbench.",
        primaryAction:
          "Walk into every advertiser meeting with a Versant-only cross-portfolio story.",
        poweredByCapabilities: ["Pitch builder", "Cross-platform packaging", "Bundle generator"],
        iconKey: "Sparkles",
      },
      {
        id: "reconcile-inventory",
        verb: "Reconcile",
        name: "Billed-vs.-delivered reconciliation",
        description:
          "Billed-vs.-delivered reconciliation across every inventory class. Manages makegoods and audits revenue recognition into the Finance Workbench close cycle.",
        primaryAction:
          "Close every billing cycle clean across linear + digital + FAST + DTC + podcast inventory.",
        poweredByCapabilities: ["Billed-vs.-delivered", "Makegood management", "Revenue recognition"],
        iconKey: "GitMerge",
      },
    ],
    whyConsolidated:
      "NBCU handles ad sales today via a 2-year TSA. Versant must stand up independent ad sales by approximately 2028 — for a portfolio that ranges from MS NOW (politically sensitive) to Golf (transactional / B2B-skewing) to FAST channels (Free TV Networks). Today there is no Versant ad sales surface at all; every dollar runs through NBCU's stack.",
    whyCustomBuild:
      "Ad-tech platforms (e.g., FreeWheel, Operative, Beeswax) solve pieces. None of them model the Versant-specific cross-portfolio (sports + business news + entertainment + golf transactional + DTC + podcast), the MS NOW progressive brand-safety nuance, or the post-TSA independence runway. Everything in this Workbench is greenfield.",
    digitalCore: {
      knowledgeStore: "Versant Inventory Graph (inventory pools, advertisers, deals, pacing, makegoods)",
      identity: "Versant SSO (e.g., Okta) + seller-RBAC + advertiser-facing data-room scoping",
      agentRouter:
        "Ad Sales Workbench dispatcher routes pace/yield/plan/score/pitch/reconcile intents.",
      auditLog:
        "Billed-vs.-delivered audit trail + brand-safety decision log — every advertiser placement and makegood traceable to source data.",
      integrations: [
        "Identity graph (e.g., LiveRamp)",
        "Subscription platform (e.g., Piano)",
        "Ad-server / order management (e.g., FreeWheel, Operative)",
        "Measurement (e.g., Nielsen, Comscore)",
        "CRM (e.g., Salesforce)",
      ],
    },
    buildEffort: "Heavy custom",
    estimatedDeliveryMonths: 12,
    deliveryPodShape:
      "1 Forge eng pod (~7 FTE) + 1 Ad Sales product owner + post-TSA-independence design partner",
    workforceShift:
      "Sellers move from spreadsheet packaging to one-click cross-portfolio bundles. Yield team gets continuous price optimization instead of weekly tweaks. Inventory ops closes the billing cycle in days, not weeks.",
    successMetric: "% inventory yield vs. plan",
    rolloutPattern:
      "Pilot one inventory class (e.g., MS NOW election-cycle linear — most concentrated $ exposure) → expand to digital, FAST, DTC, podcast.",
  },

  // ============================================================
  //   SALES WORKBENCH (general / distribution & affiliate sales)
  // ============================================================
  sales: {
    id: "sales-workbench",
    towerId: "sales",
    name: "Sales Workbench",
    tagline:
      "Where the distribution and affiliate-sales team manages $4.09B in MVPD carriage and DTC partnerships.",
    primaryUsers: [
      "Distribution sellers",
      "Affiliate sales managers",
      "Partnership leads",
      "Carriage analysts",
    ],
    surfaces: [
      {
        id: "pace-carriage",
        verb: "Pace",
        name: "MVPD carriage pacing",
        description:
          "Pacing of $4.09B linear distribution revenue (81% of total, declining 5.4%) across every major MVPD carriage agreement and 126M US households reached.",
        primaryAction:
          "See carriage revenue pace against plan by MVPD, week by week.",
        poweredByCapabilities: ["Carriage pacing", "Distribution revenue", "Affiliate tracker"],
        iconKey: "Gauge",
      },
      {
        id: "renew",
        verb: "Renew",
        name: "Affiliate renewal planner",
        description:
          "Renewal pipeline across MVPD agreements — the highest-leverage negotiations Versant runs, with direct exposure to the BB- covenant package.",
        primaryAction:
          "Walk into every renewal with a current data-driven pitch instead of last quarter's deck.",
        poweredByCapabilities: ["Renewal planning", "Negotiation prep", "Carriage modeling"],
        iconKey: "Handshake",
      },
      {
        id: "model-dtc",
        verb: "Model",
        name: "DTC partnership modeler",
        description:
          "Models DTC partnerships — Kalshi prediction-market integration (CNBC), Hulu streaming pact for the Kardashians, Peacock retention agreements. Each is structurally different from a linear carriage deal.",
        primaryAction:
          "Quantify DTC partnership economics against the 81% → 50/50 linear-to-digital mix-shift target.",
        poweredByCapabilities: ["DTC partnerships", "Partnership modeling", "Distribution strategy"],
        iconKey: "Workflow",
      },
      {
        id: "track-revenue-mix",
        verb: "Track mix",
        name: "Linear → digital revenue mix tracker",
        description:
          "Live tracker of the 81% pay-TV → 50/50 digital revenue mix-shift that the CEO has positioned as the critical strategic transformation indicator.",
        primaryAction:
          "Show the mix-shift trajectory at any moment to the board, to investors, and to operators.",
        poweredByCapabilities: ["Revenue mix tracking", "Mix-shift modeling", "Strategic KPIs"],
        iconKey: "PieChart",
      },
    ],
    whyConsolidated:
      "$4.09B of linear-distribution revenue (81% of total) is the largest single revenue line at Versant — and it's declining 5.4%. The mix-shift to digital (target: 50/50 from today's 81% pay-TV) is what the CEO calls the critical strategic indicator. Today distribution sellers run renewals from disconnected spreadsheets and decks.",
    whyCustomBuild:
      "Generic CRM (e.g., Salesforce) tracks deals; it does not model MVPD carriage revenue against a BB- covenant package or the explicit 81%-to-50/50 revenue mix-shift framework. The Workbench is the layer that turns distribution selling into a tracked, modeled discipline.",
    digitalCore: {
      knowledgeStore: "Versant Distribution Graph (MVPDs, carriage terms, revenue, mix)",
      identity: "Versant SSO (e.g., Okta) + sales-RBAC + deal-room scoping",
      agentRouter: "Sales Workbench dispatcher routes pace/renew/model/track intents.",
      auditLog:
        "Renewal and revenue-recognition audit trail tied to the Finance Workbench's close cycle.",
      integrations: [
        "CRM (e.g., Salesforce)",
        "Carriage metrics (e.g., Nielsen)",
        "MVPD partner data feeds",
        "Subscription analytics",
      ],
    },
    buildEffort: "Medium custom",
    estimatedDeliveryMonths: 7,
    deliveryPodShape:
      "1 Forge eng pod (~4 FTE) + 1 Sales product owner + distribution-seller design partner",
    workforceShift:
      "Distribution sellers walk into renewals with current data instead of stale decks. Partnership leads model DTC deals against the mix-shift target. Affiliate analysts run continuous, not quarterly, analyses.",
    successMetric: "Revenue mix vs. 81%→50/50 trajectory",
    rolloutPattern:
      "Pilot one MVPD renewal cycle → expand to the full carriage book and DTC partnership pipeline.",
  },

  // ============================================================
  //   MARKETING & COMMUNICATIONS WORKBENCH
  // ============================================================
  "marketing-comms": {
    id: "marketing-comms-workbench",
    towerId: "marketing-comms",
    name: "Marketing & Communications Workbench",
    tagline:
      "Where the four CMOs' teams brief, listen, publish, respond, and track DTC across MS NOW, CNBC, Golf, USA, E!, Syfy, Oxygen, and Fandango.",
    primaryUsers: [
      "Brand marketers (per CMO lane)",
      "Communications / PR",
      "DTC acquisition",
      "Social team",
      "Crisis-PR",
    ],
    surfaces: [
      {
        id: "brief-campaigns",
        verb: "Brief",
        name: "Multi-brand campaign brief drafter",
        description:
          "Brief drafter per CMO lane — Frank Tanki (Entertainment & Sports), Tom Clendenin (CNBC + MS NOW), Amanda Norvell and Claire Ripsteen. Brand-voice consistent, never generic.",
        primaryAction:
          "Get a Versant-brand-aligned campaign brief out the door in hours instead of days.",
        poweredByCapabilities: ["Campaign briefs", "Brand-voice drafting", "Marketing copy"],
        iconKey: "PenTool",
      },
      {
        id: "listen",
        verb: "Listen",
        name: "Cross-brand social listening",
        description:
          "Social listening across 8B MS NOW social views (TikTok + YouTube, 2025) plus CNBC's footprint plus Fandango plus Rotten Tomatoes audiences. Surfaces emerging narrative shifts brand-by-brand.",
        primaryAction:
          "See a narrative shifting across MS NOW + CNBC + Fandango in the first hour, not the second day.",
        poweredByCapabilities: ["Social listening", "Narrative detection", "Brand mention monitor"],
        iconKey: "Eye",
      },
      {
        id: "publish",
        verb: "Publish",
        name: "Multi-brand publishing console",
        description:
          "Paid, earned, and owned publishing console across the brand portfolio. Single place for cross-channel publishing without losing brand-voice control.",
        primaryAction:
          "Publish a campaign across owned, earned, and paid channels from one workflow.",
        poweredByCapabilities: ["Multi-channel publishing", "Campaign orchestration", "Content distribution"],
        iconKey: "Send",
      },
      {
        id: "respond-pr",
        verb: "Respond",
        name: "Crisis-PR responder",
        description:
          "Crisis-PR responder tuned for MS NOW progressive-positioning controversy and CNBC market-moving stories. Drafts holding statements, briefs spokespeople, tracks advertiser responses.",
        primaryAction:
          "Get a defensible holding statement and advertiser-impact read inside an hour, not a day.",
        poweredByCapabilities: ["Crisis PR", "Statement drafting", "Reputation response"],
        iconKey: "AlertTriangle",
      },
      {
        id: "track-dtc",
        verb: "Track DTC",
        name: "DTC acquisition funnel monitor",
        description:
          "DTC acquisition funnel monitoring for MS NOW (summer 2026 community/membership), CNBC subscription, Fandango AVOD. Three new product launches simultaneously.",
        primaryAction:
          "See cost per subscriber and funnel health for every DTC launch in one view.",
        poweredByCapabilities: ["DTC acquisition", "Subscription funnel", "Marketing attribution"],
        iconKey: "TrendingUp",
      },
      {
        id: "build-corporate",
        verb: "Build",
        name: "Versant corporate-brand identity builder",
        description:
          "Versant itself is a brand-new corporate identity (NASDAQ: VSNT, formed January 2, 2026). Internal and external corporate-brand identity is being built from scratch post-Comcast.",
        primaryAction:
          "Stand up Versant's corporate-brand identity faster than any new-public-company peer.",
        poweredByCapabilities: ["Corporate brand", "Identity system", "Brand guidelines"],
        iconKey: "Star",
      },
    ],
    whyConsolidated:
      "Versant runs four CMOs across four brand portfolios (Entertainment & Sports under Frank Tanki, CNBC + MS NOW under Tom Clendenin, plus Amanda Norvell and Claire Ripsteen). Three DTC launches are happening in parallel (MS NOW summer 2026, CNBC subscription, Fandango AVOD) while the corporate Versant brand identity is being built from zero. Four separate marketing-ops stacks would multiply the work.",
    whyCustomBuild:
      "Generic marketing-ops tools (Adobe Experience Cloud, HubSpot, Salesforce Marketing Cloud) handle campaign mechanics. None of them model the four-CMO multi-brand publishing problem, MS-NOW-grade crisis-PR responsiveness, the three-simultaneous-DTC-launch funnel, or the from-zero corporate-brand build for a brand-new public company.",
    digitalCore: {
      knowledgeStore: "Versant Brand Graph (campaigns, assets, brand voice, audience segments per brand)",
      identity: "Versant SSO (e.g., Okta) + brand-team RBAC + crisis-PR escalation roles",
      agentRouter:
        "Marketing Workbench dispatcher routes brief/listen/publish/respond/track/build intents.",
      auditLog:
        "Brand-decision and crisis-response audit trail — every public statement, brand-asset publish, and crisis-PR response timestamped and attributable.",
      integrations: [
        "Adobe Experience Cloud",
        "Sprinklr / Brandwatch",
        "Salesforce Marketing Cloud",
        "Piano (DTC funnel)",
        "Google Analytics",
      ],
    },
    buildEffort: "Heavy custom",
    estimatedDeliveryMonths: 9,
    deliveryPodShape:
      "1 Forge eng pod (~6 FTE) + 1 Marketing product owner (cross-CMO) + crisis-PR design partner",
    workforceShift:
      "Brand marketers spend less time on cross-tool plumbing and more on brand voice. Comms team gets a fast lane for crisis responses tied to advertiser impact. DTC acquisition runs one tracked funnel instead of three separate ones.",
    successMetric: "Cost per DTC subscriber acquired (blended across MS NOW + CNBC + Fandango)",
    rolloutPattern:
      "Pilot one CMO lane (e.g., Tom Clendenin's CNBC + MS NOW lane — the politically and market-sensitive lane) → expand to all four CMOs.",
  },

  // ============================================================
  //   SERVICE WORKBENCH
  // ============================================================
  service: {
    id: "service-workbench",
    towerId: "service",
    name: "Service Workbench",
    tagline:
      "Where Todd Triplett's team supports CNBC Pro, GolfNow / GolfPass, Fandango refunds, SportsEngine, and DTC subscribers in one queue.",
    primaryUsers: [
      "Customer support agents (per-brand pods)",
      "Knowledge-base authors",
      "Subscription operations",
      "Escalation managers",
    ],
    surfaces: [
      {
        id: "triage-multi-brand",
        verb: "Triage",
        name: "Multi-brand support intake",
        description:
          "Single inbox across CNBC Pro subscribers, GolfNow / GolfPass customers, Fandango refunds, DTC subscribers (MS NOW, CNBC), and SportsEngine youth-sports operators. Brand-aware routing without cross-brand context loss.",
        primaryAction:
          "Route any ticket to the right brand pod in seconds without losing the customer's cross-brand context.",
        poweredByCapabilities: ["Multi-brand triage", "Ticket routing", "Support intake"],
        iconKey: "Inbox",
      },
      {
        id: "resolve-realtime",
        verb: "Resolve",
        name: "Real-time resolution queue",
        description:
          "Real-time resolution queue for the two highest-velocity surfaces — GolfNow (the customer is at the course, in the parking lot) and Fandango (the customer is at the theater). Minutes matter.",
        primaryAction:
          "Resolve a GolfNow or Fandango real-time issue before the customer abandons the brand.",
        poweredByCapabilities: ["Real-time support", "GolfNow live resolution", "Fandango refund"],
        iconKey: "Zap",
      },
      {
        id: "escalate",
        verb: "Escalate",
        name: "Cross-brand escalation router",
        description:
          "Priority routing for issues that touch multiple brands (a Fandango refund tied to a Rotten Tomatoes account; a CNBC Pro question that bleeds into MS NOW DTC support).",
        primaryAction:
          "Get cross-brand issues to the right escalation owner without seven internal hand-offs.",
        poweredByCapabilities: ["Escalation routing", "Cross-brand support", "Priority queue"],
        iconKey: "Signpost",
      },
      {
        id: "author-kb",
        verb: "Author",
        name: "Knowledge-base authoring",
        description:
          "Brand-voice-aware knowledge-base authoring. CNBC Pro voice differs from GolfNow voice differs from Fandango voice — the KB cannot read like a single homogeneous corpus.",
        primaryAction:
          "Write a KB article in a specific brand's voice, not a generic support voice.",
        poweredByCapabilities: ["KB authoring", "Brand-voice support copy", "Self-service content"],
        iconKey: "BookOpen",
      },
      {
        id: "track-subs",
        verb: "Track subs",
        name: "DTC subscriber lifecycle",
        description:
          "Subscriber lifecycle surface — launch, renewal, refund policy enforcement, churn outreach. Spans MS NOW (summer 2026 launch), CNBC subscription, and Fandango AVOD.",
        primaryAction:
          "See the full subscriber lifecycle across three DTC products from one view.",
        poweredByCapabilities: ["Subscription lifecycle", "Churn outreach", "Refund management"],
        iconKey: "Users",
      },
    ],
    whyConsolidated:
      "Versant's service surface spans CNBC Pro subscribers (financially literate, ROI-driven), GolfNow / GolfPass customers (in the parking lot, time-critical), Fandango ticket buyers (high-volume, refund-heavy), SportsEngine youth-sports operators (B2B-tinged), and net-new DTC subscribers. Five distinct support motions. Today they sit in five tools with no shared customer view.",
    whyCustomBuild:
      "Zendesk, Salesforce Service Cloud, and Intercom handle generic support. None of them model the GolfNow real-time constraint, the Fandango refund-volume cohort, or the unified DTC-subscriber view across brands. The Workbench plus the Identity Graph beneath it is the differentiator.",
    digitalCore: {
      knowledgeStore: "Versant Support Knowledge Graph (tickets, customers, refunds, KB articles)",
      identity: "Versant SSO (e.g., Okta) + agent-RBAC + brand-pod scoping + CCPA PII scoping",
      agentRouter:
        "Service Workbench dispatcher routes triage/resolve/escalate/author/track intents.",
      auditLog:
        "Support-decision audit trail — every refund, escalation, and KB authoring action stamped for compliance and brand-trust attestation.",
      integrations: [
        "Zendesk / Salesforce Service Cloud",
        "Intercom (DTC)",
        "Fandango refund engine",
        "GolfNow booking system",
        "Stripe / payments",
      ],
    },
    buildEffort: "Medium custom",
    estimatedDeliveryMonths: 7,
    deliveryPodShape:
      "1 Forge eng pod (~5 FTE) + 1 Service product owner from Todd Triplett's office + multi-brand agent design partner",
    workforceShift:
      "Support agents see cross-brand context instead of one ticket at a time. Escalation managers cut routing overhead. KB authors ship brand-voice content faster.",
    successMetric: "First-contact resolution rate weighted by brand SLA",
    rolloutPattern:
      "Pilot one brand (e.g., GolfNow — highest real-time pressure) → expand to Fandango, CNBC Pro, SportsEngine, DTC.",
  },

  // ============================================================
  //   EDITORIAL & NEWS WORKBENCH
  // ============================================================
  "editorial-news": {
    id: "editorial-news-workbench",
    towerId: "editorial-news",
    name: "Editorial & News Workbench",
    tagline:
      "Where the MS NOW and CNBC newsrooms brief, search, draft, fact-check, copy-edit, and gate content.",
    primaryUsers: [
      "Producers",
      "On-air talent",
      "Researchers / bookers",
      "Standards & Practices",
      "Copy editors",
    ],
    surfaces: [
      {
        id: "brief-story",
        verb: "Brief",
        name: "Story brief generator",
        description:
          "From breaking news intake → producer-ready story brief in minutes. Context-aware (MS NOW progressive lens vs. CNBC business neutrality) and standards-aware (editorial standards framework).",
        primaryAction:
          "Get a producer-ready story brief inside the first 10 minutes of a breaking news event.",
        poweredByCapabilities: ["Story brief", "Breaking news brief", "Producer brief"],
        iconKey: "FileText",
      },
      {
        id: "search-archive",
        verb: "Search archive",
        name: "Multi-decade archive search",
        description:
          "Search across MS NOW + CNBC archive + StockStory analysis + the podcast library (140M+ MS NOW podcast downloads). If Vox Media is acquired, ~40 podcast shows (Pivot, Criminal, etc.) join the corpus.",
        primaryAction:
          "Pull the right archive clip or analysis in seconds while a story is still on the table.",
        poweredByCapabilities: ["Archive search", "Clip retrieval", "Editorial corpus"],
        iconKey: "Search",
      },
      {
        id: "draft-scripts",
        verb: "Draft scripts",
        name: "Script & lower-thirds first-draft",
        description:
          "First-pass script and lower-thirds generator. Brand-voice-aware (MS NOW progressive tone vs. CNBC business neutrality) and SOT (sound-on-tape) aware.",
        primaryAction:
          "Give producers a script + lower-thirds first draft they actually edit, not rewrite from zero.",
        poweredByCapabilities: ["Script drafting", "Lower-thirds generator", "On-air copy"],
        iconKey: "PenTool",
      },
      {
        id: "fact-check",
        verb: "Fact-check",
        name: "Claim-by-claim corroboration",
        description:
          "Claim-by-claim fact-check against corroborated sources before publish. Highest-leverage at MS NOW (political claims) and CNBC (market-moving claims).",
        primaryAction:
          "Surface every claim's corroboration state before it goes to air.",
        poweredByCapabilities: ["Fact-checking", "Claim verification", "Source corroboration"],
        iconKey: "ClipboardCheck",
      },
      {
        id: "copy-edit",
        verb: "Copy-edit",
        name: "Style-guide enforcement",
        description:
          "Style enforcement per brand — MS NOW progressive editorial standards, CNBC business neutrality. Stops the brand-voice drift that breaks audience trust over time.",
        primaryAction:
          "Catch a brand-voice violation before it ships, not after a tweet calls it out.",
        poweredByCapabilities: ["Style editing", "Brand-voice enforcement", "Copy review"],
        iconKey: "BookOpen",
      },
      {
        id: "gate-standards",
        verb: "Gate",
        name: "Editorial standards gate",
        description:
          "The editorial standards gate — explicit human-in-the-loop publish for stories above a defined sensitivity threshold. AI assists; standards staff decide.",
        primaryAction:
          "Hold the editorial bar the standards team has set, every story, every shift.",
        poweredByCapabilities: ["Standards review", "Publish gate", "Editorial governance"],
        iconKey: "ShieldCheck",
      },
    ],
    whyConsolidated:
      "MS NOW and CNBC newsrooms run in parallel with fundamentally different editorial voices (progressive vs. business-neutral) and shared standards expectations. MS NOW's 8B social views, 140M+ podcast downloads, and the potential Vox Media acquisition (~40 podcast shows) multiply the surface every editorial decision touches. Five separate AI tools per newsroom would collapse standards.",
    whyCustomBuild:
      "AI editing tools (e.g., Descript), speech-to-text (e.g., Deepgram), and generative-AI tools each solve a slice. No COTS captures the Versant-specific editorial standards framework, the MS NOW vs. CNBC voice distinction, or the archive depth. 'Human-led, AI-powered' is the published editorial AI philosophy — and the Workbench is the layer that operationalizes it.",
    digitalCore: {
      knowledgeStore: "Versant Editorial Knowledge Graph (stories, sources, archive, standards rulings)",
      identity: "Versant SSO (e.g., Okta) + newsroom-RBAC + standards-staff override roles",
      agentRouter:
        "Editorial Workbench dispatcher routes brief/search/draft/fact-check/copy-edit/gate intents.",
      auditLog:
        "Editorial decision and standards-gate audit trail — every published story, every gate decision, every fact-check trail recorded. FCC-, defamation-, and standards-defense ready.",
      integrations: [
        "AI audio/video editing (e.g., Descript)",
        "Speech-to-text (e.g., Deepgram)",
        "Archive AI (e.g., Veritone)",
        "Archive media-asset-management system",
        "Newsroom system (e.g., Avid NRCS)",
      ],
    },
    buildEffort: "Heavy custom",
    estimatedDeliveryMonths: 10,
    deliveryPodShape:
      "1 Forge eng pod (~6 FTE) + 1 Editorial product owner per newsroom (MS NOW + CNBC) + standards design partner",
    workforceShift:
      "Producers spend less time on briefs and copy and more time on judgment. Standards staff gates AI-drafted material instead of all material. Archive researchers run search queries instead of phone calls.",
    successMetric: "% of stories passing standards gate on first submission",
    rolloutPattern:
      "Pilot one newsroom (e.g., MS NOW — progressive-editorial sensitivity forces tight standards gate) → expand to CNBC, then podcast/Vox if acquired.",
  },

  // ============================================================
  //   PRODUCTION WORKBENCH
  // ============================================================
  production: {
    id: "production-workbench",
    towerId: "production",
    name: "Production Workbench",
    tagline:
      "Where Jeff Behnke, Janice Ferrell, and Brad Wall's production teams cue, cut, browse archive, and package for 7+ networks.",
    primaryUsers: [
      "Producers",
      "Editors",
      "Studio operations",
      "Post-production",
      "Graphics team",
    ],
    surfaces: [
      {
        id: "plan-rundown",
        verb: "Plan",
        name: "Show rundown & multi-cam plan",
        description:
          "Show rundown plus multi-cam plan generator. The contributing studio surface — NYC + Englewood Cliffs + DC — has overlapping demand across 7+ networks. Rundown decisions cascade.",
        primaryAction:
          "Lock a show's rundown plus multi-cam plan once, not three times after late content drops.",
        poweredByCapabilities: ["Show rundown", "Multi-cam plan", "Production planning"],
        iconKey: "ClipboardList",
      },
      {
        id: "cue-graphics",
        verb: "Cue",
        name: "Lower-thirds & chyron generator",
        description:
          "Lower-thirds, chyrons, and graphic-pack generator with brand-voice consistency (CNBC vs. MS NOW vs. USA Sports). Drops directly into the master-control playout chain.",
        primaryAction:
          "Generate brand-consistent lower-thirds in seconds, not the minute before air.",
        poweredByCapabilities: ["Lower-thirds", "Chyron generator", "On-air graphics"],
        iconKey: "Captions",
      },
      {
        id: "browse-archive",
        verb: "Browse archive",
        name: "Multi-decade B-roll search",
        description:
          "Decades of Versant archive — broadcast, podcast audio, transcripts — searchable by topic, talent, event, even spoken phrase. Massive archive (decades) that is currently poorly indexed.",
        primaryAction:
          "Pull the right B-roll clip in seconds during a breaking news show, not 'we'll re-cut for the rerun.'",
        poweredByCapabilities: ["Archive search", "B-roll retrieval", "Clip search"],
        iconKey: "Layers",
      },
      {
        id: "package-highlights",
        verb: "Package",
        name: "Automated highlights & clipping",
        description:
          "Automated clipping and packaging for social / digital / podcast / DTC. Tuned per platform (TikTok aspect, YouTube length, podcast audio extraction).",
        primaryAction:
          "Ship a multi-platform highlight package in minutes after the live moment, not the next day.",
        poweredByCapabilities: ["Highlights generation", "Clip packaging", "Multi-platform clipping"],
        iconKey: "Scissors",
      },
      {
        id: "allocate-studio",
        verb: "Allocate",
        name: "Studio & resource allocator",
        description:
          "Englewood Cliffs studio allocation across 7+ networks competing for the same facilities. Breaking news triggers cascade reallocation across cable + digital + podcast contributions.",
        primaryAction:
          "Reallocate studios on a breaking news event without dropping the day's planned contributions.",
        poweredByCapabilities: ["Studio allocation", "Resource scheduling", "Facility planning"],
        iconKey: "Building2",
      },
      {
        id: "track-post",
        verb: "Track post",
        name: "Post-production pipeline",
        description:
          "Pipeline status across linear + digital + social + DTC + podcast outputs. Post-production today serves five distribution surfaces from the same source material.",
        primaryAction:
          "See every piece in post and where it sits across five output surfaces.",
        poweredByCapabilities: ["Post-production tracking", "Pipeline status", "Output management"],
        iconKey: "Workflow",
      },
    ],
    whyConsolidated:
      "Versant runs production across 7+ networks (MS NOW, CNBC, Golf Channel, USA Sports, E!, Syfy, Oxygen) plus podcast, plus the DTC outputs launching in 2026, with massive shared studio facilities at Englewood Cliffs and contributing studios in NYC and DC. Today producers, editors, graphics, and studio ops live in disconnected vendor tools — newsroom systems, NLEs, playout, graphics, and archive MAMs (e.g., Avid, Adobe, Amagi).",
    whyCustomBuild:
      "Newsroom systems (e.g., Avid), NLEs (e.g., Adobe Premiere), and playout (e.g., Amagi) are the production tools. AI-MAM platforms (e.g., Veritone) search archives. None of them tie all of that to Versant's specific cross-platform packaging (linear + digital + social + DTC + podcast), 7-network studio allocation, or multi-decade archive depth in one operator surface.",
    digitalCore: {
      knowledgeStore: "Versant Production Knowledge Graph (assets, rundowns, archive, projects)",
      identity: "Versant SSO (e.g., Okta) + production-RBAC + on-air break-glass",
      agentRouter:
        "Production Workbench dispatcher routes plan/cue/browse/package/allocate/track intents.",
      auditLog:
        "Production change and on-air event audit trail — every cue, every archive pull, every clip ship recorded for FCC and rights-substantiation purposes.",
      integrations: [
        "Newsroom system (e.g., Avid)",
        "NLE (e.g., Adobe Premiere)",
        "Playout platform (e.g., Amagi)",
        "Archive AI (e.g., Veritone)",
        "Archive MAM",
        "Graphics platforms",
      ],
    },
    buildEffort: "Heavy custom",
    estimatedDeliveryMonths: 11,
    deliveryPodShape:
      "1 Forge production-tech pod (~7 FTE) + 1 Production product owner (cross-Behnke/Ferrell/Wall) + producer design partner",
    workforceShift:
      "Producers stop juggling six tools and start producing. Editors get archive search instead of phone calls to the librarian. Graphics generates first drafts; designers polish. Studio ops reallocates from one screen.",
    successMetric: "Average package turnaround (concept → multi-platform delivered)",
    rolloutPattern:
      "Pilot one show (e.g., a high-volume MS NOW or CNBC dayparts show) → expand across networks, then post-production pipeline.",
  },

  // ============================================================
  //   PROGRAMMING & DEVELOPMENT WORKBENCH
  // ============================================================
  "programming-dev": {
    id: "programming-dev-workbench",
    towerId: "programming-dev",
    name: "Programming & Development Workbench",
    tagline:
      "Where Rebecca Vazquez-Rhodes, Cort Abraham, and Janice Ferrell schedule 7+ networks, slot FAST channels, and run a live acquisition pipeline.",
    primaryUsers: [
      "Programmers",
      "Scheduling",
      "Content acquisition",
      "Library managers",
      "Development executives",
    ],
    surfaces: [
      {
        id: "schedule",
        verb: "Schedule",
        name: "7-network schedule optimizer",
        description:
          "Schedule optimizer across MS NOW, CNBC, Golf Channel, USA, E!, Syfy, and Oxygen — with the linear declines (-5.4% distribution, -8.9% advertising) and election-cycle / Olympics / golf-major exposure built in.",
        primaryAction:
          "Optimize schedules against the actual revenue and audience trajectory, not last year's grid.",
        poweredByCapabilities: ["Schedule optimization", "Grid planning", "Linear programming"],
        iconKey: "CalendarRange",
      },
      {
        id: "slot-fast",
        verb: "Slot",
        name: "FAST channel programming",
        description:
          "FAST channel programming across Free TV Networks (acquired) and the existing FAST footprint. FAST overlaps with linear library — slotting is non-trivial.",
        primaryAction:
          "Slot the FAST library at parity with linear without cannibalizing the linear ad pool.",
        poweredByCapabilities: ["FAST programming", "Channel scheduling", "Library slotting"],
        iconKey: "Tv",
      },
      {
        id: "acquire",
        verb: "Acquire",
        name: "Content acquisition pipeline",
        description:
          "Pipeline tracker across Free TV Networks (done), Indy Cinema Group (done), StockStory (done), Vox Media (exploring — would add ~40 podcast shows including Pivot, Criminal), plus library deals.",
        primaryAction:
          "See the full acquisition pipeline plus integration runway in one view.",
        poweredByCapabilities: ["Acquisition pipeline", "Deal sourcing", "Diligence tracker"],
        iconKey: "Handshake",
      },
      {
        id: "optimize-library",
        verb: "Optimize",
        name: "Library scheduling",
        description:
          "Library scheduling — Kardashians on-air rights (streaming sold to Hulu, split rights), Oxygen true-crime library, USGA sports library through 2032. Each carries platform restrictions.",
        primaryAction:
          "Run the library against platform restrictions every week without manual cross-referencing of rights schedules.",
        poweredByCapabilities: ["Library scheduling", "Rights-aware programming", "Library yield"],
        iconKey: "Layers",
      },
      {
        id: "reconcile-ratings",
        verb: "Reconcile",
        name: "Ratings ↔ digital reconciliation",
        description:
          "Reconciles declining linear ratings against growing digital audience per brand. Critical for the 81% → 50/50 revenue mix-shift narrative.",
        primaryAction:
          "Quantify the linear ↔ digital trade-off brand-by-brand, week-by-week.",
        poweredByCapabilities: ["Ratings reconciliation", "Audience migration", "Cross-platform reach"],
        iconKey: "LineChart",
      },
      {
        id: "support-greenlight",
        verb: "Support",
        name: "Greenlight decision support",
        description:
          "Greenlight decision support — humans still own greenlight (strategic exercise requiring executive judgment), but the agent surfaces options, comparables, and library-fit analysis.",
        primaryAction:
          "Walk into a greenlight conversation with options, comps, and audience-fit, not a blank deck.",
        poweredByCapabilities: ["Greenlight support", "Comparables analysis", "Development pipeline"],
        iconKey: "Star",
      },
    ],
    whyConsolidated:
      "Programming runs 7+ linear network schedules plus the FAST channel slate plus a live acquisition pipeline (Free TV Networks done, Indy Cinema done, StockStory done, Vox Media exploring) plus the rights-split library complexity (Kardashians on-air vs. Hulu streaming, USGA through 2032). Today scheduling, FAST, acquisition, and library each live in separate tools.",
    whyCustomBuild:
      "Generic schedulers (e.g., Imagine, Wideorbit) handle linear grids. They do not model the Versant rights-split structure (Kardashians on-air vs. Hulu streaming), the FAST library overlap with linear, or the live M&A integration runway. The Workbench plus the Knowledge Graph beneath it is the differentiator.",
    digitalCore: {
      knowledgeStore: "Versant Programming Knowledge Graph (titles, rights, slots, performance, acquisitions)",
      identity: "Versant SSO (e.g., Okta) + programming-RBAC + rights-aware ACLs",
      agentRouter:
        "Programming Workbench dispatcher routes schedule/slot/acquire/optimize/reconcile/support intents.",
      auditLog:
        "Programming-decision audit trail — every schedule change, every greenlight decision, every acquisition note recorded for executive and FCC review.",
      integrations: [
        "Linear scheduler (e.g., Wideorbit, Imagine Programming)",
        "Programming planning (e.g., MediaGenix WHATS'ON)",
        "Rights management system (custom or legacy NBCU)",
        "Ratings + digital analytics (e.g., Nielsen)",
      ],
    },
    buildEffort: "Heavy custom",
    estimatedDeliveryMonths: 10,
    deliveryPodShape:
      "1 Forge eng pod (~6 FTE) + 1 Programming product owner (cross-Vazquez-Rhodes/Abraham/Ferrell) + scheduler design partner",
    workforceShift:
      "Programmers spend less time on rights cross-referencing and more on brand strategy. Scheduling runs continuous optimization. Acquisition tracks integration runway alongside diligence.",
    successMetric: "Audience-weighted slot utilization across linear + FAST",
    rolloutPattern:
      "Pilot one network's grid (e.g., Golf Channel — concentrated library, USGA through 2032 anchor) → expand to all 7 networks, then FAST and acquisition.",
  },
};
