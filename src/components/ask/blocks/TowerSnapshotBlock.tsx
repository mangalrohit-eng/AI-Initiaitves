"use client";

import Link from "next/link";
import { ArrowRight, Building2, UserCircle2 } from "lucide-react";
import type { AskTowerSnapshotBlock } from "@/lib/ask/types";
import type { ImpactTier } from "@/data/types";

const TIER_CLASSES: Record<ImpactTier, string> = {
  High: "border-accent-red/40 bg-accent-red/10 text-accent-red",
  Medium: "border-accent-amber/40 bg-accent-amber/10 text-accent-amber",
  Low: "border-accent-teal/40 bg-accent-teal/10 text-accent-teal",
};

export function TowerSnapshotBlock({ block }: { block: AskTowerSnapshotBlock }) {
  return (
    <div className="rounded-xl border border-forge-border bg-forge-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-accent-purple/30 bg-accent-purple/10 text-accent-purple-dark">
            <Building2 className="h-4 w-4" aria-hidden />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-forge-subtle">
              Tower
            </div>
            <div className="font-display text-lg font-semibold leading-tight text-forge-ink">
              {block.name}
            </div>
            <div className="mt-0.5 font-mono text-[11px] text-forge-hint">{block.towerId}</div>
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${TIER_CLASSES[block.impactTier]}`}
        >
          {block.impactTier} impact
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <LeadCol label="Versant leads" leads={block.versantLeads} />
        <LeadCol label="Accenture leads" leads={block.accentureLeads} />
      </div>

      {block.topOpportunity ? (
        <div className="mt-4 rounded-lg border border-forge-border bg-forge-well/40 p-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-forge-subtle">
            Top opportunity
          </div>
          <div className="mt-1 text-sm leading-relaxed text-forge-body">
            {block.topOpportunity}
          </div>
        </div>
      ) : null}

      {block.kpis.length > 0 ? (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {block.kpis.map((k, i) => (
            <div
              key={`${i}-${k.label}`}
              className="rounded-lg border border-forge-border bg-forge-canvas p-3"
            >
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-forge-subtle">
                {k.label}
              </div>
              <div className="mt-1 font-mono text-sm font-semibold text-forge-ink">
                {k.value}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-4">
        <Link
          href={`/tower/${block.towerId}`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-accent-purple-dark hover:text-accent-purple"
        >
          Open tower
          <ArrowRight className="h-3 w-3" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

function LeadCol({ label, leads }: { label: string; leads: string[] }) {
  if (leads.length === 0) {
    return null;
  }
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-forge-subtle">
        {label}
      </div>
      <ul className="mt-1.5 space-y-1">
        {leads.map((name) => (
          <li
            key={name}
            className="flex items-center gap-1.5 text-xs leading-relaxed text-forge-body"
          >
            <UserCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-forge-hint" aria-hidden />
            {name}
          </li>
        ))}
      </ul>
    </div>
  );
}
