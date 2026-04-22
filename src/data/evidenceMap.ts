import { evidenceClusters, evidenceClustersById } from "./evidence";
import type { FeasibilityEvidence } from "./types";

// ---------------------------------------------------------------------------
// Maps each P1 full initiative (Process.id) and each P1/P2 brief (brief.id)
// to one or more evidence-cluster IDs defined in `evidence.ts`. Evidence is
// attached at render time via the helpers in `lib/utils.ts` — we deliberately
// avoid mutating the Process / AIProcessBrief objects so the underlying data
// files stay source-of-truth on their own content.
//
// Coverage mirrors "EVIDENCE MAPPING" table in the P1 Feasibility Evidence
// spec (April 2026). Where a single initiative/brief spans multiple clusters
// (e.g. Content Rights Amortization = close + rights, Audience Targeting =
// ad-sales + audience-identity) both clusters are listed.
// ---------------------------------------------------------------------------

// Full 4-lens initiatives keyed by Process.id
export const processEvidenceMap: Record<string, string[]> = {
  // Finance
  "fin-1": ["close-automation"],
  "fin-2": ["treasury-forecasting"],

  // HR & Talent
  "hr-1": ["ai-recruiting"],
  "hr-2": ["ai-recruiting"],
  "hr-5": ["ai-upskilling"],

  // Research & Analytics
  "ra-1": ["audience-identity"],

  // Legal
  "leg-1": ["rights-management"],

  // Corporate Services — Physical & Digital Security shares cyber cluster
  "corp-2": ["cybersecurity"],

  // Technology & Engineering
  "tech-1": ["cloud-migration"],
  "tech-2": ["ai-dev-tools"],
  "tech-3": ["mlops-llmops"],
  "tech-4": ["cybersecurity"],

  // Operations & Technology — Broadcast
  "ops-1": ["broadcast-ops"],
  "ops-2": ["broadcast-ops"],

  // Sales
  "sales-1": ["ad-sales"],
  "sales-3": ["dtc-paywall", "churn-retention"],

  // Marketing & Comms
  "mkt-1": ["social-content-ai"],
  "mkt-2": ["dtc-paywall"],
  "mkt-3": ["crisis-detection"],

  // Service
  "svc-1": ["ai-customer-support"],
  "svc-2": ["churn-retention"],

  // Editorial & News
  "ed-1": ["ai-newsroom"],
  "ed-4": ["post-production-ai"],

  // Production
  "prod-1": ["post-production-ai"],
  "prod-2": ["studio-reallocation"],
  "prod-3": ["studio-reallocation"],

  // Programming & Development
  "prog-1": ["fast-programming"],
};

// Lightweight briefs keyed by AIProcessBrief.id
export const briefEvidenceMap: Record<string, string[]> = {
  // --- Finance close cluster ---
  "content-rights-amortization": ["close-automation", "rights-management"],
  "intercompany-eliminations": ["close-automation"],
  "variance-analysis-commentary": ["close-automation"],
  "revenue-recognition-automation": ["close-automation"],

  // --- Treasury ---
  "debt-covenant-monitoring": ["treasury-forecasting"],
  "monthly-rolling-forecast": ["treasury-forecasting"],

  // --- Invoice automation ---
  "invoice-3way-matching": ["invoice-automation"],
  "corp-po-processing": ["invoice-automation"],

  // --- AI recruiting ---
  "resume-screening": ["ai-recruiting"],
  "interview-scheduling": ["ai-recruiting"],
  "preboarding-day1": ["ai-recruiting"],

  // --- Audience identity ---
  "audience-segmentation": ["audience-identity"],
  "social-audience-measurement": ["audience-identity"],

  // --- Rights management ---
  "sports-rights-administration": ["rights-management"],

  // --- Cloud migration ---
  "cloud-cost-optimization": ["cloud-migration"],
  "migration-planning": ["cloud-migration"],

  // --- AI dev tools ---
  "ai-code-review": ["ai-dev-tools"],
  "testing-automation": ["ai-dev-tools"],
  "cicd-deployment": ["ai-dev-tools"],

  // --- MLOps / LLMOps ---
  "llm-operations": ["mlops-llmops"],
  "ai-governance-compliance": ["mlops-llmops"],

  // --- Cybersecurity ---
  "cyber-incident-triage": ["cybersecurity"],
  "phishing-defense": ["cybersecurity"],
  "vulnerability-management": ["cybersecurity"],
  "incident-detection-response": ["cybersecurity"],

  // --- Broadcast operations ---
  "commercial-insertion": ["broadcast-ops"],
  "fcc-compliance-logging": ["broadcast-ops"],
  "breaking-news-preemption": ["broadcast-ops"],
  "broadcast-qa-monitoring": ["broadcast-ops"],
  "auto-failover": ["broadcast-ops"],
  "fast-channel-ops": ["broadcast-ops", "fast-programming"],
  "international-feed-mgmt": ["broadcast-ops"],

  // --- Ad sales ---
  "audience-targeting-segments": ["ad-sales", "audience-identity"],
  "dynamic-pricing-yield": ["ad-sales"],
  "campaign-execution-optimization": ["ad-sales"],
  "election-ad-management": ["ad-sales"],

  // --- DTC paywall & conversion ---
  "trial-to-paid-conversion": ["dtc-paywall"],
  "pricing-packaging-optimization": ["dtc-paywall"],
  "conversion-rate-optimization": ["dtc-paywall"],

  // --- Social content AI ---
  "multi-platform-publishing": ["social-content-ai"],
  "social-analytics-cross-platform": ["social-content-ai"],
  "creative-generation-testing": ["social-content-ai"],

  // --- Crisis detection ---
  "crisis-detection-early-warning": ["crisis-detection"],

  // --- Customer support ---
  "order-transaction-mgmt": ["ai-customer-support"],
  "subscription-lifecycle-mgmt": ["ai-customer-support"],
  "escalation-intelligence": ["ai-customer-support"],

  // --- Churn & retention ---
  "save-offer-optimization": ["churn-retention"],
  "win-back-campaign": ["churn-retention"],
  "cross-brand-retention": ["churn-retention"],

  // --- AI newsroom ---
  "breaking-news-monitoring": ["ai-newsroom"],
  "wire-service-intake": ["ai-newsroom"],
  "cms-publishing-seo": ["ai-newsroom"],
  "fact-verification": ["ai-newsroom"],
  "ai-content-quality-review": ["ai-newsroom"],

  // --- Post-production & podcast ---
  "graphics-thumbnail-gen": ["post-production-ai"],
  "captioning-accessibility": ["post-production-ai"],
  "transcode-distribution": ["post-production-ai"],
  "audio-processing": ["post-production-ai"],
  "archive-indexing": ["post-production-ai"],
  "podcast-dynamic-ads": ["post-production-ai"],

  // --- Studio reallocation ---
  "breaking-news-reallocation": ["studio-reallocation"],
  "connectivity-management": ["studio-reallocation"],
  "remote-feed-quality": ["studio-reallocation"],

  // --- FAST programming ---
  "fast-channel-programming": ["fast-programming"],
};

// Resolve cluster IDs → flattened, de-duplicated evidence list (up to 4 items
// to avoid overwhelming the reader per the spec's "max 3-4 per initiative"
// guideline).
export function resolveEvidence(clusterIds: string[] | undefined): FeasibilityEvidence[] {
  if (!clusterIds || clusterIds.length === 0) return [];
  const seen = new Set<string>();
  const resolved: FeasibilityEvidence[] = [];
  for (const id of clusterIds) {
    const cluster = evidenceClustersById.get(id);
    if (!cluster) continue;
    for (const ev of cluster.evidence) {
      const key = `${ev.source}::${ev.title}`;
      if (seen.has(key)) continue;
      seen.add(key);
      resolved.push(ev);
      if (resolved.length >= 4) return resolved;
    }
  }
  return resolved;
}

// Convenience: cluster metadata for UI surface summaries.
export { evidenceClusters };
