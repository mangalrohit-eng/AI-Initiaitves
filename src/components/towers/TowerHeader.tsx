import type { Tower } from "@/data/types";
import { formatHours } from "@/lib/utils";
import { MetricPill } from "@/components/ui/MetricPill";

export function TowerHeader({ tower }: { tower: Tower }) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">{tower.name}</h1>
        <p className="mt-3 max-w-4xl text-sm leading-relaxed text-white/70">{tower.description}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricPill label="AI-eligible processes" value={`${tower.aiEligibleProcesses} / ${tower.totalProcesses}`} />
        <MetricPill label="Annual hours saved" value={`${formatHours(tower.estimatedAnnualSavingsHours)} hrs`} />
        <MetricPill label="Top opportunity" value={tower.topOpportunityHeadline} className="lg:col-span-2" />
      </div>
      <details className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm text-white/70">
        <summary className="cursor-pointer font-medium text-white/85">Current state</summary>
        <p className="mt-3 leading-relaxed">{tower.currentState}</p>
      </details>
    </div>
  );
}
