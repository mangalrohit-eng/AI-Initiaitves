"use client";

import * as React from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { useReadPersistedStrategistOutputs } from "@/lib/llm/useStrategistOutputs";
import type { TowerId } from "@/data/assess/types";

/**
 * Per-tower Step 4 ribbon — surfaces the strategist's cross-tower
 * outcome clusters this tower contributes to.
 *
 * The ribbon is read-only: it hydrates from the most recent strategist
 * run persisted in localStorage. If no run exists yet it stays
 * collapsed (Step 4 still works without the strategist). When a run
 * does exist, each cluster chip deep-links to the Cross-Tower AI Plan
 * Outcome Clusters tab with `#cluster-{id}` so the user lands on the
 * exact cluster card they care about.
 */
export function TowerClusterRibbon({ towerId }: { towerId: TowerId }) {
  const outputs = useReadPersistedStrategistOutputs();
  const clusters = React.useMemo(() => {
    if (!outputs) return [];
    return outputs.clusters.filter((c) =>
      c.towers.some((t) => (t as string) === (towerId as string)),
    );
  }, [outputs, towerId]);

  if (!outputs) return null;
  if (clusters.length === 0) return null;

  const initiativeCountByCluster = new Map<string, number>();
  for (const i of outputs.initiatives) {
    if (i.towers.some((t) => (t as string) === (towerId as string))) {
      initiativeCountByCluster.set(
        i.clusterId,
        (initiativeCountByCluster.get(i.clusterId) ?? 0) + 1,
      );
    }
  }

  return (
    <section
      aria-label="Cross-tower outcome clusters this tower contributes to"
      className="rounded-xl border border-accent-purple/30 bg-accent-purple/5 px-4 py-3"
    >
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex items-center gap-2">
          <Sparkles
            className="h-4 w-4 text-accent-purple-dark"
            aria-hidden
          />
          <p className="font-display text-[12px] font-semibold uppercase tracking-wider text-accent-purple-dark">
            Cross-tower outcome clusters
          </p>
        </div>
        <p className="min-w-[16rem] flex-1 text-[12px] leading-relaxed text-forge-body">
          This tower contributes to{" "}
          <span className="font-semibold text-forge-ink">
            {clusters.length}{" "}
            {clusters.length === 1 ? "cluster" : "clusters"}
          </span>{" "}
          on the program-level strategist plan. Open the{" "}
          <Link
            href="/cross-tower-ai-plan"
            className="font-semibold text-accent-purple-dark underline-offset-2 hover:underline"
          >
            Cross-Tower AI Plan
          </Link>{" "}
          to see the full Outcome Clusters tab.
        </p>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {clusters.map((c) => {
          const initiativeCount = initiativeCountByCluster.get(c.id) ?? 0;
          return (
            <Link
              key={c.id}
              href={`/cross-tower-ai-plan#cluster-${c.id}`}
              title={c.narrative}
              className="inline-flex items-center gap-1.5 rounded-md border border-accent-purple/30 bg-white/70 px-2 py-1 text-[11.5px] font-medium text-forge-body shadow-sm transition hover:border-accent-purple/60 hover:text-accent-purple-dark"
            >
              <span>{c.title}</span>
              {initiativeCount > 0 ? (
                <span className="rounded-full bg-accent-purple/10 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-accent-purple-dark">
                  {initiativeCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
