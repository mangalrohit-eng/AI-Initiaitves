"use client";

import * as React from "react";

/**
 * Client-view runtime toggle.
 *
 * Lets an Accenture tower lead flip between "internal" (default) and "client"
 * presentation in-session. When client mode is on, every modeled-dollar
 * surface in the assessment pipeline (pool $, modeled saving, blended rates,
 * AI $ chips, capability-map spend overrides, lever scoreboards, the
 * Recharts modeled-by-tower bar chart, CSV export entry points, etc.) is
 * either replaced with a neutral placeholder or hidden outright — so the
 * lead can hand the laptop to the client without exposing in-progress
 * financial figures.
 *
 * The static Versant-published narrative figures (revenue, EBITDA, debt,
 * dividend, etc.) baked into `src/data/*.ts` copy are intentionally NOT
 * redacted — they come from the public 10-K context and aren't Accenture's
 * working model.
 *
 * Persistence: `sessionStorage`. The toggle clears on a new browser session
 * so a forgotten "client view" can't leak into the next day's work.
 *
 * Cross-tab: a `storage` listener keeps every tab in sync the moment the
 * lead toggles in any one of them.
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
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function writeStored(next: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (next) window.sessionStorage.setItem(STORAGE_KEY, "true");
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore — safari private mode etc.
  }
}

export function ClientModeProvider({ children }: { children: React.ReactNode }) {
  const [clientMode, setClientModeState] = React.useState(false);
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
      clientMode: false,
      mounted: false,
      setClientMode: () => {},
      toggleClientMode: () => {},
    };
  }
  return ctx;
}

/**
 * Sugar for the most common case — components that only need the boolean.
 * Returns `false` until the provider has mounted to avoid SSR / hydration
 * mismatch (matches the pattern used in NavActions).
 */
export function useRedactDollars(): boolean {
  const { clientMode, mounted } = useClientMode();
  return mounted && clientMode;
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
