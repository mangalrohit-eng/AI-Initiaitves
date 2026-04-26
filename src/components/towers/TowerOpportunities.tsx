import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import type { Tower } from "@/data/types";
import { deriveTopOpportunities, slugify } from "@/lib/utils";

export function TowerOpportunities({ tower }: { tower: Tower }) {
  const opportunities = deriveTopOpportunities(tower, 3);
  if (opportunities.length === 0) return null;

  const curated = Boolean(tower.topOpportunities?.length);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-forge-border bg-accent-purple/5 px-3 py-1 text-xs font-medium text-accent-purple-dark">
            <Sparkles className="h-3 w-3" />
            Top 3 opportunities
          </div>
          <h2 className="mt-3 font-display text-xl font-semibold text-forge-ink">
            Where AI will help this tower first
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-forge-subtle">
            {curated
              ? "Curated by the tower leads as the highest-leverage AI initiatives."
              : "Ranked by qualitative impact tier (High > Medium > Low). Tower leads can pin a curated list."}
          </p>
        </div>
      </div>
      <ol className="grid gap-3 md:grid-cols-3">
        {opportunities.map((op, i) => {
          const linked = op.processId
            ? tower.processes.find((p) => p.id === op.processId)
            : undefined;
          const content = (
            <div className="flex h-full flex-col gap-3 rounded-2xl border border-forge-border bg-forge-surface p-5 shadow-sm transition group-hover:border-accent-purple/50 group-hover:shadow-card">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-forge-hint">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-purple/10 font-mono text-[11px] text-accent-purple-dark">
                  {i + 1}
                </span>
                Opportunity
              </div>
              <div className="flex-1">
                <div className="font-display text-base font-semibold leading-snug text-forge-ink group-hover:text-accent-purple-dark">
                  {op.headline}
                </div>
                {op.impact ? (
                  <p className="mt-2 text-sm leading-relaxed text-forge-body">{op.impact}</p>
                ) : null}
              </div>
              {linked ? (
                <div className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-accent-purple-dark">
                  Explore initiative
                  <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                </div>
              ) : null}
            </div>
          );
          return (
            <li key={`${op.headline}-${i}`} className="group">
              {linked ? (
                <Link
                  href={`/tower/${tower.id}/process/${slugify(linked.name)}`}
                  className="block h-full"
                >
                  {content}
                </Link>
              ) : (
                content
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
