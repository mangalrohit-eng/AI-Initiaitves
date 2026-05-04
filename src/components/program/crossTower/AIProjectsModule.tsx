"use client";

import * as React from "react";
import {
  Sparkles,
  Layers,
  AlertTriangle,
  RotateCcw,
  ExternalLink,
  Bot,
  Network,
} from "lucide-react";
import type { AIProjectResolved, Quadrant } from "@/lib/cross-tower/aiProjects";
import { formatUsdCompact } from "@/lib/format";
import { useRedactDollars } from "@/lib/clientMode";
import { ProjectBriefDrawer } from "./ProjectBriefDrawer";

/**
 * AI Projects card grid — replaces the legacy KeyInitiativesModule on the
 * cross-tower page. Each card renders one `AIProjectResolved`. Cards are
 * grouped by quadrant (Quick Win → Strategic Bet → Fill-in → Deprioritize →
 * Stub) so the executive's eye lands on the highest-leverage projects first.
 *
 * Card surfaces (deterministic):
 *   - Project name (LLM-authored when available; placeholder on stubs)
 *   - Tower chip + L4 Activity Group label
 *   - Modeled $ chip (the L4 prize)
 *   - Quadrant badge (color-coded per the matrix)
 *   - Constituent L5 count + agent count from the brief
 *
 * Card surfaces (LLM-authored, when present):
 *   - 1–2 sentence narrative
 *   - Value / Effort buckets + rationales (popover-on-hover)
 *
 * Stub cards render with a muted purple border, a "Generation pending"
 * inline message, and a per-card retry button so a single failed cohort
 * doesn't block the rest of the program.
 */

export function AIProjectsModule({
  projects,
  bare,
  onRetryCohort,
  retryDisabled,
}: {
  projects: AIProjectResolved[];
  bare?: boolean;
  onRetryCohort?: (l4RowId: string) => void;
  retryDisabled?: boolean;
}) {
  const [activeProjectId, setActiveProjectId] = React.useState<string | null>(
    null,
  );
  const activeProject = React.useMemo(
    () => projects.find((p) => p.id === activeProjectId) ?? null,
    [projects, activeProjectId],
  );

  // Group by quadrant for sectioned rendering.
  const sections = React.useMemo(() => groupByQuadrant(projects), [projects]);

  const Header = (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-lg font-semibold text-forge-ink">
          <span className="font-mono text-accent-purple-dark">&gt;</span> AI
          Projects across the program
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-forge-subtle">
          Each project corresponds to one in-plan L4 Activity Group. Grouping
          is structural; project names, briefs, and value/effort scoring are
          authored by GPT-5.5 against the live Versant context. Click any
          card to read the full 4-lens brief.
        </p>
      </div>
      {projects.length > 0 ? (
        <div className="flex items-center gap-2 text-xs text-forge-subtle">
          <Layers className="h-3.5 w-3.5" aria-hidden />
          <span className="font-mono text-forge-body">{projects.length}</span>{" "}
          projects ·{" "}
          <span className="font-mono text-forge-body">
            {projects.filter((p) => !p.isStub && !p.isDeprioritized).length}
          </span>{" "}
          live
        </div>
      ) : null}
    </header>
  );

  const Body =
    projects.length === 0 ? (
      <EmptyState />
    ) : (
      <div className="mt-5 space-y-6">
        {sections.map((section) => (
          <section key={section.key}>
            <div className="mb-2 flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${quadrantBadgeClasses(section.quadrant, section.isStubGroup)}`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${quadrantDotClasses(section.quadrant, section.isStubGroup)}`}
                />
                {section.title}
              </span>
              <span className="text-[11px] text-forge-hint">
                {section.projects.length} project
                {section.projects.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
              {section.projects.map((p) => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  onOpen={() => setActiveProjectId(p.id)}
                  onRetry={
                    onRetryCohort
                      ? () => onRetryCohort(p.parentL4ActivityGroupId)
                      : undefined
                  }
                  retryDisabled={Boolean(retryDisabled)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    );

  const Wrapper = bare ? "div" : "section";

  return (
    <>
      <Wrapper
        className={
          bare
            ? ""
            : "rounded-2xl border border-forge-border bg-forge-surface p-5 shadow-card"
        }
      >
        {Header}
        {Body}
      </Wrapper>
      <ProjectBriefDrawer
        project={activeProject}
        onClose={() => setActiveProjectId(null)}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
//   Project card
// ---------------------------------------------------------------------------

function ProjectCard({
  project,
  onOpen,
  onRetry,
  retryDisabled,
}: {
  project: AIProjectResolved;
  onOpen: () => void;
  onRetry?: () => void;
  retryDisabled?: boolean;
}) {
  const redact = useRedactDollars();
  const isStub = project.isStub;
  const agentCount = project.brief?.agents.length ?? 0;
  const integrationCount = project.brief?.digitalCore.integrations.length ?? 0;
  const cardClass = isStub
    ? "border-accent-amber/30 bg-accent-amber/[0.03]"
    : project.isDeprioritized
      ? "border-forge-border bg-forge-surface/70"
      : "border-forge-border bg-forge-surface hover:border-accent-purple/40 hover:shadow-md";

  return (
    <article
      className={`group relative flex flex-col rounded-2xl border p-4 transition ${cardClass}`}
    >
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpen}
              className="inline-flex max-w-full items-center gap-1 truncate text-left text-sm font-semibold text-forge-ink transition hover:text-accent-purple-dark"
            >
              <span className="truncate">{project.name}</span>
              <ExternalLink
                className="h-3.5 w-3.5 flex-shrink-0 text-forge-hint transition group-hover:text-accent-purple"
                aria-hidden
              />
            </button>
            {project.quadrant ? (
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${quadrantBadgeClasses(project.quadrant, false)}`}
              >
                {project.quadrant}
              </span>
            ) : isStub ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-accent-amber/40 bg-accent-amber/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent-amber">
                <AlertTriangle className="h-2.5 w-2.5" aria-hidden /> Stub
              </span>
            ) : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-forge-subtle">
            <span className="rounded-full border border-forge-border bg-forge-well px-1.5 py-0.5 text-forge-body">
              {project.primaryTowerName}
            </span>
            <span className="truncate">
              <span className="text-forge-hint">L4 ·</span>{" "}
              {project.parentL4ActivityGroupName}
            </span>
          </div>
        </div>
      </header>

      <p
        className={`mt-2 text-xs leading-relaxed ${isStub ? "italic text-forge-subtle" : "text-forge-body"}`}
      >
        {project.narrative}
      </p>

      {!isStub && (project.valueRationale || project.effortRationale) ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <RationaleChip
            kind="value"
            bucket={project.valueBucket}
            text={project.valueRationale}
          />
          <RationaleChip
            kind="effort"
            bucket={project.effortBucket}
            text={project.effortRationale}
          />
        </div>
      ) : null}

      <footer className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-forge-border/60 pt-2 text-[11px] text-forge-subtle">
        <div className="flex flex-wrap items-center gap-2">
          {!redact ? (
            <span className="rounded-full border border-forge-border bg-forge-well px-1.5 py-0.5 font-mono tabular-nums text-forge-body">
              {formatUsdCompact(project.attributedAiUsd)}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1">
            <Layers className="h-3 w-3" aria-hidden />
            {project.constituents.length} L5
          </span>
          {!isStub ? (
            <>
              <span className="inline-flex items-center gap-1">
                <Bot className="h-3 w-3" aria-hidden /> {agentCount} agents
              </span>
              <span className="inline-flex items-center gap-1">
                <Network className="h-3 w-3" aria-hidden /> {integrationCount}{" "}
                integrations
              </span>
            </>
          ) : null}
        </div>
        {isStub && onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            disabled={retryDisabled}
            className="inline-flex items-center gap-1 rounded-full border border-accent-amber/40 bg-accent-amber/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent-amber transition hover:bg-accent-amber/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RotateCcw className="h-2.5 w-2.5" aria-hidden /> Retry project
          </button>
        ) : null}
      </footer>
    </article>
  );
}

function RationaleChip({
  kind,
  bucket,
  text,
}: {
  kind: "value" | "effort";
  bucket: AIProjectResolved["valueBucket"];
  text: string;
}) {
  if (!bucket) return null;
  const isHigh = bucket === "High";
  const valueGood = kind === "value" && isHigh;
  const effortGood = kind === "effort" && !isHigh;
  const tone = valueGood || effortGood ? "good" : isHigh ? "warn" : "neutral";
  const toneClasses =
    tone === "good"
      ? "border-accent-green/30 bg-accent-green/5 text-forge-body"
      : tone === "warn"
        ? "border-accent-amber/30 bg-accent-amber/5 text-forge-body"
        : "border-forge-border bg-forge-well text-forge-body";
  return (
    <div
      className={`rounded-lg border px-2 py-1.5 text-[11px] leading-snug ${toneClasses}`}
    >
      <div className="text-[9px] font-semibold uppercase tracking-wider text-forge-subtle">
        {kind === "value" ? "Value" : "Effort"} · {bucket}
      </div>
      <div className="mt-0.5">{text}</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-6 rounded-xl border border-dashed border-forge-border bg-forge-well/40 p-8 text-center">
      <Sparkles
        className="mx-auto h-6 w-6 text-accent-purple-dark/70"
        aria-hidden
      />
      <p className="mt-2 text-sm font-semibold text-forge-ink">
        No AI Projects yet for this scenario.
      </p>
      <p className="mt-1 text-xs text-forge-subtle">
        Either no L4 Activity Groups clear the plan threshold, or you haven&apos;t
        clicked Regenerate yet. Adjust the threshold in Assumptions or click{" "}
        <span className="font-medium text-forge-body">Regenerate plan</span>{" "}
        in the page header.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
//   Section grouping + visual classes
// ---------------------------------------------------------------------------

type Section = {
  key: string;
  title: string;
  quadrant: Quadrant | null;
  isStubGroup: boolean;
  projects: AIProjectResolved[];
};

const QUADRANT_ORDER: { quadrant: Quadrant; title: string }[] = [
  { quadrant: "Quick Win", title: "Quick Wins · High value × Low effort" },
  { quadrant: "Strategic Bet", title: "Strategic Bets · High value × High effort" },
  { quadrant: "Fill-in", title: "Fill-ins · Low value × Low effort" },
  { quadrant: "Deprioritize", title: "Deprioritize · Low value × High effort" },
];

function groupByQuadrant(projects: AIProjectResolved[]): Section[] {
  const sections: Section[] = [];
  for (const def of QUADRANT_ORDER) {
    const inSection = projects.filter(
      (p) => !p.isStub && p.quadrant === def.quadrant,
    );
    if (inSection.length > 0) {
      sections.push({
        key: def.quadrant,
        title: def.title,
        quadrant: def.quadrant,
        isStubGroup: false,
        projects: inSection,
      });
    }
  }
  const stubs = projects.filter((p) => p.isStub);
  if (stubs.length > 0) {
    sections.push({
      key: "stub",
      title: "Generation pending",
      quadrant: null,
      isStubGroup: true,
      projects: stubs,
    });
  }
  return sections;
}

function quadrantBadgeClasses(
  q: Quadrant | null,
  isStub: boolean,
): string {
  if (isStub) return "border-accent-amber/40 bg-accent-amber/10 text-accent-amber";
  switch (q) {
    case "Quick Win":
      return "border-accent-green/40 bg-accent-green/10 text-accent-green";
    case "Strategic Bet":
      return "border-accent-purple/40 bg-accent-purple/10 text-accent-purple-dark";
    case "Fill-in":
      return "border-accent-teal/40 bg-accent-teal/10 text-accent-teal";
    case "Deprioritize":
      return "border-accent-red/30 bg-accent-red/5 text-accent-red";
    default:
      return "border-forge-border bg-forge-well text-forge-subtle";
  }
}

function quadrantDotClasses(q: Quadrant | null, isStub: boolean): string {
  if (isStub) return "bg-accent-amber";
  switch (q) {
    case "Quick Win":
      return "bg-accent-green";
    case "Strategic Bet":
      return "bg-accent-purple";
    case "Fill-in":
      return "bg-accent-teal";
    case "Deprioritize":
      return "bg-accent-red";
    default:
      return "bg-forge-hint";
  }
}
