import * as React from "react";
import { Sparkles, Check } from "lucide-react";
import type { SolutionBrief } from "@/data/types";
import { SectionShell } from "./sectionShell";

/**
 * Section A — what exactly the AI Solution does.
 *
 * Headline answers the question in 1-2 plain-English sentences;
 * capability bullets enumerate the named capabilities the agent layer
 * delivers. Pulled from `solutionBrief.whatItDoes` (fallback derived
 * from `Process.work.post.description` and `Process.work.keyShifts`).
 */
export function WhatItDoesSection({
  brief,
  painPoints,
}: {
  brief: SolutionBrief;
  /** Optional pain-point list to surface as the "why this exists" rail. */
  painPoints?: string[];
}) {
  const { headline, capabilities } = brief.whatItDoes;
  const trimmedPainPoints = (painPoints ?? [])
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, 4);

  return (
    <SectionShell letter="A" title="What this solution does">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div>
          <p className="text-base leading-relaxed text-forge-body">
            {headline}
          </p>
          <h3 className="mt-5 font-display text-sm font-semibold uppercase tracking-[0.14em] text-forge-hint">
            Capabilities
          </h3>
          <ul className="mt-3 space-y-2.5">
            {capabilities.map((cap, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-accent-purple/40 bg-accent-purple/10">
                  <Check
                    className="h-3 w-3 text-accent-purple-light"
                    aria-hidden
                  />
                </span>
                <span className="text-sm leading-relaxed text-forge-body">
                  {cap}
                </span>
              </li>
            ))}
          </ul>
        </div>
        {trimmedPainPoints.length > 0 ? (
          <aside className="rounded-xl border border-forge-border/60 bg-near-black/30 p-4">
            <h4 className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-forge-hint">
              <Sparkles className="h-3 w-3 text-accent-purple-light" aria-hidden />
              Why this exists
            </h4>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-forge-subtle">
              {trimmedPainPoints.map((p, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-accent-amber" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </aside>
        ) : null}
      </div>
    </SectionShell>
  );
}
