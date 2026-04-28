"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, CalendarClock } from "lucide-react";
import type { Tower } from "@/data/types";
import { cn, slugify } from "@/lib/utils";
import { TIER_META, priorityTier, type Tier } from "@/lib/priority";
import { useTowerInitiatives } from "@/lib/initiatives/useTowerInitiatives";
import type { InitiativeL3, InitiativeL4 } from "@/lib/initiatives/select";
import { formatUsdCompact } from "@/lib/format";

type RoadmapItem = {
  l4: InitiativeL4;
  l3: InitiativeL3;
};

function RoadmapCard({
  tower,
  item,
  index,
}: {
  tower: Tower;
  item: RoadmapItem;
  index: number;
}) {
  const { l4, l3 } = item;
  const initiative = l4.initiativeId
    ? tower.processes.find((p) => p.id === l4.initiativeId)
    : undefined;
  const initiativeHref = initiative
    ? `/tower/${tower.id}/process/${slugify(initiative.name)}`
    : undefined;
  const briefHref = l4.briefSlug ? `/tower/${tower.id}/brief/${l4.briefSlug}` : undefined;
  const isLink = Boolean(initiativeHref || briefHref);

  const body = (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.3, ease: "easeOut" }}
      className={cn(
        "group relative rounded-xl border border-forge-border bg-forge-surface p-4 shadow-sm transition",
        isLink ? "hover:border-accent-purple/50 hover:shadow-card" : "",
        l4.isPlaceholder ? "border-dashed" : "",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div
            className={cn(
              "text-sm font-semibold",
              l4.isPlaceholder
                ? "italic text-forge-subtle"
                : "text-forge-ink group-hover:text-accent-purple-dark",
            )}
          >
            {l4.name}
          </div>
          <div className="mt-1 text-[11px] uppercase tracking-wide text-forge-hint">
            {l3.l2Name} · {l3.l3.name}
          </div>
        </div>
        {isLink ? (
          <ArrowUpRight className="h-4 w-4 shrink-0 text-forge-hint transition group-hover:text-accent-purple" />
        ) : l4.isPlaceholder ? (
          <CalendarClock className="h-4 w-4 shrink-0 text-forge-hint" />
        ) : null}
      </div>

      {l4.aiRationale ? (
        <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-forge-body">
          {l4.aiRationale}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-forge-subtle">
        <span className="rounded-full border border-forge-border bg-forge-well px-2 py-0.5 font-mono tabular-nums text-forge-ink">
          {formatUsdCompact(l3.aiUsd)} AI $
        </span>
        {initiative ? (
          <span className="rounded-full border border-forge-border bg-forge-well px-2 py-0.5">
            {initiative.agents.length} agents
          </span>
        ) : null}
        {l4.frequency ? (
          <span className="rounded-full border border-forge-border bg-forge-well px-2 py-0.5">
            {l4.frequency}
          </span>
        ) : null}
        {l4.isPlaceholder ? (
          <span
            className="rounded-full border border-forge-border bg-forge-well px-2 py-0.5"
            title="AI couldn't identify L4 activities that are candidates for AI here. Regenerate the L4 list on Step 1, or reduce the AI dial for this L3 to zero on Step 2."
          >
            No AI candidates
          </span>
        ) : null}
      </div>
    </motion.div>
  );

  if (initiativeHref) {
    return (
      <Link href={initiativeHref} className="block">
        {body}
      </Link>
    );
  }
  if (briefHref) {
    return (
      <Link href={briefHref} className="block">
        {body}
      </Link>
    );
  }
  return body;
}

export function AiRoadmap({ tower }: { tower: Tower }) {
  const result = useTowerInitiatives(tower);
  const grouped: Record<Tier, RoadmapItem[]> = { P1: [], P2: [], P3: [] };
  for (const l2 of result.l2s) {
    for (const l3 of l2.l3s) {
      for (const l4 of l3.l4s) {
        const tier = priorityTier(l4.aiPriority);
        if (!tier) continue;
        grouped[tier].push({ l4, l3 });
      }
    }
  }
  const totalAi = grouped.P1.length + grouped.P2.length + grouped.P3.length;
  if (totalAi === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-forge-border bg-forge-well/40 px-5 py-8 text-center text-sm text-forge-subtle">
        No AI-eligible activities are currently sequenced for this tower. Open
        Step 2 (Configure Impact Levers) and raise the AI dial on the
        capabilities you want to bring into the roadmap.
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {(Object.keys(TIER_META) as Tier[]).map((tier) => {
        const meta = TIER_META[tier];
        const items = grouped[tier];
        const Icon = meta.icon;
        return (
          <div
            key={tier}
            className={cn("flex flex-col rounded-2xl border p-4", meta.ring)}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm",
                    meta.gradient,
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <div className="font-display text-sm font-semibold text-forge-ink">
                    {tier} — {meta.label}
                  </div>
                  <div className="text-[11px] text-forge-subtle">
                    {meta.window}
                  </div>
                </div>
              </div>
              <div className="rounded-full border border-forge-border bg-forge-surface px-2 py-0.5 text-[11px] font-mono text-forge-body">
                {items.length}
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {items.length === 0 ? (
                <div className="rounded-xl border border-dashed border-forge-border bg-forge-surface/60 p-4 text-center text-xs text-forge-hint">
                  No activities queued in this window.
                </div>
              ) : (
                items.map((item, i) => (
                  <RoadmapCard
                    key={item.l4.id}
                    tower={tower}
                    item={item}
                    index={i}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
