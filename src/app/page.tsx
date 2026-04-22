import { TowerGrid } from "@/components/towers/TowerGrid";
import { PageShell } from "@/components/PageShell";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { towers } from "@/data/towers";
import { aggregateTotals } from "@/lib/utils";

export default function HomePage() {
  const totals = aggregateTotals();
  const agentLabel = totals.agentCount >= 200 ? "200+" : `${totals.agentCount}`;

  return (
    <PageShell>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-white/60">
            Forge Program: Agentic AI Transformation
          </div>
          <h1 className="mt-5 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Tower Explorer
          </h1>
          <p className="mt-4 text-base leading-relaxed text-white/70">
            Versant Media Group — <span className="text-white/85">13 functional towers</span> with drill-down processes, four-lens
            transformation views, and agent orchestration maps for executive working sessions.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-xs uppercase tracking-wide text-white/45">Towers</div>
            <div className="mt-2 font-mono text-2xl font-semibold text-transparent bg-gradient-to-r from-accent-purple-light to-white bg-clip-text">
              <AnimatedNumber value={totals.totalTowers} />
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-xs uppercase tracking-wide text-white/45">AI processes</div>
            <div className="mt-2 font-mono text-2xl font-semibold text-transparent bg-gradient-to-r from-accent-purple-light to-white bg-clip-text">
              <AnimatedNumber value={totals.aiProcesses} />
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-xs uppercase tracking-wide text-white/45">Annual hours saved</div>
            <div className="mt-2 font-mono text-2xl font-semibold text-transparent bg-gradient-to-r from-accent-purple-light to-white bg-clip-text">
              <AnimatedNumber value={totals.hours} variant="hours" />
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-xs uppercase tracking-wide text-white/45">Agents</div>
            <div className="mt-2 font-mono text-2xl font-semibold text-transparent bg-gradient-to-r from-accent-purple-light to-white bg-clip-text">
              {agentLabel}
            </div>
          </div>
        </div>

        <div className="mt-12">
          <div className="mb-5 flex items-end justify-between gap-3">
            <h2 className="font-display text-lg font-semibold text-white">Tower overview</h2>
            <div className="text-xs text-white/45">Click a card to drill in</div>
          </div>
          <TowerGrid towers={towers} />
        </div>
      </div>
    </PageShell>
  );
}
