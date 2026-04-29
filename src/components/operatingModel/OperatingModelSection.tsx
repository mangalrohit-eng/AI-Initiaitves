"use client";

import * as React from "react";
import * as Icons from "lucide-react";
import type { Tower } from "@/data/types";
import { ProcessLandscape } from "./ProcessLandscape";
import { AiRoadmap } from "./AiRoadmap";
import { useInitiativeReviews } from "@/lib/initiatives/useInitiativeReviews";

export function OperatingModelSection({
  tower,
  showRoadmap = true,
}: {
  tower: Tower;
  showRoadmap?: boolean;
}) {
  const { result, reviews, actions } = useInitiativeReviews(tower);

  const totalCapabilities = result.l2s.reduce((s, l2) => s + l2.l3s.length, 0);
  const totalCurated = result.l2s.reduce((s, l2) => s + l2.curatedL4Count, 0);
  const totalPending = result.l2s.reduce(
    (s, l2) => s + l2.placeholderL4Count,
    0,
  );

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold text-forge-ink">
              L2–L4 capability tree
            </h2>
            <p className="mt-1 text-sm text-forge-subtle">
              <span className="font-medium text-forge-ink">
                {result.l2s.length}
              </span>{" "}
              work {result.l2s.length === 1 ? "category" : "categories"} ·{" "}
              <span className="font-medium text-forge-ink">
                {totalCapabilities}
              </span>{" "}
              capabilities in scope ·{" "}
              <span className="font-medium text-accent-purple-dark">
                {totalCurated}
              </span>{" "}
              AI-eligible activities
              {totalPending > 0 ? (
                <>
                  {" "}
                  ·{" "}
                  <span
                    className="text-forge-body"
                    title="Capabilities where AI couldn't identify candidate L4 activities. Expand an L3 row for remediation links."
                  >
                    {totalPending} need manual review
                  </span>
                </>
              ) : null}
            </p>
          </div>
          <p className="max-w-xl text-xs text-forge-subtle">
            L2 sub-functions include every L3 with its AI dial above zero on Step
            2. Levels L2–L4 are labeled for traceability with Step 1 and the
            Priority roadmap tab.
          </p>
        </div>

        {result.l2s.length === 0 ? (
          <EmptyL2State
            queuedRowCount={result.diagnostics.queuedRowCount}
            totalRowCount={result.diagnostics.totalRowCount}
          />
        ) : (
          <ProcessLandscape
            l2s={result.l2s}
            tower={tower}
            reviews={reviews}
            actions={actions}
          />
        )}
      </section>

      {showRoadmap ? (
        <section className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h3 className="font-display text-lg font-semibold text-forge-ink">
                AI transformation roadmap
              </h3>
              <p className="mt-1 text-sm text-forge-subtle">
                Every AI-eligible L4 activity across the tower, sequenced by
                priority. Each card links to the full four-lens initiative
                detail or the lightweight pre/post brief.
              </p>
            </div>
          </div>
          <AiRoadmap tower={tower} />
        </section>
      ) : null}
    </div>
  );
}

/**
 * Empty-state pane shown when no L2 sub-function has any AI-eligible L4 to
 * render. Differentiates the three legitimate "empty" scenarios so the
 * user always knows what to do next:
 *
 *  - `pre-upload`     — no rows at all. Direct to Step 1 to upload the map.
 *  - `awaiting-llm`   — every row is `queued` post-upload. The
 *                       StaleCurationBanner above already exposes the
 *                       Refresh CTA; this pane just confirms why the panel
 *                       is empty so the user doesn't misread the state as
 *                       "no AI opportunity."
 *  - `dials-at-zero`  — rows exist and were curated, but no L3 has its AI
 *                       dial > 0. Direct to Step 2 to raise dials.
 */
function EmptyL2State({
  queuedRowCount,
  totalRowCount,
}: {
  queuedRowCount: number;
  totalRowCount: number;
}) {
  const allQueued =
    totalRowCount > 0 && queuedRowCount === totalRowCount;
  const noRows = totalRowCount === 0;

  if (allQueued) {
    return (
      <div className="rounded-2xl border border-accent-amber/40 bg-accent-amber/5 px-5 py-8 text-center">
        <Icons.Sparkles
          className="mx-auto h-5 w-5 text-accent-amber"
          aria-hidden
        />
        <p className="mt-3 font-display text-sm font-semibold text-forge-ink">
          AI initiatives are queued for refresh.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-forge-subtle">
          The capability map was just uploaded — every L3 is waiting for a
          fresh AI eligibility scoring. Click{" "}
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
        and upload the tower&rsquo;s L1–L3 tree + headcount file to start.
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-dashed border-forge-border bg-forge-well/40 px-5 py-8 text-center text-sm text-forge-subtle">
      No L3 capability has an AI dial above zero on this tower. Open{" "}
      <span className="font-semibold text-forge-body">
        Step 2 (Configure Impact Levers)
      </span>{" "}
      and raise the AI dial on the capabilities you want to bring into the
      AI Initiatives view.
    </div>
  );
}
