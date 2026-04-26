import { TowerGridFilterable } from "@/components/towers/TowerGridFilterable";
import { PageShell } from "@/components/PageShell";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { towers } from "@/data/towers";
import { aggregateTotals, towerAiEligibility } from "@/lib/utils";
import Link from "next/link";

export default function TowersPage() {
  const totals = aggregateTotals();
  const eligibility = towerAiEligibility();
  const totalProcesses = eligibility.reduce((n, r) => n + r.total, 0);
  const totalAiEligible = eligibility.reduce((n, r) => n + r.aiEligible, 0);

  return (
    <PageShell>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 text-xs text-forge-subtle">
            <Link href="/" className="text-forge-body underline hover:text-accent-purple-dark">
              Program home
            </Link>
            <span className="text-forge-hint" aria-hidden>
              /
            </span>
            <span>Towers</span>
          </div>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-forge-border bg-forge-surface px-3 py-1 text-xs text-forge-subtle">
            Forge Program: Agentic AI Transformation
          </div>
          <h1 className="mt-5 font-display text-4xl font-semibold tracking-tight text-forge-ink sm:text-5xl">
            Tower AI Initiatives — how AI shifts work in your tower
          </h1>
          <p className="mt-4 text-base leading-relaxed text-forge-body">
            An interactive view of the{" "}
            <span className="font-medium text-forge-ink">13 Versant towers</span>. For every tower
            you will find the sequenced AI roadmap (now / next / later), the initiatives with the
            biggest impact, and for each initiative: what changes for the team, the tools involved,
            and the platform it depends on.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-forge-subtle">
            New here? Open the 60-second walkthrough below, or jump straight to your tower.
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
            <div className="text-xs uppercase tracking-wide text-forge-hint">AI-eligible / total processes</div>
            <div className="mt-2 font-mono text-2xl font-semibold text-accent-purple-dark">
              <AnimatedNumber value={totalAiEligible} />
              <span className="text-forge-subtle"> / {totalProcesses}</span>
            </div>
          </div>
          <div className="rounded-2xl border border-forge-border bg-forge-surface p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-forge-hint">High-impact initiatives (modeled)</div>
            <div className="mt-2 font-mono text-2xl font-semibold text-accent-purple-dark">
              <AnimatedNumber value={totals.initiativeTiers.high} />
            </div>
            <p className="mt-1 text-[11px] text-forge-subtle">
              {totals.initiativeTiers.medium} medium · {totals.initiativeTiers.low} low (qualitative
              tiers; not financial or FTE precision)
            </p>
          </div>
          <div className="rounded-2xl border border-forge-border bg-forge-surface p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-forge-hint">Agents modeled</div>
            <div className="mt-2 font-mono text-2xl font-semibold text-accent-purple-dark">
              <AnimatedNumber value={totals.agentCount} />
            </div>
          </div>
        </div>

        <div className="mt-12">
          <TowerGridFilterable towers={towers} />
        </div>
      </div>
    </PageShell>
  );
}
