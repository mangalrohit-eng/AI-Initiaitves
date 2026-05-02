"use client";

import * as React from "react";
import { Calculator, RotateCcw } from "lucide-react";
import { defaultTowerRates, type TowerId, type TowerRates } from "@/data/assess/types";
import { setTowerRates } from "@/lib/localStore";
import { formatMoney } from "@/components/ui/MoneyCounter";
import { useRedactDollars } from "@/lib/clientMode";

type Props = {
  towerId: TowerId;
  towerName: string;
  rates: TowerRates;
};

/**
 * Per-tower cost-rates editor card. Mounted on the Configure Impact Levers
 * page directly above the L4 lever sliders.
 *
 * Behavior:
 *   - Four `MoneyInput` controls (onshore/offshore FTE + onshore/offshore
 *     contractor) write directly to `TowerAssessState.rates` via
 *     `setTowerRates(towerId, patch)`. Single-field patches deep-merge in
 *     `setTowerAssess` so a single edit doesn't clobber the other three
 *     fields.
 *   - "Reset to seeded" reverts every field to the workshop-pivot default.
 *   - Returns `null` when client/protected mode is active so a lead handing
 *     the laptop to a client never exposes the underlying rates. Modeled
 *     savings continue to redact via the existing `useRedactDollars()`
 *     callsites on `L4LeverRow`, the scoreboard, etc.
 *
 * Persistence: writes flow through `setTowerAssess` → `subscribe()` →
 * AssessSyncProvider, so the debounced PUT to `/api/assess` happens
 * automatically. The existing single-tower-scope guard ensures non-admin
 * users can only update their own tower's rates.
 */
export function TowerRatesCard({ towerId, towerName, rates }: Props) {
  // All hooks must run on every render — the redact gate below is a render-
  // time short-circuit, not a mount-time skip.
  const redact = useRedactDollars();
  const seeded = React.useMemo(() => defaultTowerRates(towerId), [towerId]);
  const onPatch = React.useCallback(
    (patch: Partial<TowerRates>) => {
      setTowerRates(towerId, patch);
    },
    [towerId],
  );

  if (redact) return null;

  const fteWageGap = Math.max(0, rates.blendedFteOnshore - rates.blendedFteOffshore);
  const ctrWageGap = Math.max(
    0,
    rates.blendedContractorOnshore - rates.blendedContractorOffshore,
  );

  const isAtSeed =
    rates.blendedFteOnshore === seeded.blendedFteOnshore &&
    rates.blendedFteOffshore === seeded.blendedFteOffshore &&
    rates.blendedContractorOnshore === seeded.blendedContractorOnshore &&
    rates.blendedContractorOffshore === seeded.blendedContractorOffshore;

  const onResetAll = () => {
    setTowerRates(towerId, seeded);
  };

  return (
    <section
      aria-label={`${towerName} cost rates`}
      className="mt-5 rounded-2xl border border-accent-purple/20 bg-forge-surface/70 p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span
            aria-hidden
            className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-purple/10 text-accent-purple-dark"
          >
            <Calculator className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <h3 className="font-display text-sm font-semibold text-forge-ink">
              &gt; Cost rates
            </h3>
            <p className="mt-0.5 text-[11px] leading-relaxed text-forge-subtle">
              Onshore from the workshop pivot &middot; offshore at 1/3 of onshore &middot; contractors at 80% of FTE rate. Edits stay scoped to {towerName}.
            </p>
          </div>
        </div>
        {!isAtSeed ? (
          <button
            type="button"
            onClick={onResetAll}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-forge-border bg-forge-surface px-2 py-1 text-[11px] font-medium text-forge-body hover:border-accent-purple/40 hover:text-accent-purple-dark"
            title="Reset every field to the seeded workshop-pivot defaults for this tower"
          >
            <RotateCcw className="h-3 w-3" aria-hidden />
            Reset to seeded
          </button>
        ) : null}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <RateInput
          label="FTE onshore"
          value={rates.blendedFteOnshore}
          seeded={seeded.blendedFteOnshore}
          onChange={(n) => onPatch({ blendedFteOnshore: n })}
        />
        <RateInput
          label="FTE offshore"
          value={rates.blendedFteOffshore}
          seeded={seeded.blendedFteOffshore}
          onChange={(n) => onPatch({ blendedFteOffshore: n })}
        />
        <RateInput
          label="Contractor onshore"
          value={rates.blendedContractorOnshore}
          seeded={seeded.blendedContractorOnshore}
          onChange={(n) => onPatch({ blendedContractorOnshore: n })}
        />
        <RateInput
          label="Contractor offshore"
          value={rates.blendedContractorOffshore}
          seeded={seeded.blendedContractorOffshore}
          onChange={(n) => onPatch({ blendedContractorOffshore: n })}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] text-forge-subtle">
        <span className="inline-flex items-center gap-1 rounded-full border border-forge-border bg-forge-surface/60 px-2 py-0.5 font-mono">
          FTE wage gap{" "}
          <span className="text-forge-body">{formatMoney(fteWageGap, { decimals: 0 })}</span>{" "}
          / yr per moved FTE
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-forge-border bg-forge-surface/60 px-2 py-0.5 font-mono">
          Contractor wage gap{" "}
          <span className="text-forge-body">{formatMoney(ctrWageGap, { decimals: 0 })}</span>{" "}
          / yr per moved contractor
        </span>
      </div>
    </section>
  );
}

function RateInput({
  label,
  value,
  seeded,
  onChange,
}: {
  label: string;
  value: number;
  seeded: number;
  onChange: (n: number) => void;
}) {
  const isAtSeed = Math.round(value) === Math.round(seeded);
  return (
    <label className="flex flex-col gap-1 rounded-xl border border-forge-border bg-forge-surface p-2.5">
      <span className="text-[10px] font-medium uppercase tracking-wider text-forge-hint">
        {label}
      </span>
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-sm text-forge-subtle">$</span>
        <input
          className="w-full bg-transparent font-mono text-sm font-semibold text-forge-ink outline-none focus:ring-0"
          type="number"
          min={0}
          step={1000}
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n) && n >= 0) onChange(n);
          }}
          aria-label={`${label} blended rate per FTE-year, US dollars`}
        />
      </div>
      <div className="flex items-center justify-between text-[10px] text-forge-hint">
        <span>per FTE-year</span>
        {!isAtSeed ? (
          <button
            type="button"
            onClick={() => onChange(seeded)}
            className="inline-flex items-center gap-1 text-forge-subtle hover:text-accent-purple-dark"
            title={`Reset to seeded ${formatMoney(seeded, { decimals: 0 })}`}
          >
            <RotateCcw className="h-2.5 w-2.5" aria-hidden />
            {formatMoney(seeded, { decimals: 0 })}
          </button>
        ) : (
          <span className="text-forge-hint">seeded</span>
        )}
      </div>
    </label>
  );
}
