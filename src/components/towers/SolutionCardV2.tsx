"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Building2, Layers, Sparkles } from "lucide-react";
import type {
  InitiativeReview,
  TowerAiReadinessIntake,
} from "@/data/assess/types";
import type {
  V6InitiativeCard,
  V6L3Row,
} from "@/lib/initiatives/selectV6";
import type { UseInitiativeReviewsV6Result } from "@/lib/initiatives/useInitiativeReviewsV6";
import { feasibilityChip } from "@/lib/feasibilityChip";
import { formatUsdCompact } from "@/lib/format";
import { useRedactDollars } from "@/lib/clientMode";
import { SolutionIcon } from "@/components/towers/SolutionIcon";
import { InitiativeReviewActionsV6 } from "@/components/towers/InitiativeReviewActionsV6";
import {
  IntakeStatusEvidencePanel,
  IntakeStatusPill,
} from "@/components/towers/IntakeStatusPill";
import { intakeStatusIsStale } from "@/lib/assess/towerReadinessIntake";
import { cn } from "@/lib/utils";
import { L3_FTE_DATA_MISSING_LABEL } from "@/lib/initiatives/attributeL3AiUsd";
import { TOWER_WORKBENCHES } from "@/data/towerWorkbenches";
import { matchCapabilitiesToInitiatives } from "@/lib/workbench/matchCapabilities";

/**
 * Redesigned per-AI-Solution card used inside `SolutionsGallery`.
 *
 * Visual hierarchy reads top-to-bottom:
 *   1. Feasibility-tinted icon tile (left rail)
 *   2. Feasibility chip + vendor pill + covers chip
 *   3. Descriptive solution title (no truncation up to ~10 words)
 *   4. Tagline subtitle (plain English, what it does + saving target)
 *   5. AI rationale (Versant-grounded justification, 2-3 lines)
 *   6. Footer: parent Job Family · Attributed AI $ (or missing-data copy) ·
 *      Validate/Reject · "Open deep dive" CTA
 *
 * The card surface is one `<Link>` to the deep-dive when
 * `initiativeHref` is set; placeholders render the same frame without
 * the link affordance so the visual rhythm of the gallery doesn't
 * shift across "real" vs "pending" cards.
 *
 * The Validate / Reject cluster lives in the footer (NOT absolutely
 * positioned over the chip row) so it never collides with a wrapped
 * vendor name like "BlackLine + FloQast". Each button stops click
 * propagation so a decision doesn't also fire the deep-dive nav.
 */
export function SolutionCardV2({
  init,
  row,
  l3Name,
  className,
  towerIconKey,
  towerId,
  review,
  actions,
  towerIntake,
}: {
  init: V6InitiativeCard;
  /** V6 L3 row — needed by the validate/reject snapshot. */
  row: V6L3Row;
  l3Name: string;
  className?: string;
  /**
   * Tower motif iconKey — passed to `<SolutionIcon>` so legacy
   * initiatives without their own `iconKey` get a domain-relevant
   * fallback rather than the generic Rocket / Compass.
   */
  towerIconKey?: string;
  /**
   * Tower id — when provided the card looks up the tower's Workbench
   * and renders a small "Surfaces in [Surface name]" caption when this
   * initiative powers a hand-authored workbench surface. Optional for
   * back-compat; caption is silent when omitted or when no surface
   * confidently matches.
   */
  towerId?: string;
  /** Tower-lead decision for this initiative (if any). */
  review?: InitiativeReview;
  /** Approve / reject / restore actions from `useInitiativeReviewsV6`. */
  actions: UseInitiativeReviewsV6Result["actions"];
  /**
   * Either the tower's current `aiReadinessIntake` OR just the latest
   * `importedAt` ISO string — used only for the staleness check on the
   * `IntakeStatusPill`. Optional so the card stays usable outside the
   * gallery (e.g. in storybook / preview surfaces).
   */
  towerIntake?: TowerAiReadinessIntake | string | null;
}) {
  const redact = useRedactDollars();
  const feas = init.isPlaceholder ? null : feasibilityChip(init.feasibility);
  const interactive = !!init.initiativeHref;
  const rejected = review?.status === "rejected";
  const intakeStatus = init.intakeStatus;
  const intakeStatusStale = intakeStatusIsStale(intakeStatus, towerIntake);
  const [intakeEvidenceOpen, setIntakeEvidenceOpen] = React.useState(false);
  const workbenchSurfaceName = React.useMemo(
    () => resolveWorkbenchSurfaceName(init, towerId),
    [init, towerId],
  );

  const Frame = (
    <div
      className={cn(
        "group relative flex h-full flex-col gap-3 rounded-2xl border bg-forge-surface/70 p-4 transition",
        init.isPlaceholder
          ? "border-dashed border-forge-border/60"
          : "border-forge-border hover:border-accent-purple/40 hover:bg-forge-surface",
        init.feasibility === "High"
          ? "shadow-[0_0_0_1px_rgba(0,191,165,0.10)]"
          : "shadow-[0_0_0_1px_rgba(255,255,255,0.02)]",
        rejected ? "opacity-70" : "",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <SolutionIcon
          iconKey={init.iconKey}
          feasibility={init.feasibility}
          size="lg"
          towerIconKey={towerIconKey}
          seed={init.id}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {feas ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-1.5 py-0 font-mono text-[10px] uppercase tracking-wider",
                  feas.badge,
                )}
                title={feas.tooltip}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", feas.dot)} />
                {feas.label}
              </span>
            ) : null}
            {init.primaryVendor ? (
              <span
                className="inline-flex items-center gap-1 rounded-full border border-forge-border bg-near-black/40 px-1.5 py-0 font-mono text-[10px] text-forge-body"
                title="Anchored vendor or stack for this solution"
              >
                <Building2 className="h-2.5 w-2.5 text-forge-hint" aria-hidden />
                {init.primaryVendor}
              </span>
            ) : null}
            {intakeStatus ? (
              <IntakeStatusPill
                intakeStatus={intakeStatus}
                expanded={intakeEvidenceOpen}
                onToggle={() => setIntakeEvidenceOpen((v) => !v)}
                stale={intakeStatusStale}
                ariaIdSuffix={init.id}
              />
            ) : null}
            {init.coversL4RowIds.length > 0 ? (
              <span
                className="inline-flex items-center gap-1 rounded-full border border-forge-border/60 px-1.5 py-0 font-mono text-[10px] text-forge-subtle"
                title="L4 Activity Groups this solution addresses inside its parent Job Family"
              >
                <Layers className="h-2.5 w-2.5 text-forge-hint" aria-hidden />
                covers {init.coversL4RowIds.length}
              </span>
            ) : null}
          </div>
          <h3
            className={cn(
              "mt-2 font-display text-base font-semibold leading-snug text-forge-ink",
              interactive ? "group-hover:text-accent-purple-light" : "",
            )}
          >
            {init.solutionName}
          </h3>
          {init.tagline ? (
            <p className="mt-1.5 text-xs leading-relaxed text-forge-body">
              {init.tagline}
            </p>
          ) : null}
          {workbenchSurfaceName ? (
            <p
              className="mt-1.5 inline-flex max-w-full items-center gap-1 rounded-full border border-accent-purple/30 bg-accent-purple/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-accent-purple-dark"
              title="This AI Solution powers a surface in this tower's Workbench."
            >
              <Sparkles className="h-2.5 w-2.5" aria-hidden />
              <span className="truncate normal-case tracking-normal">
                Surfaces in {workbenchSurfaceName}
              </span>
            </p>
          ) : null}
        </div>
      </div>
      {init.aiRationale && !init.isPlaceholder ? (
        <p className="text-[11px] leading-relaxed text-forge-subtle">
          {init.aiRationale}
        </p>
      ) : null}
      {intakeStatus && intakeEvidenceOpen ? (
        <IntakeStatusEvidencePanel
          intakeStatus={intakeStatus}
          ariaIdSuffix={init.id}
          stale={intakeStatusStale}
        />
      ) : null}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-forge-border/60 pt-3 text-[11px] text-forge-subtle">
        <span className="inline-flex min-w-0 items-center gap-1.5 truncate font-mono uppercase tracking-[0.16em] text-forge-hint">
          <span className="text-accent-purple-light">&gt;</span>
          <span className="truncate normal-case tracking-normal">{l3Name}</span>
          {!redact && !init.isPlaceholder ? (
            init.l3FteDataMissing && init.attributedAiUsd <= 0 ? (
              <span
                className="ml-1 max-w-[14rem] truncate font-mono text-[10px] font-normal normal-case tracking-normal text-forge-body"
                title={L3_FTE_DATA_MISSING_LABEL}
              >
                · {L3_FTE_DATA_MISSING_LABEL}
              </span>
            ) : (
              <span
                className="ml-1 font-mono tabular-nums normal-case tracking-normal text-forge-body"
                title={`Job Family modeled AI $ (program tier): ${formatUsdCompact(row.aiUsd, { decimals: 1 })}`}
              >
                · {formatUsdCompact(init.attributedAiUsd, { decimals: 1 })}{" "}
                <span className="text-forge-hint">Attributed AI $</span>
              </span>
            )
          ) : null}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          <InitiativeReviewActionsV6
            init={init}
            row={row}
            review={review}
            actions={actions}
          />
          {interactive ? (
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-full border border-accent-purple/40 bg-accent-purple/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-accent-purple-light",
                "transition group-hover:border-accent-purple group-hover:bg-accent-purple group-hover:text-white",
              )}
            >
              Open deep dive
              <ArrowUpRight className="h-3 w-3" aria-hidden />
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );

  if (!interactive) return Frame;
  return (
    <Link
      href={init.initiativeHref!}
      className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-purple/40 rounded-2xl"
      title={`Open the full 4-lens deep dive for ${init.solutionName}`}
    >
      {Frame}
    </Link>
  );
}

/**
 * Resolve which hand-authored Workbench surface this initiative powers,
 * if any. Uses the same fuzzy-match helper as the Workbench view so a
 * surface card and a solution card agree on the linkage. Returns the
 * surface display name or `null` when no confident match exists or
 * when `towerId` was not provided.
 */
function resolveWorkbenchSurfaceName(
  init: V6InitiativeCard,
  towerId: string | undefined,
): string | null {
  if (!towerId || init.isPlaceholder) return null;
  const workbench = TOWER_WORKBENCHES[towerId];
  if (!workbench) return null;
  for (const surface of workbench.surfaces) {
    const matches = matchCapabilitiesToInitiatives(
      surface.poweredByCapabilities,
      [init],
    );
    if (matches.some((m) => m.init?.id === init.id)) {
      return surface.name;
    }
  }
  return null;
}
