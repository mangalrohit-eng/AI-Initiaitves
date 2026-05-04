"use client";

import * as React from "react";
import {
  ChevronDown,
  ChevronRight,
  Download,
  GitBranch,
  Grid2x2,
  Info,
  Layers,
  Sparkles,
} from "lucide-react";
import type { AIProjectResolved } from "@/lib/cross-tower/aiProjects";
import type { ProgramInitiativeRow, SelectProgramResult } from "@/lib/initiatives/selectProgram";
import { formatUsdCompact } from "@/lib/format";
import { useRedactDollars } from "@/lib/clientMode";

/**
 * Lineage tab — explains how the program substrate becomes AI Projects.
 *
 * The cross-tower page replaces the legacy per-L5 "key initiative" surface
 * with one **AI Project per L4 Activity Group**. The grouping itself is
 * deterministic (engine-owned), and the LLM authors:
 *
 *   - Project narrative + 4-lens brief (the "what we're building").
 *   - Per-L5 inclusion rationale (the "why this use case is part of the
 *     project").
 *
 * The Lineage tab gives the executive two complementary views of that
 * mapping:
 *
 *   1. **Tree view** — collapsible AI Project rows with their constituent
 *      L5 initiatives nested beneath. The default "consulting deck" view.
 *   2. **Matrix view** — flat row-per-L5 grid that's easy to scan, sort,
 *      and export to CSV for client distribution.
 *
 * Plus a "below the line" footer surfacing the L5 initiatives the program
 * substrate already excluded — either dropped by the 2x2 (Deprioritized)
 * or below the L4 Activity Group `$` threshold from the Assumptions tab.
 * This is the audit trail for "where did all the L5s go?".
 */

type LineageTabProps = {
  /** All resolved AI Projects (incl. stubs) — the head of the lineage chain. */
  projects: AIProjectResolved[];
  /**
   * The program substrate the projects were composed against. We surface its
   * `deprioritized` and `threshold.excludedCount` data so the footer can
   * explain why some L5s aren't represented above.
   */
  program: SelectProgramResult;
  /** Click-through to open the project's brief drawer (e.g. from a row). */
  onOpenProject?: (project: AIProjectResolved) => void;
};

type ViewMode = "tree" | "matrix";

export function LineageTab({ projects, program, onOpenProject }: LineageTabProps) {
  const [view, setView] = React.useState<ViewMode>("tree");
  const redact = useRedactDollars();

  const inPlanL5Count = projects.reduce(
    (s, p) => s + p.constituentInitiativeIds.length,
    0,
  );
  const totalAiUsd = projects.reduce((s, p) => s + p.attributedAiUsd, 0);
  const towersInScope = new Set(projects.map((p) => p.primaryTowerId)).size;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-forge-ink">
            <span className="font-mono text-accent-purple-dark">&gt;</span>{" "}
            Lineage — L5 initiatives → AI Projects
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-forge-subtle">
            Every AI Project is structurally one L4 Activity Group. Constituent
            L5 use cases are the deterministic substrate; their inclusion
            rationale is GPT-5.5 authored against the project{"'"}s own 4-lens
            brief.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ViewToggle view={view} onChange={setView} />
          <CsvExport projects={projects} redact={redact} />
        </div>
      </header>

      <SummaryStrip
        projectCount={projects.length}
        liveCount={projects.filter((p) => !p.isStub).length}
        l5Count={inPlanL5Count}
        towers={towersInScope}
        totalAiUsd={totalAiUsd}
        redact={redact}
      />

      {view === "tree" ? (
        <TreeView
          projects={projects}
          onOpenProject={onOpenProject}
          redact={redact}
        />
      ) : (
        <MatrixView
          projects={projects}
          onOpenProject={onOpenProject}
          redact={redact}
        />
      )}

      <BelowTheLineFooter program={program} redact={redact} />
    </div>
  );
}

// ===========================================================================
//   View toggle + summary
// ===========================================================================

function ViewToggle({
  view,
  onChange,
}: {
  view: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  return (
    <div
      className="inline-flex items-center rounded-lg border border-forge-border bg-forge-surface p-0.5 text-xs"
      role="tablist"
    >
      <button
        type="button"
        role="tab"
        aria-selected={view === "tree"}
        onClick={() => onChange("tree")}
        className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition ${
          view === "tree"
            ? "bg-accent-purple/10 text-accent-purple-dark"
            : "text-forge-subtle hover:text-forge-ink"
        }`}
      >
        <GitBranch className="h-3.5 w-3.5" aria-hidden /> Tree
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={view === "matrix"}
        onClick={() => onChange("matrix")}
        className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition ${
          view === "matrix"
            ? "bg-accent-purple/10 text-accent-purple-dark"
            : "text-forge-subtle hover:text-forge-ink"
        }`}
      >
        <Grid2x2 className="h-3.5 w-3.5" aria-hidden /> Matrix
      </button>
    </div>
  );
}

function SummaryStrip({
  projectCount,
  liveCount,
  l5Count,
  towers,
  totalAiUsd,
  redact,
}: {
  projectCount: number;
  liveCount: number;
  l5Count: number;
  towers: number;
  totalAiUsd: number;
  redact: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 rounded-2xl border border-forge-border bg-forge-surface p-4 md:grid-cols-4">
      <SummaryStat label="AI Projects" value={`${projectCount}`} hint={`${liveCount} authored`} />
      <SummaryStat label="L5 initiatives" value={`${l5Count}`} hint="Constituent use cases" />
      <SummaryStat label="Towers in scope" value={`${towers}`} hint="Cross-tower coverage" />
      <SummaryStat
        label="Modeled $ in plan"
        value={redact ? "—" : formatUsdCompact(totalAiUsd)}
        hint="Sum of L4 Activity Group prizes"
      />
    </div>
  );
}

function SummaryStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-forge-subtle">
        {label}
      </div>
      <div className="mt-1 font-mono text-lg font-semibold text-forge-ink">{value}</div>
      <div className="mt-0.5 text-[11px] text-forge-subtle">{hint}</div>
    </div>
  );
}

// ===========================================================================
//   Tree view
// ===========================================================================

function TreeView({
  projects,
  onOpenProject,
  redact,
}: {
  projects: AIProjectResolved[];
  onOpenProject?: (p: AIProjectResolved) => void;
  redact: boolean;
}) {
  // Group by tower for visual organization — keeps the "same tower" projects
  // together, which is how an executive scans on this surface.
  const byTower = React.useMemo(() => {
    const map = new Map<string, AIProjectResolved[]>();
    for (const p of projects) {
      const arr = map.get(p.primaryTowerName) ?? [];
      arr.push(p);
      map.set(p.primaryTowerName, arr);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [projects]);

  if (projects.length === 0) {
    return (
      <EmptyState message="No AI Projects yet. Click Regenerate plan to build the lineage." />
    );
  }

  return (
    <div className="space-y-5">
      {byTower.map(([towerName, list]) => (
        <section
          key={towerName}
          className="rounded-2xl border border-forge-border bg-forge-surface"
        >
          <header className="flex items-center justify-between border-b border-forge-border px-4 py-2.5">
            <div className="flex items-center gap-2">
              <Layers className="h-3.5 w-3.5 text-accent-purple-dark" aria-hidden />
              <span className="font-display text-sm font-semibold text-forge-ink">
                {towerName}
              </span>
              <span className="rounded-full border border-forge-border bg-forge-well px-2 py-0.5 font-mono text-[10px] text-forge-subtle">
                {list.length} project{list.length === 1 ? "" : "s"}
              </span>
            </div>
          </header>
          <ul className="divide-y divide-forge-border">
            {list.map((project) => (
              <ProjectTreeRow
                key={project.id}
                project={project}
                onOpenProject={onOpenProject}
                redact={redact}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function ProjectTreeRow({
  project,
  onOpenProject,
  redact,
}: {
  project: AIProjectResolved;
  onOpenProject?: (p: AIProjectResolved) => void;
  redact: boolean;
}) {
  const [open, setOpen] = React.useState(true);
  const rationaleById = new Map(
    project.perInitiativeRationale.map((r) => [r.initiativeId, r.rationale]),
  );

  return (
    <li className="px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-0.5 flex-shrink-0 rounded-md p-1 text-forge-subtle transition hover:bg-forge-well hover:text-forge-ink"
          aria-label={open ? "Collapse" : "Expand"}
        >
          {open ? (
            <ChevronDown className="h-4 w-4" aria-hidden />
          ) : (
            <ChevronRight className="h-4 w-4" aria-hidden />
          )}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <button
              type="button"
              onClick={() => onOpenProject?.(project)}
              className="text-left font-display text-sm font-semibold text-forge-ink transition hover:text-accent-purple-dark"
            >
              {project.name}
            </button>
            {project.quadrant && (
              <QuadrantPill quadrant={project.quadrant} />
            )}
            {project.isStub && (
              <span className="inline-flex items-center gap-1 rounded-full border border-accent-amber/40 bg-accent-amber/5 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-accent-amber">
                Pending generation
              </span>
            )}
          </div>
          <div className="mt-0.5 text-[11px] text-forge-subtle">
            <span className="font-medium text-forge-body">L4: </span>
            {project.parentL4ActivityGroupName}
            <span className="mx-1.5 text-forge-hint">·</span>
            <span className="font-mono">
              {redact
                ? "—"
                : formatUsdCompact(project.attributedAiUsd)}
            </span>
            <span className="mx-1.5 text-forge-hint">·</span>
            {project.constituentInitiativeIds.length} L5
            {project.constituentInitiativeIds.length === 1 ? "" : "s"}
          </div>
        </div>
      </div>
      {open && (
        <ul className="mt-3 ml-7 space-y-2 border-l border-dashed border-forge-border pl-4">
          {project.constituents.length === 0 ? (
            <li className="text-[11px] italic text-forge-subtle">
              No constituent L5 initiatives resolved.
            </li>
          ) : (
            project.constituents.map((l5) => (
              <ConstituentRow
                key={l5.id}
                l5={l5}
                rationale={rationaleById.get(l5.id)}
              />
            ))
          )}
        </ul>
      )}
    </li>
  );
}

function ConstituentRow({
  l5,
  rationale,
}: {
  l5: ProgramInitiativeRow;
  rationale: string | undefined;
}) {
  return (
    <li className="rounded-lg border border-forge-border bg-forge-well/30 p-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <div className="text-sm font-medium text-forge-ink">{l5.name}</div>
      </div>
      <div className="mt-0.5 text-[11px] text-forge-subtle">
        {l5.l2Name}
        <span className="mx-1.5 text-forge-hint">·</span>
        {l5.l3Name}
        <span className="mx-1.5 text-forge-hint">·</span>
        <span className="font-mono">{l5.programTier}</span>
      </div>
      {rationale ? (
        <div className="mt-1.5 flex items-start gap-1.5 text-[11px] text-forge-body">
          <Sparkles
            className="mt-0.5 h-3 w-3 flex-shrink-0 text-accent-purple-dark"
            aria-hidden
          />
          <span>{rationale}</span>
        </div>
      ) : (
        <div className="mt-1.5 text-[10px] italic text-forge-hint">
          Inclusion rationale pending plan generation.
        </div>
      )}
    </li>
  );
}

// ===========================================================================
//   Matrix view
// ===========================================================================

type MatrixRow = {
  l5Id: string;
  l5Name: string;
  towerName: string;
  l3Name: string;
  l4ActivityGroup: string;
  projectName: string;
  quadrant: string;
  programTier: string;
  rationale: string;
  isStub: boolean;
  project: AIProjectResolved;
};

function buildMatrixRows(projects: AIProjectResolved[]): MatrixRow[] {
  const rows: MatrixRow[] = [];
  for (const project of projects) {
    const rationaleById = new Map(
      project.perInitiativeRationale.map((r) => [r.initiativeId, r.rationale]),
    );
    for (const l5 of project.constituents) {
      rows.push({
        l5Id: l5.id,
        l5Name: l5.name,
        towerName: l5.towerName,
        l3Name: l5.l3Name,
        l4ActivityGroup: project.parentL4ActivityGroupName,
        projectName: project.name,
        quadrant: project.quadrant ?? "—",
        programTier: l5.programTier,
        rationale: rationaleById.get(l5.id) ?? "",
        isStub: project.isStub,
        project,
      });
    }
  }
  return rows;
}

function MatrixView({
  projects,
  onOpenProject,
  redact,
}: {
  projects: AIProjectResolved[];
  onOpenProject?: (p: AIProjectResolved) => void;
  redact: boolean;
}) {
  const rows = React.useMemo(() => buildMatrixRows(projects), [projects]);
  if (rows.length === 0) {
    return <EmptyState message="No AI Projects yet. Click Regenerate plan to populate the matrix." />;
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-forge-border bg-forge-surface">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-left text-xs">
          <thead className="bg-forge-well/40 text-[10px] font-semibold uppercase tracking-wider text-forge-subtle">
            <tr>
              <th className="px-3 py-2.5">Tower</th>
              <th className="px-3 py-2.5">L3 Job Family</th>
              <th className="px-3 py-2.5">L4 Activity Group</th>
              <th className="px-3 py-2.5">L5 Initiative</th>
              <th className="px-3 py-2.5">Project</th>
              <th className="px-3 py-2.5">Quadrant</th>
              <th className="px-3 py-2.5">Tier</th>
              <th className="px-3 py-2.5 text-right">L4 modeled AI $</th>
              <th className="px-3 py-2.5">Rationale</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-forge-border">
            {rows.map((row) => (
              <tr
                key={row.l5Id}
                className="transition hover:bg-forge-well/30"
              >
                <td className="px-3 py-2.5 align-top text-forge-body">{row.towerName}</td>
                <td className="px-3 py-2.5 align-top text-forge-body">{row.l3Name}</td>
                <td className="px-3 py-2.5 align-top text-forge-body">{row.l4ActivityGroup}</td>
                <td className="px-3 py-2.5 align-top font-medium text-forge-ink">{row.l5Name}</td>
                <td className="px-3 py-2.5 align-top">
                  <button
                    type="button"
                    onClick={() => onOpenProject?.(row.project)}
                    className="text-left font-medium text-forge-ink transition hover:text-accent-purple-dark"
                  >
                    {row.projectName}
                  </button>
                  {row.isStub && (
                    <div className="mt-0.5 text-[10px] italic text-accent-amber">
                      Pending generation
                    </div>
                  )}
                </td>
                <td className="px-3 py-2.5 align-top">
                  {row.quadrant === "—" ? (
                    <span className="text-forge-hint">—</span>
                  ) : (
                    <QuadrantPill quadrant={row.quadrant as MatrixRow["quadrant"]} />
                  )}
                </td>
                <td className="px-3 py-2.5 align-top">
                  <span className="font-mono text-[11px] text-forge-body">
                    {row.programTier}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right align-top">
                  <span className="font-mono text-forge-body">
                    {redact ? "—" : formatUsdCompact(row.project.attributedAiUsd)}
                  </span>
                </td>
                <td className="px-3 py-2.5 align-top text-[11px] text-forge-body">
                  {row.rationale ? (
                    row.rationale
                  ) : (
                    <span className="italic text-forge-hint">
                      Pending plan generation.
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ===========================================================================
//   Below-the-line footer
// ===========================================================================

function BelowTheLineFooter({
  program,
  redact,
}: {
  program: SelectProgramResult;
  redact: boolean;
}) {
  const dep = program.deprioritized;
  const depUsd = dep.reduce((s, r) => s + r.attributedAiUsd, 0);
  const threshold = program.threshold;
  const hasAny = dep.length > 0 || threshold.excludedCount > 0;

  if (!hasAny) {
    return (
      <section className="rounded-2xl border border-forge-border bg-forge-surface p-5 text-xs text-forge-subtle">
        <div className="flex items-start gap-2">
          <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-accent-teal" aria-hidden />
          <span>
            No L5 initiatives are excluded from this plan — every Versant
            activity above $0 contributed at least one L5 to an AI Project.
          </span>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-forge-border bg-forge-surface">
      <header className="border-b border-forge-border px-5 py-3">
        <h3 className="font-display text-sm font-semibold text-forge-ink">
          Below the line — L5 initiatives not in this plan
        </h3>
        <p className="mt-1 text-[11px] text-forge-subtle">
          Two exclusion paths run on the program substrate before AI Projects
          are formed: the 2x2 (feasibility × business impact) and the L4
          Activity Group $ threshold from Assumptions. Surface both here so
          the audit trail stays defensible.
        </p>
      </header>
      <div className="grid gap-0 md:grid-cols-2">
        <div className="border-b border-forge-border p-5 md:border-b-0 md:border-r">
          <div className="flex items-baseline justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-accent-red">
              Deprioritized by 2x2
            </h4>
            <span className="font-mono text-[11px] text-forge-subtle">
              {dep.length} L5{dep.length === 1 ? "" : "s"} ·{" "}
              {redact ? "—" : formatUsdCompact(depUsd)}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-forge-subtle">
            Low feasibility AND parent-L4 Activity Group prize below
            max(median, $1M floor). These don{"'"}t resurface unless the
            assessment changes.
          </p>
          {dep.length > 0 && (
            <details className="mt-3 text-xs">
              <summary className="cursor-pointer text-forge-body hover:text-forge-ink">
                Inspect rows
              </summary>
              <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto pr-1">
                {dep.slice(0, 50).map((r) => (
                  <li
                    key={r.id}
                    className="flex items-baseline justify-between gap-2 rounded border border-forge-border bg-forge-well/30 px-2 py-1.5"
                  >
                    <span className="truncate text-forge-body">{r.name}</span>
                    <span className="flex-shrink-0 font-mono text-[10px] text-forge-subtle">
                      {r.towerName}
                    </span>
                  </li>
                ))}
                {dep.length > 50 && (
                  <li className="text-[10px] italic text-forge-hint">
                    + {dep.length - 50} more
                  </li>
                )}
              </ul>
            </details>
          )}
        </div>
        <div className="p-5">
          <div className="flex items-baseline justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-accent-amber">
              Below threshold
            </h4>
            <span className="font-mono text-[11px] text-forge-subtle">
              {threshold.excludedCount} L5
              {threshold.excludedCount === 1 ? "" : "s"} ·{" "}
              {redact ? "—" : formatUsdCompact(threshold.excludedAiUsd)}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-forge-subtle">
            Parent L4 Activity Group prize fell below the dollar threshold
            ({redact ? "—" : formatUsdCompact(threshold.aiUsdThreshold)}).
            Lower the threshold in Assumptions to bring these back into the
            plan.
          </p>
          {threshold.excludedTowerCount > 0 && (
            <p className="mt-2 text-[11px] text-forge-subtle">
              <span className="font-medium text-accent-amber">
                {threshold.excludedTowerCount} tower
                {threshold.excludedTowerCount === 1 ? "" : "s"}
              </span>{" "}
              lost their last in-plan initiative because of the threshold.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

// ===========================================================================
//   CSV export
// ===========================================================================

function CsvExport({
  projects,
  redact,
}: {
  projects: AIProjectResolved[];
  redact: boolean;
}) {
  const onClick = () => {
    if (typeof window === "undefined") return;
    const rows = buildMatrixRows(projects);
    const headers = [
      "Tower",
      "L3 Job Family",
      "L4 Activity Group",
      "L5 Initiative",
      "Project",
      "Quadrant",
      "Tier",
      "L4 modeled AI USD",
      "Rationale",
    ];
    const body = rows.map((r) => [
      csv(r.towerName),
      csv(r.l3Name),
      csv(r.l4ActivityGroup),
      csv(r.l5Name),
      csv(r.projectName),
      csv(r.quadrant),
      csv(r.programTier),
      redact ? "—" : `${Math.round(r.project.attributedAiUsd)}`,
      csv(r.rationale),
    ]);
    const text = [headers.join(","), ...body.map((row) => row.join(","))].join(
      "\n",
    );
    const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const ts = new Date().toISOString().slice(0, 10);
    a.download = `versant-ai-plan-lineage-${ts}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={projects.length === 0}
      className="inline-flex items-center gap-1.5 rounded-lg border border-forge-border bg-forge-surface px-2.5 py-1.5 text-xs text-forge-body transition hover:border-accent-purple/40 hover:text-accent-purple-dark disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Download className="h-3.5 w-3.5" aria-hidden /> Export CSV
    </button>
  );
}

function csv(value: string): string {
  if (value == null) return "";
  const needsQuote = /[",\n]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuote ? `"${escaped}"` : escaped;
}

// ===========================================================================
//   Shared visual primitives
// ===========================================================================

const QUADRANT_TONE: Record<string, { bg: string; text: string }> = {
  "Quick Win": { bg: "bg-accent-green/10 border-accent-green/30", text: "text-accent-green" },
  "Strategic Bet": { bg: "bg-accent-purple/10 border-accent-purple/30", text: "text-accent-purple-dark" },
  "Fill-in": { bg: "bg-accent-teal/10 border-accent-teal/30", text: "text-accent-teal" },
  "Deprioritize": { bg: "bg-accent-red/10 border-accent-red/30", text: "text-accent-red" },
};

function QuadrantPill({ quadrant }: { quadrant: string }) {
  const tone = QUADRANT_TONE[quadrant] ?? {
    bg: "bg-forge-well border-forge-border",
    text: "text-forge-subtle",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${tone.bg} ${tone.text}`}
    >
      {quadrant}
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-forge-border bg-forge-well/40 p-10 text-center text-sm text-forge-subtle">
      {message}
    </div>
  );
}
