"use client";

type Row = {
  id: string;
  name: string;
  aiEligible: number;
  total: number;
  percent: number;
};

export function AiEligibilityByTower({ data }: { data: Row[] }) {
  const sorted = [...data].sort((a, b) => b.percent - a.percent);
  return (
    <div className="space-y-2.5">
      {sorted.map((row) => (
        <div
          key={row.id}
          className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.8fr)_72px] items-center gap-3"
        >
          <div className="truncate text-xs font-medium text-forge-body">{row.name}</div>
          <div className="relative h-2.5 overflow-hidden rounded-full bg-forge-well-strong">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent-purple-dark to-accent-purple"
              style={{ width: `${row.percent}%` }}
            />
          </div>
          <div className="text-right font-mono text-xs text-forge-ink">
            {row.aiEligible}/{row.total}
            <span className="ml-1 text-forge-hint">· {row.percent}%</span>
          </div>
        </div>
      ))}
    </div>
  );
}
