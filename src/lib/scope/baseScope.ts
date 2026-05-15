"use client";

import * as React from "react";

/**
 * Program-level "base scope" for the Cross-Tower AI Plan.
 *
 *   - `all-org`        — every L4 Activity Group counts toward the strategist
 *                        run, regardless of Step 2 lane decision. This is the
 *                        Versant-day-one view: "all 14 towers as they stand".
 *   - `retained-only`  — only L4s landed in OnshoreRetained / EditorialCarveOut
 *                        contribute to the strategist run. This is the
 *                        post-GCC view: "what AI does Versant's retained
 *                        organisation still need?".
 *
 * The scope is persisted client-side (localStorage) AND mirrored to the URL
 * query string (`?scope=retained-only`) so the Cross-Tower deep link
 * survives a refresh. It is NOT stored on `AssessProgramV2` — it is a UI
 * preference, not part of the program's data state. The strategist input
 * builder still includes the scope in its `inputHash` so cache lookups
 * always honour the active scope.
 */
export type BaseScope = "all-org" | "retained-only";

export const DEFAULT_BASE_SCOPE: BaseScope = "all-org";

const STORAGE_KEY = "forge.crossTower.baseScope.v1";

function isBaseScope(v: unknown): v is BaseScope {
  return v === "all-org" || v === "retained-only";
}

export function readBaseScope(): BaseScope {
  if (typeof window === "undefined") return DEFAULT_BASE_SCOPE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw && isBaseScope(raw)) return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_BASE_SCOPE;
}

export function writeBaseScope(value: BaseScope): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
    window.dispatchEvent(new CustomEvent("forge:baseScopeChange"));
  } catch {
    /* ignore */
  }
}

/**
 * Hook returning the current `BaseScope` and a setter. Synchronises with
 * the URL query string when `syncUrl` is true (default) — the URL is the
 * source of truth when present, falling back to localStorage otherwise.
 *
 * Subscribes to a `forge:baseScopeChange` event so multiple component
 * instances (e.g. selector + strategist tab) stay in sync within the
 * same browser tab without round-tripping through React state.
 */
export function useBaseScope(): [BaseScope, (next: BaseScope) => void] {
  const [scope, setScope] = React.useState<BaseScope>(() => readBaseScope());

  // Hydrate from URL on first client render, if a `scope=` param is present.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("scope");
    if (fromUrl && isBaseScope(fromUrl) && fromUrl !== scope) {
      setScope(fromUrl);
      writeBaseScope(fromUrl);
    }
    // Subscribe to in-tab changes so a second hook instance stays in sync.
    const onChange = () => setScope(readBaseScope());
    window.addEventListener("forge:baseScopeChange", onChange);
    return () => window.removeEventListener("forge:baseScopeChange", onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setter = React.useCallback((next: BaseScope) => {
    setScope(next);
    writeBaseScope(next);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (next === DEFAULT_BASE_SCOPE) url.searchParams.delete("scope");
      else url.searchParams.set("scope", next);
      window.history.replaceState(null, "", url.toString());
    }
  }, []);

  return [scope, setter];
}

export function baseScopeLabel(scope: BaseScope): string {
  return scope === "retained-only" ? "Retained org only" : "All of Versant";
}

export function baseScopeDescription(scope: BaseScope): string {
  return scope === "retained-only"
    ? "Strategist run only sees roles staying onshore after the GCC build-out — the AI plan for Versant's retained organisation."
    : "Strategist run sees every role across all 14 towers — the full Versant AI plan, regardless of offshore intent.";
}
