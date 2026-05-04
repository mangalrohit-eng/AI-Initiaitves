"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  CalendarClock,
  Construction,
  Cpu,
  Globe2,
  Map as MapIcon,
  Sliders,
  Sparkles,
  Table2,
  TrendingUp,
  Waypoints,
} from "lucide-react";
import { PresencePill } from "@/components/program/PresencePill";
import { RecentUpdatesPill } from "@/components/program/RecentUpdatesPill";
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
  band: "discover" | "design";
  wip?: boolean;
};

/**
 * Dense landing: fits one viewport on typical laptop; Cross Tower AI Plan is
 * the visually dominant “core output” card.
 */
const FLOW: ReadonlyArray<FlowStep> = [
  {
    step: 1,
    title: "Capability map",
    description: "L1–L4 + headcount, per tower.",
    href: "/capability-map",
    icon: <MapIcon className="h-5 w-5" />,
    status: "active",
    band: "discover",
  },
  {
    step: 2,
    title: "Impact levers",
    description: "Offshore + AI dials on L4 groups.",
    href: "/impact-levers",
    icon: <Sliders className="h-5 w-5" />,
    status: "active",
    band: "discover",
  },
  {
    step: 3,
    title: "Impact roll-up",
    description: "Program lens by tower and lever.",
    href: "/impact-levers/summary",
    icon: <TrendingUp className="h-5 w-5" />,
    status: "active",
    band: "discover",
  },
  {
    step: 4,
    title: "Tower AI initiatives",
    description: "4-lens briefs and agent design per tower.",
    href: "/towers",
    icon: <Cpu className="h-5 w-5" />,
    status: "active",
    band: "design",
  },
  {
    step: 5,
    title: "Cross Tower AI Plan",
    description:
      "Single program view: AI Projects per L4, Value × Effort matrix, 24-month value buildup, roadmap and risks.",
    href: "/program/cross-tower-ai-plan",
    icon: <Waypoints className="h-6 w-6" />,
    status: "active",
    band: "design",
  },
  {
    step: 6,
    title: "Offshore plan",
    description: "GCC waves, TSA-paced transition.",
    href: "/offshore-plan",
    icon: <Globe2 className="h-5 w-5" />,
    status: "active",
    band: "design",
    wip: true,
  },
];

/** lg+ grid placement: row 1 = steps 1–4; row 2 = step 5 under step 4. (case 6 supports full FLOW if step 6 is re-shown.) */
function flowStepLgGridClass(
  step: number,
  flow: ReadonlyArray<FlowStep>,
): string {
  const has3 = flow.some((s) => s.step === 3);
  const base = "max-lg:col-auto max-lg:row-auto ";
  if (step === 5) {
    return (
      base +
      (has3 ? "lg:col-start-4 lg:row-start-2" : "lg:col-start-3 lg:row-start-2")
    );
  }
  switch (step) {
    case 1:
      return base + "lg:col-start-1 lg:row-start-1";
    case 2:
      return base + "lg:col-start-2 lg:row-start-1";
    case 3:
      return base + "lg:col-start-3 lg:row-start-1";
    case 4:
      return (
        base +
        (has3 ? "lg:col-start-4 lg:row-start-1" : "lg:col-start-3 lg:row-start-1")
      );
    case 6:
      return (
        base +
        (has3 ? "lg:col-start-5 lg:row-start-1" : "lg:col-start-4 lg:row-start-1")
      );
    default:
      return base;
  }
}

export function ProgramHome() {
  const redact = useRedactDollars();
  const flow = React.useMemo(() => {
    const base = redact ? FLOW.filter((s) => s.step !== 3) : FLOW;
    return base.filter((s) => s.step !== 6);
  }, [redact]);
  const hasStep3 = flow.some((s) => s.step === 3);
  const lgCols = hasStep3 ? 4 : 3;

  return (
    <PageShell>
      <div className="mx-auto flex max-w-6xl flex-col px-3 pb-3 pt-2 sm:px-5 lg:max-h-[calc(100dvh-6.5rem)] lg:overflow-hidden">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 pb-1">
          <span className="inline-flex items-center gap-1 rounded-full border border-accent-purple/30 bg-accent-purple/5 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-accent-purple-dark">
            <Sparkles className="h-2.5 w-2.5" aria-hidden />
            Forge · Accenture × Versant
          </span>
          <div className="flex items-center gap-1.5">
            <PresencePill />
            <RecentUpdatesPill />
          </div>
        </header>

        <section className="shrink-0 pt-1">
          <h1 className="font-display text-lg font-semibold leading-tight tracking-tight text-forge-ink sm:text-xl">
            <span className="font-mono text-accent-purple-dark">&gt;</span> Tower
            workflow
          </h1>
          <p className="mt-0.5 max-w-3xl text-[11px] leading-snug text-forge-subtle sm:text-xs">
            Map through tower AI design to the{" "}
            <span className="font-semibold text-accent-purple-dark">
              Cross Tower AI Plan
            </span>{" "}
            (core program output). Offshoring plan is linked below.
          </p>
          <p className="mt-1">
            <Link
              href="/program/tower-status"
              className="inline-flex items-center gap-1 text-[10px] font-medium text-accent-purple-dark underline decoration-forge-border decoration-1 underline-offset-2 hover:decoration-accent-purple/50 sm:text-[11px]"
            >
              <Table2 className="h-3 w-3 shrink-0" aria-hidden />
              Tower status · Steps 1–4
            </Link>
          </p>
        </section>

        <ol
          aria-label="Tower-lead workflow"
          className={
            "mt-2 min-h-0 flex-1 grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-2 lg:items-stretch lg:gap-2 " +
            (lgCols === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3")
          }
        >
          {flow.map((step) => {
            const showFlowChevron = step.step !== 5 && step.step !== 6;

            if (step.step === 5) {
              return (
                <li
                  key={step.step}
                  className={
                    "list-none flex flex-col gap-1 " +
                    flowStepLgGridClass(step.step, flow)
                  }
                >
                  <div
                    className="flex shrink-0 justify-center py-0.5"
                    aria-hidden="true"
                  >
                    <ArrowDown
                      className="h-4 w-4 shrink-0 text-accent-purple-dark"
                      strokeWidth={2.5}
                    />
                  </div>
                  <div className="shrink-0">
                    <FlowStepCard
                      step={step}
                      highlight="core"
                      showFlowChevron={false}
                    />
                  </div>
                </li>
              );
            }

            return (
              <li
                key={step.step}
                className={
                  "list-none flex h-full min-h-0 flex-col " +
                  flowStepLgGridClass(step.step, flow)
                }
              >
                <FlowStepCard
                  step={step}
                  compact
                  fillColumn
                  showFlowChevron={showFlowChevron}
                />
              </li>
            );
          })}
        </ol>

        <div className="mt-2 shrink-0 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[9px] font-medium uppercase tracking-wider text-forge-hint">
            <span className="inline-flex items-center gap-1">
              <span className="h-1 w-1 rounded-full bg-accent-purple" aria-hidden />
              Discover 1–3
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-1 w-1 rounded-full bg-accent-teal" aria-hidden />
              Design 4–5
            </span>
          </div>
          <Link
            href="/offshore-plan"
            className="text-[10px] font-medium text-forge-hint underline decoration-forge-border decoration-1 underline-offset-2 hover:text-accent-purple-dark hover:decoration-accent-purple/50 sm:text-[11px]"
          >
            Offshoring
          </Link>
        </div>
      </div>
    </PageShell>
  );
}

/* ============== FLOW STEP CARD ============== */

function FlowStepCard({
  step,
  showFlowChevron,
  compact = false,
  highlight = "none",
  fillColumn = false,
}: {
  step: FlowStep;
  showFlowChevron: boolean;
  compact?: boolean;
  highlight?: "none" | "core";
  /** Stretch to match sibling columns in the home workflow grid (lg). */
  fillColumn?: boolean;
}) {
  const isActive = step.status === "active";
  const bandPurple = step.band === "discover";
  const isWip = isActive && step.wip === true;
  const isCore = highlight === "core" && isActive;

  const shellPad = compact ? "p-2.5 gap-1.5" : isCore ? "p-3 gap-1.5" : "p-4 gap-3";
  const chipCls = compact
    ? "h-6 w-6 text-[10px]"
    : isCore
      ? "h-8 w-8 text-[11px] ring-2 ring-white/40"
      : "h-7 w-7 text-[11px]";
  const iconWrap = compact
    ? "h-8 w-8"
    : isCore
      ? "h-11 w-11"
      : "h-10 w-10";
  const titleCls = compact
    ? "text-[12px] leading-tight"
    : isCore
      ? "text-[14px] font-bold leading-snug text-accent-purple-dark break-words sm:text-[15px]"
      : "text-base leading-snug";
  const descCls = isCore
    ? "text-[11px] leading-snug text-forge-body line-clamp-3 break-words"
    : compact
      ? "text-[10px] leading-snug line-clamp-3 break-words"
      : "";

  const borderShell =
    isCore && isActive
      ? "border-2 border-accent-purple bg-gradient-to-b from-accent-purple/[0.18] via-accent-purple/[0.06] to-forge-surface shadow-[0_0_28px_rgba(161,0,255,0.22)] hover:border-accent-purple-dark hover:shadow-[0_0_32px_rgba(161,0,255,0.28)]"
      : isActive
        ? isWip
          ? "border-forge-border-strong bg-forge-surface hover:border-forge-hint"
          : bandPurple
            ? "border-accent-purple/30 bg-forge-surface hover:border-accent-purple/60 hover:shadow-[0_0_0_1px_rgba(161,0,255,0.22)]"
            : "border-accent-teal/30 bg-forge-surface hover:border-accent-teal/60 hover:shadow-[0_0_0_1px_rgba(0,191,165,0.22)]"
        : "border-forge-border bg-forge-surface/60 hover:border-forge-border-strong";

  return (
    <div
      className={
        fillColumn
          ? "relative flex min-h-0 flex-1 flex-col"
          : "relative"
      }
    >
      <Link
        href={step.href}
        aria-disabled={!isActive}
        className={
          "group relative flex flex-col rounded-xl border transition " +
          borderShell +
          (fillColumn ? " h-full min-h-0 flex-1" : "")
        }
      >
        {isWip ? (
          <div className="flex items-center justify-center gap-1 border-b border-forge-border-strong bg-forge-well-strong px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-forge-subtle">
            <Construction className="h-2 w-2" aria-hidden />
            WIP
          </div>
        ) : null}

        <div
          className={
            `flex flex-col ${shellPad}` +
            (fillColumn ? " min-h-0 flex-1" : "")
          }
        >
          <div className="flex shrink-0 items-center justify-between gap-1">
            <span
              className={
                `inline-flex shrink-0 items-center justify-center rounded-full font-mono font-bold ` +
                chipCls +
                (isActive
                  ? isWip
                    ? " border border-forge-border-strong bg-forge-well text-forge-subtle"
                    : isCore
                      ? " bg-accent-purple text-white"
                      : bandPurple
                        ? " bg-accent-purple text-white"
                        : " bg-accent-teal text-white"
                  : " border border-forge-border-strong bg-forge-well text-forge-subtle")
              }
              aria-hidden
            >
              {step.step}
            </span>
            <span
              className={
                `flex shrink-0 items-center justify-center rounded-lg border ` +
                iconWrap +
                (isActive
                  ? isWip
                    ? " border-forge-border bg-forge-well/60 text-forge-subtle"
                    : isCore
                      ? " border-accent-purple/50 bg-accent-purple/15 text-accent-purple-dark"
                      : bandPurple
                        ? " border-accent-purple/30 bg-accent-purple/10 text-accent-purple-dark"
                        : " border-accent-teal/30 bg-accent-teal/10 text-accent-teal"
                  : " border-forge-border bg-forge-well/40 text-forge-subtle")
              }
              aria-hidden
            >
              {step.icon}
            </span>
          </div>

          <div
            className={
              fillColumn ? "min-h-0 flex-1 flex flex-col" : ""
            }
          >
            <h3
              className={
                titleCls +
                " " +
                (isActive && !isCore
                  ? bandPurple
                    ? " font-semibold text-forge-ink group-hover:text-accent-purple-dark"
                    : " font-semibold text-forge-ink group-hover:text-accent-teal"
                  : isCore
                    ? ""
                    : " text-forge-body")
              }
            >
              {step.title}
            </h3>
            <p
              className={
                compact || isCore
                  ? `mt-0.5 ${isCore ? "" : "text-forge-subtle "}${descCls}`
                  : "mt-1 flex-1 text-[12px] leading-relaxed text-forge-subtle"
              }
            >
              {step.description}
            </p>
          </div>

          <div
            className={
              fillColumn
                ? "mt-auto flex shrink-0 items-center justify-between gap-1 pt-1"
                : "mt-2 flex items-center justify-between gap-1"
            }
          >
            {isActive ? (
              isWip ? (
                <span className="inline-flex items-center gap-1 text-[9px] font-medium text-forge-subtle">
                  Preview
                  <ArrowRight className="h-2.5 w-2.5" aria-hidden />
                </span>
              ) : (
                <span
                  className={
                    "inline-flex items-center gap-0.5 text-[10px] font-semibold " +
                    (isCore
                      ? " text-accent-purple-dark group-hover:text-accent-purple"
                      : bandPurple
                        ? " text-accent-purple-dark group-hover:text-accent-purple"
                        : " text-accent-teal group-hover:text-accent-teal/90")
                  }
                >
                  Open
                  <ArrowRight className="h-2.5 w-2.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              )
            ) : (
              <span className="inline-flex items-center gap-0.5 rounded border border-accent-amber/40 bg-accent-amber/10 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wider text-accent-amber">
                <CalendarClock className="h-2 w-2" aria-hidden />
                Soon
              </span>
            )}
            {showFlowChevron ? (
              <span
                aria-hidden
                className="hidden font-mono text-sm text-forge-hint lg:inline"
                title="Then"
              >
                &gt;
              </span>
            ) : null}
          </div>
        </div>
      </Link>
    </div>
  );
}
