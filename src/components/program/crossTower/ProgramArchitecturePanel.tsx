"use client";

import * as React from "react";
import { Cpu, Database, Network, Sparkles, Workflow } from "lucide-react";
import type {
  AIProjectResolved,
  ProgramSynthesisLLM,
} from "@/lib/cross-tower/aiProjects";
import { getAssessProgram, subscribe } from "@/lib/localStore";
import {
  buildProgramWideTowerIntakeDigest,
  TOWER_READINESS_ATTRIBUTION_LABEL,
} from "@/lib/assess/towerReadinessIntake";

/**
 * Cross-Tower AI Plan v3 — program architecture panel.
 *
 * Three LLM-authored narrative blocks from `ProgramSynthesisLLM`:
 *
 *   - `architectureOrchestration` — orchestration pattern commentary.
 *   - `architectureVendors`       — vendor stack commentary.
 *   - `architectureDataCore`      — data + digital core commentary.
 *
 * Plus deterministic rollups derived from the resolved project briefs:
 *
 *   - **Vendor stack** — every named tool / vendor across project briefs
 *     (workbench post-state, digital core platforms, agent toolsUsed).
 *   - **Agent fleet** — total agents across briefs, grouped by type.
 *   - **Orchestration mix** — count of each orchestration pattern in use.
 *
 * The deterministic rollups are computed client-side from the brief —
 * the LLM never authors counts.
 */
export function ProgramArchitecturePanel({
  projects,
  synthesis,
  bare,
}: {
  projects: AIProjectResolved[];
  synthesis: ProgramSynthesisLLM | null;
  bare?: boolean;
}) {
  const rollups = React.useMemo(() => buildRollups(projects), [projects]);
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
          Program architecture
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-forge-subtle">
          Aggregate view of the agent fleet, orchestration patterns, and
          vendor stack across the AI Projects in plan. Deterministic rollups
          come from the project briefs; the surrounding narrative is GPT-5.5
          authored.
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
    <div className="space-y-5">
      {/* Narrative blocks — three columns */}
      <div className="grid gap-4 lg:grid-cols-3">
        <NarrativeBlock
          icon={<Workflow className="h-3.5 w-3.5" aria-hidden />}
          title="Orchestration"
          body={synthesis?.architectureOrchestration}
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

      {/* Deterministic rollups */}
      <div className="grid gap-4 lg:grid-cols-3">
        <RollupCard
          icon={<Cpu className="h-3.5 w-3.5 text-accent-purple-dark" aria-hidden />}
          title="Agents architected"
          total={rollups.totalAgents}
          totalLabel="across project briefs"
          rows={rollups.agentTypeMix}
        />
        <RollupCard
          icon={<Workflow className="h-3.5 w-3.5 text-accent-teal" aria-hidden />}
          title="Orchestration patterns"
          total={rollups.orchestrationMix.reduce((s, r) => s + r.count, 0)}
          totalLabel="projects sized"
          rows={rollups.orchestrationMix}
        />
        <RollupCard
          icon={<Network className="h-3.5 w-3.5 text-accent-green" aria-hidden />}
          title="Vendor stack"
          total={rollups.vendorStack.length}
          totalLabel="distinct named vendors"
          rows={rollups.vendorStack.slice(0, 10).map((v) => ({
            label: v.vendor,
            count: v.count,
          }))}
        />
      </div>
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
          No data — projects not yet authored.
        </p>
      )}
    </div>
  );
}

// ===========================================================================
//   Rollup computation — purely deterministic from briefs
// ===========================================================================

type Rollups = {
  totalAgents: number;
  agentTypeMix: { label: string; count: number }[];
  orchestrationMix: { label: string; count: number }[];
  vendorStack: { vendor: string; count: number }[];
};

function buildRollups(projects: AIProjectResolved[]): Rollups {
  const agentTypeCounts = new Map<string, number>();
  const orchCounts = new Map<string, number>();
  const vendorCounts = new Map<string, number>();
  let totalAgents = 0;

  for (const p of projects) {
    if (p.isStub || !p.brief) continue;

    for (const agent of p.brief.agents) {
      totalAgents += 1;
      agentTypeCounts.set(
        agent.type,
        (agentTypeCounts.get(agent.type) ?? 0) + 1,
      );
      for (const tool of agent.toolsUsed) bumpVendor(vendorCounts, tool);
    }

    const pattern = p.brief.agentOrchestration.pattern;
    orchCounts.set(pattern, (orchCounts.get(pattern) ?? 0) + 1);

    for (const t of p.brief.workbench.post) bumpVendor(vendorCounts, t.tool);
    for (const plat of p.brief.digitalCore.requiredPlatforms) {
      bumpVendor(vendorCounts, plat.platform);
      for (const ex of plat.examples ?? []) bumpVendor(vendorCounts, ex);
    }
  }

  const agentTypeOrder = [
    "Orchestrator",
    "Specialist",
    "Monitor",
    "Router",
    "Executor",
  ];
  const agentTypeMix = agentTypeOrder
    .map((type) => ({ label: type, count: agentTypeCounts.get(type) ?? 0 }))
    .filter((r) => r.count > 0);

  const orchOrder = [
    "Sequential",
    "Parallel",
    "Hub-and-Spoke",
    "Pipeline",
    "Hierarchical",
  ];
  const orchestrationMix = orchOrder
    .map((p) => ({ label: p, count: orchCounts.get(p) ?? 0 }))
    .filter((r) => r.count > 0);

  const vendorStack = Array.from(vendorCounts.entries())
    .map(([vendor, count]) => ({ vendor, count }))
    .sort((a, b) => b.count - a.count || a.vendor.localeCompare(b.vendor));

  return {
    totalAgents,
    agentTypeMix,
    orchestrationMix,
    vendorStack,
  };
}

function bumpVendor(map: Map<string, number>, raw: string): void {
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
