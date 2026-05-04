"use client";

import * as React from "react";

/**
 * Client-view runtime toggle — Protected by default.
 *
 * Lets an Accenture tower lead flip between "Protected" (the default) and
 * "Normal" presentation in-session. When Protected is on, every modeled-
 * dollar surface in the assessment pipeline (pool $, modeled saving,
 * blended rates, AI $ chips, capability-map spend overrides, lever
 * scoreboards, the Recharts modeled-by-tower bar chart, etc.) is either
 * replaced with a neutral placeholder or hidden outright. Workshop CSV
 * exports stay available; modeled-$ cells in those CSVs are written as an
 * em dash instead of numerics so the lead can export without toggling off
 * Protected first.
 *
 * The static Versant-published narrative figures (revenue, EBITDA, debt,
 * dividend, etc.) baked into `src/data/*.ts` copy are intentionally NOT
 * redacted — they come from the public 10-K context and aren't Accenture's
 * working model.
 *
 * Default model: Protected ON until the lead explicitly opts out for the
 * session. The opt-out is stored as `forge_client_mode = "false"` in
 * `sessionStorage`; a missing key (or the legacy `"true"` value) means
 * Protected. Each new browser session resets back to Protected so a
 * forgotten "Normal view" can't leak into the next day's work.
 *
 * Cross-tab note: `sessionStorage` is per-tab/window and does not raise
 * `storage` events across tabs. The listener below covers the same-tab
 * storage-clear edge case only; new tabs always start fresh in Protected,
 * which is the safe behaviour for a client-handoff scenario.
 */

const STORAGE_KEY = "forge_client_mode";

type ClientModeContextValue = {
  /** True when the client-safe redaction layer is active. */
  clientMode: boolean;
  /** True after the provider has hydrated from sessionStorage. */
  mounted: boolean;
  setClientMode: (next: boolean) => void;
  toggleClientMode: () => void;
};

const ClientModeContext = React.createContext<ClientModeContextValue | null>(null);

function readStored(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

function writeStored(next: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (next) window.sessionStorage.removeItem(STORAGE_KEY);
    else window.sessionStorage.setItem(STORAGE_KEY, "false");
  } catch {
    // ignore — safari private mode etc.
  }
}

export function ClientModeProvider({ children }: { children: React.ReactNode }) {
  const [clientMode, setClientModeState] = React.useState(true);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    setClientModeState(readStored());

    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key !== STORAGE_KEY) return;
      setClientModeState(readStored());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setClientMode = React.useCallback((next: boolean) => {
    setClientModeState(next);
    writeStored(next);
  }, []);

  const toggleClientMode = React.useCallback(() => {
    setClientModeState((prev) => {
      const next = !prev;
      writeStored(next);
      return next;
    });
  }, []);

  const value = React.useMemo<ClientModeContextValue>(
    () => ({ clientMode, mounted, setClientMode, toggleClientMode }),
    [clientMode, mounted, setClientMode, toggleClientMode],
  );

  return <ClientModeContext.Provider value={value}>{children}</ClientModeContext.Provider>;
}

export function useClientMode(): ClientModeContextValue {
  const ctx = React.useContext(ClientModeContext);
  if (!ctx) {
    return {
      clientMode: true,
      mounted: false,
      setClientMode: () => {},
      toggleClientMode: () => {},
    };
  }
  return ctx;
}

/**
 * Sugar for the most common case — components that only need the boolean.
 * Returns `true` (Protected) until the provider has mounted, so a fresh
 * visit never paints modeled-$ before the storage read resolves. The
 * provider's initial state is also `true`, so SSR HTML and the first
 * client render agree and there is no hydration mismatch.
 */
export function useRedactDollars(): boolean {
  const { clientMode, mounted } = useClientMode();
  return mounted ? clientMode : true;
}

/**
 * Visual placeholder for a redacted dollar value. Same `font-mono` shape as
 * `MoneyCounter` / `formatMoney` output so the layout doesn't shift when
 * the lead toggles modes. Renders as a plain em-dash with no tooltip — to
 * a viewer this looks indistinguishable from genuinely missing data.
 */
export function RedactedAmount({
  className,
  ariaLabel,
}: {
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <span className={className} aria-label={ariaLabel}>
      —
    </span>
  );
}

/** Plain-string placeholder — for templates / interpolated copy. */
export const REDACTED_DASH = "—" as const;
