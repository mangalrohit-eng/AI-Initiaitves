import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarClock } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { getProductIcon } from "@/config/productIcons";
import {
  getActiveProducts,
  type ForgeProduct,
} from "@/config/products";
import { getPortalAudience } from "@/lib/portalAudience";

const WHY_THIS_MATTERS: Record<string, string> = {
  "offshore-plan":
    "Versant inherits the BB- credit rating with $2.75B debt and a quarterly $0.375 dividend commitment. Offshoring with the right editorial / news / political-brand carve-outs is the cleanest near-term lever to reset the cost base before the NBCU TSA expires — and this module turns the configured impact levers into a defensible plan.",
  prototypes:
    "Versant leadership and the board move faster on AI when they can experience an agent, not just read about it. This module ships clickable prototypes for the highest-impact initiatives — Reconciliation Agent for Finance close, Editorial Standards co-pilot for News, ad sales pipeline scoring on the new direct-to-advertiser model — so each tower's headline initiative has working evidence.",
  "delivery-plan":
    "The Capability Map sizes the prize, Configure Impact Levers dials in the levers, and the Offshore Plan stages the location work — the Effort Estimate is the investment case Accenture brings to Versant leadership. Scope, sequencing, effort, and the governance (Steering, Tower Leads, Editorial Standards) that keep the brand intact while the OpEx and revenue commitments get delivered.",
  workshops:
    "The Capability Map and the configured impact levers only carry weight if the right Versant tower lead has signed off on them. This module is the connective tissue — facilitator-led tower workshops with an audit trail of who agreed to which carve-outs, dial values, and sequencing assumptions, so the BB- credit story and the editorial / news / political-brand carve-outs are decided by the people accountable for them.",
};

const WHAT_TODAY: Record<string, { label: string; href: string }[]> = {
  "offshore-plan": [
    { label: "Set offshore dials per L4 in Configure Impact Levers", href: "/impact-levers" },
    { label: "Review the modeled impact estimate", href: "/impact-levers/summary" },
  ],
  prototypes: [
    { label: "See the AI initiatives by tower", href: "/towers" },
    { label: "Confirm priority levers in Configure Impact Levers", href: "/impact-levers" },
  ],
  "delivery-plan": [
    { label: "Open the executive summary", href: "/summary" },
    { label: "Confirm tower-level sizing in the Capability Map", href: "/capability-map" },
  ],
  workshops: [
    { label: "Confirm the capability map per tower", href: "/capability-map" },
    { label: "Set offshore + AI dials in Configure Impact Levers", href: "/impact-levers" },
  ],
};

type Props = { product: ForgeProduct };

export function ComingSoonPage({ product }: Props) {
  const audience = getPortalAudience();
  const Icon = getProductIcon(product.iconId);
  const activePeers = getActiveProducts(audience);
  const whyText = WHY_THIS_MATTERS[product.id];
  const todaySuggestions = WHAT_TODAY[product.id] ?? [];
  const statusLabel = product.comingSoonLabel ?? "Coming next";
  const statusClass =
    statusLabel === "Coming next"
      ? "border-accent-amber/40 bg-accent-amber/10 text-accent-amber"
      : "border-forge-border bg-forge-well/60 text-forge-subtle";

  return (
    <PageShell>
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-forge-subtle hover:text-forge-ink"
        >
          <ArrowLeft className="h-3 w-3" />
          Program home
        </Link>

        <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-forge-border bg-forge-surface px-3 py-1 text-[11px] uppercase tracking-wider text-forge-subtle">
          Versant Forge Program · Coming soon
        </div>

        <div className="mt-5 flex flex-wrap items-start gap-5">
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl border border-forge-border bg-forge-well/60 text-accent-purple-dark">
            <Icon className="h-7 w-7" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-semibold text-forge-ink sm:text-3xl">
                &gt; {product.name}
              </h1>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${statusClass}`}
              >
                <CalendarClock className="h-3 w-3" />
                {statusLabel}
              </span>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-forge-body">
              {product.shortDescription}
            </p>
          </div>
        </div>

        {product.comingSoonBullets && product.comingSoonBullets.length > 0 ? (
          <section className="mt-8 rounded-2xl border border-forge-border bg-forge-surface/70 p-5">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-forge-subtle">
              &gt; What this will cover
            </h2>
            <ul className="mt-4 space-y-2.5">
              {product.comingSoonBullets.map((b, idx) => (
                <li key={idx} className="flex gap-3 text-sm leading-relaxed text-forge-body">
                  <span
                    aria-hidden
                    className="mt-2 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent-purple"
                  />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {whyText ? (
          <section className="mt-6 rounded-2xl border border-accent-purple/30 bg-accent-purple/5 p-5">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-accent-purple-dark">
              &gt; Why this matters for Versant
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-forge-body">{whyText}</p>
          </section>
        ) : null}

        {todaySuggestions.length > 0 ? (
          <section className="mt-6">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-forge-subtle">
              &gt; What you can do today
            </h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {todaySuggestions.map((s) => (
                <Link
                  key={s.href}
                  href={s.href}
                  className="group flex items-center justify-between gap-3 rounded-xl border border-forge-border bg-forge-surface p-3 text-sm text-forge-body transition hover:border-accent-purple/40 hover:text-forge-ink"
                >
                  <span>{s.label}</span>
                  <ArrowRight className="h-4 w-4 flex-shrink-0 text-forge-subtle group-hover:text-accent-purple-dark" />
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {activePeers.length > 0 ? (
          <section className="mt-10">
            <h2 className="font-display text-xs font-semibold uppercase tracking-wider text-forge-hint">
              Active modules in the program
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {activePeers.map((p) => {
                const PIcon = getProductIcon(p.iconId);
                return (
                  <Link
                    key={p.id}
                    href={p.path}
                    className="inline-flex items-center gap-2 rounded-full border border-forge-border bg-forge-surface px-3 py-1.5 text-xs text-forge-body transition hover:border-accent-purple/40 hover:text-forge-ink"
                  >
                    <PIcon className="h-3.5 w-3.5 text-accent-purple-dark" aria-hidden />
                    {p.name}
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>
    </PageShell>
  );
}
