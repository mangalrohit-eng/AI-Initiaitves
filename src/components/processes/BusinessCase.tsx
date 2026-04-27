import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  FlagTriangleRight,
  Gauge,
  Info,
  Users,
} from "lucide-react";
import type { Process } from "@/data/types";

function ConfidenceBadge({ c }: { c: Process["confidence"] }) {
  if (c === "Validated") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-accent-teal/45 bg-accent-teal/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-900">
        <CheckCircle2 className="h-3 w-3" />
        Validated
      </span>
    );
  }
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
  const hasAny = Boolean(
    bc &&
      (bc.investmentEstimate ||
        bc.paybackPeriod ||
        bc.kpis?.length ||
        bc.risks?.length ||
        bc.decisionsRequired?.length ||
        bc.changeImpact),
  );

  if (!hasAny) {
    return (
      <section
        aria-label="Business case"
        data-annot-anchor="business-case"
        className="flex flex-wrap items-center gap-3 rounded-xl border border-accent-purple/25 bg-accent-purple/5 px-4 py-2.5"
      >
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-accent-purple-dark">
          <CircleDollarSign className="h-4 w-4" />
          Business case
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-forge-border bg-forge-surface px-2 py-0.5 text-[11px] font-medium text-forge-subtle">
          <CalendarClock className="h-3 w-3" />
          Coming soon — to be built with tower leads
        </span>
        <span className="ml-auto text-[11px] text-forge-hint">
          Investment · Payback · KPIs · Risks · Decisions
        </span>
      </section>
    );
  }

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
        {bc?.investmentEstimate ? (
          <div className="rounded-xl border border-forge-border bg-forge-surface p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-forge-hint">
              <CircleDollarSign className="h-3.5 w-3.5 text-accent-purple" />
              Investment estimate
            </div>
            <div className="mt-2 text-sm font-medium text-forge-ink">{bc.investmentEstimate}</div>
          </div>
        ) : null}

        {bc?.paybackPeriod ? (
          <div className="rounded-xl border border-forge-border bg-forge-surface p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-forge-hint">
              <Gauge className="h-3.5 w-3.5 text-accent-purple" />
              Payback period
            </div>
            <div className="mt-2 text-sm font-medium text-forge-ink">{bc.paybackPeriod}</div>
          </div>
        ) : null}

        {bc?.changeImpact ? (
          <div className="rounded-xl border border-forge-border bg-forge-surface p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-forge-hint">
              <Users className="h-3.5 w-3.5 text-accent-purple" />
              Change impact
            </div>
            <div className="mt-2 text-sm text-forge-ink">{bc.changeImpact}</div>
          </div>
        ) : null}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {bc?.kpis?.length ? (
          <div className="rounded-xl border border-forge-border bg-forge-surface p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-forge-hint">
              <Gauge className="h-3.5 w-3.5 text-accent-purple" />
              KPIs to track
            </div>
            <BulletList items={bc.kpis} />
          </div>
        ) : null}

        {bc?.risks?.length ? (
          <div className="rounded-xl border border-forge-border bg-forge-surface p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-forge-hint">
              <AlertTriangle className="h-3.5 w-3.5 text-accent-amber" />
              Risks &amp; mitigations
            </div>
            <BulletList items={bc.risks} tone="risk" />
          </div>
        ) : null}

        {bc?.decisionsRequired?.length ? (
          <div className="rounded-xl border border-forge-border bg-forge-surface p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-forge-hint">
              <FlagTriangleRight className="h-3.5 w-3.5 text-accent-purple" />
              Decisions required
            </div>
            <BulletList items={bc.decisionsRequired} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
