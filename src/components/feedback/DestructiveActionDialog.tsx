"use client";

import * as React from "react";
import { AlertTriangle, Download } from "lucide-react";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";

export type DestructiveActionDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  /** What this destructive action will do, in plain language. */
  impactSummary: React.ReactNode;
  /** Specific list of state that will be affected (rendered as bullet list). */
  affectedItems?: React.ReactNode[];
  /** Action verb typed-confirmation phrase (e.g. RESEED, IMPORT). */
  confirmPhrase: string;
  /** Optional: callback to download a JSON backup snapshot of current program. */
  onExportBackup?: () => void | Promise<void>;
  exportingBackup?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
};

/**
 * Standard destructive confirmation used by program-level admin actions.
 *
 * Forces the operator to acknowledge irreversible state replacement, offers an
 * inline "Export JSON backup" shortcut, and requires a typed action verb to
 * unlock the confirm button — even an admin should not be able to wipe the
 * workshop accidentally.
 */
export function DestructiveActionDialog({
  open,
  onClose,
  onConfirm,
  title,
  impactSummary,
  affectedItems,
  confirmPhrase,
  onExportBackup,
  exportingBackup = false,
  confirmLabel = "Yes, replace",
  cancelLabel = "Cancel",
  busy = false,
}: DestructiveActionDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      title={title}
      description={
        <div className="space-y-3 text-sm leading-relaxed">
          <p className="text-forge-body">{impactSummary}</p>

          {affectedItems && affectedItems.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5 text-forge-subtle">
              {affectedItems.map((it, i) => (
                <li key={i}>{it}</li>
              ))}
            </ul>
          ) : null}

          <div className="flex items-start gap-2 rounded-lg border border-accent-amber/40 bg-accent-amber/10 p-3 text-xs text-forge-body">
            <AlertTriangle
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-amber"
              aria-hidden
            />
            <div className="space-y-2">
              <div>
                <span className="font-semibold text-forge-ink">
                  This cannot be undone.
                </span>{" "}
                Take a JSON backup before continuing — every tower lead&apos;s in-progress
                work will be lost if you have not exported a snapshot.
              </div>
              {onExportBackup ? (
                <button
                  type="button"
                  onClick={() => void onExportBackup()}
                  disabled={exportingBackup}
                  className="inline-flex items-center gap-1.5 rounded-md border border-accent-amber/40 bg-forge-surface px-2.5 py-1 text-[11px] font-medium text-forge-body hover:border-accent-amber/60 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Download className="h-3 w-3" aria-hidden />
                  {exportingBackup ? "Exporting backup..." : "Export JSON backup now"}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      }
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      variant="destructive"
      confirmPhrase={confirmPhrase}
      busy={busy}
    />
  );
}
