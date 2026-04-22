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
