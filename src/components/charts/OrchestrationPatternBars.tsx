"use client";

import type { AgentOrchestration } from "@/data/types";

export function OrchestrationPatternBars({
  data,
}: {
  data: { pattern: AgentOrchestration["pattern"]; count: number }[];
}) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="space-y-3">
      {data.map((row) => (
        <div key={row.pattern} className="grid grid-cols-[minmax(0,1fr)_1fr_40px] items-center gap-3">
          <div className="truncate text-xs font-medium text-forge-body">{row.pattern}</div>
          <div className="h-2 overflow-hidden rounded-full bg-forge-well-strong">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent-purple-dark to-accent-purple"
              style={{ width: `${(row.count / max) * 100}%` }}
            />
          </div>
          <div className="text-right font-mono text-xs text-forge-ink">{row.count}</div>
        </div>
      ))}
    </div>
  );
}
