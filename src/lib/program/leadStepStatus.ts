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
  /** Optional mono date fragment for display. */
  dueDisplay?: string;
  /** Full sentence for aria-label. */
  ariaLabel: string;
};

export function deadlineChipCopy(
  towerName: string,
  step: LeadProgramStep,
  dueDateYmd: string | undefined,
  isDone: boolean,
  now: Date,
  soonThresholdDays: number = LEAD_DEADLINE_SOON_DAYS,
): DeadlineChipCopy {
  const urgency = classifyLeadDeadline(dueDateYmd, isDone, now, soonThresholdDays);
  const dueDisplay = dueDateYmd && YMD_RE.test(dueDateYmd) ? dueDateYmd : undefined;
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

  const datePart = dueDisplay ? `, due ${dueDisplay}` : "";
  const ariaLabel =
    urgency === "none"
      ? `${towerName}, ${stepLabel}, no deadline set`
      : `${towerName}, ${stepLabel}${datePart}, ${label || "no status"}`.trim();

  return { urgency, label, dueDisplay, ariaLabel };
}
