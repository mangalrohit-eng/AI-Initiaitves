import Link from "next/link";
import type { Process } from "@/data/types";
import { slugify } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Cpu } from "lucide-react";

export function ProcessCard({ towerSlug, process }: { towerSlug: string; process: Process }) {
  return (
    <Link
      href={`/tower/${towerSlug}/process/${slugify(process.name)}`}
      className="group block rounded-xl border border-forge-border bg-forge-surface p-4 shadow-sm transition hover:border-accent-purple/40 hover:shadow-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium text-forge-ink group-hover:text-accent-purple-dark">{process.name}</div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-forge-subtle">
            <Badge tone={process.complexity}>{process.complexity}</Badge>
            {process.isAiEligible ? (
              <span className="rounded-full border border-accent-teal/35 bg-accent-teal/10 px-2 py-0.5 text-emerald-900">
                AI eligible
              </span>
            ) : null}
            <span>{process.timelineMonths} mo timeline</span>
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-sm text-forge-ink">{process.impactTier}</div>
          <div className="text-[11px] text-forge-hint">impact</div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-forge-subtle">
        <span className="text-forge-body">Full four-lens design</span>
        <span className="inline-flex items-center gap-1 text-forge-body">
          <Cpu className="h-3.5 w-3.5 text-accent-purple" />
          {process.agents.length} agents
        </span>
      </div>
    </Link>
  );
}
