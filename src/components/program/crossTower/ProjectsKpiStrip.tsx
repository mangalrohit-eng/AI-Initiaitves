"use client";

import type { ProjectKpis, BuildupPoint } from "@/lib/llm/useCrossTowerPlan";
import { formatUsdCompact } from "@/lib/format";
import { useRedactDollars } from "@/lib/clientMode";
import { IS_V6 } from "@/lib/schemaFlag";

/**
 * Cross-Tower AI Plan — executive KPI strip.
 *
 * Six tiles, every value derived deterministically from the resolved
 * project set and the `composeProjects` (or `composeProjectsV6`) curve:
 *
 *   1. Program AI run-rate at full scale — sum of attributed $ across
 *      all live (non-stub, non-Deprioritize) projects/initiatives.
 *   2. Modeled M24 run-rate — last point of the buildup curve.
 *   3. {AI Solutions | AI Projects} in plan — count of authored items.
 *   4. Towers in scope — distinct primary tower count across live items.
 *   5. v5: Agents architected — sum of `brief.agents.length` across live
 *      project briefs.
 *      v6: Initiative mix — High-feasibility share of live initiatives
 *      (the v6 substrate carries no agent fleet at the program grain;
 *      agents are authored per-initiative on the deep-dive page).
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

  const itemNoun = IS_V6 ? "solution" : "project";
  const itemNounPlural = IS_V6 ? "solutions" : "projects";
  const inPlanLabel = IS_V6 ? "AI Solutions in plan" : "AI Projects in plan";
  const initiativesSubtitle =
    kpis.liveProjects === 0
      ? `Click Regenerate to author the ${itemNoun} set.`
      : `${kpis.quickWinCount} Quick Wins · ${kpis.strategicBetCount} Strategic Bets · ${kpis.fillInCount} Fill-ins`;

  return (
    <section>
      <div
        className={[
          "grid gap-3 sm:grid-cols-2",
          IS_V6 ? "lg:grid-cols-5" : "lg:grid-cols-6",
        ].join(" ")}
      >
        <Tile
          label="In-plan AI run-rate"
          value={
            redact
              ? "—"
              : formatUsdCompact(kpis.fullScaleRunRateUsd, { decimals: 2 })
          }
          subtitle={
            IS_V6
              ? "At full scale, every solution ramped"
              : "At full scale, all projects ramped"
          }
          emphasis
        />
        <Tile
          label="Modeled · M24 run-rate"
          value={redact ? "—" : formatUsdCompact(m24, { decimals: 2 })}
          subtitle={
            kpis.liveProjects === 0
              ? `No ${itemNounPlural} in plan`
              : showGap
                ? `${formatUsdCompact(gap, { decimals: 2 })} ramps past M24`
                : `Every ${itemNoun} at full scale by M24`
          }
        />
        <Tile
          label={inPlanLabel}
          value={String(kpis.liveProjects)}
          subtitle={initiativesSubtitle}
        />
        <Tile
          label="Towers in scope"
          value={String(kpis.towersInScope)}
          subtitle={
            kpis.deprioritizedProjects > 0
              ? `${kpis.deprioritizedProjects} ${itemNoun}${kpis.deprioritizedProjects === 1 ? "" : "s"} deprioritized`
              : "Cross-tower coverage"
          }
        />
        {!IS_V6 ? (
          <Tile
            label="Agents architected"
            value={String(kpis.agentsArchitected)}
            subtitle={
              hasNarrative
                ? "Across live project briefs"
                : "Pending plan generation"
            }
          />
        ) : null}
        <Tile
          label="Quadrant mix"
          value={`${kpis.quickWinCount + kpis.strategicBetCount}/${kpis.liveProjects || 0}`}
          subtitle={`High-value (QW + SB) of live ${itemNounPlural}`}
        />
      </div>

      {stubProjectCount > 0 ? (
        <p className="mt-2 text-[11px] text-forge-subtle">
          <span className="font-mono text-accent-amber">
            {stubProjectCount} {itemNoun}
            {stubProjectCount === 1 ? "" : "s"}
          </span>{" "}
          pending generation — model authoring failed and the cards are
          showing deterministic placeholders.{" "}
          {IS_V6
            ? "Open the AI Solutions tab and click Regenerate to retry."
            : "Use the per-card Retry CTA on the Projects tab to author them individually."}
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
