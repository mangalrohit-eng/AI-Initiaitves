"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Calculator } from "lucide-react";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { PageShell } from "@/components/PageShell";
import { useRedactDollars } from "@/lib/clientMode";

/**
 * Methodology explainer for the Configure Impact Levers savings model.
 *
 * Used to host the four global blended-rate inputs; the rates are now
 * per-tower (each tower owns `TowerAssessState.rates`, edited inline on
 * its Configure Impact Levers page via `TowerRatesCard`). This page is
 * read-only — the source of truth for the formulas tower leads use.
 *
 * Redaction: in protected/client mode the page renders the same neutral
 * "section unavailable" placeholder it always has, matching the
 * `TowerRatesCard` redaction behavior so a lead handing the laptop to a
 * client never exposes the modeled-savings math.
 */
export function AssumptionsClient() {
  const redact = useRedactDollars();

  if (redact) {
    return (
      <PageShell>
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <Breadcrumbs items={[{ label: "Program home", href: "/" }, { label: "Methodology" }]} />
          <div className="mt-8 rounded-2xl border border-forge-border bg-forge-surface p-8 text-center">
            <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-forge-well text-forge-subtle">
              <Calculator className="h-5 w-5" aria-hidden />
            </div>
            <h1 className="mt-4 font-display text-xl font-semibold text-forge-ink">
              &gt; Methodology
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-forge-subtle">
              This section is currently unavailable.
            </p>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <Breadcrumbs items={[{ label: "Program home", href: "/" }, { label: "Methodology" }]} />

        <div className="mt-3">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-accent-purple/30 bg-accent-purple/5 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-accent-purple-dark">
            <BookOpen className="h-3 w-3" />
            Methodology
          </div>
          <h1 className="mt-2 font-display text-2xl font-semibold text-forge-ink sm:text-3xl">
            &gt; How impact is calculated
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-forge-body">
            Every modeled $ in the app comes from four cost rates owned by
            each tower &middot; the L4 Activity Group headcount mix &middot; and the
            tower lead&apos;s offshore + AI dials. No magic lever weights, no caps,
            no scenario stress-tests baked into the math.
          </p>
        </div>

        <div className="mt-3 rounded-lg border border-accent-purple/20 bg-accent-purple/5 px-3 py-2 text-xs text-forge-body">
          Cost rates are now per-tower. Tower leads edit their own tower&apos;s
          onshore + offshore rates on the{" "}
          <Link
            href="/tower/finance"
            className="text-accent-purple-dark underline underline-offset-2 hover:text-accent-purple"
          >
            Configure Impact Levers
          </Link>{" "}
          page (see the &quot;Cost rates&quot; card above the L4 sliders).
        </div>

        {/* ============== HOW IT'S CALCULATED ============== */}
        <section className="mt-6 rounded-2xl border border-accent-purple/30 bg-accent-purple/5 p-5">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-accent-purple-dark">
            &gt; The five-step model
          </h2>
          <p className="mt-1 text-xs text-forge-subtle">
            Read this as the contract between every tower&apos;s rate edits and
            the modeled $ surfaced on the Impact Estimate, the Offshore Plan,
            and the cross-tower KPI strip. If a number on screen surprises
            you, walk it through these five steps.
          </p>

          <ol className="mt-4 space-y-3 text-sm text-forge-body">
            <li className="flex gap-3">
              <Step n={1} />
              <div>
                <div className="font-semibold text-forge-ink">
                  Pool $ &mdash; what does the work cost today?
                </div>
                <p className="mt-0.5 text-forge-body">
                  If the L4 Activity Group has an{" "}
                  <span className="font-mono text-xs text-forge-ink">annualSpendUsd</span>{" "}
                  override, that&apos;s the pool. Otherwise it&apos;s the sum of headcount &times;
                  the tower&apos;s own rates:
                </p>
                <pre className="mt-1 overflow-x-auto rounded-md border border-forge-border bg-forge-page/60 p-2 font-mono text-[11px] text-forge-body">
{`pool = fteOn  × tower.rates.blendedFteOnshore
     + fteOff × tower.rates.blendedFteOffshore
     + ctrOn  × tower.rates.blendedContractorOnshore
     + ctrOff × tower.rates.blendedContractorOffshore`}
                </pre>
              </div>
            </li>
            <li className="flex gap-3">
              <Step n={2} />
              <div>
                <div className="font-semibold text-forge-ink">
                  Offshore savings &mdash; wage arbitrage on movable headcount only
                </div>
                <p className="mt-0.5 text-forge-body">
                  The L4 dial sets the <em>target</em> offshore share for the
                  Activity Group. Existing offshore staff don&apos;t double-count.
                  Only the headcount that has to <em>move</em> generates savings &mdash;
                  at the tower&apos;s wage gap, not at the pool.
                </p>
                <pre className="mt-1 overflow-x-auto rounded-md border border-forge-border bg-forge-page/60 p-2 font-mono text-[11px] text-forge-body">
{`movableFte  = max(0, (fteOn + fteOff) × dial − fteOff)
fteSavings  = movableFte × (fteOnshore − fteOffshore)
movableCtr  = max(0, (ctrOn + ctrOff) × dial − ctrOff)
ctrSavings  = movableCtr × (ctrOnshore − ctrOffshore)

offshore    = fteSavings + ctrSavings`}
                </pre>
                <p className="mt-1 text-[11px] text-forge-subtle">
                  When a row has only <span className="font-mono">annualSpendUsd</span>{" "}
                  (no headcount), offshore =
                  <span className="font-mono"> spend × dial × (1 − offshore/onshore FTE rate)</span> &mdash;
                  same wage-gap factor, no hardcoded numbers.
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <Step n={3} />
              <div>
                <div className="font-semibold text-forge-ink">AI savings &mdash; the dial is the savings %</div>
                <p className="mt-0.5 text-forge-body">
                  AI eliminates a share of the L4&apos;s annual cost. No multiplier, no cap.
                </p>
                <pre className="mt-1 overflow-x-auto rounded-md border border-forge-border bg-forge-page/60 p-2 font-mono text-[11px] text-forge-body">
{`ai = pool × aiDial`}
                </pre>
              </div>
            </li>
            <li className="flex gap-3">
              <Step n={4} />
              <div>
                <div className="font-semibold text-forge-ink">
                  Combined &mdash; sequential, AI removes work first
                </div>
                <p className="mt-0.5 text-forge-body">
                  AI takes the work out, then offshore arbitrage applies to what&apos;s left.
                  This prevents the two levers from over-counting the same hour.
                </p>
                <pre className="mt-1 overflow-x-auto rounded-md border border-forge-border bg-forge-page/60 p-2 font-mono text-[11px] text-forge-body">
{`combined = ai + offshore × (1 − aiDial)`}
                </pre>
              </div>
            </li>
            <li className="flex gap-3">
              <Step n={5} />
              <div>
                <div className="font-semibold text-forge-ink">Roll-up</div>
                <p className="mt-0.5 text-forge-body">
                  Tower combined = sum of L4 combined. Program combined = sum of tower
                  combined. There is no synthetic cap and no second savings model in the
                  codebase.
                </p>
              </div>
            </li>
          </ol>

          <div className="mt-5 rounded-xl border border-forge-border bg-forge-surface/70 p-4 text-xs">
            <div className="font-semibold uppercase tracking-wider text-forge-hint">
              How the seed defaults work
            </div>
            <ul className="mt-2 space-y-1 text-forge-body">
              <li>
                <strong>Onshore FTE rate</strong> &mdash; per-tower average fully loaded
                cost from the workshop pivot (e.g. Tech &amp; Engineering $208,200,
                Service $76,200), rounded to the nearest $100.
              </li>
              <li>
                <strong>Offshore FTE rate</strong> &mdash; round(onshore / 3 / 100) &times; 100.
              </li>
              <li>
                <strong>Contractor onshore / offshore</strong> &mdash; 80% of the
                respective FTE rate (industry-blended starting point; tower leads
                with hard data should override).
              </li>
            </ul>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
            <Link
              href="/impact-levers/summary"
              className="inline-flex items-center gap-1 text-accent-purple-dark underline-offset-2 hover:underline"
            >
              See it on the Impact Estimate <ArrowRight className="h-3 w-3" />
            </Link>
            <Link
              href="/impact-levers"
              className="inline-flex items-center gap-1 text-forge-body underline-offset-2 hover:underline"
            >
              Configure Impact Levers <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </section>

        <p className="mt-6 text-center text-xs text-forge-hint">
          All values are illustrative estimates, not Versant-reported.
        </p>
      </div>
    </PageShell>
  );
}

function Step({ n }: { n: number }) {
  return (
    <span
      className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-accent-purple/40 bg-accent-purple/10 font-mono text-[11px] font-semibold text-accent-purple-dark"
      aria-hidden
    >
      {n}
    </span>
  );
}
