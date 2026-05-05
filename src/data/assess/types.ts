import type {
  AiPriority,
  Feasibility,
  Process,
  Tower,
  TowerProcessCriticality,
  TowerProcessFrequency,
  TowerProcessMaturity,
} from "@/data/types";
import type { AiCurationStatus } from "@/data/capabilityMap/types";
import { towers } from "@/data/towers";

export type TowerId = Tower["id"];

/**
 * The five canonical "why not AI" reasons. Kept verbatim from
 * `docs/context.md` §9 — every `reviewed-not-eligible` L5 must fall
 * back to one of these strings (LLM paraphrase is rejected).
 */
export type NotEligibleReason =
  | "Requires human editorial judgment"
  | "Fundamentally relationship-driven"
  | "Already automated via existing tools"
  | "Low volume — ROI doesn't justify AI investment"
  | "Strategic exercise requiring executive judgment";

/**
 * Provenance tag for a rich L5 record: where the verdict + curation came from.
 * Drives diagnostics + future "regenerate stale" sweeps.
 */
export type L5ItemSource = "canonical" | "llm" | "fallback" | "manual";

/**
 * @deprecated Renamed to `L5ItemSource` in the 5-layer migration. Retained as
 * an alias so legacy snapshots/imports keep compiling during the transition
 * window.
 */
export type L4ItemSource = L5ItemSource;

/**
 * Lazily-generated short brief for L5 Activities (legacy v1). Superseded by
 * `generatedProcess` for the full four-lens `Process` view. Kept for
 * migration and for JSON round-trip tests; new generations should write
 * `GeneratedProcessCache` only.
 */
export type GeneratedBrief = {
  /** Versant-grounded narrative of the current ("today") workflow + pain. */
  preState: string;
  /** Versant-grounded narrative of the target ("with AI") workflow. */
  postState: string;
  /** Named agents with their role under the post-state workflow. */
  agentsInvolved: { name: string; role: string }[];
  /** Real vendor names (BlackLine / Amagi / Eightfold / etc.) or "TBD — subject to discovery". */
  toolsRequired: string[];
  /** Single success measure, e.g. "Close days reduced from 12-18 to 5-7". */
  keyMetric: string;
  generatedAt: string;
  source: "llm" | "fallback";
};

/**
 * Full `Process` initiative view cached from the LLM-brief route
 * (`/tower/.../brief/llm/...`). Drives the same `ProcessMetrics` +
 * `ProcessExperience` layout as hand-authored process pages.
 */
export type GeneratedProcessCache = {
  process: Process;
  generatedAt: string;
  source: "llm" | "fallback";
  /** Present when `source === "llm"`: which model and API path the server used. */
  inference?: { model: string; mode: "responses" | "chat" };
};

/**
 * Rich L5 Activity record on `L4WorkforceRow`. Source of truth for AI
 * Initiatives view — each item carries its verdict (Stage 2 output) and,
 * when eligible, its curation (Stage 3 output).
 *
 * AI initiatives attach to L5 Activities (the leaf). The dials-bearing L4
 * Activity Group aggregates these leaves the same way the pre-migration L3
 * Capability aggregated L4 Activities — only the layer numbers shifted.
 */
export type L5Item = {
  /** Stable id — hash of `(towerId + l2 + l3 + l4 + name)`. */
  id: string;
  /**
   * The L5 Activity inventory label — this is the work performed under the
   * parent L4 Activity Group (e.g. "Bank Reconciliations", "Vendor MDM —
   * execution"). Drives the canonical hierarchy and stays stable across
   * regenerations.
   */
  name: string;
  /**
   * AI-initiative-style display title — names what the AI does, NOT the
   * underlying activity. Verb-led / noun-led, 3-7 words. MUST be
   * semantically distinct from `name` (which describes the work). The
   * Step 4 / Step 5 UI uses this as the headline title and renders `name`
   * as the "Underlying activity" subtitle.
   *
   * Examples:
   *   name = "Vendor MDM — execution"   →  initiativeName = "Vendor master data automation"
   *   name = "Bank Reconciliations"      →  initiativeName = "Bank reconciliation auto-match"
   *   name = "MD&A Narrative Drafting"   →  initiativeName = "MD&A first-draft generator"
   *
   * Optional because:
   *   - Legacy snapshots predate the field — readers fall back to `name`.
   *   - `reviewed-not-eligible` items don't have an AI initiative to name.
   *   - Hand-authored canonical seeds may omit it (the LLM authors it on
   *     first regeneration).
   */
  initiativeName?: string;
  source: L5ItemSource;
  /** ISO timestamp; undefined for canonical seeds. */
  generatedAt?: string;
  // ----- Verdict (Stage 2 output) -----
  aiCurationStatus: AiCurationStatus;
  aiEligible: boolean;
  /**
   * @deprecated Per-Activity P1/P2/P3 is no longer the program priority signal.
   * Cross-tower priority comes from `computeProgramTiers()` via the 2x2.
   * Retained here only as a back-compat input to `feasibility` derivation
   * (P1 -> High, P2/P3 -> Low) when an explicit `feasibility` is missing.
   */
  aiPriority?: AiPriority;
  /**
   * Binary ship-readiness signal — feeds the cross-tower 2x2. Optional
   * because legacy snapshots predate the field; readers fall back to
   * `aiPriority` and the rubric/heuristic fallback chain.
   */
  feasibility?: Feasibility;
  /** One-liner Versant-grounded rationale. Required (verdict reasoning). */
  aiRationale: string;
  /** Required when `aiCurationStatus === "reviewed-not-eligible"`. */
  notEligibleReason?: NotEligibleReason;
  // ----- Curation (Stage 3 output, only when `aiEligible`) -----
  frequency?: TowerProcessFrequency;
  criticality?: TowerProcessCriticality;
  currentMaturity?: TowerProcessMaturity;
  /** Named vendor: "BlackLine" / "Amagi" / "Eightfold" / etc. */
  primaryVendor?: string;
  /** One-line agent description. */
  agentOneLine?: string;
  // ----- Optional click-through targets (when an asset exists) -----
  initiativeId?: string;
  briefSlug?: string;
  /** @deprecated Use `generatedProcess` — retained for one-shot migration of older localStorage. */
  generatedBrief?: GeneratedBrief;
  /**
   * Cached full `Process` from the LLM-brief route. When present, the lazy
   * route renders `ProcessExperience` (four-lens) instead of the legacy
   * short brief panels.
   */
  generatedProcess?: GeneratedProcessCache;
};

/**
 * @deprecated Renamed to `L5Item` in the 5-layer migration (the rich-row
 * record now lives on the L5 Activity, not the L4 row that holds the dials).
 * Kept as an alias so files that haven't been swept yet still compile.
 */
export type L4Item = L5Item;

/**
 * Pipeline state stamped onto `L4WorkforceRow.curationStage`. Used by the
 * Capability Map UI to show progress pills + retry affordances.
 */
export type CurationStage =
  | "idle"
  | "queued"
  | "running-l5"
  | "running-verdict"
  | "running-curate"
  | "done"
  | "failed";

/**
 * One L4 Activity Group row in the tower workforce footprint.
 *
 * Tower leads upload a flat list at L4 granularity — one row per
 * (L2 Job Grouping, L3 Job Family, L4 Activity Group) — with onshore/
 * offshore FTE and contractor headcount, plus optional annual spend. The
 * impact-lever step scores each L4 once for offshore-movability and
 * AI-impact headroom.
 *
 * `l5Activities` is a display-only list of activity names that sit under
 * the L4 (e.g., "Invoice processing", "Match-pay-and-extract"). It is:
 *   - seeded from the canonical capability map when the sample is loaded,
 *   - left empty after a tower-lead upload (the upload is L2/L3/L4 only),
 *   - populated post-upload via the "Generate L5 Activities" LLM action.
 *
 * The activity list is purely informational — it never feeds the math.
 *
 * Renamed from the pre-migration `L3WorkforceRow`. The dials, headcount,
 * curation stage, and rationale strings continue to attach to this row —
 * only the layer number shifted (L3 Capability → L4 Activity Group).
 */
export type L4WorkforceRow = {
  id: string;
  /** L2 Job Grouping (NEW intermediate layer added in the 5-layer migration). */
  l2: string;
  /** L3 Job Family (was L2 Pillar). */
  l3: string;
  /** L4 Activity Group (was L3 Capability). Dials + opportunity sizing live on this row. */
  l4: string;
  fteOnshore: number;
  fteOffshore: number;
  contractorOnshore: number;
  contractorOffshore: number;
  /** When present in file, used for $ pool; else derived from headcount × blended rates. */
  annualSpendUsd?: number;
  /**
   * Tower-lead dial: 0–100 share of L4 Activity Group work plausibly
   * offshore-movable. When missing, the tower baseline is used in
   * weighted rollups.
   */
  offshoreAssessmentPct?: number;
  /**
   * Tower-lead dial: 0–100 AI improvement / automation headroom for the L4.
   */
  aiImpactAssessmentPct?: number;
  /**
   * Legacy reference list of L5 Activity labels (display only — not part of
   * the math). Populated from the canonical map at seed time, or generated
   * post-upload via the LLM "Generate L5 Activities" action. Kept for
   * back-compat; once the curation pipeline runs, this field is derived
   * from `l5Items[].name` and the rich `l5Items` array becomes the source
   * of truth for Step 4.
   */
  l5Activities?: string[];
  /**
   * Rich L5 Activity records — each item carries its verdict + curation
   * when the pipeline has run. Empty / undefined until the LLM pipeline
   * populates it; selectors fall through to `l5Activities` and the
   * canonical map until then.
   */
  l5Items?: L5Item[];
  /**
   * Stable hash of `(l2 + l3 + l4 + sorted-list-of-l5-names)`. The pipeline's
   * idempotency key — re-runs skip rows whose hash matches the last
   * successful run. Distinct from per-item `L5Item.id`.
   */
  curationContentHash?: string;
  /** Whole-row pipeline status. */
  curationStage?: CurationStage;
  /** Last-success timestamp; UI uses it to show "X minutes ago". */
  curationGeneratedAt?: string;
  /** Failure detail when `curationStage === "failed"`. */
  curationError?: string;
  /**
   * LLM-produced rationale for the offshore dial (≤15 words, Versant-grounded).
   * Populated by `clientInferTowerDefaults` runs. Falls back to the
   * deterministic `rowStarterRationale` text on heuristic runs. Read by
   * `L4LeverRow`'s offshore popover.
   */
  offshoreRationale?: string;
  /**
   * LLM-produced rationale for the AI-impact dial (≤15 words, Versant-grounded).
   * Sibling to `offshoreRationale` — separate string because the two dials
   * are independent levers and each deserves its own one-liner.
   */
  aiImpactRationale?: string;
  /**
   * Provenance for the dial rationale pair. Drives the chip rendered next
   * to each slider:
   *   - "llm"       → "> AI-scored" purple chip.
   *   - "heuristic" → "> heuristic" subtle chip (LLM unavailable, deterministic
   *                   `applyTowerStarterDefaults` filled in).
   *   - "starter"   → "> starter" low-emphasis chip (deterministic starter
   *                   values from `applyTowerStarterDefaults`, never
   *                   explicitly scored).
   *   - undefined   → no chip; the StaleDialsBanner above tells the user
   *                   the dials are awaiting refresh.
   */
  dialsRationaleSource?: "llm" | "heuristic" | "starter";
  /** ISO timestamp the dial rationale pair was last written. */
  dialsRationaleAt?: string;
  /**
   * Step-5 strict carve-out flag. Set from the Assumptions tab inside the
   * Offshore Plan page. When present, the row is force-classified into the
   * corresponding lane regardless of dial value or LLM judgment.
   *
   *   - `Editorial` → forces `EditorialCarveOut` lane.
   *   - `Talent` / `SOX` / `Sales` → force `OnshoreRetained` lane.
   *
   * `setBy === "seed"` means the flag was pre-populated from the keyword
   * heuristic on first mount (the user has not explicitly confirmed); a user
   * toggle flips it to `setBy === "user"`. Either way the carve-out is honored
   * by the selector — the distinction is only used for the "pre-seeded"
   * indicator in the Assumptions tab.
   */
  offshoreStrictCarveOut?: {
    reason: "Editorial" | "Talent" | "SOX" | "Sales";
    setAt: string;
    setBy: "user" | "seed";
  };
};

/**
 * @deprecated Renamed to `L4WorkforceRow` in the 5-layer migration. Retained
 * as an alias so files that haven't been swept yet still compile. The rename
 * reflects that the dials + sizing now sit on the L4 Activity Group row
 * (was the L3 Capability row).
 */
export type L3WorkforceRow = L4WorkforceRow;

/** Tower-lead anchor dialed once and held steady before stress-test on the summary page. */
export type TowerBaseline = {
  baselineOffshorePct: number;
  baselineAIPct: number;
};

export type TowerAssessStatus = "empty" | "data" | "complete";

/**
 * Per-section "Reviewed" timestamps for the tower-page checklist. All four
 * are explicitly user-clicked — never auto-detected from data — so seeded
 * starter defaults can't trick a lead into Mark-complete without reviewing.
 *
 * Read-side backfill: if `status === "complete"` and any of the four are
 * missing, treat them as confirmed at the same `lastUpdated` timestamp.
 */
export type TowerAssessReview = {
  capabilityMapConfirmedAt?: string;
  /**
   * Set when the tower lead confirms the L1–L5 review from the journey bar on
   * the Capability Map. Locks map/headcount edits until explicit unlock.
   *
   * Renamed from `l1L3TreeValidatedAt` in the 5-layer migration. The
   * v4→v5 migration carries the original timestamp into this field.
   */
  l1L5TreeValidatedAt?: string;
  /**
   * @deprecated Renamed to `l1L5TreeValidatedAt` in the 5-layer migration.
   * Kept as an optional read-side field so v4 snapshots that haven't been
   * migrated yet still surface the confirmation timestamp. Writers should
   * only set `l1L5TreeValidatedAt`.
   */
  l1L3TreeValidatedAt?: string;
  headcountConfirmedAt?: string;
  offshoreConfirmedAt?: string;
  aiConfirmedAt?: string;
  /** Tower lead marked the impact estimate (Step 3) reviewed for this tower. */
  impactEstimateValidatedAt?: string;
  /** Tower lead marked AI initiatives (Step 4) reviewed for this tower. */
  aiInitiativesValidatedAt?: string;
};

/** Per-tower calendar due dates for lead milestones (YYYY-MM-DD). */
export type TowerLeadDeadlines = {
  step1Due?: string;
  step2Due?: string;
  step3Due?: string;
  step4Due?: string;
};

/** Workshop default due-by dates (YYYY-MM-DD); admin and per-tower JSON can override. */
export const DEFAULT_LEAD_DEADLINE_STEP1_YMD = "2026-05-08";
export const DEFAULT_LEAD_DEADLINE_STEP2_YMD = "2026-05-15";
export const DEFAULT_LEAD_DEADLINE_STEP4_YMD = "2026-05-22";

/** One row per canonical tower; merged under stored `leadDeadlines` on read. */
export function buildDefaultProgramLeadDeadlines(): Partial<
  Record<TowerId, TowerLeadDeadlines>
> {
  const row: TowerLeadDeadlines = {
    step1Due: DEFAULT_LEAD_DEADLINE_STEP1_YMD,
    step2Due: DEFAULT_LEAD_DEADLINE_STEP2_YMD,
    step4Due: DEFAULT_LEAD_DEADLINE_STEP4_YMD,
  };
  const out: Partial<Record<TowerId, TowerLeadDeadlines>> = {};
  for (const t of towers) {
    out[t.id] = { ...row };
  }
  return out;
}

/**
 * Tower-lead decision on a single AI initiative (L5 Activity).
 *
 *   - "approved"  — the lead has reviewed the AI idea and confirmed it makes
 *                   sense for this tower. Renders with a "Validated" pill.
 *   - "rejected"  — the lead has reviewed the AI idea and decided it does NOT
 *                   make sense. Filtered out of the AI Initiatives roadmap and
 *                   the L2 → L5 landscape, but preserved here so the lead
 *                   can review and restore it later from the rejected drawer.
 *
 * `pending` is the implicit default — there's no entry in `initiativeReviews`
 * for ideas the lead hasn't decided on yet.
 */
export type InitiativeStatus = "approved" | "rejected";

/**
 * Snapshot of the L5 Activity at decision time. Captured so the rejected
 * drawer can render even if the L5 disappears from the live selector output
 * (e.g. dial moved to 0, capability map regenerated, name drift).
 */
export type InitiativeReviewSnapshot = {
  name: string;
  aiRationale?: string;
  /**
   * @deprecated Captured on legacy snapshots. New snapshots write
   * `feasibility` instead; the rejected drawer falls back to a generic
   * status pill when neither is present.
   */
  aiPriority?: AiPriority;
  /** Binary ship-readiness at the time the lead made the decision. */
  feasibility?: Feasibility;
  /** L2 Job Grouping name at decision time. */
  l2Name: string;
  /** L3 Job Family name at decision time. */
  l3Name: string;
  /** L4 Activity Group name at decision time. */
  l4Name: string;
  /** L4 row id — lets the drawer deep-link to Step 2/3 if dial changes are needed. */
  rowId: string;
};

export type InitiativeReview = {
  status: InitiativeStatus;
  /** ISO timestamp of the last decision (approve / reject). */
  decidedAt: string;
  /** Optional display name, only set when `getDisplayName()` was non-empty. */
  decidedBy?: string;
  snapshot: InitiativeReviewSnapshot;
};

/**
 * Tower lead AI Readiness Intake (Excel). One object per tower; keyed fields
 * mirror the Forge questionnaire template. Persisted on `TowerAssessState`
 * and synced with the rest of `AssessProgramV5`.
 */
export type TowerAiReadinessIntake = {
  systemsPlatforms: string;
  currentAiTools: string;
  experimentsLearnings: string;
  dataRelevant: string;
  constraints: string;
  biggestImpact: string;
  readyNow: string;
  noGoAreas: string;
  /** When the intake was last saved (import or manual). */
  importedAt: string;
  sourceFileName?: string;
  /** Value from the Excel "Tower Name" cell — audit only; binding is app `towerId`. */
  respondentTowerLabel?: string;
};

export type TowerAssessState = {
  l4Rows: L4WorkforceRow[];
  baseline: TowerBaseline;
  /**
   * Per-tower cost rates. Source of truth for every $ in the tower's
   * scenario math (`rowAnnualCost`, `rowModeledSaving`, etc.). Seeded from
   * the workshop pivot via `defaultTowerRates(towerId)` on first read;
   * tower leads can edit on their tower's Configure Impact Levers page.
   *
   * Read-time backfilled in `migrateAssessProgram` when absent so legacy
   * snapshots (pre per-tower rate migration) load cleanly.
   */
  rates: TowerRates;
  status: TowerAssessStatus;
  lastUpdated?: string;
  /**
   * Per-L5 tower-lead validate/reject decisions. Keyed by `InitiativeL5.id`.
   * Strictly additive — older snapshots simply have this undefined and the
   * AI Initiatives view treats every L5 as "pending review."
   *
   * Rides the existing `AssessProgramV5` envelope, so decisions persist
   * to Postgres via `AssessSyncProvider` → `/api/assess` → `assess_workshop`.
   */
  initiativeReviews?: Record<string, InitiativeReview>;
  /**
   * Optional tower-lead questionnaire (Excel import). Drives LLM digest on
   * curation, briefs, and Cross-Tower synthesis; not part of the L4 name hash.
   */
  aiReadinessIntake?: TowerAiReadinessIntake;
} & TowerAssessReview;

export type ChecklistStepId =
  | "capability-map"
  | "headcount"
  | "offshore"
  | "ai"
  | "complete";

/**
 * Per-tower cost rates. Source of truth for every $ in the tower's scenario
 * math (`rowAnnualCost`, `rowModeledSaving`, etc.). Same four-field shape as
 * the (now removed) global assumptions — but each tower owns its own copy on
 * `TowerAssessState.rates`.
 *
 * Tower leads edit these on the Configure Impact Levers page via
 * `TowerRatesCard`; the existing tower-scoped PUT guard ensures a tower lead
 * can only edit their own tower's rates.
 */
export type TowerRates = {
  /** Illustrative $ / FTE-year (user-entered, not Versant-reported). */
  blendedFteOnshore: number;
  blendedFteOffshore: number;
  blendedContractorOnshore: number;
  blendedContractorOffshore: number;
};

/**
 * Per-tower seeded onshore FTE rates. Sourced from the Forge Function Map
 * "Average of Fully Loaded Cost (USD)" workshop pivot, rounded to nearest
 * $100. Offshore = round(onshore / 3); contractor on/off = round(FTE on/off
 * × 0.80) — see `defaultTowerRates`.
 */
const SEEDED_TOWER_FTE_ONSHORE_USD: Record<TowerId, number> = {
  "corp-services": 151_600,
  "editorial-news": 171_500,
  finance: 154_600,
  hr: 164_300,
  legal: 167_000,
  "marketing-comms": 150_000,
  production: 176_000,
  "programming-dev": 135_600,
  "research-analytics": 185_400,
  sales: 122_600,
  service: 76_200,
  "tech-engineering": 208_200,
  "operations-technology": 175_200,
};

const PROGRAM_AVG_FTE_ONSHORE_USD = 165_800;

/** Round a positive number to the nearest $100 — matches the seed precision. */
function roundToHundred(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n / 100) * 100;
}

/**
 * Compute the four seeded per-tower rates for a given tower:
 *   - blendedFteOnshore   = workshop pivot ($ rounded to nearest $100)
 *   - blendedFteOffshore  = round(onshore / 3 / 100) * 100
 *   - blendedContractorOnshore  = round(onshore × 0.80 / 100) * 100
 *   - blendedContractorOffshore = round(offshore × 0.80 / 100) * 100
 *
 * Tower id outside the canonical 13 falls back to the program-wide average
 * onshore rate (so any future tower added without a workshop number still
 * gets sensible defaults).
 */
export function defaultTowerRates(towerId: TowerId): TowerRates {
  const onshore =
    SEEDED_TOWER_FTE_ONSHORE_USD[towerId] ?? PROGRAM_AVG_FTE_ONSHORE_USD;
  const offshore = roundToHundred(onshore / 3);
  return {
    blendedFteOnshore: roundToHundred(onshore),
    blendedFteOffshore: offshore,
    blendedContractorOnshore: roundToHundred(onshore * 0.8),
    blendedContractorOffshore: roundToHundred(offshore * 0.8),
  };
}

/**
 * @deprecated Replaced by per-tower {@link TowerRates} on
 * `TowerAssessState.rates`. The four-field shape is identical, so legacy
 * snapshots that still carry `program.global` are honored once at read-time
 * via `migrateAssessProgram` (any non-default field is copied onto every
 * tower whose rates are still at default seeds).
 */
export type GlobalAssessAssumptions = TowerRates;

/**
 * The exact four-rate defaults that shipped with the previous global-rates
 * platform. Frozen as a historical constant so the legacy → per-tower
 * carry-over in `migrateAssessProgram` can correctly recognize a stored
 * `program.global` that was never customized (and therefore should NOT
 * overwrite the new per-tower workshop-pivot seeds).
 *
 * Do NOT change these numbers. If they ever drift away from what was
 * actually shipped, every existing production workshop will have its
 * per-tower seeds silently replaced with the historical defaults — which
 * is exactly the bug this constant exists to prevent.
 */
export const LEGACY_PROGRAM_GLOBAL_DEFAULTS: GlobalAssessAssumptions = {
  blendedFteOnshore: 180_000,
  blendedFteOffshore: 90_000,
  blendedContractorOnshore: 120_000,
  blendedContractorOffshore: 60_000,
};

/**
 * @deprecated Use {@link defaultTowerRates} for the canonical per-tower
 * defaults. This export is retained only as a stable fallback for the
 * `parseGlobal` back-compat reader in `assessProgramIO.ts` — it returns the
 * historical platform defaults so a missing-or-malformed legacy
 * `program.global` blob parses to the same shape it used to.
 */
export const defaultGlobalAssessAssumptions: GlobalAssessAssumptions =
  LEGACY_PROGRAM_GLOBAL_DEFAULTS;

/**
 * Step-5 (Offshore Plan) editable assumptions.
 *
 * Drives every city-name reference on the Offshore Plan page via
 * `offshoreLocationLabels(program)`. The `chooseDestination()` routing rules
 * stay deterministic — only the *names* are user-configurable.
 *
 * v1 supports primary GCC, secondary GCC (different from primary), and a
 * contact-center hub (or "None" to fold contact rows into primary). Per-tower
 * routing override is intentionally out of scope for v1.
 */
export type IndianGccCity = "Bangalore" | "Pune" | "Hyderabad" | "Chennai";
export type ContactCenterHub = "Manila" | "Cebu" | "Krakow" | "None";

export type OffshoreAssumptions = {
  primaryGccCity: IndianGccCity;
  secondaryGccCity: IndianGccCity;
  contactCenterHub: ContactCenterHub;
  /** ISO timestamp; absent on default state. */
  setAt?: string;
};

export const DEFAULT_OFFSHORE_ASSUMPTIONS: OffshoreAssumptions = {
  primaryGccCity: "Bangalore",
  secondaryGccCity: "Pune",
  contactCenterHub: "Manila",
};

/**
 * V5 program shape — current.
 *
 * V5 inserts a new L2 Job Grouping layer between the L1 Function and the
 * Job Family (was L2 Pillar). The math grain shifts from per-L3 Capability
 * to per-L4 Activity Group rows (renamed `L3WorkforceRow` → `L4WorkforceRow`),
 * and AI initiatives now attach to L5 Activities (was L4). Migration from
 * V4 lives in `localStore.ts` (renames `l3Rows` → `l4Rows`, stamps `l2`
 * with the tower function name from `towerFunctionNames.ts`, renames
 * `l4Activities`/`l4Items` → `l5Activities`/`l5Items`).
 *
 * Per-tower rates: `program.global` was retired in favor of per-tower
 * `TowerAssessState.rates`. The optional `global?` field is retained on the
 * envelope for one release so legacy snapshots / file imports still parse;
 * `migrateAssessProgram` honors any customized values once by copying them
 * onto each tower's `rates`.
 */
export type AssessProgramV5 = {
  version: 5;
  towers: Partial<Record<TowerId, TowerAssessState>>;
  /**
   * @deprecated Removed in the per-tower rates migration. Each
   * `TowerAssessState` now owns its own `rates`. Retained here as optional
   * read-side input only — never written by this app — so legacy snapshots
   * with customized values can be carried over to per-tower rates exactly
   * once at read time.
   */
  global?: GlobalAssessAssumptions;
  /** Program admin: due-by dates per tower for Steps 1–4 (optional). */
  leadDeadlines?: Partial<Record<TowerId, TowerLeadDeadlines>>;
  /**
   * Step-5 (Offshore Plan) editable assumptions. Drives every city-name
   * reference on the Offshore Plan page via `offshoreLocationLabels(program)`.
   * Absent on legacy snapshots — readers default to `DEFAULT_OFFSHORE_ASSUMPTIONS`.
   */
  offshoreAssumptions?: OffshoreAssumptions;
};

/** Back-compat alias — every caller importing `AssessProgramV4` gets V5. */
export type AssessProgramV4 = AssessProgramV5;

/** Back-compat alias — every caller importing `AssessProgramV3` gets V5. */
export type AssessProgramV3 = AssessProgramV5;

/** Back-compat alias — every caller importing `AssessProgramV2` gets V5. */
export type AssessProgramV2 = AssessProgramV5;

export const defaultTowerBaseline: TowerBaseline = {
  baselineOffshorePct: 20,
  baselineAIPct: 15,
};

/**
 * Empty starter `TowerAssessState` for a tower id. Attaches the seeded
 * per-tower rates so the math layer always has a non-zero rate set, even
 * for towers the lead has never visited.
 *
 * The `towerId` argument is required (was no-arg pre per-tower rates) so
 * `defaultTowerRates(towerId)` can pick the right workshop-pivot rate.
 */
export function defaultTowerState(towerId: TowerId): TowerAssessState {
  return {
    l4Rows: [],
    baseline: { ...defaultTowerBaseline },
    rates: defaultTowerRates(towerId),
    status: "empty",
  };
}

export function defaultAssessProgramV2(): AssessProgramV5 {
  return {
    version: 5,
    towers: {},
    leadDeadlines: buildDefaultProgramLeadDeadlines(),
  };
}
