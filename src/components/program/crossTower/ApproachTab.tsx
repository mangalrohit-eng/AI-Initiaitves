"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarRange,
  ExternalLink,
  Layers,
  ListChecks,
  Scale,
  Sparkles,
  Target,
} from "lucide-react";

import type { AIProjectResolved } from "@/lib/cross-tower/aiProjects";
import type { ProjectKpis } from "@/lib/cross-tower/composeProjects";
import type { SelectProgramResult } from "@/lib/initiatives/selectProgram";
import { formatUsdCompact } from "@/lib/format";
import { useRedactDollars } from "@/lib/clientMode";

/**
 * Cross-Tower AI Plan v3 — Methodology tab.
 *
 * The first sub-tab on the Cross-Tower AI Plan page. A premium, glanceable
 * explainer of the 6-step process the plan is built from:
 *
 *   1. Capability map by function (Versant function-lead aligned)
 *   2. AI impact by L4 (Versant function-lead aligned)
 *   3. L5 activity automation opportunities (Versant function-lead aligned)
 *   4. Consolidate into L4 AI Projects (engine + GPT-5.5)
 *   5. Evaluate on Value × Effort (engine + GPT-5.5)
 *   6. Sequence the roadmap (engine + assumptions)
 *
 * Each step ships a `What` paragraph, a `> HOW` block describing the actual
 * method used, a live stat from the running plan, and a CTA that either
 * jumps to another tab on this page (controlled `TabGroup`) or links out
 * to an existing program surface (`/capability-map`, `/program/tower-status`).
 *
 * Trust is implicit — there is no "why this can be trusted" framing and no
 * engine-vs-LLM disclosure footer. The HOW blocks plus click-through stats
 * carry the credibility.
 */

type ApproachTabProps = {
  program: SelectProgramResult;
  projects: AIProjectResolved[];
  kpis: ProjectKpis;
  onJump: (tabId: string) => void;
};

export function ApproachTab({
  program,
  projects,
  kpis,
  onJump,
}: ApproachTabProps) {
  const redact = useRedactDollars();

  // Live anchors -----------------------------------------------------------
  // Each derived from the same substrate the rest of the page renders, so
  // the methodology page can never go out of sync with the plan it describes.

  const towersInScopeCount = program.towersInScope.length;
  const inPlanL4Count = React.useMemo(() => {
    const seen = new Set<string>();
    for (const row of program.initiatives) seen.add(row.l3.rowId);
    return seen.size;
  }, [program.initiatives]);
  const inPlanL5Count = program.initiatives.length;
  const liveProjects = projects.filter((p) => !p.isStub).length;

  const fullScaleLabel = redact
    ? "—"
    : kpis.fullScaleRunRateUsd > 0
      ? formatUsdCompact(kpis.fullScaleRunRateUsd, { decimals: 2 })
      : "Pending";

  const quadrantMixLabel = `QW ${kpis.quickWinCount} · SB ${kpis.strategicBetCount} · FI ${kpis.fillInCount} · DP ${kpis.deprioritizedProjects}`;

  return (
    <div className="space-y-8">
      <header>
        <h2 className="font-display text-lg font-semibold text-forge-ink">
          <span className="font-mono text-accent-purple-dark">&gt;</span> The
          methodology
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-forge-subtle">
          How the plan is built, end to end, from function inputs to a
          sequenced roadmap.
        </p>
      </header>

      <ol className="space-y-4" aria-label="Plan methodology steps">
        <Step
          number="01"
          icon={<ListChecks className="h-4 w-4" aria-hidden />}
          title="Capability map by function"
          what={
            <>
              Each Versant function — Editorial &amp; News, Finance, HR,
              Production, Distribution, Ad Sales, Tech, Corporate Services,
              Legal, Marketing, Strategy, Insights, Talent — lands a signed-off
              L1→L4 capability hierarchy. This is the structural truth the rest
              of the plan inherits from.
            </>
          }
          how={
            <>
              Drafted by the Accenture function lead from public Versant
              filings and operating-model artifacts, then refined tower-by-tower
              in working sessions with the matched Versant function lead until
              both parties signed off.
            </>
          }
          stat={{
            value: String(towersInScopeCount),
            label: "towers in scope",
          }}
          cta={
            <ExternalCta href="/capability-map" label="Open capability map" />
          }
        />

        <Step
          number="02"
          icon={<Target className="h-4 w-4" aria-hidden />}
          title="AI impact by L4"
          what={
            <>
              Each L4 Activity Group carries an AI impact tier (High / Medium /
              Low / Not yet) and a qualitative rationale grounded in the
              dominant Versant constraint — NBCU TSA exit, BB- covenant, split
              rights, public-company controls.
            </>
          }
          how={
            <>
              Accenture scored each L4 against an AI-suitability rubric and the
              named structural constraint, then walked the call with the
              Versant function lead to confirm both the tier and the rationale
              before locking it.
            </>
          }
          stat={{
            value: String(inPlanL4Count),
            label: "L4 activity groups in plan",
          }}
          cta={
            <ExternalCta
              href="/program/tower-status"
              label="Open tower status"
            />
          }
        />

        <Step
          number="03"
          icon={<Sparkles className="h-4 w-4" aria-hidden />}
          title="L5 activity automation opportunities"
          what={
            <>
              Each in-plan L4 ladders down to concrete L5 automation
              opportunities, every one tagged with feasibility evidence — peer
              case study, named vendor offering, or adjacent use case.
            </>
          }
          how={
            <>
              L5 candidates were enumerated from the L4 work items, filtered
              against the feasibility-evidence rubric, and aligned with the
              Versant function lead in a working review where rejected
              candidates carry an explicit reason.
            </>
          }
          stat={{
            value: String(inPlanL5Count),
            label: "L5 opportunities",
          }}
          cta={
            <JumpCta
              onClick={() => onJump("lineage")}
              label="Open lineage"
            />
          }
        />

        <Step
          number="04"
          icon={<Layers className="h-4 w-4" aria-hidden />}
          title="Consolidate into L4 AI Projects"
          what={
            <>
              L5 opportunities consolidate into one AI Project per in-plan L4 —
              a process-level agentic delivery vehicle, not an activity
              automation. Each project gets a full 4-lens brief: Work,
              Workforce, Workbench, Digital Core.
            </>
          }
          how={
            <>
              The engine groups L5s structurally by L4 (deterministic — no LLM
              lottery on grouping). GPT-5.5 then authors the project name,
              narrative, and 4-lens brief against pre-curated Versant context
              (real brands, real people, real vendors, real constraints), with
              the response JSON-validated and brief-completeness-checked before
              it ever reaches the page.
            </>
          }
          stat={{
            value: String(liveProjects),
            label: "AI Projects authored",
          }}
          cta={
            <JumpCta
              onClick={() => onJump("projects")}
              label="Open AI Projects"
            />
          }
        />

        <Step
          number="05"
          icon={<Scale className="h-4 w-4" aria-hidden />}
          title="Evaluate on Value × Effort"
          what={
            <>
              Every project lands on a Value × Effort 2×2 — Quick Win, Strategic
              Bet, Fill-in, or Deprioritize.
            </>
          }
          how={
            <>
              The effort score is computed from the project&apos;s own brief
              signals (
              <code className="font-mono text-[11px] text-forge-body">
                2·complexity + integrations + agents + 0.5·platforms − 1.5 if
                proven elsewhere
              </code>
              ); the value score is the modeled L4 prize. Both axes are
              median-split across the program so the 2×2 reads as a portfolio
              view, not an absolute scorecard. Rationales are GPT-5.5-authored
              from the same brief signals.
            </>
          }
          stat={{
            value: quadrantMixLabel,
            label: "quadrant mix",
            wide: true,
          }}
          cta={
            <JumpCta
              onClick={() => onJump("matrix")}
              label="Open Value × Effort"
            />
          }
        />

        <Step
          number="06"
          icon={<CalendarRange className="h-4 w-4" aria-hidden />}
          title="Sequence the roadmap"
          what={
            <>
              Projects are sequenced into a 24-month build, ramp, and at-scale
              plan — Quick Wins first, Strategic Bets layered behind the
              platform foundations, Fill-ins deferred, Deprioritize excluded
              from the build.
            </>
          }
          how={
            <>
              Build duration, value-start month, and ramp pace are computed
              deterministically from the Assumptions tab (high-effort vs
              low-effort build months, ramp months, fill-in offset, program
              start). Every input is editable; nothing is hidden behind a
              heuristic.
            </>
          }
          stat={{
            value: fullScaleLabel,
            label: "full-scale AI run-rate",
          }}
          cta={
            <div className="flex flex-wrap items-center gap-2">
              <JumpCta
                onClick={() => onJump("roadmap")}
                label="Open roadmap"
              />
              <button
                type="button"
                onClick={() => onJump("assumptions")}
                className="inline-flex items-center gap-1 rounded-full border border-forge-border bg-transparent px-3 py-1.5 text-[11px] font-medium text-forge-body transition hover:border-accent-purple/40 hover:text-accent-purple-dark"
              >
                Tune assumptions
              </button>
            </div>
          }
        />
      </ol>
    </div>
  );
}

// ===========================================================================
//   Step card
// ===========================================================================

type StepStat = {
  value: string;
  label: string;
  wide?: boolean;
};

type StepProps = {
  number: string;
  icon: React.ReactNode;
  title: string;
  what: React.ReactNode;
  how: React.ReactNode;
  stat: StepStat;
  cta: React.ReactNode;
};

function Step({ number, icon, title, what, how, stat, cta }: StepProps) {
  return (
    <li className="rounded-2xl border border-forge-border bg-forge-surface p-5 shadow-sm">
      <div className="grid gap-5 md:grid-cols-[auto_1fr]">
        {/* Number + icon column */}
        <div className="flex items-start gap-3 md:flex-col md:items-center md:gap-2 md:pt-1">
          <span className="font-mono text-3xl font-semibold leading-none tracking-tight text-accent-purple-dark">
            {number}
          </span>
          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-forge-border bg-forge-well/60 text-accent-purple-dark">
            {icon}
          </span>
        </div>

        {/* Body column */}
        <div className="min-w-0 space-y-3">
          <h3 className="font-display text-base font-semibold text-forge-ink">
            <span className="font-mono text-accent-purple-dark">&gt;</span>{" "}
            {title}
          </h3>

          <p className="text-sm leading-relaxed text-forge-body">{what}</p>

          <HowBlock>{how}</HowBlock>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <StatTile value={stat.value} label={stat.label} wide={stat.wide} />
            {cta}
          </div>
        </div>
      </div>
    </li>
  );
}

function HowBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border-l-2 border-accent-purple/40 bg-forge-well/40 px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-accent-purple-dark">
        <span className="font-mono">&gt;</span> How
      </div>
      <p className="mt-1 text-[13px] leading-relaxed text-forge-body">
        {children}
      </p>
    </div>
  );
}

function StatTile({
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
      className={`flex items-center gap-3 rounded-lg border border-forge-border bg-forge-well/40 px-3 py-2 ${
        wide ? "" : "min-w-[160px]"
      }`}
    >
      <span className="font-mono text-sm font-semibold tabular-nums text-forge-ink">
        {value}
      </span>
      <span className="text-[11px] uppercase tracking-wider text-forge-subtle">
        {label}
      </span>
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
      className="group inline-flex items-center gap-1.5 rounded-full border border-accent-purple/30 bg-accent-purple/5 px-3 py-1.5 text-[11px] font-medium text-accent-purple-dark transition hover:border-accent-purple/60 hover:bg-accent-purple/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-purple/40"
    >
      {label}
      <ArrowRight
        className="h-3 w-3 transition group-hover:translate-x-0.5"
        aria-hidden
      />
    </button>
  );
}

function ExternalCta({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-1.5 rounded-full border border-accent-purple/30 bg-accent-purple/5 px-3 py-1.5 text-[11px] font-medium text-accent-purple-dark transition hover:border-accent-purple/60 hover:bg-accent-purple/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-purple/40"
    >
      {label}
      <ExternalLink
        className="h-3 w-3 transition group-hover:translate-x-0.5"
        aria-hidden
      />
    </Link>
  );
}
