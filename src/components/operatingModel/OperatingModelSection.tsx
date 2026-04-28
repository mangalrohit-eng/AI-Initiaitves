"use client";

import * as React from "react";
import * as Icons from "lucide-react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import type { Tower } from "@/data/types";
import { ProcessLandscape } from "./ProcessLandscape";
import { AiRoadmap } from "./AiRoadmap";
import { StaleCurationBanner } from "./StaleCurationBanner";
import { useTowerInitiatives } from "@/lib/initiatives/useTowerInitiatives";
import type { InitiativeL2 } from "@/lib/initiatives/select";
import { formatUsdCompact } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TowerId } from "@/data/assess/types";

function resolveIcon(name?: string): LucideIcon {
  if (!name) return Icons.Layers;
  const lib = Icons as unknown as Record<string, LucideIcon>;
  return lib[name] ?? Icons.Layers;
}

/**
 * One L2 work-category card on the AI Initiatives "operating model" grid.
 *
 * Counts and dollar figures come straight from the selector (which routes
 * every $ through `rowModeledSaving` from `scenarioModel.ts`), so the card's
 * tile-level numbers are always identical to what the user set on Step 2.
 */
function L2Card({
  view,
  active,
  onSelect,
  index,
}: {
  view: InitiativeL2;
  active: boolean;
  onSelect: () => void;
  index: number;
}) {
  const Icon = resolveIcon(view.l2.icon);
  const total = view.curatedL4Count + view.placeholderL4Count;
  const curated = view.curatedL4Count;
  const pct = total === 0 ? 0 : Math.round((curated / total) * 100);
  const l3Count = view.l3s.length;

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3, ease: "easeOut" }}
      className={cn(
        "group relative flex h-full w-full flex-col rounded-2xl border bg-forge-surface p-5 text-left shadow-sm transition",
        active
          ? "border-accent-purple shadow-card ring-2 ring-accent-purple/30"
          : "border-forge-border hover:border-accent-purple/50 hover:shadow-card",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition",
            active
              ? "border-accent-purple/50 bg-accent-purple/10 text-accent-purple-dark"
              : "border-forge-border bg-forge-well text-forge-body group-hover:border-accent-purple/40 group-hover:text-accent-purple-dark",
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-display text-base font-semibold text-forge-ink">
            {view.l2.name}
          </div>
          {view.l2.description ? (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-forge-subtle">
              {view.l2.description}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide">
        <span className="rounded-full border border-forge-border bg-forge-well px-2 py-0.5 text-forge-body">
          {l3Count} {l3Count === 1 ? "capability" : "capabilities"}
        </span>
        <span className="rounded-full border border-accent-purple/35 bg-accent-purple/10 px-2 py-0.5 text-accent-purple-dark">
          {curated} AI-eligible
        </span>
        {view.placeholderL4Count > 0 ? (
          <span
            className="rounded-full border border-forge-border bg-forge-well px-2 py-0.5 text-forge-hint"
            title={`${view.placeholderL4Count} L3 capability${view.placeholderL4Count === 1 ? "" : "ies"} are scoped on Step 2 (dial > 0) but still awaiting curated activity detail`}
          >
            {view.placeholderL4Count} pending
          </span>
        ) : null}
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-forge-hint">
            Modeled AI $
          </div>
          <div className="font-mono text-lg font-semibold tabular-nums text-forge-ink">
            {formatUsdCompact(view.totalAiUsd)}
          </div>
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between text-[11px] text-forge-hint">
            <span>Coverage</span>
            <span className="font-mono text-forge-body">{pct}%</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-forge-well">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent-purple/70 to-accent-purple"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>
    </motion.button>
  );
}

export function OperatingModelSection({
  tower,
  showRoadmap = true,
}: {
  tower: Tower;
  showRoadmap?: boolean;
}) {
  const result = useTowerInitiatives(tower);
  const [activeId, setActiveId] = React.useState<string>(
    () => result.l2s[0]?.l2.id ?? "",
  );

  // If the active L2 disappears (e.g. user just zeroed every dial under it on
  // Step 2), fall back to the first available view so we never render a stale
  // header. Wrapped in useEffect so we don't update state during render.
  React.useEffect(() => {
    if (result.l2s.length === 0) {
      if (activeId) setActiveId("");
      return;
    }
    if (!result.l2s.some((v) => v.l2.id === activeId)) {
      setActiveId(result.l2s[0].l2.id);
    }
  }, [result.l2s, activeId]);

  const active =
    result.l2s.find((v) => v.l2.id === activeId) ?? result.l2s[0] ?? null;

  const totalCapabilities = result.l2s.reduce((s, l2) => s + l2.l3s.length, 0);
  const totalCurated = result.l2s.reduce((s, l2) => s + l2.curatedL4Count, 0);
  const totalPending = result.l2s.reduce(
    (s, l2) => s + l2.placeholderL4Count,
    0,
  );

  return (
    <div className="space-y-10">
      <StaleCurationBanner towerId={tower.id as TowerId} />
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold text-forge-ink">
              L2 — Work categories
            </h2>
            <p className="mt-1 text-sm text-forge-subtle">
              <span className="font-medium text-forge-ink">
                {result.l2s.length}
              </span>{" "}
              work {result.l2s.length === 1 ? "category" : "categories"} ·{" "}
              <span className="font-medium text-forge-ink">
                {totalCapabilities}
              </span>{" "}
              capabilities in scope ·{" "}
              <span className="font-medium text-accent-purple-dark">
                {totalCurated}
              </span>{" "}
              AI-eligible activities
              {totalPending > 0 ? (
                <>
                  {" "}
                  ·{" "}
                  <span
                    className="text-forge-body"
                    title="Capabilities where AI couldn't identify candidate L4 activities. Open the L2 to see remediation links."
                  >
                    {totalPending} need manual review
                  </span>
                </>
              ) : null}
            </p>
          </div>
          <p className="max-w-xl text-xs text-forge-subtle">
            L2 sub-functions filtered to those with at least one L3 dialled
            above zero on Step 2. Select an L2 to drop into its L3 capabilities
            and expand each into the AI-eligible activities (L4) underneath.
          </p>
        </div>

        {result.l2s.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-forge-border bg-forge-well/40 px-5 py-8 text-center text-sm text-forge-subtle">
            No L2 sub-functions are currently in scope for AI on this tower.
            Open Step 2 (Configure Impact Levers) and raise the AI dial on the
            capabilities you want to bring into the AI Initiatives view.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {result.l2s.map((view, i) => (
              <L2Card
                key={view.l2.id}
                view={view}
                index={i}
                active={active?.l2.id === view.l2.id}
                onSelect={() => setActiveId(view.l2.id)}
              />
            ))}
          </div>
        )}
      </section>

      {active ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="font-display text-lg font-semibold text-forge-ink">
                L3 — Capabilities & activities
              </h3>
              <p className="mt-1 text-sm text-forge-subtle">
                L3 capabilities under{" "}
                <span className="font-medium text-forge-ink">
                  {active.l2.name}
                </span>
                . Per-L3 $ matches the modeled AI savings on Step 2. Expand a
                row to see the AI-eligible L4 activities, frequency,
                criticality, maturity, and the concrete agent that delivers it.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-forge-subtle">
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="h-4 w-[3px] rounded-sm bg-accent-purple"
                  aria-hidden
                />
                Full initiative
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="h-4 w-[3px] rounded-sm border-l-2 border-dashed border-accent-purple/70"
                  aria-hidden
                />
                Process brief
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="h-4 w-[3px] rounded-sm border-l-2 border-dashed border-forge-border"
                  aria-hidden
                />
                Needs manual review
              </span>
            </div>
          </div>
          <ProcessLandscape l2={active} tower={tower} />
        </section>
      ) : null}

      {showRoadmap ? (
        <section className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h3 className="font-display text-lg font-semibold text-forge-ink">
                AI transformation roadmap
              </h3>
              <p className="mt-1 text-sm text-forge-subtle">
                Every AI-eligible L4 activity across the tower, sequenced by
                priority. Each card links to the full four-lens initiative
                detail or the lightweight pre/post brief.
              </p>
            </div>
          </div>
          <AiRoadmap tower={tower} />
        </section>
      ) : null}
    </div>
  );
}
