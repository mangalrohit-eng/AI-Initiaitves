import type {
  Agent,
  AgentFlow,
  AgentOrchestration,
  DigitalCoreLens,
  PlatformRequirement,
  Process,
  RoleState,
  ToolState,
  WorkbenchLens,
  WorkforceLens,
  WorkLens,
  WorkState,
  WorkStep,
} from "./types";

export function ws(
  rows: [string, string, string, boolean][],
): WorkStep[] {
  return rows.map((r, i) => ({
    step: i + 1,
    action: r[0],
    owner: r[1],
    duration: r[2],
    isManual: r[3],
  }));
}

export function workState(
  description: string,
  rows: [string, string, string, boolean][],
  avgCycleTime: string,
  touchpoints: number,
  errorRate: string,
): WorkState {
  return {
    description,
    steps: ws(rows),
    avgCycleTime,
    touchpoints,
    errorRate,
  };
}

export function role(
  roleName: string,
  headcount: string,
  activities: string[],
  skills: string[],
  allocation: Record<string, number>,
): RoleState {
  return {
    role: roleName,
    headcount,
    primaryActivities: activities,
    skillsRequired: skills,
    timeAllocation: allocation,
  };
}

export function tool(tool: string, category: string, usage: string): ToolState {
  return { tool, category, usage };
}

export function digitalCore(
  partial: Pick<
    DigitalCoreLens,
    | "requiredPlatforms"
    | "dataRequirements"
    | "integrations"
    | "securityConsiderations"
    | "estimatedBuildEffort"
  >,
): DigitalCoreLens {
  return { ...partial };
}

export function orchestration(
  pattern: AgentOrchestration["pattern"],
  description: string,
  flow: AgentFlow[],
): AgentOrchestration {
  return { pattern, description, flow };
}

export function agent(
  id: string,
  name: string,
  roleText: string,
  type: Agent["type"],
  inputs: string[],
  outputs: string[],
  llmRequired: boolean,
  toolsUsed: string[],
): Agent {
  return {
    id,
    name,
    role: roleText,
    type,
    inputs,
    outputs,
    llmRequired,
    toolsUsed,
  };
}

export function platform(
  p: string,
  purpose: string,
  priority: PlatformRequirement["priority"],
  examples: string[],
): PlatformRequirement {
  return { platform: p, purpose, priority, examples };
}

export function processShell(
  id: string,
  name: string,
  base: Omit<
    Process,
    | "id"
    | "name"
    | "work"
    | "workforce"
    | "workbench"
    | "digitalCore"
    | "agents"
    | "agentOrchestration"
  > & {
    work: WorkLens;
    workforce: WorkforceLens;
    workbench: WorkbenchLens;
    digitalCore: DigitalCoreLens;
    agents: Agent[];
    agentOrchestration: AgentOrchestration;
  },
): Process {
  return { id, name, ...base };
}
