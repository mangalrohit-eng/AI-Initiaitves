/**
 * Cross-Tower AI Plan v3 — AI Project type system.
 *
 * The cross-tower page replaces the per-L5 "key initiative" abstraction with
 * an **AI Project** abstraction. Structurally:
 *
 *   - One AI Project per in-plan **L4 Activity Group**. Grouping is
 *     deterministic (engine-owned), NEVER LLM-decided. The LLM only authors
 *     the *content* of the project (title, narrative, full 4-lens brief,
 *     value/effort buckets + rationales, agent fleet).
 *   - The constituent L5 AI Initiatives roll up into the project verbatim
 *     from the cohort. The LLM is given the L5 list as use-cases the project
 *     must satisfy and authors a per-initiative inclusion rationale.
 *
 * Scoring switches from Feasibility × Impact (P1/P2/P3 + Deprioritized) to
 * **Value × Effort** (High/Low buckets). The LLM authors both buckets and
 * rationales, with effort grounded in brief signals (integration count,
 * agent count, complexity, proven-elsewhere) so the score is auditable.
 *
 * The 4-lens project brief mirrors `Process` from `src/data/types.ts`
 * (Work / Workforce / Workbench / Digital Core, plus Agents and Agent
 * Orchestration) so the cross-tower view stays consistent with the L5
 * initiative briefs the executive has already seen on tower pages.
 */

import type {
  AgentOrchestration as AgentOrchestrationType,
  ImpactTier,
} from "@/data/types";
import type { TowerId } from "@/data/assess/types";
import type {
  ProgramInitiativeRow,
  SelectProgramResult,
} from "@/lib/initiatives/selectProgram";

// ---------------------------------------------------------------------------
//   Shared enums (carry the brand-color contract)
// ---------------------------------------------------------------------------

/** Value × Effort score axis. Both LLM-authored. */
export type ValueBucket = "High" | "Low";
export type EffortBucket = "High" | "Low";

/**
 * Resolved 2x2 quadrant — derived deterministically from the LLM's
 * `valueBucket` × `effortBucket` pair. Quadrant labels carry the strategic
 * meaning the executive reads off the matrix:
 *
 *   - "Quick Win"        — High value × Low effort. Ship first.
 *   - "Strategic Bet"    — High value × High effort. The flagship integrations.
 *   - "Fill-in"          — Low value × Low effort. Slot into team capacity.
 *   - "Deprioritize"     — Low value × High effort. Below the line.
 */
export type Quadrant = "Quick Win" | "Strategic Bet" | "Fill-in" | "Deprioritize";

/** Brief depth knob — controls how many rows the LLM authors per lens. */
export type BriefDepth = "Concise" | "Full";

// ---------------------------------------------------------------------------
//   Cohort — engine-built, never LLM-decided
// ---------------------------------------------------------------------------

/**
 * One L4 Activity Group cohort = one AI Project.
 *
 * The engine groups in-plan `ProgramInitiativeRow`s by `l3.rowId` (which is
 * the L4 Activity Group id under V5 semantics; field name retained for
 * back-compat). The LLM is given the cohort verbatim and must echo
 * `l4RowId` and every `l5InitiativeId` back in the project payload.
 */
export type L4Cohort = {
  /** L4 Activity Group row id — the structural key. Stable across regenerations. */
  l4RowId: string;
  /** Display name of the L4 Activity Group (the row that owns the AI dial). */
  l4Name: string;
  /** Parent L3 Job Family display name (the section header on the tower page). */
  l3JobFamilyName: string;
  /** Tower id this L4 sits in. AI Projects never span towers (one L4 → one tower). */
  towerId: TowerId;
  /** Tower display name. */
  towerName: string;
  /**
   * The full L4 Activity Group prize (the dial-bearing row's modeled $).
   * Equal to `r.aiUsd` for every L5 in the cohort (they share the parent).
   * Used by `composeProjects` for $ rollup.
   */
  l4AiUsd: number;
  /**
   * Sum of `attributedAiUsd` across the L5s in this cohort. Equal to
   * `l4AiUsd` modulo even-split arithmetic, but we surface both so the
   * compose step can pick the grain it wants.
   */
  attributedAiUsdTotal: number;
  /** Constituent L5 Activity initiatives. Verbatim from the in-plan roster. */
  l5Initiatives: L4CohortInitiative[];
};

/** Compact L5 record passed to the LLM as the use-case list for the cohort. */
export type L4CohortInitiative = {
  /** L5 initiative id — verbatim from `ProgramInitiativeRow.id`. */
  id: string;
  /** L5 Activity name (the use case headline). */
  name: string;
  /** Versant-grounded rationale already curated upstream. */
  rationale?: string;
  /** Per-L5 attributed $ (even-split share of the L4 prize). */
  attributedAiUsd: number;
  /** Reference to the legacy program tier — informational only for the LLM. */
  programTier: ProgramInitiativeRow["programTier"];
};

// ---------------------------------------------------------------------------
//   AI Project Brief — full 4-lens, mirrors Process shape
// ---------------------------------------------------------------------------

/** Pre/post step in the Work lens. */
export type WorkStepLLM = {
  /** 1-indexed step number. */
  step: number;
  /** Action description; ≤16 words; no $/%/digit clusters ≥ 2. */
  action: string;
  /** Owner role label (e.g. "AP Specialist", "Reconciliation Agent"). */
  owner: string;
  /** Human-readable duration label, qualitative only (e.g. "Hours", "Same day"). */
  duration: string;
  /** True when the step is performed manually (pre-state) or by a human (post-state). */
  isManual: boolean;
};

export type WorkStateLLM = {
  /** Narrative summary; ≤45 words. */
  description: string;
  /** Ordered steps; 3–7 entries. */
  steps: WorkStepLLM[];
  /** Qualitative cycle-time label (e.g. "Days", "Hours", "Same-day"). */
  avgCycleTime: string;
  /** Qualitative touchpoint label (e.g. "Several teams", "End-to-end agent flow"). */
  touchpointsSummary: string;
  /** Qualitative error-rate label (e.g. "Manual errors common", "Audit-grade"). */
  errorRateSummary: string;
};

export type WorkLensLLM = {
  pre: WorkStateLLM;
  post: WorkStateLLM;
  /** 3–5 key shifts, each ≤18 words. */
  keyShifts: string[];
};

export type RoleStateLLM = {
  role: string;
  /** Qualitative headcount label only — never a number. */
  headcountSummary: string;
  /** Primary activities; 2–4 bullets, each ≤14 words. */
  primaryActivities: string[];
  skillsRequired: string[];
};

export type WorkforceLensLLM = {
  pre: RoleStateLLM[];
  post: RoleStateLLM[];
  /** 3–5 key shifts, each ≤18 words. */
  keyShifts: string[];
  /**
   * Qualitative impact tier — High / Medium / Low. Mirrors the workforce
   * impact tier on `Process.workforce.workforceImpactTier`.
   */
  workforceImpactTier: ImpactTier;
  /** 1–2 sentence summary, ≤45 words; no $/%/digit-2+. */
  workforceImpactSummary: string;
};

export type ToolStateLLM = {
  /** Vendor/platform name. Must be from the grounding allow-list when post-state. */
  tool: string;
  /** Category label (e.g. "ERP", "Brief Authoring", "RPA"). */
  category: string;
  /** How the tool is used; ≤14 words. */
  usage: string;
};

export type WorkbenchLensLLM = {
  pre: ToolStateLLM[];
  post: ToolStateLLM[];
  /** 3–5 key shifts, each ≤18 words. */
  keyShifts: string[];
};

export type PlatformRequirementLLM = {
  /** Generic platform category (e.g. "Multi-agent runtime", "CDP"). */
  platform: string;
  /** Why it's required; ≤16 words. */
  purpose: string;
  /** Critical / Important / Nice-to-have. */
  priority: "Critical" | "Important" | "Nice-to-have";
  /** Specific vendor examples; allow-listed; 0–3 entries. */
  examples: string[];
};

export type DigitalCoreLensLLM = {
  /** 3–6 platform requirements. */
  requiredPlatforms: PlatformRequirementLLM[];
  /** 2–5 data requirements; each ≤18 words. */
  dataRequirements: string[];
  /** 2–6 named integrations (system A ↔ system B). */
  integrations: string[];
  /** 1–4 security considerations; each ≤18 words. */
  securityConsiderations: string[];
  /** Qualitative build-effort label — never months/dollars. */
  estimatedBuildEffortSummary: string;
};

export type AgentLLM = {
  /** Agent display name (e.g. "Reconciliation Agent"). */
  name: string;
  /** Role one-liner; ≤14 words. */
  role: string;
  type: "Orchestrator" | "Specialist" | "Monitor" | "Router" | "Executor";
  /** Inputs — 1–3 short labels. */
  inputs: string[];
  /** Outputs — 1–3 short labels. */
  outputs: string[];
  /** Whether the agent uses an LLM. */
  llmRequired: boolean;
  /** Allow-listed tools the agent calls; 1–4 names. */
  toolsUsed: string[];
};

export type AgentOrchestrationLLM = {
  pattern: AgentOrchestrationType["pattern"];
  /** Why this pattern fits; ≤30 words. */
  description: string;
};

export type AIProjectBriefLLM = {
  /** ≤25 words; the brief headline framing the project's reason for existing at Versant. */
  framing: string;
  /** 2–5 bullet points; each ≤16 words; current-state pain. */
  currentPainPoints: string[];
  work: WorkLensLLM;
  workforce: WorkforceLensLLM;
  workbench: WorkbenchLensLLM;
  digitalCore: DigitalCoreLensLLM;
  agents: AgentLLM[];
  agentOrchestration: AgentOrchestrationLLM;
};

// ---------------------------------------------------------------------------
//   AI Project — top-level LLM-authored payload (per cohort)
// ---------------------------------------------------------------------------

export type PerInitiativeRationale = {
  /** L5 id from the cohort. */
  initiativeId: string;
  /** Why this L5 is included in the project; ≤22 words. */
  rationale: string;
};

export type EffortDriversLLM = {
  /** Mirrors `brief.digitalCore.integrations.length`. */
  integrationCount: number;
  /** Mirrors `brief.agents.length`. */
  agentCount: number;
  /** Mirrors `brief.digitalCore.requiredPlatforms.length`. */
  platformCount: number;
  /** Project-wide complexity assessment, mirrors Process.complexity. */
  complexity: "Low" | "Medium" | "High";
  /** Whether the same agentic pattern has shipped at named peers. */
  provenElsewhere: boolean;
  /** ≤20 words; e.g. "Bloomberg, Reuters running similar news intelligence stacks." */
  provenRationale: string;
};

export type AIProjectLLM = {
  /** `proj-{l4RowId}` — deterministic from cohort, echoed by the LLM. */
  id: string;
  /** Business-specific, solution-oriented title (≤8 words). */
  name: string;
  /**
   * Why this project exists at Versant; 1–2 sentences; ≤55 words; no $/%/digit-2+;
   * Versant-specific (brand, structural constraint, person, business condition).
   */
  narrative: string;
  /** L4 cohort identifier — verbatim. */
  parentL4ActivityGroupId: string;
  /** L4 cohort display name — verbatim. */
  parentL4ActivityGroupName: string;
  /** Primary tower id — every L5 in the cohort sits under this tower. */
  primaryTowerId: TowerId;
  /** L5 ids constituting this project — verbatim from the cohort, full set. */
  constituentInitiativeIds: string[];
  /** Per-L5 inclusion rationale; one entry per constituent. */
  perInitiativeRationale: PerInitiativeRationale[];
  /** Full 4-lens project brief — used by the executive AND by effort scoring. */
  brief: AIProjectBriefLLM;
  /** Value bucket — LLM-authored. */
  valueBucket: ValueBucket;
  /** ≤30 words; declarative; references the project's Versant impact context. */
  valueRationale: string;
  /** Effort bucket — LLM-authored, must reference brief signals. */
  effortBucket: EffortBucket;
  /** ≤30 words; must echo `effortDrivers` reasoning. */
  effortRationale: string;
  /** Pulled-forward effort signals for fast scanning + audit. */
  effortDrivers: EffortDriversLLM;
};

// ---------------------------------------------------------------------------
//   Program-level synthesis payload (one call after per-cohort fan-out)
// ---------------------------------------------------------------------------

export type AIProjectDependency = {
  /** Project id that depends on the other. */
  projectId: string;
  /** Project ids it depends on; 0–3 entries; same-program only. */
  dependsOn: string[];
  /** ≤22 words; why the dependency exists. */
  reason: string;
};

export type ProgramRiskLLM = {
  /** Short risk title; ≤6 words. */
  title: string;
  /** ≤30 words; declarative; names towers/people/vendors when relevant. */
  description: string;
  /** ≤30 words; the mitigation in declarative voice. */
  mitigation: string;
};

export type RoadmapNarrativeLLM = {
  /** ≤55 words; how the program sequences across 24 months. No phase keys. */
  overall: string;
  /** ≤45 words; how Quick Wins ladder into Strategic Bets. */
  ladder: string;
  /** 3–5 named milestone strings; each ≤18 words; declarative; no numerics. */
  milestones: string[];
  /** 1–3 owner notes, each ≤25 words; names towers/people. */
  ownerNotes: string[];
};

export type ProgramSynthesisLLM = {
  /** ≤55 words; the page-header executive summary. */
  executiveSummary: string;
  /** Cross-project dependency edges — refer only to authored project ids. */
  dependsOn: AIProjectDependency[];
  /** 3–8 program-level risks (LLM-authored, no fixed catalog). */
  risks: ProgramRiskLLM[];
  /** Roadmap narrative — replaces the legacy P1/P2/P3 phase narrative. */
  roadmapNarrative: RoadmapNarrativeLLM;
  /** ≤45 words; orchestration pattern commentary. */
  architectureOrchestration: string;
  /** ≤45 words; vendor stack commentary; allow-listed vendors only. */
  architectureVendors: string;
  /** ≤45 words; data + digital core commentary. */
  architectureDataCore: string;
};

// ---------------------------------------------------------------------------
//   Combined payload returned by the route
// ---------------------------------------------------------------------------

export type CrossTowerAiPlanLLM = {
  /** One project per in-plan L4 cohort. Failed cohorts are absent. */
  projects: AIProjectLLM[];
  /** Program-level synthesis (or null when synthesis fell through to stub). */
  synthesis: ProgramSynthesisLLM | null;
};

// ---------------------------------------------------------------------------
//   Resolved (deterministic compose) view-models
// ---------------------------------------------------------------------------

export type AIProjectResolved = {
  /** Project id (`proj-{l4RowId}`). */
  id: string;
  /** L4 Activity Group id. */
  parentL4ActivityGroupId: string;
  /** L4 Activity Group name. */
  parentL4ActivityGroupName: string;
  /** Primary tower id. */
  primaryTowerId: TowerId;
  /** Primary tower display name. */
  primaryTowerName: string;
  /** Project name (LLM-authored when available, otherwise stub label). */
  name: string;
  /** Narrative (LLM-authored when available). */
  narrative: string;
  /** Full project brief — null on stubs. */
  brief: AIProjectBriefLLM | null;
  /** Per-L5 inclusion rationales (empty when stub). */
  perInitiativeRationale: PerInitiativeRationale[];
  /** Constituent L5 ids — always present from the cohort. */
  constituentInitiativeIds: string[];
  /** Constituent L5 rows — engine-resolved from program. */
  constituents: ProgramInitiativeRow[];
  /** Effort drivers payload (or null on stubs). */
  effortDrivers: EffortDriversLLM | null;
  /** Value bucket (null on stubs). */
  valueBucket: ValueBucket | null;
  /** Effort bucket (null on stubs). */
  effortBucket: EffortBucket | null;
  /** Value rationale (or empty on stubs). */
  valueRationale: string;
  /** Effort rationale (or empty on stubs). */
  effortRationale: string;
  /** Resolved 2x2 quadrant — null when buckets unset (stub). */
  quadrant: Quadrant | null;
  /** Modeled $ for the project (the L4 prize, deterministic). */
  attributedAiUsd: number;
  /** Project start month (1-indexed) — derived from quadrant + assumptions. */
  startMonth: number;
  /** Build duration in months — deterministic from effort + assumptions. */
  buildMonths: number;
  /** Adoption ramp duration in months — from assumptions. */
  rampMonths: number;
  /** Month the project's value clock starts — deterministic. */
  valueStartMonth: number;
  /** True when the LLM call for this cohort failed and we synthesized a placeholder. */
  isStub: boolean;
  /** True when the project has been quadrant'd into Deprioritize (excluded from Gantt). */
  isDeprioritized: boolean;
};

// ---------------------------------------------------------------------------
//   Cohort builder — engine-only
// ---------------------------------------------------------------------------

/**
 * Group `program.initiatives` by parent L4 Activity Group row id.
 *
 * Pure function — no LLM. The LLM is given each cohort verbatim and authors
 * one project per cohort.
 *
 * Cohorts are sorted by:
 *   1) total $ desc (so prompt fan-out hits the highest-prize cohorts first
 *      and any token-budget overrun cuts the long tail rather than the head),
 *   2) tower name asc,
 *   3) L4 name asc.
 */
export function buildL4Cohorts(program: SelectProgramResult): L4Cohort[] {
  const map = new Map<string, L4Cohort>();
  for (const row of program.initiatives) {
    const key = row.l3.rowId; // L4 Activity Group row id (V5 semantics).
    let cohort = map.get(key);
    if (!cohort) {
      cohort = {
        l4RowId: key,
        l4Name: row.l3.rowL4Name || row.l3Name,
        l3JobFamilyName: row.l3.l3.name,
        towerId: row.towerId,
        towerName: row.towerName,
        l4AiUsd: row.aiUsd, // L4 prize is shared across all L5s in the cohort
        attributedAiUsdTotal: 0,
        l5Initiatives: [],
      };
      map.set(key, cohort);
    }
    cohort.attributedAiUsdTotal += row.attributedAiUsd;
    cohort.l5Initiatives.push({
      id: row.id,
      name: row.name,
      rationale: row.aiRationale,
      attributedAiUsd: row.attributedAiUsd,
      programTier: row.programTier,
    });
  }
  const cohorts = Array.from(map.values());
  cohorts.sort((a, b) => {
    const usdDelta = b.l4AiUsd - a.l4AiUsd;
    if (Math.abs(usdDelta) > 1) return usdDelta;
    const towerDelta = a.towerName.localeCompare(b.towerName);
    if (towerDelta !== 0) return towerDelta;
    return a.l4Name.localeCompare(b.l4Name);
  });
  return cohorts;
}

/** Project id helper — deterministic from cohort key. */
export function projectIdFor(l4RowId: string): string {
  return `proj-${l4RowId}`;
}
