import type {
  AiPriority,
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
 * `docs/context.md` §9 — every `reviewed-not-eligible` L4 must fall
 * back to one of these strings (LLM paraphrase is rejected).
 */
export type NotEligibleReason =
  | "Requires human editorial judgment"
  | "Fundamentally relationship-driven"
  | "Already automated via existing tools"
  | "Low volume — ROI doesn't justify AI investment"
  | "Strategic exercise requiring executive judgment";

/**
 * Provenance tag for a rich L4 record: where the verdict + curation came from.
 * Drives diagnostics + future "regenerate stale" sweeps.
 */
export type L4ItemSource = "canonical" | "llm" | "fallback" | "manual";

/**
 * Lazily-generated short brief for L4s (legacy v1). Superseded by
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
 * Rich L4 record on `L3WorkforceRow`. Source of truth for AI Initiatives view —
 * each item carries its verdict (Stage 2 output) and, when eligible, its
 * curation (Stage 3 output). Phase 1 (this PR) ships the shape; the LLM
 * pipeline that populates it lands in PR 2. Until then, the selector falls
 * through to `l4Activities` strings or canonical-map L4s.
 */
export type L4Item = {
  /** Stable id — hash of `(towerId + l2 + l3 + name)`. */
  id: string;
  name: string;
  source: L4ItemSource;
  /** ISO timestamp; undefined for canonical seeds. */
  generatedAt?: string;
  // ----- Verdict (Stage 2 output) -----
  aiCurationStatus: AiCurationStatus;
  aiEligible: boolean;
  aiPriority?: AiPriority;
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
 * Pipeline state stamped onto `L3WorkforceRow.curationStage`. Used by the
 * Capability Map UI to show progress pills + retry affordances.
 */
export type CurationStage =
  | "idle"
  | "queued"
  | "running-l4"
  | "running-verdict"
  | "running-curate"
  | "done"
  | "failed";

/**
 * One L3 (sub-capability) row in the tower workforce footprint.
 *
 * Tower leads upload a flat list at L3 granularity — one row per
 * (L2 pillar, L3 capability) — with onshore/offshore FTE and contractor
 * headcount, plus optional annual spend. The impact-lever step scores
 * each L3 once for offshore-movability and AI-impact headroom.
 *
 * `l4Activities` is a display-only list of activity names that sit under
 * the L3 (e.g., "Invoice processing", "Match-pay-and-extract"). It is:
 *   - seeded from the canonical capability map when the sample is loaded,
 *   - left empty after a tower-lead upload (the upload is L2/L3 only),
 *   - populated post-upload via the "Generate L4 activities" LLM action.
 *
 * The activity list is purely informational — it never feeds the math.
 */
export type L3WorkforceRow = {
  id: string;
  l2: string;
  l3: string;
  fteOnshore: number;
  fteOffshore: number;
  contractorOnshore: number;
  contractorOffshore: number;
  /** When present in file, used for $ pool; else derived from headcount × blended rates. */
  annualSpendUsd?: number;
  /**
   * Tower-lead dial: 0–100 share of L3 work plausibly offshore-movable.
   * When missing, the tower baseline is used in weighted rollups.
   */
  offshoreAssessmentPct?: number;
  /**
   * Tower-lead dial: 0–100 AI improvement / automation headroom for the L3.
   */
  aiImpactAssessmentPct?: number;
  /**
   * Legacy reference list of L4 activity labels (display only — not part of
   * the math). Populated from the canonical map at seed time, or generated
   * post-upload via the LLM "Generate L4 activities" action. Kept for
   * back-compat; once the curation pipeline (PR 2) lands, this field is
   * derived from `l4Items.name` and the rich `l4Items` array becomes the
   * source of truth for Step 4.
   */
  l4Activities?: string[];
  /**
   * Rich L4 records — each item carries its verdict + curation when the
   * pipeline has run. Empty / undefined until the LLM pipeline (PR 2)
   * populates it; selectors fall through to `l4Activities` and the
   * canonical map until then.
   */
  l4Items?: L4Item[];
  /**
   * Stable hash of `(l2 + l3 + sorted-list-of-l4-names)`. The pipeline's
   * idempotency key — re-runs skip rows whose hash matches the last
   * successful run. Distinct from per-item `L4Item.id`.
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
   * `L3LeverRow`'s offshore popover.
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
   *   - "starter"   → "> starter" low-emphasis chip (sample-loaded seed
   *                   values, never explicitly scored).
   *   - undefined   → no chip; the StaleDialsBanner above tells the user
   *                   the dials are awaiting refresh.
   */
  dialsRationaleSource?: "llm" | "heuristic" | "starter";
  /** ISO timestamp the dial rationale pair was last written. */
  dialsRationaleAt?: string;
};

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
   * Set when the tower lead confirms the L1–L3 review from the journey bar on
   * the Capability Map. Locks map/headcount edits until explicit unlock.
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
 * Tower-lead decision on a single AI initiative (L4 activity).
 *
 *   - "approved"  — the lead has reviewed the AI idea and confirmed it makes
 *                   sense for this tower. Renders with a "Validated" pill.
 *   - "rejected"  — the lead has reviewed the AI idea and decided it does NOT
 *                   make sense. Filtered out of the AI Initiatives roadmap and
 *                   the L2 → L3 → L4 landscape, but preserved here so the lead
 *                   can review and restore it later from the rejected drawer.
 *
 * `pending` is the implicit default — there's no entry in `initiativeReviews`
 * for ideas the lead hasn't decided on yet.
 */
export type InitiativeStatus = "approved" | "rejected";

/**
 * Snapshot of the L4 activity at decision time. Captured so the rejected
 * drawer can render even if the L4 disappears from the live selector output
 * (e.g. dial moved to 0, capability map regenerated, name drift).
 */
export type InitiativeReviewSnapshot = {
  name: string;
  aiRationale?: string;
  aiPriority?: AiPriority;
  l2Name: string;
  l3Name: string;
  /** L3 row id — lets the drawer deep-link to Step 2 if dial changes are needed. */
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

export type TowerAssessState = {
  l3Rows: L3WorkforceRow[];
  baseline: TowerBaseline;
  status: TowerAssessStatus;
  lastUpdated?: string;
  /**
   * Per-L4 tower-lead validate/reject decisions. Keyed by `InitiativeL4.id`.
   * Strictly additive — older snapshots simply have this undefined and the
   * AI Initiatives view treats every L4 as "pending review."
   *
   * Rides the existing `AssessProgramV4` envelope, so decisions persist
   * to Postgres via `AssessSyncProvider` → `/api/assess` → `assess_workshop`.
   */
  initiativeReviews?: Record<string, InitiativeReview>;
} & TowerAssessReview;

export type ChecklistStepId =
  | "capability-map"
  | "headcount"
  | "offshore"
  | "ai"
  | "complete";

/**
 * Global assumptions for the Configure Impact Levers flow. These are the ONLY
 * knobs on the Assumptions tab and the ONLY rates the savings math reads.
 *
 * Every $ in the app is derived from these four rates plus per-L3 headcount
 * mix and per-L3 dials. No magic lever weights, no caps, no combine-mode
 * toggles — see `scenarioModel.ts` for the math.
 */
export type GlobalAssessAssumptions = {
  /** Illustrative $ / FTE-year (user-entered, not Versant-reported). */
  blendedFteOnshore: number;
  blendedFteOffshore: number;
  blendedContractorOnshore: number;
  blendedContractorOffshore: number;
};

export const defaultGlobalAssessAssumptions: GlobalAssessAssumptions = {
  blendedFteOnshore: 180_000,
  blendedFteOffshore: 90_000,
  blendedContractorOnshore: 120_000,
  blendedContractorOffshore: 60_000,
};

/**
 * V4 program shape — current.
 *
 * V4 collapses the per-L4 workforce footprint into per-L3 rows. The math now
 * runs at L3 granularity (headcount, dials, savings) and L4 activity names
 * are a display-only reference list on each L3 row. Migration from V3 lives
 * in `localStore.ts` (groups old `l4Rows` by L2+L3, sums headcount, cost-
 * weighted-averages percentages, and preserves L4 names in `l4Activities`).
 */
export type AssessProgramV4 = {
  version: 4;
  towers: Partial<Record<TowerId, TowerAssessState>>;
  global: GlobalAssessAssumptions;
  /** Program admin: due-by dates per tower for Steps 1–4 (optional). */
  leadDeadlines?: Partial<Record<TowerId, TowerLeadDeadlines>>;
};

/** Back-compat alias — every caller importing `AssessProgramV3` gets V4. */
export type AssessProgramV3 = AssessProgramV4;

/** Back-compat alias — every caller importing `AssessProgramV2` gets V4. */
export type AssessProgramV2 = AssessProgramV4;

export const defaultTowerBaseline: TowerBaseline = {
  baselineOffshorePct: 20,
  baselineAIPct: 15,
};

export function defaultTowerState(): TowerAssessState {
  return {
    l3Rows: [],
    baseline: { ...defaultTowerBaseline },
    status: "empty",
  };
}

export function defaultAssessProgramV2(): AssessProgramV4 {
  return {
    version: 4,
    towers: {},
    global: { ...defaultGlobalAssessAssumptions },
    leadDeadlines: buildDefaultProgramLeadDeadlines(),
  };
}
