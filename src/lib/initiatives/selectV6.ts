/**
 * AI Initiatives selector — v6 sibling of `select.ts`.
 *
 * Under v6 the data model collapsed two layers: AI initiatives are now
 * authored at the **L3 Job Family** grain, with 0..N specific
 * `L3Initiative` AI Solutions per row. The selector therefore loops
 * `tState.l3Rows` once and joins each row with its `l3Initiatives` —
 * no canonical-map walk, no overlay/composer/rubric, no L5 Activity
 * fan-out, no fuzzy-match plumbing. The dial-bearing row IS the
 * presentation grain.
 *
 * ───────────────────────────────────────────────────────────────────────
 *   Financial integrity contract
 * ───────────────────────────────────────────────────────────────────────
 * Per-row $ flow through `rowAnnualCost` + `rowModeledSaving` from
 * `lib/assess/scenarioModel.ts`, exactly as on v5. The tower roll-up is
 * `modeledSavingsForTower` over the L3 rows. Initiative cards do NOT
 * receive their own dollar attribution — modeled $ stays on the L3 row
 * (the dial-bearing layer); initiative cards inherit context only.
 *
 * ───────────────────────────────────────────────────────────────────────
 *   Filtering rules
 * ───────────────────────────────────────────────────────────────────────
 *   - L3 Job Family renders only when `aiPct > 0` AFTER applying its
 *     row override (or the tower baseline when no override).
 *   - When a row has dial > 0 but no `l3Initiatives` (queued or
 *     LLM-empty result), we surface a placeholder card so the row stays
 *     visible and its $ stays attributed.
 */
import type { Feasibility, Tower } from "@/data/types";
import type {
  AssessProgramV2,
  L3Initiative,
  L3WorkforceRowV6,
  TowerId,
} from "@/data/assess/types";
import { defaultTowerBaseline, defaultTowerRates } from "@/data/assess/types";
import {
  modeledSavingsForTower,
  rowModeledSaving,
} from "@/lib/assess/scenarioModel";

// ===========================================================================
//   View-model types
// ===========================================================================

export type V6InitiativeCard = {
  /** Stable id from `L3Initiative.id` (or synthesized for placeholder cards). */
  id: string;
  /**
   * Specific AI Solution name — descriptive, self-explanatory product
   * label (e.g. "Intercompany Close Reconciliation Co-Pilot"). The
   * curator LLM + validator enforce that the name reads like a clear
   * 5-10 word title (not an opaque codename).
   */
  solutionName: string;
  /** One-sentence elevator pitch. Always present on real initiatives. */
  tagline: string;
  /** Why this row is AI-eligible — Versant-grounded justification. */
  aiRationale: string;
  /** Binary ship-readiness — feeds the cross-tower 2x2 (Phase 6). */
  feasibility?: Feasibility;
  /** Named vendor when one is anchored (e.g. "Descript"). */
  primaryVendor?: string;
  /**
   * Lucide icon key picked by the curator LLM from the curated allowlist
   * in `src/lib/initiatives/solutionIconAllowlist.ts`. Optional — the
   * `SolutionIcon` component falls back to a feasibility-based default
   * (Rocket / Compass) when missing or off-allowlist.
   */
  iconKey?: string;
  /**
   * L4 row ids this initiative spans inside its parent L3 (context).
   * Empty array means "covers the whole L3" — every child L4. UI
   * renders "covers N of M Activity Groups" using this.
   */
  coversL4RowIds: string[];
  /** True when synthesized for ghost-row prevention (no real initiative). */
  isPlaceholder: boolean;
  /**
   * Lazy click-through to the full 4-lens deep-dive. Resolves to
   * `/tower/[slug]/initiative/[l3RowId]/[initiativeId]` (Phase 7 route
   * rename). The page generates the full `Process` on first visit and
   * caches the result on `L3Initiative.generatedProcess`. Undefined for
   * placeholders.
   */
  initiativeHref?: string;
  /**
   * Prompt version the initiative was authored under. Used by the
   * "AI naming was upgraded" hint on `RegenerateAiGuidanceToolbar` so
   * legacy cache (no `promptVersion` or an older one) can be flagged
   * for refresh without erasing the existing entry.
   */
  promptVersion?: string;
};

export type V6L3Row = {
  /** `L3WorkforceRowV6.id` — stable across re-derivations. */
  id: string;
  /** L2 Job Grouping the row sits under (denormalized for headers). */
  l2: string;
  /** L3 Job Family — the row name. */
  l3: string;
  /** Aggregated headcount across all child L4 rows. */
  headcount: number;
  /** Pool $ — sum of child L4 row annual costs. */
  poolUsd: number;
  /** Effective AI dial (override → baseline). */
  aiPct: number;
  /** Effective offshore dial (override → baseline). */
  offshorePct: number;
  /** Modeled AI $ for this row (single source of truth). */
  aiUsd: number;
  /** Modeled offshore $ for this row. */
  offshoreUsd: number;
  /** Combined offshore + AI savings (sequential combine). */
  combinedUsd: number;
  /** Curation lifecycle — drives the per-row badge / refresh affordance. */
  curationStage?: L3WorkforceRowV6["curationStage"];
  curationError?: string;
  /** Child L4 Activity Group names (in order) — context chips. */
  childL4Names: string[];
  /** AI Solution cards generated for this row. */
  initiatives: V6InitiativeCard[];
};

export type SelectInitiativesV6Result = {
  towerId: TowerId;
  /** Tower-wide modeled AI $ — equals sum of `l3Rows.aiUsd`. */
  towerAiUsd: number;
  /** Tower-wide pool $ across every L3 row. */
  towerPoolUsd: number;
  /** Cost-weighted AI dial across the tower. */
  towerAiPct: number;
  l3Rows: V6L3Row[];
  diagnostics: {
    /** Rows with `aiPct === 0` — excluded from the rendered list. */
    rowsWithDialZero: number;
    /** Rows where dial > 0 but no real initiative surfaced (placeholder). */
    placeholderRows: number;
    /** Rows in `curationStage: "queued"` — refresh CTA target. */
    queuedRowCount: number;
    /** Total row count for the tower (including dial-zero rows). */
    totalRowCount: number;
    /** Total real (non-placeholder) initiative cards rendered. */
    initiativesRendered: number;
  };
};

// ===========================================================================
//   Selector
// ===========================================================================

/**
 * Build the v6 AI Initiatives view-model for one tower.
 *
 * Pure function of `(towerId, program, tower)` — no side effects, safe
 * during SSR. By construction `sum-of-l3Rows.aiUsd === modeledSavingsForTower(...).ai`
 * for every row whose `aiPct > 0`.
 *
 * `tower` is retained on the signature for parity with the v5 selector
 * (and for any future overlay re-introduction) but is intentionally
 * unused under v6 — initiatives ship from `l3Rows` alone.
 */
export function selectInitiativesV6ForTower(
  towerId: TowerId,
  program: AssessProgramV2,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _tower: Tower,
): SelectInitiativesV6Result {
  const towerState = program.towers[towerId];
  const baseline = towerState?.baseline ?? defaultTowerBaseline;
  const rates = towerState?.rates ?? defaultTowerRates(towerId);
  const l3Rows: L3WorkforceRowV6[] = towerState?.l3Rows ?? [];
  const l4Rows = towerState?.l4Rows ?? [];

  const l4ById = new Map(l4Rows.map((r) => [r.id, r]));

  let rowsWithDialZero = 0;
  let placeholderRows = 0;
  let initiativesRendered = 0;

  const view: V6L3Row[] = [];

  for (const row of l3Rows) {
    const saving = rowModeledSaving(row, baseline, rates);
    if (saving.aiPct <= 0) {
      rowsWithDialZero += 1;
      continue;
    }

    const childL4Names = row.childL4RowIds
      .map((id) => l4ById.get(id)?.l4)
      .filter((s): s is string => !!s);

    const cards: V6InitiativeCard[] = [];
    if (row.l3Initiatives && row.l3Initiatives.length > 0) {
      for (const init of row.l3Initiatives) {
        cards.push(buildCardFromInitiative(init, towerId, row.id));
        initiativesRendered += 1;
      }
    } else if (row.curationStage !== "queued") {
      // Dial > 0, not queued, but the LLM produced no solutions and
      // the row isn't waiting for a refresh — surface a placeholder so
      // the row stays visible and its modeled $ stays attributed.
      cards.push(buildPlaceholderCard(row));
      placeholderRows += 1;
    }
    // Queued rows render with an empty `initiatives: []` — the
    // StaleCurationBanner above the list owns the refresh CTA.

    view.push({
      id: row.id,
      l2: row.l2,
      l3: row.l3,
      headcount:
        row.fteOnshore +
        row.fteOffshore +
        row.contractorOnshore +
        row.contractorOffshore,
      poolUsd: saving.pool,
      aiPct: saving.aiPct,
      offshorePct: saving.offshorePct,
      aiUsd: saving.ai,
      offshoreUsd: saving.offshore,
      combinedUsd: saving.combined,
      curationStage: row.curationStage,
      curationError: row.curationError,
      childL4Names,
      initiatives: cards,
    });
  }

  const towerSummary = l3Rows.length
    ? modeledSavingsForTower(l3Rows, baseline, rates)
    : { pool: 0, offshorePct: 0, aiPct: 0, offshore: 0, ai: 0, combined: 0 };

  const queuedRowCount = l3Rows.filter(
    (r) => r.curationStage === "queued",
  ).length;

  return {
    towerId,
    towerAiUsd: towerSummary.ai,
    towerPoolUsd: towerSummary.pool,
    towerAiPct: towerSummary.aiPct,
    l3Rows: view,
    diagnostics: {
      rowsWithDialZero,
      placeholderRows,
      queuedRowCount,
      totalRowCount: l3Rows.length,
      initiativesRendered,
    },
  };
}

// ===========================================================================
//   Helpers
// ===========================================================================

function buildCardFromInitiative(
  init: L3Initiative,
  towerId: TowerId,
  l3RowId: string,
): V6InitiativeCard {
  return {
    id: init.id,
    solutionName: init.solutionName,
    tagline: init.tagline,
    aiRationale: init.aiRationale,
    feasibility: init.feasibility,
    primaryVendor: init.primaryVendor,
    iconKey: init.iconKey,
    coversL4RowIds: init.coversL4RowIds ?? [],
    isPlaceholder: false,
    initiativeHref: `/tower/${towerId}/initiative/${encodeURIComponent(l3RowId)}/${encodeURIComponent(init.id)}`,
    promptVersion: init.promptVersion,
  };
}

function buildPlaceholderCard(row: L3WorkforceRowV6): V6InitiativeCard {
  return {
    id: `${row.id}-placeholder`,
    solutionName: "AI Solutions pending discovery",
    tagline:
      "AI couldn't surface a specific solution for this Job Family yet. Re-score the Activity Groups underneath, or reduce the AI dial to zero on Step 2.",
    aiRationale:
      "Placeholder — re-run the AI Initiatives refresh from the banner above to generate a Versant-specific solution name and brief.",
    coversL4RowIds: row.childL4RowIds,
    isPlaceholder: true,
  };
}
