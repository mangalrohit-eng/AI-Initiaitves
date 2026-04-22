import { TowerGrid } from "@/components/towers/TowerGrid";
import { PageShell } from "@/components/PageShell";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { towers } from "@/data/towers";
import { aggregateTotals, towerAiEligibility } from "@/lib/utils";

export default function HomePage() {
  const totals = aggregateTotals();
  const eligibility = towerAiEligibility();
  const totalProcesses = eligibility.reduce((n, r) => n + r.total, 0);
  const totalAiEligible = eligibility.reduce((n, r) => n + r.aiEligible, 0);

  return (
    <PageShell>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-forge-border bg-forge-surface px-3 py-1 text-xs text-forge-subtle">
            Forge Program: Agentic AI Transformation
          </div>
          <h1 className="mt-5 font-display text-4xl font-semibold tracking-tight text-forge-ink sm:text-5xl">Tower Explorer</h1>
          <p className="mt-4 text-base leading-relaxed text-forge-body">
            Versant Media Group — <span className="font-medium text-forge-ink">13 functional towers</span>,{" "}
            <span className="font-medium text-forge-ink">{totalProcesses} mapped processes</span>, and{" "}
            <span className="font-medium text-accent-purple-dark">{totalAiEligible} AI initiatives</span>.
            Each tower&apos;s full operating model — work categories, every process (AI and human-led),
            priority overlay, and four-lens agent design — in one executive-ready explorer.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-2xl border border-forge-border bg-forge-surface p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-forge-hint">Towers</div>
            <div className="mt-2 font-mono text-2xl font-semibold text-accent-purple-dark">
              <AnimatedNumber value={totals.totalTowers} />
            </div>
          </div>
          <div className="rounded-2xl border border-forge-border bg-forge-surface p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-forge-hint">AI / total processes</div>
            <div className="mt-2 font-mono text-2xl font-semibold text-accent-purple-dark">
              <AnimatedNumber value={totalAiEligible} />
              <span className="text-forge-subtle"> / {totalProcesses}</span>
            </div>
          </div>
          <div className="rounded-2xl border border-forge-border bg-forge-surface p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-forge-hint">Annual hours saved</div>
            <div className="mt-2 font-mono text-2xl font-semibold text-accent-purple-dark">
              <AnimatedNumber value={totals.hours} variant="hours" />
            </div>
          </div>
          <div className="rounded-2xl border border-forge-border bg-forge-surface p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-forge-hint">Agents</div>
            <div className="mt-2 font-mono text-2xl font-semibold text-accent-purple-dark">
              <AnimatedNumber value={totals.agentCount} />
            </div>
          </div>
        </div>

        <div className="mt-12">
          <div className="mb-5 flex items-end justify-between gap-3">
            <h2 className="font-display text-lg font-semibold text-forge-ink">Tower overview</h2>
            <div className="text-xs text-forge-hint">Click a card to drill in</div>
          </div>
          <TowerGrid towers={towers} />
        </div>
      </div>
    </PageShell>
  );
}
