import * as React from "react";
import type { Feasibility } from "@/data/types";
import { resolveSolutionIcon } from "@/lib/initiatives/solutionIconAllowlist";
import { cn } from "@/lib/utils";

/**
 * Per-AI-Solution glyph rendered inside a feasibility-tinted halo.
 *
 * Resolution order, in priority:
 *   1. LLM-picked `iconKey` (validated against the curated allowlist).
 *   2. Deterministic per-tower-domain bucket pick keyed by the
 *      `seed` (typically the L3Initiative.id) — so legacy cache that
 *      predates the prompt change still gets visual variety within a
 *      tower (e.g. Calculator / Receipt / Banknote / Vault for Finance)
 *      instead of every card collapsing to Rocket.
 *   3. Feasibility-aware ultimate fallback (Rocket for Proven pattern,
 *      Compass for New build).
 *
 * Halo color encodes feasibility so a workshop attendee can scan the
 * gallery and tell Proven pattern vs. New build at a glance — even
 * before reading the feasibility chip.
 *
 * The wrapping tile is `aria-hidden` because the solution name renders
 * adjacent to it and carries the semantics. Screen readers don't double-
 * announce the icon.
 */
export type SolutionIconSize = "sm" | "md" | "lg" | "xl";

const TILE_DIMS: Record<SolutionIconSize, string> = {
  sm: "h-7 w-7 rounded-lg",
  md: "h-10 w-10 rounded-xl",
  lg: "h-12 w-12 rounded-xl",
  xl: "h-16 w-16 rounded-2xl",
};

const ICON_DIMS: Record<SolutionIconSize, string> = {
  sm: "h-3.5 w-3.5",
  md: "h-5 w-5",
  lg: "h-6 w-6",
  xl: "h-8 w-8",
};

export function SolutionIcon({
  iconKey,
  feasibility,
  size = "md",
  className,
  towerIconKey,
  seed,
}: {
  iconKey?: string;
  feasibility?: Feasibility;
  size?: SolutionIconSize;
  className?: string;
  /** Tower motif iconKey — used to pick a domain-relevant fallback. */
  towerIconKey?: string;
  /** Stable per-card seed (typically `L3Initiative.id`). */
  seed?: string;
}) {
  const tone: "ship-ready" | "investigate" =
    feasibility === "High" ? "ship-ready" : "investigate";
  const Icon = resolveSolutionIcon(iconKey, {
    feasibility: tone,
    towerIconKey,
    seed,
  });

  const tileTone =
    tone === "ship-ready"
      ? "border-accent-teal/40 bg-accent-teal/10 text-accent-teal shadow-[0_0_0_1px_rgba(0,191,165,0.18)]"
      : "border-slate-500/30 bg-slate-500/10 text-slate-300 shadow-[0_0_0_1px_rgba(100,116,139,0.18)]";

  return (
    <span
      role="presentation"
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center border",
        TILE_DIMS[size],
        tileTone,
        className,
      )}
    >
      <Icon className={ICON_DIMS[size]} aria-hidden />
    </span>
  );
}
