import type {
  AiPriority,
  Tower,
  TowerProcessCriticality,
  TowerProcessFrequency,
  TowerProcessMaturity,
} from "@/data/types";
import type { AiCurationStatus } from "@/data/capabilityMap/types";

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
  headcountConfirmedAt?: string;
  offshoreConfirmedAt?: string;
  aiConfirmedAt?: string;
};

export type TowerAssessState = {
  l3Rows: L3WorkforceRow[];
  baseline: TowerBaseline;
  status: TowerAssessStatus;
  lastUpdated?: string;
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
  };
}
