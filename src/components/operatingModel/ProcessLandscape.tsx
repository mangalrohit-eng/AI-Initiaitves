"use client";

import * as React from "react";
import Link from "next/link";
import * as Icons from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import type { Tower } from "@/data/types";
import type { InitiativeReview } from "@/data/assess/types";
import type { InitiativeL2, InitiativeL3, InitiativeL4 } from "@/lib/initiatives/select";
import type { UseInitiativeReviewsResult } from "@/lib/initiatives/useInitiativeReviews";
import { cn, slugify } from "@/lib/utils";
import { TIER_STYLES, priorityTier } from "@/lib/priority";
import { formatUsdCompact } from "@/lib/format";
import { getTowerHref } from "@/lib/towerHref";
import { InitiativeReviewActions } from "./InitiativeReviewActions";

function resolveIcon(name?: string): LucideIcon {
  if (!name) return Icons.Layers;
  const lib = Icons as unknown as Record<string, LucideIcon>;
  return lib[name] ?? Icons.Layers;
}

const CRITICALITY_ACCENT: Record<string, string> = {
  "Mission-critical": "border-accent-red/40 bg-red-50 text-red-900",
  High: "border-accent-amber/45 bg-amber-50 text-amber-900",
  Medium: "border-forge-border bg-forge-well text-forge-body",
  Low: "border-forge-border bg-forge-well/60 text-forge-subtle",
};

const MATURITY_ACCENT: Record<string, string> = {
  "Not yet established": "border-forge-border bg-white text-forge-subtle",
  Manual: "border-forge-border bg-white text-forge-body",
  "Semi-automated": "border-accent-teal/40 bg-accent-teal/10 text-emerald-900",
  Automated: "border-accent-teal/55 bg-accent-teal/15 text-emerald-900",
};

/**
 * One curated (or placeholder) L4 row inside an L3's expanded panel.
 *
 * Renders the Versant-specific rationale, P-tier, frequency, criticality,
 * and maturity for an AI-eligible activity, then offers click-through to the
 * brief or full 4-lens initiative when one is attached.
 */
function L4Row({
  l4,
  l3,
  tower,
  index,
  rowId,
  review,
  actions,
}: {
  l4: InitiativeL4;
  l3: InitiativeL3;
  tower: Tower;
  index: number;
  rowId: string;
  review: InitiativeReview | undefined;
  actions: UseInitiativeReviewsResult["actions"];
}) {
  const tier = priorityTier(l4.aiPriority);
  const initiative = l4.initiativeId
    ? tower.processes.find((p) => p.id === l4.initiativeId)
    : undefined;
  const initiativeHref = initiative
    ? `/tower/${tower.id}/process/${slugify(initiative.name)}`
    : undefined;
  const briefHref = l4.briefSlug ? `/tower/${tower.id}/brief/${l4.briefSlug}` : undefined;
  const isClickable = Boolean(initiativeHref || briefHref);

  const borderClass = l4.isPlaceholder
    ? "border-l-[3px] border-l-dashed border-l-forge-border"
    : initiative
      ? "border-l-[3px] border-l-accent-purple"
      : briefHref
        ? "border-l-[3px] border-dashed border-l-accent-purple/70"
        : "border-l-[3px] border-l-accent-purple/40";

  const content = (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02, duration: 0.18 }}
      className={cn(
        "grid grid-cols-12 items-start gap-3 px-4 py-3 text-sm transition",
        borderClass,
        tier ? TIER_STYLES[tier].row : "bg-transparent",
        isClickable ? "hover:bg-accent-purple/5" : "",
      )}
    >
      <div className="col-span-12 min-w-0 md:col-span-6">
        <div className="flex items-start gap-2">
          {tier ? (
            <span
              className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", TIER_STYLES[tier].dot)}
              aria-hidden
            />
          ) : (
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-forge-border" aria-hidden />
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "font-medium",
                  l4.isPlaceholder ? "italic text-forge-subtle" : "text-forge-ink",
                )}
              >
                {l4.name}
              </span>
              {l4.source === "fuzzy-match" ? (
                <span
                  className="rounded-full border border-forge-border bg-forge-well px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-forge-hint"
                  title="Curated detail attached via name match. Will be confirmed in editorial sweep."
                >
                  inferred
                </span>
              ) : null}
              {l4.isPlaceholder ? (
                <span
                  className="inline-flex items-center gap-1 rounded-full border border-forge-border bg-forge-well px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-forge-hint"
                  title="AI couldn't identify L4 activities that are candidates for AI here. Regenerate the L4 list on Step 1, or reduce the AI dial for this L3 to zero on Step 2."
                >
                  <Icons.CircleAlert className="h-2.5 w-2.5" />
                  no AI candidates
                </span>
              ) : null}
              <InitiativeReviewActions
                l4={l4}
                l3={l3}
                review={review}
                actions={actions}
                compact
              />
            </div>
            {l4.aiRationale ? (
              <p className="mt-1 text-xs leading-relaxed text-forge-subtle">
                {l4.aiRationale}
              </p>
            ) : null}
            {l4.isPlaceholder ? (
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px]">
                <Link
                  href={`${getTowerHref(tower.id as Parameters<typeof getTowerHref>[0], "capability-map")}#generate-l4-toolbar`}
                  className="inline-flex items-center gap-1 rounded-md border border-forge-border bg-forge-surface px-2 py-0.5 text-forge-body transition hover:border-accent-purple/40 hover:text-accent-purple-dark"
                  title="Open Step 1 and re-run Generate L4 activities for this tower (LLM-first, canonical-map fallback)."
                  onClick={(e) => e.stopPropagation()}
                >
                  <Icons.RefreshCw className="h-3 w-3" />
                  Regenerate L4 list
                </Link>
                <Link
                  href={`${getTowerHref(tower.id as Parameters<typeof getTowerHref>[0], "impact-levers")}#l3-${rowId}`}
                  className="inline-flex items-center gap-1 rounded-md border border-forge-border bg-forge-surface px-2 py-0.5 text-forge-body transition hover:border-accent-purple/40 hover:text-accent-purple-dark"
                  title="Open Step 2 and reduce the AI dial for this L3 to zero."
                  onClick={(e) => e.stopPropagation()}
                >
                  <Icons.SlidersHorizontal className="h-3 w-3" />
                  Set dial to 0
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="col-span-4 text-xs md:col-span-2">
        {l4.frequency ? (
          <span className="inline-flex items-center rounded-full border border-forge-border bg-forge-well px-2 py-0.5 font-medium text-forge-body">
            {l4.frequency}
          </span>
        ) : null}
      </div>

      <div className="col-span-4 text-xs md:col-span-2">
        {l4.criticality ? (
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 font-medium",
              CRITICALITY_ACCENT[l4.criticality] ?? "border-forge-border bg-forge-well",
            )}
          >
            {l4.criticality}
          </span>
        ) : null}
      </div>

      <div className="col-span-4 text-xs md:col-span-1">
        {l4.currentMaturity ? (
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 font-medium",
              MATURITY_ACCENT[l4.currentMaturity] ?? "border-forge-border bg-forge-well",
            )}
          >
            {l4.currentMaturity}
          </span>
        ) : null}
      </div>

      <div className="col-span-12 flex items-center justify-between gap-2 md:col-span-1 md:justify-end">
        {tier ? (
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold",
              TIER_STYLES[tier].badge,
            )}
          >
            {tier}
          </span>
        ) : null}
        {isClickable ? (
          <Icons.ChevronRight className="h-4 w-4 text-forge-hint group-hover:text-accent-purple" />
        ) : null}
      </div>
    </motion.div>
  );

  if (initiativeHref) {
    return (
      <Link
        href={initiativeHref}
        className="group block border-b border-forge-border last:border-b-0"
        title="Open the full four-lens initiative design"
      >
        {content}
      </Link>
    );
  }
  if (briefHref) {
    return (
      <Link
        href={briefHref}
        className="group block border-b border-forge-border last:border-b-0"
        title="Open the lightweight pre/post brief"
      >
        {content}
      </Link>
    );
  }
  return (
    <div
      className="border-b border-forge-border last:border-b-0"
      title={l4.aiRationale ?? undefined}
    >
      {content}
    </div>
  );
}

/**
 * One L3 row with an expandable detail panel showing AI-eligible L4s.
 *
 * The header carries the modeled $ from `rowModeledSaving` (via the selector),
 * the live AI dial %, and a deep-link to Step 2 so the user can adjust the
 * dial without losing context.
 */
function L3RowCard({
  l3,
  tower,
  expanded,
  onToggle,
  reviews,
  actions,
}: {
  l3: InitiativeL3;
  tower: Tower;
  expanded: boolean;
  onToggle: () => void;
  reviews: Record<string, InitiativeReview>;
  actions: UseInitiativeReviewsResult["actions"];
}) {
  const maxTier = React.useMemo(() => {
    const tiers = l3.l4s.map((l) => priorityTier(l.aiPriority)).filter(Boolean);
    if (tiers.includes("P1")) return "P1" as const;
    if (tiers.includes("P2")) return "P2" as const;
    if (tiers.includes("P3")) return "P3" as const;
    return null;
  }, [l3.l4s]);

  const stepTwoHref = `${getTowerHref(tower.id as Parameters<typeof getTowerHref>[0], "impact-levers")}#l3-${l3.rowId}`;

  return (
    <div
      className={cn(
        "group rounded-2xl border bg-forge-surface shadow-sm transition",
        expanded ? "border-accent-purple/40 shadow-card" : "border-forge-border",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-start justify-between gap-4 px-4 py-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display text-sm font-semibold text-forge-ink">
              {l3.l3.name}
            </span>
            {maxTier ? (
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                  TIER_STYLES[maxTier].badge,
                )}
                title={`Highest priority of any AI-eligible activity in this capability: ${maxTier}`}
              >
                {maxTier}
              </span>
            ) : null}
            <span className="font-mono text-[10px] uppercase tracking-wider text-forge-hint">
              {l3.l4s.length}{" "}
              {l3.l4s.length === 1 ? "activity" : "activities"}
            </span>
          </div>
          {l3.l3.description ? (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-forge-subtle">
              {l3.l3.description}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-3 text-right">
          <div>
            <div className="font-mono text-base font-semibold tabular-nums text-forge-ink">
              {formatUsdCompact(l3.aiUsd)}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-forge-hint">
              modeled AI · {Math.round(l3.aiPct)}%
            </div>
          </div>
          <Icons.ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-forge-hint transition",
              expanded ? "rotate-180 text-accent-purple-dark" : "",
            )}
            aria-hidden
          />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="overflow-hidden border-t border-forge-border"
          >
            <div className="hidden grid-cols-12 gap-3 border-b border-forge-border bg-forge-well/50 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-forge-hint md:grid">
              <div className="col-span-6">Activity (L4)</div>
              <div className="col-span-2">Frequency</div>
              <div className="col-span-2">Criticality</div>
              <div className="col-span-1">Maturity</div>
              <div className="col-span-1 text-right">Priority</div>
            </div>

            <div>
              {l3.l4s.map((l4, i) => (
                <L4Row
                  key={l4.id}
                  l4={l4}
                  l3={l3}
                  tower={tower}
                  index={i}
                  rowId={l3.rowId}
                  review={reviews[l4.id]}
                  actions={actions}
                />
              ))}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-forge-border bg-forge-well/40 px-4 py-2 text-[11px] text-forge-subtle">
              <span>
                Per-L3 AI $ matches the dial set on Step 2 — change once, both
                surfaces update.
              </span>
              <Link
                href={stepTwoHref}
                className="inline-flex items-center gap-1 rounded-full border border-forge-border bg-forge-surface px-2.5 py-1 font-medium text-forge-body hover:border-accent-purple/40 hover:text-accent-purple-dark"
                title="Adjust the AI dial for this capability on Step 2"
              >
                <Icons.SlidersHorizontal className="h-3 w-3" />
                Adjust dial in Step 2
                <Icons.ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/**
 * Renders one L2 work-category panel: header with the L2 description / icon,
 * and a vertical list of L3 cards each expandable to show AI-eligible L4s.
 */
export function ProcessLandscape({
  l2,
  tower,
  reviews,
  actions,
}: {
  l2: InitiativeL2;
  tower: Tower;
  reviews: Record<string, InitiativeReview>;
  actions: UseInitiativeReviewsResult["actions"];
}) {
  const Icon = resolveIcon(l2.l2.icon);
  const [expandedL3, setExpandedL3] = React.useState<string | null>(
    l2.l3s[0]?.l3.id ?? null,
  );

  return (
    <AnimatePresence mode="wait">
      <motion.section
        key={l2.l2.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="overflow-hidden rounded-2xl border border-forge-border bg-forge-surface shadow-card"
      >
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-forge-border bg-forge-well/60 px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-accent-purple/40 bg-accent-purple/10 text-accent-purple-dark">
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <div className="font-display text-lg font-semibold text-forge-ink">
                {l2.l2.name}
              </div>
              {l2.l2.description ? (
                <p className="mt-0.5 max-w-3xl text-xs leading-relaxed text-forge-subtle">
                  {l2.l2.description}
                </p>
              ) : null}
            </div>
          </div>
          <div className="text-right text-xs text-forge-subtle">
            <div className="font-mono text-lg font-semibold tabular-nums text-forge-ink">
              {formatUsdCompact(l2.totalAiUsd)}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-forge-hint">
              modeled AI under this L2
            </div>
          </div>
        </header>

        <div className="space-y-2 p-4 sm:p-5">
          {l2.l3s.map((l3) => (
            <L3RowCard
              key={l3.l3.id}
              l3={l3}
              tower={tower}
              expanded={expandedL3 === l3.l3.id}
              onToggle={() =>
                setExpandedL3((prev) => (prev === l3.l3.id ? null : l3.l3.id))
              }
              reviews={reviews}
              actions={actions}
            />
          ))}
        </div>
      </motion.section>
    </AnimatePresence>
  );
}
