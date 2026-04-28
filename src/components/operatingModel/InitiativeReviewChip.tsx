"use client";

import * as React from "react";
import { Archive, CheckCircle2 } from "lucide-react";
import type { Tower } from "@/data/types";
import { useInitiativeReviews } from "@/lib/initiatives/useInitiativeReviews";
import { cn } from "@/lib/utils";
import { RejectedInitiativesDrawer } from "./RejectedInitiativesDrawer";

type Props = {
  tower: Tower;
  className?: string;
};

/**
 * Section-header chip for the AI Initiatives surfaces.
 *
 * Always-visible tally of `N validated · N rejected · N pending` so the
 * review state is permanent program telemetry — never hidden behind an
 * empty-zero collapse. Clicking the rejected segment opens the
 * `RejectedInitiativesDrawer` so a Tower Lead can review and restore.
 */
export function InitiativeReviewChip({ tower, className }: Props) {
  const { counts, rejectedItems, actions } = useInitiativeReviews(tower);
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  return (
    <>
      <div
        className={cn(
          "inline-flex flex-wrap items-center gap-1.5 rounded-full border border-forge-border bg-forge-surface px-2 py-1 text-[11px] shadow-sm",
          className,
        )}
        title="Tower-lead review status across every AI initiative on this tower"
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
          title="Review and restore rejected ideas"
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
        rejectedItems={rejectedItems}
        actions={actions}
      />
    </>
  );
}
