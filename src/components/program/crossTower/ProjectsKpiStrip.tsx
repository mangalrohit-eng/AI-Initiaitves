"use client";

import type { ProjectKpis, BuildupPoint } from "@/lib/llm/useCrossTowerPlan";
import { formatUsdCompact } from "@/lib/format";
import { useRedactDollars } from "@/lib/clientMode";

/**
 * Cross-Tower AI Plan v3 — project-centric executive KPI strip.
 *
 * Replaces the legacy initiative-grain KPI strip. Six tiles, every value
 * derived deterministically from the resolved project set + the
 * `composeProjects` curve:
 *
 *   1. Program AI run-rate at full scale — sum of attributed $ across
 *      all live (non-stub, non-Deprioritize) projects.
 *   2. Modeled M24 run-rate — last point of the project-driven buildup
 *      curve.
 *   3. AI Projects in plan — count of authored, sequenced projects.
 *   4. Towers in scope — distinct primary tower count across live projects.
 *   5. Agents architected — sum of `brief.agents.length` across live
 *      projects with a brief.
 *   6. Quadrant mix — Quick Win + Strategic Bet count vs total live.
 */
export function ProjectsKpiStrip({
  kpis,
  buildup,
  stubProjectCount,
  hasNarrative,
}: {
  kpis: ProjectKpis;
  buildup: BuildupPoint[];
  stubProjectCount: number;
  hasNarrative: boolean;
}) {
  const redact = useRedactDollars();
  const m24 = buildup[buildup.length - 1]?.cumulativeAiUsd ?? kpis.m24RunRateUsd;
  const gap = Math.max(0, kpis.fullScaleRunRateUsd - m24);
  const showGap = gap > 0 && kpis.fullScaleRunRateUsd > 0 && !redact;

  const initiativesSubtitle =
    kpis.liveProjects === 0
      ? "Click Regenerate to author the project set."
      : `${kpis.quickWinCount} Quick Wins · ${kpis.strategicBetCount} Strategic Bets · ${kpis.fillInCount} Fill-ins`;

  return (
    <section>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <Tile
          label="In-plan AI run-rate"
          value={
            redact
              ? "—"
              : formatUsdCompact(kpis.fullScaleRunRateUsd, { decimals: 2 })
          }
          subtitle="At full scale, all projects ramped"
          emphasis
        />
        <Tile
          label="Modeled · M24 run-rate"
          value={redact ? "—" : formatUsdCompact(m24, { decimals: 2 })}
          subtitle={
            kpis.liveProjects === 0
              ? "No projects in plan"
              : showGap
                ? `${formatUsdCompact(gap, { decimals: 2 })} ramps past M24`
                : "Every project at full scale by M24"
          }
        />
        <Tile
          label="AI Projects in plan"
          value={String(kpis.liveProjects)}
          subtitle={initiativesSubtitle}
        />
        <Tile
          label="Towers in scope"
          value={String(kpis.towersInScope)}
          subtitle={
            kpis.deprioritizedProjects > 0
              ? `${kpis.deprioritizedProjects} project${kpis.deprioritizedProjects === 1 ? "" : "s"} deprioritized`
              : "Cross-tower coverage"
          }
        />
        <Tile
          label="Agents architected"
          value={String(kpis.agentsArchitected)}
          subtitle={
            hasNarrative
              ? "Across live project briefs"
              : "Pending plan generation"
          }
        />
        <Tile
          label="Quadrant mix"
          value={`${kpis.quickWinCount + kpis.strategicBetCount}/${kpis.liveProjects || 0}`}
          subtitle="High-value (QW + SB) of live projects"
        />
      </div>

      {stubProjectCount > 0 ? (
        <p className="mt-2 text-[11px] text-forge-subtle">
          <span className="font-mono text-accent-amber">
            {stubProjectCount} project{stubProjectCount === 1 ? "" : "s"}
          </span>{" "}
          pending generation — model authoring failed and the cards are showing
          deterministic placeholders. Use the per-card Retry CTA on the
          Projects tab to author them individually.
        </p>
      ) : null}
    </section>
  );
}

function Tile({
  label,
  value,
  subtitle,
  emphasis,
}: {
  label: string;
  value: string;
  subtitle?: string;
  emphasis?: boolean;
}) {
  if (emphasis) {
    return (
      <div className="rounded-2xl border border-accent-purple/30 bg-gradient-to-b from-accent-purple/10 to-forge-surface p-4 shadow-sm">
        <div className="text-xs uppercase tracking-wide text-accent-purple-dark/80">
          {label}
        </div>
        <div className="mt-2 font-mono text-2xl font-semibold text-accent-purple-dark">
          {value}
        </div>
        {subtitle ? (
          <p className="mt-1 text-xs text-forge-subtle">{subtitle}</p>
        ) : null}
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-forge-border bg-forge-surface p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-forge-hint">
        {label}
      </div>
      <div className="mt-2 font-mono text-2xl font-semibold text-forge-ink">
        {value}
      </div>
      {subtitle ? (
        <p className="mt-1 text-xs text-forge-subtle">{subtitle}</p>
      ) : null}
    </div>
  );
}
