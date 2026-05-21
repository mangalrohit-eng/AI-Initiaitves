"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useToast } from "@/components/feedback/ToastProvider";
import { useAssessSync } from "@/components/assess/AssessSyncProvider";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import {
  getAssessProgram,
  subscribe,
} from "@/lib/localStore";
import type {
  AssessProgramV2,
  L3WorkforceRowV6,
  TowerId,
} from "@/data/assess/types";
import type { Tower } from "@/data/types";
import {
  buildInitiativeUploadTemplateCsv,
  parseInitiativeUploadFile,
  type ParsedInitiativeUploadFile,
  type ParsedInitiativeUploadRow,
} from "@/lib/assess/parseInitiativeUploadFile";
import {
  clearLLMInitiativesForTower,
  clearManualInitiativesForTower,
  countAllManualInitiatives,
  runEnrichmentFromUpload,
  type RunEnrichmentSummary,
} from "@/lib/assess/curationPipelineV6";
import type { TowerInitiativeMode } from "@/lib/initiatives/towerMode";
import { cn } from "@/lib/utils";

/**
 * Step 4 facilitator tool — upload a pre-made list of AI Solutions and
 * enrich each row into a full initiative card via the LLM. The user
 * supplies `solutionName` + `solutionDescription` (+ optional `L3` and
 * `tech`); the LLM does NOT propose new solutions, it only polishes
 * the user's text into Versant-voice tagline + rationale, picks
 * feasibility + icon + vendor, and (when needed) auto-matches the L3.
 *
 * INCREMENTAL — each upload adds to the manual slate; rows whose
 * `(name, description, tech)` fingerprint already lives on the tower
 * are skipped. Re-uploading the same xlsx is a no-op (all rows
 * skipped). Editing a row in the xlsx then re-uploading lands the
 * edited row as a new card. The two pipelines (manual upload vs.
 * LLM discovery) are source-exclusive — this panel is hard-greyed
 * when the tower has LLM-discovered cards. To switch into
 * user-uploaded mode, the lead clears the LLM slate first.
 *
 * Stamps every enriched initiative with `source: "manual"` so the
 * gallery shows an "Uploaded" badge. Brief generation stays unchanged
 * — once cards land, the user clicks "Generate N missing briefs" to
 * fill the brief cache. The two pipelines remain separate calls.
 */
export function UploadInitiativesPanel({
  tower,
  compact = false,
  initiativeMode = "empty",
}: {
  tower: Tower;
  compact?: boolean;
  /**
   * Source-exclusivity mode for the tower. When `"llm-discovered"`,
   * the upload button is hard-greyed and a "Clear LLM cards"
   * affordance is shown so the lead can switch modes explicitly.
   * Defaults to `"empty"` so the panel still works when rendered
   * outside the WorkshopToolsDrawer (single-tower demo / tests).
   */
  initiativeMode?: TowerInitiativeMode;
}) {
  const toast = useToast();
  const sync = useAssessSync();
  const towerId = tower.id as TowerId;
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [program, setProgram] = React.useState<AssessProgramV2 | null>(null);

  const [parsed, setParsed] = React.useState<ParsedInitiativeUploadFile | null>(
    null,
  );
  const [fileLabel, setFileLabel] = React.useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [running, setRunning] = React.useState(false);
  const [progress, setProgress] = React.useState<{
    enriched: number;
    total: number;
  }>({ enriched: 0, total: 0 });
  const [clearOpen, setClearOpen] = React.useState(false);
  const [clearing, setClearing] = React.useState(false);
  const [clearLlmOpen, setClearLlmOpen] = React.useState(false);
  const [clearingLlm, setClearingLlm] = React.useState(false);
  const cancelRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    setProgram(getAssessProgram());
    return subscribe("assessProgram", () => setProgram(getAssessProgram()));
  }, []);

  const l3Roster = React.useMemo(() => {
    return program?.towers[towerId]?.l3Rows ?? [];
  }, [program, towerId]);
  const l3Labels = React.useMemo(() => l3Roster.map((r) => r.l3), [l3Roster]);
  const manualCount = React.useMemo(() => {
    if (!program) return 0;
    return countAllManualInitiatives(towerId);
  }, [program, towerId]);
  /**
   * Count of LLM-discovered + deterministic-fallback initiatives on
   * the tower. When `> 0`, the tower is in `"llm-discovered"` mode and
   * the upload button is hard-greyed — the lead must clear the LLM
   * slate first via the explicit "Clear LLM cards" affordance.
   */
  const llmCount = React.useMemo(() => {
    let n = 0;
    for (const r of l3Roster) {
      for (const it of r.l3Initiatives ?? []) {
        if (it.source === "llm" || it.source === "fallback") n += 1;
      }
    }
    return n;
  }, [l3Roster]);

  const modeBlocked = initiativeMode === "llm-discovered";

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".csv") && !lower.endsWith(".xlsx")) {
      toast.error({
        title: "Wrong file type",
        description: "Upload a .csv or .xlsx file.",
      });
      return;
    }
    if (l3Roster.length === 0) {
      toast.error({
        title: "No L3 Job Families yet",
        description:
          "Import the capability map on Step 1 before uploading initiatives — every initiative attaches to an L3 row.",
      });
      return;
    }
    if (modeBlocked) {
      toast.error({
        title: "Tower is in LLM-discovered mode",
        description:
          "Clear the LLM cards first to switch into upload mode — uploaded and LLM-discovered initiatives can't coexist on the same tower.",
      });
      return;
    }
    try {
      const result = await parseInitiativeUploadFile(file, l3Labels);
      setParsed(result);
      setFileLabel(file.name);
      if (result.rows.length === 0) {
        toast.error({
          title: "No usable rows",
          description:
            result.errors[0] ??
            "Every row was missing Solution Name or Solution Description.",
        });
        return;
      }
      setPreviewOpen(true);
    } catch (err) {
      toast.error({
        title: "Couldn't parse file",
        description:
          err instanceof Error ? err.message : "Unknown parse error.",
      });
    }
  };

  const onDownloadTemplate = () => {
    const csv = buildInitiativeUploadTemplateCsv(l3Labels);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${towerId}-initiatives-template.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const onEnrich = async () => {
    if (!parsed || parsed.rows.length === 0) return;
    cancelRef.current = new AbortController();
    setRunning(true);
    setProgress({ enriched: 0, total: parsed.rows.length });
    setPreviewOpen(false);

    let summary: RunEnrichmentSummary | undefined;
    try {
      summary = await runEnrichmentFromUpload(
        {
          towerId,
          parsedRows: parsed.rows,
          flushSave: sync?.flushSave,
          signal: cancelRef.current.signal,
        },
        (p) => {
          setProgress({
            enriched: p.enriched + p.failed,
            total: p.total,
          });
        },
      );
    } catch (e) {
      toast.error({
        title: "Couldn't enrich uploads",
        description: e instanceof Error ? e.message : "Unknown error.",
      });
      setRunning(false);
      setProgress({ enriched: 0, total: 0 });
      cancelRef.current = null;
      return;
    }

    setRunning(false);
    setProgress({ enriched: 0, total: 0 });
    cancelRef.current = null;

    if (!summary) return;
    const total = summary.totalUploads;
    const llmL3 = summary.llmMatchedL3Count;
    const skipped = summary.skippedDuplicates;

    if (summary.failed > 0 && summary.enriched === 0 && skipped === 0) {
      toast.error({
        title: "Enrichment failed",
        description:
          summary.warning ??
          `User-supplied text passed through verbatim for ${summary.failed} initiative${summary.failed === 1 ? "" : "s"}. Try again when the LLM is reachable.`,
      });
      setParsed(null);
      setFileLabel(null);
      return;
    }

    // Idempotent re-upload: nothing new, everything skipped. Surface
    // this as info — no error, no success.
    if (summary.enriched === 0 && skipped === total && total > 0) {
      toast.info({
        title: "Nothing new to add",
        description: `All ${total} initiative${total === 1 ? " was" : "s were"} already on the tower. Edit the file and re-upload to add new entries.`,
        durationMs: 8000,
      });
      setParsed(null);
      setFileLabel(null);
      return;
    }

    const notes: string[] = [];
    if (skipped > 0) {
      notes.push(
        `skipped ${skipped} already on tower`,
      );
    }
    if (llmL3 > 0) {
      notes.push(
        `LLM auto-matched the L3 for ${llmL3} row${llmL3 === 1 ? "" : "s"}`,
      );
    }

    toast.success({
      title: `Added ${summary.enriched} new initiative${summary.enriched === 1 ? "" : "s"}`,
      description:
        (notes.length > 0 ? `${notes.join("; ")}. ` : "") +
        "Run the Generate AI Solution briefs step next to fill the six-section narrative for each.",
      durationMs: 10000,
    });
    setParsed(null);
    setFileLabel(null);
  };

  const onCancel = () => {
    cancelRef.current?.abort();
  };

  const onClearAll = async () => {
    setClearing(true);
    let removed = 0;
    try {
      removed = clearManualInitiativesForTower(towerId);
      if (sync?.flushSave) {
        try {
          await sync.flushSave();
        } catch {
          // best-effort; debounce will retry.
        }
      }
    } finally {
      setClearing(false);
      setClearOpen(false);
    }
    if (removed > 0) {
      toast.success({
        title: `${removed} uploaded initiative${removed === 1 ? "" : "s"} cleared`,
        description:
          "Manual entries removed. Run Regenerate AI guidance to repopulate the affected Job Families from discovery.",
        durationMs: 8000,
      });
    } else {
      toast.info({
        title: "Nothing to clear",
        description: "This tower has no uploaded initiatives.",
      });
    }
  };

  const onClearLlm = async () => {
    setClearingLlm(true);
    let removed = 0;
    try {
      removed = clearLLMInitiativesForTower(towerId);
      if (sync?.flushSave) {
        try {
          await sync.flushSave();
        } catch {
          // best-effort; debounce will retry.
        }
      }
    } finally {
      setClearingLlm(false);
      setClearLlmOpen(false);
    }
    if (removed > 0) {
      toast.success({
        title: `${removed} LLM-discovered card${removed === 1 ? "" : "s"} cleared`,
        description:
          "Tower is now empty. Upload a CSV/XLSX to add initiatives, or run Regenerate AI guidance to discover a fresh slate.",
        durationMs: 8000,
      });
    } else {
      toast.info({
        title: "Nothing to clear",
        description: "This tower has no LLM-discovered cards.",
      });
    }
  };

  const disabled = running || l3Roster.length === 0 || modeBlocked;

  return (
    <>
      <div
        className={cn(
          "flex flex-col gap-2",
          compact
            ? ""
            : "rounded-xl border border-forge-border bg-near-black/30 p-3",
        )}
      >
        {!compact ? (
          <div className="flex items-start gap-2.5 min-w-0">
            <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-accent-teal/40 bg-accent-teal/10 text-accent-teal">
              <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden />
            </span>
            <div className="min-w-0">
              <div className="font-display text-sm font-semibold text-forge-ink">
                Upload initiatives list
              </div>
              <div className="mt-0.5 text-[11px] leading-relaxed text-forge-subtle">
                Bring a pre-made CSV/XLSX of AI Solutions. The LLM enriches each row into a full card — it does not propose new solutions.
              </div>
            </div>
          </div>
        ) : (
          <div className="text-[11px] leading-relaxed text-forge-subtle">
            CSV/XLSX with columns:{" "}
            <span className="font-mono text-forge-body">L3 (optional)</span>,{" "}
            <span className="font-mono text-forge-body">Solution Name</span>,{" "}
            <span className="font-mono text-forge-body">Solution Description</span>,{" "}
            <span className="font-mono text-forge-body">Tech (optional)</span>.
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            title={
              l3Roster.length === 0
                ? "Import the capability map first — initiatives attach to L3 rows."
                : modeBlocked
                  ? `Disabled — tower has ${llmCount} LLM-discovered card${llmCount === 1 ? "" : "s"}. Clear them first to switch into upload mode.`
                  : "Upload a CSV or XLSX file"
            }
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border border-accent-teal/50 bg-accent-teal/10 px-3 py-1.5 text-xs font-semibold text-accent-teal transition",
              "hover:border-accent-teal hover:bg-accent-teal/20",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal/40",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            {running ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Upload className="h-3.5 w-3.5" aria-hidden />
            )}
            {running && progress.total > 0
              ? `Enriching ${progress.enriched}/${progress.total}…`
              : "Upload .csv / .xlsx"}
          </button>
          <button
            type="button"
            onClick={onDownloadTemplate}
            disabled={running}
            className="inline-flex items-center gap-1.5 rounded-lg border border-forge-border bg-near-black/40 px-2.5 py-1.5 text-[11px] font-medium text-forge-body transition hover:border-accent-teal/40 hover:text-forge-ink disabled:cursor-not-allowed disabled:opacity-50"
            title="Download a CSV template with 3 example rows seeded from this tower's L3 roster."
          >
            <Download className="h-3 w-3" aria-hidden />
            Template
          </button>
          {manualCount > 0 && !running ? (
            <button
              type="button"
              onClick={() => setClearOpen(true)}
              disabled={clearing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-accent-red/40 bg-accent-red/5 px-2.5 py-1.5 text-[11px] font-medium text-accent-red transition hover:border-accent-red hover:bg-accent-red/15 disabled:cursor-not-allowed disabled:opacity-50"
              title={`Hard-delete every uploaded initiative on this tower (${manualCount} total). LLM-discovered cards are untouched.`}
            >
              {clearing ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              ) : (
                <Trash2 className="h-3 w-3" aria-hidden />
              )}
              Clear uploaded
              <span className="ml-0.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-accent-red/15 px-1 font-mono text-[10px] text-accent-red">
                {manualCount}
              </span>
            </button>
          ) : null}
          {running ? (
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center gap-1.5 rounded-lg border border-accent-red/40 bg-accent-red/10 px-2.5 py-1.5 text-[11px] font-medium text-accent-red transition hover:bg-accent-red/20"
              title="Stop after in-flight rows finish."
            >
              <X className="h-3 w-3" aria-hidden />
              Cancel
            </button>
          ) : null}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx"
            className="sr-only"
            onChange={onPickFile}
            aria-hidden
            tabIndex={-1}
          />
        </div>

        {modeBlocked && !running ? (
          <div
            className="mt-1 flex items-start gap-2.5 rounded-lg border border-accent-amber/40 bg-accent-amber/5 px-3 py-2 text-[11px] leading-relaxed text-forge-body"
            role="status"
          >
            <AlertTriangle
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-amber"
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-forge-ink">
                Upload disabled — tower is in LLM-discovered mode
              </div>
              <div className="mt-0.5 text-forge-subtle">
                <span className="font-mono text-forge-body">{llmCount}</span>{" "}
                LLM-discovered card{llmCount === 1 ? "" : "s"}{" "}
                on this tower. Uploaded and LLM-discovered initiatives can&rsquo;t
                coexist — clear the LLM slate first to switch modes.
              </div>
              <button
                type="button"
                onClick={() => setClearLlmOpen(true)}
                disabled={clearingLlm}
                className="mt-1.5 inline-flex items-center gap-1.5 rounded-md border border-accent-amber/50 bg-accent-amber/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-accent-amber transition hover:border-accent-amber hover:bg-accent-amber/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {clearingLlm ? (
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                ) : (
                  <Trash2 className="h-3 w-3" aria-hidden />
                )}
                Clear LLM cards
                <span className="ml-0.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-accent-amber/20 px-1 font-mono text-[10px] text-accent-amber">
                  {llmCount}
                </span>
              </button>
            </div>
          </div>
        ) : null}

        {running ? (
          <div
            className="mt-1 flex items-start gap-2 rounded-lg border border-accent-teal/30 bg-near-black/40 px-3 py-2 text-[11px] leading-relaxed text-forge-body"
            role="status"
            aria-live="polite"
          >
            <Loader2
              className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-accent-teal"
              aria-hidden
            />
            <span className="min-w-0">
              <span className="font-mono uppercase tracking-[0.14em] text-accent-teal">
                &gt; Enriching
              </span>{" "}
              <span className="font-mono text-forge-ink">
                {progress.enriched}
              </span>{" "}
              of{" "}
              <span className="font-mono text-forge-ink">{progress.total}</span>{" "}
              uploads. Cards attach to the matched L3 as they land.
            </span>
          </div>
        ) : null}
      </div>

      {parsed && previewOpen ? (
        <PreviewModal
          parsed={parsed}
          fileLabel={fileLabel ?? ""}
          l3Roster={l3Roster}
          onConfirm={onEnrich}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}

      <ConfirmDialog
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        onConfirm={onClearAll}
        title={`Clear all uploaded initiatives on ${tower.name}?`}
        confirmLabel="Clear uploaded"
        cancelLabel="Cancel"
        variant="destructive"
        busy={clearing}
        description={
          <div className="space-y-2 text-sm leading-relaxed text-forge-body">
            <p>
              This hard-deletes{" "}
              <span className="font-mono text-accent-red">{manualCount}</span>{" "}
              uploaded initiative{manualCount === 1 ? "" : "s"} across every Job
              Family on this tower, along with any approve/reject decisions on
              those cards. LLM-discovered cards stay put.
            </p>
            <p className="text-xs text-forge-subtle">
              Use this after a wrong upload, or to switch the tower into
              LLM-discovered mode. To repopulate from discovery, run{" "}
              <span className="font-semibold text-forge-ink">
                Regenerate AI guidance
              </span>{" "}
              next.
            </p>
          </div>
        }
      />

      <ConfirmDialog
        open={clearLlmOpen}
        onClose={() => setClearLlmOpen(false)}
        onConfirm={onClearLlm}
        title={`Clear all LLM-discovered cards on ${tower.name}?`}
        confirmLabel="Clear LLM cards"
        cancelLabel="Cancel"
        variant="destructive"
        busy={clearingLlm}
        description={
          <div className="space-y-2 text-sm leading-relaxed text-forge-body">
            <p>
              This hard-deletes{" "}
              <span className="font-mono text-accent-red">{llmCount}</span>{" "}
              LLM-discovered &amp; deterministic-fallback card
              {llmCount === 1 ? "" : "s"} on this tower, along with any
              approve/reject decisions on them. Uploaded cards aren&rsquo;t
              affected (there are none right now).
            </p>
            <p className="text-xs text-forge-subtle">
              After clearing, the tower switches into user-uploaded mode and
              you can upload a CSV/XLSX of initiatives. To re-discover from
              the LLM later, clear your uploads and run{" "}
              <span className="font-semibold text-forge-ink">
                Regenerate AI guidance
              </span>
              .
            </p>
          </div>
        }
      />
    </>
  );
}

// ===========================================================================
//   Preview modal — shows the parsed rows with L3 detection + warnings
// ===========================================================================

function PreviewModal({
  parsed,
  fileLabel,
  l3Roster,
  onConfirm,
  onClose,
}: {
  parsed: ParsedInitiativeUploadFile;
  fileLabel: string;
  l3Roster: ReadonlyArray<L3WorkforceRowV6>;
  onConfirm: () => void;
  onClose: () => void;
}) {
  // ESC-to-close + scroll-lock + portal-to-body. We deliberately do NOT
  // use the native <dialog> element here: this modal mounts inside the
  // WorkshopToolsDrawer's framer-motion AnimatePresence, and motion adds
  // `will-change` on the animating parent, which creates a stacking
  // context that prevents the native dialog's top-layer escape on some
  // Chromium versions. The portal renders the modal at document.body so
  // it sits above every drawer / chrome element regardless of where the
  // owning component lives in the tree.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const rosterByNormalizedL3 = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const r of l3Roster) {
      const norm = normalize(r.l3);
      if (norm) map.set(norm, r.l3);
    }
    return map;
  }, [l3Roster]);

  const rowsWithMeta = parsed.rows.map((row) => {
    const normalized = normalize(row.l3Raw);
    const matchedL3Name = normalized
      ? rosterByNormalizedL3.get(normalized)
      : undefined;
    const matchKind: "exact" | "hint-miss" | "blank" = !row.l3Raw
      ? "blank"
      : matchedL3Name
        ? "exact"
        : "hint-miss";
    return {
      ...row,
      matchedL3Name: matchedL3Name ?? null,
      matchKind,
    };
  });

  const exactMatches = rowsWithMeta.filter((r) => r.matchKind === "exact").length;
  const llmMatches = rowsWithMeta.filter((r) => r.matchKind !== "exact").length;
  const offAllowlistVendors = rowsWithMeta.filter((r) =>
    r.diagnostics.some((d) => d.includes("vendor")),
  ).length;

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Review upload — ${parsed.rows.length} initiative${parsed.rows.length === 1 ? "" : "s"}`}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl rounded-2xl border border-forge-border bg-forge-surface text-forge-ink shadow-card">
        <div className="flex max-h-[80vh] flex-col">
        <div className="flex items-start justify-between gap-3 border-b border-forge-border/60 px-5 py-4">
          <div>
            <h2 className="font-display text-base font-semibold leading-snug text-forge-ink">
              Review upload — {parsed.rows.length} initiative
              {parsed.rows.length === 1 ? "" : "s"}
            </h2>
            <p className="mt-1 text-xs text-forge-subtle">
              Parsed from{" "}
              <span className="font-mono text-forge-body">{fileLabel}</span>.
              The LLM will preserve every Solution Name verbatim and enrich the
              rest.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="rounded-md p-1 text-forge-subtle transition hover:bg-forge-well hover:text-forge-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-forge-border/40 bg-near-black/30 px-5 py-3 text-[11px]">
          <SummaryChip
            tone="teal"
            icon={<CheckCircle2 className="h-3 w-3" aria-hidden />}
          >
            <span className="font-mono">{exactMatches}</span> exact L3 match
            {exactMatches === 1 ? "" : "es"}
          </SummaryChip>
          {llmMatches > 0 ? (
            <SummaryChip
              tone="purple"
              icon={<Sparkles className="h-3 w-3" aria-hidden />}
            >
              <span className="font-mono">{llmMatches}</span> LLM-matched L3
            </SummaryChip>
          ) : null}
          {offAllowlistVendors > 0 ? (
            <SummaryChip
              tone="amber"
              icon={<AlertTriangle className="h-3 w-3" aria-hidden />}
            >
              <span className="font-mono">{offAllowlistVendors}</span> vendor
              {offAllowlistVendors === 1 ? "" : "s"} off allow-list
            </SummaryChip>
          ) : null}
          {parsed.errors.length > 0 ? (
            <SummaryChip
              tone="red"
              icon={<X className="h-3 w-3" aria-hidden />}
            >
              <span className="font-mono">{parsed.errors.length}</span> row
              {parsed.errors.length === 1 ? "" : "s"} excluded
            </SummaryChip>
          ) : null}
        </div>

        {parsed.errors.length > 0 ? (
          <div className="border-b border-forge-border/40 bg-accent-red/5 px-5 py-2 text-[11px] leading-relaxed text-forge-body">
            {parsed.errors.slice(0, 3).map((err, i) => (
              <div key={i}>
                <span className="font-semibold text-accent-red">×</span> {err}
              </div>
            ))}
            {parsed.errors.length > 3 ? (
              <div className="text-forge-subtle">
                … {parsed.errors.length - 3} more error
                {parsed.errors.length - 3 === 1 ? "" : "s"}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-forge-surface/95 backdrop-blur">
              <tr className="border-b border-forge-border/60 text-[10px] font-mono uppercase tracking-[0.14em] text-forge-hint">
                <th className="px-4 py-2">Row</th>
                <th className="px-4 py-2">L3</th>
                <th className="px-4 py-2">Solution name</th>
                <th className="px-4 py-2">Tech</th>
                <th className="px-4 py-2">Diagnostics</th>
              </tr>
            </thead>
            <tbody>
              {rowsWithMeta.map((row) => (
                <PreviewRow key={row.index} row={row} />
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-forge-border/60 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-forge-border bg-forge-surface px-3 py-2 text-sm font-medium text-forge-body transition hover:border-forge-border-strong"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={parsed.rows.length === 0}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg bg-accent-teal px-4 py-2 text-sm font-semibold text-near-black transition hover:bg-accent-teal/85",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Add {parsed.rows.length} initiative{parsed.rows.length === 1 ? "" : "s"}
          </button>
        </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function PreviewRow({
  row,
}: {
  row: ParsedInitiativeUploadRow & {
    matchedL3Name: string | null;
    matchKind: "exact" | "hint-miss" | "blank";
  };
}) {
  return (
    <tr className="border-b border-forge-border/30 align-top">
      <td className="px-4 py-2 font-mono text-[10px] text-forge-hint">
        {row.index}
      </td>
      <td className="px-4 py-2">
        {row.matchKind === "exact" ? (
          <span
            className="inline-flex items-center gap-1 rounded-full border border-accent-teal/40 bg-accent-teal/5 px-2 py-0.5 text-[10px] font-mono text-accent-teal"
            title="Matched to an existing L3 Job Family by name."
          >
            <CheckCircle2 className="h-2.5 w-2.5" aria-hidden />
            <span className="normal-case tracking-normal">
              {row.matchedL3Name}
            </span>
          </span>
        ) : row.matchKind === "hint-miss" ? (
          <span
            className="inline-flex items-center gap-1 rounded-full border border-accent-amber/40 bg-accent-amber/5 px-2 py-0.5 text-[10px] font-mono text-accent-amber"
            title={`"${row.l3Raw}" doesn't match any L3 — LLM will pick the best fit.`}
          >
            <AlertTriangle className="h-2.5 w-2.5" aria-hidden />
            <span className="normal-case tracking-normal">{row.l3Raw}</span>
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1 rounded-full border border-accent-purple/40 bg-accent-purple/5 px-2 py-0.5 text-[10px] font-mono text-accent-purple-light"
            title="No L3 supplied — LLM will auto-match from the tower roster."
          >
            <Sparkles className="h-2.5 w-2.5" aria-hidden />
            <span className="normal-case tracking-normal">LLM auto-match</span>
          </span>
        )}
      </td>
      <td className="px-4 py-2">
        <div className="font-semibold text-forge-ink">{row.solutionName}</div>
        <div className="text-[11px] leading-snug text-forge-subtle line-clamp-2">
          {row.solutionDescription}
        </div>
      </td>
      <td className="px-4 py-2 text-forge-body">
        {row.tech ? (
          <span className="font-mono text-[11px]">{row.tech}</span>
        ) : (
          <span className="text-forge-hint">—</span>
        )}
      </td>
      <td className="px-4 py-2 text-[10px] text-forge-subtle">
        {row.diagnostics.length === 0 ? (
          <span className="text-forge-hint">Clean</span>
        ) : (
          <ul className="list-disc pl-3">
            {row.diagnostics.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        )}
      </td>
    </tr>
  );
}

function SummaryChip({
  tone,
  icon,
  children,
}: {
  tone: "teal" | "purple" | "amber" | "red";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const cls =
    tone === "teal"
      ? "border-accent-teal/40 bg-accent-teal/5 text-accent-teal"
      : tone === "purple"
        ? "border-accent-purple/40 bg-accent-purple/5 text-accent-purple-light"
        : tone === "amber"
          ? "border-accent-amber/40 bg-accent-amber/5 text-accent-amber"
          : "border-accent-red/40 bg-accent-red/5 text-accent-red";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium",
        cls,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
