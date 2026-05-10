"use client";

import * as React from "react";
import Link from "next/link";
import {
  Sparkles,
  Layers,
  AlertTriangle,
  ExternalLink,
  Building2,
} from "lucide-react";
import type {
  AIProjectResolved,
  Quadrant,
} from "@/lib/cross-tower/aiProjects";
import { formatUsdCompact } from "@/lib/format";
import { useRedactDollars } from "@/lib/clientMode";

/**
 * AI Solutions card grid for the Cross-Tower AI Plan page.
 *
 * Each card represents one curated `L3Initiative` AI Solution (one per
 * L3 Job Family row). Cards are grouped by Value × Effort quadrant
 * (Quick Win → Strategic Bet → Fill-in → Deprioritize) so the
 * executive's eye lands on the highest-leverage initiatives first.
 *
 * Card surfaces (deterministic):
 *   - Solution name + tagline (LLM-curated upstream).
 *   - Tower chip + L3 Job Family chip.
 *   - Modeled $ chip (the row's even-split AI $).
 *   - Quadrant + program tier badge.
 *   - Vendor + feasibility chips when present.
 *   - "Open initiative" → deep-dive page that lazily generates the
 *     full four-lens brief on first click.
 *
 * Card surfaces (LLM-overlaid synthesis, when present):
 *   - 1-2 sentence cross-tower narrative.
 *   - Value / Effort buckets + rationales authored by program synthesis.
 */

export function AIProjectsModule({
  projects,
  bare,
}: {
  projects: AIProjectResolved[];
  bare?: boolean;
}) {
  const sections = React.useMemo(() => groupByQuadrant(projects), [projects]);

  const Header = (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-lg font-semibold text-forge-ink">
          <span className="font-mono text-accent-purple-dark">&gt;</span>{" "}
          AI Solutions across the program
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-forge-subtle">
          One card per curated AI Solution — sourced directly from each
          tower&apos;s L3 Job Family roster. Quadrant assignment, modeled $,
          and program tier are deterministic; the cross-tower narrative is
          authored by the Versant model. Click any card to open the full
          four-lens brief.
        </p>
      </div>
      {projects.length > 0 ? (
        <div className="flex items-center gap-2 text-xs text-forge-subtle">
          <Layers className="h-3.5 w-3.5" aria-hidden />
          <span className="font-mono text-forge-body">{projects.length}</span>{" "}
          solutions ·{" "}
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
                {section.projects.length} solution
                {section.projects.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
              {section.projects.map((p) => (
                <ProjectCard key={p.id} project={p} />
              ))}
            </div>
          </section>
        ))}
      </div>
    );

  const Wrapper = bare ? "div" : "section";

  return (
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
  );
}

// ---------------------------------------------------------------------------
//   Project card
// ---------------------------------------------------------------------------

function ProjectCard({ project }: { project: AIProjectResolved }) {
  const redact = useRedactDollars();
  const isStub = project.isStub;
  const cardClass = isStub
    ? "border-accent-amber/30 bg-accent-amber/[0.03]"
    : project.isDeprioritized
      ? "border-forge-border bg-forge-surface/70"
      : "border-forge-border bg-forge-surface hover:border-accent-purple/40 hover:shadow-md";

  const title = (
    <span className="truncate">{project.name}</span>
  );

  // Headline: prefer the LLM cross-tower narrative when available; fall back
  // to the deterministic AI rationale.
  const headlineText = project.narrative;
  const taglineText = project.tagline;

  const hasDeepDive = Boolean(project.deepDiveHref);

  return (
    <article
      className={`group relative flex flex-col rounded-2xl border p-4 transition ${cardClass}`}
    >
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {hasDeepDive && project.deepDiveHref ? (
              <Link
                href={project.deepDiveHref}
                className="inline-flex max-w-full items-center gap-1 truncate text-left text-sm font-semibold text-forge-ink transition hover:text-accent-purple-dark"
              >
                {title}
                <ExternalLink
                  className="h-3.5 w-3.5 flex-shrink-0 text-forge-hint transition group-hover:text-accent-purple"
                  aria-hidden
                />
              </Link>
            ) : (
              <span className="inline-flex max-w-full items-center gap-1 truncate text-left text-sm font-semibold text-forge-ink">
                {title}
              </span>
            )}
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
              <span className="text-forge-hint">Job Family ·</span>{" "}
              {project.l3FamilyName ?? project.parentL4ActivityGroupName}
            </span>
          </div>
        </div>
      </header>

      {taglineText ? (
        <p className="mt-2 text-xs leading-relaxed text-forge-body">
          {taglineText}
        </p>
      ) : null}

      <p
        className={`mt-2 text-xs leading-relaxed ${isStub ? "italic text-forge-subtle" : "text-forge-subtle"}`}
      >
        {headlineText}
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
          {project.feasibility ? (
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 font-medium ${
                project.feasibility === "High"
                  ? "border-accent-green/40 bg-accent-green/5 text-accent-green"
                  : "border-accent-amber/40 bg-accent-amber/5 text-accent-amber"
              }`}
              title="Curator-stamped binary ship-readiness"
            >
              <span className="font-mono">FE</span>
              {project.feasibility}
            </span>
          ) : null}
          {project.primaryVendor ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-forge-border bg-forge-well px-1.5 py-0.5">
              <Building2 className="h-3 w-3" aria-hidden />
              {project.primaryVendor}
            </span>
          ) : null}
        </div>
        {hasDeepDive && project.deepDiveHref ? (
          <Link
            href={project.deepDiveHref}
            className="inline-flex items-center gap-1 rounded-full border border-accent-purple/30 bg-accent-purple/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent-purple-dark transition hover:bg-accent-purple/15"
          >
            Open initiative
            <ExternalLink className="h-2.5 w-2.5" aria-hidden />
          </Link>
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
  if (!bucket || !text) return null;
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
        No AI Solutions in plan yet.
      </p>
      <p className="mt-1 text-xs text-forge-subtle">
        Either no L3 Job Family rows clear the plan threshold, or no AI
        Solutions have been curated yet. Curate AI Solutions on each tower
        page (Step 4 of the workshop) and revisit this view; adjust the
        threshold in{" "}
        <span className="font-medium text-forge-body">Assumptions</span> to
        include lower-prize Job Family rows.
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
