"use client";

import * as React from "react";
import Link from "next/link";
import type { Tower } from "@/data/types";
import { impactTierScore, operatingModelTotals } from "@/lib/utils";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { ChangedSinceBadge } from "@/components/collab/ChangedSinceBadge";
import { TowerFreshnessChip } from "@/components/towers/TowerFreshnessChip";

function Sparkline({ tower }: { tower: Tower }) {
  const values = tower.processes.map((p) => impactTierScore(p.impactTier));
  const max = 3;
  return (
    <div className="flex h-10 items-end gap-1">
      {values.slice(0, 8).map((v, i) => (
        <div
          key={i}
          className="w-1.5 rounded-sm bg-accent-purple"
          style={{ height: `${Math.max(12, (v / max) * 100)}%`, opacity: 0.35 + (v / max) * 0.65 }}
        />
      ))}
    </div>
  );
}

function agentCountForTower(tower: Tower) {
  return tower.processes.reduce((n, p) => n + p.agents.length, 0);
}

export function TowerCard({
  tower,
  index,
  footer,
}: {
  tower: Tower;
  index: number;
  /** Optional row below metrics (e.g. deadline chip). */
  footer?: React.ReactNode;
}) {
  const agents = agentCountForTower(tower);
  const om = operatingModelTotals(tower);
  const pct = om.processCount === 0 ? 0 : Math.round((om.aiEligibleCount / om.processCount) * 100);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.35, ease: "easeOut" }}
    >
      <Link href={`/tower/${tower.id}`} className="group block">
        <div className="rounded-2xl border border-forge-border bg-forge-surface p-5 shadow-card transition hover:border-accent-purple hover:shadow-md">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <div className="font-display text-lg font-semibold text-forge-ink">{tower.name}</div>
                <TowerFreshnessChip towerId={tower.id} />
                <ChangedSinceBadge
                  kind="tower"
                  id={tower.id}
                  lastUpdated={tower.lastUpdated}
                  variant="dot"
                />
              </div>
              <div className="mt-1 text-xs text-forge-subtle">Versant: {tower.versantLeads.join(", ")}</div>
              <div className="text-xs text-forge-hint">Accenture: {tower.accentureLeads.join(", ")}</div>
            </div>
            <ArrowUpRight className="h-5 w-5 shrink-0 text-forge-hint transition group-hover:text-accent-purple" />
          </div>

          <p className="mt-4 line-clamp-2 text-sm text-forge-body">{tower.topOpportunityHeadline}</p>

          {footer ? <div className="mt-3 min-w-0">{footer}</div> : null}

          <div className="mt-5 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
            <div>
              <div className="text-forge-hint">AI / total</div>
              <div className="font-mono text-sm text-forge-ink">
                {om.aiEligibleCount} / {om.processCount}
              </div>
            </div>
            <div>
              <div className="text-forge-hint">Agents</div>
              <div className="font-mono text-sm text-forge-ink">{agents}</div>
            </div>
            <div>
              <div className="text-forge-hint">Tower impact</div>
              <div className="font-mono text-sm font-medium text-accent-purple-dark">{tower.impactTier}</div>
            </div>
            <div>
              <div className="text-forge-hint">Initiative mix</div>
              <Sparkline tower={tower} />
            </div>
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
        </div>
      </Link>
    </motion.div>
  );
}
