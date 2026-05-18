/**
 * Orchestration Layer — the canonical, hand-authored data architecture,
 * API integration map, cross-cutting AI agents, and governance policies
 * that sit beneath all 14 Tower Workbenches.
 *
 * Why this lives in `src/data/` (not LLM-generated):
 *   - The deck story needs deterministic, executive-grade content. The
 *     strategist LLM's narrative `OrchestrationBlock` (four strings) is
 *     retained as secondary commentary on the cross-tower tab.
 *   - The technical content (named data stores, named integrations,
 *     named cross-cutting agents) is too consequential to regenerate.
 *
 * Voice contract:
 *   - Specific third-party technologies are framed as illustrative
 *     anchors (e.g., "Close orchestration platform (e.g., BlackLine)"),
 *     not prescriptive recommendations. Real vendor names are kept as
 *     anchors so the story stays concrete.
 *   - Versant executives are referenced by role, not by name ("the
 *     CFO" rather than "Anand Kini"). Versant brands themselves
 *     (MS NOW, CNBC, Golf Channel, etc.) stay specific.
 */

import type { OrchestrationLayer } from "./types";

export const ORCHESTRATION_LAYER: OrchestrationLayer = {
  narrative:
    "The Orchestration Layer is the shared data + API + agent fabric every Tower Workbench plugs into. It makes 14 workbenches act like one company instead of 14 silos: one canonical identity across brands, one knowledge graph across content, one event bus across point solutions, and a curated set of cross-cutting agents that work for every tower.",
  whyShared:
    "Versant cannot afford 14 separate identity graphs, 14 audit logs, or 14 entity-resolution agents. The cross-vertical audience profile (CNBC viewer ⇄ GolfNow booker ⇄ Fandango ticket buyer) only exists if identity resolves once at the orchestration layer. The BB- covenant story only holds if Finance, Treasury, and Legal share one financial knowledge graph. The MS NOW editorial standards gate only holds if every editorial workbench routes through the same Standards Compliance Agent. The layer is the unit of leverage.",

  dataArchitecture: [
    {
      id: "versant-identity-graph",
      name: "Versant Identity Graph",
      category: "Identity",
      description:
        "Canonical user and account graph stitching identities across CNBC.com, MS NOW, Golf Channel + GolfNow + GolfPass, USA Network, E!, Syfy, Oxygen, Fandango, Rotten Tomatoes, SportsEngine, podcast platforms, and the DTC subscribers launching in 2026. Resolves a single Versant ID from disparate brand signals and cookie/PII anchors.",
      primaryConsumers: [
        "research-analytics",
        "ad-sales",
        "marketing-comms",
        "service",
        "sales",
      ],
      primaryProducers: [
        "research-analytics",
        "marketing-comms",
        "service",
        "ad-sales",
      ],
      feedsFromPointSolutions: [
        "Identity-graph events (e.g., LiveRamp)",
        "Per-brand authentication events (e.g., Okta, Auth0)",
        "ATS employee-identity events (e.g., Eightfold)",
        "Subscription platform events (e.g., Piano)",
        "GolfNow booking events",
        "Fandango ticketing events",
      ],
      technologyChoice:
        "Graph database (e.g., Neo4j) + Versant identity-resolution service layer (TBD — subject to discovery)",
      iconKey: "Network",
    },
    {
      id: "versant-knowledge-graph",
      name: "Versant Knowledge Graph",
      category: "Knowledge",
      description:
        "Entities for shows, on-air talent, sports events, content licenses, advertisers, vendors, legal entities (7+ corporate + Fandango JV with WBD + Nikkei CNBC JV), and editorial subjects. The single semantic backbone every workbench's 'Ask' surface queries against.",
      primaryConsumers: [
        "legal",
        "editorial-news",
        "production",
        "programming-dev",
        "marketing-comms",
        "ad-sales",
        "research-analytics",
      ],
      primaryProducers: [
        "legal",
        "editorial-news",
        "programming-dev",
        "production",
      ],
      feedsFromPointSolutions: [
        "Legal-AI contract extraction (e.g., Harvey)",
        "Archive AI metadata (e.g., Veritone)",
        "Wikipedia / Wikidata reference",
        "Financial-research feeds (e.g., StockStory)",
        "Internal show + talent rosters",
      ],
      technologyChoice:
        "Knowledge graph (e.g., Neo4j or AWS Neptune) + Versant entity-resolution service (TBD — subject to discovery)",
      iconKey: "Brain",
    },
    {
      id: "versant-content-lake",
      name: "Versant Content Lake",
      category: "Lake",
      description:
        "Multimodal archive — decades of broadcast video, podcast audio, scripts, transcripts, social posts, and digital articles. Object store with per-modality indexes (audio fingerprints, video shot boundaries, transcript text). Today the multi-decade archive is poorly indexed; this is the substrate that fixes it.",
      primaryConsumers: [
        "editorial-news",
        "production",
        "programming-dev",
        "marketing-comms",
        "research-analytics",
      ],
      primaryProducers: [
        "editorial-news",
        "production",
        "operations-technology",
      ],
      feedsFromPointSolutions: [
        "Playout transcripts (e.g., Amagi)",
        "AI audio editing recordings (e.g., Descript)",
        "Speech-to-text events (e.g., Deepgram)",
        "Newsroom project exports (e.g., Avid)",
        "Social post archival",
      ],
      technologyChoice:
        "Object store + table format (e.g., S3 + Iceberg) + per-modality index layer (TBD — subject to discovery)",
      iconKey: "Layers",
    },
    {
      id: "cross-brand-event-bus",
      name: "Cross-Brand Event Bus",
      category: "Event",
      description:
        "Append-only event log. Every point-solution event lands here — close-orchestration reconciliation results, ATS candidate moves, playout telemetry, subscription changes, identity-graph matches (illustrative: BlackLine, Eightfold, Amagi, Piano, LiveRamp). The single source from which derived data and agent triggers are computed.",
      primaryConsumers: "all",
      primaryProducers: "all",
      feedsFromPointSolutions: [
        "Close-orchestration reconciliation events (e.g., BlackLine)",
        "AR-automation payment events (e.g., HighRadius)",
        "ATS events (e.g., Eightfold)",
        "Playout telemetry (e.g., Amagi)",
        "Subscription events (e.g., Piano)",
        "Identity-graph events (e.g., LiveRamp)",
        "Transcript events (e.g., Descript, Deepgram)",
        "ITSM ticket events (e.g., ServiceNow)",
      ],
      technologyChoice: "Event streaming (e.g., Kafka, AWS Kinesis) (TBD — subject to discovery)",
      iconKey: "Workflow",
    },
    {
      id: "versant-vector-store",
      name: "Versant Vector Store",
      category: "Vector",
      description:
        "Embeddings index over the Content Lake and Knowledge Graph. Powers every workbench's semantic search and Q&A surfaces — Legal contract search, Editorial archive search, Production B-roll retrieval, R&A audience description.",
      primaryConsumers: [
        "legal",
        "editorial-news",
        "production",
        "research-analytics",
        "marketing-comms",
      ],
      primaryProducers: [
        "legal",
        "editorial-news",
        "production",
        "programming-dev",
      ],
      feedsFromPointSolutions: [
        "Content Lake assets",
        "Knowledge Graph nodes",
        "Editorial standards corpus",
      ],
      technologyChoice:
        "Vector database (e.g., pgvector, Pinecone) + Versant embedding service (TBD — subject to discovery)",
      iconKey: "Search",
    },
    {
      id: "financial-ledger-hub",
      name: "Financial Ledger Hub",
      category: "Mesh",
      description:
        "Multi-entity ledger reconciliation surface across 7+ Versant legal entities, the Fandango JV (75/25 with WBD), and the Nikkei CNBC JV. Source for the Finance Workbench close + covenant cycle and for Legal's covenant exposure monitoring on the $2.75B BB- debt.",
      primaryConsumers: ["finance", "legal", "sales"],
      primaryProducers: ["finance", "ad-sales", "sales"],
      feedsFromPointSolutions: [
        "Close-orchestration reconciliation results (e.g., BlackLine)",
        "AR-automation payment events (e.g., HighRadius)",
        "ERP journals (e.g., Workday Financials)",
        "Ad sales billing systems",
        "MVPD carriage settlement",
      ],
      technologyChoice:
        "Cloud data platform (e.g., Snowflake) + transformation framework (e.g., dbt) + Versant consolidation layer (TBD — subject to discovery)",
      iconKey: "Vault",
    },
    {
      id: "audit-provenance-log",
      name: "Audit & Provenance Log",
      category: "Catalog",
      description:
        "Immutable record of every workbench action, agent decision, and content publish. SOX, SEC, FCC, and editorial-defense ready. The single source from which any auditor question is answered.",
      primaryConsumers: "all",
      primaryProducers: "all",
      feedsFromPointSolutions: [
        "Every workbench surface action",
        "Every agent decision event",
        "Every standards-gate decision",
        "Every Identity Graph stitch event",
      ],
      technologyChoice:
        "Append-only log on object storage + Versant audit-query service (TBD — subject to discovery)",
      iconKey: "ClipboardCheck",
    },
    {
      id: "versant-feature-store",
      name: "Versant Feature Store",
      category: "Feature",
      description:
        "Online + offline feature store powering predictive models — flight-risk scoring (HR), churn propensity (Service, DTC), content lift (Editorial, R&A), yield optimization (Ad Sales). Decouples model training from inference latency.",
      primaryConsumers: [
        "hr",
        "service",
        "research-analytics",
        "ad-sales",
        "editorial-news",
      ],
      primaryProducers: "all",
      feedsFromPointSolutions: [
        "Cross-Brand Event Bus",
        "Identity Graph",
        "Content Lake",
        "Financial Ledger Hub",
      ],
      technologyChoice: "Feature store (e.g., Feast, Tecton) (TBD — subject to discovery)",
      iconKey: "Database",
    },
  ],

  // -----------------------------------------------------------------
  //   API integrations
  //
  //   `name` reads as a category-led integration ("Close-orchestration
  //   reconciliation results") so the table is meaningful even if a
  //   specific tool isn't picked yet. `pointSolution` carries the
  //   illustrative vendor, rendered in the UI as "Illustrative
  //   vendor: <X>". Together: concrete anchor, not prescriptive pick.
  // -----------------------------------------------------------------
  apiIntegrations: [
    {
      id: "blackline-recon-stream",
      name: "Close-orchestration reconciliation results",
      direction: "ingress",
      pointSolution: "BlackLine",
      workbenchConsumers: ["finance"],
      payloadShape:
        "{ entityId, reconciliationId, status, matched[], exceptions[], asOf }",
      cadence: "event-driven",
      protocol: "Event stream",
      servesDataComponents: ["cross-brand-event-bus", "financial-ledger-hub"],
    },
    {
      id: "highradius-cash-events",
      name: "AR-automation cash application events",
      direction: "ingress",
      pointSolution: "HighRadius",
      workbenchConsumers: ["finance"],
      payloadShape:
        "{ entityId, invoiceId, paymentId, appliedAmount, residualAmount, asOf }",
      cadence: "near-real-time",
      protocol: "Event stream",
      servesDataComponents: ["cross-brand-event-bus", "financial-ledger-hub"],
    },
    {
      id: "eightfold-ats-events",
      name: "AI talent platform — candidate & role events",
      direction: "ingress",
      pointSolution: "Eightfold",
      workbenchConsumers: ["hr"],
      payloadShape:
        "{ candidateId, roleId, stage, matchScore, decision, decidedBy, decidedAt }",
      cadence: "event-driven",
      protocol: "Webhook",
      servesDataComponents: ["cross-brand-event-bus", "versant-feature-store"],
    },
    {
      id: "harvey-contract-extraction",
      name: "Legal-AI contract extraction",
      direction: "ingress",
      pointSolution: "Harvey",
      workbenchConsumers: ["legal"],
      payloadShape:
        "{ contractId, parties[], clauses[], obligations[], renewalDate, extractedAt }",
      cadence: "event-driven",
      protocol: "REST",
      servesDataComponents: ["versant-knowledge-graph", "versant-vector-store"],
    },
    {
      id: "relativity-discovery-events",
      name: "Discovery-platform review events",
      direction: "ingress",
      pointSolution: "RelativityOne",
      workbenchConsumers: ["legal"],
      payloadShape:
        "{ matterId, documentId, reviewState, privilegeFlag, citation, asOf }",
      cadence: "daily",
      protocol: "REST",
      servesDataComponents: ["versant-knowledge-graph"],
    },
    {
      id: "amagi-playout-telemetry",
      name: "Playout platform telemetry",
      direction: "ingress",
      pointSolution: "Amagi",
      workbenchConsumers: ["operations-technology", "production"],
      payloadShape:
        "{ networkId, scheduledItemId, asPlayedItemId, startTime, endTime, signalQuality, insertionStatus }",
      cadence: "real-time",
      protocol: "Event stream",
      servesDataComponents: ["cross-brand-event-bus", "versant-content-lake"],
    },
    {
      id: "deepgram-transcription",
      name: "Speech-to-text transcription events",
      direction: "ingress",
      pointSolution: "Deepgram",
      workbenchConsumers: ["editorial-news", "production"],
      payloadShape:
        "{ assetId, transcript, speakerLabels[], confidence, language, transcribedAt }",
      cadence: "event-driven",
      protocol: "Webhook",
      servesDataComponents: ["versant-content-lake", "versant-vector-store"],
    },
    {
      id: "descript-recording-events",
      name: "AI audio/video editing — recording & edit events",
      direction: "ingress",
      pointSolution: "Descript",
      workbenchConsumers: ["editorial-news", "production"],
      payloadShape:
        "{ projectId, recordingId, version, transcript, exportTargets[], asOf }",
      cadence: "event-driven",
      protocol: "Webhook",
      servesDataComponents: ["versant-content-lake"],
    },
    {
      id: "veritone-archive-metadata",
      name: "Archive-AI metadata",
      direction: "ingress",
      pointSolution: "Veritone",
      workbenchConsumers: ["editorial-news", "production", "programming-dev"],
      payloadShape:
        "{ assetId, faces[], objects[], topics[], spokenText, sentiment, indexedAt }",
      cadence: "near-real-time",
      protocol: "REST",
      servesDataComponents: [
        "versant-content-lake",
        "versant-knowledge-graph",
        "versant-vector-store",
      ],
    },
    {
      id: "liveramp-identity-match",
      name: "Identity-graph match events",
      direction: "ingress",
      pointSolution: "LiveRamp",
      workbenchConsumers: ["research-analytics", "ad-sales", "marketing-comms"],
      payloadShape:
        "{ ramp_id, hashed_pii[], brand_id, matched_segments[], match_confidence, asOf }",
      cadence: "near-real-time",
      protocol: "Event stream",
      servesDataComponents: ["versant-identity-graph", "cross-brand-event-bus"],
    },
    {
      id: "piano-subscription-events",
      name: "Subscription platform lifecycle events",
      direction: "ingress",
      pointSolution: "Piano",
      workbenchConsumers: [
        "marketing-comms",
        "service",
        "research-analytics",
        "ad-sales",
      ],
      payloadShape:
        "{ subscriberId, productId, lifecycleStage, churnRisk, mrr, asOf }",
      cadence: "event-driven",
      protocol: "Webhook",
      servesDataComponents: ["versant-identity-graph", "versant-feature-store"],
    },
    {
      id: "stockstory-analysis",
      name: "Financial-research analysis events",
      direction: "ingress",
      pointSolution: "StockStory",
      workbenchConsumers: ["editorial-news", "research-analytics"],
      payloadShape:
        "{ tickerOrEntity, analysisType, score, narrative, generatedAt }",
      cadence: "event-driven",
      protocol: "REST",
      servesDataComponents: ["versant-knowledge-graph", "versant-vector-store"],
    },
    {
      id: "crowdstrike-security-events",
      name: "Endpoint security events",
      direction: "ingress",
      pointSolution: "CrowdStrike",
      workbenchConsumers: ["tech-engineering", "corp-services"],
      payloadShape:
        "{ assetId, eventType, severity, actor, indicators[], detectedAt }",
      cadence: "real-time",
      protocol: "Event stream",
      servesDataComponents: ["cross-brand-event-bus", "audit-provenance-log"],
    },
    {
      id: "abnormal-security-events",
      name: "Email-security incident events",
      direction: "ingress",
      pointSolution: "Abnormal Security",
      workbenchConsumers: ["tech-engineering", "corp-services"],
      payloadShape:
        "{ incidentId, type, severity, affectedUserId, mailboxImpact, detectedAt }",
      cadence: "event-driven",
      protocol: "Webhook",
      servesDataComponents: ["cross-brand-event-bus", "audit-provenance-log"],
    },
    {
      id: "servicenow-tickets",
      name: "ITSM ticket events",
      direction: "ingress",
      pointSolution: "ServiceNow",
      workbenchConsumers: ["corp-services", "tech-engineering"],
      payloadShape:
        "{ ticketId, category, urgency, ownerGroup, status, slaState, asOf }",
      cadence: "event-driven",
      protocol: "Webhook",
      servesDataComponents: ["cross-brand-event-bus"],
    },
    {
      id: "nielsen-ratings",
      name: "Ratings + carriage panel data",
      direction: "ingress",
      pointSolution: "Nielsen",
      workbenchConsumers: [
        "research-analytics",
        "ad-sales",
        "sales",
        "programming-dev",
      ],
      payloadShape:
        "{ network, daypart, demoSegment, rating, share, audienceSize, asOf }",
      cadence: "daily",
      protocol: "File / blob",
      servesDataComponents: ["versant-identity-graph", "versant-feature-store"],
    },
    {
      id: "docusign-execution",
      name: "e-Signature execution callback",
      direction: "egress",
      pointSolution: "DocuSign",
      workbenchConsumers: ["legal"],
      payloadShape:
        "{ envelopeId, signers[], status, executedAt, downloadUrl }",
      cadence: "event-driven",
      protocol: "Webhook",
      servesDataComponents: ["versant-knowledge-graph", "audit-provenance-log"],
    },
    {
      id: "edgar-filing-submit",
      name: "Regulatory filing submission",
      direction: "egress",
      pointSolution: "EDGAR (SEC filing platform)",
      workbenchConsumers: ["finance", "legal"],
      payloadShape: "{ filingType, filingId, submittedBy, submittedAt, ackId }",
      cadence: "event-driven",
      protocol: "REST",
      servesDataComponents: ["audit-provenance-log"],
    },
    {
      id: "okta-identity",
      name: "Identity provider — access events",
      direction: "bidirectional",
      pointSolution: "Okta",
      workbenchConsumers: "all",
      payloadShape:
        "{ userId, role, group, action, sourceIp, mfaState, asOf }",
      cadence: "real-time",
      protocol: "Event stream",
      servesDataComponents: ["cross-brand-event-bus", "audit-provenance-log"],
    },
    {
      id: "fandango-ticketing",
      name: "Fandango ticketing events",
      direction: "ingress",
      pointSolution: "Fandango",
      workbenchConsumers: ["research-analytics", "service", "ad-sales"],
      payloadShape:
        "{ orderId, theaterId, titleId, customerHash, refundState, asOf }",
      cadence: "real-time",
      protocol: "Event stream",
      servesDataComponents: ["versant-identity-graph", "cross-brand-event-bus"],
    },
    {
      id: "golfnow-bookings",
      name: "GolfNow booking events",
      direction: "ingress",
      pointSolution: "GolfNow",
      workbenchConsumers: ["research-analytics", "service", "ad-sales"],
      payloadShape:
        "{ bookingId, courseId, customerHash, teeTime, status, asOf }",
      cadence: "real-time",
      protocol: "Event stream",
      servesDataComponents: ["versant-identity-graph", "cross-brand-event-bus"],
    },
  ],

  agents: [
    {
      id: "identity-resolution-agent",
      name: "Versant Identity Resolution Agent",
      type: "Specialist",
      role:
        "Stitches a CNBC.com user, a GolfNow booker, a Fandango ticket buyer, an MS NOW DTC subscriber, and an ATS employee record into one canonical Versant identity — and explains the stitch for audit. The single asset that unlocks the cross-portfolio audience story.",
      triggers: [
        "New identity event from the identity graph (e.g., LiveRamp)",
        "New subscriber from MS NOW / CNBC DTC",
        "New GolfNow / Fandango transaction",
        "ATS candidate-to-employee transition (e.g., Eightfold)",
      ],
      outputs: [
        "Canonical Versant ID written to Identity Graph",
        "Stitch-explanation event written to Audit & Provenance Log",
      ],
      servesWorkbenches: "all",
      iconKey: "Network",
    },
    {
      id: "content-classifier-agent",
      name: "Content Classifier Agent",
      type: "Specialist",
      role:
        "Auto-tags every Content Lake asset (broadcast clip, podcast episode, script, social post) against the Knowledge Graph taxonomy. Powers Editorial archive search, Production B-roll search, R&A content scoring, Marketing brand-voice enforcement, and Ad Sales brand-safety scoring.",
      triggers: [
        "New asset landed in Content Lake",
        "Speech-to-text transcription complete (e.g., Deepgram)",
        "Archive-AI ingest complete (e.g., Veritone)",
        "Editorial standards taxonomy update",
      ],
      outputs: [
        "Tags written to Knowledge Graph",
        "Embeddings written to Vector Store",
      ],
      servesWorkbenches: "all",
      iconKey: "Tags",
    },
    {
      id: "entity-resolution-agent",
      name: "Entity Resolution Agent",
      type: "Specialist",
      role:
        "Reconciles vendor, customer, talent, advertiser, and corporate-entity records across point solutions. The same real-world entity often appears with different names and IDs across the ATS, the close-orchestration platform, and the Legal Knowledge Graph; this agent makes the canonical mapping explicit and auditable.",
      triggers: [
        "New vendor record in any point solution",
        "New advertiser record from Ad Sales",
        "Manual reconciliation request from any workbench",
      ],
      outputs: [
        "Canonical entity written to Knowledge Graph",
        "Aliasing record written for cross-system lookups",
      ],
      servesWorkbenches: "all",
      iconKey: "GitMerge",
    },
    {
      id: "cross-workbench-router",
      name: "Cross-Workbench Intent Router",
      type: "Router",
      role:
        "Routes a user intent in one workbench to the right point solution and the right specialist agent. When a Finance lead clicks 'Reconcile,' it routes to the close-orchestration and AR-automation platforms (e.g., BlackLine, HighRadius) and the Reconciliation Agent in parallel; when a Legal lead clicks 'Search,' it routes to legal-AI and discovery platforms (e.g., Harvey, RelativityOne) and the Vector Store search agent.",
      triggers: ["User intent action on any workbench surface"],
      outputs: [
        "Point-solution API call + specialist agent invocation",
        "Combined result returned to workbench with provenance",
      ],
      servesWorkbenches: "all",
      iconKey: "Signpost",
    },
    {
      id: "governance-auditor-agent",
      name: "Governance Auditor Agent",
      type: "Monitor",
      role:
        "Watches every agent decision against the active Governance Policies. Emits a violation event when an agent's output would breach a policy — e.g., an Editorial draft that fails the MS NOW progressive-standards check, a Finance disclosure that fails a SOX control, an HR comp recommendation that fails pay-equity bounds.",
      triggers: ["Every agent decision event on the Event Bus"],
      outputs: [
        "Pass / violation event written to Audit & Provenance Log",
        "Escalation routed to policy enforcer when violation detected",
      ],
      servesWorkbenches: "all",
      iconKey: "Eye",
    },
    {
      id: "standards-compliance-agent",
      name: "Editorial Standards Compliance Agent",
      type: "Monitor",
      role:
        "The Versant editorial standards framework, encoded and enforced. Reviews every AI-drafted Editorial output against MS NOW progressive-positioning rules and CNBC business-neutrality rules. Blocks publish when confidence is below threshold; routes to standards staff.",
      triggers: [
        "Editorial Workbench draft event",
        "Marketing Workbench public-facing draft event",
      ],
      outputs: [
        "Pass / hold decision routed back to the originating workbench",
        "Standards reasoning written to Audit & Provenance Log",
      ],
      servesWorkbenches: ["editorial-news", "marketing-comms"],
      iconKey: "ShieldCheck",
    },
    {
      id: "covenant-monitor-agent",
      name: "Covenant Monitor Agent",
      type: "Monitor",
      role:
        "Watches the Financial Ledger Hub against the $2.75B BB- debt covenant package. Forecasts months-to-breach under stressed revenue paths and emits an alert before the leadership team would otherwise see the risk.",
      triggers: [
        "Financial Ledger Hub update event",
        "Materially changed revenue forecast",
        "Material acquisition or buyback action",
      ],
      outputs: [
        "Covenant headroom forecast written to Finance Workbench",
        "Alert event to the CFO's office when headroom < threshold",
      ],
      servesWorkbenches: ["finance", "legal", "sales"],
      iconKey: "ShieldAlert",
    },
    {
      id: "broadcast-anomaly-agent",
      name: "Broadcast Anomaly Agent",
      type: "Monitor",
      role:
        "Watches playout telemetry across 7+ networks for off-air conditions, commercial-insertion errors, and signal-quality drift. Cross-references with the schedule and the ad pool to size impact in seconds.",
      triggers: ["Playout-platform telemetry events (e.g., Amagi)"],
      outputs: [
        "Anomaly event to Operations & Technology Workbench",
        "Makegood obligation event to Ad Sales Workbench",
      ],
      servesWorkbenches: ["operations-technology", "ad-sales", "production"],
      iconKey: "Radar",
    },
  ],

  governance: [
    {
      id: "editorial-ai-gate",
      name: "Editorial AI Gate",
      description:
        "Every AI-drafted editorial output passes through human review by standards staff before publish, per the Versant editorial standards framework. 'Human-led, AI-powered' is the published editorial AI philosophy.",
      enforcedBy:
        "Head of Editorial Standards (MS NOW) + Editorial Standards Compliance Agent",
      appliesTo: [
        "Editorial & News Workbench (all surfaces)",
        "Marketing & Communications Workbench (public-facing surfaces)",
      ],
      iconKey: "Newspaper",
    },
    {
      id: "sox-sec-audit-trail",
      name: "SOX / SEC Audit Trail",
      description:
        "Versant is in its first reported year as NASDAQ: VSNT. Every Finance Workbench decision, journal entry, and disclosure is logged immutably with full provenance. SEC Form 10-Q, 10-K, and 8-K filings are sourced from the trail.",
      enforcedBy: "CFO/COO + Governance Auditor Agent",
      appliesTo: [
        "Finance Workbench (all surfaces)",
        "Legal & Business Affairs Workbench (Comply, Track M&A)",
      ],
      iconKey: "ScrollText",
    },
    {
      id: "fcc-broadcast-compliance",
      name: "FCC Broadcast Compliance",
      description:
        "FCC obligations across the 7+ linear networks (including ownership reporting, public file requirements, and political-advertising disclosure). Every Operations & Technology Workbench airing decision logs to the trail.",
      enforcedBy:
        "CISO + Head of Editorial Standards + Governance Auditor Agent",
      appliesTo: [
        "Operations & Technology Workbench",
        "Programming & Development Workbench",
        "Ad Sales Workbench (political advertising)",
      ],
      iconKey: "Tv",
    },
    {
      id: "ccpa-gdpr-pii",
      name: "PII / CCPA Enforcement",
      description:
        "Cross-brand identity stitching never leaves PII unencrypted at rest or in motion. CCPA delete requests propagate to every brand identity record. GDPR scoping for any international audience surface (Nikkei CNBC JV).",
      enforcedBy: "CISO + Identity Resolution Agent",
      appliesTo: [
        "Research & Analytics Workbench",
        "Marketing & Communications Workbench",
        "Ad Sales Workbench",
        "Service Workbench",
      ],
      iconKey: "Lock",
    },
    {
      id: "ai-model-risk-review",
      name: "AI Model Risk Review",
      description:
        "Every new AI agent or model that goes live is reviewed against the emerging AI regulation surface (state-level, federal, and EU) and the Versant editorial standards. Model-card maintained in the Knowledge Graph.",
      enforcedBy:
        "General Counsel + Chief Product & Technology Officer (News) + Governance Auditor Agent",
      appliesTo: [
        "Every Tower Workbench",
        "Every cross-cutting Orchestration Agent",
      ],
      iconKey: "ClipboardCheck",
    },
  ],

  buildEffort: "Heavy custom",
  estimatedDeliveryMonths: 12,
  podShape:
    "1 Forge data-engineering pod (~8 FTE) + 1 platform / agent pod (~6 FTE) + 1 governance / audit pod (~3 FTE), plus product owners drawn from the CIO's office, the CPTO (News), and the CFO's office",
};
