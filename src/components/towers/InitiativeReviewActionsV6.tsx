"use client";

import * as React from "react";
import { Check, X } from "lucide-react";
import { useToast } from "@/components/feedback/ToastProvider";
import type { InitiativeReview } from "@/data/assess/types";
import type {
  V6InitiativeCard,
  V6L3Row,
} from "@/lib/initiatives/selectV6";
import type { UseInitiativeReviewsV6Result } from "@/lib/initiatives/useInitiativeReviewsV6";
import { cn } from "@/lib/utils";

const UNDO_TOAST_DURATION_MS = 6000;

type Props = {
  init: V6InitiativeCard;
  row: V6L3Row;
  review: InitiativeReview | undefined;
  actions: UseInitiativeReviewsV6Result["actions"];
  className?: string;
};

/**
 * Per-card validate / reject affordance for V6 AI Solution cards in
 * `<SolutionsGallery>`.
 *
 * Renders inside `<SolutionCardV2>`'s footer next to the "Open deep
 * dive" pill. The card itself is wrapped by a `<Link>` so every click
 * inside this cluster has to `stopPropagation` + `preventDefault` —
 * otherwise approving an idea would also fire the deep-dive
 * navigation.
 *
 * Visual contract mirrors the v5 `<InitiativeReviewActions compact />`:
 * tiny icon-only buttons, low default opacity, full opacity on hover /
 * focus / when a decision is in place. Approved state collapses to a
 * single teal "Validated" pill (clickable to revert to pending).
 *
 * Reject fires a 6-second Undo toast so a stray click is one tap away
 * from being reverted; matches the workshop-friendly UX pattern from
 * the operating-model surfaces.
 */
export function InitiativeReviewActionsV6({
  init,
  row,
  review,
  actions,
  className,
}: Props) {
  const toast = useToast();

  if (init.isPlaceholder) return null;

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
          actions.revertToPending(init.id);
        }}
        title={`Validated${review.decidedBy ? ` by ${review.decidedBy}` : ""}. Click to revert to pending.`}
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-full border border-accent-teal/55 bg-accent-teal/15 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-emerald-900 transition hover:border-accent-teal hover:bg-accent-teal/25",
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
    actions.approve(init, row);
  };

  const onReject = (e: React.MouseEvent) => {
    stop(e);
    actions.reject(init, row);
    toast.info({
      id: `initiative-rejected-${init.id}`,
      title: `Rejected "${init.solutionName}"`,
      description:
        "Hidden from the AI Solutions gallery. Restore from the Rejected ideas chip above.",
      durationMs: UNDO_TOAST_DURATION_MS,
      action: {
        label: "Undo",
        onClick: () => {
          actions.restore(init.id);
          toast.dismiss(`initiative-rejected-${init.id}`);
        },
      },
    });
  };

  const buttonBase =
    "inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 transition opacity-70 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-forge-surface";

  return (
    <div
      className={cn("flex items-center gap-1", className)}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={onApprove}
        title={`Validate "${init.solutionName}" — counts as a tower-lead approval.`}
        aria-label={`Validate ${init.solutionName}`}
        className={cn(
          buttonBase,
          "border-accent-teal/45 bg-accent-teal/10 text-emerald-900 hover:border-accent-teal hover:bg-accent-teal/20 focus-visible:ring-accent-teal/50",
        )}
      >
        <Check className="h-3 w-3" aria-hidden />
      </button>
      <button
        type="button"
        onClick={onReject}
        title={`Reject "${init.solutionName}" — hides it from the gallery; restore from the Rejected ideas chip.`}
        aria-label={`Reject ${init.solutionName}`}
        className={cn(
          buttonBase,
          "border-accent-red/40 bg-accent-red/5 text-red-900 hover:border-accent-red/80 hover:bg-accent-red/15 focus-visible:ring-accent-red/45",
        )}
      >
        <X className="h-3 w-3" aria-hidden />
      </button>
    </div>
  );
}
