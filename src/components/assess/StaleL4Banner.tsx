"use client";

import * as React from "react";
import * as Icons from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Step 1 (Capability Map) staleness banner.
 *
 * Surfaces above the capability-map list whenever at least one L4 Activity
 * Group row has no L5 Activities yet. After a tower-lead upload, every row
 * arrives blank — the banner is the prominent CTA telling the user to fire
 * the LLM L5 Activity generator before moving on to Steps 2 and 4.
 *
 * Behaviour:
 *   - Hides itself when `blankL4Count === 0` (prop name retained from V4 for
 *     back-compat; semantically counts L4 Activity Groups missing L5
 *     Activities).
 *   - Disables the CTA while the LLM call is in flight.
 *   - Mirrors the visual language of `StaleCurationBanner` (amber gradient,
 *     RefreshCw + Sparkles iconography) so the three banners read as one
 *     consistent staleness pattern across the journey.
 */
export function StaleL4Banner({
  blankL4Count,
  totalL3s,
  generating,
  onGenerate,
  hideTitle = false,
  mapLocked = false,
}: {
  blankL4Count: number;
  totalL3s: number;
  generating: boolean;
  onGenerate: () => void;
  /** When the screen guidance bar already states the primary headline. */
  hideTitle?: boolean;
  mapLocked?: boolean;
}) {
  if (blankL4Count === 0) return null;

  return (
    <section
      className="rounded-2xl border border-accent-amber/45 bg-gradient-to-br from-accent-amber/12 via-accent-amber/5 to-transparent p-4 sm:p-5"
      aria-label="Capability map needs L5 Activities"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Icons.ListPlus
              className={cn(
                "h-4 w-4 text-accent-amber",
                generating ? "animate-pulse" : "",
              )}
              aria-hidden
            />
            <h3
              className={cn(
                "font-display text-base font-semibold text-forge-ink",
                hideTitle && "sr-only",
              )}
            >
              Capability map needs L5 Activities.{" "}
              <span className="font-mono text-accent-amber">{blankL4Count}</span>{" "}
              of <span className="font-mono text-forge-body">{totalL3s}</span>{" "}
              {blankL4Count === 1 ? "Activity Group is" : "Activity Groups are"} blank.
            </h3>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-forge-subtle">
            Generate L5 Activities runs the Versant-grounded LLM. If the LLM
            is unavailable, it falls back to the canonical capability map.
            L5 Activities feed Step 4&apos;s AI-eligibility curation — Step 2
            dials and Step 4 initiatives stay queued until this finishes.
          </p>
        </div>
        <button
          type="button"
          onClick={onGenerate}
          disabled={generating || mapLocked}
          title={
            mapLocked
              ? "Unlock the map in the action bar to generate L5 Activities."
              : generating
                ? "Generation in progress"
                : "Run the Versant-grounded LLM to fill in L5 Activities for blank L4 Activity Groups."
          }
          className={cn(
            "inline-flex items-center gap-2 rounded-lg bg-accent-amber px-4 py-2 text-sm font-semibold text-near-black transition",
            "hover:bg-accent-amber/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-amber/50",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
        >
          {generating ? (
            <>
              <Icons.Loader2 className="h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Icons.Sparkles className="h-4 w-4" />
              Generate L5 Activities for {blankL4Count} Activity Group
              {blankL4Count === 1 ? "" : "s"}
            </>
          )}
        </button>
      </div>
    </section>
  );
}
