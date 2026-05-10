import * as React from "react";
import { FileSpreadsheet } from "lucide-react";
import type { SolutionBrief } from "@/data/types";
import { SectionShell } from "./sectionShell";

/**
 * Section B — How it will work.
 *
 * Numbered narrative steps that walk a non-technical exec through the
 * end-to-end flow. When the tower lead's Excel readiness questionnaire
 * was used to ground a step, short pull-quote citations surface in a
 * sidebar so the audience can see the LLM didn't make it up.
 */
export function HowItWorksSection({ brief }: { brief: SolutionBrief }) {
  const { steps, intakeCitations } = brief.howItWorks;
  const citations = (intakeCitations ?? [])
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, 3);

  return (
    <SectionShell
      letter="B"
      title="How it will work"
      subtitle="End-to-end flow in plain language"
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
        <ol className="space-y-3">
          {steps.map((step, i) => (
            <li
              key={i}
              className="flex gap-3 rounded-xl border border-forge-border/60 bg-near-black/30 p-3.5"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-purple/15 font-mono text-xs font-semibold text-accent-purple-light">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <h3 className="font-display text-sm font-semibold text-forge-ink">
                  {step.title}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-forge-body">
                  {step.detail}
                </p>
              </div>
            </li>
          ))}
        </ol>
        {citations.length > 0 ? (
          <aside className="rounded-xl border border-accent-purple/30 bg-accent-purple/5 p-4">
            <h4 className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-accent-purple-light">
              <FileSpreadsheet className="h-3 w-3" aria-hidden />
              From tower questionnaire
            </h4>
            <ul className="mt-3 space-y-2.5">
              {citations.map((q, i) => (
                <li
                  key={i}
                  className="border-l-2 border-accent-purple/40 pl-2.5 text-[11px] italic leading-relaxed text-forge-subtle"
                >
                  &ldquo;{q}&rdquo;
                </li>
              ))}
            </ul>
          </aside>
        ) : null}
      </div>
    </SectionShell>
  );
}
