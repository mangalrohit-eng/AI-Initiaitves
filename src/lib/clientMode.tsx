"use client";

import * as React from "react";

/**
 * Client-view runtime toggle — Protected by default.
 *
 * Only a signed-in **program admin** (`forge_admin_session` validated server-side
 * and passed as `allowUnprotectedView`) may switch to "Normal" presentation for
 * the session. Tower leads (workshop session only) always see modeled-dollar
 * surfaces redacted; the top-nav shield control is hidden for them.
 *
 * When Protected is on, every modeled-dollar surface in the assessment pipeline
 * (pool $, modeled saving, blended rates, AI $ chips, capability-map spend
 * overrides, lever scoreboards, the Recharts modeled-by-tower bar chart, etc.)
 * is either replaced with a neutral placeholder or hidden outright. Workshop CSV
 * exports stay available; modeled-$ cells in those CSVs are written as an em dash
 * instead of numerics.
 *
 * The static Versant-published narrative figures (revenue, EBITDA, debt,
 * dividend, etc.) baked into `src/data/*.ts` copy are intentionally NOT redacted
 * — they come from the public 10-K context and aren't Accenture's working model.
 *
 * For admins who may opt out: the choice is stored as `forge_client_mode = "false"`
 * in `sessionStorage`; a missing key means Protected. Each new browser session
 * starts from storage after mount; non-admin sessions clear any stored Normal opt-out.
 *
 * Cross-tab note: `sessionStorage` is per-tab/window and does not raise `storage`
 * events across tabs. The listener below covers the same-tab edge case only.
 */

const STORAGE_KEY = "forge_client_mode";

type ClientModeContextValue = {
  /** Effective client-safe redaction: true = Protected (modeled $ hidden). */
  clientMode: boolean;
  /** True after the provider has hydrated from sessionStorage. */
  mounted: boolean;
  /** Program admin only — controls visibility of the nav toggle and write access. */
  canToggleClientMode: boolean;
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

export function ClientModeProvider({
  children,
  allowUnprotectedView,
}: {
  children: React.ReactNode;
  /** From server: valid `forge_admin_session` only. */
  allowUnprotectedView: boolean;
}) {
  const [clientMode, setClientModeState] = React.useState(true);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    if (!allowUnprotectedView) {
      try {
        window.sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
      setClientModeState(true);
    } else {
      setClientModeState(readStored());
    }
    setMounted(true);

    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key !== STORAGE_KEY) return;
      if (!allowUnprotectedView) return;
      setClientModeState(readStored());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [allowUnprotectedView]);

  const setClientMode = React.useCallback(
    (next: boolean) => {
      if (!allowUnprotectedView) return;
      setClientModeState(next);
      writeStored(next);
    },
    [allowUnprotectedView],
  );

  const toggleClientMode = React.useCallback(() => {
    if (!allowUnprotectedView) return;
    setClientModeState((prev) => {
      const next = !prev;
      writeStored(next);
      return next;
    });
  }, [allowUnprotectedView]);

  const effectiveClientMode = allowUnprotectedView ? clientMode : true;

  const value = React.useMemo<ClientModeContextValue>(
    () => ({
      clientMode: effectiveClientMode,
      mounted,
      canToggleClientMode: allowUnprotectedView,
      setClientMode,
      toggleClientMode,
    }),
    [effectiveClientMode, mounted, allowUnprotectedView, setClientMode, toggleClientMode],
  );

  return <ClientModeContext.Provider value={value}>{children}</ClientModeContext.Provider>;
}

export function useClientMode(): ClientModeContextValue {
  const ctx = React.useContext(ClientModeContext);
  if (!ctx) {
    return {
      clientMode: true,
      mounted: false,
      canToggleClientMode: false,
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
 * the mode changes. Renders as a plain em-dash with no tooltip — to
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
