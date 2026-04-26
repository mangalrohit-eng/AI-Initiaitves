"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Download,
  FileSpreadsheet,
  Sparkles,
  Upload,
} from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { CapabilityMapPanel } from "@/components/assess/CapabilityMapPanel";
import { CapabilityScoreboard } from "@/components/assess/CapabilityScoreboard";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { TowerJourneyStepper } from "@/components/layout/TowerJourneyStepper";
import { Term } from "@/components/help/Term";
import { useToast } from "@/components/feedback/ToastProvider";
import { getCapabilityMapForTower } from "@/data/capabilityMap/maps";
import type { L4WorkforceRow, TowerId } from "@/data/assess/types";
import { useTowerAssessOps } from "@/lib/assess/useTowerAssessOps";
import {
  definitionToViewModel,
  inferCapabilityViewFromRows,
} from "@/lib/assess/capabilityMapTree";
import { downloadSingleTowerSampleCsv } from "@/lib/assess/downloadAssessSamples";
import { getTowerHref } from "@/lib/towerHref";

type Props = { towerId: TowerId; towerName: string };

/**
 * Tower-scoped Capability Map page. Step 1 of the workshop:
 *
 *   1. Confirm the L1 to L4 capability tree.
 *   2. Confirm the workforce footprint (h/c, contractors, optional spend).
 *
 * The Assessment dials live on the sibling `/assessment/tower/[id]` route.
 * Both routes share state via `useTowerAssessOps` so a footprint loaded here
 * is immediately available to the dials, and the program-wide impact updates.
 */
export function CapabilityMapTowerClient({ towerId, towerName }: Props) {
  const toast = useToast();
  const ops = useTowerAssessOps(towerId, towerName);
  const { rows, tState, program, importOp, sampleLoadOp, patchRow } = ops;
  const fileRef = React.useRef<HTMLInputElement>(null);

  const def = getCapabilityMapForTower(towerId);
  const view =
    def != null
      ? definitionToViewModel(def, def.name)
      : rows.length
        ? inferCapabilityViewFromRows(towerName, rows)
        : { l1Name: towerName, l2: [] };

  const completedModules: ReadonlyArray<"capability-map"> = ops.isComplete
    ? ["capability-map"]
    : [];

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    void importOp.fire(f);
  };

  return (
    <PageShell>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Breadcrumbs
          items={[
            { label: "Program home", href: "/" },
            { label: "Capability Map", href: "/capability-map" },
            { label: towerName },
          ]}
        />

        <TowerJourneyStepper
          className="mt-3"
          towerId={towerId}
          towerName={towerName}
          current="capability-map"
          completed={completedModules}
        />

        <div className="mt-6">
          <h1 className="font-display text-2xl font-semibold text-forge-ink">
            &gt; {towerName} · Capability Map
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-forge-body">
            Confirm the in-scope <Term termKey="capability map">L1 to L4 capability tree</Term> and the workforce
            footprint that delivers it. The footprint feeds the{" "}
            <Link href={getTowerHref(towerId, "assessment")} className="text-accent-purple-dark underline">
              Assessment dials
            </Link>{" "}
            on the sibling page — set them once you&apos;re happy with the map.
          </p>
        </div>

        <div className="mt-5">
          <CapabilityScoreboard
            variant="tower"
            program={program}
            towerId={towerId}
            rows={rows}
          />
        </div>

        {view.l2.length > 0 ? (
          <div className="mt-6">
            <CapabilityMapPanel view={view} rows={rows} globalAssumptions={program.global} />
          </div>
        ) : null}

        {view.l2.length === 0 && rows.length === 0 ? (
          <p className="mt-6 rounded-xl border border-dashed border-forge-border bg-forge-well/40 p-4 text-sm text-forge-subtle">
            No <Term termKey="capability map">capability map</Term> is defined for this tower and no footprint is loaded yet. Load
            the sample workshop or upload a file to see L2 to L4 structure.
          </p>
        ) : null}

        {/* Footprint loader */}
        <section className="mt-6 rounded-2xl border border-dashed border-forge-border bg-forge-well/40 p-5">
          <h2 className="font-display text-base font-semibold text-forge-ink">
            Footprint file (optional refresh)
          </h2>
          <p className="mt-1 text-sm text-forge-subtle">
            One row per <Term termKey="l4">L4</Term>. Required: offshore-capable and onshore{" "}
            <Term termKey="fte">FTE</Term> / <Term termKey="contractor">contractor</Term> columns. Optional:
            annual_spend_usd. Dial inputs (offshore / AI assessment) live on the Assessment page.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href="/assess-tower-template.xlsx"
              className="inline-flex items-center gap-1.5 rounded-lg border border-forge-border bg-forge-surface px-2.5 py-1.5 text-xs text-forge-body"
              download
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-accent-purple" />
              Empty template (Excel)
            </a>
            <a
              href="/assess-tower-template.csv"
              className="inline-flex items-center gap-1.5 rounded-lg border border-forge-border bg-forge-surface px-2.5 py-1.5 text-xs text-forge-body"
              download
            >
              Empty template (CSV)
            </a>
            <button
              type="button"
              onClick={() => {
                try {
                  downloadSingleTowerSampleCsv(towerId, towerName);
                  toast.success({ title: `Sample CSV for ${towerName} downloaded` });
                } catch (e) {
                  toast.error({
                    title: "Couldn't download sample",
                    description: e instanceof Error ? e.message : undefined,
                  });
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-forge-border bg-forge-surface px-2.5 py-1.5 text-xs text-forge-body"
            >
              <Download className="h-3.5 w-3.5 text-accent-teal" />
              Download sample (CSV)
            </button>
            <button
              type="button"
              onClick={() => void sampleLoadOp.fire()}
              disabled={sampleLoadOp.state === "loading"}
              className="inline-flex items-center gap-1.5 rounded-lg border border-accent-teal/40 bg-accent-teal/10 px-2.5 py-1.5 text-xs font-medium text-accent-teal disabled:opacity-60"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {sampleLoadOp.state === "loading" ? "Loading..." : "Load sample workshop (this tower)"}
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={onFile}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={importOp.state === "loading"}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-forge-border bg-forge-surface px-4 py-2 text-sm text-forge-ink disabled:opacity-60"
          >
            <Upload className="h-4 w-4" />
            {importOp.state === "loading" ? "Importing..." : "Choose file"}
          </button>
          {importOp.data && importOp.data.warnings.length > 0 ? (
            <ul className="mt-3 max-h-32 list-inside list-disc overflow-y-auto text-xs text-accent-amber">
              {importOp.data.warnings.slice(0, 12).map((x) => (
                <li key={x.slice(0, 80)}>{x}</li>
              ))}
              {importOp.data.warnings.length > 12 ? <li>and more</li> : null}
            </ul>
          ) : null}
        </section>

        {rows.length > 0 ? (
          <FootprintTable rows={rows} onPatch={patchRow} />
        ) : null}

        {rows.length > 0 ? (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent-purple/30 bg-accent-purple/5 p-5">
            <div>
              <p className="font-display text-base font-semibold text-forge-ink">
                Footprint set — open the Assessment dials.
              </p>
              <p className="mt-1 text-sm text-forge-body">
                Step 2 of the workshop: dial offshore and AI per L4 against the {tState.l4Rows.length} rows you just confirmed.
              </p>
            </div>
            <Link
              href={getTowerHref(towerId, "assessment")}
              className="inline-flex items-center gap-2 rounded-lg bg-accent-purple px-4 py-2 text-sm font-semibold text-white hover:bg-accent-purple-dark"
            >
              Open Assessment
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : null}
      </div>
    </PageShell>
  );
}

function FootprintTable({
  rows,
  onPatch,
}: {
  rows: L4WorkforceRow[];
  onPatch: (id: string, patch: Partial<L4WorkforceRow>) => void;
}) {
  return (
    <div className="mt-6 overflow-x-auto rounded-2xl border border-forge-border">
      <table className="w-full min-w-[820px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-forge-border bg-forge-well/50 text-xs text-forge-subtle">
            <th className="px-3 py-2 font-medium">L2</th>
            <th className="px-3 py-2 font-medium">L3</th>
            <th className="px-3 py-2 font-medium">L4</th>
            <th className="px-3 py-2 font-medium" title="Full-time employees onshore (US)">
              FTE on
            </th>
            <th className="px-3 py-2 font-medium" title="Full-time employees offshore (non-US)">
              FTE off
            </th>
            <th className="px-3 py-2 font-medium" title="Contractors onshore">
              Contr on
            </th>
            <th className="px-3 py-2 font-medium" title="Contractors offshore">
              Contr off
            </th>
            <th className="px-3 py-2 font-medium" title="Annual spend in USD (optional)">
              Annual spend
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-forge-border/70">
              <td className="max-w-[120px] px-3 py-1.5 text-forge-subtle">{r.l2}</td>
              <td className="max-w-[120px] px-3 py-1.5 text-forge-subtle">{r.l3}</td>
              <td className="max-w-[220px] px-3 py-1.5 text-forge-ink">{r.l4}</td>
              {(["fteOnshore", "fteOffshore", "contractorOnshore", "contractorOffshore"] as const).map(
                (k) => (
                  <td key={k} className="px-1 py-1">
                    <input
                      className="w-16 rounded border border-forge-border bg-forge-page px-1 py-0.5 text-right font-mono text-xs"
                      type="number"
                      min={0}
                      step={1}
                      value={r[k]}
                      onChange={(e) => {
                        const n = Math.max(0, Math.floor(Number(e.target.value) || 0));
                        onPatch(r.id, { [k]: n } as Partial<L4WorkforceRow>);
                      }}
                    />
                  </td>
                ),
              )}
              <td className="px-1 py-1">
                <input
                  className="w-24 rounded border border-forge-border bg-forge-page px-1 py-0.5 text-right font-mono text-xs"
                  type="number"
                  min={0}
                  step={1000}
                  value={r.annualSpendUsd ?? ""}
                  placeholder="optional"
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") {
                      onPatch(r.id, { annualSpendUsd: undefined });
                      return;
                    }
                    const n = Math.max(0, Number(raw));
                    if (Number.isFinite(n)) onPatch(r.id, { annualSpendUsd: n });
                  }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
