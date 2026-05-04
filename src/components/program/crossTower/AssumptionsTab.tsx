"use client";

import * as React from "react";
import {
  Settings2,
  Sparkles,
  RotateCcw,
  Calendar,
  Wrench,
  Layers,
  ShieldCheck,
} from "lucide-react";
import {
  DEFAULT_ASSUMPTIONS,
  type CrossTowerAssumptions,
} from "@/lib/cross-tower/assumptions";
import { formatUsdCompact } from "@/lib/format";

/**
 * Assumptions tab — single source of truth for every plan knob.
 *
 * Edits update local state and `localStorage` immediately, but they DO NOT
 * mutate the rendered KPIs / Gantt / value curve until the user clicks
 * Regenerate. The staleness banner (managed by the page shell) flips on
 * the first edit and clears after the next successful regenerate.
 *
 * Knobs are grouped into six panels:
 *
 *   1) Plan threshold      — minimum L4 Activity Group prize (LLM-affecting)
 *   2) Program window      — start month + ramp                (timing)
 *   3) High-Effort timing  — build / value start               (timing)
 *   4) Low-Effort timing   — build / value start               (timing)
 *   5) Brief depth         — Concise / Full                    (LLM-affecting)
 *   6) Versant lens emphases — TSA, BB-, Editorial, Broadcast  (LLM-affecting)
 *
 * Plus a compact "Reset to defaults" action.
 */

const PRESETS_USD = [
  { value: 0, label: "Off" },
  { value: 1_000_000, label: "$1M" },
  { value: 2_000_000, label: "$2M" },
  { value: 5_000_000, label: "$5M" },
  { value: 10_000_000, label: "$10M" },
  { value: 25_000_000, label: "$25M" },
] as const;

const DEBOUNCE_MS = 350;

export function AssumptionsTab({
  assumptions,
  excludedCount,
  excludedAiUsd,
  onChange,
  onReset,
  isStale,
}: {
  assumptions: CrossTowerAssumptions;
  excludedCount: number;
  excludedAiUsd: number;
  onChange: (patch: Partial<CrossTowerAssumptions>) => void;
  onReset: () => void;
  isStale: boolean;
}) {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-forge-ink">
            <span className="font-mono text-accent-purple-dark">&gt;</span>{" "}
            Plan assumptions
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-forge-subtle">
            Every editable parameter lives here. Edits flag the plan stale —
            click <span className="font-medium text-forge-body">Regenerate</span>{" "}
            in the header to apply them. Knobs marked{" "}
            <AffectsLlmBadge inline /> change LLM prompt input and require a
            generation call; timing knobs recompose deterministically.
          </p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1.5 rounded-lg border border-forge-border bg-forge-surface px-3 py-1.5 text-xs font-medium text-forge-body shadow-sm transition hover:border-accent-purple/40 hover:text-forge-ink"
        >
          <RotateCcw className="h-3 w-3" aria-hidden /> Reset to defaults
        </button>
      </header>

      {isStale ? (
        <div className="inline-flex items-center gap-2 rounded-lg border border-accent-amber/40 bg-accent-amber/5 px-3 py-2 text-xs text-forge-body">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-amber" />
          <span>
            <span className="font-semibold text-accent-amber">
              Edits pending.
            </span>{" "}
            The currently rendered plan was authored against earlier assumptions.
            Click <span className="font-medium">Regenerate</span> in the page
            header to apply your edits.
          </span>
        </div>
      ) : null}

      {/* ============= 1. Plan threshold ============= */}
      <Panel
        icon={<Layers className="h-4 w-4 text-accent-purple" aria-hidden />}
        title="Plan threshold"
        subtitle="Minimum parent L4 Activity Group prize for inclusion. Same grain as the program tier 2x2."
        affectsLlm
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <UsdField
            label="Threshold"
            value={assumptions.planThresholdUsd}
            onChange={(n) => onChange({ planThresholdUsd: n })}
            ariaLabel="Plan threshold in US dollars"
          />
          <div className="flex flex-wrap gap-1">
            {PRESETS_USD.map((p) => {
              const active = p.value === assumptions.planThresholdUsd;
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => onChange({ planThresholdUsd: p.value })}
                  className={`rounded-full border px-2 py-0.5 font-mono text-[10px] tabular-nums transition ${
                    active
                      ? "border-accent-purple/60 bg-accent-purple/10 text-accent-purple-dark"
                      : "border-forge-border bg-forge-well text-forge-body hover:text-forge-ink"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
        <p className="mt-2 text-[11px] text-forge-subtle">
          {assumptions.planThresholdUsd === 0
            ? "No threshold — every above-the-2x2-line initiative is in plan."
            : excludedCount === 0
              ? `Every in-plan L5 rolls up to an L4 Activity Group prize at or above ${formatUsdCompact(assumptions.planThresholdUsd)}.`
              : `${excludedCount} initiative${excludedCount === 1 ? "" : "s"} · ${formatUsdCompact(excludedAiUsd)} fall below threshold and are deferred as opportunistic.`}
        </p>
      </Panel>

      {/* ============= 2. Program window ============= */}
      <Panel
        icon={<Calendar className="h-4 w-4 text-accent-teal" aria-hidden />}
        title="Program window"
        subtitle="Program start month and adoption ramp. Affects Gantt timing only."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField
            label="Program start month"
            help="Month 1 of the program (1-indexed)."
            value={assumptions.programStartMonth}
            min={1}
            max={36}
            onChange={(n) => onChange({ programStartMonth: n })}
          />
          <NumberField
            label="Adoption ramp (months)"
            help="Linear ramp window after build completes."
            value={assumptions.rampMonths}
            min={0}
            max={18}
            onChange={(n) => onChange({ rampMonths: n })}
          />
        </div>
      </Panel>

      {/* ============= 3. High-Effort timing ============= */}
      <Panel
        icon={<Wrench className="h-4 w-4 text-accent-purple-dark" aria-hidden />}
        title="High-Effort timing"
        subtitle="Build window and value-clock start month for High-Effort projects (Strategic Bets / Deprioritized)."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField
            label="Build duration (months)"
            value={assumptions.highEffortBuildMonths}
            min={1}
            max={36}
            onChange={(n) => onChange({ highEffortBuildMonths: n })}
          />
          <NumberField
            label="Value-clock start (month)"
            value={assumptions.highEffortValueStartMonth}
            min={1}
            max={36}
            onChange={(n) => onChange({ highEffortValueStartMonth: n })}
          />
        </div>
      </Panel>

      {/* ============= 4. Low-Effort timing ============= */}
      <Panel
        icon={<Wrench className="h-4 w-4 text-accent-teal" aria-hidden />}
        title="Low-Effort timing"
        subtitle="Build window and value-clock start month for Low-Effort projects (Quick Wins / Fill-ins)."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField
            label="Build duration (months)"
            value={assumptions.lowEffortBuildMonths}
            min={1}
            max={36}
            onChange={(n) => onChange({ lowEffortBuildMonths: n })}
          />
          <NumberField
            label="Value-clock start (month)"
            value={assumptions.lowEffortValueStartMonth}
            min={1}
            max={36}
            onChange={(n) => onChange({ lowEffortValueStartMonth: n })}
          />
        </div>
        <div className="mt-4">
          <NumberField
            label="Fill-in start offset (months)"
            help="Months Fill-ins (Low-value × Low-effort) start after Quick Wins, so the Gantt staggers visibly."
            value={assumptions.fillInStartOffsetMonths}
            min={0}
            max={12}
            onChange={(n) => onChange({ fillInStartOffsetMonths: n })}
          />
        </div>
      </Panel>

      {/* ============= 5. Brief depth ============= */}
      <Panel
        icon={<Sparkles className="h-4 w-4 text-accent-purple" aria-hidden />}
        title="Brief depth"
        subtitle="Per-lens row counts in the project briefs. Concise saves tokens; Full is for client read-outs."
        affectsLlm
      >
        <div className="flex gap-2">
          <DepthChip
            active={assumptions.briefDepth === "Concise"}
            label="Concise"
            description="3 rows per lens, 3–4 agents."
            onClick={() => onChange({ briefDepth: "Concise" })}
          />
          <DepthChip
            active={assumptions.briefDepth === "Full"}
            label="Full"
            description="4–5 rows per lens, 4–6 agents."
            onClick={() => onChange({ briefDepth: "Full" })}
          />
        </div>
      </Panel>

      {/* ============= 6. Versant lens emphases ============= */}
      <Panel
        icon={<ShieldCheck className="h-4 w-4 text-accent-purple" aria-hidden />}
        title="Versant lens emphases"
        subtitle="Toggle which structural Versant constraints the LLM should foreground when authoring briefs and narrative."
        affectsLlm
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <ToggleField
            label="TSA readiness"
            description="NBCU TSA expiration urgency for Sales / Finance / IT / HR / Operations."
            checked={assumptions.emphasizeTsaReadiness}
            onChange={(v) => onChange({ emphasizeTsaReadiness: v })}
          />
          <ToggleField
            label="BB- credit + covenant discipline"
            description="Treasury, monitoring, run-rate cost discipline for Finance / Corporate Services."
            checked={assumptions.emphasizeBbCreditDiscipline}
            onChange={(v) => onChange({ emphasizeBbCreditDiscipline: v })}
          />
          <ToggleField
            label="Editorial integrity floor"
            description="Human-judgment guardrails for Editorial & News, MS NOW, Production."
            checked={assumptions.emphasizeEditorialIntegrity}
            onChange={(v) => onChange({ emphasizeEditorialIntegrity: v })}
          />
          <ToggleField
            label="Live-broadcast resilience"
            description="On-air signal protection for Operations & Technology, Production."
            checked={assumptions.emphasizeBroadcastResilience}
            onChange={(v) => onChange({ emphasizeBroadcastResilience: v })}
          />
        </div>
      </Panel>

      <p className="text-[11px] text-forge-hint">
        Defaults: threshold {formatUsdCompact(DEFAULT_ASSUMPTIONS.planThresholdUsd)},
        High-Effort {DEFAULT_ASSUMPTIONS.highEffortBuildMonths}-month build / value
        from M{DEFAULT_ASSUMPTIONS.highEffortValueStartMonth}, Low-Effort{" "}
        {DEFAULT_ASSUMPTIONS.lowEffortBuildMonths}-month build / value from M
        {DEFAULT_ASSUMPTIONS.lowEffortValueStartMonth}, ramp{" "}
        {DEFAULT_ASSUMPTIONS.rampMonths} months.
      </p>
    </div>
  );
}

// ===========================================================================
//   Sub-components
// ===========================================================================

function Panel({
  icon,
  title,
  subtitle,
  affectsLlm,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  affectsLlm?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-forge-border bg-forge-surface p-5 shadow-sm">
      <header className="flex items-start gap-3">
        <span className="mt-0.5">{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-sm font-semibold text-forge-ink">
              {title}
            </h3>
            {affectsLlm ? <AffectsLlmBadge /> : null}
          </div>
          {subtitle ? (
            <p className="mt-0.5 max-w-2xl text-xs text-forge-subtle">
              {subtitle}
            </p>
          ) : null}
        </div>
      </header>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function AffectsLlmBadge({ inline }: { inline?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-accent-purple/30 bg-accent-purple/5 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-accent-purple-dark ${inline ? "" : ""}`}
    >
      <Settings2 className="h-2.5 w-2.5" aria-hidden /> Affects LLM
    </span>
  );
}

function UsdField({
  label,
  value,
  onChange,
  ariaLabel,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  ariaLabel: string;
}) {
  const [draft, setDraft] = React.useState<string>(formatPlain(value));
  React.useEffect(() => {
    if (parseUsd(draft) === value) return;
    setDraft(formatPlain(value));
  }, [value, draft]);
  React.useEffect(() => {
    const parsed = parseUsd(draft);
    if (parsed === null) return;
    if (parsed === value) return;
    const t = setTimeout(() => onChange(parsed), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [draft, value, onChange]);
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-forge-subtle">
        {label}
      </span>
      <span className="inline-flex items-center rounded-lg border border-forge-border bg-forge-well/40 px-2 py-1.5 transition focus-within:border-accent-purple/60 focus-within:bg-forge-surface">
        <span className="mr-1 text-forge-hint">$</span>
        <input
          type="text"
          inputMode="numeric"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            const parsed = parseUsd(draft);
            if (parsed === null) return;
            setDraft(formatPlain(parsed));
            onChange(parsed);
          }}
          aria-label={ariaLabel}
          className="w-32 bg-transparent font-mono text-sm tabular-nums text-forge-ink outline-none placeholder:text-forge-hint"
        />
      </span>
    </label>
  );
}

function NumberField({
  label,
  help,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  help?: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  const [draft, setDraft] = React.useState<string>(String(value));
  React.useEffect(() => {
    setDraft(String(value));
  }, [value]);
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-forge-subtle">
        {label}
      </span>
      <input
        type="number"
        min={min}
        max={max}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const n = Number.parseInt(draft, 10);
          if (Number.isFinite(n)) {
            const clamped = Math.max(min, Math.min(max, n));
            setDraft(String(clamped));
            onChange(clamped);
          } else {
            setDraft(String(value));
          }
        }}
        className="w-full rounded-lg border border-forge-border bg-forge-well/40 px-3 py-1.5 font-mono text-sm tabular-nums text-forge-ink outline-none transition focus:border-accent-purple/60 focus:bg-forge-surface"
      />
      {help ? <span className="text-[11px] text-forge-hint">{help}</span> : null}
    </label>
  );
}

function DepthChip({
  active,
  label,
  description,
  onClick,
}: {
  active: boolean;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-xl border px-3 py-2 text-left transition ${
        active
          ? "border-accent-purple/60 bg-accent-purple/10 text-accent-purple-dark"
          : "border-forge-border bg-forge-well/40 text-forge-body hover:border-accent-purple/30 hover:text-forge-ink"
      }`}
    >
      <div className="text-sm font-semibold">{label}</div>
      <div className="mt-0.5 text-[11px] text-forge-subtle">{description}</div>
    </button>
  );
}

function ToggleField({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex items-start gap-3 rounded-xl border bg-forge-well/40 p-3 text-left transition ${
        checked
          ? "border-accent-purple/40 bg-accent-purple/5"
          : "border-forge-border hover:border-accent-purple/25"
      }`}
    >
      <span
        className={`relative mt-1 h-4 w-7 flex-shrink-0 rounded-full transition ${
          checked ? "bg-accent-purple" : "bg-forge-border"
        }`}
        aria-hidden
      >
        <span
          className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition ${
            checked ? "left-3" : "left-0.5"
          }`}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-forge-ink">{label}</span>
        <span className="mt-0.5 block text-[11px] text-forge-subtle">
          {description}
        </span>
      </span>
    </button>
  );
}

// ===========================================================================
//   Helpers
// ===========================================================================

function formatPlain(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  return Math.round(n).toLocaleString("en-US");
}

function parseUsd(raw: string): number | null {
  const trimmed = raw.trim().replace(/[\s,]/g, "").replace(/^\$/, "");
  if (trimmed === "") return 0;
  const m = trimmed.match(/^(\d+(?:\.\d+)?)([kKmMbB]?)$/);
  if (!m) return null;
  const base = Number.parseFloat(m[1]);
  if (!Number.isFinite(base)) return null;
  const suffix = m[2].toLowerCase();
  if (suffix === "k") return Math.round(base * 1_000);
  if (suffix === "m") return Math.round(base * 1_000_000);
  if (suffix === "b") return Math.round(base * 1_000_000_000);
  return Math.round(base);
}
