"use client";

import * as React from "react";
import { ChevronRight, Sparkles } from "lucide-react";
import type {
  AIProjectResolved,
  Quadrant,
} from "@/lib/cross-tower/aiProjects";
import { formatUsdCompact } from "@/lib/format";
import { useRedactDollars } from "@/lib/clientMode";

/**
 * Value × Effort 2×2 list view.
 *
 *                            ┌─────────────────────────────────┐
 *           High value       │  Strategic Bet  │   Quick Win   │
 *                            ├─────────────────┼───────────────┤
 *           Low value        │  Deprioritize   │   Fill-in     │
 *                            └─────────────────────────────────┘
 *                              High effort         Low effort
 *
 * Each quadrant is a card listing the AI Projects scored into it. We render
 * project NAMES as clickable rows (not bubbles) so labels never overlap and
 * the unit of analysis is obvious. Click a project name to open its 4-lens
 * brief drawer. Stubs are filtered out — they have no quadrant yet.
 */

type QuadrantConfig = {
  hint: string;
  toneText: string;
  toneBg: string;
  toneBorder: string;
};

const QUADRANT_CONFIG: Record<Quadrant, QuadrantConfig> = {
  "Strategic Bet": {
    hint: "High value · High effort",
    toneText: "text-accent-purple-dark",
    toneBg: "bg-accent-purple/[0.06]",
    toneBorder: "border-accent-purple/30",
  },
  "Quick Win": {
    hint: "High value · Low effort",
    toneText: "text-accent-green",
    toneBg: "bg-accent-green/[0.07]",
    toneBorder: "border-accent-green/30",
  },
  "Deprioritize": {
    hint: "Low value · High effort",
    toneText: "text-accent-red",
    toneBg: "bg-accent-red/[0.06]",
    toneBorder: "border-accent-red/30",
  },
  "Fill-in": {
    hint: "Low value · Low effort",
    toneText: "text-accent-teal",
    toneBg: "bg-accent-teal/[0.06]",
    toneBorder: "border-accent-teal/30",
  },
};

// Render order across the 2×2 grid (top-left → top-right → bottom-left → bottom-right).
const QUADRANT_ORDER: Quadrant[] = [
  "Strategic Bet",
  "Quick Win",
  "Deprioritize",
  "Fill-in",
];

export function ValueEffortMatrix({
  projects,
  onSelect,
  bare,
}: {
  projects: AIProjectResolved[];
  onSelect?: (project: AIProjectResolved) => void;
  bare?: boolean;
}) {
  const redact = useRedactDollars();
  const scored = projects.filter((p) => !p.isStub && p.quadrant !== null);

  // Bucket by quadrant, preserving $-desc order within each quadrant so the
  // largest-prize project sits at the top of its list.
  const grouped = React.useMemo(() => {
    const map: Record<Quadrant, AIProjectResolved[]> = {
      "Strategic Bet": [],
      "Quick Win": [],
      "Deprioritize": [],
      "Fill-in": [],
    };
    for (const p of scored) {
      if (p.quadrant) map[p.quadrant].push(p);
    }
    for (const q of QUADRANT_ORDER) {
      map[q].sort((a, b) => b.attributedAiUsd - a.attributedAiUsd);
    }
    return map;
  }, [scored]);

  const Header = (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-lg font-semibold text-forge-ink">
          <span className="font-mono text-accent-purple-dark">&gt;</span> Value
          × Effort 2×2
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-forge-subtle">
          Portfolio view: each project{"'"}s bucket is set by a median split across
          the program. Value uses the modeled L4 prize; effort uses the
          GPT-5.5-authored brief signals (complexity, integrations, agents,
          proven elsewhere). Rationales remain GPT-5.5-authored. Click a
          project name to open its 4-lens brief.
        </p>
      </div>
      <span className="inline-flex items-center gap-1 rounded-full border border-accent-purple/30 bg-accent-purple/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-accent-purple-dark">
        <Sparkles className="h-2.5 w-2.5" aria-hidden /> AI-authored scoring
      </span>
    </header>
  );

  const Body =
    scored.length === 0 ? (
      <div className="mt-4 rounded-xl border border-dashed border-forge-border bg-forge-well/40 p-8 text-center text-sm text-forge-subtle">
        No scored projects yet. Click Regenerate plan to populate the matrix.
      </div>
    ) : (
      <div className="mt-5 space-y-3">
        <AxisLabels />
        <div className="grid gap-3 md:grid-cols-2">
          {QUADRANT_ORDER.map((q) => (
            <QuadrantCard
              key={q}
              quadrant={q}
              projects={grouped[q]}
              onSelect={onSelect}
              redact={redact}
            />
          ))}
        </div>
      </div>
    );

  if (bare) {
    return (
      <div>
        {Header}
        {Body}
      </div>
    );
  }
  return (
    <section className="rounded-2xl border border-forge-border bg-forge-surface p-5 shadow-card">
      {Header}
      {Body}
    </section>
  );
}

// ---------------------------------------------------------------------------
//   Axis hint strip
// ---------------------------------------------------------------------------

function AxisLabels() {
  return (
    <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-forge-subtle">
      <span>↑ High value · ← High effort</span>
      <span>Low value ↓ · Low effort →</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
//   Quadrant card with clickable project rows
// ---------------------------------------------------------------------------

function QuadrantCard({
  quadrant,
  projects,
  onSelect,
  redact,
}: {
  quadrant: Quadrant;
  projects: AIProjectResolved[];
  onSelect?: (p: AIProjectResolved) => void;
  redact: boolean;
}) {
  const cfg = QUADRANT_CONFIG[quadrant];
  return (
    <div
      className={`flex flex-col rounded-xl border ${cfg.toneBorder} ${cfg.toneBg}`}
    >
      <header className="flex items-baseline justify-between gap-2 border-b border-forge-border/40 px-4 py-3">
        <div className="flex items-baseline gap-2">
          <h3
            className={`font-display text-sm font-semibold uppercase tracking-wider ${cfg.toneText}`}
          >
            {quadrant}
          </h3>
          <span className="font-mono text-[10px] text-forge-subtle">
            {projects.length}
          </span>
        </div>
        <span className="text-[10px] uppercase tracking-wider text-forge-subtle">
          {cfg.hint}
        </span>
      </header>

      {projects.length === 0 ? (
        <div className="px-4 py-5 text-center text-xs text-forge-subtle">
          No projects scored here.
        </div>
      ) : (
        <ul className="divide-y divide-forge-border/40">
          {projects.map((p) => (
            <li key={p.id}>
              <ProjectRow project={p} onSelect={onSelect} redact={redact} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ProjectRow({
  project,
  onSelect,
  redact,
}: {
  project: AIProjectResolved;
  onSelect?: (p: AIProjectResolved) => void;
  redact: boolean;
}) {
  const interactive = typeof onSelect === "function";
  const Tag = interactive ? "button" : "div";
  return (
    <Tag
      type={interactive ? "button" : undefined}
      onClick={interactive ? () => onSelect!(project) : undefined}
      className={`group flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition ${
        interactive
          ? "cursor-pointer hover:bg-forge-well/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-purple/40"
          : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-1.5">
          <span
            className={`truncate text-sm font-medium text-forge-ink ${
              interactive ? "group-hover:text-accent-purple-dark" : ""
            }`}
          >
            {project.name}
          </span>
          {interactive ? (
            <ChevronRight
              className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-forge-hint transition group-hover:translate-x-0.5 group-hover:text-accent-purple-dark"
              aria-hidden
            />
          ) : null}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-forge-subtle">
          <span className="truncate">{project.primaryTowerName}</span>
          <span className="text-forge-hint">·</span>
          <span className="truncate">{project.parentL4ActivityGroupName}</span>
        </div>
      </div>
      {!redact && project.attributedAiUsd > 0 ? (
        <span
          className="flex-shrink-0 self-center font-mono text-[11px] tabular-nums text-forge-body"
          aria-label="Modeled L4 prize"
        >
          {formatUsdCompact(project.attributedAiUsd, { decimals: 1 })}
        </span>
      ) : null}
    </Tag>
  );
}
