"use client";

import Link from "next/link";
import { ArrowRight, Bot, Wrench } from "lucide-react";
import type { ImpactTier } from "@/data/types";
import type { AskInitiativeBlock } from "@/lib/ask/types";

const TIER_CLASSES: Record<"P1" | "P2", string> = {
  P1: "border-accent-red/40 bg-accent-red/10 text-accent-red",
  P2: "border-accent-amber/40 bg-accent-amber/10 text-accent-amber",
};

const IMPACT_DOT: Record<ImpactTier, string> = {
  High: "bg-accent-red",
  Medium: "bg-accent-amber",
  Low: "bg-accent-teal",
};

export function InitiativeBlock({ block }: { block: AskInitiativeBlock }) {
  return (
    <div className="rounded-xl border border-forge-border bg-forge-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-forge-subtle">
            AI initiative · brief
          </div>
          <div className="mt-1 font-display text-base font-semibold leading-tight text-forge-ink">
            {block.name}
          </div>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-forge-subtle">
            <span className="font-mono text-forge-hint">{block.briefId}</span>
            <span aria-hidden>·</span>
            <span>tower: {block.towerId}</span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1">
              <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${IMPACT_DOT[block.impactTier]}`} />
              {block.impactTier} impact
            </span>
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${TIER_CLASSES[block.tier]}`}
        >
          {block.tier}
        </span>
      </div>

      {block.keyMetric ? (
        <div className="mt-3 rounded-lg border border-forge-border bg-forge-well/40 p-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-forge-subtle">
            Key metric
          </div>
          <div className="mt-1 text-sm leading-relaxed text-forge-body">{block.keyMetric}</div>
        </div>
      ) : null}

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ChipRow label="Agents" icon={<Bot className="h-3 w-3" aria-hidden />} items={block.agents} />
        <ChipRow label="Tools" icon={<Wrench className="h-3 w-3" aria-hidden />} items={block.tools} />
      </div>

      <div className="mt-4">
        <Link
          href={`/tower/${block.towerId}/brief/${block.briefId}`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-accent-purple-dark hover:text-accent-purple"
        >
          Open brief
          <ArrowRight className="h-3 w-3" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

function ChipRow({
  label,
  icon,
  items,
}: {
  label: string;
  icon: React.ReactNode;
  items: string[];
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-forge-subtle">
        {icon}
        {label}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {items.map((s) => (
          <span
            key={s}
            className="inline-flex items-center rounded-md border border-forge-border bg-forge-canvas px-2 py-0.5 text-[11px] font-medium text-forge-body"
          >
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}
