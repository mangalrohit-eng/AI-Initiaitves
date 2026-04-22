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
    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#0b0c18] p-4">
      <div className="min-w-[760px]">
        <div className="grid grid-cols-[220px_1fr] gap-3 text-xs text-white/45">
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
              <div key={`${p.tower}-${p.process}`} className="grid grid-cols-[220px_1fr] items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <div>
                  <div className="text-[11px] text-white/45">{p.tower}</div>
                  <div className="text-sm text-white/85">{p.process}</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full bg-gradient-to-r from-accent-teal to-accent-purple" style={{ width: `${impact * 100}%` }} />
                    </div>
                    <div className="w-16 text-right font-mono text-xs text-white/70">{Math.round(p.hours).toLocaleString()}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-full items-end gap-1">
                      {[0, 1, 2].map((i) => (
                        <div
                          key={i}
                          className={cn(
                            "h-full flex-1 rounded-md",
                            i === cx ? "bg-accent-purple" : "bg-white/10",
                          )}
                          style={{ opacity: 0.25 + savings * (i === cx ? 0.75 : 0.15) }}
                          title={`${p.complexity} · ${p.savingsPct}%`}
                        />
                      ))}
                    </div>
                    <div className="w-12 text-right font-mono text-xs text-white/70">{p.savingsPct}%</div>
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
