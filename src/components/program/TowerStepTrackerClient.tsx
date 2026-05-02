"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, Circle, Table2 } from "lucide-react";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { PageShell } from "@/components/PageShell";
import { towers } from "@/data/towers";
import type { AssessProgramV2, TowerId } from "@/data/assess/types";
import { getAssessProgram, getAssessProgramHydrationSnapshot, subscribe } from "@/lib/localStore";
import { getPortalAudience, isInternalSurfaceAllowed } from "@/lib/portalAudience";
import { getTowerHref } from "@/lib/towerHref";
import { formatAccentureTowerLeadNames } from "@/lib/program/towerLeadDisplay";
import {
  classifyLeadDeadline,
  deadlineChipCopy,
  dueYmdForStep,
  isLeadStepDone,
  leadStepCompletedAtIso,
  type LeadProgramStep,
} from "@/lib/program/leadStepStatus";
import { cn } from "@/lib/utils";

const STEP_HEADERS: { step: LeadProgramStep; label: string; hint: string }[] = [
  { step: 1, label: "Step 1", hint: "Capability map" },
  { step: 2, label: "Step 2", hint: "Impact levers" },
  { step: 3, label: "Step 3", hint: "Impact estimate" },
  { step: 4, label: "Step 4", hint: "AI initiatives" },
];

function stepHref(towerId: TowerId, step: LeadProgramStep): string {
  if (step === 1) return getTowerHref(towerId, "capability-map");
  if (step === 2) return getTowerHref(towerId, "impact-levers");
  if (step === 3) return "/impact-levers/summary";
  return getTowerHref(towerId, "ai-initiatives");
}

function TrackerStepCell({
  towerName,
  towerId,
  step,
  program,
  now,
}: {
  towerName: string;
  towerId: TowerId;
  step: LeadProgramStep;
  program: AssessProgramV2;
  now: Date;
}) {
  const t = program.towers[towerId];
  const due = dueYmdForStep(step, program.leadDeadlines?.[towerId]);
  const done = isLeadStepDone(step, t);
  const completedAt = leadStepCompletedAtIso(step, t);
  const href = stepHref(towerId, step);

  if (done) {
    const { dueDisplay } = deadlineChipCopy(
      towerName,
      step,
      due,
      true,
      now,
      undefined,
      completedAt,
    );
    return (
      <Link
        href={href}
        className="group inline-flex flex-col items-start gap-0.5 rounded-md px-1 py-0.5 text-left transition hover:bg-accent-green/10"
        aria-label={`${towerName}, ${STEP_HEADERS.find((s) => s.step === step)?.hint ?? `Step ${step}`}, complete${dueDisplay ? `, validated ${dueDisplay}` : ""}. Open workspace.`}
      >
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-accent-green">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Complete
        </span>
        {dueDisplay ? (
          <span className="font-mono text-[10px] text-forge-hint">Validated {dueDisplay}</span>
        ) : null}
      </Link>
    );
  }

  const urgency = classifyLeadDeadline(due, false, now);
  const { label, dueDisplay, ariaLabel } = deadlineChipCopy(towerName, step, due, false, now);
  const urgencyClass =
    urgency === "past_due"
      ? "text-[#FF3D00]"
      : urgency === "due_soon"
        ? "text-accent-amber"
        : urgency === "pending"
          ? "text-forge-subtle"
          : "text-forge-hint";

  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex flex-col items-start gap-0.5 rounded-md px-1 py-0.5 text-left transition hover:bg-accent-purple/10",
      )}
      aria-label={`${ariaLabel}. Open ${STEP_HEADERS.find((s) => s.step === step)?.hint ?? `step ${step}`}.`}
    >
      <span className={cn("inline-flex items-center gap-1 text-xs font-medium", urgencyClass)}>
        <Circle className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
        {urgency === "none" ? "In progress" : label}
      </span>
      {dueDisplay ? (
        <span className="font-mono text-[10px] text-forge-subtle">Due {dueDisplay}</span>
      ) : null}
    </Link>
  );
}

function countDone(program: AssessProgramV2, step: LeadProgramStep): number {
  let n = 0;
  for (const tw of towers) {
    const tid = tw.id as TowerId;
    if (isLeadStepDone(step, program.towers[tid])) n += 1;
  }
  return n;
}

export function TowerStepTrackerClient() {
  const allowedInternal = isInternalSurfaceAllowed(getPortalAudience());
  const [program, setProgram] = React.useState<AssessProgramV2>(() => getAssessProgramHydrationSnapshot());
  /** Epoch anchor until mount so SSR and first paint match. */
  const [now, setNow] = React.useState(() => new Date(0));

  React.useEffect(() => {
    setProgram(getAssessProgram());
    setNow(new Date());
    return subscribe("assessProgram", () => {
      setProgram(getAssessProgram());
    });
  }, []);

  React.useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const summary = React.useMemo(
    () => ({
      s1: countDone(program, 1),
      s2: countDone(program, 2),
      s3: countDone(program, 3),
      s4: countDone(program, 4),
      n: towers.length,
    }),
    [program],
  );

  return (
    <PageShell>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <Breadcrumbs
          items={[
            { label: "Program home", href: "/" },
            { label: "Tower step status" },
          ]}
        />

        <div className="mt-4">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-accent-teal/35 bg-accent-teal/5 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-accent-teal">
            <Table2 className="h-3 w-3" aria-hidden />
            Program visibility
          </div>
          <h1 className="mt-2 font-display text-2xl font-semibold text-forge-ink">
            <span className="font-mono text-accent-purple-dark">&gt;</span> Tower step status
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-forge-body">
            One view across all Versant Forge towers for Accenture delivery: Accenture tower lead
            names from the catalog, completion for Steps 1–4 (capability map through AI initiatives),
            and deadline-aware urgency where program dates exist. Each cell links to the workspace for
            that tower and step.
          </p>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(
            [
              ["Step 1 complete", summary.s1],
              ["Step 2 complete", summary.s2],
              ["Step 3 complete", summary.s3],
              ["Step 4 complete", summary.s4],
            ] as const
          ).map(([label, c]) => (
            <div
              key={label}
              className="rounded-xl border border-forge-border bg-forge-surface/60 px-3 py-2"
            >
              <dt className="text-[10px] font-medium uppercase tracking-wider text-forge-hint">
                {label}
              </dt>
              <dd className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-forge-ink">
                {c}
                <span className="text-sm font-normal text-forge-subtle"> / {summary.n}</span>
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-6 overflow-x-auto rounded-2xl border border-forge-border bg-forge-surface/60">
          <table className="w-full min-w-[900px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-forge-border bg-forge-well/40">
                <th
                  scope="col"
                  className="sticky left-0 z-[1] bg-forge-well/95 px-3 py-2.5 font-mono text-[10px] uppercase tracking-wider text-forge-hint backdrop-blur-sm"
                >
                  Tower
                </th>
                <th
                  scope="col"
                  className="min-w-[10rem] px-3 py-2.5 font-mono text-[10px] uppercase tracking-wider text-forge-hint"
                >
                  Accenture tower lead
                </th>
                {STEP_HEADERS.map((h) => (
                  <th
                    key={h.step}
                    scope="col"
                    className="min-w-[7.5rem] px-2 py-2.5 font-mono text-[10px] uppercase tracking-wider text-forge-hint"
                  >
                    <span className="block">{h.label}</span>
                    <span className="mt-0.5 block font-sans text-[9px] font-normal normal-case tracking-normal text-forge-subtle">
                      {h.hint}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {towers.map((tw) => {
                const tid = tw.id as TowerId;
                const leads = formatAccentureTowerLeadNames(tw);
                return (
                  <tr key={tw.id} className="border-b border-forge-border/80 last:border-0">
                    <th
                      scope="row"
                      className="sticky left-0 z-[1] bg-forge-surface/95 px-3 py-2.5 text-left font-medium text-forge-ink backdrop-blur-sm"
                    >
                      <Link
                        href={getTowerHref(tid, "capability-map")}
                        className="text-forge-ink underline decoration-forge-border decoration-1 underline-offset-2 hover:text-accent-purple-dark hover:decoration-accent-purple/40"
                      >
                        {tw.name}
                      </Link>
                    </th>
                    <td className="max-w-[14rem] px-3 py-2 text-sm text-forge-body">{leads}</td>
                    {STEP_HEADERS.map((h) => (
                      <td key={h.step} className="align-top px-2 py-2">
                        <TrackerStepCell
                          towerName={tw.name}
                          towerId={tid}
                          step={h.step}
                          program={program}
                          now={now}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex flex-wrap gap-3 text-xs text-forge-subtle">
          <Link href="/" className="text-accent-purple-dark underline hover:text-accent-purple">
            Program home
          </Link>
          <Link href="/capability-map" className="text-accent-purple-dark underline hover:text-accent-purple">
            Capability Map hub
          </Link>
          {allowedInternal ? (
            <Link
              href="/program/lead-deadlines"
              className="text-accent-purple-dark underline hover:text-accent-purple"
            >
              Lead deadlines (admin)
            </Link>
          ) : null}
        </div>
      </div>
    </PageShell>
  );
}
