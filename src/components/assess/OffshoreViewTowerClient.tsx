"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Download,
  Info,
  Lock,
  RefreshCw,
  Unlock,
  Upload,
  X,
} from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { TowerJourneyStepper } from "@/components/layout/TowerJourneyStepper";
import { ScreenGuidanceBar } from "@/components/guidance/ScreenGuidanceBar";
import { PercentSlider } from "@/components/ui/PercentSlider";
import { CapabilityMapPanel } from "@/components/assess/CapabilityMapPanel";
import { inferCapabilityViewFromRows } from "@/lib/assess/capabilityMapTree";
import { useGuidanceOffshoreView } from "@/lib/guidance/useJourneyGuidance";
import {
  ReplaceUploadConfirmDialog,
  type ReplaceUploadBusyState,
} from "@/components/feedback/ReplaceUploadConfirmDialog";
import { useToast } from "@/components/feedback/ToastProvider";
import { useTowerAssessOps } from "@/lib/assess/useTowerAssessOps";
import {
  isOffshoreClassificationLocked,
  isClassificationStale,
} from "@/lib/assess/offshoreViewStepStatus";
import {
  buildOffshoreClassificationCsv,
  downloadBlob,
  downloadCurrentTowerOffshoreClassificationCsv,
} from "@/lib/assess/downloadAssessSamples";
import {
  parseOffshoreClassificationXlsx,
  type OffshoreClassificationRowOverride,
} from "@/lib/assess/parseOffshoreClassificationXlsx";
import { clampPct, l4Split } from "@/lib/offshore/offshoreSplit";
import { useAsyncOp } from "@/lib/feedback/useAsyncOp";
import { getTowerHref } from "@/lib/towerHref";
import type { L4WorkforceRow, TowerId } from "@/data/assess/types";
import { cn } from "@/lib/utils";

type Props = { towerId: TowerId; towerName: string };

/**
 * Step 2 — Offshore View (per-tower). Reuses Step 1's
 * `CapabilityMapPanel` verbatim so the L1 → L2 → L3 → L4 grid (banners,
 * fixed-width columns, fit-mode toggle, horizontal scroll, tier badges)
 * is identical across the two journey steps.
 *
 * Differences vs Step 1 are confined to two props passed to the panel:
 *
 *   1. `offshoreSplitByL4Id` — every box swaps its HC chip for a
 *      Retained / GCC split chip. L1 / L2 / L3 banners aggregate the
 *      same data via HC-weighted roll-up inside the panel.
 *   2. `onL4Click` — clicking an L4 box opens an inline
 *      `L4GccPctPopover` anchored to that box. The popover writes
 *      gccPct via `applyGccPct`; the panel rebuilds on the next render.
 *
 * Tower leads have three editing paths that all converge on
 * `applyGccPct`:
 *   - Click an L4 box → popover (one row at a time, with rationale).
 *   - "Refresh AI" → bulk LLM suggestion via /api/offshore-plan/classify.
 *   - "Upload override" → CSV/XLSX with `rowId` + `gccPct` columns.
 */
export function OffshoreViewTowerClient({ towerId, towerName }: Props) {
  const toast = useToast();
  const ops = useTowerAssessOps(towerId, towerName);
  const {
    tState,
    rows,
    applyGccPct,
    markOffshoreClassificationValidated,
    clearOffshoreClassificationValidation,
  } = ops;

  const locked = isOffshoreClassificationLocked(tState);
  const classificationStale = isClassificationStale(tState);

  // ------------------------------------------------------------------------
  //   Capability map view + offshore split lookup — both memoized so the
  //   panel only re-renders when the underlying rows change.
  // ------------------------------------------------------------------------

  const view = React.useMemo(
    () => inferCapabilityViewFromRows(towerName, rows),
    [rows, towerName],
  );

  const offshoreSplitByL4Id = React.useMemo(() => {
    const m = new Map<
      string,
      { gccFte: number; retainedFte: number; totalHc: number; gccPct: number }
    >();
    for (const r of rows) {
      const { totalHc, gccFte, retainedFte } = l4Split(r);
      m.set(r.id, {
        gccFte,
        retainedFte,
        totalHc,
        gccPct: clampPct(r.gccPct),
      });
    }
    return m;
  }, [rows]);

  // ------------------------------------------------------------------------
  //   Popover state — exactly one open at a time. Anchored to the L4 box
  //   the panel rendered (via `[data-l4="<id>"]` selector + bounding rect).
  // ------------------------------------------------------------------------

  const [openL4Id, setOpenL4Id] = React.useState<string | null>(null);
  const openRow = React.useMemo(
    () => (openL4Id ? rows.find((r) => r.id === openL4Id) ?? null : null),
    [openL4Id, rows],
  );

  const openL4 = React.useCallback(
    (id: string) => {
      if (locked) return;
      setOpenL4Id(id);
    },
    [locked],
  );
  const closePopover = React.useCallback(() => setOpenL4Id(null), []);

  // Close popover whenever the row set changes shape (Refresh AI, upload,
  // lock toggle) — the anchor element may no longer exist after a
  // re-render.
  React.useEffect(() => {
    if (openL4Id == null) return;
    if (!rows.some((r) => r.id === openL4Id)) {
      setOpenL4Id(null);
    }
  }, [rows, openL4Id]);

  // ------------------------------------------------------------------------
  //   Row-level setters
  // ------------------------------------------------------------------------

  const setGccPctForRow = React.useCallback(
    async (rowId: string, gccPct: number, reason: string) => {
      if (locked) return;
      await applyGccPct([
        {
          rowId,
          gccPct,
          setBy: "user",
          reason: reason.trim().slice(0, 200),
        },
      ]);
    },
    [applyGccPct, locked],
  );

  const acceptAllAiSuggestions = React.useCallback(async () => {
    if (locked) return;
    const changes = rows
      .filter((r) => !r.gccPctSource || r.gccPctSource === "seed")
      .map((r) => ({
        rowId: r.id,
        gccPct: clampPct(r.gccPct ?? 0),
        setBy: "ai" as const,
        reason: r.gccReason || "Accepted AI-suggested GCC % without edits.",
      }));
    if (changes.length === 0) {
      toast.info({
        title: "Nothing to accept",
        description: "Every row has already been reviewed.",
      });
      return;
    }
    await applyGccPct(changes);
    toast.success({
      title: `Accepted AI suggestion for ${changes.length} row${changes.length === 1 ? "" : "s"}`,
    });
  }, [applyGccPct, locked, rows, toast]);

  // ------------------------------------------------------------------------
  //   Refresh AI — call /api/offshore-plan/classify, apply gccPct + reason
  // ------------------------------------------------------------------------

  const refreshAiOp = useAsyncOp<{ updatedRows: number }, []>({
    run: async () => {
      const suggestions = await fetchGccPctSuggestions(
        towerId,
        towerName,
        rows,
      );
      if (suggestions.size === 0) {
        throw new Error(
          "Classifier returned no suggestions — try again in a moment.",
        );
      }
      const changes = Array.from(suggestions.entries()).map(
        ([rowId, s]) => ({
          rowId,
          gccPct: s.gccPct,
          setBy: "ai" as const,
          reason: s.reason,
        }),
      );
      await applyGccPct(changes);
      return { updatedRows: changes.length };
    },
    messages: {
      loadingTitle: `Refreshing AI offshore suggestions for ${towerName}`,
      loadingDescription:
        "Re-classifying every L4 Activity Group against Versant's carve-out rules.",
      successTitle: ({ updatedRows }) =>
        `Updated ${updatedRows} row${updatedRows === 1 ? "" : "s"} with fresh AI suggestions`,
      errorTitle: "Couldn't refresh AI suggestions",
    },
  });

  // ------------------------------------------------------------------------
  //   File upload — diff-confirm before commit
  // ------------------------------------------------------------------------

  const fileRef = React.useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = React.useState<File | null>(null);
  const [pendingParsed, setPendingParsed] = React.useState<
    OffshoreClassificationRowOverride[]
  >([]);
  const [replaceBusy, setReplaceBusy] =
    React.useState<ReplaceUploadBusyState>(null);

  const closeReplaceDialog = React.useCallback(() => {
    setPendingFile(null);
    setPendingParsed([]);
    setReplaceBusy(null);
  }, []);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (locked) {
      toast.info({
        title: "Step 2 is locked",
        description: "Unlock the action bar above to apply a bulk override.",
      });
      return;
    }
    try {
      const buffer = await f.arrayBuffer();
      const parsed = parseOffshoreClassificationXlsx(buffer);
      if (!parsed.ok) {
        toast.error({
          title: "Couldn't parse the file",
          description: parsed.error,
        });
        return;
      }
      const knownRowIds = new Set(rows.map((r) => r.id));
      const matched = parsed.rows.filter((r) => knownRowIds.has(r.rowId));
      if (matched.length === 0) {
        toast.error({
          title: "No matching rows in the upload",
          description:
            "Every rowId in the file is unknown for this tower. Download the current map and edit that copy.",
        });
        return;
      }
      if (parsed.warnings.length > 0) {
        toast.info({
          title: `${parsed.warnings.length} parser warning${parsed.warnings.length === 1 ? "" : "s"}`,
          description: parsed.warnings.slice(0, 2).join(" · "),
        });
      }
      setPendingFile(f);
      setPendingParsed(matched);
    } catch (err) {
      toast.error({
        title: "Couldn't read the file",
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const onApplyUpload = React.useCallback(async () => {
    if (pendingParsed.length === 0) {
      closeReplaceDialog();
      return;
    }
    const changes = pendingParsed.map((r) => ({
      rowId: r.rowId,
      gccPct: r.gccPct,
      setBy: "upload" as const,
      reason: (r.reason ?? "Uploaded via .csv/.xlsx — pending review.").slice(
        0,
        200,
      ),
    }));
    await applyGccPct(changes);
    toast.success({
      title: `Applied ${changes.length} GCC % override${changes.length === 1 ? "" : "s"}`,
    });
    closeReplaceDialog();
  }, [applyGccPct, closeReplaceDialog, pendingParsed, toast]);

  const onExportThenApply = React.useCallback(async () => {
    setReplaceBusy("exporting");
    try {
      const csv = buildOffshoreClassificationCsv(rows);
      const date = new Date().toISOString().slice(0, 10);
      downloadBlob(
        `${towerName.toLowerCase().replace(/[^a-z0-9-_]+/gi, "-")}-offshore-backup-${date}.csv`,
        csv,
        "text/csv;charset=utf-8",
      );
      toast.success({
        title: "Backup downloaded",
        description: "Save the CSV somewhere safe. Re-upload via Step 2 to restore.",
      });
    } catch (err) {
      toast.error({
        title: "Couldn't export backup",
        description: err instanceof Error ? err.message : undefined,
      });
      setReplaceBusy(null);
      return;
    }
    await onApplyUpload();
  }, [onApplyUpload, rows, toast, towerName]);

  // ------------------------------------------------------------------------
  //   Stats for the action bar + sign-off
  // ------------------------------------------------------------------------

  const stats = React.useMemo(() => {
    let reviewed = 0;
    let unchangedFromAi = 0;
    for (const r of rows) {
      const src = r.gccPctSource;
      if (src && src !== "seed") reviewed += 1;
      if (src === "ai") unchangedFromAi += 1;
    }
    return { reviewed, unchangedFromAi };
  }, [rows]);

  const canMarkDone = rows.length > 0 && stats.reviewed === rows.length;

  // ------------------------------------------------------------------------
  //   Page chrome
  // ------------------------------------------------------------------------

  const guidance = useGuidanceOffshoreView(towerId, towerName);
  const onConfirmGuidance =
    guidance.actionKind === "confirm"
      ? guidance.actionLabel?.toLowerCase().startsWith("refresh")
        ? () => void refreshAiOp.fire()
        : () => void markOffshoreClassificationValidated()
      : undefined;

  const completedModules: ReadonlyArray<"offshore-view"> =
    tState.offshoreViewValidatedAt != null ? ["offshore-view"] : [];

  return (
    <>
      <PageShell>
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <Breadcrumbs
            items={[
              { label: "Program home", href: "/" },
              { label: "Capability Map", href: "/capability-map" },
              { label: towerName, href: getTowerHref(towerId, "capability-map") },
              { label: "Offshore View" },
            ]}
          />

          <TowerJourneyStepper
            className="mt-3"
            towerId={towerId}
            towerName={towerName}
            current="offshore-view"
            completed={completedModules}
          />

          <ScreenGuidanceBar
            guidance={guidance}
            className="mt-3"
            onConfirm={onConfirmGuidance}
            onReopenSignoff={
              locked ? () => void clearOffshoreClassificationValidation() : undefined
            }
            signoffActive={locked}
          />

          <div className="mt-6 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h1 className="font-display text-2xl font-semibold text-forge-ink">
              &gt; {towerName} · Offshore View
            </h1>
            <p className="text-xs text-forge-subtle">
              Step 2 — click any L4 box to set its GCC %. Step 3&rsquo;s offshore $
              on{" "}
              <Link
                href={getTowerHref(towerId, "impact-levers")}
                className="text-accent-purple-dark underline"
              >
                Impact Levers
              </Link>{" "}
              is derived automatically from these decisions.
            </p>
          </div>

          {classificationStale ? (
            <StaleClassificationBanner
              onRefresh={() => void refreshAiOp.fire()}
              refreshing={refreshAiOp.state === "loading"}
              locked={locked}
            />
          ) : null}

          {rows.length === 0 ? (
            <section className="mt-6 rounded-2xl border border-accent-purple/35 bg-gradient-to-br from-accent-purple/12 via-accent-purple/5 to-transparent p-5">
              <h2 className="font-display text-lg font-semibold text-forge-ink">
                No capability map yet
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-forge-body">
                Upload {towerName}&rsquo;s capability map and headcount on Step 1 first
                — the AI suggested split is computed from your L4 Activity Groups.
              </p>
              <Link
                href={getTowerHref(towerId, "capability-map")}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-accent-purple px-4 py-2 text-sm font-semibold text-white hover:bg-accent-purple-dark"
              >
                Open Capability Map
                <ArrowRight className="h-4 w-4" />
              </Link>
            </section>
          ) : (
            <>
              <OffshoreActionBar
                rowsCount={rows.length}
                reviewed={stats.reviewed}
                unchangedFromAi={stats.unchangedFromAi}
                locked={locked}
                refreshing={refreshAiOp.state === "loading"}
                onRefresh={() => void refreshAiOp.fire()}
                onAcceptAllAi={() => void acceptAllAiSuggestions()}
                onPickFile={() => fileRef.current?.click()}
                onDownloadCurrent={() => {
                  try {
                    downloadCurrentTowerOffshoreClassificationCsv(
                      towerId,
                      towerName,
                    );
                    toast.success({
                      title: `Offshore split CSV for ${towerName} downloaded`,
                    });
                  } catch (e) {
                    toast.error({
                      title: "Couldn't download offshore split",
                      description: e instanceof Error ? e.message : undefined,
                    });
                  }
                }}
                onLockToggle={() => {
                  if (locked) void clearOffshoreClassificationValidation();
                  else void markOffshoreClassificationValidated();
                }}
                canMarkDone={canMarkDone}
              />

              <section
                id="offshore-capability-map"
                className="mt-6 rounded-2xl border border-forge-border bg-forge-surface/70 p-4 sm:p-5"
              >
                <CapabilityMapPanel
                  view={view}
                  rows={rows}
                  mode="offshore"
                  offshoreSplitByL4Id={offshoreSplitByL4Id}
                  onL4Click={openL4}
                  activeL4Id={openL4Id}
                  hideL5Toggle
                />
              </section>

              <Step2LeadSignoff
                towerName={towerName}
                rowsCount={rows.length}
                reviewedCount={stats.reviewed}
                locked={locked}
                reviewedAtIso={tState.offshoreViewValidatedAt}
                onMarkReviewed={() => void markOffshoreClassificationValidated()}
                onReopen={() => void clearOffshoreClassificationValidation()}
                canMarkDone={canMarkDone}
              />

              {locked ? (
                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent-purple/30 bg-accent-purple/5 p-5">
                  <div>
                    <p className="font-display text-base font-semibold text-forge-ink">
                      Offshore split locked — configure your impact levers.
                    </p>
                    <p className="mt-1 text-sm text-forge-body">
                      Step 3: dial AI impact per L3 Job Family. Offshore $ is
                      derived automatically from the GCC % you just confirmed.
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
            </>
          )}
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
        onReplace={() => void onApplyUpload()}
        onExportThenReplace={() => void onExportThenApply()}
      />

      {openRow ? (
        <L4GccPctPopover
          row={openRow}
          onCancel={closePopover}
          onCommit={(pct, reason) => {
            void setGccPctForRow(openRow.id, pct, reason);
            closePopover();
          }}
        />
      ) : null}
    </>
  );
}

// ===========================================================================
//   Action bar
// ===========================================================================

function OffshoreActionBar({
  rowsCount,
  reviewed,
  unchangedFromAi,
  locked,
  refreshing,
  onRefresh,
  onAcceptAllAi,
  onPickFile,
  onDownloadCurrent,
  onLockToggle,
  canMarkDone,
}: {
  rowsCount: number;
  reviewed: number;
  unchangedFromAi: number;
  locked: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onAcceptAllAi: () => void;
  onPickFile: () => void;
  onDownloadCurrent: () => void;
  onLockToggle: () => void;
  canMarkDone: boolean;
}) {
  return (
    <section className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-forge-border bg-forge-surface/70 px-4 py-2.5">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-display text-sm font-semibold text-forge-ink">
          GCC % classification
        </span>
        <span className="font-mono text-[11px] tabular-nums text-forge-hint">
          {reviewed}/{rowsCount} reviewed
          {unchangedFromAi > 0 ? ` · ${unchangedFromAi} on AI suggestion` : ""}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing || locked}
          className="inline-flex items-center gap-1.5 rounded-md border border-accent-purple/35 bg-accent-purple/10 px-2.5 py-1.5 text-xs font-medium text-accent-purple-dark transition hover:border-accent-purple/55 disabled:opacity-60"
          title={
            locked
              ? "Unlock Step 2 to refresh AI suggestions."
              : "Re-run the LLM GCC % classifier across every row."
          }
        >
          <RefreshCw
            className={cn("h-3.5 w-3.5", refreshing && "animate-spin")}
            aria-hidden
          />
          Refresh AI
        </button>
        <button
          type="button"
          onClick={onAcceptAllAi}
          disabled={locked}
          className="inline-flex items-center gap-1.5 rounded-md border border-forge-border bg-forge-well/60 px-2.5 py-1.5 text-xs font-medium text-forge-body transition hover:border-accent-purple/40 hover:text-forge-ink disabled:opacity-60"
          title={
            locked
              ? "Unlock Step 2 to bulk-accept AI suggestions."
              : "Accept every row's AI-suggested GCC % without edits."
          }
        >
          <CheckCircle2 className="h-3.5 w-3.5 text-accent-teal" aria-hidden />
          Accept all AI
        </button>
        <button
          type="button"
          onClick={onPickFile}
          disabled={locked}
          className="inline-flex items-center gap-1.5 rounded-md border border-forge-border bg-forge-well/60 px-2.5 py-1.5 text-xs font-medium text-forge-body transition hover:border-accent-purple/40 hover:text-forge-ink disabled:opacity-60"
          title={
            locked
              ? "Unlock Step 2 to upload a bulk override."
              : "Upload a .csv/.xlsx that bulk-overrides every row's gccPct."
          }
        >
          <Upload className="h-3.5 w-3.5" aria-hidden />
          Upload override
        </button>
        <button
          type="button"
          onClick={onDownloadCurrent}
          className="inline-flex items-center gap-1.5 rounded-md border border-forge-border bg-forge-well/60 px-2.5 py-1.5 text-xs font-medium text-forge-body transition hover:border-accent-purple/40 hover:text-forge-ink"
          title="Download the tower's current GCC % split as a .csv backup."
        >
          <Download className="h-3.5 w-3.5" aria-hidden />
          Download current
        </button>
        <button
          type="button"
          onClick={onLockToggle}
          disabled={!locked && !canMarkDone}
          className={cn(
            "ml-1 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition",
            locked
              ? "border border-accent-amber/40 bg-accent-amber/10 text-accent-amber hover:border-accent-amber/60"
              : "bg-accent-purple text-white hover:bg-accent-purple-dark disabled:cursor-not-allowed disabled:opacity-50",
          )}
          title={
            locked
              ? "Re-open Step 2 for editing."
              : canMarkDone
                ? "Lock Step 2 — every row reviewed."
                : `Mark Step 2 done after reviewing every row (${reviewed}/${rowsCount}).`
          }
        >
          {locked ? (
            <Unlock className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <Lock className="h-3.5 w-3.5" aria-hidden />
          )}
          {locked ? "Re-open" : "Mark Step 2 done"}
        </button>
      </div>
    </section>
  );
}

function StaleClassificationBanner({
  onRefresh,
  refreshing,
  locked,
}: {
  onRefresh: () => void;
  refreshing: boolean;
  locked: boolean;
}) {
  return (
    <section className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent-amber/40 bg-accent-amber/10 p-3 text-sm text-forge-body">
      <div className="flex items-start gap-2">
        <Info
          className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent-amber"
          aria-hidden
        />
        <span>
          The Capability Map was edited after Step 2 was last confirmed —
          run Refresh AI to re-suggest a GCC % for every row.
        </span>
      </div>
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing || locked}
        className="inline-flex items-center gap-1.5 rounded-md border border-accent-amber/40 bg-accent-amber/15 px-2.5 py-1 text-xs font-medium text-accent-amber transition hover:border-accent-amber/60 disabled:opacity-60"
      >
        <RefreshCw
          className={cn("h-3.5 w-3.5", refreshing && "animate-spin")}
          aria-hidden
        />
        Refresh AI suggestions
      </button>
    </section>
  );
}

// ===========================================================================
//   L4 GCC % editor — fixed-position popover anchored to the panel's L4 box
// ===========================================================================

/**
 * Floating editor anchored to the L4 box `CapabilityMapPanel` rendered.
 * Looks up the anchor via `document.querySelector('[data-l4="<id>"]')`,
 * snaps below by default, flips above when there's no room. Re-anchors
 * on every layout shift (scroll inside `ScrollableTier`, window resize)
 * and closes when the anchor scrolls out of view — the popover always
 * stays glued to its source.
 */
function L4GccPctPopover({
  row,
  onCommit,
  onCancel,
}: {
  row: L4WorkforceRow;
  onCommit: (pct: number, reason: string) => void;
  onCancel: () => void;
}) {
  const initialPct = clampPct(row.gccPct);
  const [pct, setPct] = React.useState<number>(initialPct);
  const [reason, setReason] = React.useState<string>(row.gccReason ?? "");
  const popoverRef = React.useRef<HTMLDivElement>(null);
  const [position, setPosition] = React.useState<{
    top: number;
    left: number;
    placement: "below" | "above";
  } | null>(null);

  // The split is computed from the row's static HC + the live `pct` so
  // dragging the slider previews retained vs GCC FTE instantly.
  const livePreview = React.useMemo(
    () => l4Split({ ...row, gccPct: pct }),
    [row, pct],
  );

  // Reset state when the popover opens for a new row.
  React.useEffect(() => {
    setPct(clampPct(row.gccPct));
    setReason(row.gccReason ?? "");
  }, [row.id, row.gccPct, row.gccReason]);

  // Position the popover relative to the L4 box. Re-runs on every scroll
  // or resize so the popover stays glued to its anchor.
  React.useEffect(() => {
    const POPOVER_WIDTH = 320;
    const POPOVER_HEIGHT_EST = 280;
    const MARGIN = 8;

    function reposition() {
      const anchor = document.querySelector(
        `[data-l4="${cssEscape(row.id)}"]`,
      ) as HTMLElement | null;
      if (!anchor) {
        // Anchor gone (row removed, panel unmounted) — close.
        onCancel();
        return;
      }
      const rect = anchor.getBoundingClientRect();
      const viewportH = window.innerHeight;
      const viewportW = window.innerWidth;

      // If the anchor scrolled off-screen, close. The popover should
      // never appear to float alone in space.
      if (
        rect.bottom < 0 ||
        rect.top > viewportH ||
        rect.right < 0 ||
        rect.left > viewportW
      ) {
        onCancel();
        return;
      }

      const spaceBelow = viewportH - rect.bottom - MARGIN;
      const spaceAbove = rect.top - MARGIN;
      const placement: "below" | "above" =
        spaceBelow >= POPOVER_HEIGHT_EST || spaceBelow >= spaceAbove
          ? "below"
          : "above";

      let top =
        placement === "below"
          ? rect.bottom + MARGIN
          : rect.top - POPOVER_HEIGHT_EST - MARGIN;
      // Clamp inside viewport (when neither side has enough room, prefer
      // pinning to the top edge).
      top = Math.max(MARGIN, Math.min(top, viewportH - POPOVER_HEIGHT_EST - MARGIN));

      let left = rect.left;
      // Keep the popover fully on-screen horizontally.
      if (left + POPOVER_WIDTH + MARGIN > viewportW) {
        left = viewportW - POPOVER_WIDTH - MARGIN;
      }
      left = Math.max(MARGIN, left);

      setPosition({ top, left, placement });
    }

    reposition();
    // Listen on capture so the ScrollableTier's overflow-x-auto scroll
    // event reaches us even though it doesn't bubble by default.
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [row.id, onCancel]);

  // Esc / outside-click closes.
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    function onClickOutside(e: MouseEvent) {
      const el = popoverRef.current;
      const anchor = document.querySelector(
        `[data-l4="${cssEscape(row.id)}"]`,
      );
      const target = e.target as Node | null;
      if (!target) return;
      if (el && el.contains(target)) return;
      if (anchor && anchor.contains(target)) return;
      onCancel();
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClickOutside);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, [onCancel, row.id]);

  if (!position) return null;

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label={`Set GCC % for ${row.l4}`}
      style={{
        position: "fixed",
        top: position.top,
        left: position.left,
        width: 320,
        zIndex: 50,
      }}
      className="rounded-lg border border-accent-purple/40 bg-forge-surface p-3 shadow-[0_10px_30px_rgba(0,0,0,0.45)]"
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="block font-display text-xs font-semibold text-forge-ink">
            {row.l4}
          </span>
          <span className="font-mono text-[10px] text-forge-hint">
            {row.l3} · {row.l2}
          </span>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded p-0.5 text-forge-subtle hover:bg-forge-well hover:text-forge-ink"
          aria-label="Close GCC % editor"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </header>

      <div className="mt-3">
        <div className="flex items-baseline justify-between font-mono text-[11px] text-forge-subtle">
          <span>GCC share</span>
          <span className="text-forge-ink">{pct}%</span>
        </div>
        <PercentSlider
          value={pct}
          onChange={setPct}
          hue="purple"
          ariaLabel={`GCC % for ${row.l4}`}
          showValue={false}
          compact
          className="mt-1"
        />
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] tabular-nums text-forge-hint">
          <span>
            <span className="text-accent-amber">
              {livePreview.retainedFte} retained
            </span>
            <span aria-hidden> · </span>
            <span className="text-accent-purple-dark">
              {livePreview.gccFte} to GCC
            </span>
            {" "}
            of {livePreview.totalHc} HC
          </span>
          <div className="flex gap-1">
            {[0, 50, 100].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setPct(preset)}
                className="rounded border border-forge-border bg-forge-well/40 px-1.5 py-0.5 text-forge-subtle transition hover:border-accent-purple/40 hover:text-forge-ink"
                title={`Set to ${preset}%`}
              >
                {preset}%
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3">
        <label className="font-mono text-[10px] uppercase tracking-wider text-forge-hint">
          Reason (≤200 chars)
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value.slice(0, 200))}
          rows={2}
          placeholder="e.g. AP processing — full GCC scope; tier-2 escalations stay onshore."
          className="mt-1 w-full rounded-md border border-forge-border bg-forge-well/60 px-2 py-1.5 text-[12px] text-forge-ink placeholder:text-forge-hint focus:border-accent-purple/40 focus:outline-none"
        />
        <div className="mt-0.5 text-right font-mono text-[10px] text-forge-hint">
          {reason.length}/200
        </div>
      </div>

      <footer className="mt-3 flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-forge-border bg-forge-well/40 px-2.5 py-1 text-xs text-forge-body hover:border-accent-purple/40 hover:text-forge-ink"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onCommit(clampPct(pct), reason.trim())}
          className="rounded-md bg-accent-purple px-2.5 py-1 text-xs font-semibold text-white hover:bg-accent-purple-dark"
        >
          Save
        </button>
      </footer>
    </div>
  );
}

/**
 * Defensive escape for `data-l4` ids used as a CSS attribute selector.
 * Some L4 row ids contain characters (e.g. quotes, brackets) that would
 * otherwise terminate the attribute string. `CSS.escape` lands the job
 * everywhere we need; the fallback covers older runtimes that lack it.
 */
function cssEscape(value: string): string {
  if (typeof window !== "undefined" && typeof CSS !== "undefined" && CSS.escape) {
    return CSS.escape(value);
  }
  return value.replace(/(["\\\\[\\]\(\):])/g, "\\$1");
}

// ===========================================================================
//   Lead sign-off
// ===========================================================================

function Step2LeadSignoff({
  towerName,
  rowsCount,
  reviewedCount,
  locked,
  reviewedAtIso,
  onMarkReviewed,
  onReopen,
  canMarkDone,
}: {
  towerName: string;
  rowsCount: number;
  reviewedCount: number;
  locked: boolean;
  reviewedAtIso?: string;
  onMarkReviewed: () => void;
  onReopen: () => void;
  canMarkDone: boolean;
}) {
  return (
    <section className="mt-6 flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-forge-border bg-forge-surface/70 p-4">
      <div className="min-w-0">
        <p className="font-display text-sm font-semibold text-forge-ink">
          &gt; Reviewed by {towerName} tower lead
        </p>
        <p className="mt-0.5 text-xs text-forge-subtle">
          {locked && reviewedAtIso
            ? `Confirmed ${new Date(reviewedAtIso).toLocaleDateString()}`
            : canMarkDone
              ? `Every row reviewed — ready to lock.`
              : `${reviewedCount} of ${rowsCount} rows reviewed. Set a GCC % for every row to mark Step 2 done.`}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {locked ? (
          <button
            type="button"
            onClick={onReopen}
            className="inline-flex items-center gap-1.5 rounded-md border border-accent-amber/40 bg-accent-amber/10 px-2.5 py-1.5 text-xs font-medium text-accent-amber hover:border-accent-amber/60"
          >
            <Unlock className="h-3.5 w-3.5" aria-hidden />
            Re-open for review
          </button>
        ) : (
          <button
            type="button"
            onClick={onMarkReviewed}
            disabled={!canMarkDone}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent-purple px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-purple-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            Mark Step 2 done
          </button>
        )}
      </div>
    </section>
  );
}

// ===========================================================================
//   Refresh-AI helper — calls /api/offshore-plan/classify (gccPct v3)
// ===========================================================================

async function fetchGccPctSuggestions(
  towerId: TowerId,
  towerName: string,
  rows: L4WorkforceRow[],
): Promise<Map<string, { gccPct: number; reason: string }>> {
  const inputRows = rows.map((r) => ({
    rowId: r.id,
    towerId,
    towerName,
    l2: r.l2,
    l3: r.l3,
    l4: r.l4,
    l5Names: r.l5Activities ?? [],
    headcount: {
      fteOnshore: r.fteOnshore,
      fteOffshore: r.fteOffshore,
      contractorOnshore: r.contractorOnshore,
      contractorOffshore: r.contractorOffshore,
    },
    // Send the row's prior dial so the model can use it as a soft prior.
    dialPct: clampPct(r.gccPct ?? r.offshoreAssessmentPct ?? 0),
    step2Rationale: r.gccReason ?? r.offshoreRationale,
  }));
  const inputHash = await hashRowInputs(towerId, inputRows);
  const res = await fetch("/api/offshore-plan/classify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      inputHash,
      forceRegenerate: false,
      context: {
        primaryGccCity: "Bangalore",
        secondaryGccCity: "Pune",
        contactCenterHub: "Manila",
      },
      rows: inputRows,
    }),
  });
  if (!res.ok) {
    throw new Error(`Classifier returned HTTP ${res.status}.`);
  }
  const json = (await res.json()) as {
    ok?: boolean;
    rows?: { rowId: string; gccPct: number; reason: string }[];
  };
  if (!json.ok || !Array.isArray(json.rows)) {
    throw new Error("Classifier returned an unexpected payload.");
  }
  const out = new Map<string, { gccPct: number; reason: string }>();
  for (const r of json.rows) {
    if (
      typeof r.gccPct === "number" &&
      Number.isFinite(r.gccPct) &&
      typeof r.reason === "string"
    ) {
      out.set(r.rowId, {
        gccPct: clampPct(r.gccPct),
        reason: r.reason.trim().slice(0, 200),
      });
    }
  }
  return out;
}

async function hashRowInputs(
  towerId: TowerId,
  rows: ReadonlyArray<{ rowId: string; l4?: string; dialPct: number }>,
): Promise<string> {
  const canon = JSON.stringify({
    towerId,
    rows: rows
      .map((r) => ({ id: r.rowId, l4: r.l4 ?? "", d: r.dialPct }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  });
  if (typeof crypto === "undefined" || !crypto.subtle) {
    let h = 0;
    for (let i = 0; i < canon.length; i++) {
      h = (Math.imul(31, h) + canon.charCodeAt(i)) | 0;
    }
    return `${towerId}::${(h >>> 0).toString(36)}`;
  }
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canon));
  const hex = Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${towerId}::${hex.slice(0, 16)}`;
}
