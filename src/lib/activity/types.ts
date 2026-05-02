// Server-derived activity events for the RecentUpdatesPill and TowerFreshnessChip.
//
// Source of truth: per-tower semantic timestamps already persisted in the
// `assess_workshop` Postgres document (see TowerAssessReview in
// `src/data/assess/types.ts`). Deliberate user actions only — we do NOT
// emit events from `lastUpdated`, which is bumped on every keystroke-grade
// edit and would flood the rail with noise.

export type ActivityEventKind =
  | "capability-map-confirmed"
  | "headcount-confirmed"
  | "offshore-confirmed"
  | "ai-confirmed"
  | "impact-validated"
  | "ai-initiatives-validated";

export type ActivityEvent = {
  towerId: string;
  /** Real, from data/towers.ts (e.g. "Editorial — News"). */
  towerName: string;
  kind: ActivityEventKind;
  /** ISO 8601 timestamp. */
  at: string;
  /** Canonical in-app href to the tower page. */
  href: string;
};

export type ActivityResponse = {
  ok: true;
  events: ActivityEvent[];
};
