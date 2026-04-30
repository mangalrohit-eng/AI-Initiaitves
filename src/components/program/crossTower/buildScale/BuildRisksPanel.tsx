"use client";

import { AlertTriangle } from "lucide-react";
import { PROGRAM_RISK_CATALOG } from "@/lib/llm/prompts/crossTowerAiPlan.v1";

/**
 * Build & Scale risks panel — sits beneath the Gantt in the Roadmap tab.
 *
 * The Gantt depicts the modeled timeline assuming everything goes to plan.
 * This panel is the honest counterweight: 5 named, Versant-grounded risks
 * that could shift bars right.
 *
 * The 5 entries are hand-picked by id from `PROGRAM_RISK_CATALOG` so the
 * Roadmap tab and the Risks & Evidence tab stay in lockstep on naming and
 * scope. The build-slip framing is panel-local — it reframes each catalog
 * risk in timing terms without contradicting the catalog's underlying text.
 *
 * The 6th entry ("Capacity assumption") is a panel-local note about the
 * parallel-within-phase assumption baked into `computeBuildScale`. It does
 * not appear in `PROGRAM_RISK_CATALOG` because it's not a Versant business
 * risk — it's an artefact of the planning model itself, surfaced for honesty.
 */
type TimingRisk = {
  /** Display title, reframed in build-slip terms. */
  title: string;
  /** Plain-language sentence on the timing impact. */
  detail: string;
  /** When set, points to a `PROGRAM_RISK_CATALOG[*].id`. */
  catalogId?: string;
};

const TIMING_RISKS: TimingRisk[] = [
  {
    title: "NBCU TSA carve-out drag",
    catalogId: "tsa-expiration",
    detail:
      "Ad sales standalone build (FreeWheel + Operative integration) and finance close systems both depend on TSA data handover. Each month of delay shifts P1 ad-sales and finance bars right by one.",
  },
  {
    title: "Vendor contract gating",
    detail:
      "Eightfold (Talent), Cresta (Service), and DocuSign CLM (Legal) procurement cycles can slip P1 builds into P2 if contract negotiation runs long.",
  },
  {
    title: "Editorial gating with Brian Carovillano",
    catalogId: "editorial-judgment-floor",
    detail:
      "MS NOW and CNBC initiatives — crisis detection, brand-safety models, fact-check assist — are gated by editorial sign-off. Sequential review compresses the available ramp window.",
  },
  {
    title: "Treasury sign-off bandwidth",
    catalogId: "bb-credit-covenant",
    detail:
      "Anand Kini's queue is the choke point for any covenant-touching initiative. BB- credit means treasury approval is gating, not advisory — Finance P1 throughput depends on it.",
  },
  {
    title: "Data fabric talent gap",
    detail:
      "Semantic layer + content lake build is on the critical path for every P2 initiative. Talent shortfall in the platform team slips the entire P2 cohort by 2–3 months.",
  },
  {
    title: "Capacity assumption (planning artefact)",
    detail:
      "The Gantt assumes Forge mobilizes 13 tower-lead pods in parallel for the P1 cohort. The downstream effort estimate may surface capacity constraints that force sequencing within phases.",
  },
];

export function BuildRisksPanel() {
  // Sanity guard — every catalogId we reference must still exist. If a future
  // edit drops a catalog id, the panel still renders the entry but without
  // the cross-link, instead of crashing.
  const catalogIds = new Set(PROGRAM_RISK_CATALOG.map((r) => r.id));
  return (
    <div className="rounded-xl border border-accent-amber/35 bg-accent-amber/[0.04] p-4">
      <header className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-accent-amber" aria-hidden />
        <h3 className="font-display text-sm font-semibold text-forge-ink">
          Build risks — what could shift the bars right
        </h3>
      </header>
      <p className="mt-1 text-xs text-forge-subtle">
        The Gantt above models the plan-on-track timeline. These six items are
        the most likely sources of slip. Each is named and Versant-grounded,
        not generic.
      </p>
      <ul className="mt-3 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
        {TIMING_RISKS.map((risk, idx) => {
          const linked = risk.catalogId && catalogIds.has(risk.catalogId);
          return (
            <li
              key={idx}
              className="rounded-lg border border-forge-border bg-forge-surface px-3 py-2"
            >
              <div className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent-amber" />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-forge-ink">
                    {risk.title}
                  </div>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-forge-body">
                    {risk.detail}
                  </p>
                  {linked ? (
                    <div className="mt-1 text-[10px] text-forge-hint">
                      Linked risk:{" "}
                      <span className="font-mono text-forge-subtle">
                        {risk.catalogId}
                      </span>{" "}
                      · see Risks &amp; Evidence tab
                    </div>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
