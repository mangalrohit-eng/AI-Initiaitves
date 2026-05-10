import * as React from "react";
import { Building2 } from "lucide-react";
import type { SolutionBrief, SolutionBuyOption } from "@/data/types";
import { cn } from "@/lib/utils";
import { SectionShell } from "./sectionShell";

/**
 * Section D — Vendor options when sourcing leans Buy (or adjacent
 * options when Build / Discover). Each card names the vendor, the fit
 * narrative, and a coverage chip (Strong / Partial / Adjacent).
 *
 * Hidden by the parent shell when the array is empty.
 */

const COVERAGE_BADGE: Record<
  SolutionBuyOption["coverage"],
  { className: string; label: string }
> = {
  Strong: {
    className: "border-accent-green/40 bg-accent-green/10 text-accent-green",
    label: "Strong fit",
  },
  Partial: {
    className: "border-accent-amber/40 bg-accent-amber/10 text-accent-amber",
    label: "Partial fit",
  },
  Adjacent: {
    className: "border-forge-border bg-near-black/40 text-forge-subtle",
    label: "Adjacent",
  },
};

export function BuyOptionsSection({
  brief,
  variant = "buy",
}: {
  brief: SolutionBrief;
  /** Adjusts the section title for the surfacing context. */
  variant?: "buy" | "adjacent";
}) {
  const { buyOptions } = brief;
  if (buyOptions.length === 0) return null;
  return (
    <SectionShell
      letter="D"
      title={
        variant === "buy"
          ? "Vendor options that may cover this"
          : "Adjacent vendor options worth screening"
      }
      subtitle={
        variant === "buy"
          ? "Off-the-shelf platforms to evaluate first"
          : "Tools that overlap parts of the scope"
      }
    >
      <ul className="grid gap-3 sm:grid-cols-2">
        {buyOptions.map((opt, i) => {
          const badge = COVERAGE_BADGE[opt.coverage];
          return (
            <li
              key={i}
              className="rounded-xl border border-forge-border/60 bg-near-black/30 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-purple/10 text-accent-purple-light">
                    <Building2 className="h-4 w-4" aria-hidden />
                  </span>
                  <h3 className="truncate font-display text-sm font-semibold text-forge-ink">
                    {opt.vendor}
                  </h3>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em]",
                    badge.className,
                  )}
                >
                  {badge.label}
                </span>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-forge-body">
                {opt.fit}
              </p>
            </li>
          );
        })}
      </ul>
    </SectionShell>
  );
}
