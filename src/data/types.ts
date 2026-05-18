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
  /**
   * Optional capability/vendor pairs that Versant has confirmed for this
   * tower (typically captured via an intake form during discovery).
   *
   * When a pair appears here, the prompt kit + workbench / orchestration
   * UI render that vendor definitively for that capability — no `e.g.,`
   * prefix. Every other vendor mention stays illustrative-by-default.
   *
   * Empty (or omitted) on every tower today. The mechanism exists so
   * future intake submissions can populate it without another schema
   * change.
   */
  committedVendors?: CommittedVendor[];
};

/**
 * A Versant-confirmed vendor pick for one capability in one tower.
 * Tracked at the tower grain (not initiative grain) because confirmation
 * is a procurement event, not an initiative event — once a vendor is
 * picked for "Close orchestration," every initiative in that tower that
 * touches close orchestration inherits the definitive name.
 */
export type CommittedVendor = {
  /** Capability the vendor has been selected for (e.g., "Close orchestration"). */
  capability: string;
  /** Confirmed vendor name (e.g., "BlackLine"). Renders without "e.g.,". */
  vendor: string;
  /** Where the confirmation came from — keeps the audit trail tight. */
  confirmedBy?: "intake-form" | "executive-decision" | "rfp" | "other";
  /** ISO date the pair was confirmed. */
  confirmedAt?: string;
  /** Optional one-line rationale for the audit trail. */
  rationale?: string;
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

// ============================================================================
//   TOWER WORKBENCH — the per-tower, custom-built user-facing app that
//   consolidates a tower's point-solution L3 Initiatives behind 4-8 user
//   verbs. Sits one altitude above the L3 Initiatives ("the agents") and
//   one below the cross-tower OrchestrationLayer ("the shared fabric").
//
//   IMPORTANT: This is the per-TOWER Workbench (a meta-surface). It is
//   distinct from `WorkbenchLens` above, which is the per-INITIATIVE tools
//   lens. Type names disambiguate: `TowerWorkbench` vs. `WorkbenchLens`.
// ============================================================================

/**
 * One user-visible surface inside a Tower Workbench. A surface is the
 * muscle-memory action the operator already says today — Finance teams
 * "close" and "reconcile", Production teams "cue" and "package", Ad Sales
 * teams "pace" and "yield". Verbs are intentionally free-text (not an
 * enum) because the vocabulary varies dramatically per tower.
 */
export type WorkbenchSurface = {
  /** Kebab-case slug stable within its workbench. */
  id: string;
  /**
   * 1-2 word verb in the tower's NATIVE vernacular (not the generic
   * "Search/Draft/Review" set). Renders as a small uppercase pill on the
   * surface card.
   */
  verb: string;
  /** Human-readable surface name, e.g. "Multi-entity close console". */
  name: string;
  /** 1-2 sentence Versant-specific description of what happens here. */
  description: string;
  /** Headline user moment in the tower's vocabulary. */
  primaryAction: string;
  /**
   * Free-text names of underlying capabilities. Fuzzy-matched at render
   * time against the live `l3Initiatives[].solutionName` so the surface
   * card can render click-through chips when a match exists. Surface
   * still renders cleanly when no live match exists. v1 scope: tower-local
   * refs only — cross-tower flows belong on the Orchestration Layer.
   */
  poweredByCapabilities: string[];
  /** Lucide allowlist key (see `solutionIconAllowlist.ts`). */
  iconKey: string;
};

export type TowerWorkbenchDigitalCore = {
  /** Named knowledge store, e.g. "Versant Legal Knowledge Graph". */
  knowledgeStore: string;
  /** Identity layer — usually shared, e.g. "Versant SSO via Okta". */
  identity: string;
  /** Workbench-internal agent dispatcher description. */
  agentRouter: string;
  /** Tower-appropriate audit trail framing (SOX/SEC for Finance, FCC for Ops, etc.). */
  auditLog: string;
  /** Named vendors this workbench wraps. */
  integrations: string[];
};

export type TowerWorkbenchBuildEffort = "Light custom" | "Medium custom" | "Heavy custom";

export type TowerWorkbench = {
  /** Stable id `${towerId}-workbench`. */
  id: string;
  /** The tower this workbench belongs to. */
  towerId: string;
  /** Display name, e.g. "Legal & Business Affairs Workbench". */
  name: string;
  /** One-line positioning. */
  tagline: string;
  /** Role labels real to this tower. */
  primaryUsers: string[];
  /** 4-8 surfaces. */
  surfaces: WorkbenchSurface[];
  /** 2-4 sentences naming Versant brands / people / financials specific to this tower. */
  whyConsolidated: string;
  /** 2-3 sentences on the tower-specific COTS gap that forces a custom build. */
  whyCustomBuild: string;
  digitalCore: TowerWorkbenchDigitalCore;
  buildEffort: TowerWorkbenchBuildEffort;
  /** Typically 6-12 months. */
  estimatedDeliveryMonths: number;
  /** Pod composition, e.g. "1 Forge eng pod (~6 FTE) + tower-lead product owner". */
  deliveryPodShape: string;
  /** Qualitative workforce-impact line — never invent FTE numbers. */
  workforceShift: string;
  /** Single success metric framed in the tower's vocabulary. */
  successMetric: string;
  /** Rollout pattern: pilot one practice/network/brand → expand. */
  rolloutPattern: string;
};

// ============================================================================
//   ORCHESTRATION LAYER — the canonical, hand-authored architecture that
//   sits beneath all Tower Workbenches. Replaces the LLM-generated four
//   narrative strings on `OrchestrationBlock` as the primary content of the
//   cross-tower Orchestration tab; the LLM block is retained as
//   "Strategist commentary" beneath the canonical artifact.
// ============================================================================

export type DataArchCategory =
  | "Identity"
  | "Knowledge"
  | "Content"
  | "Event"
  | "Vector"
  | "Lake"
  | "Mesh"
  | "Catalog"
  | "Feature";

export type DataArchitectureComponent = {
  /** Kebab-case slug stable across the layer. */
  id: string;
  /** Display name, e.g. "Versant Identity Graph". */
  name: string;
  category: DataArchCategory;
  /** 2-3 sentences. What it stores; why it exists. */
  description: string;
  /** TowerId list — workbenches that read from this. Use `"all"` for cross-cutting components. */
  primaryConsumers: string[] | "all";
  /** TowerId list — towers / point solutions that write into this. Use `"all"` for cross-cutting components. */
  primaryProducers: string[] | "all";
  /** Named upstreams (vendor systems / events) that feed this component. */
  feedsFromPointSolutions: string[];
  /** Technology choice or the phrase "TBD — subject to discovery". */
  technologyChoice: string;
  /** Lucide allowlist key. */
  iconKey: string;
};

export type ApiDirection = "ingress" | "egress" | "bidirectional";

export type ApiProtocol =
  | "REST"
  | "GraphQL"
  | "Webhook"
  | "Event stream"
  | "File / blob";

export type ApiCadence =
  | "real-time"
  | "near-real-time"
  | "daily"
  | "weekly"
  | "event-driven";

export type ApiIntegration = {
  id: string;
  /** Human-readable integration name. */
  name: string;
  direction: ApiDirection;
  /** Named point solution / vendor system, e.g. "BlackLine reconciliation engine". */
  pointSolution: string;
  /**
   * Workbenches that consume the resulting data, or the literal "all"
   * when the integration feeds every workbench (shared infra).
   */
  workbenchConsumers: string[] | "all";
  /** 1-line payload spec, e.g. "{ entityId, reconciliationId, status, exceptions[] }". */
  payloadShape: string;
  cadence: ApiCadence;
  protocol: ApiProtocol;
  /** DataArchitectureComponent.id[] this integration feeds. */
  servesDataComponents: string[];
};

export type OrchestrationAgentType =
  | "Orchestrator"
  | "Specialist"
  | "Monitor"
  | "Router"
  | "Executor";

export type OrchestrationAgent = {
  id: string;
  name: string;
  type: OrchestrationAgentType;
  /** What the agent does in 1-2 sentences. */
  role: string;
  /** Concrete triggers (named events / signals). */
  triggers: string[];
  /** Concrete outputs (named records / events). */
  outputs: string[];
  /**
   * Workbenches that depend on this agent, or "all" for cross-cutting
   * agents (Identity Resolution, Content Classifier, Governance Auditor).
   */
  servesWorkbenches: string[] | "all";
  /** Lucide allowlist key. */
  iconKey: string;
};

export type GovernancePolicy = {
  id: string;
  name: string;
  description: string;
  /** Named human or agent that enforces this policy. */
  enforcedBy: string;
  /** Workbench / surface / agent names this policy binds. */
  appliesTo: string[];
  /** Lucide allowlist key. */
  iconKey: string;
};

export type OrchestrationLayerBuildEffort =
  | "Light custom"
  | "Medium custom"
  | "Heavy custom";

export type OrchestrationLayer = {
  /** 2-3 sentences — why this layer exists. */
  narrative: string;
  /** Why this cannot be built initiative-by-initiative. */
  whyShared: string;
  /** 5-8 components. */
  dataArchitecture: DataArchitectureComponent[];
  /** 12-20 named integrations. */
  apiIntegrations: ApiIntegration[];
  /** 4-8 cross-cutting agents. */
  agents: OrchestrationAgent[];
  /** 3-5 policies. */
  governance: GovernancePolicy[];
  buildEffort: OrchestrationLayerBuildEffort;
  /** Typically 9-15 months. */
  estimatedDeliveryMonths: number;
  /** Pod composition. */
  podShape: string;
};
