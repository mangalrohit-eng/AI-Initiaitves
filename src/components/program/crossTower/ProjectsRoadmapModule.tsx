"use client";

import * as React from "react";
import {
  Calendar,
  Hammer,
  Sparkles,
  TrendingUp,
  Zap,
  Target,
  Layers,
} from "lucide-react";
import type {
  AIProjectResolved,
  ProgramSynthesisLLM,
  Quadrant,
} from "@/lib/cross-tower/aiProjects";
import type { CrossTowerAssumptions } from "@/lib/cross-tower/assumptions";
import { formatUsdCompact } from "@/lib/format";
import { useRedactDollars } from "@/lib/clientMode";

/**
 * Cross-Tower AI Plan v3 — projects-driven implementation roadmap.
 *
 * Replaces the legacy P1/P2/P3 phase narrative with a project-grain Gantt:
 *
 *   - One row per **AI Project** (one project = one L4 Activity Group).
 *   - Three segments per row: Build (no benefit), Ramp (linear adoption),
 *     At-scale (full attributed run-rate).
 *   - Quadrant ribbon on the left edge so the executive can scan
 *     Quick Win / Strategic Bet / Fill-in at a glance.
 *   - Stub projects (LLM authoring failed) and Deprioritize-quadrant
 *     projects do NOT enter this view — they're shown elsewhere
 *     (ProjectBriefDrawer with stub state, AIProjectsModule for
 *     Deprioritize cards).
 *
 * Below the Gantt, the **LLM-authored roadmap narrative** runs:
 *
 *   - `roadmapNarrative.overall`   — how the program sequences across 24 months.
 *   - `roadmapNarrative.ladder`    — how Quick Wins fund Strategic Bets.
 *   - `roadmapNarrative.milestones`— 3–5 named milestones, declarative.
 *   - `roadmapNarrative.ownerNotes`— 1–3 owner notes (towers / executives).
 *
 * Timing knobs (`programStartMonth`, `highEffortBuildMonths`,
 * `lowEffortBuildMonths`, value-start months, ramp months,
 * `fillInStartOffsetMonths`) come from Assumptions and are 0-token —
 * regenerating the plan is not required to re-flow the Gantt after a knob
 * change, but the LLM narrative will go stale until Regenerate is clicked.
 */

const HORIZON_MONTHS = 24;

export function ProjectsRoadmapModule({
  projects,
  synthesis,
  assumptions,
  onSelectProject,
  bare,
}: {
  projects: AIProjectResolved[];
  synthesis: ProgramSynthesisLLM | null;
  assumptions: CrossTowerAssumptions;
  onSelectProject?: (p: AIProjectResolved) => void;
  bare?: boolean;
}) {
  const sequenced = React.useMemo(
    () =>
      projects
        .filter((p) => !p.isStub && !p.isDeprioritized)
        .sort(compareForGantt),
    [projects],
  );

  const Header = (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-lg font-semibold text-forge-ink">
          <span className="font-mono text-accent-purple-dark">&gt;</span>{" "}
          Implementation roadmap
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-forge-subtle">
          One row per AI Project (one project = one L4 Activity Group).
          Build / ramp / at-scale segments are deterministic from the
          Assumptions tab. Quick Wins ladder into Strategic Bets; Fill-ins
          slot in once team capacity opens up.
        </p>
      </div>
      {synthesis ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-accent-purple/30 bg-accent-purple/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-accent-purple-dark">
          <Sparkles className="h-2.5 w-2.5" aria-hidden /> AI-authored narrative
        </span>
      ) : null}
    </header>
  );

  const Body = (
    <>
      <QuadrantRibbon projects={projects} />
      <div className="mt-4">
        {sequenced.length === 0 ? (
          <div className="rounded-xl border border-dashed border-forge-border bg-forge-well/40 p-10 text-center text-sm text-forge-subtle">
            No sequenceable projects. Regenerate the plan to populate the
            roadmap.
          </div>
        ) : (
          <ProjectsGantt
            projects={sequenced}
            assumptions={assumptions}
            onSelectProject={onSelectProject}
          />
        )}
      </div>
      <RoadmapNarrative synthesis={synthesis} />
    </>
  );

  if (bare) {
    return (
      <div className="space-y-5">
        {Header}
        {Body}
      </div>
    );
  }
  return (
    <section className="rounded-2xl border border-forge-border bg-forge-surface p-5 shadow-card">
      {Header}
      <div className="mt-5">{Body}</div>
    </section>
  );
}

// ===========================================================================
//   Quadrant ribbon — project counts + total $ per quadrant
// ===========================================================================

const QUADRANT_META: Record<
  Quadrant,
  {
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    chip: string;
    accent: string;
  }
> = {
  "Quick Win": {
    label: "Quick Wins",
    description: "High value · Low effort. Ship first, fund the rest.",
    icon: Zap,
    chip: "border-accent-green/40 bg-accent-green/10 text-accent-green",
    accent: "bg-accent-green",
  },
  "Strategic Bet": {
    label: "Strategic Bets",
    description: "High value · High effort. Multi-month flagships.",
    icon: Target,
    chip: "border-accent-purple/40 bg-accent-purple/10 text-accent-purple-dark",
    accent: "bg-accent-purple",
  },
  "Fill-in": {
    label: "Fill-ins",
    description: "Low value · Low effort. Slot into team capacity.",
    icon: Layers,
    chip: "border-accent-teal/40 bg-accent-teal/10 text-accent-teal",
    accent: "bg-accent-teal",
  },
  "Deprioritize": {
    label: "Deprioritize",
    description: "Low value · High effort. Below the line — skipped.",
    icon: Calendar,
    chip: "border-accent-red/40 bg-accent-red/10 text-accent-red",
    accent: "bg-accent-red",
  },
};

function QuadrantRibbon({ projects }: { projects: AIProjectResolved[] }) {
  const redact = useRedactDollars();
  const liveQuadrants: Quadrant[] = ["Quick Win", "Strategic Bet", "Fill-in"];
  const summary = liveQuadrants.map((q) => {
    const items = projects.filter((p) => !p.isStub && p.quadrant === q);
    const usd = items.reduce((s, p) => s + p.attributedAiUsd, 0);
    return { quadrant: q, count: items.length, usd };
  });
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {summary.map(({ quadrant, count, usd }) => {
        const meta = QUADRANT_META[quadrant];
        const Icon = meta.icon;
        return (
          <div
            key={quadrant}
            className="rounded-xl border border-forge-border bg-forge-surface p-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-md ${meta.chip}`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                </span>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-forge-subtle">
                    {meta.label}
                  </div>
                  <div className="font-mono text-base font-semibold text-forge-ink">
                    {count}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-xs text-forge-subtle">
                  {redact ? "—" : formatUsdCompact(usd)}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-forge-hint">
                  modeled $
                </div>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-forge-subtle">{meta.description}</p>
          </div>
        );
      })}
    </div>
  );
}

// ===========================================================================
//   Gantt
// ===========================================================================

function ProjectsGantt({
  projects,
  assumptions,
  onSelectProject,
}: {
  projects: AIProjectResolved[];
  assumptions: CrossTowerAssumptions;
  onSelectProject?: (p: AIProjectResolved) => void;
}) {
  const redact = useRedactDollars();
  return (
    <div className="overflow-x-auto rounded-xl border border-forge-border bg-forge-surface">
      <div className="min-w-[1024px]">
        <GanttHeader />
        <ul className="divide-y divide-forge-border/60">
          {projects.map((project) => (
            <GanttRow
              key={project.id}
              project={project}
              redact={redact}
              onSelect={onSelectProject}
            />
          ))}
        </ul>
        <GanttLegend assumptions={assumptions} />
      </div>
    </div>
  );
}

function GanttHeader() {
  return (
    <div className="sticky top-0 z-10 grid grid-cols-[280px_minmax(0,1fr)_104px] items-end gap-3 border-b border-forge-border bg-forge-surface/95 px-3 py-2 backdrop-blur">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-forge-subtle">
        Project
      </div>
      <div className="relative h-9">
        <div className="absolute inset-x-0 top-0 grid grid-cols-8 text-[10px] uppercase tracking-wider text-forge-hint">
          {["Q1 Y1", "Q2 Y1", "Q3 Y1", "Q4 Y1", "Q1 Y2", "Q2 Y2", "Q3 Y2", "Q4 Y2"].map(
            (q, i) => (
              <div
                key={q}
                className={`text-center ${
                  i === 0 ? "" : "border-l border-forge-border/60"
                }`}
              >
                {q}
              </div>
            ),
          )}
        </div>
        <div className="absolute inset-x-0 bottom-0 flex">
          {Array.from({ length: HORIZON_MONTHS }, (_, i) => (
            <div
              key={i}
              className="flex-1 text-center font-mono text-[9px] text-forge-hint"
            >
              {i + 1}
            </div>
          ))}
        </div>
      </div>
      <div className="text-right text-[11px] font-semibold uppercase tracking-wider text-forge-subtle">
        $ at scale
      </div>
    </div>
  );
}

function GanttRow({
  project,
  redact,
  onSelect,
}: {
  project: AIProjectResolved;
  redact: boolean;
  onSelect?: (p: AIProjectResolved) => void;
}) {
  const colors = quadrantColors(project.quadrant);
  const buildEnd = project.startMonth + project.buildMonths - 1;
  const rampStart = project.valueStartMonth;
  const rampEnd = project.valueStartMonth + project.rampMonths - 1;
  const fullScaleMonth = rampEnd + 1;
  const tooltip = buildTooltip(project, buildEnd, rampStart, rampEnd, redact);

  return (
    <li
      className="grid cursor-pointer grid-cols-[280px_minmax(0,1fr)_104px] items-center gap-3 px-3 py-2 transition hover:bg-forge-well/30"
      title={tooltip}
      onClick={() => onSelect?.(project)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect?.(project);
        }
      }}
    >
      <div className="flex min-w-0 items-start gap-2">
        <span
          aria-hidden
          className={`mt-1 inline-block h-9 w-1 flex-shrink-0 rounded-full ${colors.ribbon}`}
          title={project.quadrant ?? "Unsequenced"}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <QuadrantBadge quadrant={project.quadrant} colors={colors} />
            <span
              className="truncate text-sm font-medium text-forge-ink"
              title={project.name}
            >
              {project.name}
            </span>
          </div>
          <div
            className="mt-0.5 truncate text-[11px] text-forge-hint"
            title={`${project.primaryTowerName} · ${project.parentL4ActivityGroupName}`}
          >
            {project.primaryTowerName}
            <span className="mx-1">·</span>
            {project.parentL4ActivityGroupName}
          </div>
        </div>
      </div>

      <BarTrack
        startMonth={project.startMonth}
        buildMonths={project.buildMonths}
        valueStartMonth={project.valueStartMonth}
        rampMonths={project.rampMonths}
        colors={colors}
      />

      <div className="text-right">
        <div className="font-mono text-xs tabular-nums text-forge-ink">
          {redact ? "—" : formatUsdCompact(project.attributedAiUsd)}
        </div>
        {fullScaleMonth > HORIZON_MONTHS ? (
          <div className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-forge-hint">
            full scale {fullScaleQuarterLabel(fullScaleMonth)}
          </div>
        ) : null}
      </div>
    </li>
  );
}

function BarTrack({
  startMonth,
  buildMonths,
  valueStartMonth,
  rampMonths,
  colors,
}: {
  startMonth: number;
  buildMonths: number;
  valueStartMonth: number;
  rampMonths: number;
  colors: QuadrantColors;
}) {
  const leftPctOfStart = (m: number) => clamp01((m - 1) / HORIZON_MONTHS) * 100;
  const widthPctMonths = (count: number) =>
    clamp01(count / HORIZON_MONTHS) * 100;

  const buildEndMonth = startMonth + buildMonths - 1;
  const buildVisibleMonths = Math.max(
    0,
    Math.min(buildEndMonth, HORIZON_MONTHS) - startMonth + 1,
  );
  const buildLeft = leftPctOfStart(startMonth);
  const buildWidth = widthPctMonths(buildVisibleMonths);
  const buildClipped = buildEndMonth > HORIZON_MONTHS;

  const rampEndMonth = valueStartMonth + rampMonths - 1;
  const rampStartsInHorizon = valueStartMonth <= HORIZON_MONTHS;
  const rampVisibleMonths = rampStartsInHorizon
    ? Math.max(0, Math.min(rampEndMonth, HORIZON_MONTHS) - valueStartMonth + 1)
    : 0;
  const rampLeft = leftPctOfStart(valueStartMonth);
  const rampWidth = widthPctMonths(rampVisibleMonths);
  const rampClipped = rampEndMonth > HORIZON_MONTHS;

  const atScaleStartsInHorizon = rampEndMonth < HORIZON_MONTHS;
  const atScaleVisibleMonths = atScaleStartsInHorizon
    ? HORIZON_MONTHS - rampEndMonth
    : 0;
  const atScaleLeft = leftPctOfStart(rampEndMonth + 1);
  const atScaleWidth = widthPctMonths(atScaleVisibleMonths);

  return (
    <div className="relative h-7 rounded-md border border-forge-border/40 bg-forge-well/30">
      {[6, 12, 18].map((m) => (
        <div
          key={m}
          aria-hidden
          className="absolute top-0 bottom-0 w-px bg-forge-border/50"
          style={{ left: `${(m / HORIZON_MONTHS) * 100}%` }}
        />
      ))}

      {buildVisibleMonths > 0 ? (
        <div
          className="absolute top-0.5 bottom-0.5 rounded-sm border-b border-dashed"
          style={{
            left: `${buildLeft}%`,
            width: `${buildWidth}%`,
            background: colors.buildFill,
            borderBottomColor: colors.solid,
            ...(buildClipped
              ? {
                  WebkitMaskImage:
                    "linear-gradient(to right, black 80%, transparent 100%)",
                  maskImage:
                    "linear-gradient(to right, black 80%, transparent 100%)",
                }
              : {}),
          }}
        />
      ) : null}

      {rampVisibleMonths > 0 ? (
        <div
          className="absolute top-0.5 bottom-0.5 rounded-sm"
          style={{
            left: `${rampLeft}%`,
            width: `${rampWidth}%`,
            background: `linear-gradient(to right, ${colors.rampStart}, ${colors.rampEnd})`,
            ...(rampClipped
              ? {
                  WebkitMaskImage:
                    "linear-gradient(to right, black 70%, transparent 100%)",
                  maskImage:
                    "linear-gradient(to right, black 70%, transparent 100%)",
                }
              : {}),
          }}
        />
      ) : null}

      {atScaleVisibleMonths > 0 ? (
        <div
          className="absolute top-0.5 bottom-0.5 rounded-sm"
          style={{
            left: `${atScaleLeft}%`,
            width: `${atScaleWidth}%`,
            background: colors.solid,
          }}
        />
      ) : null}
    </div>
  );
}

// ===========================================================================
//   Quadrant visuals
// ===========================================================================

type QuadrantColors = {
  solid: string;
  buildFill: string;
  rampStart: string;
  rampEnd: string;
  badge: string;
  ribbon: string;
};

function quadrantColors(q: Quadrant | null): QuadrantColors {
  if (q === "Quick Win") {
    return {
      solid: "#00C853",
      buildFill: "rgba(0, 200, 83, 0.18)",
      rampStart: "rgba(0, 200, 83, 0.5)",
      rampEnd: "#00C853",
      badge: "border-accent-green/40 bg-accent-green/10 text-accent-green",
      ribbon: "bg-accent-green",
    };
  }
  if (q === "Strategic Bet") {
    return {
      solid: "#A100FF",
      buildFill: "rgba(161, 0, 255, 0.18)",
      rampStart: "rgba(161, 0, 255, 0.5)",
      rampEnd: "#A100FF",
      badge: "border-accent-purple/40 bg-accent-purple/10 text-accent-purple-dark",
      ribbon: "bg-accent-purple",
    };
  }
  if (q === "Fill-in") {
    return {
      solid: "#00BFA5",
      buildFill: "rgba(0, 191, 165, 0.18)",
      rampStart: "rgba(0, 191, 165, 0.5)",
      rampEnd: "#00BFA5",
      badge: "border-accent-teal/40 bg-accent-teal/10 text-accent-teal",
      ribbon: "bg-accent-teal",
    };
  }
  return {
    solid: "#5A6478",
    buildFill: "rgba(90, 100, 120, 0.18)",
    rampStart: "rgba(90, 100, 120, 0.45)",
    rampEnd: "#5A6478",
    badge: "border-forge-border bg-forge-well text-forge-body",
    ribbon: "bg-forge-hint",
  };
}

function QuadrantBadge({
  quadrant,
  colors,
}: {
  quadrant: Quadrant | null;
  colors: QuadrantColors;
}) {
  const label =
    quadrant === "Quick Win"
      ? "QW"
      : quadrant === "Strategic Bet"
        ? "SB"
        : quadrant === "Fill-in"
          ? "FI"
          : "—";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-1.5 py-0 font-mono text-[10px] font-semibold ${colors.badge}`}
      title={quadrant ?? "Unsequenced"}
    >
      {label}
    </span>
  );
}

function GanttLegend({ assumptions }: { assumptions: CrossTowerAssumptions }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-forge-border bg-forge-well/30 px-3 py-2 text-[11px] text-forge-subtle">
      <div className="flex items-center gap-1.5">
        <Hammer className="h-3 w-3 text-forge-hint" aria-hidden />
        <span className="text-forge-body">Build</span>
        <span className="inline-block h-2 w-6 rounded-sm border-b border-dashed border-accent-purple-dark/60 bg-accent-purple/15" aria-hidden />
        <span>in flight, no benefit</span>
      </div>
      <div className="flex items-center gap-1.5">
        <TrendingUp className="h-3 w-3 text-forge-hint" aria-hidden />
        <span className="text-forge-body">Ramp</span>
        <span
          aria-hidden
          className="inline-block h-2 w-6 rounded-sm"
          style={{
            background:
              "linear-gradient(to right, rgba(161,0,255,0.4), #A100FF)",
          }}
        />
        <span>{assumptions.rampMonths}-month adoption curve</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Sparkles className="h-3 w-3 text-forge-hint" aria-hidden />
        <span className="text-forge-body">At scale</span>
        <span
          aria-hidden
          className="inline-block h-2 w-6 rounded-sm"
          style={{ background: "#A100FF" }}
        />
        <span>full attributed run-rate</span>
      </div>
      <div className="ml-auto max-w-md text-right text-[10px] leading-snug text-forge-hint">
        High-effort projects build {assumptions.highEffortBuildMonths}mo · low-
        effort {assumptions.lowEffortBuildMonths}mo. Fill-ins start{" "}
        {assumptions.fillInStartOffsetMonths}mo after program kickoff.
      </div>
    </div>
  );
}

// ===========================================================================
//   LLM-authored narrative
// ===========================================================================

function RoadmapNarrative({
  synthesis,
}: {
  synthesis: ProgramSynthesisLLM | null;
}) {
  if (!synthesis) {
    return (
      <div className="mt-5 rounded-xl border border-dashed border-forge-border bg-forge-well/40 p-5 text-sm text-forge-subtle">
        Roadmap narrative pending plan generation. Click Regenerate to author
        the cross-program sequencing thesis.
      </div>
    );
  }
  const { roadmapNarrative } = synthesis;
  return (
    <div className="mt-5 grid gap-4 lg:grid-cols-2">
      <NarrativeBlock
        title="Sequencing thesis"
        body={roadmapNarrative.overall}
        accent="purple"
      />
      <NarrativeBlock
        title="Quick Wins → Strategic Bets ladder"
        body={roadmapNarrative.ladder}
        accent="green"
      />
      {roadmapNarrative.milestones.length > 0 ? (
        <div className="rounded-xl border border-forge-border bg-forge-surface p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-forge-subtle">
            Named milestones
          </div>
          <ul className="mt-2 space-y-1.5 text-sm text-forge-body">
            {roadmapNarrative.milestones.map((m, idx) => (
              <li key={idx} className="flex gap-2 leading-relaxed">
                <span className="mt-1.5 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent-purple" />
                <span>{m}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {roadmapNarrative.ownerNotes.length > 0 ? (
        <div className="rounded-xl border border-forge-border bg-forge-surface p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-forge-subtle">
            Ownership notes
          </div>
          <ul className="mt-2 space-y-1.5 text-sm text-forge-body">
            {roadmapNarrative.ownerNotes.map((note, idx) => (
              <li key={idx} className="leading-relaxed">
                {note}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function NarrativeBlock({
  title,
  body,
  accent,
}: {
  title: string;
  body: string;
  accent: "purple" | "green";
}) {
  const tone =
    accent === "green"
      ? "border-accent-green/30 bg-accent-green/5"
      : "border-accent-purple/30 bg-accent-purple/5";
  return (
    <div className={`rounded-xl border ${tone} p-4`}>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-forge-subtle">
        {title}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-forge-body">{body}</p>
    </div>
  );
}

// ===========================================================================
//   Helpers
// ===========================================================================

function compareForGantt(a: AIProjectResolved, b: AIProjectResolved): number {
  // Quick Wins → Strategic Bets → Fill-ins
  const ranked: Record<Quadrant, number> = {
    "Quick Win": 0,
    "Strategic Bet": 1,
    "Fill-in": 2,
    "Deprioritize": 3,
  };
  const ra = a.quadrant ? ranked[a.quadrant] : 99;
  const rb = b.quadrant ? ranked[b.quadrant] : 99;
  if (ra !== rb) return ra - rb;
  if (a.startMonth !== b.startMonth) return a.startMonth - b.startMonth;
  const usd = b.attributedAiUsd - a.attributedAiUsd;
  if (Math.abs(usd) > 1) return usd;
  return a.name.localeCompare(b.name);
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function fullScaleQuarterLabel(month: number): string {
  if (month <= HORIZON_MONTHS) return `M${month}`;
  const monthsPastHorizon = month - HORIZON_MONTHS;
  const yearOffset = Math.floor((monthsPastHorizon - 1) / 12) + 1;
  const monthInYear = ((monthsPastHorizon - 1) % 12) + 1;
  const quarter = Math.ceil(monthInYear / 3);
  return `Q${quarter} Y${2 + yearOffset}`;
}

function buildTooltip(
  project: AIProjectResolved,
  buildEnd: number,
  rampStart: number,
  rampEnd: number,
  redact: boolean,
): string {
  const usd = redact ? "—" : `${formatUsdCompact(project.attributedAiUsd)} attributed`;
  return [
    `${project.name} — ${project.primaryTowerName}`,
    `Quadrant: ${project.quadrant ?? "Unsequenced"}`,
    `Build: M${project.startMonth}–M${buildEnd} (${project.buildMonths}mo)`,
    `Ramp:  M${rampStart}–M${Math.min(rampEnd, HORIZON_MONTHS)} (${project.rampMonths}mo)`,
    `Full scale: M${rampEnd + 1}`,
    `$ at full scale: ${usd}`,
  ].join("\n");
}
