"use client";

import * as React from "react";
import { AlertTriangle, Download, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ReloadSampleBusyState = "exporting" | null;

export type ReloadSampleConfirmDialogProps = {
  open: boolean;
  towerName: string;
  busy?: ReloadSampleBusyState;
  onCancel: () => void;
  onReload: () => void;
  onExportThenReload: () => void;
};

/**
 * Confirmation before replacing the tower's current map/headcount with the
 * original starter sample. Parity with {@link ReplaceUploadConfirmDialog}:
 * native dialog, explicit loss list, JSON backup then proceed.
 */
export function ReloadSampleConfirmDialog({
  open,
  towerName,
  busy = null,
  onCancel,
  onReload,
  onExportThenReload,
}: ReloadSampleConfirmDialogProps) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);

  React.useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) {
      try {
        el.showModal();
      } catch {
        el.show();
      }
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  React.useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const handleClose = () => onCancel();
    const handleCancel = (e: Event) => {
      e.preventDefault();
      onCancel();
    };
    el.addEventListener("close", handleClose);
    el.addEventListener("cancel", handleCancel);
    return () => {
      el.removeEventListener("close", handleClose);
      el.removeEventListener("cancel", handleCancel);
    };
  }, [onCancel]);

  const isBusy = busy === "exporting";

  return (
    <dialog
      ref={dialogRef}
      className="m-auto max-w-lg rounded-2xl border border-forge-border bg-forge-surface p-0 text-forge-ink shadow-card backdrop:bg-black/40 backdrop:backdrop-blur-sm open:animate-none"
      onClick={(e) => {
        if (isBusy) return;
        if (e.target === dialogRef.current) onCancel();
      }}
    >
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault();
        }}
        className="flex flex-col gap-4 p-5"
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex-shrink-0">
            <AlertTriangle className="h-5 w-5 text-accent-amber" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-base font-semibold leading-snug text-forge-ink">
              Reload starter sample for this tower?
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-forge-body">
              This will replace your current capability map and headcount with the original
              starter sample for{" "}
              <span className="font-semibold text-forge-ink">{towerName}</span>.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close dialog"
            onClick={onCancel}
            disabled={isBusy}
            className="ml-2 flex-shrink-0 rounded-md p-1 text-forge-subtle transition hover:bg-forge-well hover:text-forge-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="rounded-lg border border-accent-amber/30 bg-accent-amber/5 p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-accent-amber">
            You will lose these current edits for this tower
          </div>
          <ul className="mt-1.5 space-y-1 text-xs text-forge-body">
            <li>
              <span className="text-forge-subtle">·</span> Capability map updates (L2/L3
              structure and headcount edits).
            </li>
            <li>
              <span className="text-forge-subtle">·</span> Configure Impact Levers dial
              adjustments (offshore and AI percentages).
            </li>
            <li>
              <span className="text-forge-subtle">·</span> Generated/regenerated L4 activity
              lists from your current map.
            </li>
            <li>
              <span className="text-forge-subtle">·</span> AI Initiatives verdicts, curation,
              and review decisions tied to the current map.
            </li>
          </ul>
          <div className="mt-2 text-[11px] text-forge-subtle">Other towers are not affected.</div>
        </div>

        <p className="text-xs text-forge-subtle">
          Recommended: export a JSON backup first so you can restore this state later via
          Program tools &gt; Import backup.
        </p>

        <div className="mt-1 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isBusy}
            className="rounded-lg border border-forge-border bg-forge-surface px-3 py-2 text-sm font-medium text-forge-body transition hover:border-forge-border-strong disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onReload}
            disabled={isBusy}
            className="rounded-lg border border-forge-border bg-forge-surface px-3 py-2 text-sm font-medium text-forge-body transition hover:border-accent-amber/50 hover:text-accent-amber disabled:cursor-not-allowed disabled:opacity-60"
          >
            Reload sample
          </button>
          <button
            type="button"
            onClick={onExportThenReload}
            disabled={isBusy}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition",
              "bg-accent-purple text-white hover:bg-accent-purple-dark",
              "disabled:cursor-not-allowed disabled:opacity-60",
            )}
          >
            {isBusy ? (
              <>
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5" />
                Export backup, then reload
              </>
            )}
          </button>
        </div>
      </form>
    </dialog>
  );
}
