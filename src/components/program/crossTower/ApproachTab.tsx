"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarRange,
  ChevronRight,
  Cpu,
  Layers,
  ListChecks,
  Network,
  Scale,
  Sparkles,
  Target,
} from "lucide-react";

import type { AIProjectResolved } from "@/lib/cross-tower/aiProjects";
import type { ProjectKpis } from "@/lib/cross-tower/composeProjects";
import type { SelectProgramResultV6 } from "@/lib/initiatives/selectV6Program";

/**
 * Cross-Tower AI Plan — Approach tab.
 *
 * Slim flow rail in the homepage idiom. The plan is authored by two
 * parallel pipelines that converge on a single 24-month roadmap:
 *
 *   Track A · Bottom-up: tower workshops
 *     Capability map > Impact > Curate > Brief > Value × Effort
 *
 *   Track B · Top-down: strategist run
 *     Outcome clusters > Orchestration & data layer
 *
 *   Convergence: 24-month sequenced roadmap.
 *
 * Each card is the click surface — `onJump` for in-page anchors,
 * `<Link>` for external routes. No stat blocks, no method-note
 * collapsibles, no separate CTA buttons — keep the cognitive load on
 * the workflow, not the chrome.
 */

type ApproachTabProps = {
  program: SelectProgramResultV6;
  projects: AIProjectResolved[];
  kpis: ProjectKpis;
  strategist: {
    clusterCount: number | null;
    initiativeCount: number | null;
    isGenerated: boolean;
  };
  onJump: (tabId: string, sectionId?: string) => void;
};

type Tone = "purple" | "teal" | "core";

type StepAction =
  | { kind: "jump"; tabId: string; sectionId?: string }
  | { kind: "external"; href: string }
  | { kind: "info" };

type ApproachStep = {
  id: string;
  number: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  action: StepAction;
};

export function ApproachTab({
  program,
  projects,
  kpis,
  strategist,
  onJump,
}: ApproachTabProps) {
  const towersInScopeCount = program.towersInScope.length;
  const inPlanJobFamilyCount = React.useMemo(() => {
    const seen = new Set<string>();
    for (const row of program.initiatives) {
      if (row.l3RowId) seen.add(row.l3RowId);
    }
    return seen.size;
  }, [program.initiatives]);
  const liveSolutionCount = kpis.liveProjects;
  const briefedSolutionCount = projects.filter((p) => !p.isStub).length;

  // ---------- Track A — Bottom-up tower workshops ---------------------
  const trackA: ApproachStep[] = [
    {
      id: "map",
      number: "01",
      icon: <ListChecks className="h-5 w-5" aria-hidden />,
      title: "Capability map",
      description: `Signed-off L1→L4 hierarchy across ${towersInScopeCount} towers.`,
      action: { kind: "external", href: "/capability-map" },
    },
    {
      id: "impact",
      number: "02",
      icon: <Target className="h-5 w-5" aria-hidden />,
      title: "Impact tiers",
      description: `AI impact tier + rationale on ${inPlanJobFamilyCount} Job Families.`,
      action: { kind: "external", href: "/program/tower-status" },
    },
    {
      id: "curate",
      number: "03",
      icon: <Sparkles className="h-5 w-5" aria-hidden />,
      title: "Curate AI Solutions",
      description: `${liveSolutionCount} solutions with feasibility, vendor, and Why-AI-now.`,
      action: { kind: "jump", tabId: "plan", sectionId: "solutions" },
    },
    {
      id: "brief",
      number: "04",
      icon: <Layers className="h-5 w-5" aria-hidden />,
      title: "Four-lens briefs",
      description: `${briefedSolutionCount} solutions with Work / Workforce / Workbench / Digital Core briefs.`,
      action: { kind: "jump", tabId: "plan", sectionId: "solutions" },
    },
    {
      id: "matrix",
      number: "05",
      icon: <Scale className="h-5 w-5" aria-hidden />,
      title: "Value × Effort",
      description: `Deterministic 2×2: ${kpis.quickWinCount} Quick Wins, ${kpis.strategicBetCount} Strategic Bets, ${kpis.fillInCount} Fill-ins.`,
      action: { kind: "jump", tabId: "plan", sectionId: "matrix" },
    },
  ];

  // ---------- Track B — Top-down strategist run -----------------------
  const clusterDescription = strategist.isGenerated
    ? `${strategist.clusterCount ?? 0} business outcomes spanning multiple towers.`
    : "Run the strategist to surface cross-tower outcomes.";
  const orchestrationDescription = strategist.isGenerated
    ? `${strategist.initiativeCount ?? 0} discrete initiatives + the shared data layer they depend on.`
    : "Shared data, identity, and governance the portfolio depends on.";

  const trackB: ApproachStep[] = [
    {
      id: "outcomes",
      number: "B1",
      icon: <Target className="h-5 w-5" aria-hidden />,
      title: "Outcome clusters",
      description: clusterDescription,
      action: {
        kind: "jump",
        tabId: "cross-tower-outcomes",
        sectionId: "clusters",
      },
    },
    {
      id: "orchestration",
      number: "B2",
      icon: <Network className="h-5 w-5" aria-hidden />,
      title: "Orchestration & data layer",
      description: orchestrationDescription,
      action: {
        kind: "jump",
        tabId: "cross-tower-outcomes",
        sectionId: "orchestration",
      },
    },
  ];

  // ---------- Convergence --------------------------------------------
  const convergence: ApproachStep = {
    id: "roadmap",
    number: "C",
    icon: <CalendarRange className="h-5 w-5" aria-hidden />,
    title: "24-month sequenced roadmap",
    description:
      "Quick Wins first, Strategic Bets behind the foundations, Fill-ins deferred. Outcome clusters surface as parent swim-lanes.",
    action: { kind: "jump", tabId: "plan", sectionId: "roadmap" },
  };

  return (
    <div className="space-y-6">
      <header>
        <h2 className="font-display text-lg font-semibold text-forge-ink">
          <span className="font-mono text-accent-purple-dark">&gt;</span>{" "}
          Approach
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-forge-subtle">
          Two parallel tracks — bottom-up from the tower workshops, top-down
          from the strategist run — converge on a single 24-month roadmap.
        </p>
      </header>

      <section aria-label="Track A: bottom-up methodology">
        <TrackHeader
          tone="purple"
          eyebrow="Track A"
          title="Bottom-up · tower workshops"
          description="Lead-authored AI Solutions sourced from each tower's L3 Job Families and scored on a deterministic 2×2."
          accent={<Cpu className="h-3.5 w-3.5" aria-hidden />}
        />
        <FlowRow steps={trackA} tone="purple" onJump={onJump} />
      </section>

      <section aria-label="Track B: top-down strategist methodology">
        <TrackHeader
          tone="teal"
          eyebrow="Track B"
          title="Top-down · strategist run"
          description="One LLM pass authors cross-tower business outcomes and the shared infrastructure layer the portfolio depends on."
          accent={<Sparkles className="h-3.5 w-3.5" aria-hidden />}
        />
        <FlowRow steps={trackB} tone="teal" onJump={onJump} />
      </section>

      <section aria-label="Convergence">
        <div className="flex items-center justify-center gap-2 py-2">
          <span className="h-px flex-1 bg-gradient-to-r from-transparent via-forge-border to-transparent" />
          <span className="inline-flex items-center gap-1 rounded-full border border-accent-purple/30 bg-accent-purple/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-accent-purple-dark">
            Tracks converge
          </span>
          <span className="h-px flex-1 bg-gradient-to-r from-transparent via-forge-border to-transparent" />
        </div>
        <FlowRow steps={[convergence]} tone="core" onJump={onJump} />
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------
//   Track header
// ---------------------------------------------------------------------

function TrackHeader({
  tone,
  eyebrow,
  title,
  description,
  accent,
}: {
  tone: "purple" | "teal";
  eyebrow: string;
  title: string;
  description: string;
  accent: React.ReactNode;
}) {
  const eyebrowClass =
    tone === "purple"
      ? "border-accent-purple/30 bg-accent-purple/5 text-accent-purple-dark"
      : "border-accent-teal/35 bg-accent-teal/5 text-accent-teal";
  return (
    <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
      <div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${eyebrowClass}`}
        >
          {accent}
          {eyebrow}
        </span>
        <h3 className="mt-1 font-display text-base font-semibold text-forge-ink">
          {title}
        </h3>
      </div>
      <p className="max-w-md text-[11px] leading-snug text-forge-subtle">
        {description}
      </p>
    </header>
  );
}

// ---------------------------------------------------------------------
//   Flow row — homepage-style step boxes with optional chevron between
// ---------------------------------------------------------------------

function FlowRow({
  steps,
  tone,
  onJump,
}: {
  steps: ApproachStep[];
  tone: Tone;
  onJump: (tabId: string, sectionId?: string) => void;
}) {
  const isSingle = steps.length === 1;
  return (
    <div
      className={
        isSingle
          ? "grid grid-cols-1"
          : "grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5"
      }
    >
      {steps.map((step, index) => (
        <React.Fragment key={step.id}>
          <FlowStepCard step={step} tone={tone} onJump={onJump} />
          {!isSingle && index < steps.length - 1 ? (
            <span
              aria-hidden
              className="hidden self-center justify-self-center text-forge-hint lg:hidden"
            >
              <ChevronRight className="h-4 w-4" />
            </span>
          ) : null}
        </React.Fragment>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------
//   Single step card — entire surface is the click target
// ---------------------------------------------------------------------

function FlowStepCard({
  step,
  tone,
  onJump,
}: {
  step: ApproachStep;
  tone: Tone;
  onJump: (tabId: string, sectionId?: string) => void;
}) {
  const accentText =
    tone === "purple"
      ? "text-accent-purple-dark"
      : tone === "teal"
        ? "text-accent-teal"
        : "text-accent-purple-dark";

  const numberChipClass =
    tone === "purple"
      ? "bg-accent-purple text-white"
      : tone === "teal"
        ? "bg-accent-teal text-white"
        : "bg-accent-purple text-white ring-2 ring-white/40";

  const iconWrapClass =
    tone === "purple"
      ? "border-accent-purple/30 bg-accent-purple/10 text-accent-purple-dark"
      : tone === "teal"
        ? "border-accent-teal/30 bg-accent-teal/10 text-accent-teal"
        : "border-accent-purple/50 bg-accent-purple/15 text-accent-purple-dark";

  const shellClass =
    tone === "core"
      ? "border-2 border-accent-purple bg-gradient-to-b from-accent-purple/[0.18] via-accent-purple/[0.06] to-forge-surface shadow-[0_0_28px_rgba(161,0,255,0.18)] hover:border-accent-purple-dark"
      : tone === "purple"
        ? "border border-accent-purple/30 bg-forge-surface hover:border-accent-purple/60 hover:shadow-[0_0_0_1px_rgba(161,0,255,0.22)]"
        : "border border-accent-teal/30 bg-forge-surface hover:border-accent-teal/60 hover:shadow-[0_0_0_1px_rgba(0,191,165,0.22)]";

  const inner = (
    <div className="flex h-full flex-col gap-2 p-3">
      <div className="flex items-center justify-between gap-1">
        <span
          className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-bold ${numberChipClass}`}
          aria-hidden
        >
          {step.number}
        </span>
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${iconWrapClass}`}
          aria-hidden
        >
          {step.icon}
        </span>
      </div>

      <h4
        className={`font-display text-[13px] font-semibold leading-snug text-forge-ink group-hover:${accentText}`}
      >
        {step.title}
      </h4>
      <p className="text-[11px] leading-snug text-forge-subtle">
        {step.description}
      </p>

      <div
        className={`mt-auto inline-flex items-center gap-0.5 pt-1 text-[10px] font-semibold ${accentText}`}
      >
        Open
        <ArrowRight
          className="h-2.5 w-2.5 transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </div>
    </div>
  );

  if (step.action.kind === "external") {
    return (
      <Link
        href={step.action.href}
        className={`group relative flex h-full flex-col rounded-xl transition ${shellClass}`}
        aria-label={`${step.number} · ${step.title}. ${step.description}`}
      >
        {inner}
      </Link>
    );
  }

  if (step.action.kind === "info") {
    return (
      <div
        className={`flex h-full flex-col rounded-xl ${shellClass}`}
        aria-label={`${step.number} · ${step.title}. ${step.description}`}
      >
        {inner}
      </div>
    );
  }

  const { tabId, sectionId } = step.action;
  return (
    <button
      type="button"
      onClick={() => onJump(tabId, sectionId)}
      className={`group relative flex h-full flex-col rounded-xl text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-purple/40 ${shellClass}`}
      aria-label={`${step.number} · ${step.title}. ${step.description}`}
    >
      {inner}
    </button>
  );
}
