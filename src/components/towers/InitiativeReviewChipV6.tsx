"use client";

import * as React from "react";
import { Archive, CheckCircle2 } from "lucide-react";
import type { Tower } from "@/data/types";
import { useInitiativeReviewsV6 } from "@/lib/initiatives/useInitiativeReviewsV6";
import { RejectedInitiativesDrawer } from "@/components/operatingModel/RejectedInitiativesDrawer";
import { cn } from "@/lib/utils";

type Props = {
  tower: Tower;
  className?: string;
};

/**
 * V6 sibling of `<InitiativeReviewChip>` used on the per-tower AI
 * Initiatives page (`/tower/[slug]`). Reads the v6 review hook so the
 * tally reflects the AI Solutions cards actually rendered in
 * `<SolutionsGallery>` — clicking validate / reject in the gallery
 * footer updates this chip in real time via the shared `assessProgram`
 * subscription.
 *
 * The "rejected" segment opens the schema-agnostic
 * `<RejectedInitiativesDrawer>` so the lead can restore an idea.
 *
 * Decisions persist via the Postgres-synced `initiativeReviews` map
 * keyed by `V6InitiativeCard.id`.
 */
export function InitiativeReviewChipV6({ tower, className }: Props) {
  const { counts, rejectedItems, actions } = useInitiativeReviewsV6(tower);
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  return (
    <>
      <div
        className={cn(
          "inline-flex flex-wrap items-center gap-1.5 rounded-full border border-forge-border bg-forge-surface px-2 py-1 text-[11px] shadow-sm",
          className,
        )}
        title="Tower-lead validate / reject status across every AI Solution card on this tower"
      >
        <span className="inline-flex items-center gap-1 rounded-full bg-accent-teal/10 px-2 py-0.5 text-emerald-900">
          <CheckCircle2 className="h-3 w-3" aria-hidden />
          <span className="font-mono tabular-nums">{counts.approved}</span>
          <span className="uppercase tracking-wider">validated</span>
        </span>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="inline-flex items-center gap-1 rounded-full bg-accent-red/10 px-2 py-0.5 text-red-900 transition hover:bg-accent-red/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-red/40"
          title="Review and restore rejected AI Solutions"
        >
          <Archive className="h-3 w-3" aria-hidden />
          <span className="font-mono tabular-nums">{counts.rejected}</span>
          <span className="uppercase tracking-wider">rejected</span>
        </button>
        <span className="inline-flex items-center gap-1 rounded-full bg-forge-well px-2 py-0.5 text-forge-body">
          <span className="font-mono tabular-nums">{counts.pending}</span>
          <span className="uppercase tracking-wider">pending</span>
        </span>
      </div>

      <RejectedInitiativesDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        rejectedItems={rejectedItems.map((it) => ({
          id: it.initId,
          review: it.review,
        }))}
        onRestore={actions.restore}
      />
    </>
  );
}
