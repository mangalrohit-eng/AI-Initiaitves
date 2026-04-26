"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Calculator,
  Cpu,
  Globe2,
  RotateCcw,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { PageShell } from "@/components/PageShell";
import { MoneyCounter, formatMoney } from "@/components/ui/MoneyCounter";
import { PercentSlider } from "@/components/ui/PercentSlider";
import { useToast } from "@/components/feedback/ToastProvider";
import {
  defaultGlobalAssessAssumptions,
  type AssessProgramV2,
  type GlobalAssessAssumptions,
} from "@/data/assess/types";
import { modeledSavingsForTower } from "@/lib/assess/scenarioModel";
import {
  getAssessProgram,
  setGlobalAssessAssumptions,
  subscribe,
} from "@/lib/localStore";

/**
 * Top-level Assumptions surface — the single place where all globals that
 * drive modeled $ live. Workshop facilitators sanity-check Versant-specific
 * blended rates here; clients see them too for transparency.
 *
 * Layout:
 *   - Live calculator preview (anchors the math at $100M pool, current dials).
 *   - Workforce blended rates ($/FTE-year).
 *   - Lever weights (offshore + AI).
 *   - Combine mode + cap.
 *   - "How impact is calculated" inline explainer.
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
              Workshop-level inputs that drive every modeled dollar on the Impact Levers hub
              and Impact Estimate. Editable, illustrative — the system of record stays with
              Versant&apos;s reported financials.
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

        {/* ============== LIVE CALCULATOR ============== */}
        <CalculatorPreview g={g} />

        {/* ============== WORKFORCE BLENDED RATES ============== */}
        <section className="mt-6">
          <SectionHeader
            icon={<Building2 className="h-4 w-4" />}
            title="Workforce blended rates"
            subtitle={`$ per FTE-year. Used when an L4 row's annualSpendUsd is empty.`}
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
        </section>

        {/* ============== LEVER WEIGHTS ============== */}
        <section className="mt-6">
          <SectionHeader
            icon={<Sparkles className="h-4 w-4" />}
            title="Lever weights"
            subtitle="Maximum pool deflection at 100% dial. Industry-anchored band math, not Versant-reported."
          />
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <LeverWeight
              hue="purple"
              icon={<Globe2 className="h-3.5 w-3.5" />}
              label="Offshore lever weight"
              value={g.offshoreLeverWeight}
              defaultValue={defaultGlobalAssessAssumptions.offshoreLeverWeight}
              onChange={(n) => onPatch({ offshoreLeverWeight: n })}
              microcopy="Going from 0 to 100% offshore deflects this fraction of the L4 pool."
            />
            <LeverWeight
              hue="teal"
              icon={<Cpu className="h-3.5 w-3.5" />}
              label="AI lever weight"
              value={g.aiLeverWeight}
              defaultValue={defaultGlobalAssessAssumptions.aiLeverWeight}
              onChange={(n) => onPatch({ aiLeverWeight: n })}
              microcopy="Going from 0 to 100% AI impact deflects this fraction of the L4 pool."
            />
          </div>
        </section>

        {/* ============== COMBINE MODE + CAP ============== */}
        <section className="mt-6">
          <SectionHeader
            icon={<TrendingUp className="h-4 w-4" />}
            title="Combine mode and cap"
            subtitle="How offshore + AI savings stack. Capped mode keeps band math defensible."
          />
          <div className="mt-3 rounded-2xl border border-forge-border bg-forge-surface p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-[11px] font-medium uppercase tracking-wider text-forge-hint">
                  Combine mode
                </label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <ModeButton
                    selected={g.combineMode === "additive"}
                    onClick={() => onPatch({ combineMode: "additive" })}
                    title="Additive"
                    description="Off + AI sum directly. Most aggressive."
                  />
                  <ModeButton
                    selected={g.combineMode === "capped"}
                    onClick={() => onPatch({ combineMode: "capped" })}
                    title="Capped"
                    description="Sum is clipped at the cap. Defensible default."
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-medium uppercase tracking-wider text-forge-hint">
                  Combined cap (% of pool)
                </label>
                <div
                  className={
                    "mt-2 transition " +
                    (g.combineMode === "capped" ? "" : "pointer-events-none opacity-50")
                  }
                >
                  <div className="flex items-center justify-between text-xs text-forge-subtle">
                    <span>Cap</span>
                    <span className="font-mono text-forge-body">{g.combinedCapPct.toFixed(0)}%</span>
                  </div>
                  <PercentSlider
                    ariaLabel="Combined cap percent"
                    value={g.combinedCapPct}
                    onChange={(n) => onPatch({ combinedCapPct: n })}
                    hue="purple"
                    defaultMark={defaultGlobalAssessAssumptions.combinedCapPct}
                    min={0}
                    max={75}
                    showValue={false}
                  />
                  <p className="mt-1 text-[11px] text-forge-hint">
                    Default {defaultGlobalAssessAssumptions.combinedCapPct}%. Combined modeled
                    savings can&apos;t exceed this share of the pool, per tower.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============== HOW IT'S CALCULATED ============== */}
        <section className="mt-6 rounded-2xl border border-accent-purple/30 bg-accent-purple/5 p-5">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-accent-purple-dark">
            &gt; How impact is calculated
          </h2>
          <ol className="mt-3 space-y-2 text-sm text-forge-body">
            <li className="flex gap-2">
              <span className="font-mono text-xs text-forge-hint">1.</span>
              <span>
                <span className="font-semibold text-forge-ink">Row pool $</span> =
                <span className="ml-1 font-mono text-xs">
                  annualSpendUsd
                </span>{" "}
                if set, else{" "}
                <span className="font-mono text-xs">
                  fteOn × {formatMoney(g.blendedFteOnshore, { decimals: 0 })} + fteOff ×{" "}
                  {formatMoney(g.blendedFteOffshore, { decimals: 0 })} + contractors at the
                  matching rates
                </span>
                .
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-mono text-xs text-forge-hint">2.</span>
              <span>
                <span className="font-semibold text-forge-ink">Tower pool</span> = sum of L4 row
                pools.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-mono text-xs text-forge-hint">3.</span>
              <span>
                <span className="font-semibold text-forge-ink">Cost-weighted dials</span>: each
                tower&apos;s offshore % and AI % are pool-weighted across its L4 rows. Rows
                without dials fall back to the tower baseline.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-mono text-xs text-forge-hint">4.</span>
              <span>
                <span className="font-semibold text-forge-ink">Modeled $ per tower</span> ={" "}
                <span className="font-mono text-xs">
                  off% × {g.offshoreLeverWeight.toFixed(2)} × pool + ai% ×{" "}
                  {g.aiLeverWeight.toFixed(2)} × pool
                </span>
                {g.combineMode === "capped" ? (
                  <>
                    , clipped at <span className="font-mono">{g.combinedCapPct.toFixed(0)}%</span>{" "}
                    of pool.
                  </>
                ) : (
                  <> (additive — no cap).</>
                )}
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-mono text-xs text-forge-hint">5.</span>
              <span>
                <span className="font-semibold text-forge-ink">Program $</span> = sum across
                contributing towers. Each tower&apos;s cap is applied independently — a tower at
                cap can&apos;t borrow headroom from another.
              </span>
            </li>
          </ol>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
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

/* ============== LIVE CALCULATOR ============== */

function CalculatorPreview({ g }: { g: GlobalAssessAssumptions }) {
  const [pool, setPool] = React.useState(100_000_000);
  const [off, setOff] = React.useState(50);
  const [ai, setAi] = React.useState(50);
  const out = modeledSavingsForTower(pool, off, ai, g);
  const capBinding =
    g.combineMode === "capped" && out.offshore + out.ai > out.combined + 0.5;

  return (
    <section className="mt-5 rounded-2xl border border-accent-purple/30 bg-gradient-to-br from-accent-purple/10 via-forge-surface to-forge-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-accent-purple-dark">
          &gt; Live preview
        </h2>
        <span className="text-[11px] text-forge-hint">
          What happens to a sample pool at the current assumptions
        </span>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 grid gap-3 sm:grid-cols-3">
          <PoolControl
            label="Test pool $"
            value={pool}
            onChange={setPool}
            options={[25_000_000, 100_000_000, 500_000_000, 1_000_000_000]}
          />
          <DialControl
            label="Offshore %"
            hue="purple"
            value={off}
            onChange={setOff}
          />
          <DialControl label="AI %" hue="teal" value={ai} onChange={setAi} />
        </div>
        <div className="rounded-xl border border-forge-border bg-forge-page/50 p-4">
          <div className="text-[10px] font-medium uppercase tracking-wider text-forge-hint">
            Modeled $
          </div>
          <div className="mt-1 font-display text-3xl font-semibold tracking-tight text-forge-ink sm:text-4xl">
            <MoneyCounter value={out.combined} decimals={1} />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
            <Split label="Off" value={out.offshore} hue="purple" />
            <Split label="AI" value={out.ai} hue="teal" />
          </div>
          {capBinding ? (
            <div className="mt-2 inline-flex items-center gap-1 rounded-md border border-accent-amber/40 bg-accent-amber/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-accent-amber">
              Cap binding · {g.combinedCapPct.toFixed(0)}%
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function PoolControl({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  options: number[];
}) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wider text-forge-hint">{label}</div>
      <div className="mt-2 flex flex-wrap gap-1">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            className={
              "rounded-md border px-2 py-1 font-mono text-[11px] transition " +
              (value === o
                ? "border-accent-purple bg-accent-purple/15 text-accent-purple-dark"
                : "border-forge-border bg-forge-surface text-forge-body hover:border-accent-purple/40")
            }
          >
            {formatMoney(o, { decimals: 0 })}
          </button>
        ))}
      </div>
    </div>
  );
}

function DialControl({
  label,
  value,
  onChange,
  hue,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  hue: "purple" | "teal";
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] font-medium uppercase tracking-wider text-forge-hint">
        <span>{label}</span>
        <span className="font-mono text-forge-body">{value.toFixed(0)}%</span>
      </div>
      <div className="mt-2">
        <PercentSlider
          ariaLabel={label}
          value={value}
          onChange={onChange}
          hue={hue}
          showValue={false}
        />
      </div>
    </div>
  );
}

function Split({ label, value, hue }: { label: string; value: number; hue: "purple" | "teal" }) {
  return (
    <span
      className={
        "inline-flex items-center justify-between gap-1 rounded-md border px-1.5 py-1 font-mono " +
        (hue === "purple"
          ? "border-accent-purple/30 bg-accent-purple/10 text-accent-purple-dark"
          : "border-accent-teal/30 bg-accent-teal/10 text-accent-teal")
      }
    >
      <span className="text-forge-hint">{label}</span>
      <span className="font-semibold text-forge-ink">
        {formatMoney(value, { decimals: 1 })}
      </span>
    </span>
  );
}

/* ============== SECTION HEADER ============== */

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

/* ============== INPUT PRIMITIVES ============== */

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

function LeverWeight({
  label,
  value,
  defaultValue,
  onChange,
  microcopy,
  hue,
  icon,
}: {
  label: string;
  value: number;
  defaultValue: number;
  onChange: (n: number) => void;
  microcopy: string;
  hue: "purple" | "teal";
  icon: React.ReactNode;
}) {
  const isDefault = Math.abs(value - defaultValue) < 1e-6;
  const pct = Math.round(value * 100);
  return (
    <div className="rounded-xl border border-forge-border bg-forge-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <span
          className={
            "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider " +
            (hue === "purple"
              ? "bg-accent-purple/15 text-accent-purple-dark"
              : "bg-accent-teal/15 text-accent-teal")
          }
        >
          {icon}
          {label}
        </span>
        <span className="font-mono text-base font-semibold tabular-nums text-forge-ink">
          {pct}%
        </span>
      </div>
      <div className="mt-2">
        <PercentSlider
          ariaLabel={label}
          value={pct}
          onChange={(n) => onChange(n / 100)}
          hue={hue}
          defaultMark={defaultValue * 100}
          min={0}
          max={100}
          showValue={false}
        />
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-forge-subtle">{microcopy}</p>
      <div className="mt-1 flex items-center justify-between text-[10px] text-forge-hint">
        <span>
          Default <span className="font-mono">{Math.round(defaultValue * 100)}%</span>
        </span>
        {!isDefault ? (
          <button
            type="button"
            onClick={() => onChange(defaultValue)}
            className="inline-flex items-center gap-1 text-forge-subtle hover:text-accent-purple-dark"
          >
            <RotateCcw className="h-2.5 w-2.5" />
            Reset
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ModeButton({
  selected,
  onClick,
  title,
  description,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={
        "rounded-lg border p-3 text-left transition " +
        (selected
          ? "border-accent-purple bg-accent-purple/10 text-forge-ink shadow-[0_0_0_1px_rgba(161,0,255,0.25)]"
          : "border-forge-border bg-forge-surface text-forge-body hover:border-accent-purple/40")
      }
    >
      <div className="text-sm font-semibold">{title}</div>
      <p className="mt-0.5 text-[11px] leading-relaxed text-forge-subtle">{description}</p>
    </button>
  );
}
