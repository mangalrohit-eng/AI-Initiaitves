import { PageShell } from "@/components/PageShell";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { WaterfallChart } from "@/components/charts/WaterfallChart";
import { ReadinessHeatmap } from "@/components/charts/ReadinessHeatmap";
import { AgentTypesPie } from "@/components/charts/AgentTypesPie";
import { OrchestrationPatternBars } from "@/components/charts/OrchestrationPatternBars";
import { ProcessTimelineTable } from "@/components/charts/ProcessTimelineTable";
import { towers } from "@/data/towers";
import {
  aggregateTotals,
  agentTypeCounts,
  allProcessTimelines,
  hoursByTower,
  orchestrationPatternCounts,
  readinessHeatmapPoints,
} from "@/lib/utils";

export default function SummaryPage() {
  const wf = hoursByTower();
  const heat = readinessHeatmapPoints();
  const pie = agentTypeCounts();
  const patterns = orchestrationPatternCounts();
  const timelines = allProcessTimelines();
  const totals = aggregateTotals();

  return (
    <PageShell>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Executive summary" }]} />
        <div className="mt-6 max-w-3xl">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-forge-ink sm:text-4xl">Executive summary</h1>
          <p className="mt-3 text-sm leading-relaxed text-forge-body">
            Portfolio-level view of modeled hours, readiness signals, agent taxonomy mix, orchestration patterns across all{" "}
            {totals.aiProcesses} AI-eligible processes, and implementation pacing from each process&apos;s timeline.
          </p>
        </div>

        <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-forge-border bg-forge-surface p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-forge-hint">Total agents</div>
            <div className="mt-2 font-mono text-2xl font-semibold text-accent-purple-dark">{totals.agentCount}</div>
            <p className="mt-1 text-xs text-forge-subtle">Exact count from the static dataset</p>
          </div>
          <div className="rounded-2xl border border-forge-border bg-forge-surface p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-forge-hint">AI processes</div>
            <div className="mt-2 font-mono text-2xl font-semibold text-accent-purple-dark">{totals.aiProcesses}</div>
          </div>
          <div className="rounded-2xl border border-forge-border bg-forge-surface p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-forge-hint">Towers</div>
            <div className="mt-2 font-mono text-2xl font-semibold text-accent-purple-dark">{totals.totalTowers}</div>
          </div>
          <div className="rounded-2xl border border-forge-border bg-forge-surface p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-forge-hint">Annual hours saved (modeled)</div>
            <div className="mt-2 font-mono text-2xl font-semibold text-accent-purple-dark">{totals.hours.toLocaleString()}</div>
          </div>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="font-display text-lg font-semibold text-forge-ink">Waterfall: hours saved by tower</h2>
          <p className="text-sm text-forge-subtle">Each bar increments cumulative modeled annual hours.</p>
          <div className="min-w-0 rounded-2xl border border-forge-border bg-forge-surface p-4 shadow-card">
            <WaterfallChart data={wf} />
          </div>
        </section>

        <section className="mt-12 space-y-3">
          <h2 className="font-display text-lg font-semibold text-forge-ink">AI readiness heatmap (all processes)</h2>
          <p className="text-sm text-forge-subtle">Impact bar reflects annual hours saved per process; columns reflect complexity tier vs savings intensity.</p>
          <div className="max-h-[520px] overflow-y-auto pr-1">
            <ReadinessHeatmap points={heat} />
          </div>
        </section>

        <section className="mt-12 grid min-w-0 gap-6 lg:grid-cols-2">
          <div className="min-w-0 space-y-3">
            <h2 className="font-display text-lg font-semibold text-forge-ink">Agents by type</h2>
            <p className="text-sm text-forge-subtle">Aggregated across every process in the dataset.</p>
            <div className="min-w-0 rounded-2xl border border-forge-border bg-forge-surface p-4 shadow-card">
              <AgentTypesPie data={pie} />
            </div>
          </div>

          <div className="min-w-0 space-y-3">
            <h2 className="font-display text-lg font-semibold text-forge-ink">Orchestration pattern distribution</h2>
            <p className="text-sm text-forge-subtle">Count of processes using each pattern (e.g. Pipeline, Hub-and-Spoke).</p>
            <div className="rounded-2xl border border-forge-border bg-forge-surface p-4 shadow-card">
              <OrchestrationPatternBars data={patterns} />
            </div>
          </div>
        </section>

        <section className="mt-12 space-y-3">
          <h2 className="font-display text-lg font-semibold text-forge-ink">Implementation timeline (every process)</h2>
          <p className="text-sm text-forge-subtle">
            Each row is one process with its timelineMonths value ({timelines.length} processes across {towers.length} towers).
          </p>
          <div className="rounded-2xl border border-forge-border bg-forge-surface p-4 shadow-card">
            <ProcessTimelineTable rows={timelines} />
          </div>
        </section>

        <section className="mt-12 rounded-2xl border border-forge-border bg-forge-surface p-6 shadow-card">
          <h2 className="font-display text-lg font-semibold text-forge-ink">Key investment themes</h2>
          <ul className="mt-4 space-y-3 text-sm text-forge-body">
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
