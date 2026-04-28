"use client";

import * as React from "react";
import { Check, RotateCcw, X } from "lucide-react";
import type { InitiativeL3, InitiativeL4 } from "@/lib/initiatives/select";
import type { InitiativeReview } from "@/data/assess/types";
import type { UseInitiativeReviewsResult } from "@/lib/initiatives/useInitiativeReviews";
import { useToast } from "@/components/feedback/ToastProvider";
import { cn } from "@/lib/utils";

type Props = {
  l4: InitiativeL4;
  l3: InitiativeL3;
  review: InitiativeReview | undefined;
  actions: UseInitiativeReviewsResult["actions"];
  /** When true, render only icon buttons (used in dense roadmap cards). */
  compact?: boolean;
  className?: string;
};

const UNDO_TOAST_DURATION_MS = 6000;

/**
 * Compact validate / reject button cluster rendered on every L4 row in the
 * AI Initiatives surfaces (`L4Row` in ProcessLandscape, `RoadmapCard` in
 * AiRoadmap).
 *
 * Always-visible at low opacity, full opacity on hover/focus — better than
 * hover-only on tablets and for keyboard discoverability. Stops propagation
 * so the parent `<Link>` doesn't fire while the lead is making a decision.
 *
 * On reject, shows a 6-second Undo toast (via the existing ToastProvider) so
 * a stray click is one tap away from being reverted.
 *
 * Placeholder L4s (no real id, e.g. ghost-L3 fallbacks) get no buttons —
 * there's nothing to validate or reject yet.
 */
export function InitiativeReviewActions({
  l4,
  l3,
  review,
  actions,
  compact = false,
  className,
}: Props) {
  const toast = useToast();

  if (l4.isPlaceholder) return null;

  const stop = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    e.preventDefault();
  };

  if (review?.status === "approved") {
    return (
      <button
        type="button"
        onClick={(e) => {
          stop(e);
          actions.revertToPending(l4.id);
        }}
        title={`Validated ${formatDecidedAt(review.decidedAt)}${review.decidedBy ? ` by ${review.decidedBy}` : ""}. Click to revert to pending.`}
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-full border border-accent-teal/55 bg-accent-teal/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-900 transition hover:border-accent-teal hover:bg-accent-teal/25",
          className,
        )}
      >
        <Check className="h-3 w-3" aria-hidden />
        <span>Validated</span>
      </button>
    );
  }

  const onApprove = (e: React.MouseEvent) => {
    stop(e);
    actions.approve(l4, l3);
  };

  const onReject = (e: React.MouseEvent) => {
    stop(e);
    actions.reject(l4, l3);
    toast.info({
      id: `initiative-rejected-${l4.id}`,
      title: `Rejected "${l4.name}"`,
      description: "Hidden from the AI roadmap. Restore from the Rejected ideas drawer.",
      durationMs: UNDO_TOAST_DURATION_MS,
      action: {
        label: "Undo",
        onClick: () => {
          actions.restore(l4.id);
          toast.dismiss(`initiative-rejected-${l4.id}`);
        },
      },
    });
  };

  const buttonBase =
    "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider opacity-60 transition hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-forge-surface";

  return (
    <div
      className={cn("flex items-center gap-1.5", className)}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={onApprove}
        title="Validate this AI idea"
        className={cn(
          buttonBase,
          "border-accent-teal/45 bg-accent-teal/10 text-emerald-900 hover:border-accent-teal hover:bg-accent-teal/20 focus-visible:ring-accent-teal/50",
        )}
      >
        <Check className="h-3 w-3" aria-hidden />
        {compact ? null : <span>Validate</span>}
      </button>
      <button
        type="button"
        onClick={onReject}
        title="Reject this AI idea (hides it from the roadmap; restore from drawer)"
        className={cn(
          buttonBase,
          "border-accent-red/40 bg-accent-red/5 text-red-900 hover:border-accent-red/80 hover:bg-accent-red/15 focus-visible:ring-accent-red/45",
        )}
      >
        <X className="h-3 w-3" aria-hidden />
        {compact ? null : <span>Reject</span>}
      </button>
    </div>
  );
}

/**
 * Render-only "Restore" button used inside the rejected-ideas drawer. Kept
 * here so all review-decision UI lives in one place.
 */
export function InitiativeReviewRestoreButton({
  l4Id,
  actions,
  className,
}: {
  l4Id: string;
  actions: UseInitiativeReviewsResult["actions"];
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => actions.restore(l4Id)}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-forge-border bg-forge-surface px-2.5 py-1 text-xs font-medium text-forge-body transition hover:border-accent-purple/50 hover:text-accent-purple-dark",
        className,
      )}
    >
      <RotateCcw className="h-3 w-3" aria-hidden />
      Restore
    </button>
  );
}

function formatDecidedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "recently";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
