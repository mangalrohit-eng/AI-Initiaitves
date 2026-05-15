"use client";

import * as React from "react";
import type { AssessProgramV2 } from "@/data/assess/types";
import { clientGetAssess, clientPutAssess } from "@/lib/assess/assessClientApi";
import { getAssessProgram, setAssessProgram, subscribe } from "@/lib/localStore";
import { useOptionalToast } from "@/components/feedback/ToastProvider";
import { SaveStatusPill } from "@/components/assess/SaveStatusPill";

const DEBOUNCE_MS = 650;

/**
 * Module-level session flag — true once `load()` has fetched the
 * server snapshot and replaced localStorage. Survives provider
 * remounts (which happen on every route change because each route
 * segment has its own `AssessSyncProvider`-wrapped layout) but is
 * cleared on a hard page reload (the module re-evaluates).
 *
 * Why this matters: WITHOUT this flag, navigating Step 2 → Step 3
 * unmounts the Step 2 provider and mounts the Step 3 provider; the
 * new provider's `load()` would re-fetch the server snapshot and
 * call `setAssessProgram(d.program)` — silently overwriting any
 * unsaved local edits (e.g., a GCC % the user just hand-set). With
 * the flag, only the first provider mount of the session pulls
 * from the server; later mounts trust the in-memory + localStorage
 * state and let `subscribe("assessProgram", ...)` push updates.
 *
 * The flag is also cleared explicitly by `refetch()` so the user
 * (or an error-recovery flow) can force a fresh server pull.
 */
let SESSION_HAS_LOADED_FROM_SERVER = false;

export type SaveState = "idle" | "pending" | "saving" | "saved" | "error";
type DbMode = "unknown" | "unconfigured" | "unavailable" | "cloud" | "cloud_empty";

type Ctx = {
  /** Load complete; safe to read assess UI state. */
  ready: boolean;
  /** Server has DATABASE_URL; writes go to API. */
  canSync: boolean;
  loadError: string | null;
  saveState: SaveState;
  lastSaveError: string | null;
  /** Re-fetch from server and replace local (e.g. after error). */
  refetch: () => Promise<void>;
  /**
   * Save current program to server now (e.g. after file import or before
   * route change). Returns when the in-flight PUT settles.
   */
  flushSave: () => Promise<void>;
};

const AssessSyncContext = React.createContext<Ctx | null>(null);

export function useAssessSync(): Ctx | null {
  return React.useContext(AssessSyncContext);
}

export function AssessSyncProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = React.useState(false);
  const [canSync, setCanSync] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [saveState, setSaveState] = React.useState<SaveState>("idle");
  const [lastSaveError, setLastSaveError] = React.useState<string | null>(null);
  const [dbMode, setDbMode] = React.useState<DbMode>("unknown");
  const toast = useOptionalToast();

  const applyRemote = React.useRef(false);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveInFlight = React.useRef(false);

  const runPut = React.useCallback(async (program: AssessProgramV2) => {
    if (saveInFlight.current) return;
    saveInFlight.current = true;
    setSaveState("saving");
    setLastSaveError(null);
    const r = await clientPutAssess(program);
    saveInFlight.current = false;
    if (!r.ok) {
      setSaveState("error");
      setLastSaveError(r.error ?? "Save failed");
      return;
    }
    setSaveState("saved");
    window.setTimeout(() => {
      setSaveState((s) => (s === "saved" ? "idle" : s));
    }, 3000);
  }, []);

  const schedulePut = React.useCallback(() => {
    if (!canSync) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSaveState("pending");
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      if (applyRemote.current) return;
      void runPut(getAssessProgram());
    }, DEBOUNCE_MS);
  }, [canSync, runPut]);

  const load = React.useCallback(async (opts?: { force?: boolean }) => {
    // Per-session gate. The very first provider mount fetches from
    // the server and seeds localStorage; later provider remounts
    // (triggered by route changes — each route segment wraps its
    // own AssessSyncProvider) skip the fetch and trust the in-memory
    // state. This is the fix for: "I edit gccPct on Step 2, navigate
    // to Step 3, come back to Step 2, and my edits are gone." Before
    // this gate, `load()` would re-fetch the server's pre-edit
    // snapshot on every route mount and overwrite the local edits
    // via `setAssessProgram(d.program)`.
    //
    // `opts.force` is set by `refetch()` so error-recovery flows can
    // still pull a fresh server snapshot on demand. We always have
    // to seed `canSync` / `dbMode` / `ready` so the provider mounts
    // into a usable state even when we're skipping the actual fetch.
    if (SESSION_HAS_LOADED_FROM_SERVER && !opts?.force) {
      // Fast path — server state has already been merged into
      // localStorage earlier in the session. We still need to set
      // the provider flags so children gate on `ready === true`.
      setCanSync(true);
      setDbMode("cloud");
      setReady(true);
      return;
    }
    setLoadError(null);
    const r = await clientGetAssess();
    if (!r.ok || !r.data) {
      setLoadError(r.error ?? "Failed to load");
      setReady(true);
      setCanSync(false);
      setDbMode("unknown");
      return;
    }
    const d = r.data;
    if (d.db === "unconfigured") {
      setCanSync(false);
      setDbMode("unconfigured");
      setReady(true);
      SESSION_HAS_LOADED_FROM_SERVER = true;
      return;
    }
    if (d.db === "unavailable") {
      setCanSync(false);
      setDbMode("unavailable");
      setReady(true);
      SESSION_HAS_LOADED_FROM_SERVER = true;
      return;
    }
    setCanSync(true);
    if (d.program) {
      setDbMode("cloud");
      applyRemote.current = true;
      setAssessProgram(d.program);
      queueMicrotask(() => {
        applyRemote.current = false;
      });
    } else {
      setDbMode("cloud_empty");
    }
    setReady(true);
    SESSION_HAS_LOADED_FROM_SERVER = true;
  }, []);

  const refetch = React.useCallback(async () => {
    setReady(false);
    // Explicit user-initiated refresh — bypass the per-session gate.
    SESSION_HAS_LOADED_FROM_SERVER = false;
    await load({ force: true });
  }, [load]);

  const flushSave = React.useCallback(async () => {
    if (!canSync) return;
    // Only flush if there's an actual pending change. Without this guard,
    // any caller that runs `flushSave` defensively (e.g. on unmount) would
    // queue a redundant PUT every time, which combined with the saveState
    // re-render cycle produced an infinite save loop.
    const hadPending = debounceRef.current !== null;
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (!hadPending) return;
    await runPut(getAssessProgram());
  }, [canSync, runPut]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    if (!ready || !canSync) return;
    return subscribe("assessProgram", () => {
      if (applyRemote.current) return;
      schedulePut();
    });
  }, [ready, canSync, schedulePut]);

  // beforeunload guard: prompt before browser-level navigation when there's
  // unsaved or in-flight work. Next.js client navigation is handled by the
  // route-level useEffect cleanup that calls flushSave().
  React.useEffect(() => {
    if (!canSync) return;
    const handler = (e: BeforeUnloadEvent) => {
      if (saveState === "pending" || saveState === "saving") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [canSync, saveState]);

  // When the load fails, show a toast with retry. Loading itself doesn't toast
  // (the inline banner is enough); errors do.
  React.useEffect(() => {
    if (!loadError || !toast) return;
    toast.error({
      id: "assess-load-error",
      title: "Couldn't load assessment data",
      description: loadError,
      action: {
        label: "Retry",
        onClick: () => {
          void refetch();
        },
      },
    });
  }, [loadError, refetch, toast]);

  // When a save fails, surface a toast as well as the save-status pill.
  // Silent 403s (e.g., multi-tower drift) leave the user unaware their
  // Step 2 edits aren't reaching the database; the toast makes it
  // unmissable and offers a retry path.
  React.useEffect(() => {
    if (saveState !== "error" || !lastSaveError || !toast) return;
    toast.error({
      id: "assess-save-error",
      title: "Couldn't save assessment changes",
      description: lastSaveError,
      action: {
        label: "Retry",
        onClick: () => {
          void flushSave();
        },
      },
      durationMs: 12000,
    });
  }, [saveState, lastSaveError, flushSave, toast]);

  const value = React.useMemo<Ctx>(
    () => ({
      ready,
      canSync,
      loadError,
      saveState,
      lastSaveError,
      refetch,
      flushSave,
    }),
    [ready, canSync, loadError, saveState, lastSaveError, refetch, flushSave],
  );

  return (
    <AssessSyncContext.Provider value={value}>
      {ready ? (
        <>
          {dbMode === "unconfigured" ? (
            <div className="border-b border-forge-hint/40 bg-forge-well/50 px-4 py-2 text-center text-xs text-forge-hint">
              Assess data is local to this browser only. Set <code className="font-mono">DATABASE_URL</code> in{" "}
              <code className="font-mono">.env.local</code> and run the migration to enable shared persistence.
            </div>
          ) : null}
          {dbMode === "unavailable" ? (
            <div className="border-b border-accent-amber/40 bg-accent-amber/5 px-4 py-2 text-center text-xs text-forge-body">
              Could not reach the assessment database (timeout, refused, or bad{" "}
              <code className="font-mono">DATABASE_URL</code>). You are on{" "}
              <span className="font-semibold text-forge-ink">browser-local data</span> only until the connection
              works. Fix or remove <code className="font-mono">DATABASE_URL</code> /{" "}
              <code className="font-mono">POSTGRES_URL</code> in <code className="font-mono">.env.local</code>, then
              retry from the save pill or reload.
            </div>
          ) : null}
          <SaveStatusPill />
          {children}
        </>
      ) : (
        <div className="mx-auto max-w-lg px-4 py-20 text-center text-sm text-forge-hint">
          Loading assessment…
        </div>
      )}
    </AssessSyncContext.Provider>
  );
}
