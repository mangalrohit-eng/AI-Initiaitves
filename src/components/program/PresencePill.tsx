"use client";

import * as React from "react";
import { Users } from "lucide-react";
import { usePresence } from "@/lib/presence/usePresence";

/**
 * Compact "X active today" pill for the Program Home header. Hides itself
 * when the count is unavailable (DB unconfigured, route 401, browser pre-
 * hydration) or zero — we never render a fake number.
 *
 * "Today" = since UTC midnight, computed server-side. The label deliberately
 * says "active today" rather than "users today" because the app uses one
 * shared login: we count distinct browsers, not distinct humans, and the
 * tooltip is explicit about that.
 */
export function PresencePill() {
  const { count, loading } = usePresence();
  if (loading || count === null || count <= 0) return null;
  const label = count === 1 ? "1 active today" : `${count} active today`;
  return (
    <span
      title="Distinct browsers that opened the app today (UTC)."
      className="inline-flex items-center gap-1.5 rounded-full border border-accent-purple/30 bg-accent-purple/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-accent-purple-dark"
    >
      <Users className="h-3 w-3" aria-hidden />
      <span className="font-mono">{count}</span>
      <span aria-hidden>·</span>
      <span>active today</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
