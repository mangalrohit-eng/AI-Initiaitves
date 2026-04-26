"use client";

import * as React from "react";
import { ChevronDown, FileJson, FileUp, HardDrive, Info } from "lucide-react";
import { getAssessProgram, setAssessProgram, subscribe } from "@/lib/localStore";
import {
  readAssessProgramFile,
  serializeAssessProgramForDownload,
} from "@/lib/assess/assessProgramIO";
import { downloadBlob } from "@/lib/assess/downloadAssessSamples";
import { useAssessSync } from "@/components/assess/AssessSyncProvider";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { useAsyncOp } from "@/lib/feedback/useAsyncOp";
import { useToast } from "@/components/feedback/ToastProvider";

/**
 * JSON export/import for audit and handoff. When `DATABASE_URL` is set, the server is canonical;
 * import still merges into local state then syncs via the assess API. Rendered as a collapsed
 * disclosure to keep the hub action-focused.
 */
export function AssessPersistencePanel() {
  const sync = useAssessSync();
  const toast = useToast();
  const [, setTick] = React.useState(0);
  const [open, setOpen] = React.useState(false);
  const [confirmImportOpen, setConfirmImportOpen] = React.useState(false);
  const [pendingFile, setPendingFile] = React.useState<File | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(
    () => subscribe("assessProgram", () => setTick((n) => n + 1)),
    [],
  );

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

  const onExport = () => {
    void exportOp.fire();
  };

  const onPickImport = () => {
    fileRef.current?.click();
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setPendingFile(f);
    setConfirmImportOpen(true);
  };

  return (
    <div
      id="assess-persistence"
      className="mt-6 scroll-mt-20 rounded-2xl border border-forge-border bg-forge-surface/60"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="inline-flex items-center gap-2 text-sm font-medium text-forge-ink">
          <HardDrive className="h-4 w-4 text-forge-subtle" aria-hidden />
          Backup and restore
          <span className="hidden text-xs text-forge-subtle sm:inline">
            (JSON export / import{sync?.canSync ? " · cloud sync on" : " · local only"})
          </span>
        </span>
        <ChevronDown
          className={
            "h-4 w-4 text-forge-subtle transition-transform " +
            (open ? "rotate-180" : "")
          }
          aria-hidden
        />
      </button>
      {open ? (
        <div className="border-t border-forge-border px-4 py-4">
          <p className="text-xs leading-relaxed text-forge-subtle">
            {sync?.canSync ? (
              <>
                The <strong className="font-medium text-forge-body">workshop state is saved to your
                Postgres</strong> (see <code className="font-mono">DATABASE_URL</code>) whenever
                you change data. This browser also mirrors it in local storage. Use JSON export
                to snapshot for SharePoint, Teams, or email.
              </>
            ) : (
              <>
                With no <code className="font-mono">DATABASE_URL</code>, assess data stays in this
                browser (local storage) only. Set a cloud dev database in{" "}
                <code className="font-mono">.env.local</code> and run the migration to enable
                shared persistence. JSON export still backs up everything for handoff.
              </>
            )}
          </p>
          <div className="mt-2 flex items-start gap-2 rounded-lg border border-accent-teal/20 bg-forge-well/40 p-2.5 text-[11px] text-forge-subtle">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-teal" aria-hidden />
            <p>
              Production: add <code className="font-mono">DATABASE_URL</code> in Vercel and run
              the same SQL migration so all signed-in users read and write the same assess row.
            </p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onExport}
              disabled={exportOp.state === "loading"}
              className="inline-flex items-center gap-2 rounded-lg border border-forge-border bg-forge-surface px-3 py-2 text-sm text-forge-body hover:border-accent-purple/35 disabled:opacity-60"
            >
              <FileJson className="h-4 w-4 text-accent-purple" />
              {exportOp.state === "loading"
                ? "Exporting..."
                : "Export all towers (JSON backup)"}
            </button>
            <button
              type="button"
              onClick={onPickImport}
              disabled={importOp.state === "loading"}
              className="inline-flex items-center gap-2 rounded-lg border border-forge-border bg-forge-surface px-3 py-2 text-sm text-forge-body hover:border-accent-purple/35 disabled:opacity-60"
            >
              <FileUp className="h-4 w-4 text-accent-teal" />
              {importOp.state === "loading" ? "Importing..." : "Import from JSON"}
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
          if (ok === undefined) {
            // error already toasted by the hook; nothing to do
          } else {
            toast.info({
              title: "Workshop state replaced",
              description: pendingFile?.name ?? undefined,
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
    </div>
  );
}
