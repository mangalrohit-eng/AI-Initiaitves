"use client";

import * as React from "react";
import * as Icons from "lucide-react";
import type { Tower } from "@/data/types";
import { ProcessLandscapeV6 } from "./ProcessLandscapeV6";
import { AiRoadmapV6 } from "./AiRoadmapV6";
import { useTowerInitiativesV6 } from "@/lib/initiatives/useTowerInitiativesV6";
import { TowerReadinessIntakePanel } from "./TowerReadinessIntakePanel";

/**
 * Per-tower AI Solutions section.
 *
 * Loops `l3Rows` (the dial-bearing row) and renders one card per L3 Job
 * Family with 1..N specific AI Solutions hanging off it (no L4 Activity
 * Group / L5 Activity tree). Cross-tower priority lives on the
 * Cross-Tower AI Plan page; the per-tower view shows the binary
 * feasibility signal via `AiRoadmapV6`.
 */
export function OperatingModelSection({
  tower,
  showRoadmap = true,
}: {
  tower: Tower;
  showRoadmap?: boolean;
}) {
  const result = useTowerInitiativesV6(tower);

  const totalJobFamilies = result.l3Rows.length;
  const totalActivityGroups = result.l3Rows.reduce(
    (s, r) => s + r.childL4Names.length,
    0,
  );
  const totalSolutions = result.diagnostics.initiativesRendered;
  const totalPlaceholders = result.diagnostics.placeholderRows;

  return (
    <div className="space-y-10">
      <TowerReadinessIntakePanel tower={tower} />
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold text-forge-ink">
              &gt; AI Solutions by Job Family
            </h2>
            <p className="mt-1 text-sm text-forge-subtle">
              <span className="font-medium text-forge-ink">
                {totalJobFamilies}
              </span>{" "}
              Job {totalJobFamilies === 1 ? "Family" : "Families"} ·{" "}
              <span className="font-medium text-forge-ink">
                {totalActivityGroups}
              </span>{" "}
              Activity {totalActivityGroups === 1 ? "Group" : "Groups"} in
              scope ·{" "}
              <span className="font-medium text-accent-purple-dark">
                {totalSolutions}
              </span>{" "}
              specific AI Solution{totalSolutions === 1 ? "" : "s"}
              {totalPlaceholders > 0 ? (
                <>
                  {" "}
                  ·{" "}
                  <span
                    className="text-forge-body"
                    title="Job Families where the AI couldn't surface a specific solution. Refresh AI guidance to retry."
                  >
                    {totalPlaceholders} need refresh
                  </span>
                </>
              ) : null}
            </p>
          </div>
          <p className="max-w-xl text-xs text-forge-subtle">
            Each Job Family (L3) has its dial-bearing impact set on Step 2 and
            generates 1–3 specific AI Solutions Versant could build or buy.
            Click a solution to open the full 4-lens deep dive.
          </p>
        </div>

        {result.l3Rows.length === 0 ? (
          <EmptyL3State
            queuedRowCount={result.diagnostics.queuedRowCount}
            totalRowCount={result.diagnostics.totalRowCount}
          />
        ) : (
          <ProcessLandscapeV6 result={result} />
        )}
      </section>

      {showRoadmap ? (
        <section className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h3 className="font-display text-lg font-semibold text-forge-ink">
                Feasibility roster
              </h3>
              <p className="mt-1 text-sm text-forge-subtle">
                Every AI Solution across the tower, grouped by feasibility.
                Final program priority lives on the Cross-Tower AI Plan via
                the feasibility × business-impact 2x2.
              </p>
            </div>
          </div>
          <AiRoadmapV6 tower={tower} />
        </section>
      ) : null}
    </div>
  );
}

/**
 * Empty-state pane shown when no L3 has any AI-eligible Solution to
 * render. Differentiates the three legitimate "empty" scenarios so the
 * user always knows what to do next:
 *
 *  - `pre-upload`     — no rows at all. Direct to Step 1 to upload the map.
 *  - `awaiting-llm`   — every row is `queued` post-upload. The
 *                       StaleCurationBanner above already exposes the
 *                       Refresh CTA; this pane just confirms why the panel
 *                       is empty so the user doesn't misread the state as
 *                       "no AI opportunity."
 *  - `dials-at-zero`  — rows exist and were curated, but no L3 Job Family
 *                       has its AI dial > 0. Direct to Step 2 to raise dials.
 */
function EmptyL3State({
  queuedRowCount,
  totalRowCount,
}: {
  queuedRowCount: number;
  totalRowCount: number;
}) {
  const allQueued = totalRowCount > 0 && queuedRowCount === totalRowCount;
  const noRows = totalRowCount === 0;

  if (allQueued) {
    return (
      <div className="rounded-2xl border border-accent-amber/40 bg-accent-amber/5 px-5 py-8 text-center">
        <Icons.Sparkles
          className="mx-auto h-5 w-5 text-accent-amber"
          aria-hidden
        />
        <p className="mt-3 font-display text-sm font-semibold text-forge-ink">
          AI Solutions are queued for refresh.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-forge-subtle">
          The capability map was just uploaded — every Job Family is waiting
          for a fresh AI Solution scoring. Click{" "}
          <span className="font-semibold text-accent-amber">
            Refresh AI guidance
          </span>{" "}
          in the banner above to populate this view.
        </p>
      </div>
    );
  }
  if (noRows) {
    return (
      <div className="rounded-2xl border border-dashed border-forge-border bg-forge-well/40 px-5 py-8 text-center text-sm text-forge-subtle">
        No capability map uploaded yet for this tower. Open{" "}
        <span className="font-semibold text-forge-body">
          Step 1 (Capability Map)
        </span>{" "}
        and upload the tower&rsquo;s L1–L4 hierarchy + headcount file to start.
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-dashed border-forge-border bg-forge-well/40 px-5 py-8 text-center text-sm text-forge-subtle">
      No L3 Job Family has an AI dial above zero on this tower. Open{" "}
      <span className="font-semibold text-forge-body">
        Step 2 (Configure Impact Levers)
      </span>{" "}
      and raise the AI dial on the Job Families you want to bring into the AI
      Solutions view.
    </div>
  );
}
