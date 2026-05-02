import { isCapabilityMapJourneyStepDone } from "@/lib/assess/capabilityMapStepStatus";
import type { TowerAssessState } from "@/data/assess/types";

export type LeadProgramStep = 1 | 2 | 3 | 4;

export type DeadlineUrgency = "none" | "done" | "past_due" | "due_soon" | "pending";

/** Days before due date end (local) when we show "due soon" (amber). */
export const LEAD_DEADLINE_SOON_DAYS = 7;

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * End of calendar day in the user's local timezone for a `YYYY-MM-DD` string.
 * Used for past-due and due-soon comparisons.
 */
export function endOfLocalDayFromYmd(ymd: string): Date | null {
  if (!YMD_RE.test(ymd)) return null;
  const [y, m, d] = ymd.split("-").map((x) => Number(x));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}

export function isLeadStepDone(step: LeadProgramStep, t: TowerAssessState | undefined): boolean {
  if (!t) return false;
  if (step === 1) return isCapabilityMapJourneyStepDone(t);
  if (step === 2) return t.status === "complete";
  if (step === 3) return t.impactEstimateValidatedAt != null;
  return t.aiInitiativesValidatedAt != null;
}

/**
 * ISO timestamp that represents the tower-lead validation moment for a step.
 * Drives the "Done · {date}" chip copy on hubs and trackers.
 *
 *   - Step 1: `l1L5TreeValidatedAt` (or legacy `l1L3TreeValidatedAt`).
 *   - Step 2: `aiConfirmedAt / offshoreConfirmedAt / headcountConfirmedAt` are
 *     stamped to the same `now` by `doMarkComplete`; fall back to `lastUpdated`
 *     so legacy snapshots without the per-section timestamps still show a date.
 *     Only honored when `status === "complete"` — otherwise Step 2 is not done.
 *   - Step 3: `impactEstimateValidatedAt`.
 *   - Step 4: `aiInitiativesValidatedAt`.
 */
export function leadStepCompletedAtIso(
  step: LeadProgramStep,
  t: TowerAssessState | undefined,
): string | undefined {
  if (!t) return undefined;
  if (step === 1) return t.l1L5TreeValidatedAt ?? t.l1L3TreeValidatedAt;
  if (step === 2) {
    if (t.status !== "complete") return undefined;
    return (
      t.aiConfirmedAt ??
      t.offshoreConfirmedAt ??
      t.headcountConfirmedAt ??
      t.lastUpdated
    );
  }
  if (step === 3) return t.impactEstimateValidatedAt;
  return t.aiInitiativesValidatedAt;
}

export function dueYmdForStep(
  step: LeadProgramStep,
  deadlines: { step1Due?: string; step2Due?: string; step3Due?: string; step4Due?: string } | undefined,
): string | undefined {
  if (!deadlines) return undefined;
  if (step === 1) return deadlines.step1Due;
  if (step === 2) return deadlines.step2Due;
  if (step === 3) return deadlines.step3Due;
  return deadlines.step4Due;
}

/**
 * Classify a single due date vs completion. `dueDateYmd` must be `YYYY-MM-DD` or undefined.
 */
export function classifyLeadDeadline(
  dueDateYmd: string | undefined,
  isDone: boolean,
  now: Date,
  soonThresholdDays: number = LEAD_DEADLINE_SOON_DAYS,
): DeadlineUrgency {
  if (isDone) return "done";
  if (!dueDateYmd) return "none";
  const end = endOfLocalDayFromYmd(dueDateYmd);
  if (!end) return "none";
  if (now.getTime() > end.getTime()) return "past_due";
  const soonStart = new Date(end.getTime() - soonThresholdDays * 24 * 60 * 60 * 1000);
  if (now.getTime() >= soonStart.getTime()) return "due_soon";
  return "pending";
}

export type DeadlineChipCopy = {
  urgency: DeadlineUrgency;
  /** Short label for the chip (no date). */
  label: string;
  /**
   * Optional mono date fragment for display. Dual meaning:
   *   - When `urgency === "done"` and a `completedAtIso` was supplied, this is
   *     the formatted validation date (e.g. `Apr 30`).
   *   - Otherwise it is the raw `YYYY-MM-DD` due date.
   */
  dueDisplay?: string;
  /** Full sentence for aria-label. */
  ariaLabel: string;
};

/**
 * Format an ISO timestamp as a compact mono-display date (e.g. `Apr 30`).
 * Falls back to the raw input when parsing fails so the chip never goes
 * blank — better to show a slightly ugly stamp than nothing.
 */
function formatCompletedDateShort(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  try {
    return new Date(t).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export function deadlineChipCopy(
  towerName: string,
  step: LeadProgramStep,
  dueDateYmd: string | undefined,
  isDone: boolean,
  now: Date,
  soonThresholdDays: number = LEAD_DEADLINE_SOON_DAYS,
  completedAtIso?: string,
): DeadlineChipCopy {
  const urgency = classifyLeadDeadline(dueDateYmd, isDone, now, soonThresholdDays);
  const dueYmd = dueDateYmd && YMD_RE.test(dueDateYmd) ? dueDateYmd : undefined;
  const dueDisplay =
    urgency === "done" && completedAtIso
      ? formatCompletedDateShort(completedAtIso)
      : dueYmd;
  const stepLabel =
    step === 1 ? "Step 1" : step === 2 ? "Step 2" : step === 3 ? "Step 3" : "Step 4";

  let label: string;
  switch (urgency) {
    case "done":
      label = "Done";
      break;
    case "past_due":
      label = "Past due";
      break;
    case "due_soon":
      label = "Due soon";
      break;
    case "pending":
      label = "Pending";
      break;
    default:
      label = "";
  }

  const datePart =
    urgency === "done"
      ? dueDisplay
        ? `, validated ${dueDisplay}`
        : ""
      : dueDisplay
        ? `, due ${dueDisplay}`
        : "";
  const ariaLabel =
    urgency === "none"
      ? `${towerName}, ${stepLabel}, no deadline set`
      : `${towerName}, ${stepLabel}${datePart}, ${label || "no status"}`.trim();

  return { urgency, label, dueDisplay, ariaLabel };
}
