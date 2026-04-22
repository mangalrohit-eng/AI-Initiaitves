import type {
  AiPriority,
  TowerProcess,
  TowerProcessCriticality,
  TowerProcessFrequency,
  TowerProcessMaturity,
  WorkCategory,
} from "./types";

// Compact row helper: [id, name, frequency, criticality, maturity, aiEligible,
//   priority|undefined, rationale, aiInitiativeId|undefined, relation|undefined]
type Row = [
  string,
  string,
  TowerProcessFrequency,
  TowerProcessCriticality,
  TowerProcessMaturity,
  boolean,
  AiPriority | undefined,
  string,
  string | undefined,
  TowerProcess["aiInitiativeRelation"] | undefined,
];

function p(row: Row): TowerProcess {
  const [id, name, frequency, criticality, currentMaturity, aiEligible, aiPriority, aiRationale, aiInitiativeId, aiInitiativeRelation] = row;
  return {
    id,
    name,
    frequency,
    criticality,
    currentMaturity,
    aiEligible,
    aiPriority,
    aiRationale,
    aiInitiativeId,
    aiInitiativeRelation,
  };
}

const P1: AiPriority = "P1 — Immediate (0-6mo)";
const P2: AiPriority = "P2 — Near-term (6-12mo)";
const P3: AiPriority = "P3 — Medium-term (12-24mo)";

// --- FINANCE ---------------------------------------------------------------
const finance: WorkCategory[] = [
  {
    id: "fin-reporting",
    name: "Financial Reporting & Close",
    description:
      "Producing accurate, timely financial statements for SEC filing, management reporting, and board governance — including multi-entity consolidation across Versant's brand portfolio and JV structures.",
    icon: "FileSpreadsheet",
    processes: [
      p(["fin-rep-1", "Monthly/Quarterly Financial Close & Consolidation", "Monthly", "Mission-critical", "Manual", true, P1, "Highest-volume, most time-intensive finance process. AI close automation delivers 55% time savings. Multi-entity complexity (Fandango JV, Nikkei CNBC JV) makes this ideal for AI orchestration.", "fin-1", "primary"]),
      p(["fin-rep-2", "Content Rights Amortization", "Monthly", "High", "Manual", true, P1, "Hundreds of content deals with varying terms. AI contract parsing + automated amortization calculation. Part of close automation initiative.", "fin-1", "sub-process"]),
      p(["fin-rep-3", "Revenue Recognition (4 streams)", "Monthly", "Mission-critical", "Semi-automated", true, P2, "Rules-based with exceptions. AI handles standard recognition, flags complex scenarios (bundled deals, variable consideration) for human judgment.", "fin-1", "sub-process"]),
      p(["fin-rep-4", "Intercompany Eliminations", "Monthly", "High", "Manual", true, P1, "High-volume matching exercise across 7+ entities. Perfect for AI transaction matching.", "fin-1", "sub-process"]),
      p(["fin-rep-5", "SEC Narrative Drafting (MD&A, 10-K/10-Q)", "Quarterly", "Mission-critical", "Manual", true, P2, "AI generates first drafts linked to financial data. Human review and judgment essential for SEC liability.", "fin-1", "sub-process"]),
      p(["fin-rep-6", "Statutory & Tax Reporting", "Quarterly", "High", "Manual", false, undefined, "Low volume, high complexity, heavy judgment. Better addressed through specialized tax software than agentic AI.", undefined, undefined]),
      p(["fin-rep-7", "External Audit Support", "Quarterly", "High", "Manual", false, undefined, "Fundamentally human interaction with auditors. AI helps via better documentation (from close automation) but isn't a standalone initiative.", undefined, undefined]),
      p(["fin-rep-8", "Board Reporting Package", "Quarterly", "High", "Manual", true, P2, "AI assembles and auto-populates board decks from consolidated financial data and KPIs.", "fin-1", "sub-process"]),
    ],
  },
  {
    id: "fin-treasury",
    name: "Treasury & Capital Management",
    description:
      "Managing Versant's $1.09B cash position, $2.75B debt facility, $1.50/share annual dividend, and $1B share repurchase program — ensuring liquidity, covenant compliance, and optimal capital allocation.",
    icon: "Landmark",
    processes: [
      p(["fin-tr-1", "Cash Flow Forecasting (30-90 day)", "Daily", "Mission-critical", "Manual", true, P1, "BB- rating makes covenant compliance existential. AI time-series forecasting with 95%+ accuracy. Ad revenue lumpiness (elections, upfronts) makes this especially valuable.", "fin-2", "primary"]),
      p(["fin-tr-2", "Debt Covenant Monitoring", "Continuous", "Mission-critical", "Manual", true, P1, "AI continuously checks projected ratios against covenant thresholds, alerts 30+ days before potential breach.", "fin-2", "sub-process"]),
      p(["fin-tr-3", "Dividend & Buyback Execution", "Quarterly", "High", "Semi-automated", false, undefined, "Low frequency, involves board decisions and market timing judgment. Standard treasury operations.", undefined, undefined]),
      p(["fin-tr-4", "Banking & Cash Management", "Daily", "High", "Semi-automated", false, undefined, "Largely automated through banking platforms. Marginal AI value.", undefined, undefined]),
      p(["fin-tr-5", "Foreign Exchange Management", "Monthly", "Medium", "Manual", false, undefined, "Limited international exposure currently (Nikkei CNBC JV). May become P3 if international revenue grows.", undefined, undefined]),
    ],
  },
  {
    id: "fin-fpa",
    name: "Planning & Analysis",
    description:
      "Budgeting, forecasting, variance analysis, and strategic financial modeling to support management decision-making across all Versant brands and corporate functions.",
    icon: "TrendingUp",
    processes: [
      p(["fin-fpa-1", "Content Investment ROI Modeling", "Continuous", "High", "Manual", true, P2, "$2.45B programming spend needs rigorous ROI measurement across all platforms. AI models cross-platform content value (linear + digital + social + DTC + licensing).", "fin-3", "primary"]),
      p(["fin-fpa-2", "Annual Budget & Long-Range Plan", "Annual", "High", "Manual", false, undefined, "Annual cadence, heavy strategic judgment, executive negotiation. AI assists indirectly through better data (from other initiatives) but not a standalone AI initiative.", undefined, undefined]),
      p(["fin-fpa-3", "Monthly Forecast Updates", "Monthly", "High", "Manual", true, P2, "AI-powered rolling forecasts that self-adjust based on actuals. Feeds into cash flow forecasting.", "fin-2", "related"]),
      p(["fin-fpa-4", "Variance Analysis & Commentary", "Monthly", "High", "Manual", true, P1, "AI auto-generates variance analysis with root cause hypotheses. Core deliverable of the close automation initiative.", "fin-1", "sub-process"]),
      p(["fin-fpa-5", "Ad Hoc Strategic Analysis", "Event-driven", "High", "Manual", false, undefined, "One-off analyses requiring creative business thinking. AI can assist as a tool but isn't an agentic workflow.", undefined, undefined]),
    ],
  },
  {
    id: "fin-ir",
    name: "Investor Relations",
    description:
      "Managing Versant's relationship with the investment community — earnings cycles, analyst relations, shareholder communications, and market positioning as a newly public company.",
    icon: "Users",
    processes: [
      p(["fin-ir-1", "Earnings Preparation & Execution", "Quarterly", "Mission-critical", "Manual", true, P2, "AI drafts earnings scripts, predicts analyst questions, generates Q&A prep. High-value for a newly public company learning the rhythm.", "fin-4", "primary"]),
      p(["fin-ir-2", "Analyst & Investor Engagement", "Continuous", "High", "Manual", false, undefined, "Relationship-driven. AI can prepare briefs but the conversations are fundamentally human.", undefined, undefined]),
      p(["fin-ir-3", "Peer Benchmarking", "Monthly", "Medium", "Manual", true, P2, "AI auto-generates peer comparison dashboards (vs. WBD, Paramount, Fox Corp, Disney media).", "fin-4", "sub-process"]),
      p(["fin-ir-4", "Shareholder Communications", "Quarterly", "High", "Manual", false, undefined, "Low volume, high-stakes messaging. AI assists in drafting but human judgment controls.", undefined, undefined]),
    ],
  },
  {
    id: "fin-proc",
    name: "Procurement & Vendor Management",
    description:
      "Strategic sourcing and vendor management across production services, technology, talent agencies, facility services, and corporate vendors — transitioning from Comcast master agreements to independent relationships.",
    icon: "ShoppingCart",
    processes: [
      p(["fin-proc-1", "Strategic Sourcing & Vendor Selection", "Event-driven", "High", "Manual", true, P2, "AI vendor matching based on capability, performance, price. Especially valuable for high-volume production procurement.", "fin-5", "primary"]),
      p(["fin-proc-2", "Purchase Order Processing", "Daily", "Medium", "Manual", true, P2, "Automated PO creation, approval routing, vendor notification.", "fin-5", "sub-process"]),
      p(["fin-proc-3", "Invoice Processing & 3-Way Matching", "Daily", "High", "Manual", true, P1, "High volume, rule-based. AI matching delivers immediate ROI.", "fin-5", "sub-process"]),
      p(["fin-proc-4", "Spend Analytics & Optimization", "Monthly", "High", "Not yet established", true, P2, "No current visibility into total spend. AI analytics is foundational for cost optimization post-Comcast separation.", "fin-5", "sub-process"]),
      p(["fin-proc-5", "Vendor Performance Management", "Quarterly", "Medium", "Not yet established", true, P3, "Build vendor scorecard system with AI-tracked KPIs. Lower priority until vendor base stabilizes.", "fin-5", "sub-process"]),
      p(["fin-proc-6", "Contract Renewals & Negotiations", "Event-driven", "High", "Manual", false, undefined, "Negotiation is human-driven. AI provides data (from spend analytics) but the process itself is relationship-based.", undefined, undefined]),
    ],
  },
];

// --- HR --------------------------------------------------------------------
const hr: WorkCategory[] = [
  {
    id: "hr-ta",
    name: "Talent Acquisition",
    description:
      "Recruiting at scale during company standup — sourcing, screening, interviewing, and hiring across every function while competing with Disney, Netflix, WBD, and tech companies for talent.",
    icon: "UserPlus",
    processes: [
      p(["hr-ta-1", "Job Posting & Sourcing", "Continuous", "High", "Manual", true, P1, "AI-powered sourcing from multiple platforms, personalized outreach. Critical during hyper-hiring phase.", "hr-1", "primary"]),
      p(["hr-ta-2", "Resume Screening & Candidate Scoring", "Continuous", "High", "Manual", true, P1, "High volume of applications for visible media brands. AI screening dramatically reduces time-to-shortlist.", "hr-1", "sub-process"]),
      p(["hr-ta-3", "Interview Scheduling & Coordination", "Continuous", "Medium", "Manual", true, P1, "AI scheduling agent eliminates coordination overhead. Quick win.", "hr-1", "sub-process"]),
      p(["hr-ta-4", "Candidate Assessment & Selection", "Event-driven", "High", "Manual", false, undefined, "Requires human judgment on culture fit, role suitability. AI provides structured data but hiring decisions are human.", undefined, undefined]),
      p(["hr-ta-5", "Offer Management & Negotiation", "Event-driven", "High", "Manual", false, undefined, "High-touch, relationship-critical. AI can benchmark compensation but negotiation is human.", undefined, undefined]),
      p(["hr-ta-6", "Employer Brand & Recruitment Marketing", "Continuous", "Medium", "Not yet established", false, undefined, "Important for Versant brand building but better addressed by marketing team than agentic AI.", undefined, undefined]),
    ],
  },
  {
    id: "hr-onb",
    name: "Employee Onboarding & Experience",
    description:
      "Integrating new hires into Versant's culture, systems, and workflows — critical for a company where nearly every employee is 'new' as the organization stands up.",
    icon: "Smile",
    processes: [
      p(["hr-onb-1", "Pre-boarding & Day 1 Setup", "Per hire", "High", "Manual", true, P1, "AI orchestrates IT provisioning, system access, equipment, training assignment. High volume during standup.", "hr-2", "primary"]),
      p(["hr-onb-2", "Onboarding Journey & Training", "Per hire", "High", "Manual", true, P1, "Personalized onboarding paths by role, location, and tower.", "hr-2", "sub-process"]),
      p(["hr-onb-3", "Buddy/Mentor Matching", "Per hire", "Medium", "Not yet established", true, P2, "AI matching based on role, location, interests. Lower effort, nice value-add for culture building.", "hr-2", "sub-process"]),
      p(["hr-onb-4", "Employee Engagement Surveys", "Quarterly", "Medium", "Not yet established", false, undefined, "Standard survey tools suffice. AI value is in analysis (covered under Workforce Planning).", undefined, undefined]),
      p(["hr-onb-5", "Exit Interviews & Offboarding", "Per departure", "Medium", "Manual", false, undefined, "Low volume relative to hiring. Human conversation more valuable than automated process.", undefined, undefined]),
    ],
  },
  {
    id: "hr-tm",
    name: "Talent Management & Development",
    description:
      "Performance management, career development, succession planning, and learning programs — with special emphasis on AI upskilling across the entire workforce.",
    icon: "GraduationCap",
    processes: [
      p(["hr-tm-1", "On-Air Talent Performance Analysis & ROI", "Continuous", "High", "Manual", true, P2, "Unique to media. AI correlates host performance with ratings, social engagement, ad demand, DTC conversion. Informs multi-million-dollar talent contracts.", "hr-3", "primary"]),
      p(["hr-tm-2", "AI Upskilling & Learning Programs", "Continuous", "High", "Not yet established", true, P1, "Foundational for entire transformation. Every tower's AI adoption depends on workforce AI literacy.", "hr-5", "primary"]),
      p(["hr-tm-3", "Performance Reviews & Calibration", "Semi-annual", "High", "Not yet established", false, undefined, "Requires manager judgment, human conversation. AI can aggregate data but the review process is human.", undefined, undefined]),
      p(["hr-tm-4", "Succession Planning", "Annual", "High", "Not yet established", false, undefined, "Strategic exercise involving executive judgment. Low frequency, high judgment.", undefined, undefined]),
      p(["hr-tm-5", "Career Pathing", "Continuous", "Medium", "Not yet established", true, P3, "AI-recommended career paths based on skills, interests, and organizational needs. Build after skills infrastructure matures.", "hr-5", "related"]),
    ],
  },
  {
    id: "hr-cb",
    name: "Compensation & Benefits",
    description:
      "Designing and administering compensation structures, benefits programs, and equity plans for Versant's workforce — including high-value on-air talent contracts.",
    icon: "DollarSign",
    processes: [
      p(["hr-cb-1", "Compensation Benchmarking", "Semi-annual", "High", "Manual", false, undefined, "Uses market survey data (Radford, Mercer). Standard tools sufficient.", undefined, undefined]),
      p(["hr-cb-2", "Payroll Processing", "Bi-weekly", "Mission-critical", "Semi-automated", false, undefined, "Already automated through payroll provider (ADP, Workday). Marginal AI value.", undefined, undefined]),
      p(["hr-cb-3", "Benefits Administration", "Continuous", "High", "Semi-automated", false, undefined, "Standard HRIS functionality. Low complexity relative to AI investment.", undefined, undefined]),
      p(["hr-cb-4", "Talent Contract Negotiation (On-Air)", "Event-driven", "Mission-critical", "Manual", false, undefined, "Multi-million-dollar negotiations. Fundamentally human. AI data from Talent ROI initiative supports but doesn't automate.", undefined, undefined]),
    ],
  },
  {
    id: "hr-wsa",
    name: "Workforce Strategy & Analytics",
    description:
      "Strategic workforce planning, organizational design, and people analytics for a rapidly scaling company navigating simultaneous standup and AI transformation.",
    icon: "BarChart3",
    processes: [
      p(["hr-wsa-1", "Strategic Workforce Planning & Scenario Modeling", "Quarterly", "High", "Not yet established", true, P2, "AI-powered headcount modeling with AI adoption scenarios. Critical for planning how many people Versant needs as AI is deployed across towers.", "hr-4", "primary"]),
      p(["hr-wsa-2", "Attrition Prediction & Retention", "Continuous", "High", "Not yet established", true, P2, "AI scoring for flight risk. Especially important during transition when employees are deciding whether to stay with Versant.", "hr-4", "sub-process"]),
      p(["hr-wsa-3", "Organizational Design", "Event-driven", "High", "Manual", false, undefined, "Strategic exercise requiring executive judgment and change management expertise.", undefined, undefined]),
      p(["hr-wsa-4", "Diversity & Inclusion Analytics", "Quarterly", "Medium", "Not yet established", false, undefined, "Important but standard analytics tools suffice. Not a standalone AI initiative.", undefined, undefined]),
    ],
  },
];

// --- RESEARCH & ANALYTICS --------------------------------------------------
const research: WorkCategory[] = [
  {
    id: "ra-am",
    name: "Audience Measurement & Identity",
    description:
      "Measuring and understanding Versant's audience across all touchpoints — linear TV, digital, social, podcasts, Fandango, Rotten Tomatoes, GolfNow, SportsEngine — and building a unified identity graph.",
    icon: "ScanFace",
    processes: [
      p(["ra-am-1", "Cross-Platform Identity Resolution", "Continuous", "Mission-critical", "Not yet established", true, P1, "THE foundational data initiative. Connects fragmented audience profiles across all Versant properties. Every other AI initiative is better with unified identity.", "ra-1", "primary"]),
      p(["ra-am-2", "Linear Audience Measurement (Nielsen)", "Daily", "High", "Semi-automated", false, undefined, "Nielsen provides the measurement. Versant consumes it. Not an internal AI opportunity.", undefined, undefined]),
      p(["ra-am-3", "Digital Audience Measurement", "Daily", "High", "Semi-automated", true, P1, "Part of unified measurement — connecting web analytics across brands into single view.", "ra-1", "sub-process"]),
      p(["ra-am-4", "Social Audience Measurement", "Daily", "Medium", "Manual", true, P2, "AI aggregation of social metrics across 10+ brands and 5+ platforms.", "ra-1", "sub-process"]),
      p(["ra-am-5", "Podcast Audience Measurement", "Weekly", "Medium", "Semi-automated", true, P2, "Critical if Vox Media acquisition proceeds. Need cross-podcast audience understanding.", "ra-1", "sub-process"]),
      p(["ra-am-6", "Privacy & Consent Management", "Continuous", "Mission-critical", "Not yet established", false, undefined, "CCPA/GDPR compliance. Requires specialized privacy tooling, not agentic AI (though Privacy Compliance Agent supports).", undefined, undefined]),
    ],
  },
  {
    id: "ra-cp",
    name: "Content Performance Analytics",
    description:
      "Measuring content performance across all platforms and formats to inform programming, editorial, and investment decisions.",
    icon: "Activity",
    processes: [
      p(["ra-cp-1", "Real-Time Content Performance Dashboards", "Continuous", "High", "Manual", true, P2, "AI-powered real-time analytics with anomaly detection — flags over/under-performing content as it happens.", "ra-2", "primary"]),
      p(["ra-cp-2", "Content Attribution Modeling", "Monthly", "High", "Not yet established", true, P2, "Connects content to business outcomes (subscriptions, ad revenue, social amplification). Critical for content ROI.", "ra-2", "sub-process"]),
      p(["ra-cp-3", "Audience Segmentation & Profiling", "Weekly", "High", "Manual", true, P1, "AI builds dynamic audience segments from unified data. Powers both ad sales and DTC personalization.", "ra-1", "sub-process"]),
      p(["ra-cp-4", "Post-Mortem / Post-Event Analysis", "Event-driven", "Medium", "Manual", false, undefined, "Periodic deep dives. AI dashboards provide the data but the analysis is a human strategic exercise.", undefined, undefined]),
    ],
  },
  {
    id: "ra-ci",
    name: "Competitive Intelligence",
    description:
      "Monitoring the competitive landscape — Fox News, CNN, Bloomberg, ESPN, Netflix, streaming competitors — to inform Versant's strategic positioning.",
    icon: "Radar",
    processes: [
      p(["ra-ci-1", "Automated Competitive Monitoring", "Continuous", "Medium", "Manual", true, P2, "AI monitors competitor moves (programming changes, talent moves, ad rate shifts, DTC launches) and generates automated briefs.", "ra-3", "primary"]),
      p(["ra-ci-2", "Social Listening & Brand Sentiment", "Continuous", "Medium", "Manual", true, P2, "AI tracks brand sentiment across social platforms. Especially important for MS NOW given political positioning.", "ra-3", "sub-process"]),
      p(["ra-ci-3", "Market Trend Analysis", "Monthly", "Medium", "Manual", false, undefined, "Strategic synthesis requiring human interpretation. AI feeds provide data, humans derive insight.", undefined, undefined]),
    ],
  },
  {
    id: "ra-ad",
    name: "Ad Sales Research",
    description:
      "Creating advertiser-facing audience insights and packages — critical as Versant builds independent ad sales capability post-NBCU TSA.",
    icon: "PieChart",
    processes: [
      p(["ra-ad-1", "Audience Packaging for Advertisers", "Continuous", "High", "Manual", true, P2, "AI-powered self-serve audience segment builder. Turns 3-7 day manual research into 15-minute automated package.", "ra-4", "primary"]),
      p(["ra-ad-2", "Custom Advertiser Research", "Event-driven", "High", "Manual", true, P2, "AI generates advertiser-specific audience insights and proposals.", "ra-4", "sub-process"]),
      p(["ra-ad-3", "Upfront / Scatter Market Intelligence", "Seasonal", "High", "Manual", false, undefined, "Requires market relationships and real-time intelligence from ad sales team, not automated research.", undefined, undefined]),
      p(["ra-ad-4", "Measurement & Attribution for Advertisers", "Continuous", "High", "Not yet established", true, P3, "Cross-platform ad attribution. Depends on unified data platform maturity.", "ra-4", "related"]),
    ],
  },
];

// --- LEGAL -----------------------------------------------------------------
const legal: WorkCategory[] = [
  {
    id: "leg-rights",
    name: "Content Rights & Intellectual Property",
    description:
      "Managing content licensing, distribution rights, sports rights, and IP across hundreds of deals — the most operationally complex legal function in media.",
    icon: "Shield",
    processes: [
      p(["leg-r-1", "Content Rights Tracking & Compliance", "Continuous", "Mission-critical", "Manual", true, P1, "Highest-value legal AI initiative. Hundreds of deals with varying platform/geography/duration terms. AI parses contracts, tracks rights windows, flags conflicts.", "leg-1", "primary"]),
      p(["leg-r-2", "Rights Availability Queries", "Daily", "High", "Manual", true, P1, "'Can we put this content on our FAST channel?' — answered in seconds vs. hours.", "leg-1", "sub-process"]),
      p(["leg-r-3", "Rights Expiration & Renewal Management", "Monthly", "High", "Manual", true, P1, "AI alerts 90/60/30 days before expiration, generates renewal decision briefs.", "leg-1", "sub-process"]),
      p(["leg-r-4", "Sports Rights Administration (USGA, WNBA, Olympics)", "Event-driven", "Mission-critical", "Manual", true, P2, "Complex platform-specific restrictions. AI tracks compliance.", "leg-1", "sub-process"]),
      p(["leg-r-5", "IP Registration & Protection", "Event-driven", "Medium", "Manual", false, undefined, "Low volume, specialized legal work. Standard IP counsel process.", undefined, undefined]),
    ],
  },
  {
    id: "leg-ct",
    name: "Contracts & Transactions",
    description:
      "Contract lifecycle management for carriage agreements, talent contracts, vendor agreements, content licensing deals, and M&A transactions.",
    icon: "FileText",
    processes: [
      p(["leg-ct-1", "Contract Review & Risk Analysis", "Continuous", "High", "Manual", true, P2, "AI reads contracts, flags non-standard clauses, compares to approved templates. 50-80% reduction in review time.", "leg-2", "primary"]),
      p(["leg-ct-2", "Contract Drafting & Template Management", "Continuous", "Medium", "Manual", true, P3, "AI-assisted drafting from approved clause libraries. Build after contract review AI matures.", "leg-2", "sub-process"]),
      p(["leg-ct-3", "M&A Due Diligence", "Event-driven", "High", "Manual", true, P2, "Active pipeline (Free TV Networks, Vox Media). AI accelerates data room review from weeks to days.", "leg-3", "primary"]),
      p(["leg-ct-4", "Carriage Agreement Negotiation Support", "Event-driven", "Mission-critical", "Manual", false, undefined, "High-stakes negotiation. AI data from Sales tower's MVPD analytics supports, but negotiation is human-led.", undefined, undefined]),
      p(["leg-ct-5", "Talent Contract Administration", "Continuous", "High", "Manual", false, undefined, "High-value, relationship-intensive. AI can track terms (from rights management) but contract admin requires legal judgment.", undefined, undefined]),
    ],
  },
  {
    id: "leg-cg",
    name: "Compliance & Governance",
    description:
      "Regulatory compliance spanning SEC (new public company), FCC (broadcast), emerging AI regulations, and corporate governance.",
    icon: "Scale",
    processes: [
      p(["leg-cg-1", "SEC Compliance Monitoring", "Continuous", "Mission-critical", "Manual", true, P2, "AI monitors disclosure requirements, insider trading windows, material event triggers, filing deadlines. Critical for newly public company.", "leg-4", "primary"]),
      p(["leg-cg-2", "FCC Broadcast Compliance", "Continuous", "Mission-critical", "Semi-automated", true, P2, "AI monitors political advertising rules (critical for MS NOW during elections), children's programming obligations, content standards.", "leg-4", "sub-process"]),
      p(["leg-cg-3", "AI Policy & Governance", "Continuous", "High", "Not yet established", false, undefined, "Policy development is a human-led strategic exercise. The AI governance framework is a deliverable, not an AI-automated process.", undefined, undefined]),
      p(["leg-cg-4", "Regulatory Change Monitoring", "Continuous", "Medium", "Manual", true, P2, "AI tracks regulatory developments (AI regulation, media ownership rules, privacy laws) and assesses Versant impact.", "leg-4", "sub-process"]),
      p(["leg-cg-5", "Corporate Governance & Board Support", "Quarterly", "High", "Manual", false, undefined, "Board-level governance. Low frequency, high judgment, fundamentally human.", undefined, undefined]),
    ],
  },
];

// --- CORPORATE SERVICES ----------------------------------------------------
const corp: WorkCategory[] = [
  {
    id: "corp-fac",
    name: "Facilities & Real Estate",
    description:
      "Managing Versant's physical footprint across NYC HQ, Englewood Cliffs NJ, DC bureau, and distributed remote workforce.",
    icon: "Building2",
    processes: [
      p(["corp-f-1", "Work Order Management & Dispatch", "Daily", "Medium", "Manual", true, P2, "AI triage and routing. Quick win for employee experience.", "corp-1", "primary"]),
      p(["corp-f-2", "Predictive Facilities Maintenance", "Continuous", "High", "Not yet established", true, P2, "IoT + AI predicts HVAC, elevator, generator failures before they impact operations.", "corp-1", "sub-process"]),
      p(["corp-f-3", "Space Optimization & Occupancy Management", "Weekly", "Medium", "Not yet established", true, P2, "AI analyzes occupancy patterns to optimize hybrid workspace.", "corp-1", "sub-process"]),
      p(["corp-f-4", "Energy Management & Sustainability", "Continuous", "Medium", "Manual", true, P3, "AI optimizes energy consumption. Broadcast ops are energy-intensive.", "corp-1", "sub-process"]),
      p(["corp-f-5", "Real Estate Strategy & Lease Management", "Annual", "High", "Manual", false, undefined, "Strategic decisions. DC bureau lease transition is a one-time event. Low frequency.", undefined, undefined]),
      p(["corp-f-6", "Mail & Package Services", "Daily", "Low", "Manual", false, undefined, "Low complexity, low impact. Not worth AI investment.", undefined, undefined]),
    ],
  },
  {
    id: "corp-sec",
    name: "Security",
    description:
      "Physical security, threat intelligence, and access management for a high-profile news organization where journalists and facilities face politically motivated threats.",
    icon: "ShieldAlert",
    processes: [
      p(["corp-s-1", "CCTV & Physical Monitoring", "Continuous", "High", "Manual", true, P2, "AI computer vision for anomaly detection. Reduces passive monitoring, catches threats humans miss.", "corp-2", "primary"]),
      p(["corp-s-2", "Threat Intelligence & Assessment", "Continuous", "Mission-critical", "Manual", true, P1, "MS NOW's progressive positioning makes threat intelligence critical. AI monitors social media and threat databases.", "corp-2", "sub-process"]),
      p(["corp-s-3", "Access Control & Visitor Management", "Daily", "High", "Semi-automated", true, P2, "Automated visitor pre-registration, dynamic access provisioning.", "corp-2", "sub-process"]),
      p(["corp-s-4", "Executive & Talent Protection", "Continuous", "High", "Manual", false, undefined, "Human security officers for physical protection. AI threat intel feeds support but protection is human-delivered.", undefined, undefined]),
      p(["corp-s-5", "Incident Investigation", "Event-driven", "High", "Manual", false, undefined, "Complex, context-dependent investigations. Human-led.", undefined, undefined]),
    ],
  },
  {
    id: "corp-proc",
    name: "Procurement & Vendor Operations",
    description:
      "Corporate procurement, vendor onboarding, and invoice processing for non-content, non-production vendors.",
    icon: "Package",
    processes: [
      p(["corp-p-1", "Vendor Selection & Onboarding", "Event-driven", "Medium", "Manual", true, P2, "AI-guided vendor onboarding with automated document verification.", "corp-3", "primary"]),
      p(["corp-p-2", "Purchase Order Processing", "Daily", "Medium", "Manual", true, P2, "Automated PO creation and approval routing.", "corp-3", "sub-process"]),
      p(["corp-p-3", "Invoice Processing & Payment", "Daily", "High", "Manual", true, P1, "High-volume, rule-based. Immediate ROI from AI 3-way matching.", "corp-3", "sub-process"]),
      p(["corp-p-4", "Spend Analytics", "Monthly", "Medium", "Not yet established", true, P2, "Cross-category spend visibility. First step toward vendor consolidation.", "corp-3", "sub-process"]),
      p(["corp-p-5", "Travel Management", "Event-driven", "Low", "Semi-automated", false, undefined, "Standard travel management platforms handle this. Low AI value-add.", undefined, undefined]),
    ],
  },
];

// --- TECH & ENGINEERING ----------------------------------------------------
const tech: WorkCategory[] = [
  {
    id: "tech-inf",
    name: "Infrastructure & Cloud",
    description:
      "Designing, building, and operating Versant's independent technology infrastructure as the company separates from Comcast's technology stack.",
    icon: "Cloud",
    processes: [
      p(["tech-i-1", "Cloud Infrastructure Provisioning & Management", "Continuous", "Mission-critical", "Not yet established", true, P1, "AI-automated IaC, resource provisioning, configuration management. Foundational for everything else.", "tech-1", "primary"]),
      p(["tech-i-2", "Cloud Cost Optimization", "Continuous", "High", "Not yet established", true, P1, "AI monitors spend, identifies idle resources, recommends rightsizing. Cloud costs escalate fast without governance.", "tech-1", "sub-process"]),
      p(["tech-i-3", "Migration Planning & Execution (from Comcast)", "Event-driven", "Mission-critical", "Manual", true, P1, "AI analyzes legacy workloads, recommends migration strategy per workload. Time-sensitive as TSAs expire.", "tech-1", "sub-process"]),
      p(["tech-i-4", "Disaster Recovery & Business Continuity", "Continuous", "Mission-critical", "Not yet established", false, undefined, "Architectural and procedural. Needs DR design, not agentic AI.", undefined, undefined]),
      p(["tech-i-5", "Network Architecture & Management", "Continuous", "High", "Manual", false, undefined, "Specialized network engineering. Standard tooling sufficient.", undefined, undefined]),
    ],
  },
  {
    id: "tech-se",
    name: "Software Engineering",
    description:
      "Building and maintaining Versant's digital products — CNBC.com, MS NOW digital, DTC platforms, Fandango, Rotten Tomatoes, GolfNow, StockStory integration.",
    icon: "Code",
    processes: [
      p(["tech-se-1", "Code Development & Pair Programming", "Continuous", "High", "Manual", true, P1, "AI code assistants (Claude Code, Copilot) for every developer. 30-50% productivity gain. Fastest ROI of any engineering initiative.", "tech-2", "primary"]),
      p(["tech-se-2", "Code Review & Quality Assurance", "Continuous", "High", "Semi-automated", true, P1, "AI automated PR review for security, style, performance.", "tech-2", "sub-process"]),
      p(["tech-se-3", "Testing & QA Automation", "Continuous", "High", "Semi-automated", true, P1, "AI generates test cases, identifies coverage gaps, runs regression.", "tech-2", "sub-process"]),
      p(["tech-se-4", "CI/CD & Deployment Management", "Continuous", "High", "Semi-automated", true, P2, "AI-managed pipelines with intelligent rollback.", "tech-2", "sub-process"]),
      p(["tech-se-5", "Incident Detection & Response", "Continuous", "Mission-critical", "Manual", true, P2, "AI monitors production, auto-triages incidents, pages with context.", "tech-2", "sub-process"]),
      p(["tech-se-6", "Technical Debt Management", "Continuous", "Medium", "Manual", false, undefined, "Strategic prioritization exercise. AI can identify debt but prioritization requires business context.", undefined, undefined]),
      p(["tech-se-7", "Architecture & Design", "Event-driven", "High", "Manual", false, undefined, "Creative engineering judgment. AI can assist but not automate.", undefined, undefined]),
    ],
  },
  {
    id: "tech-ml",
    name: "AI/ML Platform",
    description:
      "Building the enterprise AI/ML infrastructure that powers ALL AI initiatives across every tower — model development, training, deployment, monitoring, and governance.",
    icon: "Brain",
    processes: [
      p(["tech-ml-1", "ML Platform Operations (MLOps)", "Continuous", "Mission-critical", "Not yet established", true, P1, "THE platform enabler. Every tower's agents run on this. Model registry, training pipelines, deployment, monitoring.", "tech-3", "primary"]),
      p(["tech-ml-2", "LLM Operations & Cost Management", "Continuous", "High", "Not yet established", true, P1, "LLM gateway for cost control, routing, caching. Without this, LLM costs spiral.", "tech-3", "sub-process"]),
      p(["tech-ml-3", "AI Governance & Compliance", "Continuous", "Mission-critical", "Not yet established", true, P2, "Audit trails, model inventory, responsible AI. Critical for editorial AI in newsroom.", "tech-3", "sub-process"]),
      p(["tech-ml-4", "Data Science Enablement", "Continuous", "High", "Not yet established", false, undefined, "Developer experience and tooling. Important but it's infrastructure work, not an agentic AI initiative.", undefined, undefined]),
    ],
  },
  {
    id: "tech-cy",
    name: "Cybersecurity",
    description:
      "Protecting Versant from cyber threats — especially critical for a high-profile news organization that is a target for state-sponsored and politically motivated attacks.",
    icon: "Lock",
    processes: [
      p(["tech-cy-1", "Threat Detection & Monitoring", "Continuous", "Mission-critical", "Not yet established", true, P1, "AI-powered SOC. MS NOW and CNBC are high-value targets. AI detects threats human analysts miss.", "tech-4", "primary"]),
      p(["tech-cy-2", "Incident Triage & Response", "Event-driven", "Mission-critical", "Manual", true, P1, "AI auto-classifies, prioritizes, and routes incidents. Reduces response time from hours to minutes.", "tech-4", "sub-process"]),
      p(["tech-cy-3", "Phishing & Social Engineering Defense", "Continuous", "High", "Manual", true, P1, "AI monitors inbound emails targeting journalists and executives.", "tech-4", "sub-process"]),
      p(["tech-cy-4", "Vulnerability Management", "Continuous", "High", "Semi-automated", true, P2, "AI prioritizes vulnerabilities based on exploitability and business impact.", "tech-4", "sub-process"]),
      p(["tech-cy-5", "Security Compliance & Audit", "Quarterly", "High", "Manual", true, P2, "AI generates audit evidence and tracks control compliance.", "tech-4", "sub-process"]),
      p(["tech-cy-6", "Security Awareness Training", "Quarterly", "Medium", "Not yet established", false, undefined, "Standard training platforms. Not an AI initiative.", undefined, undefined]),
      p(["tech-cy-7", "Identity & Access Management (IAM)", "Continuous", "High", "Semi-automated", false, undefined, "Standard IAM tooling (Okta, Azure AD). Not agentic AI.", undefined, undefined]),
    ],
  },
];

// --- OPERATIONS ------------------------------------------------------------
const ops: WorkCategory[] = [
  {
    id: "ops-mc",
    name: "Master Control & Playout",
    description:
      "Real-time management of on-air content across 7+ linear networks — ensuring correct content, commercials, and promos air with proper formatting, captioning, and compliance.",
    icon: "MonitorPlay",
    processes: [
      p(["ops-mc-1", "Live Playout Monitoring & Management", "Continuous", "Mission-critical", "Semi-automated", true, P1, "AI watches all feeds simultaneously via computer vision. Detects issues humans miss. 50% time savings.", "ops-1", "primary"]),
      p(["ops-mc-2", "Commercial Insertion Execution", "Continuous", "Mission-critical", "Semi-automated", true, P1, "Commercial insertion errors = direct revenue loss. AI ensures accurate execution.", "ops-1", "sub-process"]),
      p(["ops-mc-3", "FCC Compliance Logging", "Continuous", "Mission-critical", "Manual", true, P1, "AI auto-logs all aired content for FCC compliance. Eliminates manual logging entirely.", "ops-1", "sub-process"]),
      p(["ops-mc-4", "Breaking News Pre-emption Management", "Event-driven", "Mission-critical", "Manual", true, P2, "AI coordinates schedule changes across all affected networks when breaking news hits.", "ops-1", "sub-process"]),
      p(["ops-mc-5", "Quality Assurance (video, audio, captioning)", "Continuous", "High", "Manual", true, P1, "AI monitors bitrate, frame rate, audio levels, captioning sync across all feeds.", "ops-1", "sub-process"]),
      p(["ops-mc-6", "Closed Captioning Compliance", "Continuous", "Mission-critical", "Semi-automated", false, undefined, "Handled by captioning vendors with existing automated systems. Marginal additional AI value.", undefined, undefined]),
    ],
  },
  {
    id: "ops-sd",
    name: "Signal Distribution",
    description:
      "Delivering content across all distribution paths — linear cable/satellite, OTA, FAST, DTC streaming, and international — to 126M US households.",
    icon: "Radio",
    processes: [
      p(["ops-sd-1", "Multi-Path Signal Monitoring", "Continuous", "Mission-critical", "Manual", true, P1, "AI monitors ALL distribution paths (linear + OTA + FAST + DTC + international) from single pane of glass.", "ops-2", "primary"]),
      p(["ops-sd-2", "Auto-Failover & Redundancy Management", "Event-driven", "Mission-critical", "Semi-automated", true, P1, "AI detects degradation and routes to backup before viewers notice. Sub-second response.", "ops-2", "sub-process"]),
      p(["ops-sd-3", "FAST Channel Operations", "Continuous", "High", "Manual", true, P2, "AI manages multi-platform FAST channel configuration (Pluto, Tubi, Samsung TV+). Growing complexity with Free TV Networks acquisition.", "ops-2", "sub-process"]),
      p(["ops-sd-4", "International Feed Management", "Daily", "Medium", "Manual", true, P2, "AI handles timezone shifts, metadata localization for Nikkei CNBC JV and European feeds.", "ops-2", "sub-process"]),
      p(["ops-sd-5", "CDN & Streaming Infrastructure", "Continuous", "Mission-critical", "Semi-automated", false, undefined, "CDN management is handled by CDN providers (Akamai, CloudFront). Standard infrastructure.", undefined, undefined]),
      p(["ops-sd-6", "Satellite Transponder Management", "Continuous", "High", "Semi-automated", false, undefined, "Specialized satellite operations. Low volume, stable process.", undefined, undefined]),
    ],
  },
  {
    id: "ops-be",
    name: "Broadcast Engineering",
    description:
      "Maintaining the reliability of broadcast-critical equipment across all Versant facilities. Equipment failure means going off-air.",
    icon: "Wrench",
    processes: [
      p(["ops-be-1", "Predictive Equipment Maintenance", "Continuous", "Mission-critical", "Manual", true, P2, "IoT + ML predicts equipment failures 7-30 days before they happen. Zero-tolerance for unplanned downtime in broadcast.", "ops-3", "primary"]),
      p(["ops-be-2", "Spare Parts Inventory Management", "Continuous", "High", "Manual", true, P2, "AI ensures critical spares always in stock. Auto-reorders with lead time awareness.", "ops-3", "sub-process"]),
      p(["ops-be-3", "Capacity Planning & Upgrades", "Quarterly", "High", "Manual", true, P3, "AI analyzes bandwidth, processing, and storage trends to project upgrade needs.", "ops-2", "sub-process"]),
      p(["ops-be-4", "Equipment Lifecycle Management", "Annual", "Medium", "Manual", false, undefined, "Strategic capital planning. Low frequency. AI provides data but decisions are human.", undefined, undefined]),
      p(["ops-be-5", "Standards & Compliance (SMPTE, etc.)", "Continuous", "Medium", "Manual", false, undefined, "Standards compliance is a design-time concern, not a runtime AI opportunity.", undefined, undefined]),
    ],
  },
];

// --- SALES -----------------------------------------------------------------
const sales: WorkCategory[] = [
  {
    id: "sales-ad",
    name: "Advertising Sales",
    description:
      "Selling advertising inventory across linear, digital, FAST, OTA, DTC, and podcast — the $1.58B revenue stream that Versant must manage independently when the NBCU TSA expires (~2028).",
    icon: "Megaphone",
    processes: [
      p(["sales-ad-1", "Inventory Forecasting & Management", "Continuous", "Mission-critical", "Not yet established", true, P1, "Greenfield build. AI predicts available inventory across all platforms. Foundation for ad sales.", "sales-1", "primary"]),
      p(["sales-ad-2", "Audience Targeting & Segment Creation", "Continuous", "Mission-critical", "Not yet established", true, P1, "AI creates premium cross-brand audience segments. Key differentiator vs. competitors.", "sales-1", "sub-process"]),
      p(["sales-ad-3", "Dynamic Pricing & Yield Optimization", "Continuous", "Mission-critical", "Not yet established", true, P1, "AI sets real-time floor prices based on demand, remaining inventory, time-to-air.", "sales-1", "sub-process"]),
      p(["sales-ad-4", "Campaign Execution & Optimization", "Continuous", "High", "Not yet established", true, P2, "AI optimizes live campaigns across platforms.", "sales-1", "sub-process"]),
      p(["sales-ad-5", "Proposal Generation", "Event-driven", "High", "Not yet established", true, P2, "AI auto-generates advertiser proposals with audience data and pricing.", "sales-1", "sub-process"]),
      p(["sales-ad-6", "Political/Election Ad Management", "Seasonal", "High", "Not yet established", true, P1, "Specialized for midterm/presidential cycles. FCC compliance + demand spike management.", "sales-1", "sub-process"]),
      p(["sales-ad-7", "Upfront Negotiation", "Annual", "Mission-critical", "Manual", false, undefined, "Multi-billion-dollar negotiations. Fundamentally human relationship and judgment. AI data supports.", undefined, undefined]),
      p(["sales-ad-8", "Scatter Market Sales", "Continuous", "High", "Manual", false, undefined, "Opportunistic selling. AI pricing helps but sales execution is human.", undefined, undefined]),
      p(["sales-ad-9", "Programmatic Advertising Operations", "Continuous", "High", "Not yet established", false, undefined, "Handled by ad tech platforms (SSPs, DSPs). Versant configures, platforms execute.", undefined, undefined]),
    ],
  },
  {
    id: "sales-dist",
    name: "Distribution Sales",
    description:
      "Negotiating and managing carriage agreements with MVPDs (cable, satellite, virtual) that generate $4.09B in distribution revenue.",
    icon: "Handshake",
    processes: [
      p(["sales-d-1", "MVPD Analytics & Negotiation Intelligence", "Continuous", "High", "Manual", true, P2, "AI tracks subscriber trends, viewership by MVPD, competitive carriage terms. Data-driven negotiation support.", "sales-2", "primary"]),
      p(["sales-d-2", "Carriage Agreement Negotiation", "Event-driven", "Mission-critical", "Manual", false, undefined, "Multi-year, multi-billion dollar negotiations. Human relationship and executive judgment.", undefined, undefined]),
      p(["sales-d-3", "Affiliate Relations Management", "Continuous", "High", "Manual", false, undefined, "Ongoing relationship management. Human-driven.", undefined, undefined]),
      p(["sales-d-4", "Cord-Cutting Churn Risk Monitoring", "Continuous", "High", "Manual", true, P2, "AI predicts which MVPDs are likely to drop networks. Enables proactive engagement.", "sales-2", "sub-process"]),
    ],
  },
  {
    id: "sales-dtc",
    name: "DTC & Subscription Sales",
    description:
      "Driving subscriber acquisition and conversion for MS NOW, CNBC Pro, GolfPass, and Fandango.",
    icon: "CreditCard",
    processes: [
      p(["sales-dtc-1", "Dynamic Paywall & Conversion Optimization", "Continuous", "High", "Not yet established", true, P1, "AI determines optimal paywall moment and offer per user. Critical for DTC launch success.", "sales-3", "primary"]),
      p(["sales-dtc-2", "Trial-to-Paid Conversion Management", "Continuous", "High", "Not yet established", true, P1, "AI-personalized trial experience and conversion nudges.", "sales-3", "sub-process"]),
      p(["sales-dtc-3", "Pricing & Packaging Optimization", "Monthly", "High", "Not yet established", true, P2, "AI tests pricing, bundles, and packaging.", "sales-3", "sub-process"]),
      p(["sales-dtc-4", "Cross-Brand Upsell & Bundle Sales", "Continuous", "Medium", "Not yet established", true, P2, "AI identifies bundle opportunities (CNBC Pro + GolfPass).", "sales-3", "sub-process"]),
      p(["sales-dtc-5", "DTC Product Strategy", "Quarterly", "High", "Manual", false, undefined, "Strategic product decisions. Human-led with data support.", undefined, undefined]),
    ],
  },
];

// --- MARKETING -------------------------------------------------------------
const marketing: WorkCategory[] = [
  {
    id: "mkt-sm",
    name: "Social Media & Content Distribution",
    description:
      "Managing social media presence across 10+ brands on TikTok, YouTube, Instagram, X, Facebook, Threads — including clip creation, scheduling, and community management.",
    icon: "Share2",
    processes: [
      p(["mkt-sm-1", "Clip Detection & Social Content Creation", "Continuous", "High", "Manual", true, P1, "AI identifies viral-worthy moments from live broadcasts, auto-formats for each platform. MS NOW has 8B social views — AI can multiply output 5-10x.", "mkt-1", "primary"]),
      p(["mkt-sm-2", "Multi-Platform Publishing & Scheduling", "Continuous", "High", "Manual", true, P1, "AI orchestrates posting across all platforms at optimal times.", "mkt-1", "sub-process"]),
      p(["mkt-sm-3", "Community Management & Moderation", "Continuous", "High", "Manual", true, P2, "AI handles first-line moderation at scale. Critical for MS NOW DTC community feature.", "mkt-1", "sub-process"]),
      p(["mkt-sm-4", "Social Analytics & Performance", "Continuous", "Medium", "Manual", true, P2, "Real-time cross-platform social analytics.", "mkt-1", "sub-process"]),
      p(["mkt-sm-5", "Influencer & Creator Partnerships", "Event-driven", "Medium", "Manual", false, undefined, "Relationship-driven. Human outreach and negotiation.", undefined, undefined]),
      p(["mkt-sm-6", "Social Media Strategy", "Monthly", "High", "Manual", false, undefined, "Creative strategy. Human-led.", undefined, undefined]),
    ],
  },
  {
    id: "mkt-pg",
    name: "Performance & Growth Marketing",
    description:
      "Driving subscriber acquisition for DTC products and audience growth across all Versant brands through paid media, CRM, and conversion optimization.",
    icon: "Target",
    processes: [
      p(["mkt-pg-1", "Paid Media Campaign Management", "Continuous", "High", "Manual", true, P1, "AI cross-channel campaign automation. Must be operational before MS NOW DTC launch (summer 2026).", "mkt-2", "primary"]),
      p(["mkt-pg-2", "Creative Generation & Testing", "Continuous", "High", "Manual", true, P1, "AI generates 50-100+ creative variants for multivariate testing.", "mkt-2", "sub-process"]),
      p(["mkt-pg-3", "CRM & Lifecycle Marketing", "Continuous", "High", "Not yet established", true, P2, "AI-personalized email/push/in-app messaging across subscriber lifecycle.", "mkt-2", "sub-process"]),
      p(["mkt-pg-4", "Conversion Rate Optimization", "Continuous", "High", "Manual", true, P2, "AI optimizes landing pages, registration flows, onboarding.", "mkt-2", "sub-process"]),
      p(["mkt-pg-5", "Marketing Budget & Allocation", "Monthly", "High", "Manual", false, undefined, "Strategic decision. AI provides recommendations (from analytics) but budget decisions are executive.", undefined, undefined]),
    ],
  },
  {
    id: "mkt-br",
    name: "Brand Marketing & Events",
    description:
      "Building and managing brand equity across Versant's portfolio — corporate brand, individual channel brands, and major event marketing (elections, Olympics, sports).",
    icon: "Palette",
    processes: [
      p(["mkt-br-1", "Brand Campaign Development", "Quarterly", "High", "Manual", false, undefined, "Creative brand work. Agency and human creative-led.", undefined, undefined]),
      p(["mkt-br-2", "Event Marketing (Elections, Olympics, Sports)", "Seasonal", "High", "Manual", false, undefined, "Event-specific, creative, relationship-driven.", undefined, undefined]),
      p(["mkt-br-3", "Sponsorship & Partnership Management", "Event-driven", "Medium", "Manual", false, undefined, "Relationship-driven business development.", undefined, undefined]),
      p(["mkt-br-4", "Brand Health Tracking", "Monthly", "Medium", "Manual", true, P3, "AI-automated brand tracking across surveys, social, and media. Lower priority.", "mkt-4", "related"]),
    ],
  },
  {
    id: "mkt-pr",
    name: "PR & Corporate Communications",
    description:
      "Press relations, crisis communications, executive visibility, and internal communications for a newly public, high-profile media company.",
    icon: "Newspaper",
    processes: [
      p(["mkt-pr-1", "Media Monitoring & Sentiment Tracking", "Continuous", "High", "Manual", true, P2, "AI real-time monitoring with sentiment analysis. Foundation for crisis detection.", "mkt-3", "primary"]),
      p(["mkt-pr-2", "Crisis Detection & Early Warning", "Continuous", "Mission-critical", "Manual", true, P1, "AI identifies brewing controversies 2-6 hours before mainstream pickup. Critical for MS NOW's political positioning.", "mkt-3", "sub-process"]),
      p(["mkt-pr-3", "Press Release & Statement Drafting", "Event-driven", "High", "Manual", true, P2, "AI first drafts with brand voice and data linkage.", "mkt-3", "sub-process"]),
      p(["mkt-pr-4", "Internal Communications", "Weekly", "High", "Not yet established", true, P2, "AI-personalized internal comms. Critical for culture building during standup.", "mkt-3", "sub-process"]),
      p(["mkt-pr-5", "Executive Thought Leadership", "Monthly", "Medium", "Manual", false, undefined, "Requires CEO/executive voice. Human-crafted.", undefined, undefined]),
      p(["mkt-pr-6", "Media Relations (Proactive)", "Continuous", "High", "Manual", false, undefined, "Journalist relationships. Fundamentally human.", undefined, undefined]),
    ],
  },
  {
    id: "mkt-an",
    name: "Marketing Analytics & Attribution",
    description:
      "Measuring marketing effectiveness across all brands, channels, and campaigns — connecting spend to business outcomes.",
    icon: "LineChart",
    processes: [
      p(["mkt-an-1", "Cross-Brand Marketing Attribution", "Continuous", "High", "Not yet established", true, P2, "AI multi-touch attribution across all brands and channels. No current capability.", "mkt-4", "primary"]),
      p(["mkt-an-2", "Marketing Mix Modeling", "Monthly", "High", "Not yet established", true, P2, "Continuous AI-powered MMM replaces annual agency-run models.", "mkt-4", "sub-process"]),
      p(["mkt-an-3", "Cross-Brand Effect Measurement", "Monthly", "Medium", "Not yet established", true, P3, "Does promoting CNBC on MS NOW drive CNBC subscriptions? Unique Versant question.", "mkt-4", "sub-process"]),
      p(["mkt-an-4", "Campaign Reporting & Dashboards", "Weekly", "Medium", "Manual", false, undefined, "Standard BI dashboards. Not agentic AI.", undefined, undefined]),
    ],
  },
];

// --- SERVICE ---------------------------------------------------------------
const service: WorkCategory[] = [
  {
    id: "svc-sup",
    name: "Customer Support Operations",
    description:
      "Supporting customers across all consumer-facing Versant properties — CNBC Pro, GolfNow/GolfPass, Fandango, DTC subscribers, SportsEngine, and MVPD viewer inquiries.",
    icon: "Headphones",
    processes: [
      p(["svc-s-1", "First-Line Customer Support (Chat/Email)", "Continuous", "High", "Manual", true, P1, "AI conversational support handles 60-70% of inquiries without human agent. Brand-specific personality per property.", "svc-1", "primary"]),
      p(["svc-s-2", "Order & Transaction Management", "Continuous", "High", "Semi-automated", true, P1, "AI handles Fandango ticket issues, GolfNow booking problems, refunds autonomously within policy.", "svc-1", "sub-process"]),
      p(["svc-s-3", "Subscription Lifecycle Management", "Continuous", "High", "Manual", true, P1, "AI manages upgrades, downgrades, pauses, cancellations with retention offers. Critical for DTC.", "svc-1", "sub-process"]),
      p(["svc-s-4", "Escalation & Complex Issue Resolution", "Event-driven", "High", "Manual", true, P2, "AI provides full context to human agents for complex cases. Reduces resolution time.", "svc-1", "sub-process"]),
      p(["svc-s-5", "Voice of Customer Analytics", "Monthly", "Medium", "Not yet established", true, P2, "AI aggregates support interactions to identify product issues and feature requests.", "svc-1", "sub-process"]),
      p(["svc-s-6", "Phone Support", "Continuous", "Medium", "Manual", false, undefined, "For complex issues and accessibility. Human agents with AI context (from escalation agent). Not standalone AI.", undefined, undefined]),
      p(["svc-s-7", "Knowledge Base Management", "Monthly", "Medium", "Manual", false, undefined, "Content creation and curation. Standard CMS. AI can suggest gaps but not a standalone initiative.", undefined, undefined]),
    ],
  },
  {
    id: "svc-ret",
    name: "Subscriber Retention & Lifecycle",
    description:
      "Proactively identifying and retaining at-risk subscribers across all Versant DTC products and services.",
    icon: "HeartHandshake",
    processes: [
      p(["svc-r-1", "Churn Prediction & Proactive Intervention", "Continuous", "Mission-critical", "Not yet established", true, P1, "AI predicts churn 30-60 days before cancellation and triggers personalized interventions. Existential for new DTC products.", "svc-2", "primary"]),
      p(["svc-r-2", "Save Offer Optimization (at cancellation)", "Continuous", "High", "Not yet established", true, P1, "AI presents personalized save offers based on usage pattern and churn reason.", "svc-2", "sub-process"]),
      p(["svc-r-3", "Win-Back Campaign Management", "Continuous", "Medium", "Not yet established", true, P2, "AI determines optimal timing, messaging, and offer for churned subscriber re-engagement.", "svc-2", "sub-process"]),
      p(["svc-r-4", "Cross-Brand Retention (bundle offers)", "Continuous", "Medium", "Not yet established", true, P2, "AI finds cross-brand retention plays (at-risk CNBC Pro + GolfNow user → bundle offer).", "svc-2", "sub-process"]),
      p(["svc-r-5", "NPS & Satisfaction Management", "Quarterly", "Medium", "Not yet established", false, undefined, "Standard survey and follow-up. Not agentic AI.", undefined, undefined]),
    ],
  },
];

// --- EDITORIAL -------------------------------------------------------------
const editorial: WorkCategory[] = [
  {
    id: "ed-np",
    name: "News Production — Digital & Live",
    description:
      "Producing news content across MS NOW, CNBC, and digital platforms — from data-driven market reports to live political coverage to breaking news.",
    icon: "Newspaper",
    processes: [
      p(["ed-np-1", "Automated Data-Driven Content (market reports, digests, scores)", "Continuous", "High", "Manual", true, P1, "THE editorial AI quick win. 75% time savings. Automates the 'base of the pyramid' — earnings summaries, market briefs, polling data, sports scores. StockStory integration accelerates CNBC.", "ed-1", "primary"]),
      p(["ed-np-2", "Live Broadcast Data & Graphics Support", "Continuous", "Mission-critical", "Semi-automated", true, P2, "AI feeds real-time data overlays, dynamically adjusts show rundowns based on breaking news.", "ed-3", "primary"]),
      p(["ed-np-3", "Breaking News Monitoring & Alert Generation", "Continuous", "Mission-critical", "Manual", true, P1, "AI monitors all news sources 24/7, drafts initial alerts for editor review.", "ed-1", "sub-process"]),
      p(["ed-np-4", "Wire Service Intake & Curation", "Continuous", "High", "Manual", true, P1, "AI ingests wire services, classifies, prioritizes, summarizes for editorial team.", "ed-1", "sub-process"]),
      p(["ed-np-5", "CMS Publishing & SEO Optimization", "Continuous", "Medium", "Semi-automated", true, P2, "AI handles formatting, metadata, SEO, image selection for digital publishing.", "ed-1", "sub-process"]),
      p(["ed-np-6", "Live Show Production", "Continuous", "Mission-critical", "Manual", false, undefined, "Creative editorial judgment. Producers, directors, talent. Fundamentally human craft.", undefined, undefined]),
      p(["ed-np-7", "Editorial Meeting / Story Selection", "Daily", "Mission-critical", "Manual", false, undefined, "Core editorial judgment. What stories to cover, how to cover them. Human decision-making.", undefined, undefined]),
      p(["ed-np-8", "Source Development & Relationship Management", "Continuous", "High", "Manual", false, undefined, "Journalism's core human function. Cannot and should not be automated.", undefined, undefined]),
      p(["ed-np-9", "On-Camera Reporting & Anchoring", "Continuous", "Mission-critical", "Manual", false, undefined, "Human talent performing human roles.", undefined, undefined]),
    ],
  },
  {
    id: "ed-inv",
    name: "Investigative & Enterprise Journalism",
    description:
      "Deep investigative reporting, enterprise stories, and long-form journalism across MS NOW and CNBC — the premium content that builds brand credibility.",
    icon: "Search",
    processes: [
      p(["ed-inv-1", "Document Research & Analysis", "Event-driven", "High", "Manual", true, P2, "AI agents scan public records, court filings, financial disclosures. Uses OCR, RAG, embedding models. The Pulitzer-winning investigations of 2025 used these methods.", "ed-2", "primary"]),
      p(["ed-inv-2", "Pattern & Connection Detection", "Event-driven", "High", "Manual", true, P2, "AI identifies connections and anomalies across large document sets that humans would miss.", "ed-2", "sub-process"]),
      p(["ed-inv-3", "Real-Time Fact Verification", "Continuous", "Mission-critical", "Manual", true, P2, "AI cross-references claims against multiple sources during live broadcasts.", "ed-2", "sub-process"]),
      p(["ed-inv-4", "FOIA & Public Records Requests", "Event-driven", "Medium", "Manual", false, undefined, "Legal/procedural process. Low volume.", undefined, undefined]),
      p(["ed-inv-5", "Long-Form Story Development", "Event-driven", "High", "Manual", false, undefined, "Creative journalism. The investigation itself is human intellect. AI tools support but don't drive.", undefined, undefined]),
    ],
  },
  {
    id: "ed-pod",
    name: "Audio & Podcast Production",
    description:
      "Producing Versant's growing podcast portfolio — MS NOW podcasts (140M+ downloads), CNBC podcasts, and potentially Vox Media's ~40 shows.",
    icon: "Mic",
    processes: [
      p(["ed-pod-1", "Post-Recording Processing (transcription, editing, show notes, clips)", "Per episode", "High", "Manual", true, P1, "60% time savings per episode. AI handles transcription, rough editing, show notes, clip detection, captioning. Enables scaling to 50+ shows without proportional headcount.", "ed-4", "primary"]),
      p(["ed-pod-2", "Dynamic Ad Insertion & Monetization", "Per listen", "High", "Semi-automated", true, P2, "AI optimizes ad placement per listener based on profile and content context.", "ed-4", "sub-process"]),
      p(["ed-pod-3", "Cross-Show Promotion & Discovery", "Continuous", "Medium", "Not yet established", true, P2, "AI recommends cross-promotion across podcast portfolio and TV/DTC.", "ed-4", "sub-process"]),
      p(["ed-pod-4", "Recording & Host Preparation", "Per episode", "High", "Manual", false, undefined, "Human creative process. Research, guest prep, interview.", undefined, undefined]),
      p(["ed-pod-5", "Podcast Strategy & Development", "Monthly", "High", "Manual", false, undefined, "Creative and strategic. What new shows to launch, which to end.", undefined, undefined]),
    ],
  },
  {
    id: "ed-std",
    name: "Editorial Standards & Quality",
    description:
      "Maintaining editorial standards, accuracy, and trust across all Versant news content — led by Brian Carovillano's standards team.",
    icon: "ShieldCheck",
    processes: [
      p(["ed-std-1", "AI Content Quality Review", "Continuous", "Mission-critical", "Not yet established", true, P1, "As AI generates more content, a dedicated AI review layer ensures accuracy, style compliance, and editorial standards. This is the 'human-led, AI-powered' governance layer.", "ed-1", "governance"]),
      p(["ed-std-2", "Content Labeling & Transparency", "Continuous", "High", "Not yet established", false, undefined, "Policy decision about how to label AI-assisted content. Human policy, not an AI initiative.", undefined, undefined]),
      p(["ed-std-3", "Corrections & Retractions", "Event-driven", "High", "Manual", false, undefined, "Requires editorial judgment and accountability. Human process.", undefined, undefined]),
      p(["ed-std-4", "Editorial Training & Standards Development", "Quarterly", "High", "Manual", false, undefined, "Human-led training and policy development.", undefined, undefined]),
      p(["ed-std-5", "Multilingual Content Quality (Nikkei CNBC)", "Continuous", "Medium", "Manual", true, P3, "AI translation/localization with human review. Depends on base-layer content AI maturity.", "ed-1", "sub-process"]),
    ],
  },
];

// --- PRODUCTION ------------------------------------------------------------
const production: WorkCategory[] = [
  {
    id: "prod-post",
    name: "Post-Production",
    description:
      "Editing, graphics, audio processing, captioning, transcoding, and asset management for all Versant content across linear, digital, social, and DTC platforms.",
    icon: "Film",
    processes: [
      p(["prod-post-1", "Automated Rough Cutting & Clip Creation", "Continuous", "High", "Manual", true, P1, "AI creates rough cuts from live footage, identifies key moments, auto-clips for digital platforms. Highest-volume production AI opportunity.", "prod-1", "primary"]),
      p(["prod-post-2", "Graphics & Thumbnail Generation", "Continuous", "High", "Manual", true, P1, "AI creates platform-specific graphics from templates. Eliminates repetitive design work.", "prod-1", "sub-process"]),
      p(["prod-post-3", "Audio Processing & Mixing", "Continuous", "High", "Manual", true, P2, "AI auto-leveling, noise reduction, music bed addition for different output formats.", "prod-1", "sub-process"]),
      p(["prod-post-4", "Captioning & Accessibility", "Continuous", "Mission-critical", "Semi-automated", true, P1, "AI captioning with speaker ID, multi-language. FCC compliance requirement.", "prod-1", "sub-process"]),
      p(["prod-post-5", "Format Transcoding & Multi-Platform Distribution", "Continuous", "High", "Semi-automated", true, P1, "AI creates all required output formats (broadcast, web, mobile, social) and delivers to platforms.", "prod-1", "sub-process"]),
      p(["prod-post-6", "Content Archive Indexing & Search", "Continuous", "Medium", "Manual", true, P2, "AI processes historical content — metadata, transcripts, scene descriptions, face detection. Makes decades of archive searchable.", "prod-1", "sub-process"]),
      p(["prod-post-7", "Color Correction & Grading", "Per production", "Medium", "Manual", false, undefined, "Creative craft. Colorists make artistic decisions.", undefined, undefined]),
      p(["prod-post-8", "Sound Design & Music", "Per production", "Medium", "Manual", false, undefined, "Creative work. Composers and sound designers.", undefined, undefined]),
      p(["prod-post-9", "VFX & Motion Graphics (complex)", "Per production", "Medium", "Manual", false, undefined, "Complex creative work requiring specialized artists. AI assists but doesn't automate.", undefined, undefined]),
    ],
  },
  {
    id: "prod-stu",
    name: "Studio Operations",
    description:
      "Managing studio facilities, crew scheduling, and equipment across Versant's production locations serving 7+ networks.",
    icon: "Clapperboard",
    processes: [
      p(["prod-stu-1", "Studio Scheduling & Utilization Optimization", "Weekly", "High", "Manual", true, P2, "AI optimizes studio allocation across 7+ networks sharing facilities. Constraint satisfaction across overlapping demands.", "prod-2", "primary"]),
      p(["prod-stu-2", "Crew Scheduling & Assignment", "Daily", "High", "Manual", true, P2, "AI matches crew to productions based on skills, certifications, union rules, availability, and cost.", "prod-2", "sub-process"]),
      p(["prod-stu-3", "Equipment Tracking & Allocation", "Continuous", "Medium", "Manual", true, P2, "RFID/IoT equipment tracking with AI-optimized allocation.", "prod-2", "sub-process"]),
      p(["prod-stu-4", "Breaking News Reallocation", "Event-driven", "Mission-critical", "Manual", true, P1, "AI instantly recalculates studio assignments when breaking news requires schedule changes.", "prod-2", "sub-process"]),
      p(["prod-stu-5", "Studio Set Design & Construction", "Event-driven", "Medium", "Manual", false, undefined, "Creative and physical construction work.", undefined, undefined]),
      p(["prod-stu-6", "Studio Technology Upgrades", "Annual", "High", "Manual", false, undefined, "Capital planning. Strategic decisions.", undefined, undefined]),
    ],
  },
  {
    id: "prod-rem",
    name: "Remote & Field Production",
    description:
      "Managing field crews and remote production for live events — golf tournaments, political rallies, sports events, breaking news locations.",
    icon: "MapPin",
    processes: [
      p(["prod-rem-1", "Production Planning & REMI Decision", "Per event", "High", "Manual", true, P2, "AI recommends REMI (cloud production) vs. truck deployment, optimizing cost and quality per event.", "prod-3", "primary"]),
      p(["prod-rem-2", "Connectivity Management", "Per event", "Mission-critical", "Manual", true, P2, "AI selects optimal backhaul (fiber, 5G, satellite), monitors quality, auto-switches on degradation.", "prod-3", "sub-process"]),
      p(["prod-rem-3", "Logistics Coordination", "Per event", "Medium", "Manual", true, P2, "AI optimizes crew travel, equipment shipping, multi-event logistics.", "prod-3", "sub-process"]),
      p(["prod-rem-4", "Remote Feed Quality Monitoring", "Continuous", "Mission-critical", "Manual", true, P2, "AI real-time monitoring of all remote feeds.", "prod-3", "sub-process"]),
      p(["prod-rem-5", "Crew Deployment & Travel", "Per event", "Medium", "Manual", false, undefined, "Physical travel logistics. Standard booking processes.", undefined, undefined]),
      p(["prod-rem-6", "On-Site Production Direction", "Per event", "Mission-critical", "Manual", false, undefined, "Creative direction. Director's craft. Human.", undefined, undefined]),
    ],
  },
];

// --- PROGRAMMING -----------------------------------------------------------
const programming: WorkCategory[] = [
  {
    id: "prog-lin",
    name: "Linear Programming & Scheduling",
    description:
      "Optimizing programming schedules across 7+ linear networks and FAST channels to maximize audience, ad revenue, and cross-brand promotion.",
    icon: "Calendar",
    processes: [
      p(["prog-lin-1", "Schedule Optimization (linear networks)", "Weekly", "High", "Manual", true, P2, "AI generates optimal schedules maximizing total portfolio value across 7+ networks.", "prog-1", "primary"]),
      p(["prog-lin-2", "Viewership Prediction", "Continuous", "High", "Manual", true, P2, "AI predicts ratings for any content in any time slot. Foundation for schedule optimization.", "prog-1", "sub-process"]),
      p(["prog-lin-3", "FAST Channel Programming", "Continuous", "Medium", "Manual", true, P1, "AI autonomously programs 24/7 FAST channels from content library. Growing channel count (Free TV Networks) makes automation essential.", "prog-1", "sub-process"]),
      p(["prog-lin-4", "Cross-Brand Promotion Scheduling", "Weekly", "Medium", "Manual", true, P2, "AI identifies cross-brand promotion opportunities based on audience overlap.", "prog-1", "sub-process"]),
      p(["prog-lin-5", "Competitive Schedule Analysis", "Daily", "Medium", "Manual", false, undefined, "Monitoring competitor schedules. Standard industry practice with existing tools.", undefined, undefined]),
      p(["prog-lin-6", "Program Renewals & Cancellation Decisions", "Quarterly", "High", "Manual", false, undefined, "Strategic decisions requiring executive judgment on brand, talent, and business relationships.", undefined, undefined]),
    ],
  },
  {
    id: "prog-dev",
    name: "Content Development & Greenlight",
    description:
      "Developing and greenlighting original content across all Versant brands — from news specials to entertainment programming to sports coverage expansion.",
    icon: "Lightbulb",
    processes: [
      p(["prog-dev-1", "Content Landscape & White Space Analysis", "Quarterly", "High", "Manual", true, P2, "AI maps competitive landscape, identifies genre/topic gaps, tracks trends.", "prog-2", "primary"]),
      p(["prog-dev-2", "Audience Demand Prediction (for proposed content)", "Event-driven", "High", "Manual", true, P2, "AI predicts audience appetite using social signals, search trends, Versant behavioral data.", "prog-2", "sub-process"]),
      p(["prog-dev-3", "Content ROI Projection (multi-platform)", "Event-driven", "High", "Manual", true, P2, "AI projects expected returns across linear + digital + DTC + licensing + social.", "prog-2", "sub-process"]),
      p(["prog-dev-4", "Synthetic Audience Testing", "Event-driven", "Medium", "Not yet established", true, P3, "AI simulates audience response to content concepts. Emerging capability.", "prog-2", "sub-process"]),
      p(["prog-dev-5", "Pilot Development & Production", "Event-driven", "High", "Manual", false, undefined, "Creative production. Human storytelling.", undefined, undefined]),
      p(["prog-dev-6", "Talent Attachment & Packaging", "Event-driven", "High", "Manual", false, undefined, "Relationship-driven talent/agency negotiations.", undefined, undefined]),
      p(["prog-dev-7", "Format & IP Development", "Event-driven", "Medium", "Manual", false, undefined, "Creative format development. Human imagination.", undefined, undefined]),
    ],
  },
  {
    id: "prog-acq",
    name: "Content Acquisition & Licensing",
    description:
      "Evaluating and acquiring licensed content — programming libraries, format rights, podcast catalogs — for Versant's growing portfolio of distribution platforms.",
    icon: "FolderSearch",
    processes: [
      p(["prog-acq-1", "Content Market Scanning & Target Identification", "Continuous", "High", "Manual", true, P2, "AI monitors content marketplace for acquisition targets matching portfolio gaps.", "prog-3", "primary"]),
      p(["prog-acq-2", "Multi-Platform Content Valuation", "Event-driven", "High", "Manual", true, P2, "AI models content value across ALL distribution paths.", "prog-3", "sub-process"]),
      p(["prog-acq-3", "Comparable Deal Benchmarking", "Event-driven", "Medium", "Manual", true, P2, "AI finds and analyzes comparable content deals for pricing intelligence.", "prog-3", "sub-process"]),
      p(["prog-acq-4", "Portfolio Fit Assessment", "Event-driven", "High", "Manual", true, P2, "AI scores strategic fit of acquisition targets against Versant portfolio gaps.", "prog-3", "sub-process"]),
      p(["prog-acq-5", "Deal Negotiation", "Event-driven", "High", "Manual", false, undefined, "Relationship-driven negotiation. Human judgment and business relationships.", undefined, undefined]),
      p(["prog-acq-6", "Integration Planning (post-acquisition)", "Event-driven", "High", "Manual", false, undefined, "Strategic planning exercise. Human-led with AI data support.", undefined, undefined]),
    ],
  },
];

export const workCategoriesByTower: Record<string, WorkCategory[]> = {
  finance,
  hr,
  "research-analytics": research,
  legal,
  "corp-services": corp,
  "tech-engineering": tech,
  "operations-technology": ops,
  sales,
  "marketing-comms": marketing,
  service,
  "editorial-news": editorial,
  production,
  "programming-dev": programming,
};
