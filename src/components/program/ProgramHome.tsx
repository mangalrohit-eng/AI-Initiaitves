"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  Construction,
  Cpu,
  Globe2,
  Map as MapIcon,
  MessagesSquare,
  Sliders,
  Sparkles,
  Table2,
  TrendingUp,
} from "lucide-react";
import { ProgramJourneyGuidance } from "@/components/program/ProgramJourneyGuidance";
import { PageShell } from "@/components/PageShell";
import { useRedactDollars } from "@/lib/clientMode";

type StepStatus = "active" | "coming-soon";

type FlowStep = {
  step: number;
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  status: StepStatus;
  /** Visually anchor the workflow halves: discover/size vs. design. */
  band: "discover" | "design";
  /** Step is open and navigable but content is still being authored. */
  wip?: boolean;
};

/**
 * Five-step tower-lead flow. The landing page's job is to point the lead at
 * the next step — no live numbers, no scoreboards. Numbers live inside each
 * step. Coming-soon steps still render so the lead sees the full arc.
 */
const FLOW: ReadonlyArray<FlowStep> = [
  {
    step: 1,
    title: "Define capability map",
    description:
      "Confirm L1–L4 capabilities and the headcount that delivers them, per tower.",
    href: "/capability-map",
    icon: <MapIcon className="h-6 w-6" />,
    status: "active",
    band: "discover",
  },
  {
    step: 2,
    title: "Configure impact levers",
    description:
      "Dial offshore + AI per L4 Activity Group against the confirmed capability map.",
    href: "/impact-levers",
    icon: <Sliders className="h-6 w-6" />,
    status: "active",
    band: "discover",
  },
  {
    step: 3,
    title: "Review impact estimate",
    description:
      "Roll-up of the program impact lens — by tower, by lever, with sensitivity bands.",
    href: "/impact-levers/summary",
    icon: <TrendingUp className="h-6 w-6" />,
    status: "active",
    band: "discover",
  },
  {
    step: 4,
    title: "Design AI initiatives",
    description:
      "The agent architectures, sequencing, and 4-lens detail behind the AI dial.",
    href: "/towers",
    icon: <Cpu className="h-6 w-6" />,
    status: "active",
    band: "design",
  },
  {
    step: 5,
    title: "Design offshore initiative",
    description:
      "Accenture-led India GCC in three TSA-paced waves — org transition, scope, and carve-outs.",
    href: "/offshore-plan",
    icon: <Globe2 className="h-6 w-6" />,
    status: "active",
    band: "design",
    wip: true,
  },
];

export function ProgramHome() {
  const redact = useRedactDollars();
  // Step 3 (Review impact estimate) is the program's modeled-$ roll-up; it's
  // hidden in protected mode so the card itself doesn't draw the client's
  // attention to a hidden surface. The grid collapses from 5 cols to 4.
  const flow = React.useMemo(
    () => (redact ? FLOW.filter((s) => s.step !== 3) : FLOW),
    [redact],
  );
  const stepCount = flow.length;
  return (
    <PageShell>
      <div className="mx-auto max-w-6xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        {/* ========== COMPACT HEADER ========== */}
        <header className="flex flex-wrap items-center justify-between gap-3 pb-1">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-purple/30 bg-accent-purple/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-accent-purple-dark">
            <Sparkles className="h-3 w-3" aria-hidden />
            Forge Program · Accenture × Versant
          </span>
        </header>

        <ProgramJourneyGuidance />

        {/* ========== INTRO ========== */}
        <section className="mt-4">
          <h1 className="font-display text-2xl font-semibold leading-tight tracking-tight text-forge-ink sm:text-3xl">
            <span className="font-mono text-accent-purple-dark">&gt;</span> Your tower
            workflow
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-forge-subtle">
            {stepCount === 5
              ? "Five steps to take a tower from raw capability map to a defended impact case."
              : `${stepCount} steps to take a tower from raw capability map through to AI initiative design.`}{" "}
            Pick up wherever you left off.
          </p>
          <p className="mt-2">
            <Link
              href="/program/tower-status"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-accent-purple-dark underline decoration-forge-border decoration-1 underline-offset-2 hover:decoration-accent-purple/50"
            >
              <Table2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Tower step status — Accenture leads, all towers, Steps 1–4
            </Link>
          </p>
        </section>

        {/* ========== STEP FLOW ========== */}
        <ol
          aria-label="Tower-lead workflow"
          className={
            "mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:gap-2.5 " +
            (stepCount === 5 ? "lg:grid-cols-5" : "lg:grid-cols-4")
          }
        >
          {flow.map((s, idx) => (
            <FlowStepCard key={s.step} step={s} isLast={idx === flow.length - 1} />
          ))}
        </ol>

        {/* ========== BAND LABEL HINT ========== */}
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-medium uppercase tracking-wider text-forge-hint">
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-1.5 w-1.5 rounded-full bg-accent-purple"
            />
            Discover &amp; size — steps 1–3
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-1.5 w-1.5 rounded-full bg-accent-teal"
            />
            Design initiatives — steps 4–5
          </span>
        </div>

        {/* ========== ASK FORGE CTA — horizontal capability ========== */}
        <AskForgeCta />
      </div>
    </PageShell>
  );
}

/* ============== ASK FORGE CTA ============== */

function AskForgeCta() {
  return (
    <Link
      href="/ask"
      className="group mt-6 flex flex-col gap-3 overflow-hidden rounded-2xl border border-accent-purple/30 bg-forge-surface px-5 py-4 transition hover:border-accent-purple/60 hover:shadow-[0_0_0_1px_rgba(161,0,255,0.22)] sm:flex-row sm:items-center sm:gap-5"
    >
      <span
        aria-hidden
        className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border border-accent-purple/30 bg-accent-purple/10 text-accent-purple-dark"
      >
        <MessagesSquare className="h-5 w-5" />
      </span>
      <div className="flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent-purple-dark">
            <span aria-hidden className="font-mono">
              &gt;
            </span>{" "}
            Ask Forge
          </span>
          <span className="rounded-full border border-accent-purple/30 bg-accent-purple/5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-accent-purple-dark">
            New · LLM
          </span>
        </div>
        <h3 className="mt-1 font-display text-base font-semibold text-forge-ink">
          Ask anything across the Forge corpus and your live workshop data
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-forge-subtle">
          Headcount, offshoring, modeled savings, P1 initiatives, brand mentions.
          Answers come back as charts, snapshots, and sourced summaries — not flat text.
        </p>
      </div>
      <span className="inline-flex flex-shrink-0 items-center gap-1 self-start text-xs font-medium text-accent-purple-dark group-hover:text-accent-purple sm:self-center">
        Open
        <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </span>
    </Link>
  );
}

/* ============== FLOW STEP CARD ============== */

function FlowStepCard({ step, isLast }: { step: FlowStep; isLast: boolean }) {
  const isActive = step.status === "active";
  const bandPurple = step.band === "discover";
  const isWip = isActive && step.wip === true;

  return (
    <li className="relative list-none">
      <Link
        href={step.href}
        aria-disabled={!isActive}
        className={
          "group relative flex h-full min-h-[180px] flex-col overflow-hidden rounded-2xl border transition " +
          (isActive
            ? isWip
              ? "border-forge-border-strong bg-forge-surface hover:border-forge-hint"
              : bandPurple
                ? "border-accent-purple/30 bg-forge-surface hover:border-accent-purple/60 hover:shadow-[0_0_0_1px_rgba(161,0,255,0.22)]"
                : "border-accent-teal/30 bg-forge-surface hover:border-accent-teal/60 hover:shadow-[0_0_0_1px_rgba(0,191,165,0.22)]"
            : "border-forge-border bg-forge-surface/60 hover:border-forge-border-strong")
        }
      >
        {/* WIP banner — full-width neutral strip, prominent but de-emphasized */}
        {isWip ? (
          <div className="flex items-center justify-center gap-1.5 border-b border-forge-border-strong bg-forge-well-strong px-3 py-1 text-[9px] font-bold uppercase tracking-[0.22em] text-forge-subtle">
            <Construction className="h-2.5 w-2.5" aria-hidden />
            Work in progress
          </div>
        ) : null}

        <div className="flex flex-1 flex-col gap-3 p-4">
        {/* Top: numbered chip + icon */}
        <div className="flex items-center justify-between">
          <span
            className={
              "inline-flex h-7 w-7 items-center justify-center rounded-full font-mono text-[11px] font-bold " +
              (isActive
                ? isWip
                  ? "border border-forge-border-strong bg-forge-well text-forge-subtle"
                  : bandPurple
                    ? "bg-accent-purple text-white"
                    : "bg-accent-teal text-white"
                : "border border-forge-border-strong bg-forge-well text-forge-subtle")
            }
            aria-hidden
          >
            {step.step}
          </span>
          <span
            className={
              "flex h-10 w-10 items-center justify-center rounded-xl border " +
              (isActive
                ? isWip
                  ? "border-forge-border bg-forge-well/60 text-forge-subtle"
                  : bandPurple
                    ? "border-accent-purple/30 bg-accent-purple/10 text-accent-purple-dark"
                    : "border-accent-teal/30 bg-accent-teal/10 text-accent-teal"
                : "border-forge-border bg-forge-well/40 text-forge-subtle")
            }
            aria-hidden
          >
            {step.icon}
          </span>
        </div>

        {/* Title + description */}
        <div className="flex flex-1 flex-col">
          <h3
            className={
              "font-display text-base font-semibold leading-snug " +
              (isActive
                ? "text-forge-ink group-hover:text-accent-purple-dark"
                : "text-forge-body")
            }
          >
            {step.title}
          </h3>
          <p className="mt-1 flex-1 text-[12px] leading-relaxed text-forge-subtle">
            {step.description}
          </p>
        </div>

        {/* Footer: status + arrow */}
        <div className="flex items-center justify-between">
          {isActive ? (
            isWip ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full border border-forge-border-strong bg-forge-well px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-forge-subtle">
                  <Construction className="h-2.5 w-2.5" aria-hidden />
                  WIP — preview
                </span>
                <ArrowRight className="h-3 w-3 text-forge-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-accent-purple-dark group-hover:text-accent-purple">
                Open
                <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </span>
            )
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-accent-amber/40 bg-accent-amber/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-accent-amber">
              <CalendarClock className="h-2.5 w-2.5" aria-hidden />
              Coming next
            </span>
          )}
          {!isLast ? (
            <span
              aria-hidden
              className="hidden font-mono text-base text-forge-hint lg:inline"
              title="Then"
            >
              &gt;
            </span>
          ) : null}
        </div>
        </div>
      </Link>
    </li>
  );
}
