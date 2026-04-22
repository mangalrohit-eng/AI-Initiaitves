"use client";

import Link from "next/link";
import * as Icons from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import type { Tower, TowerProcess, WorkCategory } from "@/data/types";
import { cn, findAiInitiative, slugify } from "@/lib/utils";
import { TIER_STYLES, priorityTier } from "@/lib/priority";

function resolveIcon(name: string): LucideIcon {
  const lib = Icons as unknown as Record<string, LucideIcon>;
  return lib[name] ?? Icons.Layers;
}

const FREQ_ACCENT: Record<string, string> = {
  Continuous: "bg-slate-900/5 text-slate-800 border-slate-300",
  Daily: "bg-slate-900/5 text-slate-800 border-slate-300",
  Weekly: "bg-slate-900/5 text-slate-800 border-slate-300",
  Monthly: "bg-slate-900/5 text-slate-800 border-slate-300",
  Quarterly: "bg-slate-900/5 text-slate-800 border-slate-300",
  Annual: "bg-slate-900/5 text-slate-800 border-slate-300",
  "Event-driven": "bg-slate-900/5 text-slate-800 border-slate-300",
  Seasonal: "bg-slate-900/5 text-slate-800 border-slate-300",
};

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

function ProcessRow({ tower, process }: { tower: Tower; process: TowerProcess }) {
  const tier = priorityTier(process.aiPriority);
  const initiative = findAiInitiative(tower, process);
  const hasBrief = !initiative && Boolean(process.briefSlug);
  const isClickable = Boolean(initiative || hasBrief);
  // Solid purple border = full 4-lens initiative.
  // Dashed purple border = lightweight process brief.
  // Transparent = not AI-eligible.
  const borderClass = !process.aiEligible
    ? "border-l-[3px] border-l-transparent"
    : initiative
      ? "border-l-[3px] border-l-accent-purple"
      : hasBrief
        ? "border-l-[3px] border-l-accent-purple/70 border-dashed"
        : "border-l-[3px] border-l-accent-purple/40";
  const content = (
    <div
      className={cn(
        "grid grid-cols-12 items-center gap-3 px-4 py-3 text-sm transition",
        borderClass,
        tier ? TIER_STYLES[tier].row : "bg-transparent",
        isClickable ? "hover:bg-accent-purple/5" : "",
      )}
    >
      <div className="col-span-12 min-w-0 md:col-span-5">
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
            <div className="font-medium text-forge-ink">{process.name}</div>
            {!process.aiEligible ? (
              <p className="mt-1 text-xs leading-relaxed text-forge-subtle">
                <span className="font-semibold uppercase tracking-wide text-forge-hint">
                  Why not AI —{" "}
                </span>
                {process.aiRationale}
              </p>
            ) : (
              <p className="mt-1 hidden text-xs leading-relaxed text-forge-subtle lg:block">
                {process.aiRationale}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="col-span-4 text-xs md:col-span-2">
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2 py-0.5 font-medium",
            FREQ_ACCENT[process.frequency] ?? "border-forge-border bg-forge-well text-forge-body",
          )}
        >
          {process.frequency}
        </span>
      </div>

      <div className="col-span-4 text-xs md:col-span-2">
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2 py-0.5 font-medium",
            CRITICALITY_ACCENT[process.criticality] ?? "",
          )}
        >
          {process.criticality}
        </span>
      </div>

      <div className="col-span-4 text-xs md:col-span-2">
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2 py-0.5 font-medium",
            MATURITY_ACCENT[process.currentMaturity] ?? "",
          )}
        >
          {process.currentMaturity}
        </span>
      </div>

      <div className="col-span-12 flex items-center justify-between gap-2 md:col-span-1 md:justify-end">
        {process.aiEligible ? (
          tier ? (
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold",
                TIER_STYLES[tier].badge,
              )}
            >
              {tier}
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full border border-accent-purple/30 bg-accent-purple/10 px-2 py-0.5 text-xs font-semibold text-accent-purple-dark">
              AI
            </span>
          )
        ) : (
          <span className="inline-flex items-center rounded-full border border-forge-border bg-forge-well px-2 py-0.5 text-xs font-medium text-forge-hint">
            Human-led
          </span>
        )}
        {isClickable ? (
          <Icons.ChevronRight className="h-4 w-4 text-forge-hint transition group-hover:text-accent-purple" />
        ) : null}
      </div>
    </div>
  );

  if (initiative) {
    return (
      <Link
        href={`/tower/${tower.id}/process/${slugify(initiative.name)}`}
        className="group block border-b border-forge-border last:border-b-0"
        title="Open full 4-lens initiative"
      >
        {content}
      </Link>
    );
  }
  if (hasBrief && process.briefSlug) {
    return (
      <Link
        href={`/tower/${tower.id}/brief/${process.briefSlug}`}
        className="group block border-b border-forge-border last:border-b-0"
        title="Open process brief"
      >
        {content}
      </Link>
    );
  }
  return (
    <div
      className="border-b border-forge-border last:border-b-0"
      title={!process.aiEligible ? process.aiRationale : undefined}
    >
      {content}
    </div>
  );
}

export function ProcessLandscape({
  tower,
  category,
}: {
  tower: Tower;
  category: WorkCategory;
}) {
  const Icon = resolveIcon(category.icon);
  const totals = {
    total: category.processes.length,
    eligible: category.processes.filter((p) => p.aiEligible).length,
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={category.id}
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
              <div className="font-display text-lg font-semibold text-forge-ink">{category.name}</div>
              <p className="mt-0.5 max-w-3xl text-xs leading-relaxed text-forge-subtle">
                {category.description}
              </p>
            </div>
          </div>
          <div className="text-xs text-forge-subtle">
            <span className="font-semibold text-forge-ink">{totals.eligible}</span> of{" "}
            <span className="font-semibold text-forge-ink">{totals.total}</span> processes AI-eligible
          </div>
        </header>

        <div className="hidden grid-cols-12 gap-3 border-b border-forge-border bg-forge-well/40 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-forge-hint md:grid">
          <div className="col-span-5">Process</div>
          <div className="col-span-2">Frequency</div>
          <div className="col-span-2">Criticality</div>
          <div className="col-span-2">Maturity</div>
          <div className="col-span-1 text-right">AI</div>
        </div>

        <div>
          {category.processes.map((proc) => (
            <ProcessRow key={proc.id} tower={tower} process={proc} />
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
