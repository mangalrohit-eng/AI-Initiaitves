import Link from "next/link";
import {
  ArrowRight,
  ArrowRightCircle,
  Bot,
  CheckCircle2,
  ChevronRight,
  Clock,
  Cog,
  Gauge,
  Layers,
  Link as LinkIcon,
  UserCog,
  Wrench,
} from "lucide-react";
import type { AIProcessBrief, FeasibilityEvidence, Process, Tower } from "@/data/types";
import { MetricPill } from "@/components/ui/MetricPill";
import { EvidenceSection } from "@/components/evidence/EvidenceSection";
import { formatHours, slugify } from "@/lib/utils";
import { TIER_STYLES } from "@/lib/priority";

function priorityBadge(priority: AIProcessBrief["aiPriority"]) {
  const styles = TIER_STYLES[priority];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${styles.badge}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} aria-hidden />
      {priority} — {priority === "P1" ? "Immediate (0-6mo)" : "Near-term (6-12mo)"}
    </span>
  );
}

function ImpactPill({ impact }: { impact: string }) {
  const lower = impact.toLowerCase();
  const tone = lower.startsWith("eliminated")
    ? "border-red-200 bg-red-50 text-red-800"
    : lower.startsWith("reduced")
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : lower.startsWith("upskilled") || lower.startsWith("enabled")
        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
        : lower.startsWith("unchanged")
          ? "border-slate-200 bg-slate-50 text-slate-700"
          : "border-accent-purple/30 bg-accent-purple/10 text-accent-purple-dark";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${tone}`}>
      {impact}
    </span>
  );
}

export function ProcessBriefCard({
  brief,
  tower,
  parentInitiative,
  evidence = [],
}: {
  brief: AIProcessBrief;
  tower: Tower;
  parentInitiative?: Process;
  evidence?: FeasibilityEvidence[];
}) {
  return (
    <article className="space-y-8">
      {/* Header */}
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {priorityBadge(brief.aiPriority)}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-forge-border bg-forge-surface px-2.5 py-0.5 text-xs font-medium text-forge-subtle">
            <Layers className="h-3 w-3" />
            Process brief
          </span>
          {parentInitiative ? (
            <Link
              href={`/tower/${tower.id}/process/${slugify(parentInitiative.name)}`}
              className="inline-flex items-center gap-1 text-xs font-medium text-accent-purple-dark hover:underline"
            >
              Part of: {parentInitiative.name}
              <ChevronRight className="h-3 w-3" />
            </Link>
          ) : null}
        </div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-forge-ink sm:text-4xl">
          {brief.name}
        </h1>
        {brief.description ? (
          <p className="max-w-4xl text-sm leading-relaxed text-forge-body">{brief.description}</p>
        ) : null}
      </header>

      {/* Headline metrics */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricPill label="Time savings" value={`${brief.estimatedTimeSavingsPercent}%`} />
        <MetricPill
          label="Annual hours saved"
          value={`${formatHours(brief.estimatedAnnualHoursSaved)} hrs`}
        />
        <MetricPill label="Cycle today" value={brief.preState.typicalCycleTime || "—"} />
        <MetricPill label="Cycle with agentic AI" value={brief.postState.newCycleTime || "—"} />
      </section>

      {/* Pre / Post comparison */}
      <section className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-stretch">
        <div className="rounded-2xl border border-forge-border bg-forge-well/80 p-5 shadow-sm">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-forge-hint">
            <span className="h-2 w-2 rounded-full bg-accent-amber" aria-hidden />
            Today
          </div>
          <p className="mt-3 text-sm leading-relaxed text-forge-body">{brief.preState.summary}</p>
          {brief.preState.painPoints.length ? (
            <ul className="mt-4 space-y-2 text-sm text-forge-body">
              {brief.preState.painPoints.map((pp) => (
                <li key={pp} className="flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-amber" />
                  <span>{pp}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-5 inline-flex items-center gap-2 rounded-lg border border-forge-border bg-forge-surface px-3 py-1.5 text-xs text-forge-body">
            <Clock className="h-3.5 w-3.5 text-forge-subtle" />
            <span className="font-medium text-forge-subtle">Cycle:</span>
            <span>{brief.preState.typicalCycleTime || "—"}</span>
          </div>
        </div>

        <div className="hidden items-center justify-center lg:flex">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-accent-purple/40 bg-accent-purple/10 text-accent-purple-dark">
            <ArrowRight className="h-5 w-5" />
          </div>
        </div>
        <div className="flex items-center justify-center lg:hidden">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-accent-purple/40 bg-accent-purple/10 text-accent-purple-dark">
            <ArrowRightCircle className="h-4 w-4" />
          </div>
        </div>

        <div className="rounded-2xl border border-accent-purple/30 bg-gradient-to-b from-accent-purple/10 to-forge-surface p-5 shadow-sm">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-accent-purple-dark">
            <span className="h-2 w-2 rounded-full bg-accent-purple" aria-hidden />
            With agentic AI
          </div>
          <p className="mt-3 text-sm leading-relaxed text-forge-body">{brief.postState.summary}</p>
          {brief.postState.keyImprovements.length ? (
            <ul className="mt-4 space-y-2 text-sm text-forge-body">
              {brief.postState.keyImprovements.map((ki) => (
                <li key={ki} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent-purple" />
                  <span>{ki}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-5 inline-flex items-center gap-2 rounded-lg border border-accent-purple/30 bg-forge-surface px-3 py-1.5 text-xs text-accent-purple-dark">
            <Clock className="h-3.5 w-3.5" />
            <span className="font-medium">Cycle:</span>
            <span>{brief.postState.newCycleTime || "—"}</span>
          </div>
        </div>
      </section>

      {/* Key metric */}
      {brief.keyMetric ? (
        <section className="rounded-2xl border border-accent-purple/40 bg-gradient-to-br from-accent-purple/10 via-accent-purple/5 to-transparent p-6 shadow-card">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-accent-purple/40 bg-white/70 text-accent-purple-dark">
              <Gauge className="h-6 w-6" />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-accent-purple-dark/80">
                Key outcome
              </div>
              <p className="mt-1 font-display text-xl font-semibold leading-snug text-forge-ink">
                {brief.keyMetric}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {/* Agents + Tools */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-forge-border bg-forge-surface p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-forge-ink">
            <Bot className="h-4 w-4 text-accent-purple" />
            Agents involved
          </div>
          <ul className="space-y-3">
            {brief.agentsInvolved.map((a) => (
              <li
                key={a.agentName + a.roleInProcess}
                className="rounded-xl border border-forge-border bg-forge-well/60 p-3"
              >
                <div className="text-sm font-semibold text-forge-ink">{a.agentName}</div>
                <div className="mt-1 text-xs leading-relaxed text-forge-body">
                  {a.roleInProcess}
                </div>
              </li>
            ))}
            {brief.agentsInvolved.length === 0 ? (
              <li className="text-xs text-forge-subtle">Agents to be defined at build-out.</li>
            ) : null}
          </ul>
        </div>

        <div className="rounded-2xl border border-forge-border bg-forge-surface p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-forge-ink">
            <Wrench className="h-4 w-4 text-accent-purple" />
            Tools required
          </div>
          <ul className="space-y-3">
            {brief.toolsRequired.map((t) => (
              <li
                key={t.tool + t.purpose}
                className="rounded-xl border border-forge-border bg-forge-well/60 p-3"
              >
                <div className="text-sm font-semibold text-forge-ink">{t.tool}</div>
                <div className="mt-1 text-xs leading-relaxed text-forge-body">{t.purpose}</div>
              </li>
            ))}
            {brief.toolsRequired.length === 0 ? (
              <li className="text-xs text-forge-subtle">Tooling captured in parent initiative.</li>
            ) : null}
          </ul>
        </div>
      </section>

      {/* Roles impacted + Dependencies */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-forge-border bg-forge-surface p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-forge-ink">
            <UserCog className="h-4 w-4 text-accent-purple" />
            Roles impacted
          </div>
          <ul className="space-y-2">
            {brief.rolesImpacted.map((r) => (
              <li
                key={r.role + r.impact}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-forge-border bg-forge-well/60 px-3 py-2"
              >
                <span className="text-sm font-medium text-forge-ink">{r.role}</span>
                <ImpactPill impact={r.impact} />
              </li>
            ))}
            {brief.rolesImpacted.length === 0 ? (
              <li className="text-xs text-forge-subtle">Role impact captured in parent initiative.</li>
            ) : null}
          </ul>
        </div>

        <div className="rounded-2xl border border-forge-border bg-forge-surface p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-forge-ink">
            <Cog className="h-4 w-4 text-accent-purple" />
            Dependencies
          </div>
          {brief.dependencies.length ? (
            <ul className="space-y-2 text-sm text-forge-body">
              {brief.dependencies.map((d) => (
                <li
                  key={d}
                  className="flex gap-2 rounded-xl border border-forge-border bg-forge-well/60 px-3 py-2"
                >
                  <LinkIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-purple" />
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-forge-subtle">No external dependencies flagged.</p>
          )}
        </div>
      </section>

      {evidence.length > 0 ? <EvidenceSection evidence={evidence} variant="compact" /> : null}

      {/* Footer — view full initiative */}
      {parentInitiative ? (
        <footer className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-forge-border bg-forge-well/80 px-5 py-4">
          <div className="text-sm text-forge-body">
            <span className="text-forge-subtle">This brief sits inside the full initiative:</span>{" "}
            <span className="font-semibold text-forge-ink">{parentInitiative.name}</span>
          </div>
          <Link
            href={`/tower/${tower.id}/process/${slugify(parentInitiative.name)}`}
            className="inline-flex items-center gap-2 rounded-lg border border-accent-purple/40 bg-accent-purple/10 px-4 py-2 text-sm font-semibold text-accent-purple-dark transition hover:border-accent-purple hover:bg-accent-purple/20"
          >
            View full initiative
            <ArrowRight className="h-4 w-4" />
          </Link>
        </footer>
      ) : null}
    </article>
  );
}
