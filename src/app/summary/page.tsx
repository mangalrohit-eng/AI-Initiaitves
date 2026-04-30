import Link from "next/link";
import { ArrowRight, Network } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { WaterfallChart } from "@/components/charts/WaterfallChart";
import { ReadinessHeatmap } from "@/components/charts/ReadinessHeatmap";
import { AgentTypesPie } from "@/components/charts/AgentTypesPie";
import { OrchestrationPatternBars } from "@/components/charts/OrchestrationPatternBars";
import { ProcessTimelineTable } from "@/components/charts/ProcessTimelineTable";
import { AiEligibilityByTower } from "@/components/charts/AiEligibilityByTower";
import { towers } from "@/data/towers";
import {
  aggregateTotals,
  agentTypeCounts,
  aiEligibleDetailCount,
  allProcessTimelines,
  evidenceCoverage,
  impactByTower,
  orchestrationPatternCounts,
  readinessHeatmapPoints,
  towerAiEligibility,
} from "@/lib/utils";
import { evidenceClusters } from "@/data/evidenceMap";

export default function SummaryPage() {
  const wf = impactByTower();
  const heat = readinessHeatmapPoints();
  const pie = agentTypeCounts();
  const patterns = orchestrationPatternCounts();
  const timelines = allProcessTimelines();
  const totals = aggregateTotals();
  const detailSurface = aiEligibleDetailCount();
  const evCoverage = evidenceCoverage();
  const eligibility = towerAiEligibility();
  const totalOperatingProcesses = eligibility.reduce((n, r) => n + r.total, 0);
  const totalAiEligible = eligibility.reduce((n, r) => n + r.aiEligible, 0);
  const eligibilityPct = totalOperatingProcesses === 0
    ? 0
    : Math.round((totalAiEligible / totalOperatingProcesses) * 100);

  return (
    <PageShell>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Executive summary" }]} />
        <div className="mt-6 max-w-3xl">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-forge-ink sm:text-4xl">Executive summary</h1>
          <p className="mt-3 text-sm leading-relaxed text-forge-body">
            Portfolio-level view covering {totalOperatingProcesses} mapped tower processes,{" "}
            {totalAiEligible} AI-eligible initiatives ({eligibilityPct}%), and{" "}
            {detailSurface.total} deeply-specified process details ({detailSurface.initiativeCount} full
            four-lens initiatives + {detailSurface.briefCount} process briefs) — each backed by
            real-world feasibility evidence across {evidenceClusters.length} research-validated
            clusters. Plus qualitative impact tiers, readiness signals, agent taxonomy, orchestration
            patterns, and implementation pacing.
          </p>
        </div>

        <Link
          href="/program/cross-tower-ai-plan"
          className="group mt-6 flex items-center justify-between gap-4 rounded-2xl border border-accent-purple/30 bg-gradient-to-r from-accent-purple/10 via-accent-purple/5 to-transparent px-5 py-4 transition hover:border-accent-purple/60"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-accent-purple/30 bg-forge-surface text-accent-purple-dark">
              <Network className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-accent-purple-dark/80">
                Plan view
              </div>
              <div className="font-display text-base font-semibold text-forge-ink">
                <span className="font-mono text-accent-purple-dark">&gt;</span> Open the cross-tower AI plan
              </div>
              <p className="mt-0.5 text-xs leading-relaxed text-forge-subtle">
                Ranked initiatives, three-horizon roadmap, agent architecture, and a 24-month modeled value buildup —
                authored by GPT-5.5 and grounded in this portfolio.
              </p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 flex-shrink-0 text-accent-purple-dark transition group-hover:translate-x-0.5" />
        </Link>

        <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-2xl border border-forge-border bg-forge-surface p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-forge-hint">Total agents</div>
            <div className="mt-2 font-mono text-2xl font-semibold text-accent-purple-dark">{totals.agentCount}</div>
            <p className="mt-1 text-xs text-forge-subtle">Exact count from the static dataset</p>
          </div>
          <div className="rounded-2xl border border-forge-border bg-forge-surface p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-forge-hint">Processes (AI / total)</div>
            <div className="mt-2 font-mono text-2xl font-semibold text-accent-purple-dark">
              {totalAiEligible}
              <span className="text-forge-subtle"> / {totalOperatingProcesses}</span>
            </div>
            <p className="mt-1 text-xs text-forge-subtle">{eligibilityPct}% AI-eligible across 13 towers</p>
          </div>
          <div className="rounded-2xl border border-accent-purple/30 bg-gradient-to-b from-accent-purple/10 to-forge-surface p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-accent-purple-dark/80">
              Clickable AI details
            </div>
            <div className="mt-2 font-mono text-2xl font-semibold text-accent-purple-dark">
              {detailSurface.total}
            </div>
            <p className="mt-1 text-xs text-forge-subtle">
              {detailSurface.initiativeCount} full initiatives + {detailSurface.briefCount} briefs
            </p>
          </div>
          <div className="rounded-2xl border border-forge-border bg-forge-surface p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-forge-hint">Towers</div>
            <div className="mt-2 font-mono text-2xl font-semibold text-accent-purple-dark">{totals.totalTowers}</div>
          </div>
          <div className="rounded-2xl border border-forge-border bg-forge-surface p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-forge-hint">High-tier initiatives (modeled)</div>
            <div className="mt-2 font-mono text-2xl font-semibold text-accent-purple-dark">
              {totals.initiativeTiers.high}
            </div>
            <p className="mt-1 text-xs text-forge-subtle">
              {totals.initiativeTiers.medium} med · {totals.initiativeTiers.low} low
            </p>
          </div>
        </section>

        <section className="mt-10 space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold text-forge-ink">AI eligibility by tower</h2>
              <p className="mt-1 text-sm text-forge-subtle">
                {totalAiEligible} of {totalOperatingProcesses} tower processes ({eligibilityPct}%) are
                AI-eligible — the rest are deliberately human-led where judgment, relationships, or
                creativity are irreplaceable.
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-forge-border bg-forge-surface p-5 shadow-card">
            <AiEligibilityByTower data={eligibility} />
          </div>
        </section>

        <section className="mt-12 space-y-3">
          <h2 className="font-display text-lg font-semibold text-forge-ink">Waterfall: impact score by tower</h2>
          <p className="text-sm text-forge-subtle">Each step adds a 1–3 score from the tower&rsquo;s qualitative impact tier (not hours or dollars).</p>
          <div className="min-w-0 rounded-2xl border border-forge-border bg-forge-surface p-4 shadow-card">
            <WaterfallChart data={wf} />
          </div>
        </section>

        <section className="mt-12 space-y-3">
          <h2 className="font-display text-lg font-semibold text-forge-ink">AI readiness heatmap (all processes)</h2>
          <p className="text-sm text-forge-subtle">Impact bar reflects H/M/L tier per process; right column encodes complexity vs impact tier.</p>
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

        <section className="mt-12 space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold text-forge-ink">
                Why we know this works — feasibility evidence
              </h2>
              <p className="mt-1 max-w-3xl text-sm text-forge-subtle">
                Every P1 initiative and brief is backed by named case studies, commercial vendor
                offerings, or adjacent-industry deployments. {evidenceClusters.length} evidence
                clusters cover {evCoverage.total} initiative and brief surfaces
                ({evCoverage.processHits} full initiatives + {evCoverage.briefHits} briefs).
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-accent-teal/30 bg-gradient-to-b from-accent-teal/5 to-forge-surface p-5 shadow-card">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {evidenceClusters.map((c) => (
                <div
                  key={c.id}
                  className="rounded-xl border border-forge-border bg-forge-surface px-3 py-2.5 text-sm text-forge-body shadow-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-forge-ink">{c.label}</span>
                    <span className="font-mono text-[11px] text-forge-subtle">
                      {c.evidence.length} refs
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-forge-subtle">
                    {c.evidence
                      .map((e) => e.source.split(" /")[0])
                      .slice(0, 3)
                      .join(" · ")}
                  </div>
                </div>
              ))}
            </div>
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
