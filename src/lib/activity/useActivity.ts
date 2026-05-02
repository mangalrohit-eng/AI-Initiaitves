"use client";

import * as React from "react";
import type { ActivityEvent, ActivityResponse } from "./types";

const POLL_MS = 60_000;

type State = {
  events: ActivityEvent[];
  loading: boolean;
  /** True after the first fetch completes (success or empty), so callers can show a stable empty state. */
  ready: boolean;
};

const INITIAL: State = { events: [], loading: true, ready: false };

// --- Module-level singleton ----------------------------------------------
//
// Multiple components on the same page subscribe to this hook (the activity
// rail on home, every tower freshness chip on /towers). Without a singleton
// each mount would start its own 60s polling loop and we'd hit /api/activity
// once per second on a busy page. The singleton coalesces all subscribers
// into a single shared poll and a single shared state object.

let sharedState: State = INITIAL;
const subscribers = new Set<(s: State) => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let inFlight: AbortController | null = null;
let visibilityListenerInstalled = false;

function notify() {
  // Snapshot to array so a subscriber that unsubscribes mid-notify can't
  // mutate the live Set we're iterating, and to keep iteration ES5-safe.
  for (const fn of Array.from(subscribers)) fn(sharedState);
}

async function fetchOnce() {
  inFlight?.abort();
  inFlight = new AbortController();
  try {
    const res = await fetch("/api/activity", {
      cache: "no-store",
      signal: inFlight.signal,
    });
    if (!res.ok) {
      sharedState = { ...sharedState, loading: false, ready: true };
      notify();
      return;
    }
    const json = (await res.json()) as ActivityResponse | { ok: false };
    if ("ok" in json && json.ok && Array.isArray(json.events)) {
      sharedState = { events: json.events, loading: false, ready: true };
    } else {
      sharedState = { ...sharedState, loading: false, ready: true };
    }
    notify();
  } catch {
    // Aborted (intentional) or network — leave events alone, mark ready.
    sharedState = { ...sharedState, loading: false, ready: true };
    notify();
  }
}

function ensurePolling() {
  if (timer != null) return;
  timer = setInterval(() => {
    if (typeof document !== "undefined" && document.hidden) return;
    void fetchOnce();
  }, POLL_MS);

  if (!visibilityListenerInstalled && typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) void fetchOnce();
    });
    visibilityListenerInstalled = true;
  }
}

function teardownIfIdle() {
  if (subscribers.size > 0) return;
  if (timer != null) {
    clearInterval(timer);
    timer = null;
  }
  inFlight?.abort();
  inFlight = null;
}

/**
 * Subscribes to the singleton activity feed. The first mount triggers an
 * immediate fetch + starts the 60s poller; subsequent mounts piggy-back on
 * the same loop. The poller pauses when the tab is hidden.
 */
export function useActivity(): State {
  const [, force] = React.useReducer((x: number) => x + 1, 0);
  const stateRef = React.useRef<State>(sharedState);
  stateRef.current = sharedState;

  React.useEffect(() => {
    const onChange = (s: State) => {
      stateRef.current = s;
      force();
    };
    subscribers.add(onChange);
    if (subscribers.size === 1) {
      void fetchOnce();
    }
    ensurePolling();
    return () => {
      subscribers.delete(onChange);
      teardownIfIdle();
    };
  }, []);

  return stateRef.current;
}

/**
 * Cheap selector for per-tower freshness chips: returns the most recent event
 * for a single tower (or undefined). Avoids re-rendering every chip when an
 * unrelated tower's event arrives.
 */
export function useTowerLastTouched(
  events: ActivityEvent[],
  towerId: string,
): ActivityEvent | undefined {
  return React.useMemo(() => {
    let best: ActivityEvent | undefined;
    let bestMs = -Infinity;
    for (const ev of events) {
      if (ev.towerId !== towerId) continue;
      const ms = Date.parse(ev.at);
      if (Number.isFinite(ms) && ms > bestMs) {
        best = ev;
        bestMs = ms;
      }
    }
    return best;
  }, [events, towerId]);
}
