"use client";

import * as React from "react";
import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { getCapabilityMapById } from "@/data/capabilityMap/maps";
import type {
  CapabilityL3,
  CapabilityL2,
  CapabilityL4,
  L4LeadInputs,
  CapabilitySavingsAssumptions,
} from "@/data/capabilityMap/types";

const EMPTY_L4: Record<string, L4LeadInputs> = {};
import { defaultCapabilitySavingsAssumptions } from "@/data/capabilityMap/types";
import {
  getCapabilityMapState,
  updateCapabilityMapState,
  type CapabilityMapPersistedStateV1,
} from "@/lib/localStore";
import { computeMapRollup } from "@/lib/capabilityMap/savingsModel";
import { getPortalAudience, isInternalSurfaceAllowed } from "@/lib/portalAudience";
import { buildExportSnapshot, parseImportedCapabilityState, applyImportedState } from "@/lib/capabilityMap/importExport";
import { towers } from "@/data/towers";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function towerName(id: string) {
  return towers.find((t) => t.id === id)?.name ?? id;
}

type Props = { mapId: string };

function numOrUndef(v: string): number | undefined {
  if (v === "" || v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function L4FieldRow({
  l4,
  l2Name,
  value,
  onChange,
}: {
  l4: CapabilityL4;
  l2Name: string;
  value: L4LeadInputs;
  onChange: (id: string, next: L4LeadInputs) => void;
}) {
  const v = (k: keyof L4LeadInputs) => value?.[k];
  return (
    <tr className="border-b border-forge-border/60 text-forge-body last:border-0">
      <td className="max-w-md py-2.5 pl-0 pr-2 align-top text-sm">
        <div className="font-medium text-forge-ink">{l4.name}</div>
        {l4.relatedTowerIds?.length ? (
          <div className="mt-1 text-[11px] text-forge-subtle">
            Related tower:{" "}
            {l4.relatedTowerIds.map((id) => (
              <Link key={id} href={`/tower/${id}`} className="text-accent-purple hover:underline">
                {towerName(id)}
              </Link>
            ))}
          </div>
        ) : null}
        <div className="mt-0.5 font-mono text-[10px] text-forge-hint">{l2Name}</div>
      </td>
      <td className="p-1.5">
        <input
          className="w-full min-w-0 rounded border border-forge-border bg-forge-page px-1.5 py-1 font-mono text-sm"
          inputMode="numeric"
          value={v("headcount") ?? ""}
          onChange={(e) => onChange(l4.id, { ...value, headcount: numOrUndef(e.target.value) })}
          aria-label={`${l4.name} headcount`}
        />
      </td>
      <td className="p-1.5">
        <input
          className="w-full min-w-0 rounded border border-forge-border bg-forge-page px-1.5 py-1 font-mono text-sm"
          inputMode="decimal"
          value={v("spend") ?? ""}
          onChange={(e) => onChange(l4.id, { ...value, spend: numOrUndef(e.target.value) })}
          aria-label={`${l4.name} spend USD`}
        />
      </td>
      <td className="p-1.5">
        <input
          className="w-full min-w-0 rounded border border-forge-border bg-forge-page px-1.5 py-1 font-mono text-sm"
          inputMode="numeric"
          value={v("contractors") ?? ""}
          onChange={(e) => onChange(l4.id, { ...value, contractors: numOrUndef(e.target.value) })}
          aria-label={`${l4.name} contractors`}
        />
      </td>
      <td className="p-1.5">
        <input
          className="w-full min-w-0 rounded border border-forge-border bg-forge-page px-1.5 py-1 font-mono text-sm"
          inputMode="numeric"
          value={v("offshorePct") ?? ""}
          onChange={(e) => onChange(l4.id, { ...value, offshorePct: numOrUndef(e.target.value) })}
          aria-label={`${l4.name} percent offshoreable`}
        />
      </td>
      <td className="p-1.5">
        <input
          className="w-full min-w-0 rounded border border-forge-border bg-forge-page px-1.5 py-1 font-mono text-sm"
          inputMode="numeric"
          value={v("aiAutomationPct") ?? ""}
          onChange={(e) => onChange(l4.id, { ...value, aiAutomationPct: numOrUndef(e.target.value) })}
          aria-label={`${l4.name} percent AI automatable`}
        />
      </td>
    </tr>
  );
}

function AssumptionsPanel({
  a,
  onChange,
  allowFullControls,
}: {
  a: CapabilitySavingsAssumptions;
  onChange: (next: Partial<CapabilitySavingsAssumptions>) => void;
  allowFullControls: boolean;
}) {
  return (
    <div className="rounded-2xl border border-forge-border bg-forge-surface p-4">
      <h2 className="font-display text-lg text-forge-ink">Modeling assumptions (illustrative)</h2>
      <p className="mt-1 text-xs text-forge-subtle">
        Weights and caps are not Versant business rules—tune for workshop discussion only.
      </p>
      {allowFullControls ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs">
            <span className="text-forge-subtle">Offshore band weight (0–1)</span>
            <input
              className="mt-1 w-full rounded border border-forge-border bg-forge-page px-2 py-1.5 font-mono text-sm"
              type="number"
              step={0.05}
              min={0}
              max={1}
              value={a.offshoreLeverWeight}
              onChange={(e) => onChange({ offshoreLeverWeight: Number(e.target.value) })}
            />
          </label>
          <label className="block text-xs">
            <span className="text-forge-subtle">AI automation band weight (0–1)</span>
            <input
              className="mt-1 w-full rounded border border-forge-border bg-forge-page px-2 py-1.5 font-mono text-sm"
              type="number"
              step={0.05}
              min={0}
              max={1}
              value={a.aiLeverWeight}
              onChange={(e) => onChange({ aiLeverWeight: Number(e.target.value) })}
            />
          </label>
          <label className="block text-xs">
            <span className="text-forge-subtle">Combine mode</span>
            <select
              className="mt-1 w-full rounded border border-forge-border bg-forge-page px-2 py-1.5 text-sm"
              value={a.combineMode}
              onChange={(e) =>
                onChange({ combineMode: e.target.value as CapabilitySavingsAssumptions["combineMode"] })
              }
            >
              <option value="capped">Capped (no double count beyond cap %)</option>
              <option value="additive">Additive (offshore + AI bands)</option>
            </select>
          </label>
          <label className="block text-xs">
            <span className="text-forge-subtle">Cap: max combined savings (% of row spend)</span>
            <input
              className="mt-1 w-full rounded border border-forge-border bg-forge-page px-2 py-1.5 font-mono text-sm"
              type="number"
              min={0}
              max={100}
              value={a.combinedCapPctOfSpend}
              onChange={(e) => onChange({ combinedCapPctOfSpend: Number(e.target.value) })}
            />
          </label>
          <label className="block text-xs">
            <span className="text-forge-subtle">Wave base (months, illustrative)</span>
            <input
              className="mt-1 w-full rounded border border-forge-border bg-forge-page px-2 py-1.5 font-mono text-sm"
              type="number"
              min={0}
              value={a.waveBaseMonths}
              onChange={(e) => onChange({ waveBaseMonths: Number(e.target.value) })}
            />
          </label>
          <label className="block text-xs">
            <span className="text-forge-subtle">Timeline extra per “AI point” not automated (months)</span>
            <input
              className="mt-1 w-full rounded border border-forge-border bg-forge-page px-2 py-1.5 font-mono text-sm"
              type="number"
              step={0.01}
              min={0}
              value={a.monthsPerPointNotAutomated}
              onChange={(e) => onChange({ monthsPerPointNotAutomated: Number(e.target.value) })}
            />
          </label>
        </div>
      ) : (
        <p className="mt-3 text-xs text-forge-subtle">
          Full assumption controls (weights, cap, combine) are available in the internal / full program build.
        </p>
      )}
      {allowFullControls ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onChange({ ...defaultCapabilitySavingsAssumptions })}
            className="rounded-lg border border-forge-border bg-forge-well px-2 py-1.5 text-xs text-forge-body"
          >
            Reset to illustrative defaults
          </button>
        </div>
      ) : null}
    </div>
  );
}

function SummaryStrip({
  totalModelledSavings,
  avgWaveMonths,
}: {
  totalModelledSavings: number;
  avgWaveMonths: number;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="rounded-2xl border border-forge-border bg-forge-surface p-4">
        <div className="text-xs uppercase tracking-wide text-forge-hint">Modeled annual “savings” (illustrative)</div>
        <div className="mt-1 font-mono text-2xl text-accent-green">
          ${totalModelledSavings.toLocaleString("en-US", { maximumFractionDigits: 0 })}
        </div>
        <p className="mt-1 text-xs text-forge-subtle">Sum of L4 combined bands after your weights and cap.</p>
      </div>
      <div className="rounded-2xl border border-forge-border bg-forge-surface p-4">
        <div className="text-xs uppercase tracking-wide text-forge-hint">Indicative wave length (L4 mean)</div>
        <div className="mt-1 font-mono text-2xl text-accent-teal">
          {avgWaveMonths.toLocaleString("en-US", { maximumFractionDigits: 1 })} months
        </div>
        <p className="mt-1 text-xs text-forge-subtle">From AI% on each L4; not a committed program schedule.</p>
      </div>
    </div>
  );
}

export function CapabilityAssessClient({ mapId: initialMapId }: Props) {
  const [state, setState] = React.useState<CapabilityMapPersistedStateV1 | null>(null);
  const [importErr, setImportErr] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const audience = getPortalAudience();
  const showInternal = isInternalSurfaceAllowed(audience);
  const allowAssumptionTuning = showInternal;

  const [chartReady, setChartReady] = React.useState(false);
  React.useEffect(() => {
    setState(getCapabilityMapState());
  }, []);
  React.useEffect(() => {
    setChartReady(true);
  }, []);

  const map = getCapabilityMapById(initialMapId) ?? getCapabilityMapById("hr-localize-versant")!;

  const l4Inputs = state?.l4Inputs;
  const assumptions = state?.assumptions ?? defaultCapabilitySavingsAssumptions;
  const rollup = React.useMemo(
    () => computeMapRollup(map, l4Inputs ?? EMPTY_L4, assumptions),
    [map, l4Inputs, assumptions],
  );

  const onL4Change = (id: string, next: L4LeadInputs) => {
    const n = updateCapabilityMapState({ l4Inputs: { [id]: next } });
    setState(n);
  };

  const onAssumptions = (patch: Partial<CapabilitySavingsAssumptions>) => {
    const n = updateCapabilityMapState({ assumptions: { ...assumptions, ...patch } });
    setState(n);
  };

  const totalSavings = rollup.rows.reduce((s, r) => s + r.combinedSavings, 0);
  const waveRows = rollup.rows.filter((r) => r.spend > 0);
  const avgWave =
    waveRows.length === 0
      ? 0
      : waveRows.reduce((s, r) => s + r.waveTimelineMonths, 0) / waveRows.length;

  const byL2Chart = rollup.byL2.map((r) => ({ name: r.l2Name, modeled: r.combinedSavings }));

  const onExport = () => {
    const data = buildExportSnapshot();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "forge-capability-map-state.json";
    a.click();
  };

  const onPickImport: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const text = r.result;
        if (typeof text !== "string") {
          setImportErr("Invalid file");
          return;
        }
        const json = JSON.parse(text) as unknown;
        const parsed = parseImportedCapabilityState(json);
        if (!parsed.ok) {
          setImportErr(parsed.error);
          return;
        }
        applyImportedState(parsed.state);
        setState(getCapabilityMapState());
        setImportErr(null);
      } catch {
        setImportErr("Invalid JSON");
      }
    };
    r.readAsText(f);
  };

  if (!state) {
    return (
      <PageShell>
        <div className="p-8 font-mono text-forge-subtle">Loading local assessment…</div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="text-xs text-forge-subtle">
          <Link href="/" className="text-forge-body underline">
            Program home
          </Link>{" "}
          / {map.name}
        </div>
        <h1 className="mt-2 font-display text-3xl font-semibold text-forge-ink">{map.name}</h1>
        <p className="mt-1 text-sm text-forge-body">L1: {map.l1Name}</p>
        {map.mapRelatedTowerIds?.length ? (
          <p className="mt-2 text-sm text-forge-body">
            Forge coverage:{" "}
            {map.mapRelatedTowerIds.map((id) => (
              <Link key={id} href={`/tower/${id}`} className="text-accent-purple hover:underline">
                {towerName(id)} ({id})
              </Link>
            ))}
          </p>
        ) : null}
        {showInternal ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onExport}
              className="rounded-lg border border-forge-border bg-forge-surface px-3 py-1.5 text-sm text-forge-body"
            >
              Export JSON
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg border border-forge-border bg-forge-surface px-3 py-1.5 text-sm text-forge-body"
            >
              Import JSON
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={onPickImport}
            />
          </div>
        ) : null}
        {importErr ? <p className="mt-2 text-sm text-accent-red">{importErr}</p> : null}
        <div className="mt-6 rounded-2xl border border-forge-hint/40 bg-forge-well/40 p-3 text-xs text-forge-subtle">
          <strong className="text-forge-ink">Disclaimer:</strong> Figures are modeled from user inputs and
          are not Versant-reported. This is not a system of record, offer, or commitment. Use discovery and
          finance to validate.
        </div>
        <div className="mt-6">
          <SummaryStrip totalModelledSavings={totalSavings} avgWaveMonths={avgWave} />
        </div>
        {chartReady && byL2Chart.length > 0 && byL2Chart.some((b) => b.modeled > 0) ? (
          <div className="mt-6 h-64 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={256}>
              <BarChart data={byL2Chart} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "hsl(220, 6%, 65%)" }}
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                  height={72}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "hsl(220, 6%, 65%)" }}
                  tickFormatter={(v) => `${v / 1e6 >= 1 ? (v / 1e6).toFixed(1) + "M" : (v / 1e3).toFixed(0) + "k"}`}
                />
                <Tooltip
                  contentStyle={{ background: "#1A1A2E", border: "1px solid #2d2d44" }}
                  formatter={(v) => [typeof v === "number" ? v.toFixed(0) : v, "Modeled $"]}
                />
                <Bar dataKey="modeled" name="Modeled" fill="#00C853" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : null}
        <div className="mt-8">
          <AssumptionsPanel a={assumptions} onChange={onAssumptions} allowFullControls={allowAssumptionTuning} />
        </div>
        {map.l2.map((l2) => (
          <L2Block
            key={l2.id}
            l2={l2}
            l4ById={l4Inputs ?? EMPTY_L4}
            onL4Change={onL4Change}
          />
        ))}
      </div>
    </PageShell>
  );
}

function L2Block({
  l2,
  l4ById,
  onL4Change,
}: {
  l2: CapabilityL2;
  l4ById: Record<string, L4LeadInputs | undefined>;
  onL4Change: (id: string, v: L4LeadInputs) => void;
}) {
  return (
    <section className="mt-10" aria-labelledby={`h-${l2.id}`}>
      <h2
        id={`h-${l2.id}`}
        className="border-b border-forge-border pb-2 font-display text-xl text-forge-ink"
      >
        &gt; {l2.name}
      </h2>
      {l2.l3.map((l3) => (
        <div key={l3.id} className="mt-4">
          <h3 className="text-sm font-medium text-forge-ink">{l3.name}</h3>
          <L3Table l3={l3} l2Name={l2.name} l4ById={l4ById} onL4Change={onL4Change} />
        </div>
      ))}
    </section>
  );
}

function L3Table({
  l3,
  l2Name,
  l4ById,
  onL4Change,
}: {
  l3: CapabilityL3;
  l2Name: string;
  l4ById: Record<string, L4LeadInputs | undefined>;
  onL4Change: (id: string, v: L4LeadInputs) => void;
}) {
  return (
    <div className="mt-2 overflow-x-auto rounded-xl border border-forge-border">
      <table className="w-full min-w-[800px] border-collapse text-left text-sm">
        <thead>
          <tr className="bg-forge-well/80 text-[11px] font-medium uppercase tracking-wide text-forge-hint">
            <th className="p-2">L4 activity</th>
            <th className="p-2">People</th>
            <th className="p-2">Spend (USD/yr)</th>
            <th className="p-2">Contractors</th>
            <th className="p-2">% offshoreable</th>
            <th className="p-2">% AI</th>
          </tr>
        </thead>
        <tbody>
          {l3.l4.map((l4) => (
            <L4FieldRow
              key={l4.id}
              l4={l4}
              l2Name={l2Name}
              value={l4ById[l4.id] ?? {}}
              onChange={onL4Change}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
