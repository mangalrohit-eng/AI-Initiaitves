"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, AlertTriangle } from "lucide-react";
import type { SelectProgramResult } from "@/lib/initiatives/selectProgram";
import { TOWER_AGENT_MAP } from "@/lib/techView/architectureBlueprint";
import type { Agent } from "@/data/types";

type AgentTypeCounts = Partial<Record<Agent["type"], number>>;

/**
 * Per-tower agent / vendor map — 13 rows, one per Versant tower. Joins the
 * static `TOWER_AGENT_MAP` blueprint with live agent counts pulled from the
 * deterministic selectors on `SelectProgramResult` so the table reconciles
 * to the rest of the page.
 *
 * Fully deterministic — no LLM authorship.
 */
export function TowerAgentMapTable({ program }: { program: SelectProgramResult }) {
  const agentCountsByTower = React.useMemo(
    () => buildAgentCountsByTower(program),
    [program],
  );
  const initiativeCountByTower = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const r of program.initiatives) {
      map.set(r.towerId, (map.get(r.towerId) ?? 0) + 1);
    }
    return map;
  }, [program.initiatives]);

  return (
    <div className="space-y-3">
      <header>
        <h3 className="font-display text-base font-semibold text-forge-ink">
          <span className="font-mono text-accent-purple-dark">&gt;</span> Per-tower agent / vendor map
        </h3>
        <p className="mt-1 text-xs text-forge-subtle">
          One row per Versant tower. Lead agent and source-system stack come
          from the static blueprint; specialist agent counts come live from
          <span className="text-forge-body"> program.architecture</span>{" "}
          (the same selector that powers the Architecture tab).
        </p>
      </header>

      <div className="overflow-x-auto rounded-xl border border-forge-border bg-forge-surface">
        <table className="w-full min-w-[960px] text-sm">
          <thead>
            <tr className="border-b border-forge-border bg-forge-well/40 text-left text-[11px] uppercase tracking-wider text-forge-subtle">
              <th className="px-3 py-2 font-medium">Tower</th>
              <th className="px-3 py-2 font-medium">Lead agent</th>
              <th className="px-3 py-2 font-medium">Specialist agents (live)</th>
              <th className="px-3 py-2 font-medium">Source systems</th>
              <th className="px-3 py-2 font-medium">Primary LLM use case</th>
            </tr>
          </thead>
          <tbody>
            {TOWER_AGENT_MAP.map((row) => {
              const counts = agentCountsByTower.get(row.id) ?? {};
              const initiativeCount = initiativeCountByTower.get(row.id) ?? 0;
              return (
                <tr
                  key={row.id}
                  className="border-b border-forge-border/60 align-top hover:bg-forge-well/30"
                >
                  <td className="min-w-[180px] px-3 py-2.5">
                    <Link
                      href={`/tower/${row.id}`}
                      className="group inline-flex items-center gap-1 text-sm font-medium text-forge-ink hover:text-accent-purple-dark"
                    >
                      <span>{row.name}</span>
                      <ArrowUpRight className="h-3 w-3 text-forge-hint transition group-hover:text-accent-purple" />
                    </Link>
                    <div className="mt-0.5 font-mono text-[10px] text-forge-hint">
                      {initiativeCount} initiatives
                    </div>
                  </td>
                  <td className="min-w-[180px] px-3 py-2.5">
                    <div className="text-xs font-medium text-forge-ink">
                      {row.leadAgent}
                    </div>
                  </td>
                  <td className="min-w-[180px] px-3 py-2.5">
                    <AgentCountChips counts={counts} />
                  </td>
                  <td className="min-w-[200px] px-3 py-2.5">
                    <ul className="flex flex-wrap gap-1">
                      {row.sourceSystems.map((s) => (
                        <li
                          key={s}
                          className="rounded-md border border-forge-border bg-forge-well/50 px-1.5 py-0 text-[11px] text-forge-body"
                        >
                          {s}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="min-w-[280px] px-3 py-2.5">
                    <p className="text-xs leading-relaxed text-forge-body">
                      {row.primaryLLMUseCase}
                    </p>
                    {row.versantConstraint ? (
                      <div className="mt-1.5 inline-flex items-start gap-1 rounded-md border border-accent-amber/35 bg-accent-amber/5 px-1.5 py-1 text-[10px] text-amber-900">
                        <AlertTriangle className="mt-0.5 h-2.5 w-2.5 flex-shrink-0" aria-hidden />
                        <span>{row.versantConstraint}</span>
                      </div>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ===========================================================================
//   Helpers
// ===========================================================================

function AgentCountChips({ counts }: { counts: AgentTypeCounts }) {
  const order: Agent["type"][] = ["Orchestrator", "Specialist", "Monitor", "Router", "Executor"];
  const present = order.filter((t) => (counts[t] ?? 0) > 0);
  if (present.length === 0) {
    return <span className="text-[11px] text-forge-hint">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {present.map((type) => (
        <span
          key={type}
          className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px]"
          style={agentTypeBadgeStyle(type)}
        >
          <span className="font-mono">{counts[type]}</span>
          <span>{type}</span>
        </span>
      ))}
    </div>
  );
}

function agentTypeBadgeStyle(type: Agent["type"]): React.CSSProperties {
  // Color-coded by Agent.type — matches the AgentDiagram palette + the
  // Architecture tab color treatment for consistency across the page.
  const palette: Record<Agent["type"], { bg: string; border: string; color: string }> = {
    Orchestrator: { bg: "rgba(161,0,255,0.10)", border: "rgba(161,0,255,0.35)", color: "#7500C0" },
    Specialist: { bg: "rgba(0,191,165,0.10)", border: "rgba(0,191,165,0.35)", color: "#00806E" },
    Monitor: { bg: "rgba(255,179,0,0.10)", border: "rgba(255,179,0,0.40)", color: "#7A5A00" },
    Router: { bg: "rgba(217,102,255,0.10)", border: "rgba(217,102,255,0.35)", color: "#8E00B8" },
    Executor: { bg: "rgba(0,200,83,0.10)", border: "rgba(0,200,83,0.40)", color: "#1F7A2E" },
  };
  const c = palette[type];
  return { background: c.bg, borderColor: c.border, color: c.color };
}

/**
 * Re-derive per-tower agent type counts from the resolved Process objects on
 * `program.initiatives`. We don't get this slice already aggregated, so we
 * recompute it here with the same dedupe-by-Process-id rule as the program-
 * scope `aggregateArchitecture` to stay consistent.
 */
function buildAgentCountsByTower(
  program: SelectProgramResult,
): Map<string, AgentTypeCounts> {
  const counts = new Map<string, AgentTypeCounts>();
  const seen = new Map<string, Set<string>>();
  for (const init of program.initiatives) {
    if (!init.initiative) continue;
    const seenForTower = seen.get(init.towerId) ?? new Set<string>();
    if (seenForTower.has(init.initiative.id)) continue;
    seenForTower.add(init.initiative.id);
    seen.set(init.towerId, seenForTower);
    const bucket = counts.get(init.towerId) ?? {};
    for (const agent of init.initiative.agents) {
      bucket[agent.type] = (bucket[agent.type] ?? 0) + 1;
    }
    counts.set(init.towerId, bucket);
  }
  return counts;
}

