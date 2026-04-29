"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Circle,
  Sliders,
} from "lucide-react";
import { AssessmentScoreboard } from "@/components/assess/AssessmentScoreboard";
import { ImpactHero } from "@/components/assess/ImpactHero";
import { ProgramToolsDrawer } from "@/components/assess/ProgramToolsDrawer";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { PageShell } from "@/components/PageShell";
import { ScreenGuidanceBar } from "@/components/guidance/ScreenGuidanceBar";
import { useGuidanceImpactHub } from "@/lib/guidance/useJourneyGuidance";
import { Term } from "@/components/help/Term";
import { towers } from "@/data/towers";
import {
  getAssessProgram,
  getAssessProgramHydrationSnapshot,
  getMyTowers,
  subscribe,
} from "@/lib/localStore";
import type { AssessProgramV2, TowerId } from "@/data/assess/types";
import {
  rowAnnualCost,
  towerOutcomeForState,
  weightedTowerLevers,
} from "@/lib/assess/scenarioModel";
import { getTowerHref } from "@/lib/towerHref";
import { formatMoney } from "@/components/ui/MoneyCounter";
import { LeadDeadlineChip } from "@/components/program/LeadDeadlineChip";

type DialStatus = "no-footprint" | "default-only" | "dialed";

function dialStatus(program: AssessProgramV2, towerId: TowerId): DialStatus {
  const t = program.towers[towerId];
  if (!t || !t.l3Rows.length) return "no-footprint";
  const hasOff = t.l3Rows.some((r) => r.offshoreAssessmentPct != null);
  const hasAi = t.l3Rows.some((r) => r.aiImpactAssessmentPct != null);
  return hasOff || hasAi ? "dialed" : "default-only";
}

function dialStatusCopy(s: DialStatus): { label: string; className: string } {
  if (s === "dialed") return { label: "Dialed", className: "text-accent-green" };
  if (s === "default-only") return { label: "Defaults only", className: "text-accent-amber" };
  return { label: "No headcount", className: "text-forge-subtle" };
}

/**
 * Step 2 hub — Configure Impact Levers.
 *
 * Lands the user on the live program-wide impact (animated $) and a tower
 * grid showing whether dials have been moved off the heuristic defaults. The
 * grid links straight into per-tower lever pages. Templates / backup / admin
 * re-seed live in `ProgramToolsDrawer` at the bottom.
 */
export function AssessmentHubClient() {
  const [program, setProgram] = React.useState<AssessProgramV2>(() => getAssessProgramHydrationSnapshot());
  const [mine, setMine] = React.useState<TowerId[]>([]);
  const impactHubGuidance = useGuidanceImpactHub();

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

  const dialedCount = orderedTowers.filter(
    (t) => dialStatus(program, t.id as TowerId) === "dialed",
  ).length;
  const ready = orderedTowers.some(
    (t) => dialStatus(program, t.id as TowerId) !== "no-footprint",
  );

  const nextRecommended = React.useMemo(() => {
    const candidates = orderedTowers.filter(
      (t) => dialStatus(program, t.id as TowerId) === "default-only",
    );
    return candidates[0] ?? orderedTowers.find(
      (t) => dialStatus(program, t.id as TowerId) === "dialed",
    ) ?? null;
  }, [orderedTowers, program]);

  return (
    <PageShell>
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <Breadcrumbs
          items={[
            { label: "Program home", href: "/" },
            { label: "Impact Levers" },
          ]}
        />
        <ScreenGuidanceBar guidance={impactHubGuidance} className="mt-3" />
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-accent-purple/30 bg-accent-purple/5 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-accent-purple-dark">
              <span className="font-mono">&gt;</span>
              Step 2 — Configure Impact Levers
            </div>
            <h1 className="mt-2 font-display text-3xl font-semibold text-forge-ink">
              &gt; Configure Impact Levers
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-forge-body">
              Dial <Term termKey="offshore dial">offshore</Term> and{" "}
              <Term termKey="ai impact dial">AI impact</Term> per{" "}
              <Term termKey="l3">L3 capability</Term> against the capability map &amp; headcount you
              confirmed in step 1. The headline below reflects every drag in real time. When the
              dials look right, sign the tower off as reviewed.
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

        {/* HERO — animated impact */}
        <div className="mt-5">
          <ImpactHero program={program} variant="hero" />
        </div>

        {/* Top-of-page metrics strip */}
        <div className="mt-4">
          <AssessmentScoreboard variant="program" program={program} />
        </div>

        {/* Quick link to impact estimate */}
        <div className="mt-4 flex flex-wrap items-center justify-end gap-3 rounded-2xl border border-forge-border bg-forge-surface/60 p-3">
          <Link
            href="/impact-levers/summary"
            className="inline-flex items-center gap-1.5 rounded-lg border border-accent-purple/40 bg-accent-purple/10 px-3 py-1.5 text-xs font-medium text-accent-purple-dark hover:bg-accent-purple/20"
          >
            Open impact estimate
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Empty state — encourage Capability Map first */}
        {!ready ? (
          <div className="mt-6 rounded-2xl border border-dashed border-forge-border bg-forge-well/40 p-8 text-center">
            <Sliders className="mx-auto h-6 w-6 text-accent-purple-dark" aria-hidden />
            <p className="mt-3 text-sm font-medium text-forge-body">
              No tower capability map &amp; headcount loaded yet.
            </p>
            <p className="mt-1 text-xs text-forge-subtle">
              Confirm a tower&apos;s capability map first; the dials light up here once the
              capability map &amp; headcount is in.
            </p>
            <Link
              href="/capability-map"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent-purple px-4 py-2 text-sm font-medium text-white hover:bg-accent-purple-dark"
            >
              Open Capability Map
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : null}

        {ready && nextRecommended ? (
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
                {dialStatus(program, nextRecommended.id as TowerId) === "default-only"
                  ? "Defaults are seeded — review and override per L3 to make the impact yours."
                  : "Tweak the dials to fine-tune the modeled value."}
              </div>
            </div>
            <Link
              href={getTowerHref(nextRecommended.id as TowerId, "impact-levers")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent-purple px-4 py-2 text-sm font-medium text-white hover:bg-accent-purple-dark"
            >
              Open dials
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : null}

        {/* Tower grid */}
        <h2
          id="tower-list"
          className="mt-10 font-display text-sm font-semibold uppercase tracking-wider text-forge-subtle"
        >
          &gt; Towers ({towers.length}) ·{" "}
          <span className="font-mono text-forge-body">{dialedCount}</span> dialed
        </h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {orderedTowers.map((tw) => {
            const tid = tw.id as TowerId;
            const t = program.towers[tid];
            const status = dialStatus(program, tid);
            const sc = dialStatusCopy(status);
            const isMine = minePicked && mine.includes(tid);
            const isComplete = t?.status === "complete";
            const pool = t ? t.l3Rows.reduce((s, r) => s + rowAnnualCost(r, program.global), 0) : 0;
            const weighted = t && t.l3Rows.length
              ? weightedTowerLevers(t.l3Rows, t.baseline, program.global)
              : null;
            const outcome = towerOutcomeForState(tid, program);

            const disabled = status === "no-footprint";
            return (
              <li
                key={tw.id}
                className={
                  "flex flex-col gap-3 rounded-2xl border p-4 " +
                  (isComplete
                    ? "border-accent-green/30 bg-accent-green/5"
                    : isMine
                      ? "border-accent-purple/20 bg-forge-surface"
                      : "border-forge-border bg-forge-surface")
                }
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-forge-ink">{tw.name}</span>
                      {isMine ? (
                        <span className="rounded-full bg-accent-purple/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-accent-purple-dark">
                          Mine
                        </span>
                      ) : null}
                    </div>
                    <div className={`mt-0.5 flex items-center gap-1.5 text-xs ${sc.className}`}>
                      {status === "dialed" ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : (
                        <Circle className="h-3.5 w-3.5" />
                      )}
                      {sc.label}
                    </div>
                    {status !== "no-footprint" ? (
                      <div
                        className={`mt-1 flex flex-wrap items-center gap-2 text-[11px] ${
                          isComplete ? "text-accent-green" : "text-accent-amber"
                        }`}
                      >
                        {isComplete ? (
                          <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden />
                        ) : (
                          <Circle className="h-3 w-3 shrink-0" aria-hidden />
                        )}
                        <span>
                          {isComplete ? "Reviewed by Tower Lead" : "Pending Tower Lead review"}
                        </span>
                        <LeadDeadlineChip
                          towerName={tw.name}
                          towerId={tid}
                          step={2}
                          program={program}
                        />
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-[11px]">
                  <div className="rounded-lg border border-forge-border bg-forge-page/40 px-2 py-1">
                    <div className="font-mono text-[9px] uppercase tracking-wider text-forge-hint">Pool</div>
                    <div className="font-mono text-[12px] tabular-nums text-forge-body">
                      {pool > 0 ? formatMoney(pool, { decimals: pool >= 1_000_000 ? 1 : 0 }) : "$—"}
                    </div>
                  </div>
                  <div className="rounded-lg border border-forge-border bg-forge-page/40 px-2 py-1">
                    <div className="font-mono text-[9px] uppercase tracking-wider text-forge-hint">Off / AI</div>
                    <div className="font-mono text-[12px] tabular-nums text-forge-body">
                      {weighted
                        ? `${weighted.offshorePct.toFixed(0)}% / ${weighted.aiPct.toFixed(0)}%`
                        : "— / —"}
                    </div>
                  </div>
                  <div className="rounded-lg border border-forge-border bg-forge-page/40 px-2 py-1">
                    <div className="font-mono text-[9px] uppercase tracking-wider text-forge-hint">Modeled</div>
                    <div className="font-mono text-[12px] tabular-nums text-accent-green">
                      {outcome
                        ? formatMoney(outcome.combined, {
                            decimals: outcome.combined >= 1_000_000 ? 1 : 0,
                          })
                        : "$—"}
                    </div>
                  </div>
                </div>

                <div className="mt-1">
                  {disabled ? (
                    <Link
                      href={getTowerHref(tid, "capability-map")}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-forge-border bg-forge-surface px-3 py-2 text-xs text-forge-body hover:border-accent-purple/40"
                    >
                      Confirm capability map first
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  ) : (
                    <Link
                      href={getTowerHref(tid, "impact-levers")}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent-purple px-3 py-2 text-sm font-medium text-white hover:bg-accent-purple-dark"
                    >
                      {status === "dialed" ? "Refine dials" : "Set dials"}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <ProgramToolsDrawer />
      </div>
    </PageShell>
  );
}
