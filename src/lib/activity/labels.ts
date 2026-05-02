import type { ActivityEvent, ActivityEventKind } from "./types";

const VERB_BY_KIND: Record<ActivityEventKind, string> = {
  "ai-initiatives-validated": "refreshed AI initiatives",
  "offshore-confirmed": "confirmed offshore plan",
  "headcount-confirmed": "validated headcount",
  "capability-map-confirmed": "locked capability map",
  "impact-validated": "signed off impact estimate",
  "ai-confirmed": "confirmed AI dial",
};

/** "{Tower} {verb}" — used in the activity rail. */
export function activityHeadline(ev: ActivityEvent): string {
  return `${ev.towerName} ${VERB_BY_KIND[ev.kind]}`;
}

/** Just the verb, used when the tower name is rendered separately. */
export function activityVerb(kind: ActivityEventKind): string {
  return VERB_BY_KIND[kind];
}

/**
 * Compact relative-time formatter aimed at the activity rail.
 * Returns: "just now", "5m ago", "2h ago", "3d ago", "Apr 22".
 */
export function formatRelativeTime(iso: string, now: number = Date.now()): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const diffMs = Math.max(0, now - t);
  const sec = Math.floor(diffMs / 1000);
  if (sec < 45) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  try {
    return new Date(t).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return `${day}d ago`;
  }
}

/** Full timestamp, used as a tooltip on the relative-time pill. */
export function formatExactTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
