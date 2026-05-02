"use client";

import * as React from "react";

const SESSION_KEY = "forge.presenceId";
const REPING_THROTTLE_MS = 5 * 60 * 1000;

type PresenceResponse = { ok: true; count: number } | { ok: false };

type State = {
  count: number | null;
  loading: boolean;
};

const INITIAL: State = { count: null, loading: true };

function getOrCreateSessionId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const existing = window.localStorage.getItem(SESSION_KEY);
    if (existing && existing.length >= 8) return existing;
    const fresh =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
    window.localStorage.setItem(SESSION_KEY, fresh);
    return fresh;
  } catch {
    return null;
  }
}

let lastPingMs = 0;

/**
 * One-shot presence ping on mount + a throttled re-ping on internal SPA
 * navigation, so a browser left open all day still registers as active
 * "today" without sending continuous heartbeats. Returns the count returned
 * by the server's POST response. SSR-safe: count is `null` until hydrated.
 */
export function usePresence(): State {
  const [state, setState] = React.useState<State>(INITIAL);

  React.useEffect(() => {
    let cancelled = false;
    const sessionId = getOrCreateSessionId();
    if (!sessionId) {
      setState({ count: null, loading: false });
      return;
    }

    const now = Date.now();
    if (now - lastPingMs < REPING_THROTTLE_MS && lastPingMs !== 0) {
      // Use a cheap GET when we recently pinged from this browser.
      void fetch("/api/presence", { cache: "no-store" })
        .then((r) => (r.ok ? (r.json() as Promise<PresenceResponse>) : null))
        .then((j) => {
          if (cancelled) return;
          if (j && "ok" in j && j.ok) {
            setState({ count: j.count, loading: false });
          } else {
            setState({ count: null, loading: false });
          }
        })
        .catch(() => {
          if (!cancelled) setState({ count: null, loading: false });
        });
      return () => {
        cancelled = true;
      };
    }

    lastPingMs = now;
    void fetch("/api/presence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
      cache: "no-store",
    })
      .then((r) => (r.ok ? (r.json() as Promise<PresenceResponse>) : null))
      .then((j) => {
        if (cancelled) return;
        if (j && "ok" in j && j.ok) {
          setState({ count: j.count, loading: false });
        } else {
          setState({ count: null, loading: false });
        }
      })
      .catch(() => {
        if (!cancelled) setState({ count: null, loading: false });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
