import * as React from "react";
import { Sparkles, ShieldCheck, Compass } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AiCurationStatus } from "@/data/capabilityMap/types";
import type { AiPriority } from "@/data/types";

/**
 * Compact pill rendered next to an L4 chip (or an L3 / L2 summary) on the
 * Capability Map. Communicates the deterministic-fallback verdict at a
 * glance, with a tooltip carrying the full Versant-grounded rationale.
 *
 * Read-only. The user-facing override flow lives behind the LLM pipeline
 * (PR 2) — this PR ships the verdict surface only.
 */
export type CurationPillVariant = "chip" | "compact";

const PRIORITY_TIER: Record<AiPriority, "P1" | "P2" | "P3"> = {
  "P1 — Immediate (0-6mo)": "P1",
  "P2 — Near-term (6-12mo)": "P2",
  "P3 — Medium-term (12-24mo)": "P3",
};

export function CurationPill({
  status,
  priority,
  rationale,
  variant = "chip",
  className,
}: {
  status: AiCurationStatus;
  priority?: AiPriority;
  /** One-liner shown in the title attribute. */
  rationale?: string;
  variant?: CurationPillVariant;
  className?: string;
}) {
  const sized = variant === "compact" ? "px-1 py-px text-[9px]" : "px-1.5 py-px text-[10px]";
  const base =
    "inline-flex shrink-0 items-center gap-1 rounded font-mono font-semibold uppercase tabular-nums tracking-wider";

  if (status === "curated") {
    const tier = priority ? PRIORITY_TIER[priority] : null;
    // P-tier color mapping is canonical (see versant-forge rules):
    // P1 = red, P2 = amber, P3 = teal. Verdict pill uses a desaturated
    // version so it doesn't compete with the chip itself.
    const palette =
      tier === "P1"
        ? "border border-accent-red/45 bg-accent-red/10 text-accent-red"
        : tier === "P2"
          ? "border border-accent-amber/45 bg-accent-amber/10 text-accent-amber"
          : tier === "P3"
            ? "border border-accent-teal/45 bg-accent-teal/10 text-accent-teal"
            : "border border-accent-purple/45 bg-accent-purple/10 text-accent-purple-dark";
    return (
      <span
        className={cn(base, sized, palette, className)}
        title={rationale ? `AI-eligible · ${rationale}` : "AI-eligible"}
        aria-label={tier ? `${tier} AI-eligible` : "AI-eligible"}
      >
        <Sparkles className="h-2.5 w-2.5" aria-hidden />
        <span>{tier ?? "AI"}</span>
      </span>
    );
  }

  if (status === "reviewed-not-eligible") {
    return (
      <span
        className={cn(
          base,
          sized,
          "border border-forge-border bg-forge-well text-forge-subtle",
          className,
        )}
        title={rationale ? `Human-led · ${rationale}` : "Human-led — not AI-eligible"}
        aria-label="Human-led"
      >
        <ShieldCheck className="h-2.5 w-2.5" aria-hidden />
        <span>HUMAN</span>
      </span>
    );
  }

  // pending-discovery
  return (
    <span
      className={cn(
        base,
        sized,
        "border border-dashed border-accent-purple/40 bg-transparent text-accent-purple",
        className,
      )}
      title={rationale ?? "Editorial sweep pending — verdict will refine on the next pipeline run."}
      aria-label="Pending discovery"
    >
      <Compass className="h-2.5 w-2.5" aria-hidden />
      <span>?</span>
    </span>
  );
}

/**
 * Per-tower scoreboard: aggregate counts of curated / human-led / pending
 * across all L4s in scope. Rendered on the Capability Map page header.
 */
export function CurationScoreboard({
  eligible,
  notEligible,
  pending,
  totalL4,
  className,
}: {
  eligible: number;
  notEligible: number;
  pending: number;
  totalL4: number;
  className?: string;
}) {
  if (totalL4 === 0) return null;
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-forge-border bg-forge-surface/60 px-3 py-1.5",
        className,
      )}
      title="Deterministic-fallback verdict across this tower's L4 activities. Refines once the LLM curation pipeline (Step 1 → Run AI analysis) lands."
    >
      <span className="font-mono text-[11px] uppercase tracking-wider text-forge-hint">
        AI Curation
      </span>
      <ScoreboardCount tone="eligible" label="AI-eligible" count={eligible} />
      <ScoreboardCount tone="not-eligible" label="Human-led" count={notEligible} />
      {pending > 0 ? (
        <ScoreboardCount tone="pending" label="Pending" count={pending} />
      ) : null}
      <span className="font-mono text-[10px] tabular-nums text-forge-hint">
        / {totalL4} L4
      </span>
    </div>
  );
}

function ScoreboardCount({
  tone,
  label,
  count,
}: {
  tone: "eligible" | "not-eligible" | "pending";
  label: string;
  count: number;
}) {
  const dotClass =
    tone === "eligible"
      ? "bg-accent-purple"
      : tone === "not-eligible"
        ? "bg-forge-subtle"
        : "bg-accent-amber";
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className={cn("inline-block h-1.5 w-1.5 rounded-full", dotClass)} aria-hidden />
      <span className="font-mono text-xs font-semibold tabular-nums text-forge-ink">
        {count}
      </span>
      <span className="text-[11px] text-forge-body">{label}</span>
    </span>
  );
}

/**
 * Aggregated counts of L4 verdicts in a CapabilityMapDefinition. Caller
 * passes the canonical map definition; we walk it through the composer to
 * produce the scoreboard input. Pure function — safe in render.
 */
export function summarizeCurationForMap(
  walk: ReadonlyArray<{ status: AiCurationStatus }>,
): { eligible: number; notEligible: number; pending: number; totalL4: number } {
  let eligible = 0;
  let notEligible = 0;
  let pending = 0;
  for (const v of walk) {
    if (v.status === "curated") eligible += 1;
    else if (v.status === "reviewed-not-eligible") notEligible += 1;
    else pending += 1;
  }
  return {
    eligible,
    notEligible,
    pending,
    totalL4: walk.length,
  };
}

/** Status mapped to a chip label used in tooltips. */
export const curationStatusLabel: Record<AiCurationStatus, string> = {
  curated: "AI-eligible",
  "reviewed-not-eligible": "Human-led",
  "pending-discovery": "Pending discovery",
};
