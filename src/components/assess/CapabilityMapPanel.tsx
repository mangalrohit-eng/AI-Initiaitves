"use client";

import * as React from "react";
import { Info } from "lucide-react";
import type {
  GlobalAssessAssumptions,
  L4WorkforceRow,
} from "@/data/assess/types";
import type { CapabilityMapViewModel } from "@/lib/assess/capabilityMapTree";
import { findRowForMapL4, isL4InFootprint } from "@/lib/assess/capabilityMapTree";
import { rowAnnualCost } from "@/lib/assess/scenarioModel";
import { formatMoney } from "@/components/ui/MoneyCounter";
import { cn } from "@/lib/utils";

type Props = {
  view: CapabilityMapViewModel;
  rows: L4WorkforceRow[];
  /** When provided, each L2 / L3 / L4 paints a $-pool bar sized by share. */
  globalAssumptions?: GlobalAssessAssumptions;
};

/**
 * Visual L1 to L4 capability tree.
 *
 * Replaces the text-only list with a four-tier tree where each L2 + L3 row
 * paints a $-pool bar sized by its share of the tower's pool — the visual
 * Excel cannot do without macros. L4 leaves are coloured by whether they are
 * in the current footprint and label the headcount in mono.
 */
export function CapabilityMapPanel({ view, rows, globalAssumptions }: Props) {
  const totals = React.useMemo(() => buildTotals(view, rows, globalAssumptions), [
    view,
    rows,
    globalAssumptions,
  ]);

  return (
    <div className="space-y-3">
      {view.secondaryLabel ? (
        <p className="text-xs text-forge-subtle">
          <Info className="mb-0.5 mr-1 inline h-3.5 w-3.5 text-accent-purple" aria-hidden />
          {view.secondaryLabel}. Bars show each branch&apos;s share of the tower
          pool $; shaded L4s are in the current footprint.
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-forge-border bg-forge-surface/60 p-4">
        <div className="min-w-[820px] space-y-3">
          <div className="flex items-stretch gap-2">
            <Rail label="L1" />
            <div className="flex flex-1 items-center justify-between gap-3 rounded-lg border border-forge-ink/30 bg-gradient-to-r from-accent-purple/15 via-forge-ink/40 to-forge-ink/40 px-4 py-3">
              <div className="flex items-baseline gap-2">
                <span className="font-display text-base font-semibold tracking-wide text-accent-mist">
                  {view.l1Name}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-forge-hint">
                  Tower L1
                </span>
              </div>
              {totals && totals.totalPool > 0 ? (
                <div className="font-mono text-xs tabular-nums text-accent-mist">
                  {formatMoney(totals.totalPool, { decimals: 1 })} pool
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-3">
            {view.l2.map((l2) => {
              const l2Pool = totals?.byL2.get(l2.name) ?? 0;
              const l2Share = totals?.totalPool ? l2Pool / totals.totalPool : 0;
              return (
                <div key={l2.name} className="space-y-1.5">
                  <div className="flex items-stretch gap-2">
                    <Rail label="L2" />
                    <div className="flex flex-1 items-center gap-3 rounded-lg border border-forge-border bg-forge-page/70 px-3 py-2">
                      <span className="font-display text-sm font-medium text-forge-ink">
                        {l2.name}
                      </span>
                      {totals?.totalPool ? <PoolBar share={l2Share} pool={l2Pool} hue="purple" /> : null}
                    </div>
                  </div>

                  <div className="space-y-1.5 pl-9">
                    {l2.l3.map((l3) => {
                      const l3Pool = totals?.byL3.get(`${l2.name}|${l3.name}`) ?? 0;
                      const l3Share = totals?.totalPool ? l3Pool / totals.totalPool : 0;
                      return (
                        <div key={`${l2.name}-${l3.name}`} className="space-y-1.5">
                          <div className="flex items-stretch gap-2">
                            <Rail label="L3" subtle />
                            <div className="flex flex-1 items-center gap-3 rounded border border-forge-border/70 bg-forge-well/60 px-3 py-1.5">
                              <span className="text-[12px] font-medium text-forge-body">
                                {l3.name}
                              </span>
                              {totals?.totalPool ? (
                                <PoolBar share={l3Share} pool={l3Pool} hue="teal" />
                              ) : null}
                              <span className="ml-auto font-mono text-[10px] text-forge-hint">
                                {l3.l4.length} L4
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-1.5 pl-8 sm:grid-cols-3 lg:grid-cols-4">
                            {l3.l4.map((l4) => {
                              const inData = isL4InFootprint(rows, l2.name, l3.name, l4);
                              return (
                                <L4Chip
                                  key={l4.id}
                                  inFootprint={inData}
                                  label={l4.name}
                                  meta={fteMeta(rows, l2.name, l3.name, l4)}
                                />
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function Rail({ label, subtle = false }: { label: string; subtle?: boolean }) {
  return (
    <div
      className={cn(
        "flex w-7 shrink-0 flex-col items-center justify-start pt-2 font-mono text-[10px] tracking-wider",
        subtle ? "text-forge-hint" : "text-forge-subtle",
      )}
      aria-hidden
    >
      <span>{label}</span>
      <span className="mt-1 h-full min-h-[1rem] w-px bg-forge-border" aria-hidden />
    </div>
  );
}

function PoolBar({ share, pool, hue }: { share: number; pool: number; hue: "purple" | "teal" }) {
  const pct = Math.max(0, Math.min(1, share)) * 100;
  return (
    <div className="flex flex-1 items-center gap-2">
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-forge-border/40">
        <div
          className={cn(
            "absolute inset-y-0 left-0 rounded-full",
            hue === "purple" ? "bg-accent-purple/70" : "bg-accent-teal/70",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-20 shrink-0 text-right font-mono text-[10px] tabular-nums text-forge-subtle">
        {pool > 0 ? `${formatMoney(pool, { decimals: pool >= 1_000_000 ? 1 : 0 })} · ${pct.toFixed(0)}%` : "—"}
      </span>
    </div>
  );
}

type RowMeta = { headcount: number; spend: number };

function fteMeta(
  rows: L4WorkforceRow[],
  l2: string,
  l3: string,
  l4: { id: string; name: string },
): RowMeta | null {
  const r = findRowForMapL4(rows, l2, l3, l4);
  if (!r) return null;
  const hc =
    (r.fteOnshore || 0) +
    (r.fteOffshore || 0) +
    (r.contractorOnshore || 0) +
    (r.contractorOffshore || 0);
  return { headcount: hc, spend: r.annualSpendUsd ?? 0 };
}

function L4Chip({
  inFootprint,
  label,
  meta,
}: {
  inFootprint: boolean;
  label: string;
  meta: RowMeta | null;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-0.5 rounded-md border px-2 py-1.5 text-[11px] leading-snug",
        inFootprint
          ? "border-accent-purple/40 bg-accent-purple/5 text-forge-body shadow-[0_0_0_1px_rgba(161,0,255,0.08)]"
          : "border-dashed border-forge-hint/40 bg-forge-page/40 text-forge-subtle",
      )}
      title={inFootprint ? "In current footprint" : "Not in footprint (upload or add row)"}
    >
      <span className="break-words text-forge-ink">{label}</span>
      {meta ? (
        <span className="font-mono text-[9px] tabular-nums text-forge-hint">
          {meta.headcount > 0 ? `${meta.headcount} h/c` : "0 h/c"}
          {meta.spend > 0 ? ` · ${formatMoney(meta.spend, { decimals: meta.spend >= 1_000_000 ? 1 : 0 })}` : ""}
        </span>
      ) : null}
    </div>
  );
}

function buildTotals(
  view: CapabilityMapViewModel,
  rows: L4WorkforceRow[],
  g: GlobalAssessAssumptions | undefined,
): {
  totalPool: number;
  byL2: Map<string, number>;
  byL3: Map<string, number>;
} | null {
  if (!g) return null;
  let totalPool = 0;
  const byL2 = new Map<string, number>();
  const byL3 = new Map<string, number>();
  for (const l2 of view.l2) {
    let l2Sum = 0;
    for (const l3 of l2.l3) {
      let l3Sum = 0;
      for (const l4 of l3.l4) {
        const r = findRowForMapL4(rows, l2.name, l3.name, l4);
        if (!r) continue;
        const c = rowAnnualCost(r, g);
        l3Sum += c;
        l2Sum += c;
        totalPool += c;
      }
      byL3.set(`${l2.name}|${l3.name}`, l3Sum);
    }
    byL2.set(l2.name, l2Sum);
  }
  return { totalPool, byL2, byL3 };
}
