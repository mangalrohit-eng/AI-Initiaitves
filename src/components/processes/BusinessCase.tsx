import { AlertTriangle, CheckCircle2, CircleDollarSign, FlagTriangleRight, Gauge, Info, Users } from "lucide-react";
import type { Process } from "@/data/types";

function Placeholder({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-forge-border bg-forge-well/60 px-2 py-0.5 text-[11px] text-forge-hint">
      <Info className="h-3 w-3" />
      {label} — to be added with tower leads
    </span>
  );
}

function ConfidenceBadge({ c }: { c: Process["confidence"] }) {
  if (c === "Validated") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-accent-teal/45 bg-accent-teal/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-900">
        <CheckCircle2 className="h-3 w-3" />
        Validated
      </span>
    );
  }
  // Default: Modeled (subtle, neutral — informs without alarming)
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-forge-border bg-forge-well px-2 py-0.5 text-[11px] font-medium text-forge-subtle">
      <Info className="h-3 w-3" />
      Modeled
    </span>
  );
}

function BulletList({ items, tone = "neutral" }: { items?: string[]; tone?: "neutral" | "risk" }) {
  if (!items?.length) return null;
  return (
    <ul className="mt-2 space-y-1.5 text-sm text-forge-body">
      {items.map((i) => (
        <li key={i} className="flex gap-2">
          <span
            className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
              tone === "risk" ? "bg-accent-amber" : "bg-accent-purple"
            }`}
            aria-hidden
          />
          <span>{i}</span>
        </li>
      ))}
    </ul>
  );
}

export function BusinessCase({ process }: { process: Process }) {
  const bc = process.businessCase;
  const hasAny =
    bc &&
    (bc.investmentEstimate ||
      bc.paybackPeriod ||
      bc.kpis?.length ||
      bc.risks?.length ||
      bc.decisionsRequired?.length ||
      bc.changeImpact);

  return (
    <section
      aria-label="Business case"
      data-annot-anchor="business-case"
      className="rounded-2xl border border-forge-border bg-gradient-to-br from-accent-purple/5 via-forge-surface to-forge-surface p-5 shadow-card sm:p-6"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-accent-purple/30 bg-accent-purple/10 px-3 py-1 text-xs font-semibold text-accent-purple-dark">
            <CircleDollarSign className="h-3.5 w-3.5" />
            Business case
          </div>
          <h2 className="mt-3 font-display text-xl font-semibold text-forge-ink">
            The case for prioritising this initiative
          </h2>
        </div>
        <ConfidenceBadge c={process.confidence} />
      </header>

      <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-forge-border bg-forge-surface p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-forge-hint">
            <CircleDollarSign className="h-3.5 w-3.5 text-accent-purple" />
            Investment estimate
          </div>
          <div className="mt-2 text-sm text-forge-ink">
            {bc?.investmentEstimate ? (
              <span className="font-medium">{bc.investmentEstimate}</span>
            ) : (
              <Placeholder label="Investment" />
            )}
          </div>
        </div>

        <div className="rounded-xl border border-forge-border bg-forge-surface p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-forge-hint">
            <Gauge className="h-3.5 w-3.5 text-accent-purple" />
            Payback period
          </div>
          <div className="mt-2 text-sm text-forge-ink">
            {bc?.paybackPeriod ? (
              <span className="font-medium">{bc.paybackPeriod}</span>
            ) : (
              <Placeholder label="Payback" />
            )}
          </div>
        </div>

        <div className="rounded-xl border border-forge-border bg-forge-surface p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-forge-hint">
            <Users className="h-3.5 w-3.5 text-accent-purple" />
            Change impact
          </div>
          <div className="mt-2 text-sm text-forge-ink">
            {bc?.changeImpact ? (
              <span>{bc.changeImpact}</span>
            ) : (
              <Placeholder label="Change impact" />
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-forge-border bg-forge-surface p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-forge-hint">
            <Gauge className="h-3.5 w-3.5 text-accent-purple" />
            KPIs to track
          </div>
          {bc?.kpis?.length ? (
            <BulletList items={bc.kpis} />
          ) : (
            <div className="mt-2">
              <Placeholder label="KPIs" />
            </div>
          )}
        </div>

        <div className="rounded-xl border border-forge-border bg-forge-surface p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-forge-hint">
            <AlertTriangle className="h-3.5 w-3.5 text-accent-amber" />
            Risks &amp; mitigations
          </div>
          {bc?.risks?.length ? (
            <BulletList items={bc.risks} tone="risk" />
          ) : (
            <div className="mt-2">
              <Placeholder label="Risks" />
            </div>
          )}
        </div>

        <div className="rounded-xl border border-forge-border bg-forge-surface p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-forge-hint">
            <FlagTriangleRight className="h-3.5 w-3.5 text-accent-purple" />
            Decisions required
          </div>
          {bc?.decisionsRequired?.length ? (
            <BulletList items={bc.decisionsRequired} />
          ) : (
            <div className="mt-2">
              <Placeholder label="Decisions" />
            </div>
          )}
        </div>
      </div>

      {!hasAny ? (
        <p className="mt-5 rounded-lg border border-dashed border-forge-border bg-forge-well/60 p-3 text-xs text-forge-subtle">
          Tower leads — use this block to capture investment, payback, KPIs, risks, and the
          decisions needed to move forward. The figures above are{" "}
          <span className="font-semibold">modeled</span> until your team confirms them.
        </p>
      ) : null}
    </section>
  );
}
