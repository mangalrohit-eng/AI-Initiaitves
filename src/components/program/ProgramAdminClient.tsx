"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  FileJson,
  FileUp,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { PageShell } from "@/components/PageShell";
import { useToast } from "@/components/feedback/ToastProvider";
import { useAsyncOp } from "@/lib/feedback/useAsyncOp";
import { useAssessSync } from "@/components/assess/AssessSyncProvider";
import { defaultTowerRates } from "@/data/assess/types";
import { towers } from "@/data/towers";
import {
  getAssessProgram,
  setAssessProgram,
  setTowerRates,
} from "@/lib/localStore";
import {
  readAssessProgramFile,
  serializeAssessProgramForDownload,
} from "@/lib/assess/assessProgramIO";
import { downloadBlob } from "@/lib/assess/downloadAssessSamples";
import { clientGetAdminSessionStatus } from "@/lib/assess/assessClientApi";
import { DestructiveActionDialog } from "@/components/feedback/DestructiveActionDialog";

/**
 * Centralized destination for every program-wide destructive action.
 *
 * Every action here:
 *   - replaces broad workshop state (cannot be undone)
 *   - offers an inline "Export JSON backup" before destructive confirmation
 *   - requires a typed action verb to unlock the confirm button
 *
 * Admin auth is enforced server-side already; this page also performs a
 * client-side gate so non-admin users see clear guidance.
 */
export function ProgramAdminClient() {
  const sync = useAssessSync();
  const toast = useToast();
  const fileRef = React.useRef<HTMLInputElement>(null);

  const [adminLoading, setAdminLoading] = React.useState(true);
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [adminConfigured, setAdminConfigured] = React.useState(false);

  const [confirmImportOpen, setConfirmImportOpen] = React.useState(false);
  const [pendingFile, setPendingFile] = React.useState<File | null>(null);
  const [confirmResetAssumptionsOpen, setConfirmResetAssumptionsOpen] =
    React.useState(false);

  React.useEffect(() => {
    let active = true;
    void clientGetAdminSessionStatus().then((r) => {
      if (!active) return;
      if (r.ok && r.data) {
        setIsAdmin(r.data.isAdmin);
        setAdminConfigured(r.data.configured);
      } else {
        setIsAdmin(false);
        setAdminConfigured(false);
      }
      setAdminLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

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
        "Store the file in SharePoint, Teams, or email. Required reading before any destructive action below.",
      errorTitle: "Couldn't export backup",
    },
  });

  const importOp = useAsyncOp<void, [File]>({
    run: async (f) => {
      const cur = getAssessProgram();
      const r = await readAssessProgramFile(f, { mergeLeadDeadlinesFrom: cur });
      if (!r.ok) throw new Error(r.error);
      setAssessProgram(r.program);
      if (sync?.canSync) await sync.flushSave();
    },
    messages: {
      loadingTitle: "Importing JSON backup",
      loadingDescription: "Replacing the program state with the file's contents...",
      successTitle: "Backup imported",
      successDescription: () =>
        sync?.canSync
          ? "Loaded and saved to the database. The file is still useful as a snapshot."
          : "Loaded into this browser. Set DATABASE_URL to sync to other devices.",
      errorTitle: "Couldn't import backup",
    },
  });

  const resetAssumptionsOp = useAsyncOp<void, []>({
    run: async () => {
      // Per-tower rates: iterate every canonical tower and rewrite its
      // rates blob to the seeded workshop-pivot defaults. Each call
      // routes through `setTowerAssess` so the AssessSyncProvider
      // debounces the PUT(s) — admin-scoped, so the multi-tower mutation
      // is allowed.
      for (const t of towers) {
        setTowerRates(t.id, defaultTowerRates(t.id));
      }
      if (sync?.canSync) await sync.flushSave();
    },
    messages: {
      loadingTitle: "Restoring tower-rate defaults",
      successTitle: "Defaults restored",
      successDescription:
        "Every tower's onshore + offshore rates and contractor blends are back to the seeded workshop-pivot values.",
      errorTitle: "Couldn't restore defaults",
    },
  });

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setPendingFile(f);
    setConfirmImportOpen(true);
  };

  const onExportBackup = React.useCallback(async () => {
    await exportOp.fire();
  }, [exportOp]);

  const triggerImport = () => {
    if (!isAdmin) return;
    fileRef.current?.click();
  };

  const renderGate = () => {
    if (adminLoading) {
      return (
        <div className="rounded-2xl border border-forge-border bg-forge-surface/60 p-6 text-sm text-forge-subtle">
          Verifying program admin session…
        </div>
      );
    }
    if (isAdmin) return null;
    return (
      <div className="rounded-2xl border border-accent-amber/40 bg-accent-amber/10 p-5">
        <div className="flex items-start gap-3">
          <ShieldAlert
            className="mt-0.5 h-5 w-5 shrink-0 text-accent-amber"
            aria-hidden
          />
          <div className="text-sm leading-relaxed text-forge-body">
            <div className="font-semibold text-forge-ink">
              Program admin login required
            </div>
            <p className="mt-1">
              Every action on this page replaces broad workshop state and is
              restricted to program admin.{" "}
              {adminConfigured ? (
                <>
                  Sign in at{" "}
                  <Link
                    href="/login/admin?from=/program/admin"
                    className="underline underline-offset-2"
                  >
                    /login/admin
                  </Link>{" "}
                  and return to this page.
                </>
              ) : (
                <span>
                  Program admin login is not configured on this deployment.
                  Set <code className="font-mono">FORGE_ADMIN_*</code> env vars
                  to enable.
                </span>
              )}
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <PageShell>
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <Breadcrumbs
          items={[
            { label: "Program home", href: "/" },
            { label: "Program admin" },
          ]}
        />

        <div className="mt-4">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-accent-purple/30 bg-accent-purple/5 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-accent-purple-dark">
            <span className="font-mono">&gt;</span>
            Program admin
          </div>
          <h1 className="mt-2 font-display text-2xl font-semibold text-forge-ink sm:text-3xl">
            &gt; Destructive program actions
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-forge-body">
            All program-wide resets and imports live here so they cannot be triggered by
            accident from working pages. Each action requires admin login, an explicit
            typed confirmation, and a JSON backup is offered before every destructive
            step.
          </p>
        </div>

        <div className="mt-6 space-y-5">
          {renderGate()}

          {/* Section: Backup */}
          <section className="rounded-2xl border border-forge-border bg-forge-surface/60 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-semibold text-forge-ink">
                  &gt; Export JSON backup
                </h2>
                <p className="mt-1 text-sm text-forge-body">
                  Download the current program state. Always do this before running any
                  action below — there is no undo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void exportOp.fire()}
                disabled={exportOp.state === "loading"}
                className="inline-flex items-center gap-2 rounded-lg border border-forge-border bg-forge-surface px-3 py-2 text-xs font-medium text-forge-body hover:border-accent-purple/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FileJson className="h-3.5 w-3.5 text-accent-purple" />
                {exportOp.state === "loading"
                  ? "Exporting..."
                  : "Export JSON backup"}
              </button>
            </div>
          </section>

          {/* Section: Import JSON */}
          <section className="rounded-2xl border border-forge-border bg-forge-surface/60 p-5">
            <div className="flex items-start gap-3">
              <FileUp
                className="mt-0.5 h-5 w-5 shrink-0 text-accent-teal"
                aria-hidden
              />
              <div className="flex-1">
                <h2 className="font-display text-base font-semibold text-forge-ink">
                  &gt; Import JSON backup (full program replace)
                </h2>
                <p className="mt-1 text-sm text-forge-body">
                  Replaces the entire program with the contents of an exported JSON
                  file. Use this for snapshot rollback. All current state is discarded.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={triggerImport}
                    disabled={!isAdmin || adminLoading || importOp.state === "loading"}
                    className="inline-flex items-center gap-2 rounded-lg border border-forge-border bg-forge-surface px-3 py-2 text-xs font-medium text-forge-body hover:border-accent-purple/30 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <FileUp className="h-3.5 w-3.5 text-accent-teal" />
                    {importOp.state === "loading" ? "Importing..." : "Import JSON"}
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={onFileSelected}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Section: Reset all tower rates */}
          <section className="rounded-2xl border border-forge-border bg-forge-surface/60 p-5">
            <div className="flex items-start gap-3">
              <RotateCcw
                className="mt-0.5 h-5 w-5 shrink-0 text-accent-purple"
                aria-hidden
              />
              <div className="flex-1">
                <h2 className="font-display text-base font-semibold text-forge-ink">
                  &gt; Reset all tower rates to seeded defaults
                </h2>
                <p className="mt-1 text-sm text-forge-body">
                  Rewrites every tower&apos;s onshore + offshore FTE and contractor
                  rates back to the workshop-pivot seeds. Affects every modeled
                  dollar in the app. Tower-specific edits made by leads will be
                  overwritten.
                </p>
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => setConfirmResetAssumptionsOpen(true)}
                    disabled={
                      !isAdmin ||
                      adminLoading ||
                      resetAssumptionsOp.state === "loading"
                    }
                    className="inline-flex items-center gap-2 rounded-lg border border-forge-border bg-forge-surface px-3 py-2 text-xs font-medium text-forge-body hover:border-accent-purple/40 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    {resetAssumptionsOp.state === "loading"
                      ? "Resetting..."
                      : "Reset all tower rates"}
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Section: Lead deadlines (non-destructive nav) */}
          <section className="rounded-2xl border border-forge-border bg-forge-surface/60 p-5">
            <div className="flex items-start gap-3">
              <Calendar
                className="mt-0.5 h-5 w-5 shrink-0 text-accent-teal"
                aria-hidden
              />
              <div className="flex-1">
                <h2 className="font-display text-base font-semibold text-forge-ink">
                  &gt; Lead deadlines
                </h2>
                <p className="mt-1 text-sm text-forge-body">
                  Set Step 1–4 calendar due dates per tower. Non-destructive — edits
                  only the deadline chips shown to tower leads.
                </p>
                <div className="mt-3">
                  <Link
                    href="/program/lead-deadlines"
                    className="inline-flex items-center gap-2 rounded-lg border border-forge-border bg-forge-surface px-3 py-2 text-xs font-medium text-forge-body hover:border-accent-teal/40"
                  >
                    Edit lead deadlines
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </section>

          <p className="text-center text-[11px] text-forge-hint">
            Tower-scoped actions (per-tower capability map upload, dials, reviews) stay
            on the relevant tower pages — only program-wide changes live here.
          </p>
        </div>
      </div>

      <DestructiveActionDialog
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
              title: "Program state replaced",
              description: f.name,
            });
          }
        }}
        title="Import this file and replace the current program?"
        impactSummary={
          <>
            Replaces the entire program with the contents of{" "}
            <span className="font-mono">{pendingFile?.name ?? "this file"}</span>.
          </>
        }
        affectedItems={[
          "Capability maps, headcount, dials, scenario state",
          "Tower-lead sign-offs and initiative reviews",
          "Lead deadlines (merged from current state when missing in file)",
        ]}
        confirmPhrase="IMPORT"
        confirmLabel="Replace from file"
        onExportBackup={onExportBackup}
        exportingBackup={exportOp.state === "loading"}
        busy={importOp.state === "loading"}
      />

      <DestructiveActionDialog
        open={confirmResetAssumptionsOpen}
        onClose={() => setConfirmResetAssumptionsOpen(false)}
        onConfirm={async () => {
          setConfirmResetAssumptionsOpen(false);
          await resetAssumptionsOp.fire();
        }}
        title="Reset all tower rates to seeded defaults?"
        impactSummary="Rewrites every tower's onshore + offshore FTE and contractor blended rates back to the workshop-pivot seeds. Every modeled dollar in the app recomputes."
        affectedItems={[
          "Per-tower FTE onshore + offshore rates",
          "Per-tower contractor onshore + offshore rates",
          "Tower lead overrides on these rates will be overwritten",
          "L4 dial values (offshore + AI) are unchanged but resulting $ change",
        ]}
        confirmPhrase="RESET"
        confirmLabel="Reset all tower rates"
        onExportBackup={onExportBackup}
        exportingBackup={exportOp.state === "loading"}
        busy={resetAssumptionsOp.state === "loading"}
      />

    </PageShell>
  );
}
