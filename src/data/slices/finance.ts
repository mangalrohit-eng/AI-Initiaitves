import type { Tower } from "../types";
import {
  agent,
  digitalCore,
  orchestration,
  processShell,
  role,
  tool,
  workState,
} from "../helpers";

const finClose = processShell("fin-1", "Monthly/Quarterly Financial Close & Consolidation", {
  description:
    "Consolidating financials across Versant's brand portfolio (MS NOW, CNBC, Golf Channel, USA, E!, Syfy, Oxygen, Fandango JV, international JVs), performing intercompany eliminations, revenue recognition across linear/digital/licensing streams, and producing consolidated statements for SEC filing.",
  isAiEligible: true,
  complexity: "High",
  timelineMonths: 12,
  estimatedTimeSavingsPercent: 55,
  estimatedAnnualHoursSaved: 18000,
  currentPainPoints: [
    "Multi-entity consolidation with JV structures (Fandango 75/25, Nikkei CNBC) requires manual adjustments",
    "Revenue recognition across 4 streams (linear distribution $4.09B, advertising $1.58B, platforms $826M, licensing $193M) with different timing rules",
    "Content rights amortization across hundreds of deals with varying terms",
    "Newly independent — no established rhythms, templates, or institutional memory",
    "10-K/10-Q narrative sections require manual drafting under time pressure",
  ],
  work: {
    pre: workState(
      "Manual multi-entity close process with heavy spreadsheet reconciliation, email-based status tracking, and sequential bottlenecks.",
      [
        ["Sub-ledger close for each brand entity", "Finance Analyst", "2-3 days", true],
        ["Intercompany transaction matching and elimination", "Senior Accountant", "1-2 days", true],
        ["Revenue recognition review (linear vs digital vs licensing)", "Revenue Accountant", "2 days", true],
        ["Content rights amortization calculations", "Content Finance Analyst", "1-2 days", true],
        ["JV consolidation (Fandango, Nikkei CNBC)", "Consolidation Manager", "1-2 days", true],
        ["Variance analysis vs prior period and budget", "FP&A Analyst", "2 days", true],
        ["Management reporting package assembly", "FP&A Manager", "1-2 days", true],
        ["SEC narrative drafting (MD&A sections)", "Controller/IR", "3-5 days", true],
      ],
      "12-18 business days",
      25,
      "3-5% requiring restatement or adjustment",
    ),
    post: workState(
      "AI-orchestrated close with automated reconciliation, real-time consolidation, and AI-drafted narratives with human review.",
      [
        [
          "Automated sub-ledger close with AI reconciliation agent",
          "AI Agent + Finance Analyst (review)",
          "4-6 hours",
          false,
        ],
        [
          "AI-matched intercompany eliminations with exception flagging",
          "AI Agent + Senior Accountant (exceptions only)",
          "2-4 hours",
          false,
        ],
        [
          "Rules-based revenue recognition with AI anomaly detection",
          "AI Agent + Revenue Accountant (review)",
          "4 hours",
          false,
        ],
        [
          "AI-calculated content rights amortization with contract parsing",
          "AI Agent + Content Finance (review)",
          "2 hours",
          false,
        ],
        [
          "Automated JV consolidation with ownership waterfall",
          "AI Agent + Consolidation Mgr (review)",
          "2 hours",
          false,
        ],
        [
          "AI-generated variance analysis with root cause narratives",
          "AI Agent + FP&A Analyst (validation)",
          "4 hours",
          false,
        ],
        [
          "Auto-assembled reporting package with AI commentary",
          "AI Agent + FP&A Manager (edit)",
          "4 hours",
          false,
        ],
        ["AI-drafted MD&A with data-linked narratives", "AI Agent + Controller/IR (edit/approve)", "1 day", false],
      ],
      "5-7 business days",
      10,
      "<1% with AI validation checks",
    ),
    keyShifts: [
      "From sequential, bottleneck-prone close to parallel, agent-orchestrated close",
      "From manual reconciliation to AI-matched with exception-based human review",
      "From blank-page narrative drafting to AI-generated first drafts with data linkage",
      "From spreadsheet-based consolidation to real-time multi-entity consolidation",
    ],
  },
  workforce: {
    pre: [
      role("Staff/Senior Accountants", "8-10 FTEs", ["manual reconciliation", "data entry", "email follow-up", "review"], ["Excel", "ERP navigation", "GAAP knowledge"], {
        "manual reconciliation": 40,
        "data entry": 25,
        "email follow-up": 20,
        review: 15,
      }),
      role("FP&A Analysts", "4-6 FTEs", ["variance analysis", "report building", "data gathering", "presentations"], ["Excel modeling", "PowerPoint", "business acumen"], {
        "variance analysis": 35,
        "report building": 30,
        "data gathering": 25,
        presentations: 10,
      }),
      role("Controller/Consolidation", "2-3 FTEs", ["JV consolidation", "intercompany elims", "review", "SEC compliance"], ["technical accounting", "consolidation", "SEC reporting"], {
        "JV consolidation": 30,
        "intercompany elims": 25,
        review: 25,
        "SEC compliance": 20,
      }),
    ],
    post: [
      role(
        "Finance Operations Analyst (upskilled)",
        "4-5 FTEs",
        ["AI output review", "exception handling", "process optimization", "stakeholder communication"],
        ["AI tool management", "data validation", "critical review", "GAAP judgment"],
        {
          "AI output review": 35,
          "exception handling": 25,
          "process optimization": 20,
          "stakeholder communication": 20,
        },
      ),
      role(
        "Strategic FP&A Analyst (upskilled)",
        "3-4 FTEs",
        ["insight generation", "strategic analysis", "AI model tuning", "stakeholder advisory"],
        ["business strategy", "AI prompt engineering", "data storytelling"],
        {
          "insight generation": 40,
          "strategic analysis": 30,
          "AI model tuning": 15,
          "stakeholder advisory": 15,
        },
      ),
      role(
        "AI-Augmented Controller",
        "1-2 FTEs",
        ["AI output governance", "complex judgment calls", "SEC narrative review", "AI system oversight"],
        ["technical accounting", "AI literacy", "regulatory judgment"],
        {
          "AI output governance": 30,
          "complex judgment calls": 30,
          "SEC narrative review": 25,
          "AI system oversight": 15,
        },
      ),
    ],
    keyShifts: [
      "From data processors to data reviewers and exception handlers",
      "From report builders to insight generators and strategic advisors",
      "From manual close warriors to AI close orchestrators",
    ],
    netFTEImpact:
      "5-7 FTEs redeployed from close operations to strategic finance, M&A support, and investor relations",
  },
  workbench: {
    pre: [
      tool("Microsoft Excel / Google Sheets", "Spreadsheet", "Reconciliation, modeling, consolidation workpapers"),
      tool("Legacy ERP (likely SAP or Oracle, inherited from Comcast)", "ERP", "GL, sub-ledgers, journal entries"),
      tool("Email + Shared drives", "Collaboration", "Close status tracking, document sharing"),
      tool("Manual SEC filing tools (EDGAR)", "Compliance", "10-K, 10-Q filing"),
      tool("PowerPoint", "Reporting", "Board and management presentations"),
    ],
    post: [
      tool(
        "AI Close Orchestration Platform (e.g., BlackLine, HighRadius, FloQast with AI)",
        "AI Platform",
        "Automated reconciliation, close task management, AI matching",
      ),
      tool(
        "Cloud ERP with embedded AI (e.g., Oracle Fusion, SAP S/4HANA)",
        "ERP",
        "Real-time consolidation, automated JE, predictive analytics",
      ),
      tool("AI Narrative Generation Tool (custom or Anthropic API)", "AI/Gen AI", "MD&A drafts, variance commentary, earnings script prep"),
      tool("Workiva or similar with AI layer", "Compliance", "Automated SEC filing with data-linked narratives"),
      tool("Real-time dashboarding (Tableau/Power BI with AI insights)", "Analytics", "Live close status, anomaly detection, KPI monitoring"),
      tool("Workflow orchestration (e.g., Agentic framework on LangGraph/CrewAI)", "AI Orchestration", "Multi-agent close automation"),
    ],
    keyShifts: [
      "From spreadsheet-centric to platform-centric with AI layer",
      "From batch-processed ERP to real-time cloud ERP",
      "From manual SEC narrative drafting to AI-assisted with data linkage",
      "From email-based close tracking to automated workflow orchestration",
    ],
  },
  digitalCore: digitalCore({
    requiredPlatforms: [
      {
        platform: "Cloud ERP",
        purpose: "Single source of truth for GL, sub-ledgers, multi-entity consolidation",
        priority: "Critical",
        examples: ["Oracle Fusion Cloud", "SAP S/4HANA Cloud"],
      },
      {
        platform: "AI Close Management Platform",
        purpose: "Automated reconciliation, close task orchestration",
        priority: "Critical",
        examples: ["BlackLine", "FloQast", "HighRadius"],
      },
      {
        platform: "Data Lakehouse",
        purpose: "Centralized financial data for AI model training and analytics",
        priority: "Critical",
        examples: ["Snowflake", "Databricks", "BigQuery"],
      },
      {
        platform: "AI/LLM Platform",
        purpose: "Foundation for agentic AI — narrative generation, anomaly detection, contract parsing",
        priority: "Critical",
        examples: ["Azure OpenAI", "Anthropic API", "AWS Bedrock"],
      },
      {
        platform: "SEC Compliance Platform",
        purpose: "Automated filing, disclosure management",
        priority: "Important",
        examples: ["Workiva", "Donnelley/DFIN"],
      },
    ],
    dataRequirements: [
      "Chart of accounts mapped across all Versant entities including JV structures",
      "Historical financial data (at minimum 3 years for trend analysis, available from Comcast era)",
      "Content rights contract database with structured terms (duration, territory, platform, cost)",
      "Revenue recognition rules engine covering all 4 revenue streams",
      "Intercompany transaction logs with entity-level detail",
    ],
    integrations: [
      "ERP ↔ Close Management Platform (real-time GL feed)",
      "ERP ↔ Data Lakehouse (financial data pipeline)",
      "Content rights database ↔ Amortization engine",
      "AI/LLM Platform ↔ Close Management (narrative generation triggers)",
      "SEC platform ↔ ERP + AI (data-linked filing)",
    ],
    securityConsiderations: [
      "SOX compliance for all automated financial processes",
      "Audit trail for every AI-generated entry or narrative",
      "Role-based access control for multi-entity data",
      "PII protection for compensation data in consolidation",
    ],
    estimatedBuildEffort:
      "9-12 months for full deployment; quick wins (AI narrative drafting, automated reconciliation) in 3-4 months",
  }),
  agents: [
    agent(
      "reconciliation-agent",
      "Reconciliation Agent",
      "Matches transactions across sub-ledgers, identifies discrepancies, proposes adjusting entries",
      "Specialist",
      ["GL extracts", "sub-ledger data", "bank statements", "intercompany logs"],
      ["matched transactions", "exception report", "proposed adjusting JEs"],
      false,
      ["ERP API", "matching algorithm", "anomaly detection model"],
    ),
    agent(
      "consolidation-agent",
      "Consolidation Agent",
      "Performs multi-entity consolidation including JV eliminations, currency translation, ownership waterfalls",
      "Executor",
      ["entity-level trial balances", "intercompany eliminations", "JV ownership structures"],
      ["consolidated trial balance", "elimination entries", "consolidation adjustments"],
      false,
      ["ERP consolidation engine", "ownership rules engine"],
    ),
    agent(
      "variance-analyst-agent",
      "Variance Analyst Agent",
      "Compares actuals to budget/forecast/prior period, identifies material variances, generates root cause hypotheses",
      "Specialist",
      ["consolidated financials", "budget data", "forecast data", "prior period data", "operational KPIs"],
      ["variance report with root causes", "narrative commentary draft", "alert flags for material items"],
      true,
      ["Data lakehouse query", "LLM API", "statistical analysis"],
    ),
    agent(
      "narrative-drafter-agent",
      "Narrative Drafter Agent",
      "Generates MD&A sections, earnings commentary, management reporting narratives linked to underlying data",
      "Specialist",
      ["variance analysis", "KPI trends", "prior period narratives", "SEC disclosure requirements", "market context"],
      ["draft MD&A sections", "earnings script talking points", "board report narrative"],
      true,
      ["LLM API", "RAG over prior filings", "SEC requirements database"],
    ),
    agent(
      "close-orchestrator-agent",
      "Close Orchestrator Agent",
      "Coordinates the overall close process — triggers tasks, monitors status, escalates bottlenecks, enforces sequence",
      "Orchestrator",
      ["close calendar", "task dependencies", "agent status updates", "human approval signals"],
      ["task assignments", "status dashboard updates", "escalation alerts", "close completion report"],
      false,
      ["Workflow engine", "notification system", "close management platform API"],
    ),
    agent(
      "rights-amortization-agent",
      "Rights Amortization Agent",
      "Parses content licensing contracts, calculates amortization schedules, flags expiring rights",
      "Specialist",
      ["content contracts (PDF/structured)", "viewing data", "amortization policy rules"],
      ["amortization schedules", "JE recommendations", "rights expiration alerts"],
      true,
      ["Document parsing/OCR", "LLM API", "amortization engine"],
    ),
  ],
  agentOrchestration: orchestration(
    "Hierarchical",
    "Close Orchestrator Agent coordinates all specialist agents in a dependency-aware sequence. Reconciliation and Rights Amortization run in parallel first, feeding into Consolidation Agent, which feeds Variance Analyst and Narrative Drafter.",
    [
      { from: "close-orchestrator-agent", to: "reconciliation-agent", dataPassed: "close tasks", trigger: "Period end" },
      { from: "close-orchestrator-agent", to: "rights-amortization-agent", dataPassed: "close tasks", trigger: "Period end" },
      {
        from: "reconciliation-agent",
        to: "consolidation-agent",
        dataPassed: "reconciled trial balances",
        trigger: "Reconciliation complete",
      },
      {
        from: "rights-amortization-agent",
        to: "consolidation-agent",
        dataPassed: "amortization entries",
        trigger: "Schedules approved",
      },
      {
        from: "consolidation-agent",
        to: "variance-analyst-agent",
        dataPassed: "consolidated financials",
        trigger: "Consolidation locked",
      },
      {
        from: "variance-analyst-agent",
        to: "narrative-drafter-agent",
        dataPassed: "variance analysis",
        trigger: "Material variances identified",
      },
      {
        from: "narrative-drafter-agent",
        to: "close-orchestrator-agent",
        dataPassed: "draft narratives",
        trigger: "Draft ready for review",
      },
    ],
  ),
});

const finTreasury = processShell("fin-2", "Cash Flow Forecasting & Treasury Management", {
  description:
    "Predicting cash inflows/outflows 30-90 days forward to manage $2.75B debt facility covenants, $1.50/share annual dividend, $1B buyback pacing, and working capital for content investments and M&A pipeline.",
  isAiEligible: true,
  complexity: "Medium",
  timelineMonths: 6,
  estimatedTimeSavingsPercent: 60,
  estimatedAnnualHoursSaved: 8000,
  currentPainPoints: [
    "Advertising revenue is lumpy (election cycles, upfronts, scatter) making cash prediction hard",
    "Content licensing payments are complex with milestone-based triggers",
    "Newly independent — no historical independent cash flow patterns to reference",
    "BB- rating means covenant compliance is existentially important",
    "Multiple cash-generating entities with different seasonal patterns",
  ],
  work: {
    pre: workState(
      "Manual Excel models updated weekly by treasury analysts pulling data from 5+ sources with multi-day lag on actuals.",
      [
        ["Pull AR/AP aging from ERP", "Treasury Analyst", "4-6 hours", true],
        ["Aggregate ad booking pipeline from sales ops", "Treasury Analyst", "3 hours", true],
        ["Model content payment milestones", "Treasury Analyst", "4 hours", true],
        ["Update covenant ratio workbook", "Treasury Manager", "3 hours", true],
        ["Distribute forecast deck to leadership", "Treasury", "2 hours", true],
      ],
      "3-5 day lag on refreshed forecast",
      14,
      "5-8% variance vs actual cash week-4",
    ),
    post: workState(
      "Continuous cash intelligence with agents ingesting operational signals daily and surfacing covenant risk early.",
      [
        ["Stream inflows/outflows from operational systems", "AI Agents + Treasury", "continuous", false],
        ["Generate rolling 90-day forecast with confidence bands", "Treasury Orchestrator Agent", "hourly refresh", false],
        ["Stress scenarios (upfronts, political spend spikes)", "Treasury Analyst + AI", "2 hours", false],
        ["Covenant monitoring with early warning", "Covenant Monitor Agent", "continuous", false],
        ["Executive narrative on liquidity headroom", "Treasury Manager + AI", "1 hour", false],
      ],
      "Same-day actuals ingestion",
      6,
      "<2% variance with continuous recalibration",
    ),
    keyShifts: [
      "From weekly spreadsheet cycles to continuous, agent-fed forecasting",
      "From backward-looking actuals to forward-looking scenario packs",
      "From manual covenant checks to automated guardrails with alerts",
    ],
  },
  workforce: {
    pre: [
      role("Treasury Analysts", "3-4 FTEs", ["data gathering", "model maintenance", "reporting", "ad-hoc requests"], ["Excel", "ERP", "cash positioning"], {
        "data gathering": 35,
        "model maintenance": 25,
        reporting: 25,
        "ad-hoc requests": 15,
      }),
    ],
    post: [
      role("Strategic Treasury Lead", "1-2 FTEs", ["scenario design", "capital allocation", "AI governance", "banking relationships"], ["liquidity analytics", "AI oversight", "debt strategy"], {
        "scenario design": 35,
        "capital allocation": 30,
        "AI governance": 20,
        "banking relationships": 15,
      }),
    ],
    keyShifts: [
      "From spreadsheet operators to liquidity strategists",
      "From reactive updates to proactive risk sensing",
    ],
    netFTEImpact: "2 FTEs redeployed to M&A integration finance and strategic planning",
  },
  workbench: {
    pre: [
      tool("Excel forecasting models", "Spreadsheet", "13-week cash, covenant sensitivities"),
      tool("ERP AR/AP modules", "ERP", "Operational cash components"),
      tool("Email + slide updates", "Collaboration", "Weekly leadership communications"),
    ],
    post: [
      tool("Real-time treasury workstation + AI layer", "AI Platform", "Cash positions, stress tests, alerts"),
      tool("Lakehouse cash signals hub", "Data", "Unified bookings, AP, payroll, debt service feeds"),
      tool("Scenario simulation service", "Analytics", "Macro + portfolio shocks"),
    ],
    keyShifts: [
      "From static workbooks to streaming forecasts",
      "From siloed pulls to unified cash signal fabric",
    ],
  },
  digitalCore: digitalCore({
    requiredPlatforms: [
      {
        platform: "Treasury Management System",
        purpose: "Bank connectivity, cash positioning, payments",
        priority: "Critical",
        examples: ["Kyriba", "GTreasury", "SAP Treasury"],
      },
      {
        platform: "AI Forecasting Service",
        purpose: "Time-series + LLM explanations for anomalies",
        priority: "Critical",
        examples: ["Azure ML", "Databricks Forecasting", "AWS Forecast"],
      },
      {
        platform: "Data Integration Hub",
        purpose: "Normalize revenue and cost cash drivers",
        priority: "Important",
        examples: ["Fivetran", "MuleSoft", "Confluent"],
      },
    ],
    dataRequirements: [
      "AR/AP subledger detail by entity",
      "Ad sales pipeline and scatter/upfront schedules",
      "Content payment milestones and rights schedules",
      "Debt covenant definitions and measurement templates",
    ],
    integrations: ["ERP cash modules ↔ Lakehouse", "Ad sales systems ↔ Forecast agents", "Bank feeds ↔ TMS"],
    securityConsiderations: ["Segregation of duties on cash movements", "Encrypted bank credentials", "Immutable forecast audit trail"],
    estimatedBuildEffort: "4-6 months for integrated forecasting with quick wins on covenant monitoring in 8-10 weeks",
  }),
  agents: [
    agent(
      "cash-inflow-agent",
      "Cash Inflow Predictor Agent",
      "Projects collections from ads, distribution, licensing, and DTC using ML + LLM anomaly explanations",
      "Specialist",
      ["bookings", "subscription billings", "receivables aging"],
      ["inflow curve", "confidence intervals", "narrative drivers"],
      true,
      ["Time-series models", "LLM API", "lakehouse queries"],
    ),
    agent(
      "cash-outflow-agent",
      "Cash Outflow Predictor Agent",
      "Models AP, content payments, payroll, capex, dividends, and buybacks",
      "Specialist",
      ["AP", "content schedules", "payroll", "capex pipeline"],
      ["outflow curve", "risk flags"],
      false,
      ["ERP APIs", "Monte Carlo engine"],
    ),
    agent(
      "covenant-monitor-agent",
      "Covenant Monitor Agent",
      "Continuously checks projected ratios vs thresholds and alerts treasury early",
      "Monitor",
      ["forecast streams", "covenant definitions"],
      ["breach risk timeline", "remediation suggestions"],
      false,
      ["Rules engine", "alerting bus"],
    ),
    agent(
      "treasury-orchestrator-agent",
      "Treasury Orchestrator Agent",
      "Coordinates inflow/outflow agents into a consolidated forecast pack",
      "Orchestrator",
      ["agent outputs", "macro overlays"],
      ["integrated forecast", "exec brief"],
      false,
      ["Workflow engine", "BI publish API"],
    ),
  ],
  agentOrchestration: orchestration(
    "Hub-and-Spoke",
    "Treasury Orchestrator pulls specialist predictors and monitor outputs into a single authoritative forecast.",
    [
      { from: "treasury-orchestrator-agent", to: "cash-inflow-agent", dataPassed: "driver requests", trigger: "Daily refresh" },
      { from: "treasury-orchestrator-agent", to: "cash-outflow-agent", dataPassed: "driver requests", trigger: "Daily refresh" },
      { from: "cash-inflow-agent", to: "covenant-monitor-agent", dataPassed: "projected liquidity", trigger: "Forecast update" },
      { from: "cash-outflow-agent", to: "covenant-monitor-agent", dataPassed: "projected liquidity", trigger: "Forecast update" },
      { from: "covenant-monitor-agent", to: "treasury-orchestrator-agent", dataPassed: "risk signals", trigger: "Threshold evaluation" },
    ],
  ),
});

const finContentRoi = processShell("fin-3", "Content Investment ROI Modeling", {
  description:
    "Evaluating financial returns on programming investments ($2.45B/year) across linear ratings, digital engagement, social amplification, DTC conversion, and licensing value.",
  isAiEligible: true,
  complexity: "High",
  timelineMonths: 15,
  estimatedTimeSavingsPercent: 45,
  estimatedAnnualHoursSaved: 6000,
  currentPainPoints: [
    "Fragmented performance signals across platforms",
    "Manual attribution of value across windows",
    "Slow scenario modeling for greenlights",
  ],
  work: {
    pre: workState(
      "Manual ROI decks assembled from disconnected spreadsheets and weekly data pulls.",
      [
        ["Aggregate performance metrics", "Finance Analyst", "3 days", true],
        ["Build attribution assumptions", "FP&A", "2 days", true],
        ["Scenario modeling in Excel", "Finance Manager", "3 days", true],
        ["Leadership review cycles", "Finance leadership", "2 days", true],
      ],
      "10-14 days per major decision cycle",
      12,
      "High rework when data revisions land",
    ),
    post: workState(
      "Agentic pipeline continuously harmonizes performance data and produces defensible ROI views.",
      [
        ["Auto-harmonize cross-platform metrics", "Aggregator Agent", "continuous", false],
        ["Generate ROI scenarios with confidence bands", "ROI Calculator Agent", "4 hours", false],
        ["Stress-test investment cases", "Predictive Investment Agent", "6 hours", false],
        ["Exec-ready recommendation brief", "Recommendation Agent + Finance", "4 hours", false],
      ],
      "2-3 days for refreshed investment view",
      5,
      "<1% reconciliation breaks with governed data model",
    ),
    keyShifts: [
      "From static spreadsheets to governed analytics products",
      "From lagging indicators to predictive investment guidance",
    ],
  },
  workforce: {
    pre: [
      role("Finance Analysts", "5-6 FTEs", ["data wrangling", "modeling", "presentation support"], ["Excel", "SQL", "storytelling"], {
        "data wrangling": 40,
        modeling: 30,
        "presentation support": 30,
      }),
    ],
    post: [
      role("Investment Analytics Lead", "3-4 FTEs", ["insight review", "governance", "strategic options"], ["data science literacy", "content economics"], {
        "insight review": 40,
        governance: 25,
        "strategic options": 35,
      }),
    ],
    keyShifts: ["From manual stitching to supervised agent outputs"],
    netFTEImpact: "2 FTEs redirected to portfolio optimization and M&A analytics",
  },
  workbench: {
    pre: [tool("Excel ROI models", "Spreadsheet", "Investment cases"), tool("BI exports", "Analytics", "Weekly performance pulls")],
    post: [
      tool("Lakehouse analytics workspace", "Data", "Unified content economics"),
      tool("Attribution + GenAI insight layer", "AI Platform", "Narratives tied to model outputs"),
    ],
    keyShifts: ["From deck factories to insight products"],
  },
  digitalCore: digitalCore({
    requiredPlatforms: [
      {
        platform: "Audience & Content Data Lakehouse",
        purpose: "Unified performance signals for ROI modeling",
        priority: "Critical",
        examples: ["Snowflake", "Databricks"],
      },
      {
        platform: "ML Feature Store",
        purpose: "Consistent features for attribution models",
        priority: "Important",
        examples: ["Tecton", "Feast", "Databricks Feature Store"],
      },
      {
        platform: "LLM Insight Layer",
        purpose: "Narrative explanations for model outputs",
        priority: "Important",
        examples: ["Azure OpenAI", "Anthropic API"],
      },
    ],
    dataRequirements: [
      "Rights-cleared performance feeds by title",
      "Cost amortization schedules tied to productions",
      "Distribution and digital engagement joins",
    ],
    integrations: ["MAM/rights DB ↔ Lakehouse", "Ad sales ↔ performance warehouse", "Finance GL ↔ cost actuals"],
    securityConsiderations: ["Title-level access controls", "Deal confidentiality tagging", "Model governance logs"],
    estimatedBuildEffort: "12-15 months for full attribution fabric; directional ROI in 4-6 months",
  }),
  agents: [
    agent(
      "content-performance-aggregator",
      "Content Performance Aggregator Agent",
      "Pulls ratings, digital, social, DTC, and licensing signals per property",
      "Specialist",
      ["Nielsen feeds", "web analytics", "social APIs", "DTC events"],
      ["harmonized KPI table", "anomaly flags"],
      false,
      ["ETL pipelines", "entity matching"],
    ),
    agent(
      "roi-calculator-agent",
      "ROI Calculator Agent",
      "Applies attribution models for blended ROI across monetization paths",
      "Executor",
      ["harmonized KPI table", "cost actuals"],
      ["ROI curves", "incrementality estimates"],
      false,
      ["Python models", "Spark jobs"],
    ),
    agent(
      "predictive-investment-agent",
      "Predictive Investment Agent",
      "Projects expected returns for proposed content investments",
      "Specialist",
      ["historical ROI", "greenlight attributes", "comps"],
      ["forecast distributions", "risk bands"],
      true,
      ["LLM API", "gradient boosting"],
    ),
    agent(
      "recommendation-agent",
      "Recommendation Agent",
      "Synthesizes scenarios into exec-ready guidance with confidence intervals",
      "Router",
      ["model outputs", "strategic guardrails"],
      ["recommendation memo", "sensitivity tables"],
      true,
      ["LLM API", "governance templates"],
    ),
  ],
  agentOrchestration: orchestration(
    "Pipeline",
    "Aggregator normalizes signals, ROI calculator quantifies value, predictive layer projects forward, recommendation agent packages decisions.",
    [
      { from: "content-performance-aggregator", to: "roi-calculator-agent", dataPassed: "KPI spine", trigger: "Weekly refresh" },
      { from: "roi-calculator-agent", to: "predictive-investment-agent", dataPassed: "ROI history", trigger: "Greenlight request" },
      { from: "predictive-investment-agent", to: "recommendation-agent", dataPassed: "scenarios", trigger: "Decision deadline" },
    ],
  ),
});

const finIr = processShell("fin-4", "Investor Relations & Earnings Cycle Management", {
  description:
    "Managing the earnings calendar, analyst engagement, narrative consistency, and materials for a newly public Versant (NASDAQ: VSNT).",
  isAiEligible: true,
  complexity: "Medium",
  timelineMonths: 6,
  estimatedTimeSavingsPercent: 50,
  estimatedAnnualHoursSaved: 4000,
  currentPainPoints: [
    "Manual assembly of talking points and Q&A",
    "Fragmented sentiment tracking across brokers and social",
    "Tight timelines between close and market messaging",
  ],
  work: {
    pre: workState(
      "Linear document assembly with heavy manual drafting cycles for scripts, Q&A, and peer tables.",
      [
        ["Compile financial results", "IR Analyst", "2 days", true],
        ["Draft earnings script", "IR Lead", "3 days", true],
        ["Build Q&A library", "IR + Finance", "3 days", true],
        ["Peer benchmarking tables", "FP&A", "2 days", true],
      ],
      "10-12 days pre-earnings",
      18,
      "Version drift across drafts",
    ),
    post: workState(
      "Agents assemble first drafts with human editorial control on sensitive disclosures.",
      [
        ["Auto-ingest results + KPI trends", "Data Agents", "4 hours", false],
        ["Generate script + Q&A first drafts", "Earnings Script Agent", "1 day", false],
        ["Simulate analyst questions", "Q&A Prep Agent", "6 hours", false],
        ["Peer benchmarking refresh", "Peer Benchmarking Agent", "4 hours", false],
      ],
      "4-5 days with review loops",
      8,
      "Controlled change management with audit trail",
    ),
    keyShifts: ["From manual drafting to supervised agent drafting", "From static Q&A to dynamic scenario testing"],
  },
  workforce: {
    pre: [role("IR Analysts", "3-4 FTEs", ["deck building", "logistics", "sentiment notes"], ["writing", "Excel", "capital markets"], { "deck building": 40, logistics: 20, "sentiment notes": 40 })],
    post: [role("IR Strategists", "2-3 FTEs", ["narrative judgment", "relationships", "AI governance"], ["disclosure literacy", "AI review"], { "narrative judgment": 45, relationships: 35, "AI governance": 20 })],
    keyShifts: ["From production staff to narrative strategists"],
    netFTEImpact: "1-2 FTEs redeployed to strategic investor targeting and ESG messaging",
  },
  workbench: {
    pre: [tool("PowerPoint + Word", "Productivity", "Materials"), tool("Excel peer comps", "Spreadsheet", "Benchmark tables")],
    post: [
      tool("IR workspace with GenAI", "AI Platform", "Linked narratives to facts"),
      tool("Sentiment intelligence hub", "Analytics", "Broker + social fusion"),
    ],
    keyShifts: ["From static libraries to living intelligence surfaces"],
  },
  digitalCore: digitalCore({
    requiredPlatforms: [
      { platform: "LLM Gateway", purpose: "Controlled drafting with policy filters", priority: "Critical", examples: ["Azure OpenAI", "Anthropic"] },
      { platform: "Document Intelligence", purpose: "Parse filings and broker research", priority: "Important", examples: ["Azure DI", "AWS Textract"] },
    ],
    dataRequirements: ["Earnings models", "Historical scripts", "Peer filings", "Internal KPIs"],
    integrations: ["ERP/EPM ↔ IR workspace", "News sentiment APIs ↔ lakehouse"],
    securityConsiderations: ["MNPI controls", "Document watermarking", "Access tiers"],
    estimatedBuildEffort: "4-6 months for integrated IR copilots",
  }),
  agents: [
    agent("analyst-sentiment-agent", "Analyst Sentiment Tracker Agent", "Monitors brokers, transcripts, and social for tone shifts", "Monitor", ["research PDFs", "transcripts"], ["sentiment heatmap", "risk topics"], true, ["LLM API", "RSS ingest"]),
    agent("earnings-script-agent", "Earnings Script Drafter Agent", "Produces first drafts aligned to disclosure policy", "Specialist", ["financial results", "strategy updates"], ["script draft", "talking points"], true, ["LLM API", "template library"]),
    agent("qa-prep-agent", "Q&A Prep Agent", "Predicts questions and drafts response frameworks", "Specialist", ["peer Q&A", "results"], ["Q&A grid"], true, ["LLM API", "retrieval"]),
    agent("peer-benchmark-agent", "Peer Benchmarking Agent", "Automates comps vs WBD, PARA, FOX, DIS media segments", "Executor", ["public filings", "estimates"], ["benchmark tables"], false, ["data warehouse", "BI tool"]),
  ],
  agentOrchestration: orchestration(
    "Parallel",
    "Sentiment, script, Q&A, and peer agents run in parallel before human consolidation.",
    [
      { from: "analyst-sentiment-agent", to: "earnings-script-agent", dataPassed: "risk topics", trigger: "Pre-earnings" },
      { from: "analyst-sentiment-agent", to: "qa-prep-agent", dataPassed: "risk topics", trigger: "Pre-earnings" },
      { from: "peer-benchmark-agent", to: "earnings-script-agent", dataPassed: "comps", trigger: "Results lock" },
    ],
  ),
});

const finProcurement = processShell("fin-5", "Procurement Optimization & Vendor Management", {
  description:
    "Sourcing, contracting, and vendor performance management across finance-adjacent spend (technology, professional services, marketing services).",
  isAiEligible: true,
  complexity: "Medium",
  timelineMonths: 9,
  estimatedTimeSavingsPercent: 40,
  estimatedAnnualHoursSaved: 5000,
  currentPainPoints: ["Limited spend visibility post-separation", "Manual contract comparisons", "Reactive renewals"],
  work: {
    pre: workState(
      "Email-driven sourcing with manual RFP scoring and spreadsheet tracking.",
      [
        ["Intake request", "Procurement", "1 day", true],
        ["Vendor shortlist", "Category Manager", "2 days", true],
        ["Negotiate terms", "Legal + Procurement", "5 days", true],
      ],
      "10-15 days per moderate purchase",
      9,
      "Inconsistent policy adherence",
    ),
    post: workState(
      "Guided buying with AI-assisted RFx, clause risk scanning, and renewal playbooks.",
      [
        ["Auto-categorize demand", "Intake Agent", "1 hour", false],
        ["Generate RFx with scoring rubric", "Sourcing Agent", "4 hours", false],
        ["Clause risk + savings insights", "Contract Analytics Agent", "4 hours", false],
      ],
      "4-6 days for moderate purchase",
      5,
      "Policy adherence monitored automatically",
    ),
    keyShifts: ["From reactive buying to guided category strategies"],
  },
  workforce: {
    pre: [role("Procurement Coordinators", "4-5 FTEs", ["tactical buying", "vendor admin"], ["negotiation basics", "ERP catalogs"], { "tactical buying": 60, "vendor admin": 40 })],
    post: [role("Category Strategists", "3-4 FTEs", ["supplier innovation", "AI governance"], ["category strategy", "data fluency"], { "supplier innovation": 55, "AI governance": 45 })],
    keyShifts: ["From order takers to value orchestrators"],
    netFTEImpact: "1 FTE reinvested into supplier diversity and sustainability analytics",
  },
  workbench: {
    pre: [tool("Email + spreadsheets", "Collaboration", "RFx tracking"), tool("ERP catalogs", "ERP", "PO execution")],
    post: [
      tool("AI sourcing assistant", "AI Platform", "Guided buying"),
      tool("CLM with risk models", "Compliance", "Clause intelligence"),
    ],
    keyShifts: ["From fragmented inboxes to orchestrated sourcing workflows"],
  },
  digitalCore: digitalCore({
    requiredPlatforms: [
      { platform: "Procure-to-Pay Suite", purpose: "Catalog, approvals, invoicing", priority: "Critical", examples: ["Coupa", "SAP Ariba"] },
      { platform: "CLM", purpose: "Contract lifecycle and obligations", priority: "Important", examples: ["Ironclad", "Icertis"] },
    ],
    dataRequirements: ["Spend taxonomy", "Supplier master", "Contract metadata"],
    integrations: ["ERP ↔ P2P", "CLM ↔ risk models"],
    securityConsiderations: ["Segregation of duties", "Sensitive pricing redaction"],
    estimatedBuildEffort: "6-9 months for integrated sourcing intelligence",
  }),
  agents: [
    agent("intake-router-agent", "Intake Router Agent", "Classifies requests and policy paths", "Router", ["intake forms", "SKUs"], ["routed workflow"], false, ["rules engine"]),
    agent("sourcing-agent", "Sourcing Agent", "Drafts RFx content and supplier outreach", "Specialist", ["requirements", "history"], ["RFx pack", "scorecards"], true, ["LLM API", "P2P API"]),
    agent("contract-analytics-agent", "Contract Analytics Agent", "Flags non-standard clauses and savings opportunities", "Specialist", ["contracts", "benchmarks"], ["risk report"], true, ["CLM API", "LLM"]),
  ],
  agentOrchestration: orchestration(
    "Sequential",
    "Intake routes to sourcing, sourcing feeds contract analytics before award.",
    [
      { from: "intake-router-agent", to: "sourcing-agent", dataPassed: "scoped need", trigger: "Approved intake" },
      { from: "sourcing-agent", to: "contract-analytics-agent", dataPassed: "shortlist + draft MSAs", trigger: "Negotiation stage" },
    ],
  ),
});

export const financeTower: Tower = {
  id: "finance",
  name: "Finance",
  versantLeads: ["Greg Wright", "Andre Hale"],
  accentureLeads: ["Jim Murphy", "Alex Chitticks"],
  description:
    "Financial planning, reporting, treasury, tax, and investor relations for a newly public company managing $6.69B revenue, $2.75B debt, and complex multi-entity structures including Fandango JV (75% with WBD) and Nikkei CNBC JV.",
  currentState:
    "Finance function is being stood up as independent from Comcast. First full-year reporting (FY2025) just completed. Managing SEC compliance as new public company (NASDAQ: VSNT), quarterly earnings, $0.375/share dividend, $1B buyback authorization. Multi-entity consolidation across 7+ brands. Content rights amortization across hundreds of deals. BB- credit rating requires careful debt covenant management.",
  totalProcesses: 5,
  aiEligibleProcesses: 5,
  estimatedAnnualSavingsHours: 41000,
  topOpportunityHeadline: "Financial close automation",
  processes: [finClose, finTreasury, finContentRoi, finIr, finProcurement],
};
