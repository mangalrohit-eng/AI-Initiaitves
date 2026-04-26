"use client";

import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  X,
} from "lucide-react";

export type ToastKind = "info" | "success" | "error" | "loading";

export type ToastAction = {
  label: string;
  onClick: () => void;
};

export type Toast = {
  id: string;
  kind: ToastKind;
  title: string;
  description?: string;
  action?: ToastAction;
  /** When provided, overrides the kind's default duration. `null` makes the toast sticky. */
  durationMs?: number | null;
};

type ToastInput = Omit<Toast, "id" | "kind"> & {
  id?: string;
  /** Override the kind explicitly (rare — convenience methods set this). */
  kind?: ToastKind;
};
type ToastUpdate = Partial<Omit<Toast, "id">>;

type ToastContextValue = {
  info: (input: ToastInput) => string;
  success: (input: ToastInput) => string;
  error: (input: ToastInput) => string;
  /** Returns a stable id you can later `update` or `dismiss`. Sticky by default. */
  loading: (input: ToastInput) => string;
  update: (id: string, patch: ToastUpdate & { kind?: ToastKind }) => void;
  dismiss: (id: string) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION_MS: Record<ToastKind, number | null> = {
  info: 5000,
  success: 4000,
  error: null,
  loading: null,
};

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const timers = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const clearTimer = React.useCallback((id: string) => {
    const t = timers.current.get(id);
    if (t) {
      clearTimeout(t);
      timers.current.delete(id);
    }
  }, []);

  const dismiss = React.useCallback(
    (id: string) => {
      clearTimer(id);
      setToasts((prev) => prev.filter((t) => t.id !== id));
    },
    [clearTimer],
  );

  const scheduleAutoDismiss = React.useCallback(
    (id: string, ms: number | null | undefined, kind: ToastKind) => {
      clearTimer(id);
      const duration = ms === undefined ? DEFAULT_DURATION_MS[kind] : ms;
      if (duration == null) return;
      const handle = setTimeout(() => dismiss(id), duration);
      timers.current.set(id, handle);
    },
    [clearTimer, dismiss],
  );

  const upsert = React.useCallback(
    (kind: ToastKind, input: ToastInput): string => {
      const id = input.id ?? newId();
      setToasts((prev) => {
        const existingIdx = prev.findIndex((t) => t.id === id);
        const next: Toast = {
          id,
          kind,
          title: input.title,
          description: input.description,
          action: input.action,
          durationMs: input.durationMs,
        };
        if (existingIdx >= 0) {
          const copy = prev.slice();
          copy[existingIdx] = next;
          return copy;
        }
        return [...prev, next];
      });
      scheduleAutoDismiss(id, input.durationMs, kind);
      return id;
    },
    [scheduleAutoDismiss],
  );

  const update = React.useCallback<ToastContextValue["update"]>(
    (id, patch) => {
      setToasts((prev) => {
        const idx = prev.findIndex((t) => t.id === id);
        if (idx < 0) return prev;
        const merged: Toast = { ...prev[idx], ...patch };
        const copy = prev.slice();
        copy[idx] = merged;
        return copy;
      });
      const nextKind = patch.kind ?? toasts.find((t) => t.id === id)?.kind ?? "info";
      const ms = patch.durationMs === undefined ? undefined : patch.durationMs;
      scheduleAutoDismiss(id, ms, nextKind);
    },
    [scheduleAutoDismiss, toasts],
  );

  const value = React.useMemo<ToastContextValue>(
    () => ({
      info: (i) => upsert("info", i),
      success: (i) => upsert("success", i),
      error: (i) => upsert("error", i),
      loading: (i) => upsert("loading", i),
      update,
      dismiss,
    }),
    [upsert, update, dismiss],
  );

  React.useEffect(() => {
    const timersRef = timers.current;
    return () => {
      timersRef.forEach((t) => clearTimeout(t));
      timersRef.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}

/**
 * Safe variant for components that might mount before the provider in legacy
 * routes. Returns `null` if there's no provider in the tree.
 */
export function useOptionalToast(): ToastContextValue | null {
  return React.useContext(ToastContext);
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div
      role="region"
      aria-label="Notifications"
      className="no-print pointer-events-none fixed right-4 top-4 z-[100] flex w-full max-w-sm flex-col gap-2"
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const isError = toast.kind === "error";
  const role = isError ? "alert" : "status";
  const ariaLive = isError ? "assertive" : "polite";

  const accent = (() => {
    switch (toast.kind) {
      case "success":
        return "border-accent-green/60 bg-accent-green/10 text-forge-ink";
      case "error":
        return "border-accent-red/60 bg-accent-red/10 text-forge-ink";
      case "info":
        return "border-accent-purple/40 bg-accent-purple/5 text-forge-ink";
      case "loading":
      default:
        return "border-forge-border bg-forge-surface text-forge-ink";
    }
  })();

  const Icon = (() => {
    switch (toast.kind) {
      case "success":
        return <CheckCircle2 className="h-4 w-4 text-accent-green" aria-hidden />;
      case "error":
        return <AlertTriangle className="h-4 w-4 text-accent-red" aria-hidden />;
      case "info":
        return <Info className="h-4 w-4 text-accent-purple-dark" aria-hidden />;
      case "loading":
      default:
        return <Loader2 className="h-4 w-4 animate-spin text-accent-purple-dark" aria-hidden />;
    }
  })();

  return (
    <div
      role={role}
      aria-live={ariaLive}
      className={`pointer-events-auto flex items-start gap-3 rounded-xl border p-3 shadow-card backdrop-blur-sm ${accent}`}
    >
      <div className="mt-0.5 flex-shrink-0">{Icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium leading-snug">{toast.title}</div>
        {toast.description ? (
          <div className="mt-0.5 text-xs leading-relaxed text-forge-body">{toast.description}</div>
        ) : null}
        {toast.action ? (
          <button
            type="button"
            onClick={toast.action.onClick}
            className="mt-1.5 inline-flex items-center text-xs font-medium text-accent-purple-dark underline-offset-2 hover:underline"
          >
            {toast.action.label}
          </button>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="ml-2 flex-shrink-0 rounded-md p-1 text-forge-subtle transition hover:bg-forge-well hover:text-forge-ink"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
