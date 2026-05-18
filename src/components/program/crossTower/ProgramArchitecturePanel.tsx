"use client";

import * as React from "react";
import { Cpu, Database, Network, Sparkles, Workflow } from "lucide-react";
import type { AIProjectResolved } from "@/lib/cross-tower/aiProjects";
import type { ProgramSynthesisLLMV6 } from "@/lib/cross-tower/composeProjectsV6";
import { getAssessProgram, subscribe } from "@/lib/localStore";
import {
  buildProgramWideTowerIntakeDigest,
  TOWER_READINESS_ATTRIBUTION_LABEL,
} from "@/lib/assess/towerReadinessIntake";

/**
 * Cross-Tower AI Plan — program architecture surfaces.
 *
 * Split into two independently exported components so the consolidated tab
 * layout can place each in its natural home:
 *
 *   - `ProgramArchitectureNarratives` — three LLM-authored narrative blocks
 *     (orchestration & delivery / vendor stack / data + digital core).
 *     Lives on the Cross-tower outcomes tab alongside Outcome Clusters and
 *     Orchestration & Data Layer.
 *
 *   - `ProgramArchitectureRollups` — three deterministic rollups derived
 *     from the resolved project set (vendor partners / tower coverage /
 *     feasibility mix). Program-wide; lives on the Plan tab alongside KPIs
 *     and the roadmap.
 *
 * The legacy `ProgramArchitecturePanel` is preserved as a thin composition
 * for any callers that still render both blocks together (e.g. exports).
 */

// ===========================================================================
//   Narratives — LLM authored, cross-tower commentary
// ===========================================================================

export function ProgramArchitectureNarratives({
  synthesis,
  bare,
}: {
  synthesis: ProgramSynthesisLLMV6 | null;
  bare?: boolean;
}) {
  const [hasProgramIntake, setHasProgramIntake] = React.useState(false);
  React.useEffect(() => {
    const sync = () =>
      setHasProgramIntake(
        Boolean(buildProgramWideTowerIntakeDigest(getAssessProgram())),
      );
    sync();
    return subscribe("assessProgram", sync);
  }, []);

  const Header = (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-lg font-semibold text-forge-ink">
          <span className="font-mono text-accent-purple-dark">&gt;</span>{" "}
          Cross-cutting architecture
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-forge-subtle">
          Orchestration, vendor stack, and data-core commentary for the
          portfolio. Per-solution agent fleets and integration patterns live
          on each solution&apos;s deep-dive page.
        </p>
        {synthesis && hasProgramIntake ? (
          <p className="mt-2 max-w-3xl text-[10px] leading-snug text-forge-hint">
            {TOWER_READINESS_ATTRIBUTION_LABEL}: program synthesis prompts include
            submitted tower intake where available.
          </p>
        ) : null}
      </div>
      {synthesis ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-accent-purple/30 bg-accent-purple/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-accent-purple-dark">
          <Sparkles className="h-2.5 w-2.5" aria-hidden /> AI-authored narrative
        </span>
      ) : null}
    </header>
  );

  const Body = (
    <div className="grid gap-4 lg:grid-cols-3">
      <NarrativeBlock
        icon={<Workflow className="h-3.5 w-3.5" aria-hidden />}
        title="Orchestration & delivery"
        body={synthesis?.architectureDelivery}
      />
      <NarrativeBlock
        icon={<Cpu className="h-3.5 w-3.5" aria-hidden />}
        title="Vendor stack"
        body={synthesis?.architectureVendors}
      />
      <NarrativeBlock
        icon={<Database className="h-3.5 w-3.5" aria-hidden />}
        title="Data + digital core"
        body={synthesis?.architectureDataCore}
      />
    </div>
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
//   Rollups — deterministic, program-wide
// ===========================================================================

export function ProgramArchitectureRollups({
  projects,
  bare,
}: {
  projects: AIProjectResolved[];
  bare?: boolean;
}) {
  const rollups = React.useMemo(() => buildRollups(projects), [projects]);

  const Header = (
    <header>
      <h2 className="font-display text-lg font-semibold text-forge-ink">
        <span className="font-mono text-accent-purple-dark">&gt;</span>{" "}
        Program rollups
      </h2>
      <p className="mt-1 max-w-3xl text-sm text-forge-subtle">
        Vendor partners named on the AI Solutions in plan, tower coverage,
        and feasibility mix. All three are computed deterministically from
        the curated solution set.
      </p>
    </header>
  );

  const Body = (
    <div className="grid gap-4 lg:grid-cols-3">
      <RollupCard
        icon={
          <Network className="h-3.5 w-3.5 text-accent-green" aria-hidden />
        }
        title="Vendor partners"
        total={rollups.vendorStack.length}
        totalLabel="distinct named vendors"
        rows={rollups.vendorStack.slice(0, 10).map((v) => ({
          label: v.vendor,
          count: v.count,
        }))}
      />
      <RollupCard
        icon={
          <Workflow className="h-3.5 w-3.5 text-accent-teal" aria-hidden />
        }
        title="Tower coverage"
        total={rollups.towerCoverage.length}
        totalLabel="towers in plan"
        rows={rollups.towerCoverage.slice(0, 10)}
      />
      <RollupCard
        icon={
          <Cpu className="h-3.5 w-3.5 text-accent-purple-dark" aria-hidden />
        }
        title="Feasibility mix"
        total={rollups.feasibilityMix.reduce((s, r) => s + r.count, 0)}
        totalLabel="solutions classified"
        rows={rollups.feasibilityMix}
      />
    </div>
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
//   Composing wrapper — preserved for any callers that want both blocks together
// ===========================================================================

export function ProgramArchitecturePanel({
  projects,
  synthesis,
  bare,
}: {
  projects: AIProjectResolved[];
  synthesis: ProgramSynthesisLLMV6 | null;
  bare?: boolean;
}) {
  if (bare) {
    return (
      <div className="space-y-6">
        <ProgramArchitectureNarratives synthesis={synthesis} bare />
        <ProgramArchitectureRollups projects={projects} bare />
      </div>
    );
  }
  return (
    <section className="space-y-6">
      <ProgramArchitectureNarratives synthesis={synthesis} />
      <ProgramArchitectureRollups projects={projects} />
    </section>
  );
}

// ===========================================================================
//   Narrative + rollup primitives
// ===========================================================================

function NarrativeBlock({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string | undefined;
}) {
  return (
    <div className="rounded-xl border border-forge-border bg-forge-surface p-4">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-forge-subtle">
        <span className="text-accent-purple-dark">{icon}</span>
        {title}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-forge-body">
        {body ?? (
          <span className="italic text-forge-subtle">
            Pending plan generation.
          </span>
        )}
      </p>
    </div>
  );
}

function RollupCard({
  icon,
  title,
  total,
  totalLabel,
  rows,
}: {
  icon: React.ReactNode;
  title: string;
  total: number;
  totalLabel: string;
  rows: { label: string; count: number }[];
}) {
  return (
    <div className="rounded-xl border border-forge-border bg-forge-surface p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-forge-subtle">
          {icon}
          {title}
        </div>
        <div className="text-right">
          <div className="font-mono text-xl font-semibold text-forge-ink">
            {total}
          </div>
          <div className="text-[10px] text-forge-hint">{totalLabel}</div>
        </div>
      </div>
      {rows.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {rows.map((r) => (
            <li
              key={r.label}
              className="flex items-baseline justify-between gap-2 text-xs"
            >
              <span className="truncate text-forge-body">{r.label}</span>
              <span className="font-mono text-[11px] text-forge-subtle">
                {r.count}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-[11px] italic text-forge-subtle">
          No data — solutions not yet authored.
        </p>
      )}
    </div>
  );
}

// ===========================================================================
//   Rollup computation — purely deterministic from briefs
// ===========================================================================

type Rollups = {
  vendorStack: { vendor: string; count: number }[];
  towerCoverage: { label: string; count: number }[];
  feasibilityMix: { label: string; count: number }[];
};

function buildRollups(projects: AIProjectResolved[]): Rollups {
  const vendorCounts = new Map<string, number>();
  const towerCounts = new Map<string, number>();
  const feasibilityCounts = new Map<string, number>();

  for (const p of projects) {
    bumpVendor(vendorCounts, p.primaryVendor);
    if (p.feasibility) {
      feasibilityCounts.set(
        p.feasibility,
        (feasibilityCounts.get(p.feasibility) ?? 0) + 1,
      );
    }
    towerCounts.set(
      p.primaryTowerId,
      (towerCounts.get(p.primaryTowerId) ?? 0) + 1,
    );
  }

  const vendorStack = Array.from(vendorCounts.entries())
    .map(([vendor, count]) => ({ vendor, count }))
    .sort((a, b) => b.count - a.count || a.vendor.localeCompare(b.vendor));

  const towerCoverage = Array.from(towerCounts.entries())
    .map(([towerId, count]) => ({ label: towerLabelForRollup(towerId), count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const feasibilityOrder = ["High", "Medium", "Low"];
  const feasibilityMix = feasibilityOrder
    .map((f) => ({ label: f, count: feasibilityCounts.get(f) ?? 0 }))
    .filter((r) => r.count > 0);

  return {
    vendorStack,
    towerCoverage,
    feasibilityMix,
  };
}

function towerLabelForRollup(towerId: string): string {
  if (towerId === "hr") return "HR";
  return towerId
    .split("-")
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

function bumpVendor(map: Map<string, number>, raw: string | undefined | null): void {
  if (!raw) return;
  const trimmed = raw.trim();
  if (!trimmed) return;
  const lower = trimmed.toLowerCase();
  if (
    lower === "tbd" ||
    lower === "tbd — subject to discovery" ||
    lower === "manual" ||
    lower === "n/a" ||
    lower === "none"
  ) {
    return;
  }
  map.set(trimmed, (map.get(trimmed) ?? 0) + 1);
}
