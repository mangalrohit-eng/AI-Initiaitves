"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, CalendarClock, Compass, Rocket } from "lucide-react";
import type { Tower, Feasibility } from "@/data/types";
import { cn, slugify } from "@/lib/utils";
import { feasibilityChip } from "@/lib/feasibilityChip";
import { useInitiativeReviews } from "@/lib/initiatives/useInitiativeReviews";
import type { InitiativeL3, InitiativeL4 } from "@/lib/initiatives/select";
import type { UseInitiativeReviewsResult } from "@/lib/initiatives/useInitiativeReviews";
import type { InitiativeReview, L4WorkforceRow, TowerId } from "@/data/assess/types";
import {
  getAssessProgram,
  subscribe,
} from "@/lib/localStore";
import {
  intakeHasMinimumSubstance,
  rowCurationUsesCurrentIntake,
  TOWER_READINESS_ATTRIBUTION_LABEL,
} from "@/lib/assess/towerReadinessIntake";
import { formatUsdCompact } from "@/lib/format";
import { useRedactDollars } from "@/lib/clientMode";
import { InitiativeReviewActions } from "./InitiativeReviewActions";

/**
 * Per-tower feasibility roster.
 *
 * Step 4 deliberately does NOT show P1/P2/P3 priority chips — program
 * priority is owned by the cross-tower 2x2 (feasibility × parent-L4
 * Activity Group business impact) and lives on the Cross-Tower AI Plan
 * page. Instead, we
 * surface the binary feasibility signal locally so a tower lead can scan
 * for ship-ready bets vs. ones that need more investigation, and trust
 * that the program tiering will reconcile across towers downstream.
 */

type RoadmapItem = {
  l4: InitiativeL4;
  l3: InitiativeL3;
};

type FeasibilityColumn = {
  key: Feasibility;
  title: string;
  subtitle: string;
  items: RoadmapItem[];
  iconBg: string;
  Icon: typeof Rocket;
};

function RoadmapCard({
  tower,
  item,
  index,
  review,
  actions,
  showQuestionnaireAttribution,
}: {
  tower: Tower;
  item: RoadmapItem;
  index: number;
  review: InitiativeReview | undefined;
  actions: UseInitiativeReviewsResult["actions"];
  showQuestionnaireAttribution: boolean;
}) {
  const redact = useRedactDollars();
  const { l4, l3 } = item;
  const initiative = l4.initiativeId
    ? tower.processes.find((p) => p.id === l4.initiativeId)
    : undefined;
  const initiativeHref = initiative
    ? `/tower/${tower.id}/process/${slugify(initiative.name)}`
    : undefined;
  const briefHref = l4.briefSlug
    ? `/tower/${tower.id}/brief/${l4.briefSlug}`
    : l4.llmBriefHref;
  const briefIsLLM = !l4.briefSlug && Boolean(l4.llmBriefHref);
  const isLink = Boolean(initiativeHref || briefHref);

  const body = (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.3, ease: "easeOut" }}
      className={cn(
        "group relative rounded-xl border border-forge-border bg-forge-surface p-4 shadow-sm transition",
        isLink ? "hover:border-accent-purple/50 hover:shadow-card" : "",
        l4.isPlaceholder ? "border-dashed" : "",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div
            className={cn(
              "text-sm font-semibold",
              l4.isPlaceholder
                ? "italic text-forge-subtle"
                : "text-forge-ink group-hover:text-accent-purple-dark",
            )}
          >
            {l4.name}
          </div>
          <div className="mt-1 text-[11px] uppercase tracking-wide text-forge-hint">
            {l3.l2Name} · {l3.l3.name}
          </div>
        </div>
        {isLink ? (
          <ArrowUpRight className="h-4 w-4 shrink-0 text-forge-hint transition group-hover:text-accent-purple" />
        ) : l4.isPlaceholder ? (
          <CalendarClock className="h-4 w-4 shrink-0 text-forge-hint" />
        ) : null}
      </div>

      {l4.aiRationale ? (
        <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-forge-body">
          {l4.aiRationale}
        </p>
      ) : null}
      {showQuestionnaireAttribution ? (
        <p className="mt-1.5 text-[10px] leading-snug text-forge-hint">
          {TOWER_READINESS_ATTRIBUTION_LABEL}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-forge-subtle">
        {!redact ? (
          <span className="rounded-full border border-forge-border bg-forge-well px-2 py-0.5 font-mono tabular-nums text-forge-ink">
            {formatUsdCompact(l3.aiUsd)} AI $
          </span>
        ) : null}
        {initiative ? (
          <span className="rounded-full border border-forge-border bg-forge-well px-2 py-0.5">
            {initiative.agents.length} agents
          </span>
        ) : null}
        {l4.frequency ? (
          <span className="rounded-full border border-forge-border bg-forge-well px-2 py-0.5">
            {l4.frequency}
          </span>
        ) : null}
        {l4.isPlaceholder ? (
          <span
            className="rounded-full border border-forge-border bg-forge-well px-2 py-0.5"
            title="AI couldn't identify L5 Activities that are candidates for AI here. Regenerate the L5 Activity list on Step 1, or reduce the AI dial for this L4 Activity Group to zero on Step 2."
          >
            No AI candidates
          </span>
        ) : null}
        <InitiativeReviewActions
          l4={l4}
          l3={l3}
          review={review}
          actions={actions}
          compact
          className="ml-auto"
        />
      </div>
    </motion.div>
  );

  if (initiativeHref) {
    return (
      <Link href={initiativeHref} className="block">
        {body}
      </Link>
    );
  }
  if (briefHref) {
    return (
      <Link
        href={briefHref}
        className="block"
        title={
          briefIsLLM
            ? "Generate a Versant-grounded LLM brief for this capability"
            : "Open the lightweight pre/post brief"
        }
      >
        {body}
      </Link>
    );
  }
  return body;
}

export function AiRoadmap({ tower }: { tower: Tower }) {
  const { result, reviews, actions } = useInitiativeReviews(tower);
  const [programAssess, setProgramAssess] = React.useState(() => getAssessProgram());
  React.useEffect(() => {
    setProgramAssess(getAssessProgram());
    return subscribe("assessProgram", () => setProgramAssess(getAssessProgram()));
  }, []);

  const intake = programAssess.towers[tower.id as TowerId]?.aiReadinessIntake;
  const rowById = React.useMemo(() => {
    const m = new Map<string, L4WorkforceRow>();
    for (const r of programAssess.towers[tower.id as TowerId]?.l4Rows ?? []) {
      m.set(r.id, r);
    }
    return m;
  }, [programAssess, tower.id]);

  const grouped: Record<Feasibility, RoadmapItem[]> = { High: [], Low: [] };
  for (const l2 of result.l2s) {
    for (const l3 of l2.l3s) {
      for (const l4 of l3.l4s) {
        if (l4.isPlaceholder) continue;
        if (!l4.feasibility) continue;
        grouped[l4.feasibility].push({ l4, l3 });
      }
    }
  }

  const totalAi = grouped.High.length + grouped.Low.length;

  if (totalAi === 0) {
    const { queuedRowCount, totalRowCount } = result.diagnostics;
    const allQueued = totalRowCount > 0 && queuedRowCount === totalRowCount;
    const noRows = totalRowCount === 0;
    if (allQueued) {
      return (
        <div className="rounded-2xl border border-accent-amber/40 bg-accent-amber/5 px-5 py-8 text-center">
          <p className="font-display text-sm font-semibold text-forge-ink">
            Roster is queued for refresh.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-forge-subtle">
            Click{" "}
            <span className="font-semibold text-accent-amber">
              Refresh AI guidance
            </span>{" "}
            in the banner above, or use{" "}
            <span className="font-semibold text-accent-purple-dark">
              Regenerate AI guidance
            </span>{" "}
            if you are rescoring Activity Groups with an AI dial above zero
            without changing the map. The roster populates once each L5 Activity
            carries a feasibility verdict.
          </p>
        </div>
      );
    }
    if (noRows) {
      return (
        <div className="rounded-2xl border border-dashed border-forge-border bg-forge-well/40 px-5 py-8 text-center text-sm text-forge-subtle">
          No capability map uploaded yet. Open{" "}
          <span className="font-semibold text-forge-body">
            Step 1 (Capability Map)
          </span>{" "}
          and upload the tower&rsquo;s L1–L4 hierarchy + headcount file to begin.
        </div>
      );
    }
    return (
      <div className="rounded-2xl border border-dashed border-forge-border bg-forge-well/40 px-5 py-8 text-center text-sm text-forge-subtle">
        No L5 Activities have been scored for feasibility yet. Open{" "}
        <span className="font-semibold text-forge-body">
          Step 2 (Configure Impact Levers)
        </span>{" "}
        and raise the AI dial on the Activity Groups you want surfaced into
        the cross-tower 2x2.
      </div>
    );
  }

  const columns: FeasibilityColumn[] = [
    {
      key: "High",
      title: "Ship-ready",
      subtitle:
        "High feasibility — proven Versant platform / pattern; first-half-year ship.",
      items: grouped.High,
      iconBg: "from-accent-teal to-emerald-500",
      Icon: Rocket,
    },
    {
      key: "Low",
      title: "Investigate",
      subtitle:
        "Lower feasibility — needs platform stand-up, deeper integration, or change management.",
      items: grouped.Low,
      iconBg: "from-slate-500 to-slate-700",
      Icon: Compass,
    },
  ];

  return (
    <div className="space-y-3">
      <p className="rounded-xl border border-forge-border bg-forge-well/40 px-3 py-2 text-[11px] leading-relaxed text-forge-subtle">
        <span className="font-mono text-accent-purple-dark">&gt;</span>{" "}
        Per-tower roster groups by{" "}
        <span className="font-semibold text-forge-body">feasibility</span>.
        Final program priority (P1 / P2 / P3) is set on the{" "}
        <span className="font-semibold text-forge-body">Cross-Tower AI Plan</span>{" "}
        via the feasibility × business-impact 2x2 — that view reconciles
        sequencing across all 13 towers.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        {columns.map((col) => {
          const chip = feasibilityChip(col.key);
          const Icon = col.Icon;
          return (
            <div
              key={col.key}
              className="flex flex-col rounded-2xl border border-forge-border bg-forge-surface p-4 shadow-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm",
                      col.iconBg,
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <div>
                    <div className="font-display text-sm font-semibold text-forge-ink">
                      {col.title}
                    </div>
                    <div className="text-[11px] text-forge-subtle">
                      {col.subtitle}
                    </div>
                  </div>
                </div>
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px] font-mono tabular-nums",
                    chip.badge,
                  )}
                >
                  {col.items.length}
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {col.items.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-forge-border bg-forge-surface/60 p-4 text-center text-xs text-forge-hint">
                    No activities in this band yet.
                  </div>
                ) : (
                  col.items.map((item, i) => {
                    const wfRow = rowById.get(item.l3.rowId);
                    const showQuestionnaireAttribution =
                      intakeHasMinimumSubstance(intake) &&
                      rowCurationUsesCurrentIntake(wfRow, intake);
                    return (
                      <RoadmapCard
                        key={item.l4.id}
                        tower={tower}
                        item={item}
                        index={i}
                        review={reviews[item.l4.id]}
                        actions={actions}
                        showQuestionnaireAttribution={showQuestionnaireAttribution}
                      />
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
