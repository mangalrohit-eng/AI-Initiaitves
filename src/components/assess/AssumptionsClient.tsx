"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Building2, Calculator, RotateCcw } from "lucide-react";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { PageShell } from "@/components/PageShell";
import { formatMoney } from "@/components/ui/MoneyCounter";
import { useToast } from "@/components/feedback/ToastProvider";
import {
  defaultGlobalAssessAssumptions,
  type AssessProgramV2,
  type GlobalAssessAssumptions,
} from "@/data/assess/types";
import {
  getAssessProgram,
  setGlobalAssessAssumptions,
  subscribe,
} from "@/lib/localStore";

/**
 * Top-level Assumptions surface — the single place where the four blended
 * rates that drive every modeled $ live. There is intentionally nothing else
 * on this page: no scenario presets, no live calculator, no lever weights,
 * no combine mode. The math (in `scenarioModel.ts`) reads these four rates
 * and the per-L4 dials — that's the entire model.
 */
export function AssumptionsClient() {
  const toast = useToast();
  const [program, setProgram] = React.useState<AssessProgramV2>(getAssessProgram);

  React.useEffect(() => {
    setProgram(getAssessProgram());
    return subscribe("assessProgram", () => setProgram(getAssessProgram()));
  }, []);

  const g = program.global;

  const onPatch = React.useCallback((patch: Partial<GlobalAssessAssumptions>) => {
    setGlobalAssessAssumptions(patch);
  }, []);

  const onResetAll = () => {
    setGlobalAssessAssumptions({ ...defaultGlobalAssessAssumptions });
    toast.success({
      title: "Defaults restored",
      description: "All assumptions are back to the seeded illustrative values.",
    });
  };

  const fteWageGap = Math.max(0, g.blendedFteOnshore - g.blendedFteOffshore);
  const ctrWageGap = Math.max(0, g.blendedContractorOnshore - g.blendedContractorOffshore);

  return (
    <PageShell>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <Breadcrumbs items={[{ label: "Program home", href: "/" }, { label: "Assumptions" }]} />

        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-accent-purple/30 bg-accent-purple/5 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-accent-purple-dark">
              <Calculator className="h-3 w-3" />
              Global assumptions
            </div>
            <h1 className="mt-2 font-display text-2xl font-semibold text-forge-ink sm:text-3xl">
              &gt; The numbers behind the modeled $
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-forge-body">
              Four blended rates feed every modeled dollar in the app. Edit them here and
              every total on the Impact Levers hub, the Impact Estimate, and per-tower pages
              recomputes on the next render. Workshop modelling — illustrative, not
              Versant-reported.
            </p>
          </div>
          <button
            type="button"
            onClick={onResetAll}
            className="inline-flex items-center gap-1.5 rounded-lg border border-forge-border bg-forge-surface px-3 py-1.5 text-xs font-medium text-forge-body hover:border-accent-purple/40"
            title="Restore the seeded defaults across all global assumptions"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restore defaults
          </button>
        </div>

        {/* ============== WORKFORCE BLENDED RATES ============== */}
        <section className="mt-6">
          <SectionHeader
            icon={<Building2 className="h-4 w-4" />}
            title="Workforce blended rates"
            subtitle="$ per FTE-year. Used to size the pool for L4s without an annualSpendUsd override and to value offshore arbitrage."
          />
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MoneyInput
              label="FTE onshore"
              value={g.blendedFteOnshore}
              defaultValue={defaultGlobalAssessAssumptions.blendedFteOnshore}
              onChange={(n) => onPatch({ blendedFteOnshore: n })}
              hint="Senior US/UK FTE blended"
            />
            <MoneyInput
              label="FTE offshore"
              value={g.blendedFteOffshore}
              defaultValue={defaultGlobalAssessAssumptions.blendedFteOffshore}
              onChange={(n) => onPatch({ blendedFteOffshore: n })}
              hint="India / Philippines blended"
            />
            <MoneyInput
              label="Contractor onshore"
              value={g.blendedContractorOnshore}
              defaultValue={defaultGlobalAssessAssumptions.blendedContractorOnshore}
              onChange={(n) => onPatch({ blendedContractorOnshore: n })}
              hint="Per-FTE-year equivalent"
            />
            <MoneyInput
              label="Contractor offshore"
              value={g.blendedContractorOffshore}
              defaultValue={defaultGlobalAssessAssumptions.blendedContractorOffshore}
              onChange={(n) => onPatch({ blendedContractorOffshore: n })}
              hint="Per-FTE-year equivalent"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-forge-subtle">
            <span className="inline-flex items-center gap-1 rounded-full border border-forge-border bg-forge-surface/60 px-2 py-0.5 font-mono">
              FTE wage gap{" "}
              <span className="text-forge-body">{formatMoney(fteWageGap, { decimals: 0 })}</span>{" "}
              / year per moved FTE
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-forge-border bg-forge-surface/60 px-2 py-0.5 font-mono">
              Contractor wage gap{" "}
              <span className="text-forge-body">{formatMoney(ctrWageGap, { decimals: 0 })}</span>{" "}
              / year per moved contractor
            </span>
          </div>
        </section>

        {/* ============== HOW IT'S CALCULATED ============== */}
        <section className="mt-8 rounded-2xl border border-accent-purple/30 bg-accent-purple/5 p-5">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-accent-purple-dark">
            &gt; How impact is calculated
          </h2>
          <p className="mt-1 text-xs text-forge-subtle">
            Every $ in the app comes from these four rates × the per-L4 headcount mix and
            dials. No magic lever weights, no caps. Change a rate above and watch the
            Impact Estimate move.
          </p>

          <ol className="mt-4 space-y-3 text-sm text-forge-body">
            <li className="flex gap-3">
              <Step n={1} />
              <div>
                <div className="font-semibold text-forge-ink">Pool $ — what does the work cost today?</div>
                <p className="mt-0.5 text-forge-body">
                  If the L4 has an{" "}
                  <span className="font-mono text-xs text-forge-ink">annualSpendUsd</span>{" "}
                  override, that&apos;s the pool. Otherwise it&apos;s the sum of headcount ×
                  rate:
                </p>
                <pre className="mt-1 overflow-x-auto rounded-md border border-forge-border bg-forge-page/60 p-2 font-mono text-[11px] text-forge-body">
{`pool = fteOn  × ${formatMoney(g.blendedFteOnshore, { decimals: 0 })}
     + fteOff × ${formatMoney(g.blendedFteOffshore, { decimals: 0 })}
     + ctrOn  × ${formatMoney(g.blendedContractorOnshore, { decimals: 0 })}
     + ctrOff × ${formatMoney(g.blendedContractorOffshore, { decimals: 0 })}`}
                </pre>
              </div>
            </li>
            <li className="flex gap-3">
              <Step n={2} />
              <div>
                <div className="font-semibold text-forge-ink">
                  Offshore savings — wage arbitrage on movable headcount only
                </div>
                <p className="mt-0.5 text-forge-body">
                  The dial sets the <em>target</em> offshore share for the L4. Existing
                  offshore staff don&apos;t double-count. Only the headcount that has to{" "}
                  <em>move</em> generates savings — at the wage gap, not at the pool.
                </p>
                <pre className="mt-1 overflow-x-auto rounded-md border border-forge-border bg-forge-page/60 p-2 font-mono text-[11px] text-forge-body">
{`movableFte  = max(0, (fteOn + fteOff) × dial − fteOff)
fteSavings  = movableFte × ${formatMoney(fteWageGap, { decimals: 0 })}   // FTE wage gap
movableCtr  = max(0, (ctrOn + ctrOff) × dial − ctrOff)
ctrSavings  = movableCtr × ${formatMoney(ctrWageGap, { decimals: 0 })}   // contractor wage gap

offshore    = fteSavings + ctrSavings`}
                </pre>
                <p className="mt-1 text-[11px] text-forge-subtle">
                  When a row only has annualSpendUsd (no headcount counts), offshore ={" "}
                  <span className="font-mono">spend × dial × (1 − offshore/onshore FTE rate)</span>{" "}
                  — same wage-gap factor, no hardcoded numbers.
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <Step n={3} />
              <div>
                <div className="font-semibold text-forge-ink">AI savings — the dial is the savings %</div>
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
                  Combined — sequential, AI removes work first
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
              Worked example (at current assumptions)
            </div>
            <p className="mt-1 leading-relaxed text-forge-body">
              An L4 with 10 onshore FTE, 5 offshore FTE, 0 contractors, no
              annualSpendUsd override. Tower lead dials offshore 80%, AI 30%.
            </p>
            <ul className="mt-2 space-y-1 font-mono text-forge-body">
              <li>
                Pool = 10 ×{" "}
                <span className="text-forge-ink">{formatMoney(g.blendedFteOnshore, { decimals: 0 })}</span> + 5 ×{" "}
                <span className="text-forge-ink">{formatMoney(g.blendedFteOffshore, { decimals: 0 })}</span> ={" "}
                <span className="text-forge-ink">
                  {formatMoney(10 * g.blendedFteOnshore + 5 * g.blendedFteOffshore, { decimals: 1 })}
                </span>
              </li>
              <li>
                AI = pool × 0.30 ={" "}
                <span className="text-forge-ink">
                  {formatMoney((10 * g.blendedFteOnshore + 5 * g.blendedFteOffshore) * 0.3, {
                    decimals: 1,
                  })}
                </span>
              </li>
              <li>
                Movable FTE = (15 × 0.80) − 5 = 7; offshore = 7 ×{" "}
                <span className="text-forge-ink">{formatMoney(fteWageGap, { decimals: 0 })}</span> ={" "}
                <span className="text-forge-ink">{formatMoney(7 * fteWageGap, { decimals: 1 })}</span>
              </li>
              <li>
                Combined ={" "}
                <span className="text-accent-green">
                  {formatMoney(
                    (10 * g.blendedFteOnshore + 5 * g.blendedFteOffshore) * 0.3 +
                      7 * fteWageGap * (1 - 0.3),
                    { decimals: 1 },
                  )}
                </span>
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
          All values are workshop modelling, not Versant-reported. Roll-ups are illustrative
          for planning only.
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

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-forge-well/70 text-accent-purple-dark"
        aria-hidden
      >
        {icon}
      </div>
      <div className="min-w-0">
        <h2 className="font-display text-base font-semibold text-forge-ink">
          &gt; {title}
        </h2>
        <p className="text-xs text-forge-subtle">{subtitle}</p>
      </div>
    </div>
  );
}

function MoneyInput({
  label,
  value,
  defaultValue,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  defaultValue: number;
  onChange: (n: number) => void;
  hint?: string;
}) {
  const isDefault = Math.round(value) === Math.round(defaultValue);
  return (
    <label className="flex flex-col gap-1 rounded-xl border border-forge-border bg-forge-surface p-3">
      <span className="text-[11px] font-medium uppercase tracking-wider text-forge-hint">
        {label}
      </span>
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-sm text-forge-subtle">$</span>
        <input
          className="w-full bg-transparent font-mono text-base font-semibold text-forge-ink outline-none focus:ring-0"
          type="number"
          min={0}
          step={1000}
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n) && n >= 0) onChange(n);
          }}
        />
      </div>
      <div className="flex items-center justify-between text-[10px] text-forge-hint">
        <span>{hint}</span>
        {!isDefault ? (
          <button
            type="button"
            onClick={() => onChange(defaultValue)}
            className="inline-flex items-center gap-1 text-forge-subtle hover:text-accent-purple-dark"
            title="Reset to default"
          >
            <RotateCcw className="h-2.5 w-2.5" />
            {formatMoney(defaultValue, { decimals: 0 })}
          </button>
        ) : (
          <span className="text-forge-hint">default</span>
        )}
      </div>
    </label>
  );
}
