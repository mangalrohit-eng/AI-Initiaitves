"use client";

import { AlertTriangle, ShieldCheck, Sparkles } from "lucide-react";
import type { ProgramSynthesisLLM } from "@/lib/cross-tower/aiProjects";

/**
 * Cross-Tower AI Plan v3 — program-level risks panel.
 *
 * Renders the LLM-authored risk catalog from `ProgramSynthesisLLM.risks`.
 * Each risk has `title`, `description`, `mitigation` — all authored
 * directly by GPT-5.5, grounded in the Versant context block (TSA, BB-,
 * editorial integrity, broadcast resilience, multi-entity structure).
 *
 * No fixed catalog — the legacy `PROGRAM_RISK_CATALOG` was deliberately
 * removed in v3 because risks should reflect the actual project mix in
 * the plan, not a generic boilerplate.
 */
export function ProgramRisksPanel({
  synthesis,
  bare,
}: {
  synthesis: ProgramSynthesisLLM | null;
  bare?: boolean;
}) {
  const Header = (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-lg font-semibold text-forge-ink">
          <span className="font-mono text-accent-purple-dark">&gt;</span>{" "}
          Program risks
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-forge-subtle">
          Risks specific to this AI Project mix — no generic boilerplate.
          Mitigations name the Versant towers, executives, and structural
          constraints (TSA, BB- credit, editorial floor, on-air resilience)
          that bear the weight.
        </p>
      </div>
      {synthesis ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-accent-purple/30 bg-accent-purple/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-accent-purple-dark">
          <Sparkles className="h-2.5 w-2.5" aria-hidden /> AI-authored
        </span>
      ) : null}
    </header>
  );

  const Body = !synthesis ? (
    <div className="rounded-xl border border-dashed border-forge-border bg-forge-well/40 p-8 text-center text-sm text-forge-subtle">
      Risk register pending plan generation. Click Regenerate plan to author.
    </div>
  ) : synthesis.risks.length === 0 ? (
    <div className="rounded-xl border border-forge-border bg-forge-surface p-5 text-sm text-forge-subtle">
      The synthesis pass returned no program-level risks for this scenario.
    </div>
  ) : (
    <ul className="grid gap-3 lg:grid-cols-2">
      {synthesis.risks.map((risk, idx) => (
        <li
          key={`${risk.title}-${idx}`}
          className="rounded-xl border border-forge-border bg-forge-surface p-4 shadow-sm"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle
              className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent-red"
              aria-hidden
            />
            <h3 className="font-display text-sm font-semibold text-forge-ink">
              {risk.title}
            </h3>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-forge-body">
            {risk.description}
          </p>
          <div className="mt-3 rounded-lg border border-accent-green/20 bg-accent-green/5 p-2.5">
            <div className="flex items-start gap-1.5">
              <ShieldCheck
                className="mt-0.5 h-3 w-3 flex-shrink-0 text-accent-green"
                aria-hidden
              />
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-accent-green">
                  Mitigation
                </div>
                <p className="mt-0.5 text-[11px] leading-relaxed text-forge-body">
                  {risk.mitigation}
                </p>
              </div>
            </div>
          </div>
        </li>
      ))}
    </ul>
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
