"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  FileJson,
  FileUp,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { PageShell } from "@/components/PageShell";
import { useToast } from "@/components/feedback/ToastProvider";
import { useAsyncOp } from "@/lib/feedback/useAsyncOp";
import { useAssessSync } from "@/components/assess/AssessSyncProvider";
import { defaultGlobalAssessAssumptions } from "@/data/assess/types";
import {
  getAssessProgram,
  setAssessProgram,
  setGlobalAssessAssumptions,
} from "@/lib/localStore";
import { buildSeededAssessProgramV2 } from "@/data/assess/seedAssessProgram";
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

  const [confirmLoadSampleOpen, setConfirmLoadSampleOpen] = React.useState(false);
  const [confirmImportOpen, setConfirmImportOpen] = React.useState(false);
  const [pendingFile, setPendingFile] = React.useState<File | null>(null);
  const [confirmReseedOpen, setConfirmReseedOpen] = React.useState(false);
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

  const dbReady = sync?.canSync ?? false;

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

  const sampleLoadOp = useAsyncOp<void, []>({
    run: async () => {
      setAssessProgram(buildSeededAssessProgramV2());
      if (sync?.canSync) await sync.flushSave();
    },
    messages: {
      loadingTitle: "Loading sample program across 13 towers",
      successTitle: "Sample program loaded",
      successDescription:
        "All 13 towers seeded with capability maps, headcount, and starter dials.",
      errorTitle: "Couldn't load sample",
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
      loadingTitle: "Re-seeding program from latest defaults",
      loadingDescription:
        "Rebuilding L1–L4 maps and starter heuristic for all 13 towers...",
      successTitle: ({ towers }) => `Re-seeded ${towers} towers from latest defaults`,
      successDescription:
        "All headcount, dials, and scenario state were replaced. Cost-weighted baselines recomputed.",
      errorTitle: "Re-seed failed",
    },
    retryable: true,
  });

  const resetAssumptionsOp = useAsyncOp<void, []>({
    run: async () => {
      setGlobalAssessAssumptions({ ...defaultGlobalAssessAssumptions });
      if (sync?.canSync) await sync.flushSave();
    },
    messages: {
      loadingTitle: "Restoring assumption defaults",
      successTitle: "Defaults restored",
      successDescription:
        "Onshore and offshore rates and contractor blends are back to seeded values.",
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
            All program-wide resets, imports, and re-seeds live here so they cannot be
            triggered by accident from working pages. Each action requires admin login,
            an explicit typed confirmation, and a JSON backup is offered before every
            destructive step.
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

          {/* Section: Load sample program */}
          <section className="rounded-2xl border border-forge-border bg-forge-surface/60 p-5">
            <div className="flex items-start gap-3">
              <Sparkles
                className="mt-0.5 h-5 w-5 shrink-0 text-accent-purple"
                aria-hidden
              />
              <div className="flex-1">
                <h2 className="font-display text-base font-semibold text-forge-ink">
                  &gt; Load sample program (all 13 towers)
                </h2>
                <p className="mt-1 text-sm text-forge-body">
                  Replaces the entire program with the illustrative sample. Wipes every
                  tower&apos;s capability map, headcount, dials, sign-offs, and reviews.
                </p>
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => setConfirmLoadSampleOpen(true)}
                    disabled={!isAdmin || adminLoading || sampleLoadOp.state === "loading"}
                    className="inline-flex items-center gap-2 rounded-lg border border-accent-purple/40 bg-accent-purple/10 px-3 py-2 text-xs font-medium text-accent-purple-dark hover:bg-accent-purple/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    {sampleLoadOp.state === "loading"
                      ? "Loading..."
                      : "Load sample program"}
                  </button>
                </div>
              </div>
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

          {/* Section: Re-seed all towers */}
          <section className="rounded-2xl border border-forge-border bg-forge-surface/60 p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle
                className="mt-0.5 h-5 w-5 shrink-0 text-accent-amber"
                aria-hidden
              />
              <div className="flex-1">
                <h2 className="font-display text-base font-semibold text-forge-ink">
                  &gt; Re-seed all towers from latest defaults
                </h2>
                <p className="mt-1 text-sm text-forge-body">
                  Rebuilds every tower from the latest L1–L4 maps and starter
                  heuristic in code. Use after editing seed files. Replaces every
                  workshop edit; persists to the database.
                </p>
                {!dbReady ? (
                  <p className="mt-2 text-xs text-accent-amber">
                    Database not configured. Set{" "}
                    <code className="font-mono">DATABASE_URL</code> and run the migration
                    first.
                  </p>
                ) : null}
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => setConfirmReseedOpen(true)}
                    disabled={
                      !isAdmin ||
                      adminLoading ||
                      !dbReady ||
                      reseedOp.state === "loading"
                    }
                    className="inline-flex items-center gap-2 rounded-lg border border-accent-purple/40 bg-accent-purple/10 px-3 py-2 text-xs font-medium text-accent-purple-dark hover:bg-accent-purple/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {reseedOp.state === "loading"
                      ? "Re-seeding..."
                      : "Re-seed all towers from latest defaults"}
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Section: Restore global assumptions */}
          <section className="rounded-2xl border border-forge-border bg-forge-surface/60 p-5">
            <div className="flex items-start gap-3">
              <RotateCcw
                className="mt-0.5 h-5 w-5 shrink-0 text-accent-purple"
                aria-hidden
              />
              <div className="flex-1">
                <h2 className="font-display text-base font-semibold text-forge-ink">
                  &gt; Restore global assumptions defaults
                </h2>
                <p className="mt-1 text-sm text-forge-body">
                  Resets onshore and offshore FTE/contractor blended rates back to the
                  seeded illustrative values. Affects every dollar in the app.
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
                      : "Restore assumption defaults"}
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
        open={confirmLoadSampleOpen}
        onClose={() => setConfirmLoadSampleOpen(false)}
        onConfirm={async () => {
          setConfirmLoadSampleOpen(false);
          await sampleLoadOp.fire();
        }}
        title="Load sample program?"
        impactSummary="The current program state is replaced with the illustrative sample across all 13 towers."
        affectedItems={[
          "Every tower's capability map and headcount",
          "Every offshore and AI dial",
          "Every tower-lead sign-off and initiative review",
          "Lead deadlines and assumptions remain unless changed",
        ]}
        confirmPhrase="LOADSAMPLE"
        confirmLabel="Replace with sample"
        onExportBackup={onExportBackup}
        exportingBackup={exportOp.state === "loading"}
        busy={sampleLoadOp.state === "loading"}
      />

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
        open={confirmReseedOpen}
        onClose={() => setConfirmReseedOpen(false)}
        onConfirm={async () => {
          setConfirmReseedOpen(false);
          await reseedOp.fire();
        }}
        title="Re-seed program from latest defaults?"
        impactSummary="Rebuilds every tower from the latest L1–L4 maps and starter heuristic in code, then upserts the result to the database."
        affectedItems={[
          "All 13 towers replaced with seed content",
          "All workshop edits, dials, sign-offs, and reviews discarded",
          "Cost-weighted baselines recomputed",
        ]}
        confirmPhrase="RESEED"
        confirmLabel="Replace with seed"
        onExportBackup={onExportBackup}
        exportingBackup={exportOp.state === "loading"}
        busy={reseedOp.state === "loading"}
      />

      <DestructiveActionDialog
        open={confirmResetAssumptionsOpen}
        onClose={() => setConfirmResetAssumptionsOpen(false)}
        onConfirm={async () => {
          setConfirmResetAssumptionsOpen(false);
          await resetAssumptionsOp.fire();
        }}
        title="Restore global assumption defaults?"
        impactSummary="Resets the four blended workforce rates back to seeded illustrative values. Every dollar in the app recomputes."
        affectedItems={[
          "FTE onshore and offshore blended rates",
          "Contractor onshore and offshore blended rates",
          "Tower-level dial values are unchanged but resulting $ change",
        ]}
        confirmPhrase="RESET"
        confirmLabel="Restore defaults"
        onExportBackup={onExportBackup}
        exportingBackup={exportOp.state === "loading"}
        busy={resetAssumptionsOp.state === "loading"}
      />

    </PageShell>
  );
}
