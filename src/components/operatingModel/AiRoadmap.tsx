"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import type { Tower, TowerProcess } from "@/data/types";
import { cn, findAiInitiative, slugify } from "@/lib/utils";
import { TIER_META, priorityTier, type Tier } from "@/lib/priority";

function RoadmapCard({
  tower,
  process,
  index,
}: {
  tower: Tower;
  process: TowerProcess;
  index: number;
}) {
  const initiative = findAiInitiative(tower, process);
  const body = (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.3, ease: "easeOut" }}
      className={cn(
        "group relative rounded-xl border border-forge-border bg-forge-surface p-4 shadow-sm transition",
        initiative ? "hover:border-accent-purple/50 hover:shadow-card" : "",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-forge-ink group-hover:text-accent-purple-dark">
            {process.name}
          </div>
          {initiative ? (
            <div className="mt-1 text-[11px] uppercase tracking-wide text-forge-hint">
              {process.aiInitiativeRelation === "sub-process"
                ? `Sub-process of ${initiative.name}`
                : process.aiInitiativeRelation === "related"
                  ? `Related to ${initiative.name}`
                  : process.aiInitiativeRelation === "governance"
                    ? `Governance within ${initiative.name}`
                    : initiative.name}
            </div>
          ) : null}
        </div>
        {initiative ? (
          <ArrowUpRight className="h-4 w-4 shrink-0 text-forge-hint transition group-hover:text-accent-purple" />
        ) : null}
      </div>
      <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-forge-body">{process.aiRationale}</p>
      {initiative ? (
        <div className="mt-3 flex items-center gap-2 text-[11px] text-forge-subtle">
          <span className="rounded-full border border-forge-border bg-forge-well px-2 py-0.5 font-mono">
            Impact: {initiative.impactTier}
          </span>
          <span className="rounded-full border border-forge-border bg-forge-well px-2 py-0.5">
            {initiative.agents.length} agents
          </span>
        </div>
      ) : null}
    </motion.div>
  );

  if (initiative) {
    return (
      <Link href={`/tower/${tower.id}/process/${slugify(initiative.name)}`} className="block">
        {body}
      </Link>
    );
  }
  return body;
}

export function AiRoadmap({ tower }: { tower: Tower }) {
  const flat: TowerProcess[] = tower.workCategories.flatMap((c) => c.processes);
  const grouped: Record<Tier, TowerProcess[]> = { P1: [], P2: [], P3: [] };
  for (const p of flat) {
    const t = priorityTier(p.aiPriority);
    if (t) grouped[t].push(p);
  }
  const totalAi = grouped.P1.length + grouped.P2.length + grouped.P3.length;
  if (totalAi === 0) return null;

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
                  <div className="text-[11px] text-forge-subtle">{meta.window}</div>
                </div>
              </div>
              <div className="rounded-full border border-forge-border bg-forge-surface px-2 py-0.5 text-[11px] font-mono text-forge-body">
                {items.length}
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {items.length === 0 ? (
                <div className="rounded-xl border border-dashed border-forge-border bg-forge-surface/60 p-4 text-center text-xs text-forge-hint">
                  No initiatives queued in this window.
                </div>
              ) : (
                items.map((p, i) => <RoadmapCard key={p.id} tower={tower} process={p} index={i} />)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
