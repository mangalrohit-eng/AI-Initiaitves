"use client";

export type ProcessTimelineRow = {
  tower: string;
  process: string;
  months: number;
};

export function ProcessTimelineTable({ rows }: { rows: ProcessTimelineRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.months));
  return (
    <div className="max-h-[min(70vh,640px)] overflow-y-auto rounded-xl border border-forge-border bg-forge-page">
      <table className="w-full border-collapse text-left text-xs">
        <thead className="sticky top-0 z-10 border-b border-forge-border bg-forge-surface">
          <tr>
            <th className="px-3 py-2 font-semibold text-forge-ink">Tower</th>
            <th className="px-3 py-2 font-semibold text-forge-ink">Process</th>
            <th className="w-40 px-3 py-2 font-semibold text-forge-ink">Timeline</th>
            <th className="w-14 px-3 py-2 text-right font-semibold text-forge-ink">Mo</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.tower}-${r.process}-${i}`} className="border-b border-forge-border/60 last:border-0">
              <td className="whitespace-nowrap px-3 py-2 text-forge-subtle">{r.tower}</td>
              <td className="px-3 py-2 text-forge-body">{r.process}</td>
              <td className="px-3 py-2">
                <div className="h-1.5 overflow-hidden rounded-full bg-forge-well-strong">
                  <div
                    className="h-full rounded-full bg-accent-purple/80"
                    style={{ width: `${Math.min(100, (r.months / max) * 100)}%` }}
                  />
                </div>
              </td>
              <td className="px-3 py-2 text-right font-mono text-forge-ink">{r.months}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
