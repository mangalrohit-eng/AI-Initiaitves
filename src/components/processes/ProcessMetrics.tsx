import type { Process } from "@/data/types";
import { Badge } from "@/components/ui/Badge";
import { MetricPill } from "@/components/ui/MetricPill";

export function ProcessMetrics({ process }: { process: Process }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <MetricPill label="Complexity" value={process.complexity} />
      <MetricPill label="Timeline" value={`${process.timelineMonths} months`} />
      <MetricPill label="Modeled impact" value={process.impactTier} />
      <div className="sm:col-span-2 lg:col-span-3 flex flex-wrap gap-2">
        <Badge tone={process.complexity}>Complexity: {process.complexity}</Badge>
        {process.isAiEligible ? <Badge tone="Low">AI eligible</Badge> : <Badge tone="High">Not AI eligible</Badge>}
      </div>
    </div>
  );
}
