"use client";

import * as React from "react";
import { Clock } from "lucide-react";
import { formatExactTime, formatRelativeTime } from "@/lib/activity/labels";
import { useActivity, useTowerLastTouched } from "@/lib/activity/useActivity";

/**
 * Server-truth "last touched" chip for a tower card. Renders nothing until
 * an event for this tower exists.
 *
 * Distinct from `ChangedSinceBadge` (the purple dot on the same row): that
 * badge is local-storage "new since YOUR last visit" against the static
 * `tower.lastUpdated` from `data/towers.ts`. This chip is the live workshop
 * timestamp every viewer sees, sourced from `/api/activity`.
 */
export function TowerFreshnessChip({ towerId }: { towerId: string }) {
  const { events, ready } = useActivity();
  const last = useTowerLastTouched(events, towerId);
  if (!ready || !last) return null;
  return (
    <span
      title={`Last workshop activity: ${formatExactTime(last.at)}`}
      className="inline-flex items-center gap-1 rounded-full border border-forge-border bg-forge-well/60 px-1.5 py-0.5 text-[10px] font-medium text-forge-subtle"
    >
      <Clock className="h-2.5 w-2.5" aria-hidden />
      <span className="font-mono text-[10px] text-forge-body">
        {formatRelativeTime(last.at)}
      </span>
    </span>
  );
}
