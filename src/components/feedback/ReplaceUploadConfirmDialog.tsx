"use client";

import * as React from "react";
import { AlertTriangle, Download, FileSpreadsheet, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ReplaceUploadBusyState = "exporting" | null;

export type ReplaceUploadConfirmDialogProps = {
  open: boolean;
  /** Display name of the picked file (e.g. "finance-q2.xlsx"). */
  fileName: string;
  /** Display name of the tower being replaced. */
  towerName: string;
  /**
   * `"exporting"` while the JSON backup is being generated and chained into
   * the replace. The whole dialog is disabled in this state.
   */
  busy?: ReplaceUploadBusyState;
  onCancel: () => void;
  onReplace: () => void;
  onExportThenReplace: () => void;
};

/**
 * Three-button safety dialog for the Capability Map upload path.
 *
 * Shown only when the tower already has data — first-time uploads (rows
 * empty) skip the dialog entirely. The dialog spells out exactly what will
 * be lost (dials, L4 lists, verdict cache) and offers the user a one-click
 * "export backup first, then proceed" path so an accidental wrong-file
 * upload can always be rolled back.
 *
 * Built on the native `<dialog>` element for free focus trap, ESC handling,
 * and modal semantics — consistent with `ConfirmDialog` elsewhere in the
 * codebase.
 */
export function ReplaceUploadConfirmDialog({
  open,
  fileName,
  towerName,
  busy = null,
  onCancel,
  onReplace,
  onExportThenReplace,
}: ReplaceUploadConfirmDialogProps) {
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
              Replace this tower&rsquo;s capability map?
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-forge-body">
              Uploading{" "}
              <span className="inline-flex items-center gap-1 rounded border border-forge-border bg-forge-well px-1.5 py-0.5 font-mono text-[12px] text-forge-ink">
                <FileSpreadsheet className="h-3 w-3" />
                {fileName}
              </span>{" "}
              will replace the L2 / L3 list and headcount for{" "}
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
            Will be reset for this tower
          </div>
          <ul className="mt-1.5 space-y-1 text-xs text-forge-body">
            <li>
              <span className="text-forge-subtle">·</span> Step 2 dial settings
              (offshore + AI percentages) snap back to the tower baseline.
            </li>
            <li>
              <span className="text-forge-subtle">·</span> L5 Activity lists are
              cleared — you&rsquo;ll need to re-run{" "}
              <span className="font-medium">Generate L5 Activities</span>.
            </li>
            <li>
              <span className="text-forge-subtle">·</span> AI Initiatives cache
              is cleared and recomputed on next view.
            </li>
          </ul>
          <div className="mt-2 text-[11px] text-forge-subtle">
            Other towers and their dials are not touched.
          </div>
        </div>

        <p className="text-xs text-forge-subtle">
          Recommended: export a JSON backup first so you can restore this state
          via{" "}
          <span className="font-medium text-forge-body">
            Program tools &rsaquo; Import backup
          </span>{" "}
          if anything goes wrong.
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
            onClick={onReplace}
            disabled={isBusy}
            className="rounded-lg border border-forge-border bg-forge-surface px-3 py-2 text-sm font-medium text-forge-body transition hover:border-accent-amber/50 hover:text-accent-amber disabled:cursor-not-allowed disabled:opacity-60"
          >
            Replace anyway
          </button>
          <button
            type="button"
            onClick={onExportThenReplace}
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
                Export backup, then replace
              </>
            )}
          </button>
        </div>
      </form>
    </dialog>
  );
}
