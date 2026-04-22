import Link from "next/link";
import type { Process } from "@/data/types";
import { slugify } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { formatHours } from "@/lib/utils";
import { Cpu } from "lucide-react";

export function ProcessCard({ towerSlug, process }: { towerSlug: string; process: Process }) {
  return (
    <Link
      href={`/tower/${towerSlug}/process/${slugify(process.name)}`}
      className="group block rounded-xl border border-white/10 bg-[#121225]/70 p-4 transition hover:border-accent-purple/40 hover:bg-[#151832]/80"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium text-white group-hover:text-accent-purple-light">{process.name}</div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/55">
            <Badge tone={process.complexity}>{process.complexity}</Badge>
            {process.isAiEligible ? (
              <span className="rounded-full border border-accent-teal/30 bg-accent-teal/10 px-2 py-0.5 text-accent-teal">
                AI eligible
              </span>
            ) : null}
            <span>{process.timelineMonths} mo timeline</span>
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-sm text-white">{process.estimatedTimeSavingsPercent}%</div>
          <div className="text-[11px] text-white/45">time saved</div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-white/55">
        <span className="font-mono text-white/75">{formatHours(process.estimatedAnnualHoursSaved)} hrs / yr</span>
        <span className="inline-flex items-center gap-1">
          <Cpu className="h-3.5 w-3.5 text-accent-purple-light" />
          {process.agents.length} agents
        </span>
      </div>
    </Link>
  );
}
