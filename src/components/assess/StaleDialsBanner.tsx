"use client";

import * as React from "react";
import * as Icons from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Step 2 (Configure Impact Levers) staleness banner.
 *
 * Surfaces above the dial cards whenever the tower's offshore + AI dials
 * are sitting at unreviewed defaults — i.e. every row has both dial
 * overrides null AND `dialsRationaleSource` undefined. That's the post-
 * upload signature: `importOp` clears the dials and clears the rationale
 * provenance, so the banner fires immediately without false-positive on
 * sample-loaded data (which always carries `dialsRationaleSource:
 * "starter"`).
 *
 * The CTA fires the EXISTING LLM-backed `overwriteAllOp` ("Re-score every
 * L3 with AI"). It routes through the existing `reseedDialogOpen`
 * confirmation so a user with manual dial adjustments doesn't lose them
 * accidentally — the dialog already warns about the overwrite.
 */
export function StaleDialsBanner({
  totalRows,
  rescoring,
  onRescore,
}: {
  totalRows: number;
  rescoring: boolean;
  onRescore: () => void;
}) {
  if (totalRows === 0) return null;

  return (
    <section
      className="rounded-2xl border border-accent-amber/45 bg-gradient-to-br from-accent-amber/12 via-accent-amber/5 to-transparent p-4 sm:p-5"
      aria-label="Dials need a fresh AI score"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Icons.Gauge
              className={cn(
                "h-4 w-4 text-accent-amber",
                rescoring ? "animate-pulse" : "",
              )}
              aria-hidden
            />
            <h3 className="font-display text-base font-semibold text-forge-ink">
              Capability map updated. Score the offshore + AI dials with AI.
            </h3>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-forge-subtle">
            Dials are sitting at the platform default ({" "}
            <span className="font-mono">20%</span> offshore /{" "}
            <span className="font-mono">15%</span> AI). Re-score runs the
            Versant-grounded LLM and writes per-L3 rationales for both
            levers — so the dial values come with a Versant-specific
            justification, not just a number. If the LLM is unavailable, it
            falls back to the deterministic heuristic.
          </p>
        </div>
        <button
          type="button"
          onClick={onRescore}
          disabled={rescoring}
          title={
            rescoring
              ? "Re-score in progress"
              : "Re-evaluate offshore + AI dials for every L3 in this tower using the Versant-grounded LLM."
          }
          className={cn(
            "inline-flex items-center gap-2 rounded-lg bg-accent-amber px-4 py-2 text-sm font-semibold text-near-black transition",
            "hover:bg-accent-amber/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-amber/50",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
        >
          {rescoring ? (
            <>
              <Icons.Loader2 className="h-4 w-4 animate-spin" />
              Re-scoring...
            </>
          ) : (
            <>
              <Icons.Sparkles className="h-4 w-4" />
              Re-score every L3 with AI ({totalRows} capabilit
              {totalRows === 1 ? "y" : "ies"})
            </>
          )}
        </button>
      </div>
    </section>
  );
}
