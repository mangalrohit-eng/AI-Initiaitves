"use client";

import * as Icons from "lucide-react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import type { WorkCategory } from "@/data/types";
import { cn } from "@/lib/utils";

function resolveIcon(name: string): LucideIcon {
  const lib = Icons as unknown as Record<string, LucideIcon>;
  return lib[name] ?? Icons.Layers;
}

export function WorkCategoryCard({
  category,
  active,
  onSelect,
  index,
}: {
  category: WorkCategory;
  active: boolean;
  onSelect: () => void;
  index: number;
}) {
  const total = category.processes.length;
  const eligible = category.processes.filter((p) => p.aiEligible).length;
  const pct = total === 0 ? 0 : Math.round((eligible / total) * 100);
  const Icon = resolveIcon(category.icon);

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
          <div className="font-display text-base font-semibold text-forge-ink">{category.name}</div>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-forge-subtle">{category.description}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide">
        <span className="rounded-full border border-forge-border bg-forge-well px-2 py-0.5 text-forge-body">
          {total} {total === 1 ? "process" : "processes"}
        </span>
        <span className="rounded-full border border-accent-purple/35 bg-accent-purple/10 px-2 py-0.5 text-accent-purple-dark">
          {eligible} AI-eligible
        </span>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-[11px] text-forge-hint">
          <span>AI coverage</span>
          <span className="font-mono text-forge-body">{pct}%</span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-forge-well">
          <div
            className="h-full rounded-full bg-gradient-to-r from-accent-purple/70 to-accent-purple"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </motion.button>
  );
}
