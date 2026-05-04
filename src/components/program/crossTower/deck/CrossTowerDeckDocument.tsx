"use client";

import * as React from "react";
import type { Quadrant } from "@/lib/cross-tower/aiProjects";
import type { CrossTowerDeckPayload, DeckProjectSlice } from "@/lib/cross-tower/deckPayload";
import { deckExecutiveFallback } from "@/lib/cross-tower/deckPayload";
import { formatUsdCompact } from "@/lib/format";
import { DeckSlide } from "./DeckSlide";
import { DeckValueChart } from "./DeckValueChart";
import {
  DECK_APPROACH_STEPS,
  DECK_QUADRANT_META,
  DECK_QUADRANT_ORDER,
  DECK_SCORING_BULLETS,
} from "./crossTowerDeckConstants";

function fmtUsd(n: number, redact: boolean): string {
  if (redact) return "—";
  return formatUsdCompact(n, { decimals: 2 });
}

function groupByQuadrant(
  projects: DeckProjectSlice[],
): Record<Quadrant, DeckProjectSlice[]> {
  const map: Record<Quadrant, DeckProjectSlice[]> = {
    "Strategic Bet": [],
    "Quick Win": [],
    Deprioritize: [],
    "Fill-in": [],
  };
  const scored = projects.filter((p) => !p.isStub && p.quadrant);
  for (const p of scored) {
    if (p.quadrant) map[p.quadrant].push(p);
  }
  for (const q of DECK_QUADRANT_ORDER) {
    map[q].sort((a, b) => b.attributedAiUsd - a.attributedAiUsd);
  }
  return map;
}

function AppendixProjectSlide({
  project,
  redact,
}: {
  project: DeckProjectSlice;
  redact: boolean;
}) {
  if (project.isStub) {
    return (
      <div className="flex h-full flex-col">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-forge-hint">
          AI Project
        </p>
        <h2 className="mt-1 font-display text-xl font-semibold text-forge-ink">
          {project.name}
        </h2>
        <p className="mt-1 text-sm text-forge-subtle">{project.primaryTowerName}</p>
        <p className="mt-6 rounded-lg border border-accent-amber/40 bg-accent-amber/5 px-3 py-2 text-sm text-forge-body">
          Authoring incomplete for this cohort — regenerate the plan or retry the
          project from the Cross-Tower AI Plan page.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-forge-hint">
            AI Project
          </p>
          <h2 className="mt-1 font-display text-xl font-semibold text-forge-ink">
            {project.name}
          </h2>
          <p className="mt-1 text-sm text-forge-subtle">
            {project.primaryTowerName} · {project.parentL4ActivityGroupName}
          </p>
        </div>
        <div className="text-right">
          {project.quadrant ? (
            <span
              className={`inline-block rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${DECK_QUADRANT_META[project.quadrant].border} ${DECK_QUADRANT_META[project.quadrant].bg} ${DECK_QUADRANT_META[project.quadrant].titleClass}`}
            >
              {project.quadrant}
            </span>
          ) : null}
          <div className="mt-2 font-mono text-lg font-semibold text-accent-purple-dark">
            {fmtUsd(project.attributedAiUsd, redact)}
          </div>
          <p className="text-[10px] text-forge-hint">Modeled L4 prize</p>
        </div>
      </div>
      {project.isDeprioritized ? (
        <p className="mt-2 text-xs text-accent-red">
          Deprioritize quadrant — excluded from active Gantt and value buildup curve.
        </p>
      ) : null}
      <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-forge-body">
        {project.narrative}
      </p>
      {project.keyShifts.length > 0 ? (
        <div className="mt-4">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-forge-hint">
            Key shifts
          </p>
          <ul className="mt-1 list-inside list-disc space-y-1 text-sm text-forge-body">
            {project.keyShifts.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {project.agentSummaries.length > 0 ? (
        <div className="mt-4">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-forge-hint">
            Agents
          </p>
          <ul className="mt-1 space-y-0.5 font-mono text-xs text-forge-body">
            {project.agentSummaries.map((a) => (
              <li key={a.name}>
                {a.name}{" "}
                <span className="text-forge-subtle">({a.type})</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {project.l5Names.length > 0 ? (
        <div className="mt-auto pt-4">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-forge-hint">
            L5 opportunities
          </p>
          <p className="mt-1 text-xs leading-snug text-forge-subtle">
            {project.l5Names.join(" · ")}
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function CrossTowerDeckDocument({ payload }: { payload: CrossTowerDeckPayload }) {
  const redact = payload.redactDollars;
  const exec =
    payload.synthesis?.executiveSummary?.trim() ||
    deckExecutiveFallback(payload.isFirstRunForCopy);
  const grouped = React.useMemo(() => groupByQuadrant(payload.projects), [payload.projects]);
  const hasRisks = Boolean(payload.synthesis?.risks && payload.synthesis.risks.length > 0);
  const roadmap = payload.synthesis?.roadmapNarrative;

  const projects = payload.projects;
  const lastProjectId = projects.length > 0 ? projects[projects.length - 1]!.id : null;

  return (
    <div className="deck-root mx-auto max-w-5xl px-4 py-8 print:max-w-none print:px-0 print:py-0">
      <DeckSlide>
        <div className="flex h-full flex-col justify-between">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-widest text-accent-purple-dark">
              Versant Forge Program
            </p>
            <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-forge-ink sm:text-4xl">
              <span className="font-mono text-accent-purple-dark">&gt;</span> Cross-Tower AI
              Plan
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-forge-subtle">
              24-month agentic AI plan across thirteen towers — one AI Project per in-plan L4
              Activity Group.
            </p>
          </div>
          <p className="font-mono text-xs text-forge-hint">
            {payload.generatedAt
              ? `Generated ${new Date(payload.generatedAt).toLocaleString()}`
              : "Generation time pending"}
          </p>
        </div>
      </DeckSlide>

      <DeckSlide>
        <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-forge-hint">
          Executive storyline
        </p>
        <p className="mt-3 text-base leading-relaxed text-forge-body">{exec}</p>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="Live projects" value={String(payload.kpis.liveProjects)} />
          <Kpi label="M24 run-rate" value={fmtUsd(payload.kpis.m24RunRateUsd, redact)} />
          <Kpi label="Full-scale total" value={fmtUsd(payload.kpis.fullScaleRunRateUsd, redact)} />
          <Kpi label="Agents" value={String(payload.kpis.agentsArchitected)} />
        </div>
        <p className="mt-4 font-mono text-xs text-forge-subtle">
          QW {payload.kpis.quickWinCount} · SB {payload.kpis.strategicBetCount} · FI{" "}
          {payload.kpis.fillInCount} · DP {payload.kpis.deprioritizedProjects}
        </p>
      </DeckSlide>

      <DeckSlide>
        <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-forge-hint">
          Approach
        </p>
        <h2 className="mt-2 font-display text-xl font-semibold text-forge-ink">
          Six-step methodology
        </h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {DECK_APPROACH_STEPS.map((s) => (
            <div
              key={s.num}
              className="rounded-lg border border-forge-border bg-forge-well/40 p-3"
            >
              <p className="font-mono text-[10px] text-accent-purple-dark">{s.num}</p>
              <p className="mt-1 font-display text-sm font-semibold text-forge-ink">{s.title}</p>
              <p className="mt-1 text-xs leading-snug text-forge-subtle">{s.line}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 font-mono text-xs text-forge-hint">
          {payload.programMeta.towersInScope} towers in scope · {payload.programMeta.inPlanL4Count}{" "}
          L4 groups · {payload.programMeta.inPlanL5Count} L5 opportunities ·{" "}
          {payload.programMeta.liveProjects} live AI Projects
        </p>
      </DeckSlide>

      <DeckSlide>
        <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-forge-hint">
          Approach
        </p>
        <h2 className="mt-2 font-display text-xl font-semibold text-forge-ink">
          Scoring and timing
        </h2>
        <ul className="mt-6 list-inside list-disc space-y-2 text-sm text-forge-body">
          {DECK_SCORING_BULLETS.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      </DeckSlide>

      <DeckSlide>
        <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-forge-hint">
          Value accrual
        </p>
        <h2 className="mt-2 font-display text-xl font-semibold text-forge-ink">
          24-month modeled AI value buildup
        </h2>
        <p className="mt-2 max-w-3xl text-xs leading-relaxed text-forge-subtle">
          P1 M{payload.assumptions.p1PhaseStartMonth} / {payload.assumptions.p1BuildMonths}mo build ·
          P2 M{payload.assumptions.p2PhaseStartMonth} / {payload.assumptions.p2BuildMonths}mo · P3 M
          {payload.assumptions.p3PhaseStartMonth} / {payload.assumptions.p3BuildMonths}mo · then{" "}
          {payload.assumptions.rampMonths}-month ramp to full run-rate. Program start M
          {payload.assumptions.programStartMonth}.
        </p>
        <div className="mt-6">
          <DeckValueChart buildup={payload.buildup} redact={redact} />
        </div>
      </DeckSlide>

      <DeckSlide>
        <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-forge-hint">
          Portfolio
        </p>
        <h2 className="mt-2 font-display text-xl font-semibold text-forge-ink">
          Value × Effort 2×2
        </h2>
        <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-forge-subtle">
          High value top row · High effort left column · median-split axes
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {DECK_QUADRANT_ORDER.map((q) => {
            const meta = DECK_QUADRANT_META[q];
            const rows = grouped[q];
            return (
              <div
                key={q}
                className={`rounded-xl border p-3 ${meta.border} ${meta.bg}`}
              >
                <p className={`font-display text-sm font-semibold ${meta.titleClass}`}>{q}</p>
                <p className="text-[10px] text-forge-subtle">{meta.hint}</p>
                <p className="mt-2 font-mono text-xs text-forge-body">
                  {rows.length} project{rows.length === 1 ? "" : "s"}
                </p>
                <ul className="mt-2 max-h-40 space-y-1 overflow-hidden text-xs text-forge-body">
                  {rows.map((p) => (
                    <li key={p.id} className="truncate font-mono">
                      {p.name}
                      {!redact ? (
                        <span className="text-forge-subtle">
                          {" "}
                          · {formatUsdCompact(p.attributedAiUsd, { decimals: 1 })}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </DeckSlide>

      <DeckSlide>
        <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-forge-hint">
          Roadmap
        </p>
        <h2 className="mt-2 font-display text-xl font-semibold text-forge-ink">
          24-month program sequence
        </h2>
        {roadmap ? (
          <div className="mt-6 space-y-4 text-sm leading-relaxed text-forge-body">
            <p>{roadmap.overall}</p>
            <p>{roadmap.ladder}</p>
            {roadmap.milestones.length > 0 ? (
              <ul className="list-inside list-disc space-y-2">
                {roadmap.milestones.slice(0, 5).map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <p className="mt-6 text-sm text-forge-subtle">
            Regenerate the plan on the Cross-Tower AI Plan page to author the program roadmap
            narrative.
          </p>
        )}
      </DeckSlide>

      {hasRisks && payload.synthesis ? (
        <DeckSlide>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-forge-hint">
            Risks
          </p>
          <h2 className="mt-2 font-display text-xl font-semibold text-forge-ink">
            Top program risks
          </h2>
          <ul className="mt-6 space-y-4">
            {payload.synthesis.risks.slice(0, 3).map((r, i) => (
              <li key={i} className="border-l-2 border-accent-amber/50 pl-3">
                <p className="font-display text-sm font-semibold text-forge-ink">{r.title}</p>
                <p className="mt-1 text-xs text-forge-body">{r.description}</p>
                <p className="mt-1 text-xs text-forge-subtle">
                  <span className="font-semibold text-accent-green">Mitigation:</span>{" "}
                  {r.mitigation}
                </p>
              </li>
            ))}
          </ul>
        </DeckSlide>
      ) : null}

      <DeckSlide>
        <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-forge-hint">
          Appendix
        </p>
        <h2 className="mt-2 font-display text-2xl font-semibold text-forge-ink">
          AI Project briefs
        </h2>
        <p className="mt-4 font-mono text-sm text-forge-subtle">
          {projects.length} slide{projects.length === 1 ? "" : "s"} follow — one page per project.
        </p>
      </DeckSlide>

      {projects.length === 0 ? (
        <DeckSlide isLast>
          <p className="text-sm text-forge-subtle">
            No AI Projects were included in this export.
          </p>
        </DeckSlide>
      ) : (
        projects.map((p) => (
          <DeckSlide key={p.id} isLast={p.id === lastProjectId}>
            <AppendixProjectSlide project={p} redact={redact} />
          </DeckSlide>
        ))
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-forge-border bg-forge-well/30 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-forge-hint">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold text-forge-ink">{value}</p>
    </div>
  );
}
