export type Tower = {
  id: string;
  name: string;
  versantLeads: string[];
  accentureLeads: string[];
  description: string;
  currentState: string;
  totalProcesses: number;
  aiEligibleProcesses: number;
  estimatedAnnualSavingsHours: number;
  topOpportunityHeadline: string;
  processes: Process[];
  workCategories: WorkCategory[];
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
};

export type Process = {
  id: string;
  name: string;
  description: string;
  isAiEligible: boolean;
  complexity: "Low" | "Medium" | "High";
  timelineMonths: number;
  estimatedTimeSavingsPercent: number;
  estimatedAnnualHoursSaved: number;
  currentPainPoints: string[];
  work: WorkLens;
  workforce: WorkforceLens;
  workbench: WorkbenchLens;
  digitalCore: DigitalCoreLens;
  agents: Agent[];
  agentOrchestration: AgentOrchestration;
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
  netFTEImpact: string;
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
