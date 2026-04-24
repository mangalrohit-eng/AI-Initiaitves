/** Modeled potential impact — qualitative only until discovery validates sizing. */
export type ImpactTier = "High" | "Medium" | "Low";

export type Tower = {
  id: string;
  name: string;
  versantLeads: string[];
  accentureLeads: string[];
  description: string;
  currentState: string;
  totalProcesses: number;
  aiEligibleProcesses: number;
  impactTier: ImpactTier;
  topOpportunityHeadline: string;
  processes: Process[];
  workCategories: WorkCategory[];
  // P0 additions — optional, safe to omit on existing slices
  narrativeSummary?: string;
  topOpportunities?: TopOpportunity[];
  // P1 — ISO date string of the last content-meaningful update. Used by RSS
  // feed, /changelog page, and "Updated since your last visit" badges.
  lastUpdated?: string;
};

export type TopOpportunity = {
  headline: string;
  impact?: string;
  processId?: string;
};

// Used by tower slice files — `workCategories` is merged in at composition time.
export type TowerSlice = Omit<Tower, "workCategories">;

export type WorkCategory = {
  id: string;
  name: string;
  description: string;
  icon: string;
  processes: TowerProcess[];
};

export type TowerProcessFrequency =
  | "Continuous"
  | "Daily"
  | "Weekly"
  | "Monthly"
  | "Quarterly"
  | "Annual"
  | "Event-driven"
  | "Seasonal"
  | "Per hire"
  | "Per episode"
  | "Per event"
  | "Per departure"
  | "Per production"
  | "Per listen"
  | "Bi-weekly"
  | "Semi-annual";

export type TowerProcessCriticality =
  | "Mission-critical"
  | "High"
  | "Medium"
  | "Low";

export type TowerProcessMaturity =
  | "Manual"
  | "Semi-automated"
  | "Automated"
  | "Not yet established";

export type AiPriority =
  | "P1 — Immediate (0-6mo)"
  | "P2 — Near-term (6-12mo)"
  | "P3 — Medium-term (12-24mo)";

export type TowerProcess = {
  id: string;
  name: string;
  description?: string;
  frequency: TowerProcessFrequency;
  criticality: TowerProcessCriticality;
  currentMaturity: TowerProcessMaturity;
  aiEligible: boolean;
  aiPriority?: AiPriority;
  aiRationale: string;
  aiInitiativeId?: string;
  aiInitiativeRelation?: "primary" | "sub-process" | "related" | "governance";
  // Slug of an AI Process Brief when this row has its own lightweight
  // pre/post + agents detail page (attached at tower composition time).
  briefSlug?: string;
};

// Research-backed evidence that a given P1/P2 initiative is grounded in
// real-world deployments — a named case study, a commercial vendor delivering
// the capability today, or an adjacent-industry use case that maps directly
// onto the Versant context.
export type FeasibilityEvidenceType = "case-study" | "vendor" | "adjacent-use-case";

export type FeasibilityEvidence = {
  type: FeasibilityEvidenceType;
  title: string;
  source: string;
  description: string;
  metric?: string;
  url?: string;
  year: string;
};

export type EvidenceCluster = {
  id: string;
  label: string;
  evidence: FeasibilityEvidence[];
};

// Lightweight pre/post detail for a P1/P2 sub-process that doesn't
// warrant a full 4-lens initiative page.
export type AIProcessBrief = {
  id: string;
  name: string;
  towerSlug: string;
  parentProcessId: string;
  // Exact or partial name match used to attach this brief to a
  // TowerProcess row in the operating model at composition time.
  matchRowName: string;
  aiPriority: "P1" | "P2";
  description?: string;
  impactTier: ImpactTier;
  preState: {
    summary: string;
    painPoints: string[];
    typicalCycleTime: string;
  };
  postState: {
    summary: string;
    keyImprovements: string[];
    newCycleTime: string;
  };
  agentsInvolved: { agentName: string; roleInProcess: string }[];
  toolsRequired: { tool: string; purpose: string }[];
  keyMetric: string;
  dependencies: string[];
  rolesImpacted: { role: string; impact: string }[];
  // P1 — see Tower.lastUpdated
  lastUpdated?: string;
};

export type Process = {
  id: string;
  name: string;
  description: string;
  isAiEligible: boolean;
  complexity: "Low" | "Medium" | "High";
  timelineMonths: number;
  impactTier: ImpactTier;
  currentPainPoints: string[];
  work: WorkLens;
  workforce: WorkforceLens;
  workbench: WorkbenchLens;
  digitalCore: DigitalCoreLens;
  agents: Agent[];
  agentOrchestration: AgentOrchestration;
  // P0 additions — optional, graceful empty states in UI if omitted
  businessCase?: BusinessCase;
  confidence?: "Modeled" | "Validated";
  // P1 — see Tower.lastUpdated
  lastUpdated?: string;
};

export type BusinessCase = {
  investmentEstimate?: string;
  paybackPeriod?: string;
  kpis?: string[];
  risks?: string[];
  decisionsRequired?: string[];
  changeImpact?: string;
};

export type WorkLens = {
  pre: WorkState;
  post: WorkState;
  keyShifts: string[];
};

export type WorkState = {
  description: string;
  steps: WorkStep[];
  avgCycleTime: string;
  touchpoints: number;
  errorRate: string;
};

export type WorkStep = {
  step: number;
  action: string;
  owner: string;
  duration: string;
  isManual: boolean;
};

export type WorkforceLens = {
  pre: RoleState[];
  post: RoleState[];
  keyShifts: string[];
  workforceImpactTier: ImpactTier;
  workforceImpactSummary: string;
};

export type RoleState = {
  role: string;
  headcount: string;
  primaryActivities: string[];
  skillsRequired: string[];
  timeAllocation: Record<string, number>;
};

export type WorkbenchLens = {
  pre: ToolState[];
  post: ToolState[];
  keyShifts: string[];
};

export type ToolState = {
  tool: string;
  category: string;
  usage: string;
};

export type DigitalCoreLens = {
  requiredPlatforms: PlatformRequirement[];
  dataRequirements: string[];
  integrations: string[];
  securityConsiderations: string[];
  estimatedBuildEffort: string;
};

export type PlatformRequirement = {
  platform: string;
  purpose: string;
  priority: "Critical" | "Important" | "Nice-to-have";
  examples: string[];
};

export type Agent = {
  id: string;
  name: string;
  role: string;
  type: "Orchestrator" | "Specialist" | "Monitor" | "Router" | "Executor";
  inputs: string[];
  outputs: string[];
  llmRequired: boolean;
  toolsUsed: string[];
};

export type AgentOrchestration = {
  pattern: "Sequential" | "Parallel" | "Hub-and-Spoke" | "Pipeline" | "Hierarchical";
  description: string;
  flow: AgentFlow[];
};

export type AgentFlow = {
  from: string;
  to: string;
  dataPassed: string;
  trigger: string;
};
