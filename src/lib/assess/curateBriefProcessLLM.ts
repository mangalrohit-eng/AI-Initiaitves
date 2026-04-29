/**
 * Server-only OpenAI helper: full `Process` JSON for the lazy LLM brief route.
 * Caches on `L4Item.generatedProcess`. See `curate-brief` API route for fallback.
 */

import type {
  Agent,
  AgentFlow,
  AgentOrchestration,
  DigitalCoreLens,
  ImpactTier,
  PlatformRequirement,
  Process,
  RoleState,
  ToolState,
  WorkforceLens,
  WorkLens,
  WorkState,
  WorkStep,
} from "@/data/types";
import type { GeneratedBrief, TowerId } from "@/data/assess/types";
import { digitalCore, orchestration, role, tool, workState } from "@/data/helpers";
import { VENDOR_ALLOW_LIST } from "./curateInitiativesLLM";

const HARDCODED_MODEL = "gpt-5.5";
/** Override with `OPENAI_CURATE_BRIEF_MODEL`. GPT-5.x uses the Responses API + `reasoning` in this module. */
const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_OUTPUT_TOKENS = 16_000;
const VENDOR_TBD = "TBD — subject to discovery";

export const TOWER_BRAND_HINT: Record<TowerId, string> = {
  finance: "Multi-entity JV close, BlackLine GL, BB- credit covenant context.",
  hr: "~9K employees across union (writers, IATSE, NABET) + non-union talent.",
  "research-analytics": "Audience measurement across linear, FAST, streaming, digital.",
  legal: "GC + commercial + IP for sports rights, news brands (CNBC, MS NOW), split-rights IP.",
  "corp-services": "Real estate, facilities, EHS, indirect procurement across studio + corporate.",
  "tech-engineering": "Streaming, GolfNow / GolfPass, Fandango, Rotten Tomatoes, ad-tech.",
  "operations-technology": "Broadcast operations, playout, on-air technology — physical, US-required.",
  sales: "National + local ad sales (greenfield post-TSA), affiliate carriage, sponsorship.",
  "marketing-comms": "Brand marketing across MS NOW / CNBC / Golf / Free TV / Fandango.",
  service: "Customer service for GolfNow, GolfPass, Fandango.",
  "editorial-news": "Newsroom for CNBC, MS NOW, Golf Channel, USA Network sports — editorial judgment stays human.",
  production: "Live and studio production — sets, control rooms, talent, on-air ops.",
  "programming-dev": "Programming strategy, scheduling, content acquisition / dev — strategic.",
};

export type CurateBriefLLMInput = {
  towerId: TowerId;
  l2: string;
  l3: string;
  l4Name: string;
  /** Stable L4 id — used for synthetic `Process.id`. */
  l4Id: string;
  aiRationale: string;
  agentOneLine?: string;
  primaryVendor?: string;
};

export type CurateBriefLLMOptions = {
  model?: string;
  timeoutMs?: number;
  maxOutputTokens?: number;
  /** Only used with GPT-5 family on the Responses API. Default: env `OPENAI_CURATE_BRIEF_REASONING_EFFORT` or `medium`. */
  reasoningEffort?: "none" | "minimal" | "low" | "medium" | "high" | "xhigh";
};

class LLMError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "LLMError";
  }
}

function resolveModel(options: CurateBriefLLMOptions): string {
  return (
    options.model?.trim() ||
    process.env.OPENAI_CURATE_BRIEF_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    HARDCODED_MODEL
  );
}

/**
 * Exposed for `/api/assess/curate-brief` and the LLM-brief page footer. Same
 * resolution order as the actual call (per-request `options` usually empty).
 */
export function getCurateBriefInferenceMeta(
  options: CurateBriefLLMOptions = {},
): { model: string; mode: "responses" | "chat" } {
  const model = resolveModel(options);
  const useResponses = shouldUseResponsesApi(model);
  return { model, mode: useResponses ? "responses" : "chat" };
}

function resolveTimeoutMs(options: CurateBriefLLMOptions): number {
  const env = process.env.CURATE_BRIEF_TIMEOUT_MS;
  if (options.timeoutMs != null) return options.timeoutMs;
  if (env && /^\d+$/.test(env)) return parseInt(env, 10);
  return DEFAULT_TIMEOUT_MS;
}

function resolveMaxOutputTokens(options: CurateBriefLLMOptions): number {
  const env = process.env.OPENAI_CURATE_BRIEF_MAX_OUTPUT_TOKENS;
  if (options.maxOutputTokens != null) return options.maxOutputTokens;
  if (env && /^\d+$/.test(env)) return parseInt(env, 10);
  return DEFAULT_MAX_OUTPUT_TOKENS;
}

/** GPT-5 family: use Responses API with `reasoning` (see OpenAI "Using GPT-5.5"). */
function shouldUseResponsesApi(model: string): boolean {
  if (process.env.OPENAI_CURATE_BRIEF_USE_CHAT_COMPLETIONS === "1") {
    return false;
  }
  return (
    model.startsWith("gpt-5") ||
    model === "gpt-5.5-pro" ||
    model.startsWith("gpt-5.5")
  );
}

function resolveReasoningEffort(
  options: CurateBriefLLMOptions,
): "none" | "minimal" | "low" | "medium" | "high" | "xhigh" {
  if (options.reasoningEffort) return options.reasoningEffort;
  const env = process.env.OPENAI_CURATE_BRIEF_REASONING_EFFORT?.trim().toLowerCase();
  const allowed = new Set([
    "none",
    "minimal",
    "low",
    "medium",
    "high",
    "xhigh",
  ]);
  if (env && allowed.has(env)) {
    return env as "none" | "minimal" | "low" | "medium" | "high" | "xhigh";
  }
  return "medium";
}

function extractResponsesOutputText(body: unknown): string | null {
  const b = body as {
    output_text?: string;
    output?: Array<{
      type?: string;
      content?: Array<{ type?: string; text?: string }>;
    }>;
  };
  if (typeof b.output_text === "string" && b.output_text.trim()) {
    return b.output_text;
  }
  for (const item of b.output ?? []) {
    if (item.type !== "message") continue;
    for (const part of item.content ?? []) {
      if (part.type === "output_text" && typeof part.text === "string" && part.text.trim()) {
        return part.text;
      }
    }
  }
  return null;
}

export function isLLMConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

function truncate(s: string, max = 160): string {
  if (!s) return "";
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function asStr(v: unknown, max = 2000): string {
  if (typeof v !== "string") return "";
  const t = v.trim();
  if (!t) return "";
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function pickImpact(v: unknown): ImpactTier {
  if (v === "High" || v === "Medium" || v === "Low") return v;
  return "Medium";
}

function pickComplexity(v: unknown): "Low" | "Medium" | "High" {
  if (v === "Low" || v === "Medium" || v === "High") return v;
  return "Medium";
}

function pickAgentType(v: unknown): Agent["type"] {
  const t = asStr(v, 40);
  const u = t as Agent["type"];
  if (["Orchestrator", "Specialist", "Monitor", "Router", "Executor"].includes(u)) return u;
  return "Specialist";
}

function pickPattern(v: unknown): AgentOrchestration["pattern"] {
  const t = asStr(v, 40);
  const p = t as AgentOrchestration["pattern"];
  if (
    ["Sequential", "Parallel", "Hub-and-Spoke", "Pipeline", "Hierarchical"].includes(p)
  ) {
    return p;
  }
  return "Hub-and-Spoke";
}

function pickPlatformPriority(v: unknown): PlatformRequirement["priority"] {
  if (v === "Critical" || v === "Important" || v === "Nice-to-have") return v;
  return "Important";
}

function normSteps(raw: unknown): WorkStep[] {
  if (!Array.isArray(raw)) return [];
  const out: WorkStep[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const step = typeof o.step === "number" && o.step > 0 ? o.step : out.length + 1;
    const action = asStr(o.action, 400) || "TBD — subject to discovery";
    const owner = asStr(o.owner, 200) || "TBD — subject to discovery";
    const duration = asStr(o.duration, 80) || "TBD";
    const isManual = o.isManual === false ? false : true;
    out.push({ step, action, owner, duration, isManual });
    if (out.length >= 20) break;
  }
  return out;
}

function normWorkState(raw: unknown, fallback: WorkState): WorkState {
  if (!raw || typeof raw !== "object") {
    return fallback;
  }
  const o = raw as Record<string, unknown>;
  const steps = normSteps(o.steps);
  return {
    description:
      asStr(o.description, 800) || fallback.description,
    steps: steps.length >= 2 ? steps : fallback.steps,
    avgCycleTime: asStr(o.avgCycleTime, 120) || fallback.avgCycleTime,
    touchpoints: typeof o.touchpoints === "number" && o.touchpoints >= 0 ? o.touchpoints : fallback.touchpoints,
    errorRate: asStr(o.errorRate, 80) || fallback.errorRate,
  };
}

function normWorkLens(raw: unknown, sk: WorkLens): WorkLens {
  if (!raw || typeof raw !== "object") return sk;
  const o = raw as Record<string, unknown>;
  return {
    pre: normWorkState(o.pre, sk.pre),
    post: normWorkState(o.post, sk.post),
    keyShifts: ensureStrArray(o.keyShifts, sk.keyShifts, 8),
  };
}

function ensureStrArray(raw: unknown, fallback: string[], max: number): string[] {
  if (!Array.isArray(raw)) return fallback;
  const xs = raw
    .map((x) => asStr(x, 300))
    .filter(Boolean);
  if (xs.length === 0) return fallback;
  return xs.slice(0, max);
}

function normRoleState(raw: unknown, idx: number): RoleState {
  if (!raw || typeof raw !== "object") {
    return role("Role TBD", "TBD — subject to discovery", ["TBD — subject to discovery"], ["TBD — subject to discovery"], { work: 100 });
  }
  const o = raw as Record<string, unknown>;
  let timeAllocation: Record<string, number> = {};
  if (o.timeAllocation && typeof o.timeAllocation === "object" && o.timeAllocation !== null) {
    for (const [k, n] of Object.entries(o.timeAllocation as Record<string, unknown>)) {
      if (typeof n === "number" && n >= 0) timeAllocation[k] = n;
    }
  }
  if (Object.keys(timeAllocation).length === 0) {
    timeAllocation = { primary: 100 };
  }
  return {
    role: asStr(o.role, 200) || `Role ${idx + 1}`,
    headcount: asStr(o.headcount, 80) || "TBD — subject to discovery",
    primaryActivities: ensureStrArray(
      o.primaryActivities,
      ["TBD — subject to discovery"],
      10,
    ),
    skillsRequired: ensureStrArray(o.skillsRequired, ["TBD — subject to discovery"], 10),
    timeAllocation,
  };
}

function normWorkforce(raw: unknown, sk: WorkforceLens): WorkforceLens {
  if (!raw || typeof raw !== "object") {
    return sk;
  }
  const o = raw as Record<string, unknown>;
  const preArr = Array.isArray(o.pre) ? o.pre.map((x, i) => normRoleState(x, i)) : sk.pre;
  const postArr = Array.isArray(o.post) ? o.post.map((x, i) => normRoleState(x, i)) : sk.post;
  return {
    pre: preArr.length > 0 ? preArr : sk.pre,
    post: postArr.length > 0 ? postArr : sk.post,
    keyShifts: ensureStrArray(o.keyShifts, sk.keyShifts, 10),
    workforceImpactTier:
      o.workforceImpactTier === undefined
        ? sk.workforceImpactTier
        : pickImpact(o.workforceImpactTier),
    workforceImpactSummary:
      asStr(o.workforceImpactSummary, 500) || sk.workforceImpactSummary,
  };
}

function normToolList(raw: unknown, fallback: ToolState[]): ToolState[] {
  if (!Array.isArray(raw)) return fallback;
  const out: ToolState[] = [];
  for (const t of raw) {
    if (!t || typeof t !== "object") continue;
    const o = t as Record<string, unknown>;
    out.push({
      tool: asStr(o.tool, 200) || "TBD — subject to discovery",
      category: asStr(o.category, 80) || "TBD",
      usage: asStr(o.usage, 200) || "TBD — subject to discovery",
    });
    if (out.length >= 20) break;
  }
  return out.length > 0 ? out : fallback;
}

function normWorkbench(raw: unknown, sk: { pre: ToolState[]; post: ToolState[]; keyShifts: string[] }): { pre: ToolState[]; post: ToolState[]; keyShifts: string[] } {
  if (!raw || typeof raw !== "object") {
    return sk;
  }
  const o = raw as Record<string, unknown>;
  return {
    pre: normToolList(o.pre, sk.pre),
    post: normToolList(o.post, sk.post),
    keyShifts: ensureStrArray(o.keyShifts, sk.keyShifts, 12),
  };
}

function normPlatform(raw: unknown, idx: number): PlatformRequirement {
  if (!raw || typeof raw !== "object") {
    return {
      platform: `Platform ${idx + 1}`,
      purpose: "TBD — subject to discovery",
      priority: "Important",
      examples: ["TBD — subject to discovery"],
    };
  }
  const o = raw as Record<string, unknown>;
  return {
    platform: asStr(o.platform, 120) || "TBD — subject to discovery",
    purpose: asStr(o.purpose, 240) || "TBD — subject to discovery",
    priority: pickPlatformPriority(o.priority),
    examples: ensureStrArray(
      o.examples,
      ["TBD — subject to discovery"],
      6,
    ),
  };
}

function normDigitalCore(raw: unknown, sk: DigitalCoreLens, towerId: TowerId): DigitalCoreLens {
  if (!raw || typeof raw !== "object") {
    return sk;
  }
  const o = raw as Record<string, unknown>;
  const rps = Array.isArray(o.requiredPlatforms)
    ? o.requiredPlatforms.map((p, i) => normPlatform(p, i))
    : sk.requiredPlatforms;
  return {
    requiredPlatforms: rps.length > 0 ? rps : sk.requiredPlatforms,
    dataRequirements: ensureStrArray(
      o.dataRequirements,
      sk.dataRequirements,
      20,
    ),
    integrations: ensureStrArray(o.integrations, sk.integrations, 20),
    securityConsiderations: ensureStrArray(
      o.securityConsiderations,
      sk.securityConsiderations,
      20,
    ),
    estimatedBuildEffort:
      asStr(o.estimatedBuildEffort, 120) ||
      sk.estimatedBuildEffort ||
      `3-6 months — ${towerId} integration pattern — TBD — subject to discovery`,
  };
}

function normAgent(
  raw: unknown,
  idx: number,
  l4Id: string,
  fallbackName: string,
  fallbackId: string,
): Agent {
  if (!raw || typeof raw !== "object") {
    return {
      id: fallbackId,
      name: fallbackName,
      role: "TBD — subject to discovery",
      type: "Specialist",
      inputs: ["L4 context"],
      outputs: ["TBD — subject to discovery"],
      llmRequired: true,
      toolsUsed: [VENDOR_TBD],
    };
  }
  const o = raw as Record<string, unknown>;
  const id = asStr(o.id, 80) || `llm-${l4Id}-a${idx + 1}`;
  return {
    id,
    name: asStr(o.name, 120) || fallbackName,
    role: asStr(o.role, 400) || "Executes the workflow and surfaces exceptions.",
    type: pickAgentType(o.type),
    inputs: ensureStrArray(o.inputs, ["Tower + L4 context"], 8),
    outputs: ensureStrArray(o.outputs, ["TBD — subject to discovery"], 8),
    llmRequired: o.llmRequired === false ? false : true,
    toolsUsed: ensureStrArray(o.toolsUsed, [VENDOR_TBD], 8),
  };
}

function collectAgentIds(agents: Agent[]): Set<string> {
  return new Set(agents.map((a) => a.id));
}

function normFlow(raw: unknown, validIds: Set<string>, a0: string, a1: string): AgentFlow[] {
  const defaultEdge = (): AgentFlow[] =>
    a0 === a1
      ? []
      : [{ from: a0, to: a1, dataPassed: "work items", trigger: "On intake" }];

  if (!Array.isArray(raw) || raw.length === 0) {
    return defaultEdge();
  }
  const out: AgentFlow[] = [];
  for (const f of raw) {
    if (!f || typeof f !== "object") continue;
    const o = f as Record<string, unknown>;
    const from = asStr(o.from, 80) || a0;
    const to = asStr(o.to, 80) || a1;
    if (from === to) continue;
    if (!validIds.has(from) || !validIds.has(to)) continue;
    out.push({
      from,
      to,
      dataPassed: asStr(o.dataPassed, 120) || "data",
      trigger: asStr(o.trigger, 80) || "TBD",
    });
    if (out.length >= 20) break;
  }
  return out.length > 0
    ? out
    : defaultEdge();
}

function normOrchestration(
  raw: unknown,
  agents: Agent[],
): AgentOrchestration {
  const a0 = agents[0]?.id ?? "orchestrator";
  const a1 = agents[1]?.id ?? agents[0]?.id ?? "specialist";
  const ids = collectAgentIds(agents);
  if (!raw || typeof raw !== "object") {
    return orchestration("Hub-and-Spoke", "Agents route work across the L4 with human review for exceptions.", normFlow([], ids, a0, a1));
  }
  const o = raw as Record<string, unknown>;
  return {
    pattern: pickPattern(o.pattern),
    description:
      asStr(o.description, 400) || "L4-scoped multi-agent handoff with human-in-the-loop review.",
    flow: normFlow(o.flow, ids, a0, a1),
  };
}

function buildSkeletonWork(
  l3: string,
  l4: string,
  preNarr: string,
  postNarr: string,
): WorkLens {
  return {
    pre: workState(
      preNarr,
      [
        [l3, "Ops", "1-2d", true],
        [l4, "SMEs", "varies", true],
      ],
      "TBD — subject to discovery",
      3,
      "TBD — subject to discovery",
    ),
    post: workState(
      postNarr,
      [
        ["Exception intake + triage", "TBD — subject to discovery", "same day", true],
        ["Agent execution + quality checks", "Primary Agent", "TBD", false],
      ],
      "TBD — subject to discovery",
      2,
      "TBD — subject to discovery",
    ),
    keyShifts: [
      "SMEs shift to exception handling and sign-off from routine execution",
    ],
  };
}

/**
 * Deterministic `Process` when the LLM fails or the API is unconfigured.
 */
export function buildFallbackProcess(input: CurateBriefLLMInput): Process {
  const pid = `llm-${input.l4Id.replace(/[^a-zA-Z0-9-_]/g, "-")}`.slice(0, 120);
  const l3n = input.l3;
  const l4n = input.l4Name;
  const preNarr = `${l3n} → ${l4n} runs manually today across ${String(input.towerId).replace(/-/g, " ")}. Cycle time, error rate, and headcount cost — TBD — subject to discovery.`;
  const oneLine = input.agentOneLine?.trim();
  const postNarr = oneLine
    ? `${oneLine} It automates the routine work; humans review edge cases. Indicative cycle-time and quality lift — TBD — subject to discovery.`
    : "A primary agent automates the routine work; humans review edge cases. Indicative metrics — TBD — subject to discovery.";

  const a0: Agent = {
    id: `${pid}-p1`,
    name: "Primary Agent",
    role: input.agentOneLine?.trim() || "End-to-end execution and exception surfacing for this L4.",
    type: "Executor",
    inputs: ["L4 + tower context"],
    outputs: ["Structured output + exception queue"],
    llmRequired: true,
    toolsUsed: [input.primaryVendor?.trim() || VENDOR_TBD],
  };
  const a1: Agent = {
    id: `${pid}-p2`,
    name: "Triage & QA Agent",
    role: "Pre-flight checks, confidence scoring, and handoff to humans when risk is high.",
    type: "Monitor",
    inputs: ["agent outputs"],
    outputs: ["QA summary"],
    llmRequired: true,
    toolsUsed: [VENDOR_TBD],
  };

  const skWork = buildSkeletonWork(l3n, l4n, preNarr, postNarr);
  const workforce: WorkforceLens = {
    pre: [role("Operators / SMEs", "TBD — subject to discovery", ["Run the process", "ad-hoc fixes"], ["judgment", "spreadsheets"], { execution: 60, "ad-hoc": 40 })],
    post: [
      role("Operators / reviewers", "TBD — subject to discovery", ["exceptions", "sign-off"], ["oversight", "governance"], { review: 55, signoff: 45 }),
    ],
    keyShifts: ["SMEs move from rote work to review and design"],
    workforceImpactTier: "Medium",
    workforceImpactSummary:
      "Qualitative reinvestment in oversight — quantitative sizing TBD in discovery; no new financial figures invented.",
  };
  const wb: { pre: ToolState[]; post: ToolState[]; keyShifts: string[] } = {
    pre: [
      tool("Legacy spreadsheets + email", "Ad hoc", "Manual handoffs"),
      tool("NBCU shared service tools where applicable", "TBD", "As-is"),
    ],
    post: [tool(input.primaryVendor?.trim() || "TBD — subject to discovery", "TBD", "TBD — subject to discovery")],
    keyShifts: ["TBD — subject to discovery"],
  };
  return {
    id: pid,
    name: l4n,
    description: input.aiRationale.slice(0, 500),
    isAiEligible: true,
    complexity: "Medium",
    timelineMonths: 6,
    impactTier: "Medium",
    currentPainPoints: [preNarr.slice(0, 200)],
    work: skWork,
    workforce,
    workbench: wb,
    digitalCore: digitalCore({
      requiredPlatforms: [
        { platform: "L4 data capture + audit", purpose: "Tower-scoped data for agents", priority: "Critical", examples: [VENDOR_TBD] },
      ],
      dataRequirements: ["L4 + tower context", "TBD — subject to discovery"],
      integrations: ["NBCU shared services (until TSA) — TBD", "TBD — subject to discovery"],
      securityConsiderations: [
        "Minimum necessary access; audit logs for human review",
        "TBD — subject to discovery",
      ],
      estimatedBuildEffort: "TBD — subject to discovery",
    }),
    agents: [a0, a1],
    agentOrchestration: orchestration(
      "Hub-and-Spoke",
      "Primary L4 flow with a monitoring agent for quality.",
      [
        { from: a0.id, to: a1.id, dataPassed: "candidate outputs", trigger: "Each batch" },
      ],
    ),
  };
}

/**
 * One-way adapter: legacy 5-field brief to a displayable (thin) `Process` so
 * older `localStorage` still renders the four-lens view without a new API call.
 */
export function legacyGeneratedBriefToProcess(
  brief: GeneratedBrief,
  input: CurateBriefLLMInput,
): Process {
  const pre = workState(
    brief.preState,
    [
      ["Manual L4 work", "SMEs", "TBD", true],
      ["Exception handling", "SMEs", "TBD", true],
    ],
    "TBD — subject to discovery",
    4,
    "TBD — subject to discovery",
  );
  const post = workState(
    brief.postState,
    [
      ["Agent execution", "Primary agent", "TBD", false],
      ["Human review", "SMEs", "TBD", true],
    ],
    "TBD — subject to discovery",
    3,
    "TBD — subject to discovery",
  );
  const aIds = brief.agentsInvolved.map(
    (a, i) => `legacy-${input.l4Id.replace(/[^a-zA-Z0-9-]/g, "-")}-a${i}`.slice(0, 80),
  );
  const agents: Agent[] = brief.agentsInvolved.map((a, i) => ({
    id: aIds[i]!,
    name: a.name,
    role: a.role,
    type: "Specialist",
    inputs: ["L4 context"],
    outputs: ["Narrated outcome"],
    llmRequired: true,
    toolsUsed: brief.toolsRequired.length ? brief.toolsRequired.slice(0, 4) : [VENDOR_TBD],
  }));
  if (agents.length < 1) {
    return buildFallbackProcess(input);
  }
  const a0 = agents[0]!;
  const a1 = agents[1] ?? a0;
  return {
    id: `llm-${input.l4Id.replace(/[^a-zA-Z0-9-_]/g, "-")}`.slice(0, 120),
    name: input.l4Name,
    description: input.aiRationale.slice(0, 500),
    isAiEligible: true,
    complexity: "Medium",
    timelineMonths: 6,
    impactTier: "Medium",
    currentPainPoints: [brief.keyMetric, brief.preState.slice(0, 200)],
    work: {
      pre,
      post,
      keyShifts: [
        "Transition from the legacy brief to the full Process model; regenerate for deeper lenses.",
      ],
    },
    workforce: {
      pre: [
        role("SMEs / operators", "TBD — subject to discovery", ["as-is work"], ["tools in use"], { work: 100 }),
      ],
      post: [role("SMEs / reviewers", "TBD — subject to discovery", ["agent oversight"], ["oversight"], { work: 100 })],
      keyShifts: ["Oversight-first roles — sizing TBD — subject to discovery"],
      workforceImpactTier: "Medium",
      workforceImpactSummary: "Migrated from legacy one-page brief; regenerate for full team modeling.",
    },
    workbench: {
      pre: [tool("As-is stack", "TBD", "From card context")],
      post: brief.toolsRequired.map((t) => tool(t, "TBD", "From legacy brief tools list")),
      keyShifts: ["TBD — subject to discovery"],
    },
    digitalCore: digitalCore({
      requiredPlatforms: [
        { platform: "L4 + tower data layer", purpose: "Agent + UI integration", priority: "Critical", examples: [VENDOR_TBD] },
      ],
      dataRequirements: ["TBD — subject to discovery"],
      integrations: ["TBD — subject to discovery"],
      securityConsiderations: ["TBD — subject to discovery"],
      estimatedBuildEffort: "TBD — subject to discovery",
    }),
    agents,
    agentOrchestration: orchestration(
      "Hub-and-Spoke",
      "Legacy two-step narrative; regenerate for a full orchestration graph.",
      [{ from: a0.id, to: a1.id, dataPassed: "L4 work item", trigger: "Batch" }],
    ),
  };
}

/**
 * Merges LLM JSON (possibly partial) onto the deterministic fallback shape.
 */
export function normalizeLlmProcess(rawRoot: unknown, input: CurateBriefLLMInput): Process {
  const sk = buildFallbackProcess(input);
  let root: Record<string, unknown> | null = null;
  if (rawRoot && typeof rawRoot === "object" && "process" in (rawRoot as object)) {
    const inner = (rawRoot as { process: unknown }).process;
    if (inner && typeof inner === "object") root = inner as Record<string, unknown>;
  } else if (rawRoot && typeof rawRoot === "object") {
    root = rawRoot as Record<string, unknown>;
  }
  if (!root) return sk;

  const id = asStr(root.id, 200) || sk.id;
  const name = asStr(root.name, 200) || sk.name;
  const desc = asStr(root.description, 2000) || sk.description;
  const work = normWorkLens(root.work, sk.work);
  const workforce = normWorkforce(root.workforce, sk.workforce);
  const workbench = normWorkbench(root.workbench, sk.workbench);
  const digital = normDigitalCore(root.digitalCore, sk.digitalCore, input.towerId);
  const agentArr = Array.isArray(root.agents) ? root.agents : [];
  const normAgents: Agent[] = agentArr
    .map((g, i) => normAgent(g, i, input.l4Id, i === 0 ? "Primary Agent" : `Agent ${i + 1}`, `llm-${input.l4Id.replace(/[^a-zA-Z0-9-]/g, "-")}-a${i + 1}`));
  const agents = normAgents.length > 0 ? normAgents : sk.agents;
  return {
    id: id.slice(0, 200),
    name: name,
    description: desc,
    isAiEligible: root.isAiEligible === false ? false : true,
    complexity: pickComplexity(root.complexity),
    timelineMonths:
      typeof root.timelineMonths === "number" && root.timelineMonths >= 1 && root.timelineMonths <= 60
        ? root.timelineMonths
        : sk.timelineMonths,
    impactTier:
      root.impactTier === undefined ? sk.impactTier : pickImpact(root.impactTier),
    currentPainPoints: ensureStrArray(root.currentPainPoints, sk.currentPainPoints, 12).slice(0, 20),
    work,
    workforce,
    workbench,
    digitalCore: digital,
    agents: agents as Agent[],
    agentOrchestration: normOrchestration(root.agentOrchestration, agents as Agent[]),
  };
}

function buildSystemPrompt(towerId: TowerId): string {
  const th = TOWER_BRAND_HINT[towerId] ?? "Versant tower (context not authored).";
  return [
    "You are a senior Versant operating partner. Output ONE JSON object only (the root fields of a 'Process' initiative). Every string must be Versant-specific. Declarative voice. No emojis. No hedging (no 'may', 'could', 'leverage AI').",
    "",
    "Content policy (strict):",
    "  - Do not state dollar amounts, revenue, or Versant-specific financial figures unless they appear verbatim in the user prompt. Use 'TBD — subject to discovery' for unknowns.",
    "  - Do not present operational numbers (days, %, error rates, touchpoint counts) as facts about **this** client. If you use numbers in work.pre / work.post (avgCycleTime, errorRate, step durations, touchpoints), prefix or suffix so they read as **illustrative / industry-typical**, not a Versant forecast — e.g. 'Indicative: …' or 'Example range (not client-specific)'.",
    "  - **Headcount** may be described in **qualitative** terms (role mix, 'analyst-heavy', shift to review) and the RoleState.headcount field may use 'TBD — subject to discovery' or narrative labels. Do **not** claim measured FTE reduction, net headcount cut, or quantified workforce savings for Versant — workforceImpactSummary stays qualitative; timeAllocation is about time-in-role, not FTE counts.",
    "",
    "Versant: MS NOW, CNBC, Golf Channel, GolfNow, GolfPass, USA Network, Fandango, Rotten Tomatoes, SportsEngine, Free TV, etc. TSA, BB- context when relevant. Use real vendor names from the allow-list in tools/roles, or the exact string 'TBD — subject to discovery' (em dash).",
    "",
    `Tower: ${towerId} — ${th}`,
    "",
    "The JSON must fully satisfy this TypeScript-style shape: Process { id, name, description, isAiEligible, complexity, timelineMonths, impactTier, currentPainPoints[], work{ pre: WorkState, post: WorkState, keyShifts[] }, work.pre/post have: description, steps[WorkStep], avgCycleTime, touchpoints, errorRate }. WorkStep: step number, action, owner, duration, isManual. workforce{ pre, post: RoleState[], keyShifts, workforceImpactTier, workforceImpactSummary } RoleState: role, headcount, primaryActivities, skillsRequired, timeAllocation: { string: number summing to ~100 }. workbench, digitalCore with requiredPlatforms[{platform,purpose,priority,examples}]. agents: Agent[] min 1 — each: id, name, role, type: Orchestrator|Specialist|Monitor|Router|Executor, inputs, outputs, llmRequired, toolsUsed. agentOrchestration: pattern, description, flow: {from,to,dataPassed,trigger}[] where from/to are agent id strings that exist in agents.",
    "Vendor allow (match loosely; or use TBD):",
    VENDOR_ALLOW_LIST.map((v) => `  - ${v}`).join("\n"),
    "",
    "Return strict JSON. No keys outside the Process. No markdown fences.",
  ].join("\n");
}

function buildUserPrompt(input: CurateBriefLLMInput): string {
  return [
    "Author a complete Process for this L4. Operational metrics in work states must be labeled indicative / not client-specific if numeric.",
    `l4Id: ${input.l4Id} (set Process.id to something stable like "llm-${input.l4Id}" or a slug derived from the name).`,
    `L2: ${truncate(input.l2)}`,
    `L3: ${truncate(input.l3)}`,
    `L4 name: ${truncate(input.l4Name, 200)}`,
    `Card rationale: ${truncate(input.aiRationale, 400)}`,
    input.agentOneLine ? `Agent one-liner: ${truncate(input.agentOneLine, 280)}` : "",
    input.primaryVendor ? `Primary vendor: ${input.primaryVendor}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * OpenAI call — returns a normalized `Process` or throws `LLMError`.
 */
async function fetchProcessJsonFromChatCompletions(
  apiKey: string,
  model: string,
  maxOut: number,
  input: CurateBriefLLMInput,
  signal: AbortSignal,
): Promise<unknown> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: maxOut,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: buildSystemPrompt(input.towerId) },
        { role: "user", content: buildUserPrompt(input) },
      ],
    }),
    signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new LLMError(
      `OpenAI ${res.status}: ${text.slice(0, 400) || res.statusText}`,
    );
  }
  let body: unknown;
  try {
    body = await res.json();
  } catch (e) {
    throw new LLMError("OpenAI returned non-JSON body", e);
  }
  const content = (body as {
    choices?: { message?: { content?: string } }[];
  })?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new LLMError("OpenAI returned empty content");
  }
  try {
    return JSON.parse(content);
  } catch (e) {
    throw new LLMError("OpenAI content was not valid JSON", e);
  }
}

async function fetchProcessJsonFromResponsesApi(
  apiKey: string,
  model: string,
  maxOut: number,
  reasoningEffort: ReturnType<typeof resolveReasoningEffort>,
  input: CurateBriefLLMInput,
  signal: AbortSignal,
): Promise<unknown> {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      instructions: buildSystemPrompt(input.towerId),
      // Responses API requires the word "json" in the user input when using text.format json_object
      input: `Return a single JSON object (Process shape per instructions).\n\n${buildUserPrompt(input)}`,
      reasoning: { effort: reasoningEffort },
      max_output_tokens: maxOut,
      // `temperature` is not supported on some Responses API models (e.g. gpt-5.5)
      text: {
        format: { type: "json_object" },
        verbosity: "medium",
      },
    }),
    signal,
  });
  const rawText = await res.text().catch(() => "");
  if (!res.ok) {
    throw new LLMError(
      `OpenAI Responses ${res.status}: ${rawText.slice(0, 500) || res.statusText}`,
    );
  }
  let body: unknown;
  try {
    body = rawText ? JSON.parse(rawText) : {};
  } catch (e) {
    throw new LLMError("OpenAI Responses returned non-JSON body", e);
  }
  const st = (body as { status?: string; error?: { message?: string } })
    .status;
  if (st === "failed" || st === "cancelled") {
    const err = (body as { error?: { message?: string } }).error?.message;
    throw new LLMError(
      `OpenAI Responses status ${st}${err ? `: ${err}` : ""}`,
    );
  }
  const text = extractResponsesOutputText(body);
  if (typeof text !== "string" || !text.trim()) {
    throw new LLMError("OpenAI Responses returned empty output text");
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new LLMError("OpenAI Responses output was not valid JSON", e);
  }
}

/**
 * OpenAI call — returns a normalized `Process` or throws `LLMError`.
 * GPT-5 family (default `gpt-5.5`): [Responses API](https://platform.openai.com/docs/api-reference/responses/create) with `reasoning.effort`. Other models: Chat Completions.
 */
export async function curateBriefWithLLM(
  input: CurateBriefLLMInput,
  options: CurateBriefLLMOptions = {},
): Promise<Process> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new LLMError("OPENAI_API_KEY not set");
  }
  const model = resolveModel(options);
  const timeoutMs = resolveTimeoutMs(options);
  const maxOut = resolveMaxOutputTokens(options);
  const reasoningEffort = resolveReasoningEffort(options);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let parsed: unknown;
  try {
    parsed = shouldUseResponsesApi(model)
      ? await fetchProcessJsonFromResponsesApi(
          apiKey,
          model,
          maxOut,
          reasoningEffort,
          input,
          controller.signal,
        )
      : await fetchProcessJsonFromChatCompletions(
          apiKey,
          model,
          maxOut,
          input,
          controller.signal,
        );
  } catch (e) {
    clearTimeout(timer);
    if ((e as { name?: string })?.name === "AbortError") {
      throw new LLMError(`OpenAI call timed out after ${timeoutMs}ms`, e);
    }
    if (e instanceof LLMError) throw e;
    throw new LLMError("OpenAI network error", e);
  } finally {
    clearTimeout(timer);
  }
  return normalizeLlmProcess(parsed, input);
}

export { LLMError };
