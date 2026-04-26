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
import { useAssessSync } from "@/components/assess/AssessSyncProvider";
import { PageShell } from "@/components/PageShell";
import { CapabilityMapPanel } from "@/components/assess/CapabilityMapPanel";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { TowerJourneyStepper } from "@/components/layout/TowerJourneyStepper";
import { Term } from "@/components/help/Term";
import {
  TowerChecklist,
  type ChecklistKey,
} from "@/components/assess/TowerChecklist";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { useToast } from "@/components/feedback/ToastProvider";
import { useAsyncOp } from "@/lib/feedback/useAsyncOp";
import { getCapabilityMapForTower } from "@/data/capabilityMap/maps";
import type { L4WorkforceRow, TowerId } from "@/data/assess/types";
import { defaultTowerState } from "@/data/assess/types";
import { getTowerSeedState } from "@/data/assess/seedAssessProgram";
import {
  applyTowerStarterDefaults,
  countBlankL4Defaults,
} from "@/data/assess/seedAssessmentDefaults";
import { downloadSingleTowerSampleCsv } from "@/lib/assess/downloadAssessSamples";
import {
  definitionToViewModel,
  inferCapabilityViewFromRows,
} from "@/lib/assess/capabilityMapTree";
import { parseAssessFile } from "@/lib/assess/parseAssessFile";
import { weightedTowerLevers } from "@/lib/assess/scenarioModel";
import {
  getAssessProgram,
  setTowerAssess,
  setTowerScenario,
  subscribe,
} from "@/lib/localStore";

type Props = { towerId: TowerId; towerName: string };

type Step = 1 | 2;

function clampPct(n: number): number {
  return Math.min(100, Math.max(0, n));
}

export function AssessTowerClient({ towerId, towerName }: Props) {
  const sync = useAssessSync();
  const toast = useToast();
  const [step, setStep] = React.useState<Step>(1);
  const [program, setProgram] = React.useState(() => getAssessProgram());
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    return subscribe("assessProgram", () => setProgram(getAssessProgram()));
  }, []);

  // Flush save on unmount (covers Next.js client-side navigation; the
  // beforeunload handler in AssessSyncProvider covers full reloads).
  React.useEffect(() => {
    return () => {
      if (sync?.canSync) void sync.flushSave();
    };
  }, [sync]);

  const tState = program.towers[towerId] ?? { ...defaultTowerState() };
  const rows = tState.l4Rows;
  const global = program.global;
  const def = getCapabilityMapForTower(towerId);
  const view =
    def != null
      ? definitionToViewModel(def, def.name)
      : rows.length
        ? inferCapabilityViewFromRows(towerName, rows)
        : { l1Name: towerName, l2: [] };
  const weighted = rows.length
    ? weightedTowerLevers(rows, tState.baseline, global)
    : null;

  const isComplete = tState.status === "complete";
  const completedModules: ReadonlyArray<"capability-map"> = isComplete
    ? ["capability-map"]
    : [];

  const hasHeadcount = rows.some(
    (r) =>
      r.fteOnshore + r.fteOffshore + r.contractorOnshore + r.contractorOffshore > 0,
  );
  const hasAnyOffshoreInput = rows.some((r) => r.l4OffshoreAssessmentPct != null);
  const hasAnyAiInput = rows.some((r) => r.l4AiImpactAssessmentPct != null);

  const patchRow = (id: string, patch: Partial<L4WorkforceRow>) => {
    setTowerAssess(towerId, {
      l4Rows: rows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      status: tState.status === "empty" ? "data" : tState.status,
    });
  };

  // ---------- async ops with toast / busy state ----------------------------

  const importOp = useAsyncOp<{ rows: L4WorkforceRow[]; warnings: string[] }, [File]>({
    run: async (f) => {
      const res = await parseAssessFile(f);
      if (!res.rows.length) {
        throw new Error("No data rows parsed. Check the template columns.");
      }
      setTowerAssess(towerId, { l4Rows: res.rows, status: "data" });
      if (sync?.canSync) await sync.flushSave();
      return { rows: res.rows, warnings: res.errors };
    },
    messages: {
      loadingTitle: `Importing ${towerName} footprint`,
      loadingDescription: "Parsing rows and saving to the workshop...",
      successTitle: ({ rows: r }) =>
        `Imported ${r.length} row${r.length === 1 ? "" : "s"} for ${towerName}`,
      successDescription: ({ warnings }) =>
        warnings.length > 0
          ? `${warnings.length} warning${warnings.length === 1 ? "" : "s"} — review the parser output below.`
          : "Footprint loaded. Review the table and continue to step 2.",
      errorTitle: "Could not import footprint",
    },
  });

  const sampleLoadOp = useAsyncOp<{ rows: number }, []>({
    run: async () => {
      const state = getTowerSeedState(towerId);
      setTowerAssess(towerId, {
        l4Rows: state.l4Rows,
        baseline: state.baseline,
        status: state.status,
      });
      setTowerScenario(towerId, {
        scenarioOffshorePct: state.baseline.baselineOffshorePct,
        scenarioAIPct: state.baseline.baselineAIPct,
      });
      if (sync?.canSync) await sync.flushSave();
      return { rows: state.l4Rows.length };
    },
    messages: {
      loadingTitle: `Loading sample for ${towerName}`,
      successTitle: ({ rows: r }) =>
        `Loaded ${r} starter row${r === 1 ? "" : "s"} for ${towerName}`,
      successDescription:
        "Heuristic starter defaults applied. Review and override per L4 in step 2.",
      errorTitle: "Could not load sample",
    },
  });

  const blanks = React.useMemo(() => countBlankL4Defaults(rows), [rows]);

  const fillBlanksOp = useAsyncOp<{ changedRows: number; changedCells: number }, []>({
    run: async () => {
      if (!rows.length) throw new Error("Load a footprint first.");
      const result = applyTowerStarterDefaults(rows, towerId, "fillBlanks");
      if (result.changedCells === 0) {
        throw new Error("No blanks to fill — every row already has explicit values.");
      }
      const w = weightedTowerLevers(result.rows, tState.baseline, global);
      setTowerAssess(towerId, {
        l4Rows: result.rows,
        baseline: {
          baselineOffshorePct: Math.round(w.offshorePct),
          baselineAIPct: Math.round(w.aiPct),
        },
        status: tState.status === "empty" ? "data" : tState.status,
      });
      setTowerScenario(towerId, {
        scenarioOffshorePct: Math.round(w.offshorePct),
        scenarioAIPct: Math.round(w.aiPct),
      });
      if (sync?.canSync) await sync.flushSave();
      return result;
    },
    messages: {
      loadingTitle: "Filling blanks from heuristic defaults",
      successTitle: ({ changedCells, changedRows }) =>
        `Filled ${changedCells} cell${changedCells === 1 ? "" : "s"} across ${changedRows} row${changedRows === 1 ? "" : "s"}`,
      successDescription:
        "Heuristic defaults applied only where explicit values were missing.",
      errorTitle: "Couldn't apply defaults",
    },
  });

  const overwriteAllOp = useAsyncOp<{ changedRows: number; changedCells: number }, []>({
    run: async () => {
      if (!rows.length) throw new Error("Load a footprint first.");
      const result = applyTowerStarterDefaults(rows, towerId, "overwriteAll");
      const w = weightedTowerLevers(result.rows, tState.baseline, global);
      setTowerAssess(towerId, {
        l4Rows: result.rows,
        baseline: {
          baselineOffshorePct: Math.round(w.offshorePct),
          baselineAIPct: Math.round(w.aiPct),
        },
        status: tState.status === "empty" ? "data" : tState.status,
      });
      setTowerScenario(towerId, {
        scenarioOffshorePct: Math.round(w.offshorePct),
        scenarioAIPct: Math.round(w.aiPct),
      });
      if (sync?.canSync) await sync.flushSave();
      return result;
    },
    messages: {
      loadingTitle: "Re-applying starter defaults to every row",
      successTitle: ({ changedRows, changedCells }) =>
        `Re-seeded ${changedRows} row${changedRows === 1 ? "" : "s"} (${changedCells} cell${changedCells === 1 ? "" : "s"})`,
      successDescription: "All explicit overrides have been replaced.",
      errorTitle: "Couldn't re-apply defaults",
    },
  });

  // ---------- file input handler -----------------------------------------

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    void importOp.fire(f);
  };

  // ---------- checklist + Mark complete ----------------------------------

  const onConfirmStep = React.useCallback(
    (key: ChecklistKey) => {
      setTowerAssess(towerId, { [key]: new Date().toISOString() });
      const labels: Record<ChecklistKey, string> = {
        capabilityMapConfirmedAt: "Capability map",
        headcountConfirmedAt: "Headcount",
        offshoreConfirmedAt: "Offshore dials",
        aiConfirmedAt: "AI dials",
      };
      toast.success({
        title: `${labels[key]} marked reviewed`,
      });
    },
    [towerId, toast],
  );

  const [confirmCompleteOpen, setConfirmCompleteOpen] = React.useState(false);
  const [confirmUnmarkOpen, setConfirmUnmarkOpen] = React.useState(false);
  const [completeBusy, setCompleteBusy] = React.useState(false);

  const doMarkComplete = async () => {
    setCompleteBusy(true);
    try {
      if (!rows.length) {
        toast.error({ title: "Load a footprint first" });
        return;
      }
      const w = weightedTowerLevers(rows, tState.baseline, global);
      setTowerAssess(towerId, {
        baseline: {
          baselineOffshorePct: w.offshorePct,
          baselineAIPct: w.aiPct,
        },
        status: "complete",
      });
      setTowerScenario(towerId, { scenarioOffshorePct: w.offshorePct, scenarioAIPct: w.aiPct });
      if (sync?.canSync) await sync.flushSave();
      toast.success({
        title: `${towerName} marked complete`,
        description: "It now anchors the scenario summary. Open AI Initiatives next.",
        action: {
          label: "Open AI Initiatives",
          onClick: () => {
            window.location.href = `/tower/${towerId}`;
          },
        },
        durationMs: 8000,
      });
      setConfirmCompleteOpen(false);
    } finally {
      setCompleteBusy(false);
    }
  };

  const doUnmarkComplete = async () => {
    setCompleteBusy(true);
    try {
      setTowerAssess(towerId, { status: rows.length ? "data" : "empty" });
      if (sync?.canSync) await sync.flushSave();
      toast.info({
        title: `${towerName} unmarked`,
        description: "The tower is back to in-progress.",
      });
      setConfirmUnmarkOpen(false);
    } finally {
      setCompleteBusy(false);
    }
  };

  // ---------- render -------------------------------------------------------

  const [reseedDialogOpen, setReseedDialogOpen] = React.useState(false);

  return (
    <PageShell>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <Breadcrumbs
          items={[
            { label: "Program home", href: "/" },
            { label: "Capability Map", href: "/assess" },
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

        <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-forge-ink">
              &gt; {towerName}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-forge-body">
              Confirm the in-scope <Term termKey="capability map">capability map</Term> and
              workforce footprint (step 1), then set the{" "}
              <Term termKey="offshore dial">offshore dial</Term> and{" "}
              <Term termKey="ai impact dial">AI impact dial</Term> per{" "}
              <Term termKey="l4">L4</Term> activity (step 2). Review each section and mark the tower complete to anchor it in the scenario summary.
            </p>
          </div>
          <div
            className="flex items-center gap-0.5 rounded-lg border border-forge-border bg-forge-well/50 px-2 py-1.5 text-xs text-forge-subtle"
            aria-label="Workshop steps"
          >
            <StepDot n={1} current={step} onClick={() => setStep(1)} label="Map and footprint" />
            <span className="text-forge-hint/80">{">"}</span>
            <StepDot n={2} current={step} onClick={() => rows.length && setStep(2)} label="L4 levers" />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <span className={step === 1 ? "font-medium text-accent-purple" : "text-forge-subtle"}>
            1 — Map and FTEs
          </span>
          <span className="text-forge-hint">/</span>
          <span
            className={
              step === 2
                ? "font-medium text-accent-purple"
                : `text-forge-subtle${rows.length ? "" : " opacity-50"}`
            }
          >
            2 — Offshoring and AI (L4)
          </span>
        </div>

        {step === 1 ? (
          <div className="mt-6 space-y-6">
            {view.l2.length > 0 ? <CapabilityMapPanel view={view} rows={rows} /> : null}
            {view.l2.length === 0 && !rows.length ? (
              <p className="rounded-lg border border-dashed border-forge-border bg-forge-well/40 p-4 text-sm text-forge-subtle">
                No <Term termKey="capability map">capability map</Term> is defined for this tower and no footprint is loaded yet. Load
                the sample workshop or upload a file to see L2 to L4 structure.
              </p>
            ) : null}
            <div className="rounded-2xl border border-dashed border-forge-border bg-forge-well/40 p-5">
              <h2 className="font-display text-lg text-forge-ink">Footprint file (optional refresh)</h2>
              <p className="mt-1 text-sm text-forge-subtle">
                One row per <Term termKey="l4">L4</Term>. Required: offshore-capable and onshore{" "}
                <Term termKey="fte">FTE</Term>/<Term termKey="contractor">contractor</Term>{" "}
                columns. Optional: annual_spend_usd, l4_offshoring_assessment, l4_ai_impact_assessment (0 to 100), typically filled after the workshop in step 2.
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
                  onClick={() => downloadSingleTowerSampleCsv(towerId, towerName)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-forge-border bg-forge-surface px-2.5 py-1.5 text-xs text-forge-body"
                >
                  <Download className="h-3.5 w-3.5 text-accent-teal" />
                  Download sample (CSV)
                </button>
                <button
                  type="button"
                  onClick={() => void sampleLoadOp.fire()}
                  disabled={sampleLoadOp.state === "loading"}
                  className="inline-flex items-center gap-1.5 rounded border border-accent-teal/40 bg-accent-teal/10 px-2.5 py-1.5 text-xs font-medium text-accent-teal disabled:opacity-60"
                >
                  {sampleLoadOp.state === "loading"
                    ? "Loading..."
                    : "Load sample workshop (this tower)"}
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
            </div>
            {rows.length > 0 && (
              <div className="overflow-x-auto rounded-2xl border border-forge-border">
                <table className="w-full min-w-[800px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-forge-border bg-forge-well/50 text-xs text-forge-subtle">
                      <th className="px-3 py-2 font-medium" title="Level 2 capability (function group)">L2</th>
                      <th className="px-3 py-2 font-medium" title="Level 3 capability (sub-function)">L3</th>
                      <th className="px-3 py-2 font-medium" title="Level 4 activity (assessed unit)">L4</th>
                      <th className="px-3 py-2 font-medium" title="Full-time employees onshore (US)">FTE onshore</th>
                      <th className="px-3 py-2 font-medium" title="Full-time employees offshore (non-US)">FTE offshore</th>
                      <th className="px-3 py-2 font-medium" title="Contractors onshore">Contractor onshore</th>
                      <th className="px-3 py-2 font-medium" title="Contractors offshore">Contractor offshore</th>
                      <th className="px-3 py-2 font-medium" title="Annual spend in USD (optional)">Annual spend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="border-b border-forge-border/70">
                        <td className="max-w-[120px] px-3 py-1.5 text-forge-subtle">{r.l2}</td>
                        <td className="max-w-[120px] px-3 py-1.5 text-forge-subtle">{r.l3}</td>
                        <td className="max-w-[200px] px-3 py-1.5 text-forge-ink">{r.l4}</td>
                        {(
                          [
                            "fteOnshore",
                            "fteOffshore",
                            "contractorOnshore",
                            "contractorOffshore",
                          ] as const
                        ).map((k) => (
                          <td key={k} className="px-1 py-1">
                            <input
                              className="w-16 rounded border border-forge-border bg-forge-page px-1 py-0.5 text-right font-mono text-xs"
                              type="number"
                              min={0}
                              step={1}
                              value={r[k]}
                              onChange={(e) => {
                                const n = Math.max(0, Math.floor(Number(e.target.value) || 0));
                                patchRow(r.id, { [k]: n } as Partial<L4WorkforceRow>);
                              }}
                            />
                          </td>
                        ))}
                        <td className="px-1 py-1">
                          <input
                            className="w-24 rounded border border-forge-border bg-forge-page px-1 py-0.5 text-right font-mono text-xs"
                            type="number"
                            min={0}
                            step={1000}
                            value={r.annualSpendUsd ?? ""}
                            onChange={(e) => {
                              const raw = e.target.value;
                              if (raw === "") {
                                patchRow(r.id, { annualSpendUsd: undefined });
                                return;
                              }
                              const n = Math.max(0, Number(raw));
                              if (Number.isFinite(n)) {
                                patchRow(r.id, { annualSpendUsd: n });
                              }
                            }}
                            placeholder="optional"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {rows.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="rounded-lg bg-accent-purple px-4 py-2 text-sm font-medium text-white hover:bg-accent-purple-dark"
                >
                  Continue to step 2
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {rows.length === 0 ? (
              <p className="text-sm text-accent-amber">Add a footprint in step 1 first.</p>
            ) : (
              <>
                <h2 className="font-display text-lg text-forge-ink">L4 offshoring and AI impact</h2>
                <p className="text-sm text-forge-subtle">
                  0 to 100 for each <Term termKey="l4">L4</Term>. Leave blank to use the tower{" "}
                  <Term termKey="baseline">baseline</Term> (
                  {tState.baseline.baselineOffshorePct}% offshore / {tState.baseline.baselineAIPct}% AI) in roll-ups
                  until you set an explicit L4 value.
                </p>
                <p className="text-xs text-forge-hint">
                  Adjust global blended $ on the{" "}
                  <Link className="text-forge-body underline" href="/assess/summary">
                    scenario summary
                  </Link>{" "}
                  to change pool math across all towers.
                </p>
                {weighted && (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border border-forge-border bg-forge-well/40 px-3 py-2 text-xs">
                    <span className="text-forge-subtle">Cost-weighted L4 preview:</span>
                    <span className="text-forge-body">
                      offshore{" "}
                      <span className="font-mono text-forge-ink">
                        {weighted.offshorePct.toFixed(1)}
                      </span>
                      %
                    </span>
                    <span className="text-forge-body">
                      AI{" "}
                      <span className="font-mono text-forge-ink">
                        {weighted.aiPct.toFixed(1)}
                      </span>
                      %
                    </span>
                    <DefaultsChips rows={rows} />
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-accent-purple/20 bg-accent-purple/5 px-3 py-2 text-xs">
                  <Sparkles className="h-3.5 w-3.5 text-accent-purple" aria-hidden />
                  <span className="text-forge-body">
                    Starter defaults from the Versant heuristic (complexity, US
                    requirement, AI feasibility):
                  </span>
                  {blanks.totalBlanks > 0 ? (
                    <button
                      type="button"
                      onClick={() => void fillBlanksOp.fire()}
                      disabled={fillBlanksOp.state === "loading"}
                      className="inline-flex items-center gap-1 rounded-md bg-accent-purple px-2.5 py-1 text-xs font-medium text-white hover:bg-accent-purple-dark disabled:opacity-60"
                    >
                      {fillBlanksOp.state === "loading"
                        ? "Filling..."
                        : `Fill ${blanks.totalBlanks} blank${blanks.totalBlanks === 1 ? "" : "s"}`}
                    </button>
                  ) : (
                    <span className="text-forge-hint">
                      No blanks — every row has an explicit value
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setReseedDialogOpen(true)}
                    disabled={overwriteAllOp.state === "loading"}
                    className="rounded-md border border-forge-border px-2.5 py-1 text-xs text-forge-body hover:border-accent-purple/30 disabled:opacity-60"
                    title="Replace every row's offshore% and AI% with the starter heuristic"
                  >
                    {overwriteAllOp.state === "loading"
                      ? "Re-applying..."
                      : "Re-apply to all rows..."}
                  </button>
                </div>
                <div className="max-h-[min(70vh,800px)] overflow-y-auto overflow-x-auto rounded-2xl border border-forge-border">
                  <table className="w-full min-w-[800px] border-collapse text-left text-sm">
                    <thead className="sticky top-0 z-10 border-b border-forge-border bg-forge-well/80 backdrop-blur">
                      <tr className="text-xs text-forge-subtle">
                        <th className="px-2 py-2 pl-3">L2</th>
                        <th className="px-2 py-2">L3</th>
                        <th className="px-2 py-2">L4</th>
                        <th className="px-2 py-2">Offshoring (0 to 100)</th>
                        <th className="px-2 py-2 pr-3">AI impact (0 to 100)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.id} className="border-b border-forge-border/60">
                          <td className="max-w-[120px] px-2 py-1.5 pl-3 text-xs text-forge-subtle">{r.l2}</td>
                          <td className="max-w-[120px] px-2 py-1.5 text-xs text-forge-subtle">{r.l3}</td>
                          <td className="px-2 py-1.5 text-forge-ink">{r.l4}</td>
                          <td className="px-2 py-1">
                            <input
                              className="w-20 rounded border border-forge-border bg-forge-page px-1.5 py-1 text-right font-mono text-sm"
                              type="number"
                              min={0}
                              max={100}
                              value={
                                r.l4OffshoreAssessmentPct == null
                                  ? ""
                                  : r.l4OffshoreAssessmentPct
                              }
                              placeholder={String(tState.baseline.baselineOffshorePct)}
                              onChange={(e) => {
                                const t = e.target.value.trim();
                                if (t === "") {
                                  patchRow(r.id, { l4OffshoreAssessmentPct: undefined });
                                  return;
                                }
                                const n = clampPct(Number(t));
                                if (Number.isFinite(n)) {
                                  patchRow(r.id, { l4OffshoreAssessmentPct: n });
                                }
                              }}
                            />
                          </td>
                          <td className="px-2 py-1 pr-3">
                            <input
                              className="w-20 rounded border border-forge-border bg-forge-page px-1.5 py-1 text-right font-mono text-sm"
                              type="number"
                              min={0}
                              max={100}
                              value={
                                r.l4AiImpactAssessmentPct == null
                                  ? ""
                                  : r.l4AiImpactAssessmentPct
                              }
                              placeholder={String(tState.baseline.baselineAIPct)}
                              onChange={(e) => {
                                const t = e.target.value.trim();
                                if (t === "") {
                                  patchRow(r.id, { l4AiImpactAssessmentPct: undefined });
                                  return;
                                }
                                const n = clampPct(Number(t));
                                if (Number.isFinite(n)) {
                                  patchRow(r.id, { l4AiImpactAssessmentPct: n });
                                }
                              }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {weighted && (
                  <p className="text-sm text-forge-body">
                    Cost-weighted roll-up: off{" "}
                    <span className="font-mono">{weighted.offshorePct.toFixed(1)}</span>%, AI{" "}
                    <span className="font-mono">{weighted.aiPct.toFixed(1)}</span>%
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="rounded-lg border border-forge-border px-4 py-2 text-sm"
                  >
                    Back to map and FTEs
                  </button>
                  <Link
                    href="/assess/summary"
                    className="inline-flex items-center gap-1 rounded-lg border border-accent-teal/50 px-4 py-2 text-sm text-accent-teal"
                  >
                    Open scenario summary
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </>
            )}
          </div>
        )}

        {/* Tower readiness checklist — works at any step. */}
        <div className="mt-10">
          <TowerChecklist
            state={tState}
            hasRows={rows.length > 0}
            hasHeadcount={hasHeadcount}
            hasAnyOffshoreInput={hasAnyOffshoreInput}
            hasAnyAiInput={hasAnyAiInput}
            isComplete={isComplete}
            onConfirm={onConfirmStep}
            onMarkComplete={() => setConfirmCompleteOpen(true)}
            onUnmarkComplete={() => setConfirmUnmarkOpen(true)}
          />
        </div>

        {/* Cross-module handoff CTA — only after Mark complete. */}
        {isComplete ? (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent-purple/30 bg-accent-purple/5 p-5">
            <div>
              <p className="font-display text-base font-semibold text-forge-ink">
                Tower complete — open the AI agenda next.
              </p>
              <p className="mt-1 text-sm text-forge-body">
                See the sequenced AI initiatives, agent architectures, and 4-lens detail for {towerName}.
              </p>
            </div>
            <Link
              href={`/tower/${towerId}`}
              className="inline-flex items-center gap-2 rounded-lg bg-accent-purple px-4 py-2 text-sm font-semibold text-white hover:bg-accent-purple-dark"
            >
              Open in AI Initiatives
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <p className="mt-8 text-xs text-forge-hint">
            <Link href={`/tower/${towerId}`} className="text-forge-body underline">
              Open {towerName} in AI Initiatives
            </Link>
            {" — "}
            (the handoff CTA appears once this tower is marked complete).
          </p>
        )}
      </div>

      {/* High-impact confirmation dialogs */}
      <ConfirmDialog
        open={reseedDialogOpen}
        onClose={() => setReseedDialogOpen(false)}
        onConfirm={async () => {
          setReseedDialogOpen(false);
          await overwriteAllOp.fire();
        }}
        title={`Re-apply starter defaults to every row in ${towerName}?`}
        description={
          <>
            Every L4&apos;s offshore% and AI% will be replaced with the heuristic
            starter values for this tower. Explicit overrides will be lost.
          </>
        }
        confirmLabel="Yes, replace"
        cancelLabel="Cancel"
        variant="destructive"
      />

      <ConfirmDialog
        open={confirmCompleteOpen}
        onClose={() => setConfirmCompleteOpen(false)}
        onConfirm={() => doMarkComplete()}
        title={`Mark ${towerName} complete?`}
        description={
          <>
            We&apos;ll lock the baseline at the current cost-weighted roll-up and
            anchor this tower in the scenario summary. You can unmark anytime.
          </>
        }
        confirmLabel="Mark complete"
        variant="lock"
        busy={completeBusy}
      />

      <ConfirmDialog
        open={confirmUnmarkOpen}
        onClose={() => setConfirmUnmarkOpen(false)}
        onConfirm={() => doUnmarkComplete()}
        title={`Unmark ${towerName} as complete?`}
        description={
          <>
            The tower returns to in-progress. Your data and all explicit reviews are kept.
          </>
        }
        confirmLabel="Unmark"
        variant="default"
        busy={completeBusy}
      />
    </PageShell>
  );
}

function DefaultsChips({ rows }: { rows: L4WorkforceRow[] }) {
  const total = rows.length;
  if (total === 0) return null;
  const offDefault = rows.filter((r) => r.l4OffshoreAssessmentPct == null).length;
  const aiDefault = rows.filter((r) => r.l4AiImpactAssessmentPct == null).length;
  return (
    <>
      <span
        className={
          "rounded-full px-2 py-0.5 font-mono text-[10px] " +
          (offDefault === 0
            ? "bg-accent-green/10 text-accent-green"
            : "bg-accent-amber/10 text-accent-amber")
        }
        title="Number of L4 rows using the tower default for offshoring"
      >
        {offDefault}/{total} offshore default
      </span>
      <span
        className={
          "rounded-full px-2 py-0.5 font-mono text-[10px] " +
          (aiDefault === 0
            ? "bg-accent-green/10 text-accent-green"
            : "bg-accent-amber/10 text-accent-amber")
        }
        title="Number of L4 rows using the tower default for AI impact"
      >
        {aiDefault}/{total} AI default
      </span>
    </>
  );
}

function StepDot({
  n,
  current,
  onClick,
  label,
}: {
  n: 1 | 2;
  current: Step;
  onClick: () => void;
  label: string;
}) {
  const on = n === current;
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className="flex flex-col items-center gap-0.5"
    >
      <span
        className={
          "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-mono " +
          (on
            ? "bg-accent-purple text-white ring-1 ring-accent-purple/40"
            : "border border-forge-border text-forge-subtle hover:border-accent-purple/50")
        }
      >
        {n}
      </span>
      <span className="hidden w-16 text-center text-[9px] leading-tight sm:block">
        {n === 1 ? "Map" : "L4"}
      </span>
    </button>
  );
}
