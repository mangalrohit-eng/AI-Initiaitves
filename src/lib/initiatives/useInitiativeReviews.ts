"use client";

import * as React from "react";
import type { Tower, AiPriority } from "@/data/types";
import type { TowerId, InitiativeReview, InitiativeReviewSnapshot } from "@/data/assess/types";
import {
  clearInitiativeReview,
  getDisplayName,
  getInitiativeReviews,
  setInitiativeReview,
  subscribe,
} from "@/lib/localStore";
import { useTowerInitiatives } from "./useTowerInitiatives";
import type {
  InitiativeL2,
  InitiativeL3,
  InitiativeL4,
  SelectInitiativesResult,
} from "./select";

export type InitiativeReviewCounts = {
  approved: number;
  rejected: number;
  pending: number;
};

export type RejectedInitiativeItem = {
  l4Id: string;
  review: InitiativeReview;
};

export type UseInitiativeReviewsResult = {
  /**
   * Tower view-model with rejected L4s filtered out of every `InitiativeL3.l4s`
   * and `InitiativeL2.curatedL4Count` adjusted to match. `towerAiUsd`,
   * `l3.aiUsd`, and `l2.totalAiUsd` are NOT changed — the financial-integrity
   * contract from `select.ts` is preserved (rejection only hides the L4 row,
   * never moves the dial).
   */
  result: SelectInitiativesResult;
  /** Raw decisions for this tower, keyed by `InitiativeL4.id`. */
  reviews: Record<string, InitiativeReview>;
  /** Rejected items for the drawer (sorted newest decision first). */
  rejectedItems: RejectedInitiativeItem[];
  /** Tally for the section-header chip — always reflects the unfiltered tower. */
  counts: InitiativeReviewCounts;
  actions: {
    approve: (l4: InitiativeL4, l3: InitiativeL3) => void;
    reject: (l4: InitiativeL4, l3: InitiativeL3) => void;
    restore: (l4Id: string) => void;
    revertToPending: (l4Id: string) => void;
  };
};

/**
 * AI Initiatives view-model with tower-lead validate/reject decisions
 * applied. Wraps `useTowerInitiatives` and reads `initiativeReviews` off the
 * AssessProgramV4 envelope, so decisions ride the existing localStorage +
 * Postgres sync and persist across sessions / browsers / teammates.
 *
 * Shape contract:
 *   - `result.l2s[i].l3s[j].l4s` excludes rejected L4s.
 *   - `result.l2s[i].curatedL4Count` is decremented per rejected L4.
 *   - When all L4s under an L3 get filtered out and the L3 still has
 *     `aiUsd > 0`, a synthesized "all-rejected" placeholder is appended so
 *     the L3 row stays visible (mirrors the existing ghost-L3 prevention).
 *   - $ totals (`l3.aiUsd`, `l2.totalAiUsd`, `result.towerAiUsd`) are never
 *     touched — those track Step 2 dials via `scenarioModel.ts`.
 */
export function useInitiativeReviews(tower: Tower): UseInitiativeReviewsResult {
  const baseResult = useTowerInitiatives(tower);
  const [reviews, setReviews] = React.useState<Record<string, InitiativeReview>>(() => ({}));

  React.useEffect(() => {
    setReviews(getInitiativeReviews(tower.id as TowerId));
    return subscribe("assessProgram", () => {
      setReviews(getInitiativeReviews(tower.id as TowerId));
    });
  }, [tower.id]);

  return React.useMemo<UseInitiativeReviewsResult>(() => {
    const towerId = tower.id as TowerId;

    const filteredL2s: InitiativeL2[] = baseResult.l2s.map((l2) => {
      let removedFromCurated = 0;
      const filteredL3s: InitiativeL3[] = l2.l3s.map((l3) => {
        const kept: InitiativeL4[] = [];
        for (const l4 of l3.l4s) {
          const rev = reviews[l4.id];
          if (rev?.status === "rejected") {
            if (!l4.isPlaceholder) removedFromCurated += 1;
            continue;
          }
          kept.push(l4);
        }
        // Ghost-L3 prevention parity: if filtering emptied the L3 but the
        // dial still attributes $, surface a "all-rejected" placeholder so
        // the L3 row stays visible and the user can either restore an idea
        // from the drawer or zero the dial on Step 2.
        if (kept.length === 0 && l3.aiUsd > 0) {
          kept.push(buildAllRejectedPlaceholder(l3.rowId, l3.aiPct));
        }
        return { ...l3, l4s: kept };
      });

      return {
        ...l2,
        l3s: filteredL3s,
        curatedL4Count: Math.max(0, l2.curatedL4Count - removedFromCurated),
      };
    });

    const result: SelectInitiativesResult = {
      ...baseResult,
      l2s: filteredL2s,
    };

    const rejectedItems: RejectedInitiativeItem[] = Object.entries(reviews)
      .filter((entry): entry is [string, InitiativeReview] => entry[1].status === "rejected")
      .map(([l4Id, review]) => ({ l4Id, review }))
      .sort((a, b) => b.review.decidedAt.localeCompare(a.review.decidedAt));

    let approved = 0;
    let rejected = 0;
    for (const r of Object.values(reviews)) {
      if (r.status === "approved") approved += 1;
      else if (r.status === "rejected") rejected += 1;
    }
    // Pending = total non-placeholder L4s currently in scope MINUS those with
    // a decision. Counting against the unfiltered base so the chip totals
    // don't drop when the user rejects (rejected stays in the count).
    let totalActiveL4s = 0;
    for (const l2 of baseResult.l2s) {
      for (const l3 of l2.l3s) {
        for (const l4 of l3.l4s) {
          if (!l4.isPlaceholder) totalActiveL4s += 1;
        }
      }
    }
    const decided = approved + rejected;
    const pending = Math.max(0, totalActiveL4s - decided);

    const actions = {
      approve: (l4: InitiativeL4, l3: InitiativeL3) => {
        if (l4.isPlaceholder) return;
        setInitiativeReview(
          towerId,
          l4.id,
          "approved",
          buildSnapshot(l4, l3),
          getDisplayName() || undefined,
        );
      },
      reject: (l4: InitiativeL4, l3: InitiativeL3) => {
        if (l4.isPlaceholder) return;
        setInitiativeReview(
          towerId,
          l4.id,
          "rejected",
          buildSnapshot(l4, l3),
          getDisplayName() || undefined,
        );
      },
      restore: (l4Id: string) => {
        clearInitiativeReview(towerId, l4Id);
      },
      revertToPending: (l4Id: string) => {
        clearInitiativeReview(towerId, l4Id);
      },
    };

    return { result, reviews, rejectedItems, counts: { approved, rejected, pending }, actions };
  }, [baseResult, reviews, tower.id]);
}

function buildSnapshot(l4: InitiativeL4, l3: InitiativeL3): InitiativeReviewSnapshot {
  const snap: InitiativeReviewSnapshot = {
    name: l4.name,
    l2Name: l3.l2Name,
    l3Name: l3.l3.name,
    rowId: l3.rowId,
  };
  if (l4.aiRationale) snap.aiRationale = l4.aiRationale;
  if (l4.aiPriority) snap.aiPriority = l4.aiPriority;
  return snap;
}

/**
 * Synthesize a placeholder L4 when every real L4 under an L3 has been
 * rejected. Mirrors `buildPlaceholderL4Fallback` in `select.ts` so the row
 * styling and tier grouping in the AI Roadmap stay consistent.
 */
function buildAllRejectedPlaceholder(rowId: string, aiPct: number): InitiativeL4 {
  const aiPriority: AiPriority =
    aiPct >= 50
      ? "P1 — Immediate (0-6mo)"
      : aiPct >= 25
        ? "P2 — Near-term (6-12mo)"
        : "P3 — Medium-term (12-24mo)";
  return {
    id: `${rowId}-all-rejected`,
    name: "All AI ideas rejected for this capability",
    source: "placeholder",
    isPlaceholder: true,
    aiPriority,
    aiRationale:
      "The Tower Lead has rejected every AI idea generated for this capability. Restore one from the Rejected ideas drawer, or set this capability's AI dial to 0 on Step 2 if it should be removed from the roadmap.",
  };
}
