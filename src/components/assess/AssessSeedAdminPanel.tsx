"use client";

import * as React from "react";
import { AlertTriangle, ChevronDown, Sparkles } from "lucide-react";
import { useAssessSync } from "@/components/assess/AssessSyncProvider";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { useAsyncOp } from "@/lib/feedback/useAsyncOp";
import { getPortalAudience, isInternalSurfaceAllowed } from "@/lib/portalAudience";

/**
 * Internal-only "Re-seed starter defaults" action. Rebuilds the workshop program
 * server-side from `buildSeededAssessProgramV2()` (latest L1-L4 maps + heuristic) and
 * upserts it into Postgres, then refreshes the client cache. Hidden for client-only
 * deployments.
 */
export function AssessSeedAdminPanel() {
  const sync = useAssessSync();
  const [open, setOpen] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const allowed = isInternalSurfaceAllowed(getPortalAudience());

  const seedOp = useAsyncOp<{ towers: number }, []>({
    run: async () => {
      const r = await fetch("/api/assess/seed", {
        method: "POST",
        credentials: "include",
      });
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

  if (!allowed) return null;

  const dbReady = sync?.canSync ?? false;

  return (
    <div className="mt-4 rounded-2xl border border-forge-border bg-forge-surface/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="inline-flex items-center gap-2 text-sm font-medium text-forge-ink">
          <Sparkles className="h-4 w-4 text-accent-purple" aria-hidden />
          Admin · Re-seed starter defaults
          <span className="rounded-full bg-forge-well/80 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-forge-subtle">
            internal
          </span>
        </span>
        <ChevronDown
          className={
            "h-4 w-4 text-forge-subtle transition-transform "
            + (open ? "rotate-180" : "")
          }
          aria-hidden
        />
      </button>
      {open ? (
        <div className="border-t border-forge-border px-4 py-4">
          <div className="flex items-start gap-2 rounded-lg border border-accent-amber/30 bg-accent-amber/5 p-3 text-xs text-forge-body">
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0 text-accent-amber"
              aria-hidden
            />
            <div>
              <p className="font-medium text-forge-ink">
                This overwrites the current assess workshop in the database.
              </p>
              <p className="mt-1 text-forge-subtle">
                Use after editing the L1-L4 capability maps or the L4 default heuristic.
                Rebuilds rows for all 13 towers, applies the Versant-aware starter
                offshore% / AI% per L4, and recomputes the cost-weighted tower
                baselines. Any edits to L4 figures, footprint, or scenario dials made
                in the UI will be replaced.
              </p>
            </div>
          </div>
          {!dbReady ? (
            <p className="mt-3 text-xs text-accent-amber">
              Database not configured. Set <code className="font-mono">DATABASE_URL</code>{" "}
              and run the migration first.
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={!dbReady || seedOp.state === "loading"}
              className="inline-flex items-center gap-2 rounded-lg border border-accent-purple/40 bg-accent-purple/10 px-3 py-2 text-sm font-medium text-accent-purple-dark hover:bg-accent-purple/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Sparkles className="h-4 w-4" />
              {seedOp.state === "loading"
                ? "Re-seeding..."
                : "Re-seed all towers from latest defaults"}
            </button>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={async () => {
          setConfirmOpen(false);
          await seedOp.fire();
        }}
        title="Replace the workshop program with the latest seed?"
        description={
          <>
            All 13 towers will be rebuilt from the latest L1-L4 maps and starter
            heuristic. Any edits made in the UI will be replaced. This cannot be undone.
          </>
        }
        confirmLabel="Yes, replace"
        cancelLabel="Cancel"
        variant="destructive"
        confirmPhrase="re-seed"
        busy={seedOp.state === "loading"}
      />
    </div>
  );
}
