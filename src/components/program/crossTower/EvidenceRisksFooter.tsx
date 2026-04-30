"use client";

import { ShieldAlert, BookOpenText } from "lucide-react";
import type { CrossTowerAiPlanLLM } from "@/lib/llm/prompts/crossTowerAiPlan.v1";
import { PROGRAM_RISK_CATALOG } from "@/lib/llm/prompts/crossTowerAiPlan.v1";
import { evidenceClusters } from "@/data/evidenceMap";

/**
 * Closing footer with two surfaces:
 *
 *   - Risks & dependencies: deterministic risk catalog from
 *     `PROGRAM_RISK_CATALOG`. The LLM may author *mitigation* language only;
 *     the risk names + descriptions are fixed and doc-grounded.
 *   - Feasibility evidence: deterministic — pulled from `evidenceClusters`,
 *     same source that powers the `/summary` "Why we know this works" tile.
 */
export function EvidenceRisksFooter({
  llmPlan,
  narrativeUnavailable,
  bare,
}: {
  llmPlan: CrossTowerAiPlanLLM | null;
  narrativeUnavailable: boolean;
  /**
   * When true, the two child panels render with lighter chrome (no
   * `shadow-card`, `rounded-xl`) so they sit cleanly inside a TabGroup card
   * rather than producing a "card-in-card" visual.
   */
  bare?: boolean;
}) {
  const mitigationsById = new Map<string, string>();
  if (llmPlan && !narrativeUnavailable) {
    for (const m of llmPlan.riskMitigations) {
      mitigationsById.set(m.riskId, m.mitigation);
    }
  }

  const risksCardClass = bare
    ? "rounded-xl border border-forge-border bg-forge-surface p-5 lg:col-span-3"
    : "rounded-2xl border border-forge-border bg-forge-surface p-5 shadow-card lg:col-span-3";
  const evidenceCardClass = bare
    ? "rounded-xl border border-accent-teal/30 bg-gradient-to-b from-accent-teal/5 to-forge-surface p-5 lg:col-span-2"
    : "rounded-2xl border border-accent-teal/30 bg-gradient-to-b from-accent-teal/5 to-forge-surface p-5 shadow-card lg:col-span-2";

  return (
    <section className="grid gap-5 lg:grid-cols-5">
      {/* Risks — wider column. */}
      <div className={risksCardClass}>
        <header className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-accent-amber" aria-hidden />
          <h2 className="font-display text-lg font-semibold text-forge-ink">
            Risks & dependencies
          </h2>
        </header>
        <p className="mt-1 text-sm text-forge-subtle">
          Versant-specific guardrails the program must respect. Risk text is fixed; mitigation language is plan-authored
          and grounded in business context.
        </p>
        <ul className="mt-4 space-y-3">
          {PROGRAM_RISK_CATALOG.map((risk) => {
            const mitigation = mitigationsById.get(risk.id);
            return (
              <li
                key={risk.id}
                className="rounded-xl border border-forge-border bg-forge-surface px-4 py-3"
              >
                <div className="text-sm font-semibold text-forge-ink">{risk.name}</div>
                <p className="mt-1 text-xs leading-relaxed text-forge-body">{risk.why}</p>
                {mitigation ? (
                  <div className="mt-2 rounded-lg border border-accent-purple/25 bg-accent-purple/5 px-3 py-2 text-xs leading-relaxed text-forge-body">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-accent-purple-dark">
                      Mitigation
                    </span>
                    <p className="mt-0.5 text-forge-body">{mitigation}</p>
                  </div>
                ) : (
                  <p className="mt-2 text-[11px] italic text-forge-subtle">
                    Mitigation pending plan generation.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Evidence — narrower column. */}
      <div className={evidenceCardClass}>
        <header className="flex items-center gap-2">
          <BookOpenText className="h-4 w-4 text-accent-teal" aria-hidden />
          <h2 className="font-display text-lg font-semibold text-forge-ink">
            Why we know this works
          </h2>
        </header>
        <p className="mt-1 text-sm text-forge-subtle">
          {evidenceClusters.length} evidence clusters back the cross-tower plan — case studies, vendor offerings, and
          adjacent-industry deployments.
        </p>
        <ul className="mt-4 space-y-2">
          {evidenceClusters.slice(0, 10).map((c) => (
            <li
              key={c.id}
              className="rounded-lg border border-forge-border bg-forge-surface px-3 py-2 text-sm text-forge-body"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-forge-ink">{c.label}</span>
                <span className="font-mono text-[11px] text-forge-subtle">{c.evidence.length} refs</span>
              </div>
              <div className="mt-1 truncate text-xs text-forge-subtle">
                {c.evidence
                  .map((e) => e.source.split(" /")[0])
                  .slice(0, 3)
                  .join(" · ")}
              </div>
            </li>
          ))}
          {evidenceClusters.length > 10 ? (
            <li className="text-[11px] text-forge-hint">
              + {evidenceClusters.length - 10} more clusters in the executive summary.
            </li>
          ) : null}
        </ul>
      </div>
    </section>
  );
}
