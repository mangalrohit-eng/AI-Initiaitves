"use client";

import { cn } from "@/lib/utils";

const complexityRank: Record<string, number> = { Low: 0, Medium: 1, High: 2 };

export function ReadinessHeatmap({
  points,
}: {
  points: { tower: string; process: string; complexity: "Low" | "Medium" | "High"; hours: number; savingsPct: number }[];
}) {
  const maxHours = Math.max(1, ...points.map((p) => p.hours));
  const maxPct = 100;

  return (
    <div className="overflow-x-auto rounded-2xl border border-forge-border bg-forge-surface p-4 shadow-sm">
      <div className="min-w-[760px]">
        <div className="grid grid-cols-[220px_1fr] gap-3 text-xs text-forge-hint">
          <div>Process</div>
          <div className="grid grid-cols-2 gap-3">
            <div>Impact (hours saved)</div>
            <div>Complexity vs savings %</div>
          </div>
        </div>
        <div className="mt-3 space-y-2">
          {points.map((p) => {
            const impact = p.hours / maxHours;
            const savings = p.savingsPct / maxPct;
            const cx = complexityRank[p.complexity] ?? 1;
            return (
              <div
                key={`${p.tower}-${p.process}`}
                className="grid grid-cols-[220px_1fr] items-center gap-3 rounded-xl border border-forge-border bg-forge-well p-3"
              >
                <div>
                  <div className="text-[11px] text-forge-hint">{p.tower}</div>
                  <div className="text-sm text-forge-ink">{p.process}</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-forge-well-strong">
                      <div className="h-full bg-accent-purple" style={{ width: `${impact * 100}%`, opacity: 0.85 }} />
                    </div>
                    <div className="w-16 text-right font-mono text-xs text-forge-body">{Math.round(p.hours).toLocaleString()}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-full items-end gap-1">
                      {[0, 1, 2].map((i) => (
                        <div
                          key={i}
                          className={cn("h-full flex-1 rounded-md", i === cx ? "bg-accent-purple" : "bg-forge-border")}
                          style={{ opacity: 0.35 + savings * (i === cx ? 0.65 : 0.12) }}
                          title={`${p.complexity} · ${p.savingsPct}%`}
                        />
                      ))}
                    </div>
                    <div className="w-12 text-right font-mono text-xs text-forge-body">{p.savingsPct}%</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
