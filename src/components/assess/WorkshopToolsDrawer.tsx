"use client";

import * as React from "react";
import {
  AlertTriangle,
  ChevronDown,
  Download,
  FileJson,
  FileSpreadsheet,
  FileUp,
  HardDrive,
  RefreshCw,
  Sparkles,
  Wrench,
} from "lucide-react";
import { useAssessSync } from "@/components/assess/AssessSyncProvider";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { useToast } from "@/components/feedback/ToastProvider";
import { useAsyncOp } from "@/lib/feedback/useAsyncOp";
import { buildSeededAssessProgramV2 } from "@/data/assess/seedAssessProgram";
import { downloadAllTowersSampleWorkbook, downloadBlob } from "@/lib/assess/downloadAssessSamples";
import {
  readAssessProgramFile,
  serializeAssessProgramForDownload,
} from "@/lib/assess/assessProgramIO";
import { getAssessProgram, setAssessProgram } from "@/lib/localStore";
import { getPortalAudience, isInternalSurfaceAllowed } from "@/lib/portalAudience";

type Section = "samples" | "backup" | "reseed";

/**
 * Single quiet drawer that consolidates all three secondary surfaces — Templates
 * and samples, Backup and restore, and Admin re-seed.
 *
 * Renders at the bottom of the Capability Map and Assessment hubs, collapsed by
 * default so the page stays focused on the live workshop. Internal-only
 * facilities (Re-seed) are hidden when the portal audience is external.
 */
export function WorkshopToolsDrawer() {
  const sync = useAssessSync();
  const toast = useToast();
  const allowedInternal = isInternalSurfaceAllowed(getPortalAudience());
  const [open, setOpen] = React.useState(false);
  const [section, setSection] = React.useState<Section>("samples");
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [confirmImportOpen, setConfirmImportOpen] = React.useState(false);
  const [pendingFile, setPendingFile] = React.useState<File | null>(null);
  const [confirmReseedOpen, setConfirmReseedOpen] = React.useState(false);

  const sampleLoadOp = useAsyncOp<void, []>({
    run: async () => {
      setAssessProgram(buildSeededAssessProgramV2());
      if (sync?.canSync) await sync.flushSave();
    },
    messages: {
      loadingTitle: "Loading sample workshop across 13 towers",
      successTitle: "Sample workshop loaded",
      successDescription: "All 13 towers seeded with capability maps, footprint, and starter dials.",
      errorTitle: "Couldn't load sample",
    },
  });

  const sampleWorkbookOp = useAsyncOp<void, []>({
    run: async () => {
      await downloadAllTowersSampleWorkbook();
    },
    messages: {
      loadingTitle: "Building 13-tower sample workbook...",
      successTitle: "Sample workbook downloaded",
      successDescription: "Excel file with one sheet per tower.",
      errorTitle: "Couldn't generate workbook",
    },
  });

  const exportOp = useAsyncOp<void, []>({
    run: async () => {
      const p = getAssessProgram();
      const body = serializeAssessProgramForDownload(p);
      const name = `forge-assess-backup-${new Date().toISOString().slice(0, 10)}.json`;
      downloadBlob(name, body, "application/json;charset=utf-8");
    },
    messages: {
      loadingTitle: "Building JSON backup",
      successTitle: "Backup downloaded",
      successDescription:
        "Store the JSON in SharePoint, Teams, or email if multiple leads need the same view.",
      errorTitle: "Couldn't export backup",
    },
  });

  const importOp = useAsyncOp<void, [File]>({
    run: async (f) => {
      const r = await readAssessProgramFile(f);
      if (!r.ok) throw new Error(r.error);
      setAssessProgram(r.program);
      if (sync?.canSync) await sync.flushSave();
    },
    messages: {
      loadingTitle: "Importing JSON backup",
      loadingDescription: "Replacing the workshop state with the file's contents...",
      successTitle: "Backup imported",
      successDescription: () =>
        sync?.canSync
          ? "Loaded and saved to the database. The file is still useful as a snapshot."
          : "Loaded into this browser. Set DATABASE_URL to sync to other devices.",
      errorTitle: "Couldn't import backup",
    },
  });

  const reseedOp = useAsyncOp<{ towers: number }, []>({
    run: async () => {
      const r = await fetch("/api/assess/seed", { method: "POST", credentials: "include" });
      const data = (await r.json().catch(() => ({}))) as {
        ok?: boolean;
        towers?: number;
        error?: string;
      };
      if (!r.ok || !data.ok) {
        throw new Error(data.error ?? `Re-seed failed (HTTP ${r.status})`);
      }
      if (sync) await sync.refetch();
      return { towers: data.towers ?? 0 };
    },
    messages: {
      loadingTitle: "Re-seeding workshop from latest defaults",
      loadingDescription: "Rebuilding L1-L4 maps and starter heuristic for all 13 towers...",
      successTitle: ({ towers }) => `Re-seeded ${towers} towers from latest defaults`,
      successDescription:
        "All footprint, dials, and scenario state were replaced. Cost-weighted baselines recomputed.",
      errorTitle: "Re-seed failed",
    },
    retryable: true,
  });

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setPendingFile(f);
    setConfirmImportOpen(true);
  };

  const dbReady = sync?.canSync ?? false;

  return (
    <section
      id="workshop-tools"
      className="mt-12 rounded-2xl border border-forge-border bg-forge-surface/40"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="inline-flex items-center gap-2">
          <Wrench className="h-3.5 w-3.5 text-forge-hint" aria-hidden />
          <span className="font-mono text-[11px] uppercase tracking-wider text-forge-subtle">
            Workshop tools
          </span>
          <span className="text-xs text-forge-hint">
            templates, backup, {allowedInternal ? "admin · " : ""}rarely needed
          </span>
        </span>
        <ChevronDown
          className={"h-3.5 w-3.5 text-forge-hint transition-transform " + (open ? "rotate-180" : "")}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="border-t border-forge-border">
          <div className="flex flex-wrap items-center gap-1 border-b border-forge-border bg-forge-well/30 px-3 py-2 text-xs">
            <SectionTab
              active={section === "samples"}
              onClick={() => setSection("samples")}
              icon={<Download className="h-3 w-3" />}
            >
              Templates &amp; samples
            </SectionTab>
            <SectionTab
              active={section === "backup"}
              onClick={() => setSection("backup")}
              icon={<HardDrive className="h-3 w-3" />}
            >
              Backup &amp; restore
            </SectionTab>
            {allowedInternal ? (
              <SectionTab
                active={section === "reseed"}
                onClick={() => setSection("reseed")}
                icon={<Sparkles className="h-3 w-3" />}
              >
                Admin · Re-seed
              </SectionTab>
            ) : null}
          </div>

          <div className="px-4 py-4">
            {section === "samples" ? (
              <div className="space-y-3">
                <p className="text-xs text-forge-subtle">
                  Empty templates and the 13-tower sample workbook for handoff outside the portal.
                </p>
                <div className="flex flex-wrap gap-2">
                  <a
                    href="/assess-tower-template.xlsx"
                    download
                    className="inline-flex items-center gap-2 rounded-lg border border-forge-border bg-forge-surface px-3 py-2 text-xs text-forge-body hover:border-accent-purple/30"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-accent-purple" />
                    Empty template (Excel)
                  </a>
                  <a
                    href="/assess-tower-template.csv"
                    download
                    className="inline-flex items-center gap-2 rounded-lg border border-forge-border bg-forge-surface px-3 py-2 text-xs text-forge-body hover:border-accent-purple/30"
                  >
                    Empty template (CSV)
                  </a>
                  <button
                    type="button"
                    onClick={() => void sampleWorkbookOp.fire()}
                    disabled={sampleWorkbookOp.state === "loading"}
                    className="inline-flex items-center gap-2 rounded-lg border border-forge-border bg-forge-surface px-3 py-2 text-xs text-forge-body hover:border-accent-purple/30 disabled:opacity-60"
                  >
                    <Download className="h-3.5 w-3.5 text-accent-teal" />
                    {sampleWorkbookOp.state === "loading"
                      ? "Building..."
                      : "13-tower sample workbook"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void sampleLoadOp.fire()}
                    disabled={sampleLoadOp.state === "loading"}
                    className="inline-flex items-center gap-2 rounded-lg border border-accent-purple/30 bg-accent-purple/10 px-3 py-2 text-xs font-medium text-accent-purple-dark hover:bg-accent-purple/20 disabled:opacity-60"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    {sampleLoadOp.state === "loading" ? "Loading..." : "Load sample workshop"}
                  </button>
                </div>
              </div>
            ) : null}

            {section === "backup" ? (
              <div className="space-y-3">
                <p className="text-xs text-forge-subtle">
                  {dbReady
                    ? "Workshop state syncs to Postgres on every change. Use JSON export to snapshot for SharePoint, Teams, or email."
                    : "Without DATABASE_URL, assess data stays in this browser only. JSON export still backs up everything for handoff."}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void exportOp.fire()}
                    disabled={exportOp.state === "loading"}
                    className="inline-flex items-center gap-2 rounded-lg border border-forge-border bg-forge-surface px-3 py-2 text-xs text-forge-body hover:border-accent-purple/30 disabled:opacity-60"
                  >
                    <FileJson className="h-3.5 w-3.5 text-accent-purple" />
                    {exportOp.state === "loading" ? "Exporting..." : "Export JSON backup"}
                  </button>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={importOp.state === "loading"}
                    className="inline-flex items-center gap-2 rounded-lg border border-forge-border bg-forge-surface px-3 py-2 text-xs text-forge-body hover:border-accent-purple/30 disabled:opacity-60"
                  >
                    <FileUp className="h-3.5 w-3.5 text-accent-teal" />
                    {importOp.state === "loading" ? "Importing..." : "Import JSON"}
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={onFile}
                  />
                </div>
              </div>
            ) : null}

            {section === "reseed" && allowedInternal ? (
              <div className="space-y-3">
                <div className="flex items-start gap-2 rounded-lg border border-accent-amber/30 bg-accent-amber/5 p-3 text-xs text-forge-body">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-amber" aria-hidden />
                  <div>
                    Overwrites every tower&apos;s footprint, dials, and scenario with the latest
                    L1-L4 maps + starter heuristic. Use after editing the seed files.
                  </div>
                </div>
                {!dbReady ? (
                  <p className="text-xs text-accent-amber">
                    Database not configured. Set <code className="font-mono">DATABASE_URL</code>{" "}
                    and run the migration first.
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={() => setConfirmReseedOpen(true)}
                  disabled={!dbReady || reseedOp.state === "loading"}
                  className="inline-flex items-center gap-2 rounded-lg border border-accent-purple/40 bg-accent-purple/10 px-3 py-2 text-xs font-medium text-accent-purple-dark hover:bg-accent-purple/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {reseedOp.state === "loading"
                    ? "Re-seeding..."
                    : "Re-seed all towers from latest defaults"}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmImportOpen}
        onClose={() => {
          setConfirmImportOpen(false);
          setPendingFile(null);
        }}
        onConfirm={async () => {
          if (!pendingFile) {
            setConfirmImportOpen(false);
            return;
          }
          const f = pendingFile;
          setConfirmImportOpen(false);
          setPendingFile(null);
          const ok = await importOp.fire(f);
          if (ok !== undefined) {
            toast.info({
              title: "Workshop state replaced",
              description: f.name,
            });
          }
        }}
        title="Replace the current workshop with this file?"
        description={
          <>
            All current workshop state (footprint, dials, scenarios) will be replaced by
            the contents of <span className="font-mono">{pendingFile?.name ?? "this file"}</span>.
            Use Export first if you want to keep the current state as a backup.
          </>
        }
        confirmLabel="Yes, replace"
        cancelLabel="Cancel"
        variant="destructive"
        busy={importOp.state === "loading"}
      />

      <ConfirmDialog
        open={confirmReseedOpen}
        onClose={() => setConfirmReseedOpen(false)}
        onConfirm={async () => {
          setConfirmReseedOpen(false);
          await reseedOp.fire();
        }}
        title="Replace the workshop program with the latest seed?"
        description={
          <>
            All 13 towers will be rebuilt from the latest L1-L4 maps and starter heuristic.
            Any edits made in the UI will be replaced. This cannot be undone.
          </>
        }
        confirmLabel="Yes, replace"
        cancelLabel="Cancel"
        variant="destructive"
        confirmPhrase="re-seed"
        busy={reseedOp.state === "loading"}
      />
    </section>
  );
}

function SectionTab({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 transition " +
        (active
          ? "bg-forge-surface text-forge-ink shadow-[0_0_0_1px_rgba(161,0,255,0.2)]"
          : "text-forge-subtle hover:bg-forge-surface hover:text-forge-body")
      }
    >
      {icon}
      {children}
    </button>
  );
}
