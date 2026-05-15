"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Circle,
  Globe2,
  Lock,
  Sparkles,
} from "lucide-react";
import { ProgramToolsDrawer } from "@/components/assess/ProgramToolsDrawer";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { PageShell } from "@/components/PageShell";
import { ScreenGuidanceBar } from "@/components/guidance/ScreenGuidanceBar";
import { useGuidanceOffshoreHub } from "@/lib/guidance/useJourneyGuidance";
import { Term } from "@/components/help/Term";
import { towers } from "@/data/towers";
import {
  getAssessProgram,
  getAssessProgramHydrationSnapshot,
  getMyTowers,
  subscribe,
} from "@/lib/localStore";
import type { AssessProgramV2, TowerId } from "@/data/assess/types";
import { getTowerHref } from "@/lib/towerHref";
import {
  countUnreviewedOffshoreRows,
  isOffshoreClassificationLocked,
} from "@/lib/assess/offshoreViewStepStatus";
import { rollupSplit } from "@/lib/offshore/offshoreSplit";
import { LeadDeadlineChip } from "@/components/program/LeadDeadlineChip";

type RowStatus =
  | "not-started"
  | "in-progress"
  | "unreviewed"
  | "reviewed"
  | "locked";

function rowStatus(program: AssessProgramV2, towerId: TowerId): RowStatus {
  const t = program.towers[towerId];
  if (!t || !t.l4Rows.length) return "not-started";
  if (isOffshoreClassificationLocked(t)) return "locked";
  const unreviewed = countUnreviewedOffshoreRows(t);
  if (unreviewed === t.l4Rows.length) return "in-progress";
  if (unreviewed > 0) return "unreviewed";
  return "reviewed";
}

function statusCopy(s: RowStatus): { label: string; className: string } {
  if (s === "locked")
    return { label: "Step 2 locked by Tower Lead", className: "text-accent-green" };
  if (s === "reviewed")
    return { label: "Every L4 classified", className: "text-accent-green" };
  if (s === "unreviewed")
    return { label: "Some L4 rows still on seed", className: "text-accent-amber" };
  if (s === "in-progress")
    return { label: "Capability map confirmed", className: "text-accent-amber" };
  return { label: "Confirm capability map first", className: "text-forge-subtle" };
}

/**
 * Step 2 hub — Offshore Plan.
 *
 * Mirrors the Capability Map and Configure Impact Levers hubs. Shows the
 * program-wide retained vs GCC India split (HC-weighted across every tower
 * with rows), counters for towers locked / unreviewed / not started, and a
 * tower grid that opens each tower's per-tower Offshore View. The tower
 * grid surfaces the per-tower split plus the Step 2 deadline chip.
 */
export function OffshoreViewHubClient() {
  const offshoreHubGuidance = useGuidanceOffshoreHub();
  const [program, setProgram] = React.useState<AssessProgramV2>(() =>
    getAssessProgramHydrationSnapshot(),
  );
  const [mine, setMine] = React.useState<TowerId[]>([]);

  React.useEffect(() => {
    setProgram(getAssessProgram());
    return subscribe("assessProgram", () => setProgram(getAssessProgram()));
  }, []);
  React.useEffect(() => {
    setMine(getMyTowers());
    return subscribe("myTowers", () => setMine(getMyTowers()));
  }, []);

  const minePicked = mine.length > 0;
  const orderedTowers = React.useMemo(() => {
    if (!minePicked) return towers;
    const mineSet = new Set(mine);
    const minedFirst = towers.filter((t) => mineSet.has(t.id as TowerId));
    const rest = towers.filter((t) => !mineSet.has(t.id as TowerId));
    return [...minedFirst, ...rest];
  }, [mine, minePicked]);

  const statuses = orderedTowers.map((tw) => ({
    tower: tw,
    status: rowStatus(program, tw.id as TowerId),
    isMine: minePicked && mine.includes(tw.id as TowerId),
  }));

  const lockedCount = statuses.filter((s) => s.status === "locked").length;
  const reviewedCount = statuses.filter(
    (s) => s.status === "reviewed" || s.status === "locked",
  ).length;
  const inProgressCount = statuses.filter(
    (s) => s.status === "in-progress" || s.status === "unreviewed",
  ).length;
  const notStartedCount = statuses.filter((s) => s.status === "not-started").length;

  const programSplit = React.useMemo(() => {
    const allRows = orderedTowers.flatMap(
      (tw) => program.towers[tw.id as TowerId]?.l4Rows ?? [],
    );
    return rollupSplit(allRows);
  }, [orderedTowers, program]);

  const hasAnyData = reviewedCount + inProgressCount > 0;

  const nextRecommended = React.useMemo(() => {
    const inProgress = statuses.find(
      (s) => s.status === "unreviewed" || s.status === "in-progress",
    );
    if (inProgress) return inProgress.tower;
    return (
      statuses.find((s) => s.status === "reviewed")?.tower ??
      statuses.find((s) => s.status === "not-started")?.tower ??
      null
    );
  }, [statuses]);

  return (
    <PageShell>
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <Breadcrumbs
          items={[
            { label: "Program home", href: "/" },
            { label: "Offshore Plan" },
          ]}
        />
        <ScreenGuidanceBar guidance={offshoreHubGuidance} className="mt-3" />
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-accent-purple/30 bg-accent-purple/5 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-accent-purple-dark">
              <span className="font-mono">&gt;</span>
              Step 2 — Offshore Plan
            </div>
            <h1 className="mt-2 font-display text-3xl font-semibold text-forge-ink">
              &gt; Tower Offshore Plan
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-forge-body">
              For each tower, classify every <Term termKey="l4">L4 Activity Group</Term>{" "}
              as Retained or GCC India. The split set here locks the
              offshore footprint that feeds the{" "}
              <Link href="/impact-levers" className="text-accent-purple-dark underline">
                Configure Impact Levers
              </Link>{" "}
              dials in Step 3.
            </p>
          </div>
          <Link
            href="/capability-map"
            className="inline-flex items-center gap-1.5 rounded-lg border border-forge-border bg-forge-surface px-3 py-1.5 text-xs text-forge-body hover:border-accent-purple/40"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Capability Map
          </Link>
        </div>

        {/* KEY METRICS — top of page */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <ScoreboardTile
            label="Total HC"
            value={
              programSplit.totalHc > 0
                ? programSplit.totalHc.toLocaleString()
                : "—"
            }
          />
          <ScoreboardTile
            label="Retained / GCC"
            value={
              programSplit.totalHc > 0
                ? `${100 - programSplit.gccPct}% / ${programSplit.gccPct}%`
                : "— / —"
            }
            valueClassName="text-accent-purple-dark"
          />
          <ScoreboardTile
            label="Towers locked"
            value={`${lockedCount} / ${towers.length}`}
            valueClassName="text-accent-green"
          />
          <ScoreboardTile
            label="In progress"
            value={
              inProgressCount > 0
                ? `${inProgressCount} tower${inProgressCount === 1 ? "" : "s"}`
                : "0"
            }
            valueClassName={
              inProgressCount > 0 ? "text-accent-amber" : "text-forge-body"
            }
          />
        </div>

        {/* Hero CTA — empty state */}
        {!hasAnyData ? (
          <div className="mt-6 rounded-2xl border border-accent-purple/40 bg-accent-purple/5 p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-xl">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-accent-purple/15 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-accent-purple-dark">
                  <Sparkles className="h-3 w-3" />
                  Start here
                </div>
                <h2 className="mt-2 font-display text-lg font-semibold text-forge-ink">
                  Confirm a capability map first
                </h2>
                <p className="mt-1 text-sm text-forge-body">
                  The Offshore Plan needs an L1–L4 tree and headcount. Open Step 1
                  for any tower, confirm its capability map, then return here.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href="/capability-map"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-accent-purple/40 bg-accent-purple/10 px-3 py-2 text-sm font-medium text-accent-purple-dark hover:bg-accent-purple/20"
                >
                  Open Capability Map
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        ) : null}

        {/* Next recommended */}
        {hasAnyData && nextRecommended ? (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-forge-border bg-forge-surface/70 p-4">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-forge-subtle">
                Next recommended
              </div>
              <div className="mt-0.5 text-sm font-medium text-forge-ink">
                {nextRecommended.name}
                {minePicked && mine.includes(nextRecommended.id as TowerId) ? (
                  <span className="ml-2 rounded-full bg-accent-purple/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-accent-purple-dark">
                    Mine
                  </span>
                ) : null}
              </div>
              <div className="text-xs text-forge-subtle">
                Open the Offshore Plan for this tower and set the Retained vs GCC
                split on each L4 row.
              </div>
            </div>
            <Link
              href={getTowerHref(nextRecommended.id as TowerId, "offshore-view")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent-purple px-4 py-2 text-sm font-medium text-white hover:bg-accent-purple-dark"
            >
              Open Offshore Plan
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : null}

        {/* Tower grid */}
        <div className="mt-8 flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id="tower-list"
            className="font-display text-sm font-semibold uppercase tracking-wider text-forge-subtle"
          >
            &gt; Towers ({towers.length}){minePicked ? " · my towers first" : ""}
          </h2>
          <span className="font-mono text-[11px] tabular-nums text-forge-hint">
            {lockedCount} locked · {reviewedCount - lockedCount} reviewed ·{" "}
            {inProgressCount} in progress · {notStartedCount} not started
          </span>
        </div>
        <ul
          className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3"
          role="list"
        >
          {statuses.map(({ tower: tw, status, isMine }) => {
            const tid = tw.id as TowerId;
            const sc = statusCopy(status);
            const t = program.towers[tid];
            const split = t ? rollupSplit(t.l4Rows) : null;
            const disabled = status === "not-started";
            const href = disabled
              ? getTowerHref(tid, "capability-map")
              : getTowerHref(tid, "offshore-view");
            const isLocked = status === "locked";

            return (
              <li key={tw.id} className="relative">
                <Link
                  href={href}
                  className={
                    "group flex h-full flex-col gap-1.5 rounded-xl border p-3 transition " +
                    (isLocked
                      ? "border-accent-green/30 bg-accent-green/5 hover:border-accent-green/55"
                      : isMine
                        ? "border-accent-purple/30 bg-forge-surface hover:border-accent-purple/55 hover:bg-accent-purple/5"
                        : "border-forge-border bg-forge-surface hover:border-accent-purple/35 hover:bg-forge-well/40")
                  }
                >
                  <div className="flex min-w-0 items-start gap-1.5 pr-1">
                    {isMine ? (
                      <span
                        className="shrink-0 rounded-full bg-accent-purple/15 px-1.5 py-0.5 font-mono text-[9px] font-medium uppercase tracking-wider text-accent-purple-dark"
                        title="Marked as one of your towers"
                      >
                        Mine
                      </span>
                    ) : null}
                    <span className="min-w-0 flex-1 truncate font-display text-sm font-semibold text-forge-ink">
                      {tw.name}
                    </span>
                    {isLocked ? (
                      <Lock
                        className="h-3 w-3 shrink-0 text-accent-green"
                        aria-hidden
                      />
                    ) : null}
                  </div>
                  <div className={`flex flex-wrap items-center gap-2 text-[11px] ${sc.className}`}>
                    {status === "reviewed" || status === "locked" ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <Circle className="h-3 w-3" />
                    )}
                    <span className="truncate">{sc.label}</span>
                    <LeadDeadlineChip
                      towerName={tw.name}
                      towerId={tid}
                      step={2}
                      program={program}
                    />
                  </div>

                  {split && split.totalHc > 0 ? (
                    <div className="mt-1 grid grid-cols-2 gap-1.5 text-[10px]">
                      <div className="rounded-md border border-forge-border bg-forge-page/40 px-1.5 py-1">
                        <div className="font-mono text-[9px] uppercase tracking-wider text-forge-hint">
                          HC
                        </div>
                        <div className="font-mono text-[11px] tabular-nums text-forge-body">
                          {split.totalHc.toLocaleString()}
                        </div>
                      </div>
                      <div className="rounded-md border border-forge-border bg-forge-page/40 px-1.5 py-1">
                        <div className="font-mono text-[9px] uppercase tracking-wider text-forge-hint">
                          Retained / GCC
                        </div>
                        <div className="font-mono text-[11px] tabular-nums text-accent-purple-dark">
                          {100 - split.gccPct}% / {split.gccPct}%
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-[11px] font-medium text-accent-purple-dark group-hover:text-accent-purple">
                      {disabled
                        ? "Open capability map"
                        : isLocked
                          ? "Review"
                          : status === "reviewed"
                            ? "Lock Step 2"
                            : "Continue"}
                      <ArrowRight className="ml-0.5 inline h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>

        <ProgramToolsDrawer />
      </div>
    </PageShell>
  );
}

function ScoreboardTile({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-xl border border-forge-border bg-forge-surface p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-forge-hint">
        <Globe2 className="h-3 w-3" aria-hidden />
        {label}
      </div>
      <div
        className={
          "mt-1 font-mono text-lg font-semibold tabular-nums " +
          (valueClassName ?? "text-forge-ink")
        }
      >
        {value}
      </div>
    </div>
  );
}
