"use client";

import * as React from "react";
import type { Tower } from "@/data/types";
import type {
  TowerId,
  InitiativeReview,
  InitiativeReviewSnapshot,
} from "@/data/assess/types";
import {
  clearInitiativeReview,
  getDisplayName,
  getInitiativeReviews,
  setInitiativeReview,
  subscribe,
} from "@/lib/localStore";
import { useTowerInitiativesV6 } from "./useTowerInitiativesV6";
import type {
  SelectInitiativesV6Result,
  V6InitiativeCard,
  V6L3Row,
} from "./selectV6";

export type InitiativeReviewCountsV6 = {
  approved: number;
  rejected: number;
  pending: number;
};

export type RejectedInitiativeItemV6 = {
  /**
   * `V6InitiativeCard.id` — used as the storage key for `initiativeReviews`
   * (same id space as the `<Link>` target, so deep-linking back into the
   * deep-dive route is one lookup away).
   */
  initId: string;
  review: InitiativeReview;
};

export type UseInitiativeReviewsV6Result = {
  /**
   * V6 selector output with rejected initiative cards filtered out of
   * every `V6L3Row.initiatives`. When all real cards under a row get
   * rejected we synthesize an "all rejected" placeholder so the row's
   * AI dial isn't silently dropped from the gallery — mirrors the v5
   * `buildAllRejectedPlaceholder` contract.
   */
  result: SelectInitiativesV6Result;
  /** Raw decisions for this tower, keyed by `V6InitiativeCard.id`. */
  reviews: Record<string, InitiativeReview>;
  /** Rejected items for the drawer (sorted newest decision first). */
  rejectedItems: RejectedInitiativeItemV6[];
  /**
   * Tally rendered by `<InitiativeReviewChip>`. Always reflects the
   * unfiltered tower so the chip totals don't drop when the lead
   * rejects (rejected stays in the count).
   */
  counts: InitiativeReviewCountsV6;
  actions: {
    approve: (init: V6InitiativeCard, row: V6L3Row) => void;
    reject: (init: V6InitiativeCard, row: V6L3Row) => void;
    restore: (initId: string) => void;
    revertToPending: (initId: string) => void;
  };
};

/**
 * v6 sibling of `useInitiativeReviews` — applies tower-lead validate /
 * reject decisions to the V6 AI Solutions gallery.
 *
 * Why a separate hook instead of reusing the v5 one?
 *   - The v5 hook is keyed by `InitiativeL4.id` (Activity-Group level),
 *     while v6 cards are at L3-Initiative grain (`L3Initiative.id` ⇒
 *     `V6InitiativeCard.id`). Mixing them in one map would require
 *     callers to know the schema and pass the right id.
 *   - The two id spaces are disjoint so they coexist in the same
 *     `initiativeReviews` map — v5 surfaces (operating-model deep dive,
 *     `<AiRoadmap>`, `<ProcessLandscape>`) keep working unchanged, and
 *     the v6 surfaces (`<SolutionsGallery>`, `<SolutionCardV2>`) read
 *     only their own keys.
 *
 * Storage shape: `Record<string, InitiativeReview>` on
 * `tState.initiativeReviews` — the same Postgres-synced field used by
 * v5. Keys are opaque strings so we can mix v5 L4 ids and v6 card ids
 * without schema gymnastics.
 *
 * Filter semantics:
 *   - Rejected cards are removed from `result.l3Rows[i].initiatives`.
 *   - `diagnostics.initiativesRendered` is decremented to match.
 *   - When every real card under a row is rejected, an "all rejected"
 *     placeholder is appended so the row's headcount + AI dial don't
 *     get silently dropped from the gallery.
 *
 * Counts semantics:
 *   - `approved` and `rejected` come from the reviews map.
 *   - `pending` = unfiltered real V6 cards in the tower minus decided.
 */
export function useInitiativeReviewsV6(
  tower: Tower,
): UseInitiativeReviewsV6Result {
  const baseResult = useTowerInitiativesV6(tower);
  const towerId = tower.id as TowerId;
  const [reviews, setReviews] = React.useState<
    Record<string, InitiativeReview>
  >(() => ({}));

  React.useEffect(() => {
    setReviews(getInitiativeReviews(towerId));
    return subscribe("assessProgram", () => {
      setReviews(getInitiativeReviews(towerId));
    });
  }, [towerId]);

  return React.useMemo<UseInitiativeReviewsV6Result>(() => {
    let removedFromRendered = 0;

    const filteredRows: V6L3Row[] = baseResult.l3Rows.map((row) => {
      const kept: V6InitiativeCard[] = [];
      let realKept = 0;
      let realRejected = 0;
      for (const init of row.initiatives) {
        const rev = reviews[init.id];
        if (rev?.status === "rejected") {
          if (!init.isPlaceholder) {
            removedFromRendered += 1;
            realRejected += 1;
          }
          continue;
        }
        kept.push(init);
        if (!init.isPlaceholder) realKept += 1;
      }
      // If every real initiative under this row was rejected and the row
      // still has an AI dial, surface a soft placeholder so the row stays
      // in the gallery for restore-from-drawer.
      if (realKept === 0 && realRejected > 0 && row.aiUsd > 0) {
        kept.push(buildAllRejectedV6Placeholder(row.id));
      }
      return { ...row, initiatives: kept };
    });

    const result: SelectInitiativesV6Result = {
      ...baseResult,
      l3Rows: filteredRows,
      diagnostics: {
        ...baseResult.diagnostics,
        initiativesRendered: Math.max(
          0,
          baseResult.diagnostics.initiativesRendered - removedFromRendered,
        ),
      },
    };

    const rejectedItems: RejectedInitiativeItemV6[] = Object.entries(reviews)
      .filter(
        (entry): entry is [string, InitiativeReview] =>
          entry[1].status === "rejected",
      )
      .map(([initId, review]) => ({ initId, review }))
      .sort((a, b) => b.review.decidedAt.localeCompare(a.review.decidedAt));

    let approved = 0;
    let rejected = 0;
    for (const r of Object.values(reviews)) {
      if (r.status === "approved") approved += 1;
      else if (r.status === "rejected") rejected += 1;
    }
    let totalActive = 0;
    for (const row of baseResult.l3Rows) {
      for (const init of row.initiatives) {
        if (!init.isPlaceholder) totalActive += 1;
      }
    }
    const decided = approved + rejected;
    const pending = Math.max(0, totalActive - decided);

    const actions = {
      approve: (init: V6InitiativeCard, row: V6L3Row) => {
        if (init.isPlaceholder) return;
        setInitiativeReview(
          towerId,
          init.id,
          "approved",
          buildSnapshotV6(init, row),
          getDisplayName() || undefined,
        );
      },
      reject: (init: V6InitiativeCard, row: V6L3Row) => {
        if (init.isPlaceholder) return;
        setInitiativeReview(
          towerId,
          init.id,
          "rejected",
          buildSnapshotV6(init, row),
          getDisplayName() || undefined,
        );
      },
      restore: (initId: string) => {
        clearInitiativeReview(towerId, initId);
      },
      revertToPending: (initId: string) => {
        clearInitiativeReview(towerId, initId);
      },
    };

    return {
      result,
      reviews,
      rejectedItems,
      counts: { approved, rejected, pending },
      actions,
    };
  }, [baseResult, reviews, towerId]);
}

/**
 * Build the snapshot stored alongside an approve / reject decision. We
 * capture enough Versant-grounded context that the rejected drawer
 * can render even after the live initiative drifts (rename, dial-zero,
 * curation refresh, etc.).
 */
function buildSnapshotV6(
  init: V6InitiativeCard,
  row: V6L3Row,
): InitiativeReviewSnapshot {
  const snap: InitiativeReviewSnapshot = {
    name: init.solutionName,
    l2Name: row.l2,
    l3Name: row.l3,
    // V6 cards span 1..N L4 Activity Groups. Capture the count + parent
    // names instead of pretending there's a single L4 — keeps the rejected
    // drawer honest about what the lead actually said no to.
    l4Name:
      init.coversL4RowIds.length > 0
        ? `covers ${init.coversL4RowIds.length} Activity Group${init.coversL4RowIds.length === 1 ? "" : "s"}`
        : "covers full Job Family",
    rowId: row.id,
  };
  if (init.aiRationale) snap.aiRationale = init.aiRationale;
  if (init.feasibility) snap.feasibility = init.feasibility;
  return snap;
}

/**
 * Soft placeholder appended to a row whose every real initiative the
 * lead has rejected. Keeps the row visible in the gallery so they can
 * restore from the drawer or zero the AI dial on Step 2 instead of
 * silently dropping headcount-bearing scope.
 */
function buildAllRejectedV6Placeholder(rowId: string): V6InitiativeCard {
  return {
    id: `${rowId}::all-rejected`,
    solutionName: "All AI ideas rejected for this Job Family",
    tagline:
      "Every AI Solution generated for this row has been rejected. Restore one from the Rejected ideas drawer or zero this row's AI dial on Configure Impact Levers.",
    aiRationale: "",
    coversL4RowIds: [],
    isPlaceholder: true,
  };
}
