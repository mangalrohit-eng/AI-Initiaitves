"use client";

import type { PhaseBucket, SelectProgramResult } from "@/lib/initiatives/selectProgram";
import type { CrossTowerAiPlanLLM, LLMRoadmapPhase } from "@/lib/llm/prompts/crossTowerAiPlan.v1";
import { TIER_META, TIER_STYLES, type Tier } from "@/lib/priority";
import { formatUsdCompact } from "@/lib/format";
import { useRedactDollars } from "@/lib/clientMode";
import { Sparkles } from "lucide-react";

/**
 * Three-phase implementation roadmap.
 *
 *   - Phase windows + initiative membership: deterministic via `priorityTier()`.
 *   - Phase narrative, milestones, owner notes: LLM-authored when available.
 *
 * Each phase card shows the count + AI $ for that phase, then either the
 * LLM-authored narrative + milestones or a deterministic placeholder so the
 * page still reads cleanly when generation is unavailable.
 */
export function ImplementationRoadmapModule({
  program,
  llmPlan,
  narrativeUnavailable,
  bare,
}: {
  program: SelectProgramResult;
  llmPlan: CrossTowerAiPlanLLM | null;
  narrativeUnavailable: boolean;
  /** Drop the outer card frame when rendered inside `<TabGroup>`. */
  bare?: boolean;
}) {
  const phases: PhaseBucket[] = [
    program.phases.p1,
    program.phases.p2,
    program.phases.p3,
  ];
  const llmAuthored = !narrativeUnavailable && Boolean(llmPlan);

  const content = (
    <>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-forge-ink">
            <span className="font-mono text-accent-purple-dark">&gt;</span> Implementation roadmap
          </h2>
          <p className="mt-1 text-sm text-forge-subtle">
            Three horizons: P1 immediate (0–6mo), P2 near-term (6–12mo), P3 medium-term (12–24mo).
            {llmAuthored ? (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-accent-purple/30 bg-accent-purple/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-accent-purple-dark">
                <Sparkles className="h-2.5 w-2.5" aria-hidden /> AI-authored narrative
              </span>
            ) : null}
          </p>
        </div>
      </header>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {phases.map((phase) => (
          <PhaseCard
            key={phase.tier}
            phase={phase}
            llmPhase={pickLLMPhase(llmPlan, phase.tier)}
          />
        ))}
      </div>
    </>
  );

  if (bare) return <div>{content}</div>;
  return (
    <section className="rounded-2xl border border-forge-border bg-forge-surface p-5 shadow-card">
      {content}
    </section>
  );
}

function PhaseCard({
  phase,
  llmPhase,
}: {
  phase: PhaseBucket;
  llmPhase: LLMRoadmapPhase | null;
}) {
  const redact = useRedactDollars();
  const meta = TIER_META[phase.tier];
  const styles = TIER_STYLES[phase.tier];
  const Icon = meta.icon;
  return (
    <div
      className={`relative overflow-hidden rounded-xl border p-4 ${styles.border} ${styles.row}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm ${meta.gradient}`}
          >
            <Icon className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-forge-subtle">
              {phase.tier} · {meta.label}
            </div>
            <div className="text-sm font-semibold text-forge-ink">{meta.window}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-xs text-forge-hint">{phase.initiatives.length}</div>
          <div className="text-[10px] uppercase tracking-wider text-forge-hint">initiatives</div>
        </div>
      </div>

      {!redact ? (
        <div className="mt-3 inline-flex items-center gap-1 rounded-full border border-forge-border bg-forge-surface px-2 py-0.5 font-mono text-[11px] tabular-nums text-forge-body">
          {formatUsdCompact(phase.aiUsd)} AI $ in-phase
        </div>
      ) : null}

      <div className="mt-3 space-y-3 text-sm text-forge-body">
        {llmPhase?.narrative ? (
          <p className="leading-relaxed">{llmPhase.narrative}</p>
        ) : (
          <p className="italic text-forge-subtle">
            Phase narrative pending plan generation. Initiatives below are sequenced from the deterministic priority tier.
          </p>
        )}

        {llmPhase?.milestones && llmPhase.milestones.length > 0 ? (
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-forge-subtle">
              Milestones
            </div>
            <ul className="mt-1 space-y-1">
              {llmPhase.milestones.map((m, idx) => (
                <li key={idx} className="flex gap-2 text-xs leading-relaxed">
                  <span className={`mt-1.5 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full ${styles.dot}`} />
                  <span>{m}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {llmPhase?.ownerNotes && llmPhase.ownerNotes.length > 0 ? (
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-forge-subtle">
              Owners
            </div>
            <ul className="mt-1 space-y-1">
              {llmPhase.ownerNotes.map((n, idx) => (
                <li key={idx} className="text-xs leading-relaxed">{n}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-forge-subtle">
            Initiatives in this phase
          </div>
          <ul className="mt-1 space-y-1">
            {phase.initiatives.slice(0, 6).map((init) => (
              <li key={init.id} className="truncate text-xs leading-relaxed text-forge-body">
                <span className="text-forge-ink">{init.name}</span>
                <span className="text-forge-hint"> · {init.towerName}</span>
              </li>
            ))}
            {phase.initiatives.length > 6 ? (
              <li className="text-[11px] text-forge-hint">
                + {phase.initiatives.length - 6} more
              </li>
            ) : null}
          </ul>
        </div>
      </div>
    </div>
  );
}

function pickLLMPhase(
  llmPlan: CrossTowerAiPlanLLM | null,
  tier: Tier,
): LLMRoadmapPhase | null {
  if (!llmPlan) return null;
  if (tier === "P1") return llmPlan.roadmapPhases.p1;
  if (tier === "P2") return llmPlan.roadmapPhases.p2;
  return llmPlan.roadmapPhases.p3;
}
