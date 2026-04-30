"use client";

import {
  Building,
  ShieldCheck,
  Users2,
  XCircle,
  ArrowRight,
} from "lucide-react";
import type { AssessProgramV2 } from "@/data/assess/types";
import type { OffshorePlanResult } from "@/lib/offshore/selectOffshorePlan";
import {
  offshoreLocationLabels,
  type OffshoreLocationLabels,
} from "@/lib/offshore/offshoreLocationLabels";
import {
  Chip,
  carveOutFlagAccent,
  fmtInt,
  usLocationLabel,
} from "./offshoreLabels";

type PlanWithProgram = OffshorePlanResult & { program: AssessProgramV2 };

/**
 * Overview tab — the leadership-facing recommendation + at-a-glance scope.
 *
 * Three blocks:
 *   1. The Recommendation card — single committed answer.
 *   2. Tower scope summary table — 5 columns, sorted by → GCC India desc.
 *   3. Alternatives considered — what was rejected and why.
 *
 * Lean by design — full org-transition detail lives in Tab 2, full L3
 * scope detail lives in Tab 3.
 */
export function OverviewTab({ plan }: { plan: PlanWithProgram }) {
  const labels = offshoreLocationLabels(plan.program);
  return (
    <div className="space-y-6">
      <RecommendationBlock labels={labels} />

      <section>
        <header className="mb-3">
          <h2 className="font-display text-lg font-semibold text-forge-ink">
            <span className="font-mono text-accent-purple-dark">&gt;</span>{" "}
            Tower scope — at a glance
          </h2>
          <p className="mt-1 text-sm text-forge-subtle">
            Per-tower headcount transition. Sorted by{" "}
            <span className="font-mono text-forge-body">→ GCC India</span> desc
            so the towers carrying the offshoring weight read first. Full
            detail is in <em className="not-italic">Org transition</em> and{" "}
            <em className="not-italic">Scope by tower</em>.
          </p>
        </header>
        <TowerScopeTable plan={plan} labels={labels} />
      </section>

      <AlternativesPanel labels={labels} />
    </div>
  );
}

// ---------------------------------------------------------------------------

function RecommendationBlock({ labels }: { labels: OffshoreLocationLabels }) {
  return (
    <section className="rounded-2xl border border-accent-purple/30 bg-accent-purple/5 p-5">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-accent-purple-dark">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
        The recommendation
      </div>
      <h2 className="mt-2 font-display text-xl font-semibold text-forge-ink">
        Accenture-led <span className="text-accent-purple-dark">managed service</span> · India Tier-1 GCC: {labels.primaryAndSecondary}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-forge-body">
        {labels.hasHub
          ? `${labels.hub} contact-center carve-out for multi-brand Service Ops`
          : "Service Ops contact-center work folds into the primary GCC"}
        {" "}· Three TSA-paced waves over 24 months · BOT optionality after Year 3.
      </p>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Detail
          icon={<Building className="h-3.5 w-3.5" aria-hidden />}
          label="Editorial veto"
          value="Brian Carovillano"
          sub="SVP Standards & Editorial"
        />
        <Detail
          icon={<ShieldCheck className="h-3.5 w-3.5" aria-hidden />}
          label="SOX year-1 gate"
          value="Anand Kini"
          sub="CFO/COO — gate on Wave 3 finance close"
        />
        <Detail
          icon={<Users2 className="h-3.5 w-3.5" aria-hidden />}
          label="Steering chair"
          value="Anand Kini"
          sub="Mark Lazarus (CEO) — sponsor"
        />
      </dl>
    </section>
  );
}

function Detail({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-xl border border-forge-border bg-forge-surface p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-forge-hint">
        {icon}
        {label}
      </div>
      <div className="mt-1.5 font-display text-sm font-semibold text-forge-ink">
        {value}
      </div>
      <div className="mt-0.5 text-[11px] text-forge-subtle">{sub}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function TowerScopeTable({
  plan,
  labels,
}: {
  plan: PlanWithProgram;
  labels: OffshoreLocationLabels;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-forge-border bg-forge-surface">
      <table className="min-w-full text-sm">
        <thead className="bg-forge-well/60 text-[11px] font-semibold uppercase tracking-wider text-forge-subtle">
          <tr>
            <th className="px-4 py-2.5 text-left">Tower</th>
            <th className="px-4 py-2.5 text-right">Today HC</th>
            <th className="px-4 py-2.5 text-right">→ GCC India</th>
            <th className="px-4 py-2.5 text-right">⌂ Retained</th>
            <th className="px-4 py-2.5 text-left">From + carve-out</th>
          </tr>
        </thead>
        <tbody>
          {plan.towerSummaries.map((t) => (
            <tr
              key={t.towerId}
              className="border-t border-forge-border align-top"
            >
              <td className="px-4 py-2.5">
                <div className="font-display font-semibold text-forge-ink">
                  {t.towerName}
                </div>
                <div className="mt-0.5 text-[11px] text-forge-subtle">
                  {t.recommendedScope}
                </div>
                {t.migratingToManila > 0 && labels.hasHub ? (
                  <div className="mt-1 text-[11px] text-accent-teal">
                    └ to {labels.hub}:{" "}
                    <span className="font-mono">{fmtInt(t.migratingToManila)}</span>
                  </div>
                ) : null}
              </td>
              <td className="px-4 py-2.5 text-right font-mono text-forge-ink">
                {fmtInt(t.todayOnshoreCount + t.todayOffshoreCount)}
              </td>
              <td className="px-4 py-2.5 text-right font-mono">
                <span
                  className={
                    t.migratingToGcc > 0
                      ? "font-semibold text-accent-purple-dark"
                      : "text-forge-hint"
                  }
                >
                  {fmtInt(t.migratingToGcc + t.migratingToManila)}
                </span>
              </td>
              <td className="px-4 py-2.5 text-right font-mono text-forge-body">
                {fmtInt(t.retainedOnshore)}
              </td>
              <td className="px-4 py-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  {t.primaryUsLocations.slice(0, 2).map((loc) => (
                    <Chip
                      key={loc}
                      border="border-forge-border-strong"
                      bg="bg-forge-well"
                      text="text-forge-body"
                    >
                      {usLocationLabel(loc)}
                    </Chip>
                  ))}
                  {t.carveOutFlags.map((flag) => {
                    const a = carveOutFlagAccent(flag);
                    return (
                      <Chip
                        key={flag}
                        border={a.border}
                        bg={a.bg}
                        text={a.text}
                      >
                        ● {flag}
                      </Chip>
                    );
                  })}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-forge-border-strong bg-forge-well/40">
            <td className="px-4 py-2.5 font-display text-xs font-semibold uppercase tracking-wider text-forge-subtle">
              Program total
            </td>
            <td className="px-4 py-2.5 text-right font-mono font-semibold text-forge-ink">
              {fmtInt(plan.programTodayOnshoreCount + plan.programTodayOffshoreCount)}
            </td>
            <td className="px-4 py-2.5 text-right font-mono font-semibold text-accent-purple-dark">
              {fmtInt(plan.programMigratingToGcc + plan.programMigratingToManila)}
            </td>
            <td className="px-4 py-2.5 text-right font-mono font-semibold text-forge-ink">
              {fmtInt(plan.programRetainedOnshore)}
            </td>
            <td className="px-4 py-2.5 text-[11px] text-forge-subtle">
              {plan.programEditorialCarveOutCount > 0 ? (
                <>
                  of which editorial carve-out:{" "}
                  <span className="font-mono text-forge-body">
                    {fmtInt(plan.programEditorialCarveOutCount)}
                  </span>
                </>
              ) : (
                <span className="italic text-forge-hint">
                  No editorial carve-outs configured
                </span>
              )}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------

function AlternativesPanel({ labels }: { labels: OffshoreLocationLabels }) {
  const hubFootprintTitle = labels.hasHub
    ? `India + ${labels.hub} parallel footprint`
    : "India + parallel APAC footprint";
  const hubReason = labels.hasHub
    ? `${labels.hub} is a narrow contact-center carve-out, not a primary footprint. India delivers the structural cost reset; ${labels.hub} handles only multi-brand contact (CNBC Pro · GolfNow · Fandango · SportsEngine).`
    : "India delivers the structural cost reset on its own. A second APAC primary footprint duplicates capacity without adding scope coverage that the configured single-hub model can't reach.";
  const items: { title: string; reason: string }[] = [
    {
      title: "BOT day-one",
      reason:
        "Versant lacks GCC ops capacity in the first newly-public year. Year-3 BOT optionality preserved on the recommended path.",
    },
    {
      title: "Staff augmentation",
      reason:
        "Doesn't deliver covenant-grade savings velocity. BB- credit story needs Wave-1 savings banked at M9.",
    },
    { title: hubFootprintTitle, reason: hubReason },
  ];
  return (
    <section>
      <header className="mb-3">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-forge-subtle">
          <span className="font-mono text-accent-purple-dark">&gt;</span>{" "}
          Alternatives considered
        </h2>
      </header>
      <ul className="grid gap-3 sm:grid-cols-3">
        {items.map((it) => (
          <li
            key={it.title}
            className="rounded-2xl border border-forge-border bg-forge-surface/60 p-4"
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold text-forge-subtle">
              <XCircle className="h-3.5 w-3.5 text-accent-red" aria-hidden />
              <span>Rejected</span>
            </div>
            <h3 className="mt-2 font-display text-sm font-semibold text-forge-ink">
              {it.title}
            </h3>
            <p className="mt-1.5 text-[12px] leading-relaxed text-forge-body">
              {it.reason}
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-forge-subtle">
        <ArrowRight className="h-3 w-3" aria-hidden />
        The recommended path is the only live option in this plan; alternatives
        are documented for the audit trail.
      </p>
    </section>
  );
}
