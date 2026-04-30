"use client";

import {
  Building2,
  ArrowDownRight,
  Home,
  Coins,
  Target,
  AlertTriangle,
} from "lucide-react";
import type { AssessProgramV2 } from "@/data/assess/types";
import type { OffshorePlanResult } from "@/lib/offshore/selectOffshorePlan";
import { offshoreLocationLabels } from "@/lib/offshore/offshoreLocationLabels";
import { formatUsdCompact } from "@/lib/format";
import { useRedactDollars } from "@/lib/clientMode";

type PlanWithProgram = OffshorePlanResult & { program: AssessProgramV2 };

/**
 * Six-tile KPI strip for the Offshore Plan page.
 *
 * Headcount stays visible in protected ("client") mode — only the dollar
 * figure redacts. This is the deliberate UX choice that makes Step 5
 * readable in client demos: leadership can see "3,200 roles to GCC India,
 * 9,200 retained onshore" even when modeled $ are hidden.
 *
 * Every count traces to `selectOffshorePlan` deterministic math — no LLM,
 * no fabrication. The KPI strip is the single source of truth that the
 * Org Transition tab and the Wave Roadmap reconcile to.
 */
export function OffshoreKpiStrip({ plan }: { plan: PlanWithProgram }) {
  const redact = useRedactDollars();
  const labels = offshoreLocationLabels(plan.program);

  return (
    <section>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {/* Tile 1 — TODAY in-scope org */}
        <Tile
          icon={<Building2 className="h-3.5 w-3.5" aria-hidden />}
          label="Today's in-scope org"
          value={fmtInt(plan.programTodayOnshoreCount + plan.programTodayOffshoreCount)}
          subtitle={`US: ${fmtInt(plan.programTodayOnshoreCount)} · Off: ${fmtInt(plan.programTodayOffshoreCount)}`}
        />

        {/* Tile 2 — MIGRATING TO GCC INDIA (the headline) */}
        <Tile
          icon={<ArrowDownRight className="h-3.5 w-3.5" aria-hidden />}
          label="Migrating to GCC India"
          value={fmtInt(plan.programMigratingToGcc + plan.programMigratingToManila)}
          subtitle={
            plan.programMigratingToManila > 0 && labels.hasHub
              ? `${labels.primaryAndSecondary}: ${fmtInt(plan.programMigratingToGcc)} · ${labels.hub}: ${fmtInt(plan.programMigratingToManila)}`
              : `${labels.primaryAndSecondary} (managed service)`
          }
          footnote={`Steady state @ M24: ${fmtInt(plan.programGccIndiaSteadyState)} (incl. existing offshore)`}
          emphasis
        />

        {/* Tile 3 — RETAINED onshore */}
        <Tile
          icon={<Home className="h-3.5 w-3.5" aria-hidden />}
          label="Retained onshore"
          value={fmtInt(plan.programRetainedOnshore)}
          subtitle={
            plan.programEditorialCarveOutCount > 0
              ? `incl. editorial carve-out: ${fmtInt(plan.programEditorialCarveOutCount)}`
              : "Strategic, judgment, executive layer"
          }
        />

        {/* Tile 4 — Modeled offshore $ — reuses Step 3 number */}
        <Tile
          icon={<Coins className="h-3.5 w-3.5" aria-hidden />}
          label="Modeled offshore savings / yr"
          value={
            redact ? "—" : formatUsdCompact(plan.programOffshoreUsd, { decimals: 2 })
          }
          subtitle="Gross · reconciles to Step 3"
        />

        {/* Tile 5 — First wave at scale */}
        <Tile
          icon={<Target className="h-3.5 w-3.5" aria-hidden />}
          label="First wave @ scale"
          value="M9"
          subtitle="Wave 1 hyper-care complete"
        />

        {/* Tile 6 — Stand-up cost tier */}
        <Tile
          icon={<AlertTriangle className="h-3.5 w-3.5" aria-hidden />}
          label="Stand-up cost tier"
          value="HIGH"
          subtitle="Multi-tower · multi-TSA · BB- newly-public"
          tier="HIGH"
        />
      </div>
    </section>
  );
}

function Tile({
  icon,
  label,
  value,
  subtitle,
  footnote,
  emphasis,
  tier,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle?: string;
  footnote?: string;
  emphasis?: boolean;
  tier?: "HIGH" | "MEDIUM" | "LOW";
}) {
  const tierColor =
    tier === "HIGH"
      ? "text-accent-red"
      : tier === "MEDIUM"
        ? "text-accent-amber"
        : tier === "LOW"
          ? "text-accent-teal"
          : undefined;
  if (emphasis) {
    return (
      <div className="rounded-2xl border border-accent-purple/30 bg-gradient-to-b from-accent-purple/10 to-forge-surface p-4 shadow-sm">
        <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-accent-purple-dark/80">
          {icon}
          <span>{label}</span>
        </div>
        <div className="mt-2 font-mono text-2xl font-semibold text-accent-purple-dark">
          {value}
        </div>
        {subtitle ? <p className="mt-1 text-xs text-forge-subtle">{subtitle}</p> : null}
        {footnote ? (
          <p className="mt-1 text-[11px] font-medium text-accent-purple-dark/80">{footnote}</p>
        ) : null}
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-forge-border bg-forge-surface p-4 shadow-sm">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-forge-hint">
        {icon}
        <span>{label}</span>
      </div>
      <div className={`mt-2 font-mono text-2xl font-semibold ${tierColor ?? "text-forge-ink"}`}>
        {value}
      </div>
      {subtitle ? <p className="mt-1 text-xs text-forge-subtle">{subtitle}</p> : null}
      {footnote ? (
        <p className="mt-1 text-[11px] text-forge-subtle">{footnote}</p>
      ) : null}
    </div>
  );
}

function fmtInt(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return Math.round(n).toLocaleString("en-US");
}
