"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { AssessProgramV2, TowerId } from "@/data/assess/types";
import {
  deadlineChipCopy,
  dueYmdForStep,
  isLeadStepDone,
  type LeadProgramStep,
} from "@/lib/program/leadStepStatus";

type Props = {
  towerName: string;
  towerId: TowerId;
  step: LeadProgramStep;
  program: AssessProgramV2;
  /** Re-render on interval so "due soon" / past due advance without navigation. */
  tickMs?: number;
};

export function LeadDeadlineChip({ towerName, towerId, step, program, tickMs = 60_000 }: Props) {
  /** Epoch anchor for SSR + hydration; real clock starts after mount. */
  const [now, setNow] = React.useState(() => new Date(0));
  React.useEffect(() => {
    setNow(new Date());
    if (!tickMs) return;
    const id = window.setInterval(() => setNow(new Date()), tickMs);
    return () => window.clearInterval(id);
  }, [tickMs]);

  const t = program.towers[towerId];
  const due = dueYmdForStep(step, program.leadDeadlines?.[towerId]);
  const done = isLeadStepDone(step, t);
  const { urgency, label, dueDisplay, ariaLabel } = deadlineChipCopy(towerName, step, due, done, now);

  if (urgency === "none") return null;

  const color =
    urgency === "done"
      ? "border-accent-green/40 bg-accent-green/10 text-accent-green"
      : urgency === "past_due"
        ? "border-[#FF3D00]/40 bg-[#FF3D00]/10 text-[#FF3D00]"
        : urgency === "due_soon"
          ? "border-accent-amber/45 bg-accent-amber/10 text-accent-amber"
          : "border-forge-border bg-forge-well/60 text-forge-subtle";

  return (
    <span
      role="status"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex max-w-full flex-wrap items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        color,
      )}
    >
      <span>{label}</span>
      {dueDisplay ? (
        <span className="font-mono normal-case tracking-normal text-[11px] font-medium opacity-90">
          {dueDisplay}
        </span>
      ) : null}
    </span>
  );
}
