"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarRange,
  ChevronRight,
  ExternalLink,
  Layers,
  ListChecks,
  Scale,
  Sparkles,
  Target,
} from "lucide-react";

import type { AIProjectResolved } from "@/lib/cross-tower/aiProjects";
import type { ProjectKpis } from "@/lib/cross-tower/composeProjects";
import type { SelectProgramResultV6 } from "@/lib/initiatives/selectV6Program";
import { formatUsdCompact } from "@/lib/format";
import { useRedactDollars } from "@/lib/clientMode";

/**
 * Cross-Tower AI Plan — Approach tab.
 *
 * Process rail (mono + chevrons) plus a responsive grid of step cards.
 * No single-row horizontal scroll dependency — stable on all breakpoints.
 */

type ApproachTabProps = {
  program: SelectProgramResultV6;
  projects: AIProjectResolved[];
  kpis: ProjectKpis;
  onJump: (tabId: string) => void;
};

type StepStat = {
  value: string;
  label: string;
  wide?: boolean;
};

type ApproachStepModel = {
  id: string;
  number: string;
  /** Short label in the top process rail. */
  railLabel: string;
  icon: React.ReactNode;
  title: string;
  labelHint: string;
  detail: React.ReactNode;
  stat: StepStat;
  cta: React.ReactNode;
};

export function ApproachTab({
  program,
  projects,
  kpis,
  onJump,
}: ApproachTabProps) {
  const redact = useRedactDollars();

  const towersInScopeCount = program.towersInScope.length;
  // L3 Job Family count — distinct dial-bearing rows in scope.
  const inPlanJobFamilyCount = React.useMemo(() => {
    const seen = new Set<string>();
    for (const row of program.initiatives) {
      if (row.l3RowId) seen.add(row.l3RowId);
    }
    return seen.size;
  }, [program.initiatives]);
  const inPlanSolutionCount = program.initiatives.length;
  const liveProjects = projects.filter((p) => !p.isStub).length;

  const fullScaleLabel = redact
    ? "—"
    : kpis.fullScaleRunRateUsd > 0
      ? formatUsdCompact(kpis.fullScaleRunRateUsd, { decimals: 2 })
      : "Pending";

  const quadrantMixLabel = `QW ${kpis.quickWinCount} · SB ${kpis.strategicBetCount} · FI ${kpis.fillInCount} · DP ${kpis.deprioritizedProjects}`;

  const steps: ApproachStepModel[] = React.useMemo(
    () => [
      {
        id: "map",
        number: "01",
        railLabel: "Map",
        icon: <ListChecks className="h-5 w-5" aria-hidden />,
        title: "Capability map",
        labelHint:
          "Signed-off L1→L4 hierarchy per Versant function — structural backbone for modeled dollars.",
        detail: (
          <>
            <DetailWhat>
              Each Versant function — Editorial &amp; News, Finance, HR,
              Production, Distribution, Ad Sales, Tech, Corporate Services,
              Legal, Marketing, Strategy, Insights, Talent — lands a signed-off
              L1→L4 capability hierarchy. This is the structural truth the rest
              of the plan inherits from.
            </DetailWhat>
            <DetailHow>
              Drafted by the Accenture function lead from public Versant
              filings and operating-model artifacts, then refined tower-by-tower
              in working sessions with the matched Versant function lead until
              both parties signed off.
            </DetailHow>
          </>
        ),
        stat: { value: String(towersInScopeCount), label: "towers in scope" },
        cta: <ExternalCta href="/capability-map" label="Open map" />,
      },
      {
        id: "impact",
        number: "02",
        railLabel: "Impact",
        icon: <Target className="h-5 w-5" aria-hidden />,
        title: "AI impact by Job Family",
        labelHint:
          "Impact tier + rationale per L3 Job Family — TSA exit, BB- covenant, split rights, SEC controls.",
        detail: (
          <>
            <DetailWhat>
              Each L3 Job Family row carries an AI impact tier (High / Medium /
              Low / Not yet) and a qualitative rationale grounded in the
              dominant Versant constraint — NBCU TSA exit, BB- covenant, split
              rights, public-company controls.
            </DetailWhat>
            <DetailHow>
              Accenture scored each Job Family against an AI-suitability rubric
              and the named structural constraint, then walked the call with
              the Versant function lead to confirm both the tier and the
              rationale before locking it.
            </DetailHow>
          </>
        ),
        stat: {
          value: String(inPlanJobFamilyCount),
          label: "Job Families in plan",
        },
        cta: <ExternalCta href="/program/tower-status" label="Tower status" />,
      },
      {
        id: "l5",
        number: "03",
        railLabel: "Curate",
        icon: <Sparkles className="h-5 w-5" aria-hidden />,
        title: "Curate AI Solutions",
        labelHint:
          "Tower lead authors named L3 AI Solutions with feasibility, vendor, and Why-AI-now.",
        detail: (
          <>
            <DetailWhat>
              In each tower workshop, the lead authors a curated set of L3 AI
              Solutions — each one named, scoped to one or more Activity
              Groups, tagged with a feasibility band and a primary vendor, and
              grounded in a Why-AI-now rationale tied to the dominant Versant
              constraint.
            </DetailWhat>
            <DetailHow>
              Solutions are enumerated from the in-plan L3 / L4 work, filtered
              against feasibility evidence (peer case study, named vendor
              offering, or adjacent use case), and aligned with the Versant
              function lead in a working review where rejected candidates
              carry an explicit reason.
            </DetailHow>
          </>
        ),
        stat: {
          value: String(inPlanSolutionCount),
          label: "AI Solutions curated",
        },
        cta: <JumpCta onClick={() => onJump("projects")} label="AI Solutions" />,
      },
      {
        id: "projects",
        number: "04",
        railLabel: "Brief",
        icon: <Layers className="h-5 w-5" aria-hidden />,
        title: "AI Solution briefs",
        labelHint:
          "One GPT-5.5 four-lens brief per AI Solution — Work, Workforce, Workbench, Digital Core.",
        detail: (
          <>
            <DetailWhat>
              Every curated AI Solution gets its own deep-dive — a process-level
              agentic delivery vehicle, not an activity automation. Each
              solution lands a full 4-lens brief: Work, Workforce, Workbench,
              Digital Core, plus an architecture diagram and feasibility
              evidence.
            </DetailWhat>
            <DetailHow>
              The brief is GPT-5.5-authored against pre-curated Versant context
              (real brands, real people, real vendors, real constraints), with
              the response JSON-validated and brief-completeness-checked before
              it ever reaches the deep-dive page. Briefs cache lazily on first
              open and round-trip through the workshop database.
            </DetailHow>
          </>
        ),
        stat: {
          value: String(liveProjects),
          label: "AI Solutions live",
        },
        cta: (
          <JumpCta onClick={() => onJump("projects")} label="AI Solutions" />
        ),
      },
      {
        id: "matrix",
        number: "05",
        railLabel: "2×2",
        icon: <Scale className="h-5 w-5" aria-hidden />,
        title: "Value × Effort",
        labelHint:
          "Deterministic portfolio view — Quick Win, Strategic Bet, Fill-in, Deprioritize.",
        detail: (
          <>
            <DetailWhat>
              Every AI Solution lands on a Value × Effort 2×2 — Quick Win,
              Strategic Bet, Fill-in, or Deprioritize.
            </DetailWhat>
            <DetailHow>
              Value is the modeled L3 Job Family prize; effort is the
              curator-set feasibility (High → low effort, Medium → mid effort,
              Low → high effort). Both axes are deterministic — no LLM lottery,
              no hidden median split. Strategic Bet and Quick Win solutions
              also carry GPT-5.5-authored value and effort rationales for the
              executive read.
            </DetailHow>
          </>
        ),
        stat: {
          value: quadrantMixLabel,
          label: "quadrant mix",
          wide: true,
        },
        cta: <JumpCta onClick={() => onJump("matrix")} label="Open matrix" />,
      },
      {
        id: "roadmap",
        number: "06",
        railLabel: "Roadmap",
        icon: <CalendarRange className="h-5 w-5" aria-hidden />,
        title: "24-month sequence",
        labelHint:
          "Build, ramp, scale from Assumptions — Quick Wins first; Deprioritized off the build.",
        detail: (
          <>
            <DetailWhat>
              AI Solutions are sequenced into a 24-month build, ramp, and
              at-scale plan — Quick Wins first, Strategic Bets layered behind
              the platform foundations, Fill-ins deferred, Deprioritize
              excluded from the build.
            </DetailWhat>
            <DetailHow>
              Build duration, value-start month, and ramp pace are computed
              deterministically from the Assumptions tab (high-effort vs
              low-effort build months, ramp months, fill-in offset, program
              start). Every input is editable; nothing is hidden behind a
              heuristic.
            </DetailHow>
          </>
        ),
        stat: { value: fullScaleLabel, label: "full-scale run-rate" },
        cta: (
          <div className="flex flex-wrap gap-2">
            <JumpCta onClick={() => onJump("roadmap")} label="Roadmap" />
            <button
              type="button"
              onClick={() => onJump("assumptions")}
              className="inline-flex items-center rounded-full border border-forge-border bg-transparent px-3 py-1.5 text-[11px] font-medium text-forge-body transition hover:border-accent-purple/40 hover:text-accent-purple-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-purple/40"
            >
              Assumptions
            </button>
          </div>
        ),
      },
    ],
    [
      towersInScopeCount,
      inPlanJobFamilyCount,
      inPlanSolutionCount,
      liveProjects,
      quadrantMixLabel,
      fullScaleLabel,
      onJump,
    ],
  );

  return (
    <div className="space-y-6">
      <header>
        <h2 className="font-display text-lg font-semibold text-forge-ink">
          <span className="font-mono text-accent-purple-dark">&gt;</span>{" "}
          Approach
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-forge-subtle">
          Six-step path from signed-off maps to a sequenced agentic roadmap.
          Details sit behind each card.
        </p>
      </header>

      <section aria-label="Plan methodology steps">
        <h3 className="sr-only">Six-step methodology</h3>
        <ProcessRail steps={steps} />
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {steps.map((step) => (
            <ApproachStepCard key={step.id} {...step} />
          ))}
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Process rail — chevrons, wraps naturally on narrow screens
// ---------------------------------------------------------------------------

function ProcessRail({ steps }: { steps: ApproachStepModel[] }) {
  return (
    <div className="rounded-xl border border-accent-purple/25 bg-gradient-to-r from-accent-purple/[0.06] via-forge-well/40 to-forge-well/20 px-4 py-3">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-forge-subtle">
        Process flow
      </p>
      <ol className="m-0 flex list-none flex-wrap items-center justify-center gap-y-2 p-0 sm:justify-start">
        {steps.map((step, index) => (
          <li
            key={step.id}
            className="flex items-center"
            aria-label={`${step.number} ${step.railLabel}`}
          >
            {index > 0 ? (
              <ChevronRight
                className="mx-1 h-5 w-5 shrink-0 text-accent-purple/45"
                strokeWidth={2}
                aria-hidden
              />
            ) : null}
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-forge-border bg-forge-surface px-2 py-1 font-mono text-[11px] text-forge-ink shadow-sm sm:text-xs">
              <span className="tabular-nums text-accent-purple-dark">
                {step.number}
              </span>
              <span className="font-sans text-xs font-medium text-forge-body">
                {step.railLabel}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step card
// ---------------------------------------------------------------------------

function ApproachStepCard({
  number,
  icon,
  title,
  labelHint,
  detail,
  stat,
  cta,
}: ApproachStepModel) {
  return (
    <article
      className="flex min-h-[220px] flex-col rounded-xl border border-forge-border border-l-[3px] border-l-accent-purple/55 bg-forge-surface p-4 shadow-none"
      aria-label={`Step ${number}: ${title}. ${labelHint}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-2xl font-semibold tabular-nums leading-none text-accent-purple-dark">
          {number}
        </span>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-forge-border bg-forge-well/60 text-accent-purple-dark">
          {icon}
        </span>
      </div>

      <h4 className="mt-3 font-display text-sm font-semibold leading-snug text-forge-ink">
        <span className="font-mono text-accent-purple-dark">&gt;</span> {title}
      </h4>
      <p className="mt-1 text-[11px] leading-snug text-forge-subtle">
        {labelHint}
      </p>

      <div className="mt-3">
        <StatBlock value={stat.value} label={stat.label} wide={stat.wide} />
      </div>

      <div className="mt-auto pt-4">{cta}</div>

      <details className="mt-3 border-t border-forge-border/80 pt-3">
        <summary className="cursor-pointer list-none text-[10px] font-semibold uppercase tracking-wider text-accent-purple-dark outline-none marker:content-none [&::-webkit-details-marker]:hidden focus-visible:rounded focus-visible:ring-2 focus-visible:ring-accent-purple/40">
          <span className="font-mono">&gt;</span> Method note
        </summary>
        <div className="mt-3 space-y-3 text-[11px] leading-relaxed text-forge-body">
          {detail}
        </div>
      </details>
    </article>
  );
}

function DetailWhat({ children }: { children: React.ReactNode }) {
  return (
    <p>
      <span className="font-semibold text-forge-ink">Output. </span>
      {children}
    </p>
  );
}

function DetailHow({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border-l-2 border-accent-purple/40 bg-forge-well/35 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-accent-purple-dark">
        <span className="font-mono">&gt;</span> How
      </div>
      <div className="mt-1 text-[11px] leading-relaxed text-forge-body">
        {children}
      </div>
    </div>
  );
}

function StatBlock({
  value,
  label,
  wide,
}: {
  value: string;
  label: string;
  wide?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border border-forge-border bg-forge-well/45 px-3 py-2 ${
        wide ? "" : ""
      }`}
      title={wide ? value : undefined}
    >
      <div
        className={`break-words font-mono text-sm font-semibold tabular-nums text-forge-ink ${
          wide ? "text-xs leading-tight sm:text-sm" : ""
        }`}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wider text-forge-subtle">
        {label}
      </div>
    </div>
  );
}

function JumpCta({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-accent-purple/30 bg-accent-purple/5 px-3 py-2 text-[11px] font-medium text-accent-purple-dark transition hover:border-accent-purple/60 hover:bg-accent-purple/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-purple/40 sm:w-auto"
    >
      {label}
      <ArrowRight
        className="h-3.5 w-3.5 transition group-hover:translate-x-0.5"
        aria-hidden
      />
    </button>
  );
}

function ExternalCta({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="group inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-accent-purple/30 bg-accent-purple/5 px-3 py-2 text-[11px] font-medium text-accent-purple-dark transition hover:border-accent-purple/60 hover:bg-accent-purple/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-purple/40 sm:w-auto"
    >
      {label}
      <ExternalLink
        className="h-3.5 w-3.5 transition group-hover:translate-x-0.5"
        aria-hidden
      />
    </Link>
  );
}
