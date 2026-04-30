"use client";

import { Sparkles } from "lucide-react";
import type { SelectProgramResult } from "@/lib/initiatives/selectProgram";
import type { CrossTowerAiPlanLLM } from "@/lib/llm/prompts/crossTowerAiPlan.v1";
import { OrchestrationPatternBars } from "@/components/charts/OrchestrationPatternBars";
import { AgentTypesPie } from "@/components/charts/AgentTypesPie";

/**
 * Program-scope tech & agent architecture rollup.
 *
 *   - Orchestration mix, agent type mix, vendor stack: deterministic.
 *   - Three commentary paragraphs (orchestration, vendor stack, data core):
 *     LLM-authored when available.
 *
 * Note: `AgentDiagram.tsx` is per-Process and is intentionally NOT reused at
 * program scope. The rollup uses the existing `OrchestrationPatternBars` and
 * `AgentTypesPie` plus a vendor stack panel sourced from `Process.workbench`
 * + `digitalCore`.
 */
export function TechArchitectureModule({
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
  const llmAuthored = !narrativeUnavailable && Boolean(llmPlan);
  const arch = program.architecture;

  const content = (
    <>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-forge-ink">
            <span className="font-mono text-accent-purple-dark">&gt;</span> Tech & agent architecture
          </h2>
          <p className="mt-1 text-sm text-forge-subtle">
            Orchestration patterns, agent taxonomy, and the converged vendor stack across the program.
            {llmAuthored ? (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-accent-purple/30 bg-accent-purple/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-accent-purple-dark">
                <Sparkles className="h-2.5 w-2.5" aria-hidden /> AI-authored commentary
              </span>
            ) : null}
          </p>
        </div>
      </header>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Card title="Orchestration patterns">
          {arch.orchestrationMix.length > 0 ? (
            <OrchestrationPatternBars data={arch.orchestrationMix} />
          ) : (
            <p className="text-xs italic text-forge-subtle">No orchestration patterns surfaced yet.</p>
          )}
          <Commentary text={llmPlan?.architectureNarrative.orchestrationCommentary} />
        </Card>

        <Card title="Agents by type">
          {arch.agentTypeMix.length > 0 ? (
            <AgentTypesPie data={arch.agentTypeMix.map((m) => ({ type: m.type, count: m.count }))} />
          ) : (
            <p className="text-xs italic text-forge-subtle">No agents resolved yet.</p>
          )}
        </Card>

        <Card title="Vendor stack convergence" className="lg:col-span-2">
          {arch.vendorStack.length > 0 ? (
            <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
              {arch.vendorStack.map((v) => (
                <li
                  key={v.vendor}
                  className="flex items-center justify-between gap-2 rounded-lg border border-forge-border bg-forge-well/40 px-2.5 py-1.5"
                >
                  <span className="truncate text-xs font-medium text-forge-ink" title={v.vendor}>
                    {v.vendor}
                  </span>
                  <span className="font-mono text-[10px] text-forge-subtle">{v.count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs italic text-forge-subtle">No vendor stack surfaced yet.</p>
          )}
          <Commentary text={llmPlan?.architectureNarrative.vendorStackCommentary} />
        </Card>

        <Card title="Data fabric & digital core" className="lg:col-span-2">
          <Commentary
            text={llmPlan?.architectureNarrative.dataCoreCommentary}
            placeholder="Data, integration, and digital core commentary pending plan generation."
          />
        </Card>
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

function Card({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-forge-border bg-forge-surface p-4 ${className ?? ""}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-forge-subtle">{title}</div>
      <div className="mt-3 space-y-3">{children}</div>
    </div>
  );
}

function Commentary({
  text,
  placeholder,
}: {
  text?: string;
  placeholder?: string;
}) {
  if (!text) {
    if (!placeholder) return null;
    return <p className="text-xs italic leading-relaxed text-forge-subtle">{placeholder}</p>;
  }
  return <p className="text-sm leading-relaxed text-forge-body">{text}</p>;
}
