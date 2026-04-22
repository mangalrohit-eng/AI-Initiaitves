import { ArrowLeftRight, Building2, FileText, Sparkles } from "lucide-react";
import type { FeasibilityEvidence, FeasibilityEvidenceType } from "@/data/types";

const TYPE_META: Record<
  FeasibilityEvidenceType,
  { icon: typeof FileText; label: string; accentBorder: string; accentIcon: string }
> = {
  "case-study": {
    icon: FileText,
    label: "Case study",
    accentBorder: "border-accent-teal/30",
    accentIcon: "text-accent-teal",
  },
  vendor: {
    icon: Building2,
    label: "Vendor",
    accentBorder: "border-accent-purple/30",
    accentIcon: "text-accent-purple",
  },
  "adjacent-use-case": {
    icon: ArrowLeftRight,
    label: "Adjacent use case",
    accentBorder: "border-accent-amber/40",
    accentIcon: "text-accent-amber",
  },
};

function EvidenceCard({ item }: { item: FeasibilityEvidence }) {
  const meta = TYPE_META[item.type];
  const Icon = meta.icon;
  return (
    <article
      className={`flex h-full flex-col gap-3 rounded-2xl border bg-forge-surface p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-card ${meta.accentBorder}`}
    >
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-forge-subtle">
        <span
          className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border border-forge-border bg-forge-well/70 ${meta.accentIcon}`}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span>{meta.label}</span>
      </div>

      <h3 className="font-display text-base font-semibold leading-snug text-forge-ink">
        {item.title}
      </h3>

      <p className="text-sm leading-relaxed text-forge-body">{item.description}</p>

      {item.metric ? (
        <div className="mt-auto rounded-xl border border-accent-teal/25 bg-accent-teal/5 px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-accent-teal">
            Proof point
          </div>
          <div className="mt-0.5 font-mono text-[13px] leading-snug text-forge-ink">
            {item.metric}
          </div>
        </div>
      ) : null}

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-forge-border pt-3 text-xs text-forge-subtle">
        <span className="font-medium text-forge-body">{item.source}</span>
        <span className="font-mono text-[11px] tracking-wide">{item.year}</span>
      </footer>
    </article>
  );
}

export function EvidenceSection({
  evidence,
  variant = "default",
}: {
  evidence: FeasibilityEvidence[];
  variant?: "default" | "compact";
}) {
  if (!evidence.length) return null;
  const gridCols =
    variant === "compact"
      ? "sm:grid-cols-2"
      : "sm:grid-cols-2 xl:grid-cols-3";
  return (
    <section className="space-y-4" aria-labelledby="evidence-heading">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-accent-teal/40 bg-accent-teal/10 text-accent-teal">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <h2
            id="evidence-heading"
            className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-teal"
          >
            Why we know this works
          </h2>
        </div>
        <p className="text-sm text-forge-subtle">
          Named deployments, commercial platforms, and adjacent-industry precedents that validate
          this initiative&apos;s feasibility in the market today.
        </p>
      </header>
      <div className={`grid gap-4 ${gridCols}`}>
        {evidence.map((ev) => (
          <EvidenceCard key={`${ev.source}-${ev.title}`} item={ev} />
        ))}
      </div>
    </section>
  );
}
