"use client";

import * as React from "react";
import type { AssessProgramV2 } from "@/data/assess/types";
import { clientGetAssess, clientPutAssess } from "@/lib/assess/assessClientApi";
import { getAssessProgram, setAssessProgram, subscribe } from "@/lib/localStore";
import { useOptionalToast } from "@/components/feedback/ToastProvider";
import { SaveStatusPill } from "@/components/assess/SaveStatusPill";

const DEBOUNCE_MS = 650;

export type SaveState = "idle" | "pending" | "saving" | "saved" | "error";
type DbMode = "unknown" | "unconfigured" | "cloud" | "cloud_empty";

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

  const load = React.useCallback(async () => {
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
  }, []);

  const refetch = React.useCallback(async () => {
    setReady(false);
    await load();
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
      title: "Couldn't load workshop data",
      description: loadError,
      action: {
        label: "Retry",
        onClick: () => {
          void refetch();
        },
      },
    });
  }, [loadError, refetch, toast]);

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
          <SaveStatusPill />
          {children}
        </>
      ) : (
        <div className="mx-auto max-w-lg px-4 py-20 text-center text-sm text-forge-hint">
          Loading assess workshop…
        </div>
      )}
    </AssessSyncContext.Provider>
  );
}
