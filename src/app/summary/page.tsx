import { PageShell } from "@/components/PageShell";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { WaterfallChart } from "@/components/charts/WaterfallChart";
import { ReadinessHeatmap } from "@/components/charts/ReadinessHeatmap";
import { AgentTypesPie } from "@/components/charts/AgentTypesPie";
import { towers } from "@/data/towers";
import { agentTypeCounts, hoursByTower, readinessHeatmapPoints } from "@/lib/utils";

export default function SummaryPage() {
  const wf = hoursByTower();
  const heat = readinessHeatmapPoints();
  const pie = agentTypeCounts();

  const gantt = towers.map((t) => ({
    name: t.name,
    months: Math.round(t.processes.reduce((s, p) => s + p.timelineMonths, 0) / Math.max(1, t.processes.length)),
  }));

  return (
    <PageShell>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Executive summary" }]} />
        <div className="mt-6 max-w-3xl">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">Executive summary</h1>
          <p className="mt-3 text-sm leading-relaxed text-white/70">
            Portfolio-level view of modeled hours, readiness signals, agent taxonomy mix, and a simple implementation pacing curve derived from
            average process timelines by tower.
          </p>
        </div>

        <section className="mt-10 space-y-3">
          <h2 className="font-display text-lg font-semibold text-white">Waterfall: hours saved by tower</h2>
          <p className="text-sm text-white/60">Each bar increments cumulative modeled annual hours.</p>
          <div className="min-w-0 rounded-2xl border border-white/10 bg-[#121225]/50 p-4">
            <WaterfallChart data={wf} />
          </div>
        </section>

        <section className="mt-12 space-y-3">
          <h2 className="font-display text-lg font-semibold text-white">AI readiness heatmap (process inventory)</h2>
          <p className="text-sm text-white/60">Impact bar reflects annual hours saved; columns hint complexity tier vs savings intensity.</p>
          <div className="max-h-[520px] overflow-y-auto pr-1">
            <ReadinessHeatmap points={heat} />
          </div>
        </section>

        <section className="mt-12 grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <h2 className="font-display text-lg font-semibold text-white">Agents by type</h2>
            <p className="text-sm text-white/60">Aggregated across all processes in the static dataset.</p>
            <div className="min-w-0 rounded-2xl border border-white/10 bg-[#121225]/50 p-4">
              <AgentTypesPie data={pie} />
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="font-display text-lg font-semibold text-white">Implementation pacing (avg months / tower)</h2>
            <p className="text-sm text-white/60">Gantt-style bars are proportional to average timelineMonths across each tower&apos;s processes.</p>
            <div className="rounded-2xl border border-white/10 bg-[#121225]/50 p-4">
              <div className="space-y-3">
                {gantt.map((row) => (
                  <div key={row.name} className="grid grid-cols-[160px_1fr_52px] items-center gap-3">
                    <div className="truncate text-xs text-white/70">{row.name}</div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-accent-purple to-accent-teal"
                        style={{ width: `${Math.min(100, (row.months / 18) * 100)}%` }}
                      />
                    </div>
                    <div className="text-right font-mono text-xs text-white/70">{row.months}m</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-12 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="font-display text-lg font-semibold text-white">Key investment themes</h2>
          <ul className="mt-4 space-y-3 text-sm text-white/75">
            <li>Stand up a governed data + LLM platform early — it unlocks finance, legal, editorial, and service agents in parallel.</li>
            <li>Prioritize revenue-adjacent automation (ad sales, distribution intelligence, programming optimization) alongside corporate core.</li>
            <li>Design human-in-the-loop operating models now: exception workflows, disclosure controls, and audit trails for agent outputs.</li>
            <li>Consolidate identity and performance signals to prove cross-brand value to advertisers and DTC subscribers.</li>
          </ul>
        </section>
      </div>
    </PageShell>
  );
}
