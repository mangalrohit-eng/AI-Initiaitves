// Explicit mapping: brief ID -> TowerProcess ID (the row in operating-models.ts
// that should get briefSlug attached at composition time in towers.ts).
//
// Every P1/P2 operating-model row that has a lightweight brief but isn't
// itself a full 4-lens initiative is listed here. Rows that ARE full
// initiatives use their `aiInitiativeId` + `relation: "primary"` pointer
// to the detailed Process and are handled by `findAiInitiative` instead.

export const briefRowMap: Record<string, string> = {
  // --- FINANCE -------------------------------------------------------------
  "content-rights-amortization": "fin-rep-2",
  "intercompany-eliminations": "fin-rep-4",
  "variance-analysis-commentary": "fin-fpa-4",
  "debt-covenant-monitoring": "fin-tr-2",
  "invoice-3way-matching": "fin-proc-3",
  "revenue-recognition-automation": "fin-rep-3",
  "sec-narrative-drafting": "fin-rep-5",
  "board-reporting-package": "fin-rep-8",
  "monthly-rolling-forecast": "fin-fpa-3",
  "peer-benchmarking": "fin-ir-3",
  "spend-analytics": "fin-proc-4",

  // --- HR ------------------------------------------------------------------
  "resume-screening": "hr-ta-2",
  "interview-scheduling": "hr-ta-3",
  "preboarding-day1": "hr-onb-1",
  "attrition-prediction": "hr-wsa-2",

  // --- RESEARCH & ANALYTICS ------------------------------------------------
  "audience-segmentation": "ra-cp-3",
  "social-audience-measurement": "ra-am-4",

  // --- LEGAL ---------------------------------------------------------------
  "sports-rights-administration": "leg-r-4",
  "regulatory-change-monitoring": "leg-cg-4",

  // --- CORPORATE SERVICES --------------------------------------------------
  "predictive-facilities-maintenance": "corp-f-2",
  "space-optimization": "corp-f-3",
  "cctv-ai-monitoring": "corp-s-1",
  "visitor-access-management": "corp-s-3",
  "corp-vendor-onboarding": "corp-p-1",
  "corp-po-processing": "corp-p-2",
  "corp-spend-analytics": "corp-p-4",

  // --- TECH & ENGINEERING --------------------------------------------------
  "cloud-cost-optimization": "tech-i-2",
  "migration-planning": "tech-i-3",
  "ai-code-review": "tech-se-2",
  "testing-automation": "tech-se-3",
  "cicd-deployment": "tech-se-4",
  "incident-detection-response": "tech-se-5",
  "llm-operations": "tech-ml-2",
  "ai-governance-compliance": "tech-ml-3",
  "cyber-incident-triage": "tech-cy-2",
  "phishing-defense": "tech-cy-3",
  "vulnerability-management": "tech-cy-4",
  "security-compliance-audit": "tech-cy-5",

  // --- OPERATIONS ----------------------------------------------------------
  "commercial-insertion": "ops-mc-2",
  "fcc-compliance-logging": "ops-mc-3",
  "breaking-news-preemption": "ops-mc-4",
  "broadcast-qa-monitoring": "ops-mc-5",
  "auto-failover": "ops-sd-2",
  "fast-channel-ops": "ops-sd-3",
  "international-feed-mgmt": "ops-sd-4",
  "spare-parts-inventory": "ops-be-2",

  // --- SALES ---------------------------------------------------------------
  "audience-targeting-segments": "sales-ad-2",
  "dynamic-pricing-yield": "sales-ad-3",
  "campaign-execution-optimization": "sales-ad-4",
  "proposal-generation": "sales-ad-5",
  "election-ad-management": "sales-ad-6",
  "cord-cutting-churn-risk": "sales-d-4",
  "trial-to-paid-conversion": "sales-dtc-2",
  "pricing-packaging-optimization": "sales-dtc-3",
  "cross-brand-upsell": "sales-dtc-4",

  // --- MARKETING & COMMS ---------------------------------------------------
  "multi-platform-publishing": "mkt-sm-2",
  "community-management": "mkt-sm-3",
  "social-analytics-cross-platform": "mkt-sm-4",
  "creative-generation-testing": "mkt-pg-2",
  "crm-lifecycle-marketing": "mkt-pg-3",
  "conversion-rate-optimization": "mkt-pg-4",
  "crisis-detection-early-warning": "mkt-pr-2",
  "press-release-drafting": "mkt-pr-3",
  "internal-comms-personalization": "mkt-pr-4",
  "marketing-mix-modeling": "mkt-an-2",

  // --- SERVICE -------------------------------------------------------------
  "order-transaction-mgmt": "svc-s-2",
  "subscription-lifecycle-mgmt": "svc-s-3",
  "escalation-intelligence": "svc-s-4",
  "voice-of-customer": "svc-s-5",
  "save-offer-optimization": "svc-r-2",
  "win-back-campaign": "svc-r-3",
  "cross-brand-retention": "svc-r-4",

  // --- EDITORIAL & NEWS ----------------------------------------------------
  "breaking-news-monitoring": "ed-np-3",
  "wire-service-intake": "ed-np-4",
  "cms-publishing-seo": "ed-np-5",
  "live-broadcast-data-graphics": "ed-np-2",
  "pattern-detection-investigation": "ed-inv-2",
  "fact-verification": "ed-inv-3",
  "podcast-dynamic-ads": "ed-pod-2",
  "cross-show-promotion": "ed-pod-3",
  "ai-content-quality-review": "ed-std-1",

  // --- PRODUCTION ----------------------------------------------------------
  "graphics-thumbnail-gen": "prod-post-2",
  "captioning-accessibility": "prod-post-4",
  "transcode-distribution": "prod-post-5",
  "audio-processing": "prod-post-3",
  "archive-indexing": "prod-post-6",
  "crew-scheduling": "prod-stu-2",
  "equipment-tracking": "prod-stu-3",
  "breaking-news-reallocation": "prod-stu-4",
  "connectivity-management": "prod-rem-2",
  "logistics-coordination": "prod-rem-3",
  "remote-feed-quality": "prod-rem-4",

  // --- PROGRAMMING & DEVELOPMENT ------------------------------------------
  "fast-channel-programming": "prog-lin-3",
  "viewership-prediction": "prog-lin-2",
  "cross-brand-promo-scheduling": "prog-lin-4",
  "content-landscape-analysis": "prog-dev-1",
  "audience-demand-prediction": "prog-dev-2",
  "content-roi-projection": "prog-dev-3",
  "content-market-scanning": "prog-acq-1",
  "multi-platform-valuation": "prog-acq-2",
  "deal-benchmarking": "prog-acq-3",
  "portfolio-fit-assessment": "prog-acq-4",
};

// Inverse lookup: TowerProcess row id -> brief slug
export const briefByRowId: Record<string, string> = Object.fromEntries(
  Object.entries(briefRowMap).map(([briefId, rowId]) => [rowId, briefId]),
);
