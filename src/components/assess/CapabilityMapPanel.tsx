"use client";

import { Info } from "lucide-react";
import type { L4WorkforceRow } from "@/data/assess/types";
import type { CapabilityMapViewModel } from "@/lib/assess/capabilityMapTree";
import { findRowForMapL4, isL4InFootprint } from "@/lib/assess/capabilityMapTree";
import { cn } from "@/lib/utils";

type Props = {
  view: CapabilityMapViewModel;
  rows: L4WorkforceRow[];
};

export function CapabilityMapPanel({ view, rows }: Props) {
  return (
    <div className="space-y-3">
      {view.secondaryLabel ? (
        <p className="text-xs text-forge-subtle">
          <Info className="mb-0.5 mr-1 inline h-3.5 w-3.5 text-accent-purple" aria-hidden />
          {view.secondaryLabel}. Shaded L4s are in the current footprint; borders highlight scope.
        </p>
      ) : null}
      <div className="overflow-x-auto rounded-xl border border-forge-border bg-forge-surface/60 p-3">
        <div className="min-w-[720px]">
          <div className="mb-1 flex items-stretch gap-0">
            <div className="w-8 shrink-0 pt-1 text-[10px] font-mono tracking-tight text-forge-hint">
              L1
            </div>
            <div className="min-w-0 grow rounded-md border border-forge-ink/20 bg-forge-ink py-2.5 text-center text-sm font-semibold tracking-wide text-accent-mist">
              {view.l1Name}
            </div>
          </div>
          <div className="mb-0.5 mt-2 flex">
            <div className="w-8 shrink-0 pt-2 text-[10px] font-mono text-forge-hint">L2</div>
            <div className="grid min-w-0 grow grid-flow-col auto-cols-fr gap-2">
              {view.l2.map((l2) => (
                <div
                  key={l2.name}
                  className="min-w-[100px] rounded border border-forge-border bg-forge-page px-2 py-1.5 text-center text-xs font-medium text-forge-ink"
                >
                  {l2.name}
                </div>
              ))}
            </div>
          </div>
          <div className="flex">
            <div className="w-8 shrink-0 pt-1 text-[10px] font-mono text-forge-hint">L3</div>
            <div className="grid min-w-0 grow grid-flow-col auto-cols-fr gap-2">
              {view.l2.map((l2) => (
                <div key={l2.name} className="flex min-w-0 flex-col gap-1.5">
                  {l2.l3.map((l3) => (
                    <div
                      key={`${l2.name}-${l3.name}`}
                      className="rounded border border-forge-hint/50 bg-forge-well/80 px-2 py-1.5 text-[11px] font-medium leading-tight text-forge-body"
                    >
                      {l3.name}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-0.5 flex">
            <div className="w-8 shrink-0 pt-1 text-[10px] font-mono text-forge-hint">L4</div>
            <div className="grid min-w-0 grow grid-flow-col auto-cols-fr gap-2">
              {view.l2.map((l2) => (
                <div key={`l4-${l2.name}`} className="flex min-w-0 flex-col gap-2">
                  {l2.l3.map((l3) => (
                    <div
                      key={`l4b-${l2.name}-${l3.name}`}
                      className="flex flex-col gap-1 border-l-2 border-forge-hint/30 pl-1.5"
                    >
                      {l3.l4.map((l4) => {
                        const inData = isL4InFootprint(rows, l2.name, l3.name, l4);
                        return (
                          <L4Chip
                            key={l4.id}
                            inFootprint={inData}
                            label={l4.name}
                            fteLine={fteHint(rows, l2.name, l3.name, l4)}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function fteHint(
  rows: L4WorkforceRow[],
  l2: string,
  l3: string,
  l4: { id: string; name: string },
): string | undefined {
  const r = findRowForMapL4(rows, l2, l3, l4);
  if (!r) return undefined;
  const t =
    (r.fteOnshore || 0) + (r.fteOffshore || 0) + (r.contractorOnshore || 0) + (r.contractorOffshore || 0);
  if (t <= 0) return "0 h/c";
  return `${t} h/c`;
}

function L4Chip({
  inFootprint,
  label,
  fteLine,
}: {
  inFootprint: boolean;
  label: string;
  fteLine?: string;
}) {
  return (
    <div
      className={cn(
        "rounded border px-1.5 py-1 text-[10px] leading-snug text-forge-subtle",
        inFootprint
          ? "border-accent-purple/50 bg-forge-surface/90 text-forge-body shadow-[0_0_0_1px_rgba(161,0,255,0.12)]"
          : "border-dashed border-forge-hint/50 bg-forge-page/30 opacity-70",
      )}
      title={inFootprint ? "In current footprint" : "Not in footprint (upload or add row)"}
    >
      <span className="block break-words">{label}</span>
      {fteLine ? <span className="mt-0.5 block font-mono text-[9px] text-forge-hint">{fteLine}</span> : null}
    </div>
  );
}
