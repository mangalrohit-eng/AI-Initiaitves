"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Archive, X } from "lucide-react";
import type { UseInitiativeReviewsResult } from "@/lib/initiatives/useInitiativeReviews";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { cn } from "@/lib/utils";
import { feasibilityChip } from "@/lib/feasibilityChip";
import { InitiativeReviewRestoreButton } from "./InitiativeReviewActions";

type Props = {
  open: boolean;
  onClose: () => void;
  rejectedItems: UseInitiativeReviewsResult["rejectedItems"];
  actions: UseInitiativeReviewsResult["actions"];
};

/**
 * Slide-from-right drawer listing every AI idea this Tower Lead has rejected
 * for the current tower. Mirrors the structure of `ShortlistDrawer` —
 * `useFocusTrap`, ESC-to-close, body-scroll lock, dark surface.
 *
 * Each row carries a Restore button so the lead can bring an idea back into
 * the AI Initiatives roadmap. Decisions persist via the AssessProgramV4
 * envelope, so restores sync to the database the same way rejections did.
 */
export function RejectedInitiativesDrawer({
  open,
  onClose,
  rejectedItems,
  actions,
}: Props) {
  const trapRef = useFocusTrap<HTMLDivElement>(open);

  React.useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="rejected-drawer-root"
          className="fixed inset-0 z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          role="dialog"
          aria-modal="true"
          aria-label="Rejected AI ideas"
        >
          <button
            type="button"
            aria-label="Close rejected ideas drawer"
            onClick={onClose}
            className="absolute inset-0 bg-forge-ink/40 backdrop-blur-[2px]"
          />
          <motion.aside
            ref={trapRef}
            key="rejected-drawer-panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 360, damping: 34 }}
            tabIndex={-1}
            className="absolute inset-y-0 right-0 flex w-full max-w-lg flex-col border-l border-forge-border bg-forge-surface shadow-2xl outline-none sm:max-w-xl"
          >
            <header className="flex items-center justify-between gap-3 border-b border-forge-border px-5 py-4 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-accent-purple/30 bg-accent-purple/10 text-accent-purple-dark">
                  <Archive className="h-4 w-4" aria-hidden />
                </div>
                <div className="min-w-0">
                  <div className="font-display text-base font-semibold text-forge-ink">
                    Rejected AI ideas
                  </div>
                  <div className="truncate text-[11px] text-forge-subtle">
                    {rejectedItems.length === 0
                      ? "Reject an idea from the roadmap to send it here"
                      : `${rejectedItems.length} idea${rejectedItems.length === 1 ? "" : "s"} hidden from the roadmap · restore to bring back`}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close drawer"
                className="rounded-md p-1.5 text-forge-subtle transition hover:bg-forge-well hover:text-forge-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-6">
              {rejectedItems.length === 0 ? (
                <EmptyState />
              ) : (
                <ul className="space-y-3">
                  {rejectedItems.map(({ l4Id, review }) => (
                    <RejectedRow
                      key={l4Id}
                      l4Id={l4Id}
                      review={review}
                      actions={actions}
                    />
                  ))}
                </ul>
              )}
            </div>

            <footer className="border-t border-forge-border bg-forge-well/40 px-5 py-3 text-[11px] text-forge-subtle sm:px-6">
              Decisions persist across sessions and sync to the program
              database. Rejecting hides the idea from the roadmap; per-L4
              Activity Group impact stays driven by Step 2 dials.
            </footer>
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function RejectedRow({
  l4Id,
  review,
  actions,
}: {
  l4Id: string;
  review: UseInitiativeReviewsResult["rejectedItems"][number]["review"];
  actions: UseInitiativeReviewsResult["actions"];
}) {
  // Per-tower views never surface a priority chip — the cross-tower 2x2 owns
  // priority. We show the captured feasibility (when present on the snapshot)
  // so the lead remembers whether this idea was a ship-ready bet or a
  // longer-investigation bet at the time they rejected it.
  const feas = review.snapshot.feasibility
    ? feasibilityChip(review.snapshot.feasibility)
    : null;
  return (
    <li className="rounded-xl border border-forge-border bg-forge-surface p-3 shadow-sm transition hover:border-accent-purple/40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-forge-ink">
              {review.snapshot.name}
            </span>
            {feas ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                  feas.badge,
                )}
                title={feas.tooltip}
              >
                <span className={cn("h-1 w-1 rounded-full", feas.dot)} aria-hidden />
                {feas.label}
              </span>
            ) : null}
          </div>
          <div className="mt-0.5 text-[11px] uppercase tracking-wide text-forge-hint">
            {review.snapshot.l2Name} · {review.snapshot.l3Name}
          </div>
          {review.snapshot.aiRationale ? (
            <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-forge-subtle">
              {review.snapshot.aiRationale}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="text-[10px] uppercase tracking-wider text-forge-hint">
          Rejected {formatDecidedAt(review.decidedAt)}
          {review.decidedBy ? ` · ${review.decidedBy}` : ""}
        </div>
        <InitiativeReviewRestoreButton l4Id={l4Id} actions={actions} />
      </div>
    </li>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-forge-border bg-forge-well/30 px-5 py-12 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg border border-forge-border bg-forge-surface text-forge-hint">
        <Archive className="h-4 w-4" aria-hidden />
      </div>
      <div className="mt-3 font-display text-sm font-semibold text-forge-ink">
        No rejected ideas yet
      </div>
      <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-forge-subtle">
        Use the reject button next to any AI idea on the roadmap to send it
        here. Rejected ideas can be brought back at any time.
      </p>
    </div>
  );
}

function formatDecidedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "recently";
  const now = Date.now();
  const diffMs = now - d.getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
