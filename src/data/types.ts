/** Modeled potential impact — qualitative only until discovery validates sizing. */
export type ImpactTier = "High" | "Medium" | "Low";

/**
 * Per-L5 Activity ship-readiness signal. Binary by design — the program-level
 * 2x2 needs a binary input. "Medium" is intentionally absent: in plain
 * language, either we believe the activity can ship in the next 6 months on
 * Versant's existing platform stack, or we don't. Sources stack:
 *   1. Explicit override on overlay / canonical L5 / LLM curation.
 *   2. Rubric INCLUDE_PATTERN tag (today's "P1" patterns -> High).
 *   3. Computed fallback from currentMaturity + frequency + primaryVendor.
 *
 * Display rule: feasibility is NEVER shown as a chip on Step 4. It feeds the
 * cross-tower 2x2 only.
 */
export type Feasibility = "High" | "Low";

/**
 * Cross-tower program priority — output of the deterministic 2x2 over
 * (feasibility, parent-L4 Activity Group business impact). Distinct from the
 * legacy per-L5 `aiPriority`, which is now used only as a back-compat input
 * to feasibility.
 *
 *   - P1 — Quick Wins        (HF/HBI)
 *   - P2 — Fill-ins          (HF/LBI)
 *   - P3 — Strategic Builds  (LF/HBI)
 *   - Deprioritized          (LF/LBI — below the line, not in plan)
 *
 * Default phase build-start months match program buildup (`buildScaleModel`):
 * P1=M1, P2=M6, P3=M12 (editable on Cross-Tower Assumptions).
 */
export type ProgramTier = "P1" | "P2" | "P3" | "Deprioritized";

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
  /**
   * Per-tower iconographic motif. Resolved through the same curated
   * Lucide allowlist as per-solution icons (`solutionIconAllowlist.ts`).
   * Used in `TowerHeroV2` next to the `>` chevron and in the
   * `TowerSwitcher` row entries so the 14 towers feel visually distinct.
   * Optional for back-compat — towers without it render with a
   * neutral chevron-only header.
   */
  iconKey?: string;
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
  /**
   * @deprecated Per-tower P1/P2/P3 is no longer the program-wide priority
   * signal. Cross-tower priority comes from `computeProgramTiers()` in
   * `lib/initiatives/programTier.ts`, which derives `ProgramTier` from
   * (feasibility, parent-L4 Activity Group business impact). Field is
   * retained ONLY as a back-compat input to the binary `feasibility`
   * derivation in `composeVerdict.ts` (P1 -> High, P2/P3 -> Low). Do not
   * display as a priority chip on Step 4 / per-tower views.
   */
  aiPriority?: AiPriority;
  /**
   * Binary ship-readiness signal, surfaced separately from `aiPriority`.
   * Optional because legacy data (canonical operating models) hasn't been
   * back-filled yet — readers fall back to the deprecated `aiPriority` map.
   */
  feasibility?: Feasibility;
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
  /**
   * Brief routing tier — internal hint for which build-wave the brief is
   * authored against. NOT a program priority signal; the cross-tower 2x2
   * owns that. Retained for content sequencing and brief authoring queue.
   */
  briefRoutingTier: "P1" | "P2";
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
  /**
   * Client-narrative brief used by the AI Solution detail page. Authored
   * by the curate-brief LLM alongside the four-lens `Process` body and
   * persists on the same `GeneratedProcessCache.process` blob. Optional
   * because legacy caches predate the field — readers derive a fallback
   * `SolutionBrief` from the rest of the `Process` so old briefs still
   * render the new layout (with a "regenerate for the new fields" hint
   * surfaced via `GeneratedProcessCache.inference.promptVersion`).
   */
  solutionBrief?: SolutionBrief;
};

/**
 * Six-section client-narrative for an AI Solution. Replaces the four-lens
 * `<ProcessExperience>` view as the primary detail-page layout. Each
 * section answers a question a Versant exec asks when sizing the
 * initiative:
 *
 *   A. `whatItDoes`           — What exactly does this solution do?
 *   B. `howItWorks`           — How does it run? (Excel intake citations
 *                               surface here when the tower lead's AI
 *                               readiness questionnaire is loaded.)
 *   C. `sourcing`             — Build vs. Buy vs. Discover.
 *   D. `buyOptions`           — Named vendors that may cover this when
 *                               the verdict is Buy (or adjacent context
 *                               for Build).
 *   E. `referenceArchitecture`— Plain-language source → AI → target →
 *                               users flow.
 *   F. `buildAgents`          — When sourcing is Build, the AI agents
 *                               Versant needs to develop. Curated
 *                               subset of `Process.agents[]`.
 */
export type SolutionBrief = {
  whatItDoes: { headline: string; capabilities: string[] };
  howItWorks: {
    steps: { title: string; detail: string }[];
    /**
     * Short pull-quotes from the tower's Excel readiness questionnaire
     * when the LLM grounded a step in the intake. Empty / omitted when
     * the questionnaire wasn't used.
     */
    intakeCitations?: string[];
  };
  sourcing: { approach: SolutionSourcingApproach; rationale: string };
  buyOptions: SolutionBuyOption[];
  referenceArchitecture: SolutionReferenceArchitecture;
  buildAgents: SolutionBuildAgent[];
};

export type SolutionSourcingApproach = "Build" | "Buy" | "Discover";

export type SolutionBuyOption = {
  vendor: string;
  fit: string;
  /** Coverage of the solution scope by the named vendor. */
  coverage: "Strong" | "Partial" | "Adjacent";
};

export type SolutionReferenceArchitecture = {
  sourceSystems: string[];
  aiLayer: { components: string[]; description: string };
  targetSystems: string[];
  users: string[];
  dataFlowSummary: string;
};

export type SolutionBuildAgent = {
  name: string;
  role: string;
  llmRequired?: boolean;
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
