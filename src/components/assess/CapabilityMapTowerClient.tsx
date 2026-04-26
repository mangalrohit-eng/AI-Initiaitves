"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Info,
  Sparkles,
  Upload,
} from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { CapabilityMapPanel } from "@/components/assess/CapabilityMapPanel";
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
import { cn } from "@/lib/utils";

type Props = { towerId: TowerId; towerName: string };

/**
 * Tower-scoped Capability Map page. Step 1 of the workflow:
 *
 *   1. Confirm the L1 to L4 capability tree.
 *   2. Confirm the headcount behind it (FTE, contractors, optional spend).
 *
 * The Impact-Levers dials live on the sibling `/impact-levers/tower/[id]` route.
 * Both routes share state via `useTowerAssessOps` so the capability map &
 * headcount loaded here is immediately available to the dials, and the
 * program-wide impact updates.
 */
export function CapabilityMapTowerClient({ towerId, towerName }: Props) {
  const toast = useToast();
  const ops = useTowerAssessOps(towerId, towerName);
  const { rows, tState, importOp, sampleLoadOp, patchRow } = ops;
  const fileRef = React.useRef<HTMLInputElement>(null);

  // Source-of-truth precedence: uploaded rows always win. The predefined
  // capability map (`src/data/capabilityMap/*.ts`) is a seed used by the
  // "Load sample" button and as a Preview when no rows exist yet — it never
  // overlays user data once anything has been uploaded.
  const def = getCapabilityMapForTower(towerId);
  const isPreview = rows.length === 0 && def != null;
  const view =
    rows.length > 0
      ? inferCapabilityViewFromRows(towerName, rows)
      : def != null
        ? definitionToViewModel(def, def.name)
        : { l1Name: towerName, l2: [] };

  // Capability-map step counts as "complete" the moment the tower lead has
  // uploaded a real capability map & headcount (i.e. they replaced the seed
  // map). The dials step still requires explicit Mark-complete on the
  // Configure Impact Levers page.
  const isCapabilityMapAuthored = tState.capabilityMapConfirmedAt != null;
  const completedModules: ReadonlyArray<"capability-map"> =
    isCapabilityMapAuthored || ops.isComplete ? ["capability-map"] : [];

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    void importOp.fire(f);
  };

  const onTemplateDownload = React.useCallback(() => {
    try {
      downloadSingleTowerSampleCsv(towerId, towerName);
      toast.success({ title: `Sample CSV for ${towerName} downloaded` });
    } catch (e) {
      toast.error({
        title: "Couldn't download sample",
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }, [toast, towerId, towerName]);

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

        <div className="mt-6 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h1 className="font-display text-2xl font-semibold text-forge-ink">
            &gt; {towerName} · Capability Map
          </h1>
          <p className="text-xs text-forge-subtle">
            Step 1 — confirm the <Term termKey="capability map">L1–L4 tree</Term> and headcount, then open{" "}
            <Link href={getTowerHref(towerId, "impact-levers")} className="text-accent-purple-dark underline">
              Configure Impact Levers
            </Link>
            .
          </p>
        </div>

        {/* Above-the-fold CTA: upload capability map + headcount in one file. */}
        <CapabilityMapCta
          rowsCount={rows.length}
          lastUpdated={tState.lastUpdated}
          uploading={importOp.state === "loading"}
          loadingSample={sampleLoadOp.state === "loading"}
          onPickFile={() => fileRef.current?.click()}
          onLoadSample={() => void sampleLoadOp.fire()}
          onDownloadSample={onTemplateDownload}
        />

        {/* Hidden file input shared by both empty + loaded CTA states. */}
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={onFile}
        />

        {importOp.data && importOp.data.warnings.length > 0 ? (
          <ul className="mt-3 list-inside list-disc rounded-lg border border-accent-amber/30 bg-accent-amber/5 p-3 text-xs text-accent-amber">
            {importOp.data.warnings.slice(0, 12).map((x) => (
              <li key={x.slice(0, 80)}>{x}</li>
            ))}
            {importOp.data.warnings.length > 12 ? <li>and more</li> : null}
          </ul>
        ) : null}

        {view.l2.length > 0 ? (
          <div className="mt-6 space-y-3">
            <MapSourceBanner
              isPreview={isPreview}
              authoredAt={tState.capabilityMapConfirmedAt}
              rowsCount={rows.length}
            />
            <CapabilityMapPanel view={view} rows={rows} isPreview={isPreview} />
          </div>
        ) : null}

        {view.l2.length === 0 && rows.length === 0 ? (
          <p className="mt-6 rounded-xl border border-dashed border-forge-border bg-forge-well/40 p-4 text-sm text-forge-subtle">
            No <Term termKey="capability map">capability map</Term> is defined for this tower and no headcount is loaded yet. Use the
            CTA above to upload your file or load the sample.
          </p>
        ) : null}

        {rows.length > 0 ? (
          <details className="group mt-4 rounded-2xl border border-forge-border bg-forge-surface/40 open:bg-forge-surface/60">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-2.5 text-sm font-medium text-forge-body">
              <span>
                Edit headcount values
                <span className="ml-2 font-mono text-[11px] text-forge-hint">
                  {rows.length} row{rows.length === 1 ? "" : "s"}
                </span>
              </span>
              <span className="text-forge-subtle transition-transform group-open:rotate-90" aria-hidden>
                ›
              </span>
            </summary>
            <HeadcountTable rows={rows} onPatch={patchRow} />
          </details>
        ) : null}

        {rows.length > 0 ? (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent-purple/30 bg-accent-purple/5 p-5">
            <div>
              <p className="font-display text-base font-semibold text-forge-ink">
                Capability map &amp; headcount set — configure your impact levers.
              </p>
              <p className="mt-1 text-sm text-forge-body">
                Step 2: dial offshore and AI per L4 against the {tState.l4Rows.length} rows you just confirmed.
              </p>
            </div>
            <Link
              href={getTowerHref(towerId, "impact-levers")}
              className="inline-flex items-center gap-2 rounded-lg bg-accent-purple px-4 py-2 text-sm font-semibold text-white hover:bg-accent-purple-dark"
            >
              Configure Impact Levers
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : null}
      </div>
    </PageShell>
  );
}

function MapSourceBanner({
  isPreview,
  authoredAt,
  rowsCount,
}: {
  isPreview: boolean;
  authoredAt?: string;
  rowsCount: number;
}) {
  if (isPreview) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-accent-amber/35 bg-accent-amber/8 px-3 py-1.5">
        <span className="inline-flex items-center gap-2 text-xs font-medium text-accent-amber">
          <Info className="h-3.5 w-3.5" aria-hidden />
          Default seed map · awaiting tower lead upload
        </span>
        <span className="text-[11px] text-forge-subtle">
          Step 1 stays open until you upload your tower&rsquo;s capability map &amp; headcount.
        </span>
      </div>
    );
  }
  if (authoredAt) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-accent-green/35 bg-accent-green/8 px-3 py-1.5">
        <span className="inline-flex items-center gap-2 text-xs font-medium text-accent-green">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
          Tower lead upload · {rowsCount} L4 row{rowsCount === 1 ? "" : "s"}
        </span>
        <span className="text-[11px] text-forge-subtle">
          Confirmed {formatRelative(authoredAt)} · drives the impact-lever dials &amp; impact estimate downstream.
        </span>
      </div>
    );
  }
  // Rows present but loaded from "Load sample" — seed data, not authored.
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-forge-border bg-forge-well/40 px-3 py-1.5">
      <span className="inline-flex items-center gap-2 text-xs font-medium text-forge-body">
        <Info className="h-3.5 w-3.5 text-accent-purple-dark" aria-hidden />
        Sample seed loaded · {rowsCount} L4 row{rowsCount === 1 ? "" : "s"}
      </span>
      <span className="text-[11px] text-forge-subtle">
        Upload your capability map &amp; headcount to confirm the tower lead version.
      </span>
    </div>
  );
}

function CapabilityMapCta({
  rowsCount,
  lastUpdated,
  uploading,
  loadingSample,
  onPickFile,
  onLoadSample,
  onDownloadSample,
}: {
  rowsCount: number;
  lastUpdated?: string;
  uploading: boolean;
  loadingSample: boolean;
  onPickFile: () => void;
  onLoadSample: () => void;
  onDownloadSample: () => void;
}) {
  const isEmpty = rowsCount === 0;

  if (isEmpty) {
    return (
      <section
        data-capability-cta="empty"
        className="mt-6 rounded-2xl border border-accent-purple/35 bg-gradient-to-br from-accent-purple/12 via-accent-purple/5 to-transparent p-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg font-semibold text-forge-ink">
              Upload your tower&rsquo;s capability map &amp; headcount
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-forge-body">
              One row per <Term termKey="l4">L4</Term> with onshore / offshore <Term termKey="fte">FTE</Term> &amp;{" "}
              <Term termKey="contractor">contractors</Term>. We infer the L1–L4 tree and headcount in one pass — no separate uploads.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onPickFile}
              disabled={uploading}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg bg-accent-purple px-4 py-2 text-sm font-semibold text-white transition",
                "hover:bg-accent-purple-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-purple/50",
                "disabled:opacity-60",
              )}
            >
              <Upload className="h-4 w-4" aria-hidden />
              {uploading ? "Uploading..." : "Upload .csv / .xlsx"}
            </button>
            <button
              type="button"
              onClick={onLoadSample}
              disabled={loadingSample}
              className="inline-flex items-center gap-2 rounded-lg border border-accent-teal/40 bg-accent-teal/10 px-4 py-2 text-sm font-medium text-accent-teal transition hover:border-accent-teal/60 disabled:opacity-60"
            >
              <Sparkles className="h-4 w-4" aria-hidden />
              {loadingSample ? "Loading..." : "Load sample"}
            </button>
          </div>
        </div>

        <details className="group mt-3">
          <summary className="cursor-pointer list-none text-[11px] text-forge-hint hover:text-forge-subtle">
            <span className="inline-flex items-center gap-1">
              <span className="transition-transform group-open:rotate-90" aria-hidden>
                ›
              </span>
              Templates &amp; sample downloads
            </span>
          </summary>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <a
              href="/assess-tower-template.xlsx"
              className="inline-flex items-center gap-1.5 rounded-md border border-forge-border bg-forge-surface px-2 py-1 text-[11px] text-forge-body hover:border-accent-purple/30"
              download
            >
              <FileSpreadsheet className="h-3 w-3 text-accent-purple" />
              Empty template (Excel)
            </a>
            <a
              href="/assess-tower-template.csv"
              className="inline-flex items-center gap-1.5 rounded-md border border-forge-border bg-forge-surface px-2 py-1 text-[11px] text-forge-body hover:border-accent-purple/30"
              download
            >
              Empty template (CSV)
            </a>
            <button
              type="button"
              onClick={onDownloadSample}
              className="inline-flex items-center gap-1.5 rounded-md border border-forge-border bg-forge-surface px-2 py-1 text-[11px] text-forge-body hover:border-accent-purple/30"
            >
              <Download className="h-3 w-3 text-accent-teal" />
              Sample for this tower (CSV)
            </button>
          </div>
        </details>
      </section>
    );
  }

  // Loaded state — slim toolbar with replace / reload / templates.
  return (
    <section
      data-capability-cta="loaded"
      className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-forge-border bg-forge-surface/70 px-4 py-2.5"
    >
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-display text-sm font-semibold text-forge-ink">
          Capability map &amp; headcount loaded
        </span>
        <span className="font-mono text-[11px] tabular-nums text-forge-hint">
          {rowsCount} row{rowsCount === 1 ? "" : "s"}
          {lastUpdated ? ` · updated ${formatRelative(lastUpdated)}` : ""}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={onPickFile}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 rounded-md border border-accent-purple/35 bg-accent-purple/10 px-2.5 py-1.5 text-xs font-medium text-accent-purple-dark transition hover:border-accent-purple/55 disabled:opacity-60"
        >
          <Upload className="h-3.5 w-3.5" aria-hidden />
          {uploading ? "Uploading..." : "Update map & headcount"}
        </button>
        <button
          type="button"
          onClick={onLoadSample}
          disabled={loadingSample}
          className="inline-flex items-center gap-1.5 rounded-md border border-accent-teal/35 bg-accent-teal/10 px-2.5 py-1.5 text-xs font-medium text-accent-teal transition hover:border-accent-teal/55 disabled:opacity-60"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          {loadingSample ? "Loading..." : "Reload sample"}
        </button>
        <details className="group relative">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-md border border-forge-border bg-forge-surface px-2 py-1.5 text-[11px] text-forge-body hover:border-accent-purple/30">
            Templates
            <span className="transition-transform group-open:rotate-90" aria-hidden>
              ›
            </span>
          </summary>
          <div className="absolute right-0 z-10 mt-1 flex w-56 flex-col gap-1 rounded-md border border-forge-border bg-forge-surface p-2 shadow-card">
            <a
              href="/assess-tower-template.xlsx"
              className="inline-flex items-center gap-1.5 rounded px-1.5 py-1 text-[11px] text-forge-body hover:bg-forge-well/60"
              download
            >
              <FileSpreadsheet className="h-3 w-3 text-accent-purple" />
              Empty template (Excel)
            </a>
            <a
              href="/assess-tower-template.csv"
              className="inline-flex items-center gap-1.5 rounded px-1.5 py-1 text-[11px] text-forge-body hover:bg-forge-well/60"
              download
            >
              Empty template (CSV)
            </a>
            <button
              type="button"
              onClick={onDownloadSample}
              className="inline-flex items-center gap-1.5 rounded px-1.5 py-1 text-left text-[11px] text-forge-body hover:bg-forge-well/60"
            >
              <Download className="h-3 w-3 text-accent-teal" />
              Sample for this tower (CSV)
            </button>
          </div>
        </details>
      </div>
    </section>
  );
}

function formatRelative(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const diff = Date.now() - t;
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.round(hr / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(t).toLocaleDateString();
}

function HeadcountTable({
  rows,
  onPatch,
}: {
  rows: L4WorkforceRow[];
  onPatch: (id: string, patch: Partial<L4WorkforceRow>) => void;
}) {
  return (
    <div className="overflow-x-auto border-t border-forge-border">
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
