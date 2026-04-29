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
  Wand2,
} from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { CapabilityMapPanel } from "@/components/assess/CapabilityMapPanel";
import { StaleL4Banner } from "@/components/assess/StaleL4Banner";
import { ScreenGuidanceBar } from "@/components/guidance/ScreenGuidanceBar";
import { useGuidanceCapabilityMap } from "@/lib/guidance/useJourneyGuidance";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { TowerJourneyStepper } from "@/components/layout/TowerJourneyStepper";
import { Term } from "@/components/help/Term";
import { useToast } from "@/components/feedback/ToastProvider";
import { getCapabilityMapForTower } from "@/data/capabilityMap/maps";
import type { L3WorkforceRow, TowerId } from "@/data/assess/types";
import { useTowerAssessOps } from "@/lib/assess/useTowerAssessOps";
import {
  definitionToViewModel,
  inferCapabilityViewFromRows,
} from "@/lib/assess/capabilityMapTree";
import {
  downloadBlob,
  downloadSingleTowerSampleCsv,
} from "@/lib/assess/downloadAssessSamples";
import { serializeAssessProgramForDownload } from "@/lib/assess/assessProgramIO";
import { clientGenerateL4Activities } from "@/lib/assess/assessClientApi";
import { useAsyncOp } from "@/lib/feedback/useAsyncOp";
import { useAssessSync } from "@/components/assess/AssessSyncProvider";
import { getAssessProgram, setTowerAssess } from "@/lib/localStore";
import { getTowerHref } from "@/lib/towerHref";
import {
  isL1L3TreeLocked,
  isCapabilityMapJourneyStepDone,
} from "@/lib/assess/capabilityMapStepStatus";
import { TowerDataExports } from "@/components/assess/TowerDataExports";
import { towers } from "@/data/towers";
import { cn } from "@/lib/utils";
import {
  ReplaceUploadConfirmDialog,
  type ReplaceUploadBusyState,
} from "@/components/feedback/ReplaceUploadConfirmDialog";
import {
  ReloadSampleConfirmDialog,
  type ReloadSampleBusyState,
} from "@/components/feedback/ReloadSampleConfirmDialog";

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
  const sync = useAssessSync();
  const ops = useTowerAssessOps(towerId, towerName);
  const {
    rows,
    tState,
    importOp,
    sampleLoadOp,
    patchRow,
    markL1L3TreeValidated,
    clearL1L3TreeValidation,
  } = ops;
  const fileRef = React.useRef<HTMLInputElement>(null);
  const mapStepLocked = isL1L3TreeLocked(tState);

  // Count L3 capabilities that don't yet have any L4 activities. The Generate
  // L4 button only acts on those (so canonical seeds with activities aren't
  // overwritten unless the user explicitly chooses regenerate-all).
  const blankL4Count = rows.filter(
    (r) => !r.l4Activities || r.l4Activities.length === 0,
  ).length;

  type GenerateL4Outcome = {
    changedRows: number;
    totalRows: number;
    source: "llm" | "fallback";
    warning?: string;
  };

  const runGenerateL4 = React.useCallback(
    async (mode: "fillBlanks" | "regenerateAll"): Promise<GenerateL4Outcome> => {
      if (!rows.length) throw new Error("Load a capability map & headcount first.");
      const curCheck = getAssessProgram().towers[towerId];
      if (isL1L3TreeLocked(curCheck)) {
        throw new Error("Unlock the capability map in the action bar to change L4 activities.");
      }
      const targetRows =
        mode === "fillBlanks"
          ? rows.filter((r) => !r.l4Activities || r.l4Activities.length === 0)
          : rows;
      if (targetRows.length === 0) {
        throw new Error("Every L3 already has activities — nothing to generate.");
      }
      const apiInputs = targetRows.map((r) => ({ l2: r.l2, l3: r.l3 }));
      const res = await clientGenerateL4Activities(towerId, apiInputs);
      if (!res.ok) {
        throw new Error(`L4 generation failed (${res.error})`);
      }
      const groupByKey = new Map<string, string[]>();
      for (const g of res.result.groups) {
        const key = `${g.l2}\u0000${g.l3}`;
        groupByKey.set(key, g.activities ?? []);
      }
      const cur = getAssessProgram().towers[towerId];
      if (!cur) throw new Error("Tower state missing — reload the page.");
      let changedRows = 0;
      const nextRows = cur.l3Rows.map((r) => {
        const key = `${r.l2}\u0000${r.l3}`;
        const generated = groupByKey.get(key);
        if (!generated || generated.length === 0) return r;
        if (mode === "fillBlanks" && r.l4Activities && r.l4Activities.length > 0) {
          return r;
        }
        changedRows += 1;
        return { ...r, l4Activities: generated };
      });
      setTowerAssess(towerId, { l3Rows: nextRows });
      if (sync?.canSync) await sync.flushSave();
      return {
        changedRows,
        totalRows: targetRows.length,
        source: res.result.source,
        warning: res.result.warning,
      };
    },
    [rows, sync, towerId],
  );

  const sourceLabel = (s: "llm" | "fallback") =>
    s === "llm" ? "AI generation" : "canonical-map fallback";

  const generateBlanksOp = useAsyncOp<GenerateL4Outcome, []>({
    run: () => runGenerateL4("fillBlanks"),
    messages: {
      loadingTitle: "Generating L4 activities...",
      loadingDescription:
        "Trying AI generation, falling back to canonical map / heuristic if unavailable.",
      successTitle: ({ changedRows }) =>
        `Generated activities for ${changedRows} L3 capabilit${changedRows === 1 ? "y" : "ies"}`,
      successDescription: ({ source, warning }) =>
        warning
          ? `${warning} Filled blank L3s only.`
          : `Sourced via ${sourceLabel(source)}. Existing activity lists were preserved.`,
      errorTitle: "Couldn't generate L4 activities",
    },
  });

  const regenerateAllOp = useAsyncOp<GenerateL4Outcome, []>({
    run: () => runGenerateL4("regenerateAll"),
    messages: {
      loadingTitle: "Regenerating every L3's activities...",
      successTitle: ({ changedRows }) =>
        `Regenerated activities for ${changedRows} L3 capabilit${changedRows === 1 ? "y" : "ies"}`,
      successDescription: ({ source, warning }) =>
        warning
          ? `${warning} All previous activity lists were replaced.`
          : `Sourced via ${sourceLabel(source)}. All previous activity lists were replaced.`,
      errorTitle: "Couldn't regenerate L4 activities",
    },
  });

  // Source-of-truth precedence: uploaded rows always win. The predefined
  // capability map (`src/data/capabilityMap/*.ts`) is a seed used by the
  // "Load sample" button and as a Preview when no rows exist yet — it never
  // overlays user data once anything has been uploaded.
  const def = getCapabilityMapForTower(towerId);
  const isPreview = rows.length === 0 && def != null;
  const view = React.useMemo(() => {
    if (rows.length > 0) return inferCapabilityViewFromRows(towerName, rows);
    if (def != null) return definitionToViewModel(def, def.name);
    return { l1Name: towerName, l2: [] };
  }, [rows, towerName, def]);

  // Step 1 is "done" in the journey stepper when L1–L3 is confirmed, or the
  // tower was already fully signed off before this field existed.
  const completedModules: ReadonlyArray<"capability-map"> =
    isCapabilityMapJourneyStepDone(tState) ? ["capability-map"] : [];

  // Safety dialog state for the upload path. Only shown when the tower
  // already has data — first-time uploads (rows.length === 0) skip the
  // dialog entirely, since there's nothing to lose.
  const [pendingFile, setPendingFile] = React.useState<File | null>(null);
  const [replaceBusy, setReplaceBusy] =
    React.useState<ReplaceUploadBusyState>(null);
  const [reloadSampleDialogOpen, setReloadSampleDialogOpen] = React.useState(false);
  const [reloadSampleBusy, setReloadSampleBusy] =
    React.useState<ReloadSampleBusyState>(null);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (rows.length === 0) {
      // First-time upload — no dials, no L4 lists, no cache to lose.
      void importOp.fire(f);
      return;
    }
    setPendingFile(f);
  };

  const closeReplaceDialog = React.useCallback(() => {
    setPendingFile(null);
    setReplaceBusy(null);
  }, []);

  const onReplaceWithoutBackup = React.useCallback(() => {
    const f = pendingFile;
    closeReplaceDialog();
    if (f) void importOp.fire(f);
  }, [pendingFile, importOp, closeReplaceDialog]);

  const closeReloadSampleDialog = React.useCallback(() => {
    setReloadSampleDialogOpen(false);
    setReloadSampleBusy(null);
  }, []);

  const onLoadSample = React.useCallback(() => {
    if (rows.length === 0) {
      void sampleLoadOp.fire();
      return;
    }
    setReloadSampleDialogOpen(true);
  }, [rows.length, sampleLoadOp]);

  const onReloadSampleConfirm = React.useCallback(() => {
    closeReloadSampleDialog();
    void sampleLoadOp.fire();
  }, [closeReloadSampleDialog, sampleLoadOp]);

  const onExportThenReloadSample = React.useCallback(async () => {
    setReloadSampleBusy("exporting");
    try {
      const program = getAssessProgram();
      const body = serializeAssessProgramForDownload(program);
      const name = `forge-assess-backup-${new Date().toISOString().slice(0, 10)}.json`;
      downloadBlob(name, body, "application/json;charset=utf-8");
      toast.success({
        title: "Backup downloaded",
        description:
          "Save the JSON somewhere safe (SharePoint / Teams). Restore via Program tools > Import backup.",
        durationMs: 6000,
      });
    } catch (err) {
      toast.error({
        title: "Couldn't export backup",
        description: err instanceof Error ? err.message : undefined,
      });
      setReloadSampleBusy(null);
      return;
    }
    closeReloadSampleDialog();
    void sampleLoadOp.fire();
  }, [closeReloadSampleDialog, sampleLoadOp, toast]);

  const onExportThenReplace = React.useCallback(async () => {
    const f = pendingFile;
    if (!f) {
      closeReplaceDialog();
      return;
    }
    setReplaceBusy("exporting");
    try {
      // Same export pipeline that Program tools > Export backup uses, so the
      // file round-trips cleanly via Program tools > Import backup.
      const program = getAssessProgram();
      const body = serializeAssessProgramForDownload(program);
      const name = `forge-assess-backup-${new Date().toISOString().slice(0, 10)}.json`;
      downloadBlob(name, body, "application/json;charset=utf-8");
      toast.success({
        title: "Backup downloaded",
        description:
          "Save the JSON somewhere safe (SharePoint / Teams). Restore via Program tools > Import backup.",
        durationMs: 6000,
      });
    } catch (err) {
      toast.error({
        title: "Couldn't export backup",
        description: err instanceof Error ? err.message : undefined,
      });
      setReplaceBusy(null);
      return;
    }
    closeReplaceDialog();
    void importOp.fire(f);
  }, [pendingFile, importOp, toast, closeReplaceDialog]);

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

  const journeyGuidance = useGuidanceCapabilityMap(towerId);
  const onConfirmGuidance =
    journeyGuidance.actionKind === "confirm" ? () => void markL1L3TreeValidated() : undefined;
  const towerVm = towers.find((t) => t.id === towerId);
  return (
    <>
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

        {towerVm ? <TowerDataExports tower={towerVm} className="mt-3" /> : null}

        <ScreenGuidanceBar
          guidance={journeyGuidance}
          className="mt-3"
          onConfirm={onConfirmGuidance}
          onUnlock={mapStepLocked ? () => void clearL1L3TreeValidation() : undefined}
          mapStepLocked={mapStepLocked}
        />

        <div className="mt-6 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h1 className="font-display text-2xl font-semibold text-forge-ink">
            &gt; {towerName} · Capability Map
          </h1>
          <p className="text-xs text-forge-subtle">
            Step 1 — confirm the <Term termKey="capability map">L1–L3 tree</Term> and headcount, then open{" "}
            <Link href={getTowerHref(towerId, "impact-levers")} className="text-accent-purple-dark underline">
              Configure Impact Levers
            </Link>
            .
          </p>
        </div>

        {blankL4Count > 0 ? (
          <div className="mt-4">
            <StaleL4Banner
              blankL4Count={blankL4Count}
              totalL3s={rows.length}
              generating={generateBlanksOp.state === "loading"}
              mapLocked={mapStepLocked}
              onGenerate={() => void generateBlanksOp.fire()}
              hideTitle
            />
          </div>
        ) : null}

        {/* Above-the-fold CTA: upload capability map + headcount in one file. */}
        <CapabilityMapCta
          rowsCount={rows.length}
          lastUpdated={tState.lastUpdated}
          uploading={importOp.state === "loading"}
          loadingSample={sampleLoadOp.state === "loading"}
          mapLocked={mapStepLocked}
          onPickFile={() => fileRef.current?.click()}
          onLoadSample={onLoadSample}
          onDownloadSample={onTemplateDownload}
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
              l1L3TreeValidatedAt={tState.l1L3TreeValidatedAt}
            />
            {rows.length > 0 ? (
              <div id="generate-l4-toolbar">
                <GenerateL4Toolbar
                  blankL4Count={blankL4Count}
                  totalL3s={rows.length}
                  generatingBlanks={generateBlanksOp.state === "loading"}
                  regeneratingAll={regenerateAllOp.state === "loading"}
                  locked={mapStepLocked}
                  onGenerateBlanks={() => void generateBlanksOp.fire()}
                  onRegenerateAll={() => void regenerateAllOp.fire()}
                />
              </div>
            ) : null}
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
            <HeadcountTable readOnly={mapStepLocked} rows={rows} onPatch={patchRow} />
          </details>
        ) : null}

        {rows.length > 0 ? (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent-purple/30 bg-accent-purple/5 p-5">
            <div>
              <p className="font-display text-base font-semibold text-forge-ink">
                Capability map &amp; headcount set — configure your impact levers.
              </p>
              <p className="mt-1 text-sm text-forge-body">
                Step 2: dial offshore and AI per L3 across the {tState.l3Rows.length} L3 capabilit{tState.l3Rows.length === 1 ? "y" : "ies"} you just confirmed.
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
    <input
      ref={fileRef}
      type="file"
      accept=".csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      className="hidden"
      onChange={onFile}
    />
    <ReplaceUploadConfirmDialog
      open={pendingFile != null}
      fileName={pendingFile?.name ?? ""}
      towerName={towerName}
      busy={replaceBusy}
      onCancel={closeReplaceDialog}
      onReplace={onReplaceWithoutBackup}
      onExportThenReplace={() => void onExportThenReplace()}
    />
    <ReloadSampleConfirmDialog
      open={reloadSampleDialogOpen}
      towerName={towerName}
      busy={reloadSampleBusy}
      onCancel={closeReloadSampleDialog}
      onReload={onReloadSampleConfirm}
      onExportThenReload={() => void onExportThenReloadSample()}
    />
    </>
  );
}

function MapSourceBanner({
  isPreview,
  authoredAt,
  rowsCount,
  l1L3TreeValidatedAt,
}: {
  isPreview: boolean;
  authoredAt?: string;
  rowsCount: number;
  l1L3TreeValidatedAt?: string;
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
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-accent-green/35 bg-accent-green/8 px-3 py-1.5">
          <span className="inline-flex items-center gap-2 text-xs font-medium text-accent-green">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            Tower lead upload · {rowsCount} L3 capabilit{rowsCount === 1 ? "y" : "ies"}
          </span>
          <span className="text-[11px] text-forge-subtle">
            Confirmed {formatRelative(authoredAt)} · drives the impact-lever dials &amp; impact estimate
            downstream.
          </span>
        </div>
        {l1L3TreeValidatedAt ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-accent-teal/35 bg-accent-teal/8 px-3 py-1.5">
            <span className="text-xs font-medium text-accent-teal">
              L1–L3 review confirmed — map and headcount are locked for editing.
            </span>
            <span className="text-[11px] text-forge-subtle">
              Confirmed {formatRelative(l1L3TreeValidatedAt)} · use Unlock to edit map in the action
              bar above.
            </span>
          </div>
        ) : null}
      </div>
    );
  }
  // Rows present but loaded from "Load sample" — seed data, not authored.
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-forge-border bg-forge-well/40 px-3 py-1.5">
        <span className="inline-flex items-center gap-2 text-xs font-medium text-forge-body">
          <Info className="h-3.5 w-3.5 text-accent-purple-dark" aria-hidden />
          Sample seed loaded · {rowsCount} L3 capabilit{rowsCount === 1 ? "y" : "ies"}
        </span>
        <span className="text-[11px] text-forge-subtle">
          Upload your capability map &amp; headcount to confirm the tower lead version.
        </span>
      </div>
      {l1L3TreeValidatedAt ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-accent-teal/35 bg-accent-teal/8 px-3 py-1.5">
          <span className="text-xs font-medium text-accent-teal">
            L1–L3 review confirmed — map and headcount are locked for editing.
          </span>
          <span className="text-[11px] text-forge-subtle">
            Confirmed {formatRelative(l1L3TreeValidatedAt)} · use Unlock in the action bar above.
          </span>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Toolbar that lets tower leads (re)generate the L4 activity list under each
 * L3. The activities are display-only metadata (they don't drive the math) but
 * leads expect to see *something* under each L3 after they upload an L2/L3
 * template. Two buttons keep the UX honest:
 *
 *   - Generate for blanks: only L3s with no `l4Activities` are filled. Safe
 *     by default — runs LLM-first with canonical-map fallback.
 *   - Regenerate all: explicit overwrite. Useful after a substantial upload
 *     where canonical seeds no longer fit the lead's actual map.
 */
function GenerateL4Toolbar({
  blankL4Count,
  totalL3s,
  generatingBlanks,
  regeneratingAll,
  locked,
  onGenerateBlanks,
  onRegenerateAll,
}: {
  blankL4Count: number;
  totalL3s: number;
  generatingBlanks: boolean;
  regeneratingAll: boolean;
  locked?: boolean;
  onGenerateBlanks: () => void;
  onRegenerateAll: () => void;
}) {
  const noBlanks = blankL4Count === 0;
  const disabledAll = locked;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-forge-border bg-forge-surface/60 px-3 py-2">
      <div className="text-[11px] text-forge-subtle">
        L4 activities{" "}
        <span className="font-mono text-forge-hint">
          {totalL3s - blankL4Count}/{totalL3s} L3s have activities
        </span>
        {noBlanks ? null : (
          <span className="ml-1 text-forge-body">
            · {blankL4Count} L3{blankL4Count === 1 ? "" : "s"} need generation
          </span>
        )}
        {locked ? (
          <span className="ml-1 block text-forge-hint sm:ml-2 sm:inline">
            Unlock the map in the action bar to change activities.
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={onGenerateBlanks}
          disabled={generatingBlanks || noBlanks || disabledAll}
          title={
            disabledAll
              ? "Unlock the map in the action bar to generate L4 activities."
              : noBlanks
                ? "Every L3 already has activities. Use Regenerate all to replace them."
                : "Generate L4 activities only for L3s that don't have any yet."
          }
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition",
            noBlanks
              ? "border border-forge-border text-forge-hint"
              : "bg-accent-purple text-white hover:bg-accent-purple-dark",
            "disabled:opacity-60",
          )}
        >
          <Wand2 className="h-3 w-3" aria-hidden />
          {generatingBlanks
            ? "Generating..."
            : noBlanks
              ? "All L3s have activities"
              : `Generate for ${blankL4Count} blank${blankL4Count === 1 ? "" : "s"}`}
        </button>
        <button
          type="button"
          onClick={onRegenerateAll}
          disabled={regeneratingAll || disabledAll}
          title={
            disabledAll
              ? "Unlock the map in the action bar to regenerate L4 activities."
              : "Replace every L3's activity list (LLM-first, canonical-map fallback)."
          }
          className="inline-flex items-center gap-1.5 rounded-md border border-forge-border px-2.5 py-1 text-[11px] text-forge-body transition hover:border-accent-purple/30 disabled:opacity-60"
        >
          {regeneratingAll ? "Regenerating..." : "Regenerate all"}
        </button>
      </div>
    </div>
  );
}

function CapabilityMapCta({
  rowsCount,
  lastUpdated,
  uploading,
  loadingSample,
  mapLocked,
  onPickFile,
  onLoadSample,
  onDownloadSample,
}: {
  rowsCount: number;
  lastUpdated?: string;
  uploading: boolean;
  loadingSample: boolean;
  mapLocked?: boolean;
  onPickFile: () => void;
  onLoadSample: () => void;
  onDownloadSample: () => void;
}) {
  const isEmpty = rowsCount === 0;
  const fileDisabled = uploading || mapLocked;
  const sampleDisabled = loadingSample || mapLocked;

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
              One row per <Term termKey="l3">L3 capability</Term> with onshore / offshore{" "}
              <Term termKey="fte">FTE</Term> &amp; <Term termKey="contractor">contractors</Term>.
              We infer the L1–L3 tree from your file and generate the L4 activity list
              underneath each capability — no separate uploads.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onPickFile}
              disabled={fileDisabled}
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
              disabled={sampleDisabled}
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
          disabled={fileDisabled}
          className="inline-flex items-center gap-1.5 rounded-md border border-accent-purple/35 bg-accent-purple/10 px-2.5 py-1.5 text-xs font-medium text-accent-purple-dark transition hover:border-accent-purple/55 disabled:opacity-60"
        >
          <Upload className="h-3.5 w-3.5" aria-hidden />
          {uploading ? "Uploading..." : "Update map & headcount"}
        </button>
        <button
          type="button"
          onClick={onLoadSample}
          disabled={sampleDisabled}
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
  readOnly,
}: {
  rows: L3WorkforceRow[];
  onPatch: (id: string, patch: Partial<L3WorkforceRow>) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="overflow-x-auto border-t border-forge-border">
      <table className="w-full min-w-[760px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-forge-border bg-forge-well/50 text-xs text-forge-subtle">
            <th className="px-3 py-2 font-medium">L2</th>
            <th className="px-3 py-2 font-medium">L3</th>
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
              <td className="max-w-[160px] px-3 py-1.5 text-forge-subtle">{r.l2}</td>
              <td className="max-w-[260px] px-3 py-1.5 text-forge-ink">{r.l3}</td>
              {(["fteOnshore", "fteOffshore", "contractorOnshore", "contractorOffshore"] as const).map(
                (k) => (
                  <td key={k} className="px-1 py-1">
                    <input
                      className="w-16 rounded border border-forge-border bg-forge-page px-1 py-0.5 text-right font-mono text-xs disabled:cursor-not-allowed disabled:opacity-60"
                      type="number"
                      min={0}
                      step={1}
                      disabled={readOnly}
                      value={r[k]}
                      onChange={(e) => {
                        const n = Math.max(0, Math.floor(Number(e.target.value) || 0));
                        onPatch(r.id, { [k]: n } as Partial<L3WorkforceRow>);
                      }}
                    />
                  </td>
                ),
              )}
              <td className="px-1 py-1">
                <input
                  className="w-24 rounded border border-forge-border bg-forge-page px-1 py-0.5 text-right font-mono text-xs disabled:cursor-not-allowed disabled:opacity-60"
                  type="number"
                  min={0}
                  step={1000}
                  disabled={readOnly}
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
