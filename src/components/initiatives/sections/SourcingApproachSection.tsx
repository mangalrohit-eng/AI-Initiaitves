import * as React from "react";
import { Wrench, ShoppingBag, Compass, type LucideIcon } from "lucide-react";
import type { SolutionBrief, SolutionSourcingApproach } from "@/data/types";
import { cn } from "@/lib/utils";
import { SectionShell } from "./sectionShell";

/**
 * Section C — Build vs. Buy vs. Discover.
 *
 * Renders the verdict as a high-contrast badge with a Lucide icon, then
 * the rationale paragraph beneath. Color encodes the verdict so a
 * scanner can read the recommendation before the words.
 */

const APPROACH_META: Record<
  SolutionSourcingApproach,
  {
    label: string;
    Icon: LucideIcon;
    badge: string;
    rail: string;
    iconWrap: string;
  }
> = {
  Build: {
    label: "Build",
    Icon: Wrench,
    badge: "border-accent-amber/40 bg-accent-amber/10 text-accent-amber",
    rail: "border-l-accent-amber/60",
    iconWrap: "bg-accent-amber/15 text-accent-amber",
  },
  Buy: {
    label: "Buy",
    Icon: ShoppingBag,
    badge: "border-accent-green/40 bg-accent-green/10 text-accent-green",
    rail: "border-l-accent-green/60",
    iconWrap: "bg-accent-green/15 text-accent-green",
  },
  Discover: {
    label: "More discovery needed",
    Icon: Compass,
    badge: "border-accent-purple/40 bg-accent-purple/10 text-accent-purple-light",
    rail: "border-l-accent-purple/60",
    iconWrap: "bg-accent-purple/15 text-accent-purple-light",
  },
};

export function SourcingApproachSection({ brief }: { brief: SolutionBrief }) {
  const { approach, rationale } = brief.sourcing;
  const meta = APPROACH_META[approach];
  const { Icon } = meta;

  return (
    <SectionShell
      letter="C"
      title="How we'll get it"
      subtitle="Build, buy, or run discovery"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-display text-sm font-semibold uppercase tracking-[0.12em]",
              meta.badge,
            )}
          >
            <span
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full",
                meta.iconWrap,
              )}
            >
              <Icon className="h-3 w-3" aria-hidden />
            </span>
            {meta.label}
          </span>
        </div>
        <div
          className={cn(
            "rounded-xl border border-forge-border/60 bg-near-black/30 p-4 border-l-4",
            meta.rail,
          )}
        >
          <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-forge-hint">
            Rationale
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-forge-body">
            {rationale}
          </p>
        </div>
      </div>
    </SectionShell>
  );
}
