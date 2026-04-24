import type { Tower } from "@/data/types";
import { operatingModelTotals } from "@/lib/utils";
import { MetricPill } from "@/components/ui/MetricPill";
import { ChangedSinceBadge } from "@/components/collab/ChangedSinceBadge";

export function TowerHeader({ tower }: { tower: Tower }) {
  const agentsModeled = tower.processes.reduce((n, p) => n + p.agents.length, 0);
  const om = operatingModelTotals(tower);
  return (
    <div className="space-y-4">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-forge-ink sm:text-4xl">{tower.name}</h1>
          <ChangedSinceBadge kind="tower" id={tower.id} lastUpdated={tower.lastUpdated} />
        </div>
        {tower.narrativeSummary ? (
          <p className="mt-3 max-w-4xl text-base font-medium leading-relaxed text-forge-ink">
            {tower.narrativeSummary}
          </p>
        ) : null}
        <p className="mt-3 max-w-4xl text-sm leading-relaxed text-forge-body">{tower.description}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricPill
          label="Processes (AI / total)"
          value={`${om.aiEligibleCount} / ${om.processCount}`}
        />
        <MetricPill label="Agents modeled" value={`${agentsModeled}`} />
        <MetricPill label="Modeled impact (tower)" value={tower.impactTier} />
        <MetricPill label="Top opportunity" value={tower.topOpportunityHeadline} className="sm:col-span-2 lg:col-span-1" />
      </div>
      <details className="rounded-xl border border-forge-border bg-forge-well/80 p-4 text-sm text-forge-body shadow-sm">
        <summary className="cursor-pointer font-medium text-forge-ink">Current state</summary>
        <p className="mt-3 leading-relaxed">{tower.currentState}</p>
      </details>
    </div>
  );
}
