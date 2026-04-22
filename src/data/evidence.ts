import type { EvidenceCluster } from "./types";

// ---------------------------------------------------------------------------
// Feasibility Evidence — 22 clusters covering every P1 AI initiative.
//
// Content sourced verbatim from Cursor_P1_Feasibility_Evidence.md (April 2026
// web research). Every entry is a real, publicly-verifiable reference — a
// named case study, a commercial vendor offering, or an adjacent-industry
// deployment that maps onto the Versant context. Zero fabricated evidence.
//
// Clusters are referenced by initiative / brief via `src/data/evidenceMap.ts`
// and rendered into the "Why we know this works" section on detail pages.
// ---------------------------------------------------------------------------

export const evidenceClusters: EvidenceCluster[] = [
  {
    id: "close-automation",
    label: "Financial Close & Accounting Automation",
    evidence: [
      {
        type: "vendor",
        title: "BlackLine Verity AI — Agentic Financial Close",
        source: "BlackLine (Nasdaq: BL)",
        description:
          "BlackLine launched its Studio360 platform with agentic AI in 2025 — including Matching Agents for intercompany reconciliation, a Variance Anomaly Detection Agent for real-time variance identification, Summarization Agents for financial statement narratives, and Intercompany Predictive Guidance. 4,400+ enterprise customers. Recognised in Forrester's Top AI Use Cases for AR Automation 2025.",
        metric: "Customers report 25-50% reduction in close cycles",
        year: "2025",
      },
      {
        type: "vendor",
        title: "FloQast Close Management with AI",
        source: "FloQast",
        description:
          "Cloud-based close management platform with AI-powered reconciliation, flux analysis, and automated close task management. Used by 3,200+ accounting teams. Specifically built for multi-entity consolidation workflows.",
        metric: "~50% reduction in close checklist management time",
        year: "2025",
      },
      {
        type: "adjacent-use-case",
        title: "G2 Enterprise Users — Automated Reconciliation at Scale",
        source: "G2 Reviews — BlackLine enterprise deployments",
        description:
          "Large media and entertainment companies use BlackLine for automated reconciliation across complex entity structures. Users report automating intercompany reconciliations and reducing the overall financial close cycle; one reviewer noted it 'eliminates spreadsheets and reduces close cycles by 25-50%.'",
        metric: "25-50% close cycle reduction reported by enterprise users",
        year: "2025",
      },
    ],
  },
  {
    id: "treasury-forecasting",
    label: "Cash Flow Forecasting & Treasury",
    evidence: [
      {
        type: "adjacent-use-case",
        title: "Microsoft Treasury — 95% Cash Flow Forecast Accuracy",
        source: "Microsoft CFO Organization",
        description:
          "Microsoft's finance team achieved 95% accuracy on 60-90 day cash flow forecasts using AI time-series models. The approach is directly applicable to Versant's BB- rated debt management where covenant compliance is existential.",
        metric: "95% accuracy on 60-90 day cash flow forecasts",
        year: "2024",
      },
      {
        type: "vendor",
        title: "HighRadius AI-Powered Cash Forecasting",
        source: "HighRadius",
        description:
          "HighRadius offers AI cash flow forecasting that ingests AR/AP data, bank feeds, and market signals to produce rolling forecasts. Used by enterprises managing complex multi-entity cash positions.",
        metric: "90%+ reduction in forecast-to-actual variance",
        year: "2025",
      },
      {
        type: "vendor",
        title: "Kyriba AI Treasury Management",
        source: "Kyriba",
        description:
          "Kyriba's Active Liquidity platform uses ML for cash flow forecasting, with specific modules for covenant compliance monitoring and debt management. Used by companies managing multi-billion-dollar debt facilities.",
        metric: "Automated covenant compliance monitoring with continuous alerting",
        year: "2025",
      },
    ],
  },
  {
    id: "invoice-automation",
    label: "Invoice Automation",
    evidence: [
      {
        type: "vendor",
        title: "Stampli AI Invoice Processing",
        source: "Stampli",
        description:
          "Stampli's Billy-the-Bot AI automates invoice processing — OCR reading, GL coding, 3-way matching, and exception routing. Handles complex media-industry invoices (production crew day rates, equipment rentals, variable-term contracts).",
        metric: "85%+ straight-through processing rate for enterprise clients",
        year: "2025",
      },
      {
        type: "vendor",
        title: "Mineral AI (formerly AppZen) Invoice Automation",
        source: "Mineral AI",
        description:
          "AI-powered invoice processing with audit-grade verification. Uses computer vision and NLP to read invoices, match to POs, and detect duplicates and fraud. Enterprise customers include media and entertainment companies.",
        metric: "80% reduction in manual AP processing time",
        year: "2025",
      },
    ],
  },
  {
    id: "ai-recruiting",
    label: "AI Recruiting & Talent Acquisition",
    evidence: [
      {
        type: "case-study",
        title: "Eaton — 30-40% Recruiting Velocity Gain with Eightfold AI",
        source: "Eightfold AI / Brandon Hall Group webinar",
        description:
          "Eaton (manufacturing, ~15,000 hires/year) implemented Eightfold's Talent Intelligence Platform and achieved 4x growth in talent networks and 30-40% increase in candidate velocity. Double-digit increases across all recruiting metrics. Directly applicable to Versant's hyper-hiring phase during company standup.",
        metric: "30-40% increase in candidate velocity; 4x talent network growth",
        year: "2025",
      },
      {
        type: "case-study",
        title: "Forvia — 3.5x Visitor-to-Applicant Conversion with AI Recruiting",
        source: "Eightfold AI / Forvia case study",
        description:
          "Forvia (automotive supplier) used Eightfold's skills-based AI approach to transform recruiting. Achieved 3.5x increase in career-site visitor-to-applicant conversion and over €100K in savings over two years. Increased both quality and diversity of applicant pool.",
        metric: "3.5x increase in visitor-to-applicant conversion",
        year: "2025",
      },
      {
        type: "vendor",
        title: "Eightfold Talent Intelligence Platform + AI Interviewer",
        source: "Eightfold AI",
        description:
          "Enterprise AI recruiting platform with 1.5B+ talent profiles. In 2025 launched AI Interviewer — autonomous candidate engagement for screening and assessment, working 24/7. Used by enterprises for high-volume hiring during transformation periods.",
        metric: "90% decrease in candidate screening time reported by clients",
        year: "2025",
      },
      {
        type: "vendor",
        title: "Paradox AI (Olivia) — Conversational Interview Scheduling",
        source: "Paradox",
        description:
          "AI assistant that handles interview scheduling, candidate communication, and pre-screening via conversational interface. Eliminates scheduling coordination overhead entirely. Used by enterprises hiring at scale.",
        metric: "Interview scheduling time reduced from days to hours",
        year: "2025",
      },
    ],
  },
  {
    id: "ai-upskilling",
    label: "AI Upskilling & Learning",
    evidence: [
      {
        type: "adjacent-use-case",
        title: "Accenture — AI Upskilling 700,000+ Employees",
        source: "Accenture",
        description:
          "Accenture invested $1B+ in AI training, upskilling its entire workforce on AI tools and methods with personalised learning paths by role and function. Directly relevant — Accenture can bring this methodology to Versant through the Forge Program.",
        metric: "700,000+ employees trained on AI; $1B+ investment",
        year: "2024-2025",
      },
      {
        type: "vendor",
        title: "Degreed AI-Adaptive Learning Platform",
        source: "Degreed",
        description:
          "Enterprise learning platform with AI-personalised skill development paths. Maps employee skills to organisational needs, recommends learning content, and measures skill acquisition. Used by enterprises managing AI-transformation upskilling.",
        metric: "AI-adaptive learning paths personalised by role and skill level",
        year: "2025",
      },
    ],
  },
  {
    id: "audience-identity",
    label: "Audience Identity & Segmentation",
    evidence: [
      {
        type: "vendor",
        title: "LiveRamp Identity Resolution for Media",
        source: "LiveRamp",
        description:
          "LiveRamp's identity infrastructure is used by major media companies to resolve fragmented audience identities across platforms. Enables cross-device, cross-platform audience unification — exactly what Versant needs to connect CNBC, GolfNow, Fandango, and Rotten Tomatoes users into unified profiles.",
        metric: "Industry standard for identity resolution; used by 700+ publishers",
        year: "2025",
      },
      {
        type: "vendor",
        title: "Treasure Data CDP for Media & Entertainment",
        source: "Treasure Data",
        description:
          "Customer Data Platform purpose-built for media companies. Unifies audience data from linear, digital, social, and CRM sources into a single customer view. Supports real-time audience segmentation and activation for ad sales and DTC.",
        metric: "Real-time audience unification across 20+ data source types",
        year: "2025",
      },
      {
        type: "adjacent-use-case",
        title: "Disney / ESPN — Unified Audience Graph Across Properties",
        source: "Disney Advertising",
        description:
          "Disney built a unified audience graph connecting viewers across Disney+, ESPN, Hulu, ABC, and National Geographic — enabling cross-property audience segments for advertisers. The exact model Versant needs for CNBC + MS NOW + GolfNow + Fandango.",
        metric: "Cross-property ad targeting enabling premium CPMs",
        year: "2024-2025",
      },
    ],
  },
  {
    id: "rights-management",
    label: "Content Rights Management",
    evidence: [
      {
        type: "vendor",
        title: "Luminance AI Contract Analysis",
        source: "Luminance",
        description:
          "AI-powered contract analysis platform used by legal teams to review, extract terms, and track obligations across large contract portfolios. Handles complex media licensing agreements including territory, platform, and window restrictions.",
        metric: "50-80% reduction in contract review time",
        year: "2025",
      },
      {
        type: "vendor",
        title: "FilmTrack / Rightsline — Media Rights Management",
        source: "Rightsline",
        description:
          "Purpose-built rights-management platform for media companies — tracks content availability by platform, territory, and window across hundreds of deals. Used by major studios and distributors. Addresses exactly Versant's split-rights challenge (Kardashians: on-air retained, streaming sold to Hulu).",
        metric: "Complete rights lifecycle management for media portfolios",
        year: "2025",
      },
      {
        type: "adjacent-use-case",
        title: "WarnerMedia — AI-Powered Rights Clearance Automation",
        source: "Media industry reporting",
        description:
          "Major media companies including Warner Bros have invested in AI-powered rights-clearance systems that can instantly determine content availability across distribution platforms — the exact capability Versant needs as it adds DTC, FAST, and international distribution paths.",
        metric: "Rights clearance from hours to seconds for known content",
        year: "2024-2025",
      },
    ],
  },
  {
    id: "ai-dev-tools",
    label: "Software Development & DevOps",
    evidence: [
      {
        type: "case-study",
        title: "GitHub Copilot — 90% Fortune 100 Adoption, 55% Task Speed-Up",
        source: "GitHub / Microsoft",
        description:
          "GitHub Copilot reached 20M+ users and 4.7M paid subscribers by early 2026. 90% of Fortune 100 companies have adopted it. Research shows 55.8% faster task completion and 26% increase in completed tasks. Accenture's own enterprise deployment shows 81% of developers install on Day 1.",
        metric: "55% faster task completion; 26% more tasks completed; 84% would not go back",
        year: "2025-2026",
      },
      {
        type: "case-study",
        title: "ZoomInfo — 400+ Developer Copilot Deployment",
        source: "ZoomInfo Engineering",
        description:
          "ZoomInfo deployed GitHub Copilot across 400+ developers with phased evaluation. Achieved 33% suggestion-acceptance rate and 72% developer satisfaction, published in a peer-reviewed paper demonstrating enterprise-scale impact.",
        metric: "33% acceptance rate; 72% satisfaction; hundreds of thousands of AI-generated lines in production",
        year: "2025",
      },
      {
        type: "vendor",
        title: "Claude Code / Anthropic Coding Agents",
        source: "Anthropic",
        description:
          "Claude Code provides agentic coding capabilities — not just autocompletion but multi-step code generation, refactoring, and test creation. Represents the next evolution beyond Copilot-style tools.",
        metric: "Agentic coding: handles complete features, not just line suggestions",
        year: "2025-2026",
      },
    ],
  },
  {
    id: "mlops-llmops",
    label: "MLOps & LLM Operations",
    evidence: [
      {
        type: "vendor",
        title: "Databricks MLflow + Unity Catalog for Enterprise MLOps",
        source: "Databricks",
        description:
          "Enterprise ML platform with model registry, experiment tracking, automated training pipelines, and governance. Used by media companies for content recommendation, audience prediction, and ad targeting. Unity Catalog provides AI governance.",
        metric: "Industry-leading MLOps platform; 10,000+ enterprise customers",
        year: "2025",
      },
      {
        type: "vendor",
        title: "LiteLLM / Portkey — LLM Gateway & Cost Management",
        source: "LiteLLM / Portkey",
        description:
          "LLM proxy/gateway that centralises all LLM API calls — routing, caching, cost tracking, and rate limiting. Open source and enterprise versions. Critical for managing LLM costs as agentic AI deploys across 13 towers.",
        metric: "30-40% LLM cost reduction through caching and model routing",
        year: "2025",
      },
      {
        type: "adjacent-use-case",
        title: "Netflix ML Platform — Production ML at Scale for Media",
        source: "Netflix Engineering",
        description:
          "Netflix operates one of the most sophisticated ML platforms in media — powering recommendations, content valuation, and ad targeting. Their published architecture patterns (feature store, model registry, A/B testing) are the reference model for what Versant should build.",
        metric: "ML models power every major Netflix product decision",
        year: "2024-2025",
      },
    ],
  },
  {
    id: "cybersecurity",
    label: "Cybersecurity",
    evidence: [
      {
        type: "vendor",
        title: "CrowdStrike Falcon AI — Endpoint & Threat Detection",
        source: "CrowdStrike",
        description:
          "AI-powered cybersecurity platform used by media companies and news organisations. Charlotte AI provides autonomous threat detection and response. Particularly relevant for high-profile targets like MS NOW and CNBC.",
        metric: "AI detects threats in seconds vs. hours; 90%+ reduction in false positives",
        year: "2025",
      },
      {
        type: "vendor",
        title: "Abnormal Security — AI Email Protection",
        source: "Abnormal Security",
        description:
          "Behavioural AI email security specifically designed to stop sophisticated phishing, BEC attacks, and social engineering. Unlike rule-based systems, it understands normal communication patterns and detects anomalies. Critical for journalists who must accept emails from unknown sources.",
        metric: "Stops 99.5%+ of email attacks with behavioural AI",
        year: "2025",
      },
      {
        type: "vendor",
        title: "Palo Alto XSOAR — Security Orchestration & Auto-Response",
        source: "Palo Alto Networks",
        description:
          "SOAR platform that automates security incident triage — correlates alerts across tools, deduplicates, classifies severity, and executes playbook-based responses. Reduces SOC analyst alert fatigue from thousands of daily alerts to a manageable queue.",
        metric: "80-90% reduction in alerts requiring human review",
        year: "2025",
      },
    ],
  },
  {
    id: "broadcast-ops",
    label: "Broadcast Operations & Master Control",
    evidence: [
      {
        type: "vendor",
        title: "Amagi CLOUDPORT — Cloud Broadcast Automation",
        source: "Amagi",
        description:
          "Cloud-based broadcast automation platform supporting 800+ content brands and 5,000+ channel deliveries in 150+ countries. Includes AI Smart Scheduler, automated playout, FCC compliance logging, and FAST channel management. Expanded NOC in New Jersey specifically for US broadcast operations. NBC Olympics used Amagi for UHD cloud playout.",
        metric: "800+ content brands; 5,000+ channel deliveries; NOC in NJ",
        year: "2025-2026",
      },
      {
        type: "vendor",
        title: "Telestream iQ — AI Broadcast Quality Monitoring",
        source: "Telestream",
        description:
          "Automated broadcast quality monitoring across linear, OTA, FAST, and streaming distribution. AI detects video artefacts, audio issues, captioning problems, and signal degradation in real time across all feeds simultaneously.",
        metric: "Simultaneous monitoring of all distribution feeds with real-time alerting",
        year: "2025",
      },
      {
        type: "adjacent-use-case",
        title: "Amagi + Pac-12 Networks / Fuse Media — FAST Channel Automation",
        source: "Amagi customer case studies",
        description:
          "Amagi powers FAST channel operations for sports and entertainment brands including Pac-12 Networks and Fuse Media. Fuse Media VP: 'We can deliver all our content to Amagi, and they convert it to whatever specs each channel needs.' Directly applicable to Versant's FAST expansion via Free TV Networks acquisition.",
        metric: "Multi-platform FAST delivery automated through single ingest",
        year: "2024-2025",
      },
    ],
  },
  {
    id: "ad-sales",
    label: "Ad Sales & Revenue Optimisation",
    evidence: [
      {
        type: "vendor",
        title: "FreeWheel (Comcast) — Unified Ad Management Platform",
        source: "FreeWheel / Comcast Technology Solutions",
        description:
          "FreeWheel provides unified ad management across linear, digital, OTT, and addressable — including inventory forecasting, yield optimisation, and cross-platform campaign management. Versant already has Comcast-era relationships here. Supports political-ad compliance.",
        metric: "Used by major broadcast networks for cross-platform ad management",
        year: "2025",
      },
      {
        type: "adjacent-use-case",
        title: "NBCU One Platform — Cross-Portfolio Audience Targeting",
        source: "NBCUniversal",
        description:
          "NBCUniversal built One Platform to offer unified audience targeting across its portfolio — the same capability Versant needs to build independently post-TSA. Demonstrates that cross-brand audience segments command premium CPMs from advertisers.",
        metric: "Cross-portfolio ad targeting; premium pricing for unified segments",
        year: "2024-2025",
      },
      {
        type: "vendor",
        title: "Google Ad Manager — AI-Powered Yield Optimisation",
        source: "Google",
        description:
          "Google Ad Manager uses ML for real-time yield optimisation across all ad inventory types — programmatic, direct, FAST. Dynamic floor pricing and demand forecasting. Used by major publishers and broadcasters.",
        metric: "ML-powered dynamic pricing optimises yield in real time",
        year: "2025",
      },
    ],
  },
  {
    id: "dtc-paywall",
    label: "DTC Paywall & Conversion",
    evidence: [
      {
        type: "case-study",
        title: "Piano Dynamic Paywall — 20-75% Conversion Increase",
        source: "Piano (1,300+ publishers)",
        description:
          "Piano's AI-powered dynamic paywall balances subscription and ad revenue per pageview. One client saw a 20% increase in paid conversion; another saw 75% increase in visitors converting to subscribers. Clients include The Economist, Hearst, Business Insider, TechCrunch, BBC, and ABC News.",
        metric: "20-75% increase in subscription conversion rates",
        year: "2024-2025",
      },
      {
        type: "case-study",
        title: "The Post and Courier — 57% Paywall Revenue Growth",
        source: "Piano / Post and Courier",
        description:
          "The Post and Courier implemented Piano's dynamic paywall with Ad Revenue Insights, achieving 57% growth in paywall revenue, 17% YoY subscription growth, and 16% increase in ad impressions — proving dynamic paywalls can grow both subscription and ad revenue simultaneously.",
        metric: "57% paywall revenue growth; 17% subscription growth; 16% ad-impression increase",
        year: "2024-2025",
      },
      {
        type: "case-study",
        title: "Fortune Media — 3x Conversion with AI Paywall",
        source: "Piano / Fortune Media",
        description:
          "Fortune Media used Piano Composer to launch a premium digital subscription, achieving 3x increase in conversions through simplified offers and personalised paywall targeting.",
        metric: "3x increase in subscription conversions",
        year: "2024",
      },
    ],
  },
  {
    id: "ai-customer-support",
    label: "AI Customer Support",
    evidence: [
      {
        type: "vendor",
        title: "Intercom Fin AI Agent — Resolution Without Humans",
        source: "Intercom",
        description:
          "Intercom's Fin AI agent resolves customer queries autonomously — handling common questions, processing transactions, managing subscriptions. Can be trained on brand-specific knowledge bases. Used by SaaS and media companies.",
        metric: "Up to 50% of support volume resolved without human agent",
        year: "2025",
      },
      {
        type: "vendor",
        title: "Ada AI Customer Service Platform",
        source: "Ada",
        description:
          "AI-powered customer service that handles conversations across chat, email, and voice. Purpose-built for brands managing multiple product lines — directly applicable to Versant's multi-brand support (CNBC Pro, GolfNow, Fandango, MS NOW DTC).",
        metric: "70%+ automated resolution rate for enterprise clients",
        year: "2025",
      },
      {
        type: "adjacent-use-case",
        title: "Klarna AI Assistant — Two-Thirds of Customer Chats Automated",
        source: "Klarna",
        description:
          "Klarna's AI assistant handled 2.3 million conversations in its first month — equivalent to 700 full-time agents — while maintaining customer satisfaction. Demonstrates AI customer support at massive scale for transactional businesses like Fandango.",
        metric: "2.3M conversations/month; equivalent to 700 agents",
        year: "2024",
      },
    ],
  },
  {
    id: "churn-retention",
    label: "Churn Prediction & Subscriber Retention",
    evidence: [
      {
        type: "adjacent-use-case",
        title: "Spotify — ML-Powered Churn Prediction",
        source: "Spotify Engineering",
        description:
          "Spotify uses ML models to predict subscriber churn 30-60 days before cancellation based on listening-behaviour changes — decreased session frequency, reduced playlist creation, less discovery. The same behavioural signals (content consumption, feature usage) apply to CNBC Pro and MS NOW DTC.",
        metric: "Predicts churn weeks before cancellation; enables proactive intervention",
        year: "2024-2025",
      },
      {
        type: "vendor",
        title: "Braze AI-Powered Customer Engagement",
        source: "Braze",
        description:
          "Customer engagement platform with AI-powered churn prediction, personalised lifecycle messaging, and automated retention campaigns. Used by media and subscription companies including streaming services.",
        metric: "AI-triggered retention campaigns across email, push, in-app",
        year: "2025",
      },
      {
        type: "adjacent-use-case",
        title: "The New York Times — Data-Driven Subscriber Retention",
        source: "NYT / industry reporting",
        description:
          "The New York Times built sophisticated subscriber retention models that predict churn based on content-engagement patterns and trigger personalised interventions. Their DTC model (10M+ subscribers) is the benchmark for news-publisher retention.",
        metric: "10M+ digital subscribers with industry-leading retention rates",
        year: "2024-2025",
      },
    ],
  },
  {
    id: "ai-newsroom",
    label: "AI News Content Generation",
    evidence: [
      {
        type: "case-study",
        title: "Associated Press — 300 → 3,700 Earnings Reports/Quarter via AI",
        source: "Associated Press + Automated Insights",
        description:
          "AP implemented automated journalism using NLG technology to cover corporate earnings, expanding coverage from ~300 to 3,700 earnings reports per quarter — a 12x increase — and freeing journalists for investigative work. This is the exact model for CNBC's market content automation using StockStory.",
        metric: "12x increase in earnings coverage; thousands of AI-generated articles per month",
        year: "2024",
      },
      {
        type: "case-study",
        title: "AP Local News AI Initiative — 5 Newsrooms",
        source: "Associated Press",
        description:
          "AP helped 5 local newsrooms develop AI tools — KSAT-TV (automated transcripts from press conferences), Brainerd Dispatch (police blotter stories), El Vocero (automated weather content), Michigan Radio (city-council transcription). All demonstrate 'human-led, AI-powered' newsroom workflows.",
        metric: "5 newsroom implementations; transcription, content generation, and weather",
        year: "2024-2025",
      },
      {
        type: "case-study",
        title: "70% of Newsroom Staff Using Gen AI (AP Survey 2024)",
        source: "AP / Poynter",
        description:
          "AP study found nearly 70% of newsroom staffers are already using generative AI for social media posts, newsletters, headlines, translation, transcription, and story drafts. One-fifth used it for multimedia content. Demonstrates industry-wide adoption that Versant must match.",
        metric: "70% newsroom AI adoption across social, headlines, transcription, drafts",
        year: "2024",
      },
    ],
  },
  {
    id: "post-production-ai",
    label: "Post-Production & Podcast AI",
    evidence: [
      {
        type: "vendor",
        title: "Descript — Text-Based Video/Audio Editing with AI",
        source: "Descript (7M+ users)",
        description:
          "Descript pioneered text-based media editing — edit video by editing a transcript. 30+ AI tools including auto-editing, filler-word removal, Studio Sound audio enhancement, voice cloning, and AI video generation. Used by The New York Times, NPR, HubSpot, and Al Jazeera.",
        metric: "7M+ users; 60-70% editing-time reduction; used by NYT, NPR, Al Jazeera",
        year: "2025-2026",
      },
      {
        type: "vendor",
        title: "Veritone / GrayMeta — AI Content Indexing for Archives",
        source: "Veritone",
        description:
          "AI-powered media asset management that processes video/audio content — generates transcripts, scene descriptions, face recognition, topic classification — making entire archives searchable. Used by media companies and sports organisations to unlock decades of content.",
        metric: "Entire content archives made searchable by face, topic, speech content",
        year: "2025",
      },
      {
        type: "vendor",
        title: "Deepgram / AssemblyAI — Enterprise AI Transcription",
        source: "Deepgram / AssemblyAI",
        description:
          "Enterprise-grade AI transcription with speaker diarisation, custom vocabulary, and real-time processing. 95%+ accuracy for clear recordings. Critical for podcast production (140M+ MS NOW downloads) and live broadcast captioning.",
        metric: "95%+ accuracy; speaker identification; custom vocabulary support",
        year: "2025",
      },
    ],
  },
  {
    id: "social-content-ai",
    label: "Social Media Content AI",
    evidence: [
      {
        type: "adjacent-use-case",
        title: "AI Video Clip Tools — 5-10x Content Volume at 80-95% Cost Reduction",
        source: "Industry analysis (MarketsandMarkets)",
        description:
          "The AI-video-creation tools market reached $4.2B in 2025 with 342% YoY growth. AI-assisted creators produce 5-10x more video than non-AI counterparts with an 80-95% decrease in per-video production costs. This is the model for MS NOW (8B social views) to multiply clip output.",
        metric: "5-10x content volume; 80-95% cost reduction per video",
        year: "2025",
      },
      {
        type: "vendor",
        title: "Sprinklr Enterprise Social Management with AI",
        source: "Sprinklr",
        description:
          "Enterprise social media management platform supporting multi-brand, multi-platform publishing with AI-optimised scheduling, content recommendations, and analytics. Used by large media companies managing 10+ brand accounts.",
        metric: "Unified management of 30+ social channels across multiple brands",
        year: "2025",
      },
    ],
  },
  {
    id: "cloud-migration",
    label: "Cloud Migration & Cost Optimisation",
    evidence: [
      {
        type: "vendor",
        title: "AWS Migration Hub + Cloud Intelligence Dashboard",
        source: "AWS",
        description:
          "AWS Migration Hub provides automated workload discovery, dependency mapping, and migration-strategy recommendation. Cloud Intelligence Dashboards provide real-time cost visibility. Used by media companies migrating from on-premise broadcast infrastructure to cloud.",
        metric: "Automated workload assessment and migration planning",
        year: "2025",
      },
      {
        type: "vendor",
        title: "CloudHealth / Spot by NetApp — Cloud Cost Optimisation",
        source: "CloudHealth (VMware) / Spot by NetApp",
        description:
          "AI-powered cloud cost management that monitors resources, identifies waste, recommends rightsizing, and automates reserved-instance purchasing. Enterprises report 20-30% cloud cost reduction.",
        metric: "20-30% cloud cost reduction through AI optimisation",
        year: "2025",
      },
    ],
  },
  {
    id: "fast-programming",
    label: "FAST Channel Programming",
    evidence: [
      {
        type: "vendor",
        title: "Amagi Smart Scheduler — AI FAST Channel Programming",
        source: "Amagi (NAB 2025)",
        description:
          "Amagi's Smart Scheduler uses AI/ML to automate FAST channel scheduling by analysing historical viewing patterns and audience engagement metrics. Helps FAST channel owners make data-driven programming decisions. Launched at NAB 2025. Expanded US NOC in New Jersey.",
        metric: "AI-driven scheduling reduces manual workload; optimises content placement",
        year: "2025",
      },
      {
        type: "vendor",
        title: "Wurl — FAST Distribution & Optimisation",
        source: "Wurl",
        description:
          "Wurl's platform distributes FAST channels to all major platforms (Samsung TV+, Roku, Pluto, Tubi) with content-performance analytics and ad-yield optimisation. Used by hundreds of content brands for FAST channel management.",
        metric: "Multi-platform FAST distribution with content-performance optimisation",
        year: "2025",
      },
    ],
  },
  {
    id: "crisis-detection",
    label: "Crisis Detection & Media Intelligence",
    evidence: [
      {
        type: "vendor",
        title: "Dataminr — Real-Time Event & Threat Detection",
        source: "Dataminr",
        description:
          "AI platform that detects breaking events and emerging threats from social media and public data sources 2-6 hours before mainstream media. Used by newsrooms (breaking news) and corporate communications (crisis early warning). Directly applicable to MS NOW's need for both.",
        metric: "Detects events 2-6 hours before mainstream media",
        year: "2025",
      },
      {
        type: "vendor",
        title: "Signal AI — Media Intelligence & Crisis Monitoring",
        source: "Signal AI",
        description:
          "AI-powered media intelligence platform that monitors global media, social, and regulatory sources with real-time sentiment analysis and early warning capabilities. Used by corporate communications teams for crisis detection.",
        metric: "Real-time sentiment monitoring across global media and social sources",
        year: "2025",
      },
    ],
  },
  {
    id: "studio-reallocation",
    label: "Studio Operations — Breaking News Reallocation",
    evidence: [
      {
        type: "adjacent-use-case",
        title: "Broadcast Industry — REMI & Cloud Production Adoption",
        source: "SVG / NAB industry reports",
        description:
          "REMI (Remote Integration Model) production has become the standard for sports and news broadcasters — reducing on-site crew by 30-50% while maintaining quality. Cloud-based production platforms (Grass Valley AMPP, Vizrt Viz Now) enable instant studio reallocation from centralised control rooms.",
        metric: "30-50% on-site crew reduction with REMI; instant cloud-based studio reallocation",
        year: "2025",
      },
      {
        type: "vendor",
        title: "Grass Valley AMPP — Cloud Production Platform",
        source: "Grass Valley",
        description:
          "Agile Media Processing Platform enables cloud-based switching, graphics, and replay. Allows production resources to be reallocated instantly between studios and remote locations — the capability needed for breaking-news reallocation.",
        metric: "Cloud-based production resource reallocation in minutes",
        year: "2025",
      },
    ],
  },
];

export const evidenceClustersById: Map<string, EvidenceCluster> = new Map(
  evidenceClusters.map((c) => [c.id, c]),
);
