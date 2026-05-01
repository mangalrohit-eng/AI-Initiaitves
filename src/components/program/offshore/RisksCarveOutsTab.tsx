"use client";

import {
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  AlertTriangle,
  Info,
} from "lucide-react";
import type {
  OffshoreCarveOut,
  OffshorePlanResult,
  OffshoreRiskItem,
} from "@/lib/offshore/selectOffshorePlan";
import { tierAccent } from "./offshoreLabels";
import { towers } from "@/data/towers";
import { cn } from "@/lib/utils";

/**
 * Risks & Carve-outs — the structured register of why this plan is
 * defensible to leadership and the named gatekeepers / mitigations for
 * every exposure.
 *
 * Two stacked sections:
 *   1. Carve-outs — the non-negotiable boundaries (Editorial / Talent /
 *      SOX year-1 / Sales-relationship). Named gatekeeper per carve-out.
 *   2. Risk register — 7-row Versant-grounded exposure / mitigation /
 *      owner / severity table.
 */
export function RisksCarveOutsTab({ plan }: { plan: OffshorePlanResult }) {
  return (
    <div className="space-y-8">
      <CarveOutsSection carveOuts={plan.carveOuts} />
      <RiskRegisterSection risks={plan.risks} />
    </div>
  );
}

// ===========================================================================

function CarveOutsSection({ carveOuts }: { carveOuts: OffshoreCarveOut[] }) {
  const activeCount = carveOuts.filter((c) => c.affectedTowers.length > 0).length;
  return (
    <section>
      <header className="mb-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-lg font-semibold text-forge-ink">
            <span className="font-mono text-accent-purple-dark">&gt;</span>{" "}
            Non-negotiable carve-outs
          </h2>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
              activeCount > 0
                ? "border-accent-purple/40 bg-accent-purple/5 text-accent-purple-dark"
                : "border-forge-border bg-forge-well/60 text-forge-subtle",
            )}
          >
            {activeCount > 0 ? (
              <>
                <ShieldCheck className="h-3 w-3" aria-hidden />
                {activeCount} active
              </>
            ) : (
              <>
                <ShieldOff className="h-3 w-3" aria-hidden />
                None active
              </>
            )}
          </span>
        </div>
        <p className="mt-1 text-sm text-forge-subtle">
          The four boundaries the GCC scope must not cross. Each carries a
          named Versant gatekeeper. Editorial holds binding veto on any wave
          gate touching newsroom-adjacent scope.
        </p>
      </header>

      {activeCount === 0 && (
        <div className="mb-3 flex items-start gap-2 rounded-2xl border border-dashed border-accent-purple/30 bg-accent-purple/5 px-4 py-3 text-[12px] leading-relaxed text-forge-body">
          <Info
            className="mt-0.5 h-4 w-4 flex-none text-accent-purple-dark"
            aria-hidden
          />
          <span>
            <span className="font-semibold text-forge-ink">
              No carve-outs are currently configured.
            </span>{" "}
            Every L4 Activity Group row is in scope for offshore (subject to
            the LLM lane classifier and the Step-2 dial). The four cards below describe
            the boundaries Accenture will respect when you do configure
            carve-outs in the{" "}
            <span className="font-medium text-accent-purple-dark">
              Assumptions
            </span>{" "}
            tab — they are shown here as policy reference, not as active
            constraints.
          </span>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {carveOuts.map((c) => (
          <CarveOutCard key={c.flag} carveOut={c} />
        ))}
      </div>
    </section>
  );
}

function CarveOutCard({ carveOut }: { carveOut: OffshoreCarveOut }) {
  const isActive = carveOut.affectedTowers.length > 0;
  const accent: Record<
    typeof carveOut.flag,
    { border: string; bg: string; text: string; icon: string }
  > = {
    Editorial: {
      border: "border-accent-red/30",
      bg: "bg-accent-red/5",
      text: "text-accent-red",
      icon: "text-accent-red",
    },
    Talent: {
      border: "border-accent-amber/30",
      bg: "bg-accent-amber/5",
      text: "text-accent-amber",
      icon: "text-accent-amber",
    },
    SOX: {
      border: "border-accent-teal/30",
      bg: "bg-accent-teal/5",
      text: "text-accent-teal",
      icon: "text-accent-teal",
    },
    Sales: {
      border: "border-accent-purple/30",
      bg: "bg-accent-purple/5",
      text: "text-accent-purple-dark",
      icon: "text-accent-purple-dark",
    },
  };
  const a = accent[carveOut.flag];
  return (
    <article
      className={cn(
        "relative rounded-2xl border p-5 transition",
        isActive
          ? `${a.border} ${a.bg}`
          : "border-forge-border bg-forge-well/30",
      )}
    >
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {isActive ? (
            <ShieldCheck className={`h-4 w-4 ${a.icon}`} aria-hidden />
          ) : (
            <ShieldOff className="h-4 w-4 text-forge-subtle" aria-hidden />
          )}
          <span
            className={cn(
              "text-[10px] font-semibold uppercase tracking-wider",
              isActive ? a.text : "text-forge-subtle",
            )}
          >
            {carveOut.flag} carve-out
          </span>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
            isActive
              ? "border-forge-border bg-forge-surface/80 text-forge-body"
              : "border-forge-border bg-forge-well text-forge-subtle",
          )}
        >
          {isActive ? `Active · ${carveOut.affectedTowers.length} tower${carveOut.affectedTowers.length === 1 ? "" : "s"}` : "Not active"}
        </span>
      </header>
      <h3
        className={cn(
          "mt-2 font-display text-base font-semibold",
          isActive ? "text-forge-ink" : "text-forge-body",
        )}
      >
        {carveOut.title}
      </h3>
      <p
        className={cn(
          "mt-2 text-sm leading-relaxed",
          isActive ? "text-forge-body" : "text-forge-subtle",
        )}
      >
        {carveOut.description}
      </p>
      <div className="mt-3 grid gap-2 text-[11px]">
        <div>
          <span className="font-semibold uppercase tracking-wider text-forge-hint">
            Gatekeeper:
          </span>{" "}
          <span
            className={cn(
              "font-medium",
              isActive ? "text-forge-ink" : "text-forge-body",
            )}
          >
            {carveOut.gatekeeper}
          </span>
        </div>
        {isActive ? (
          <div>
            <span className="font-semibold uppercase tracking-wider text-forge-hint">
              Affected towers:
            </span>{" "}
            <span className="text-forge-body">
              {carveOut.affectedTowers
                .map((tid) => towers.find((t) => t.id === tid)?.name ?? tid)
                .join(" · ")}
            </span>
          </div>
        ) : (
          <div className="text-forge-subtle">
            <span className="font-semibold uppercase tracking-wider text-forge-hint">
              Status:
            </span>{" "}
            <span>
              No L4 Activity Group rows currently flagged with this reason.
              Set in the Assumptions tab to activate.
            </span>
          </div>
        )}
      </div>
    </article>
  );
}

// ===========================================================================

function RiskRegisterSection({ risks }: { risks: OffshoreRiskItem[] }) {
  return (
    <section>
      <header className="mb-3">
        <h2 className="font-display text-lg font-semibold text-forge-ink">
          <span className="font-mono text-accent-purple-dark">&gt;</span>{" "}
          Risk register
        </h2>
        <p className="mt-1 text-sm text-forge-subtle">
          Versant-grounded exposures and the named owner / mitigation for
          each. Severity is qualitative — HIGH / MEDIUM / LOW per the project
          tier framework.
        </p>
      </header>

      <div className="overflow-x-auto rounded-2xl border border-forge-border bg-forge-surface">
        <table className="min-w-full text-sm">
          <thead className="bg-forge-well/60 text-[11px] font-semibold uppercase tracking-wider text-forge-subtle">
            <tr>
              <th className="px-4 py-2.5 text-left">Risk</th>
              <th className="px-4 py-2.5 text-left">Versant exposure</th>
              <th className="px-4 py-2.5 text-left">Mitigation</th>
              <th className="px-4 py-2.5 text-left">Owner</th>
              <th className="px-4 py-2.5 text-right">Severity</th>
            </tr>
          </thead>
          <tbody>
            {risks.map((r) => (
              <tr key={r.id} className="border-t border-forge-border align-top">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <ShieldAlert className="h-3.5 w-3.5 text-forge-hint" aria-hidden />
                    <span className="font-display font-semibold text-forge-ink">
                      {r.title}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-[12px] leading-relaxed text-forge-body">
                  {r.exposure}
                </td>
                <td className="px-4 py-3 text-[12px] leading-relaxed text-forge-body">
                  {r.mitigation}
                </td>
                <td className="px-4 py-3 text-[12px] text-forge-body">
                  {r.owner}
                </td>
                <td className="px-4 py-3 text-right">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${severityChip(r.severity)}`}
                  >
                    <AlertTriangle className="h-3 w-3" aria-hidden />
                    {r.severity}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className={`mt-3 text-[11px] ${tierAccent("HIGH")}`}>
        HIGH-severity items gate the BB- credit story; HIGH-severity SLA
        slip on Wave 1 stops Wave 2 entirely.
      </p>
    </section>
  );
}

function severityChip(severity: OffshoreRiskItem["severity"]): string {
  if (severity === "HIGH")
    return "border-accent-red/40 bg-accent-red/5 text-accent-red";
  if (severity === "MEDIUM")
    return "border-accent-amber/40 bg-accent-amber/5 text-accent-amber";
  return "border-accent-teal/40 bg-accent-teal/5 text-accent-teal";
}
