"use client";

import * as React from "react";
import { AlertTriangle, Lock, X } from "lucide-react";

export type ConfirmDialogVariant = "default" | "destructive" | "lock";

export type ConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmDialogVariant;
  /**
   * When set, the user must type this exact string into a confirmation field
   * before the confirm button is enabled (used for high-impact actions like
   * "overwrite all").
   */
  confirmPhrase?: string;
  /** When confirm is awaiting `onConfirm`'s promise. */
  busy?: boolean;
};

/**
 * Confirm modal built on the native HTML <dialog> element.
 *
 * Native <dialog> gives us focus trap, ESC handling, scroll lock, and modal
 * semantics for free. We wrap it in a thin React component for declarative
 * `open` state, styling, and an optional "type the artifact name" guard.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  confirmPhrase,
  busy = false,
}: ConfirmDialogProps) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const [typedPhrase, setTypedPhrase] = React.useState("");

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
    if (!open) {
      setTypedPhrase("");
    }
  }, [open]);

  React.useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const handleClose = () => onClose();
    const handleCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    el.addEventListener("close", handleClose);
    el.addEventListener("cancel", handleCancel);
    return () => {
      el.removeEventListener("close", handleClose);
      el.removeEventListener("cancel", handleCancel);
    };
  }, [onClose]);

  const phraseSatisfied = !confirmPhrase || typedPhrase.trim() === confirmPhrase.trim();
  const confirmDisabled = busy || !phraseSatisfied;

  const Icon =
    variant === "destructive" ? AlertTriangle : variant === "lock" ? Lock : null;
  const iconColor =
    variant === "destructive" ? "text-accent-red" : variant === "lock" ? "text-accent-purple-dark" : "";

  const confirmClass =
    variant === "destructive"
      ? "bg-accent-red text-white hover:bg-[#e23200]"
      : "bg-accent-purple text-white hover:bg-accent-purple-dark";

  return (
    <dialog
      ref={dialogRef}
      className="m-auto max-w-md rounded-2xl border border-forge-border bg-forge-surface p-0 text-forge-ink shadow-card backdrop:bg-black/40 backdrop:backdrop-blur-sm open:animate-none"
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault();
        }}
        className="flex max-w-md flex-col gap-4 p-5"
      >
        <div className="flex items-start gap-3">
          {Icon ? (
            <div className="mt-0.5 flex-shrink-0">
              <Icon className={`h-5 w-5 ${iconColor}`} aria-hidden />
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-base font-semibold leading-snug text-forge-ink">
              {title}
            </h2>
            {description ? (
              <div className="mt-1.5 text-sm leading-relaxed text-forge-body">
                {description}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            aria-label="Close dialog"
            onClick={onClose}
            className="ml-2 flex-shrink-0 rounded-md p-1 text-forge-subtle transition hover:bg-forge-well hover:text-forge-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {confirmPhrase ? (
          <div>
            <label className="text-xs font-medium text-forge-subtle">
              Type{" "}
              <span className="font-mono text-forge-body">{confirmPhrase}</span>{" "}
              to confirm
            </label>
            <input
              type="text"
              value={typedPhrase}
              onChange={(e) => setTypedPhrase(e.target.value)}
              autoFocus
              className="mt-1.5 w-full rounded-lg border border-forge-border bg-forge-surface px-3 py-2 font-mono text-sm text-forge-ink outline-none focus:border-accent-purple/50 focus:ring-1 focus:ring-accent-purple/30"
              autoComplete="off"
            />
          </div>
        ) : null}

        <div className="mt-1 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-forge-border bg-forge-surface px-3 py-2 text-sm font-medium text-forge-body transition hover:border-forge-border-strong disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirmDisabled) return;
              void onConfirm();
            }}
            disabled={confirmDisabled}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${confirmClass}`}
          >
            {busy ? (
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : null}
            {confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}
