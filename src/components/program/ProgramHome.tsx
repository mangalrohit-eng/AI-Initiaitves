"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Map as MapIcon,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { MyTowersChips } from "@/components/assess/MyTowersChips";
import { getProductIcon } from "@/config/productIcons";
import type { ForgeProduct } from "@/config/products";
import type { PortalAudience } from "@/lib/portalAudience";
import {
  getMyTowers,
  getPersona,
  setPersona as persistPersona,
  subscribe,
  type Persona,
} from "@/lib/localStore";
import { towers } from "@/data/towers";

type Props = {
  products: ForgeProduct[];
  portalMode: PortalAudience;
};

const PERSONA_OPTIONS: ReadonlyArray<{
  id: Persona;
  label: string;
  microcopy: string;
  /** Whether this persona is shown in client-mode builds. */
  showInClientMode: boolean;
}> = [
  {
    id: "versant",
    label: "Versant tower lead",
    microcopy:
      "Confirm your tower's capability map, set offshore + AI dials, and hand off to AI Initiatives.",
    showInClientMode: true,
  },
  {
    id: "accenture",
    label: "Accenture tower lead",
    microcopy:
      "Drive the workshop end-to-end, validate scenarios with your Versant counterpart, and stage the AI roadmap.",
    showInClientMode: false,
  },
  {
    id: "executive",
    label: "Executive sponsor",
    microcopy:
      "Start with the executive summary for the cross-tower OpEx and revenue view.",
    showInClientMode: true,
  },
];

export function ProgramHome({ products, portalMode }: Props) {
  const active = products.filter((p) => p.status === "active");
  const comingSoon = products.filter((p) => p.status === "coming-soon");

  const [persona, setPersonaState] = React.useState<Persona | null>(null);
  const [myTowers, setMyTowersState] = React.useState<string[]>([]);

  React.useEffect(() => {
    setPersonaState(getPersona());
    setMyTowersState(getMyTowers());
    const unsubP = subscribe("persona", () => setPersonaState(getPersona()));
    const unsubM = subscribe("myTowers", () => setMyTowersState(getMyTowers()));
    return () => {
      unsubP();
      unsubM();
    };
  }, []);

  const visiblePersonas = PERSONA_OPTIONS.filter(
    (p) => portalMode !== "client" || p.showInClientMode,
  );
  const activePersona = visiblePersonas.find((p) => p.id === persona) ?? null;

  const onChoosePersona = (id: Persona) => {
    persistPersona(id);
    setPersonaState(id);
  };

  // Persona-aware primary CTA
  const primaryCta: { label: string; href: string; description?: string } = (() => {
    if (persona === "executive") {
      return {
        label: "Open executive summary",
        href: "/summary",
        description: "Cross-tower view: OpEx, revenue, sequencing.",
      };
    }
    // Both Versant and Accenture tower leads start in Capability Map.
    if (myTowers.length > 0) {
      return {
        label: `Open my ${myTowers.length} tower${myTowers.length === 1 ? "" : "s"}`,
        href: "/assess",
        description: "Pick up where you left off in Capability Map.",
      };
    }
    return {
      label: "Pick my towers",
      href: "/assess?picker=open",
      description: "Personalise the program around the towers you own.",
    };
  })();

  const programKpis = [
    {
      label: "Functional towers",
      value: `${towers.length}`,
      hint: "From Finance and HR to Editorial News and Production.",
      Icon: Users,
    },
    {
      label: "Active modules",
      value: `${active.length}`,
      hint: `${comingSoon.length} more shipping in the program plan.`,
      Icon: CheckCircle2,
    },
    {
      label: "Adj. EBITDA target",
      value: "$2.43B",
      hint: "Versant's standalone commitment. Source: Forge context.md.",
      Icon: TrendingUp,
    },
    {
      label: "Outcome",
      value: "OpEx ↓ · Revenue ↑",
      hint: "The whole point of the Forge Program portfolio.",
      Icon: Sparkles,
    },
  ];

  return (
    <PageShell>
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        {/* ========== HERO ========== */}
        <section className="relative overflow-hidden rounded-3xl border border-forge-border bg-gradient-to-br from-accent-purple/10 via-forge-surface to-forge-surface p-6 shadow-card sm:p-10">
          <div
            aria-hidden
            className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-accent-purple/10 blur-3xl"
          />
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-forge-border bg-forge-surface px-3 py-1 text-[11px] font-medium text-forge-subtle">
              <Sparkles className="h-3 w-3 text-accent-purple" />
              Versant Forge Program · Accenture × Versant Media Group
            </div>
            <h1 className="mt-5 max-w-3xl font-display text-3xl font-semibold leading-tight tracking-tight text-forge-ink sm:text-4xl">
              &gt; Reset operating cost. Compound revenue.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-forge-body">
              A 5-module portfolio aimed at the OpEx and revenue commitments Versant has
              taken to the public markets — sized tower by tower across the 13 functional
              towers, grounded in the BB- credit rating, the NBCU TSA expiration, and the
              brand obligations editorial standards demand.
            </p>

            {/* Persona chooser */}
            <div
              className="mt-7 flex flex-wrap items-center gap-2"
              role="group"
              aria-label="Pick your persona"
            >
              <span className="text-xs text-forge-hint">I&apos;m a:</span>
              {visiblePersonas.map((p) => {
                const selected = persona === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onChoosePersona(p.id)}
                    className={
                      "rounded-full border px-3 py-1 text-xs font-medium transition " +
                      (selected
                        ? "border-accent-purple bg-accent-purple text-white shadow-sm"
                        : "border-forge-border bg-forge-surface text-forge-body hover:border-accent-purple/40")
                    }
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
            {activePersona ? (
              <p className="mt-3 max-w-xl text-sm text-forge-body">
                {activePersona.microcopy}
              </p>
            ) : (
              <p className="mt-3 max-w-xl text-xs text-forge-hint">
                Pick a persona to land directly in your most relevant module.
              </p>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href={primaryCta.href}
                className="inline-flex items-center gap-2 rounded-lg bg-accent-purple px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-purple-dark"
              >
                {primaryCta.label}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/summary"
                className="inline-flex items-center gap-2 rounded-lg border border-forge-border bg-forge-surface px-4 py-2.5 text-sm font-medium text-forge-body transition hover:border-accent-purple/40 hover:text-forge-ink"
              >
                Executive summary
              </Link>
              <Link
                href="/towers"
                className="text-xs font-medium text-forge-subtle hover:text-forge-ink"
              >
                Browse all 13 towers →
              </Link>
            </div>
            {primaryCta.description ? (
              <p className="mt-2 text-xs text-forge-hint">{primaryCta.description}</p>
            ) : null}

            {portalMode === "client" ? (
              <p className="mt-6 inline-block rounded-md bg-forge-well/60 px-2.5 py-1 text-[11px] text-forge-subtle">
                Client build · collaboration and admin features are available only in the
                full internal experience.
              </p>
            ) : null}
          </div>
        </section>

        {/* ========== KPI STRIP ========== */}
        <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {programKpis.map((k) => (
            <div
              key={k.label}
              className="rounded-2xl border border-forge-border bg-forge-surface p-4"
            >
              <div className="flex items-center gap-2">
                <k.Icon className="h-4 w-4 text-accent-purple-dark" aria-hidden />
                <span className="text-[11px] font-medium uppercase tracking-wider text-forge-hint">
                  {k.label}
                </span>
              </div>
              <div className="mt-2 font-mono text-xl font-semibold text-forge-ink">
                {k.value}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-forge-subtle">{k.hint}</p>
            </div>
          ))}
        </section>

        {/* ========== JOURNEY ========== */}
        <section className="mt-10">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-forge-subtle">
              &gt; The program journey
            </h2>
            <span className="text-xs text-forge-hint">
              · 2 active today, 3 shipping next
            </span>
          </div>
          <ol className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-forge-border bg-forge-surface/70 p-3">
            {[...active, ...comingSoon].map((p, idx, arr) => {
              const Icon = getProductIcon(p.iconId);
              const last = idx === arr.length - 1;
              const isActive = p.status === "active";
              return (
                <React.Fragment key={p.id}>
                  <li>
                    <Link
                      href={p.path}
                      className={
                        "inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition " +
                        (isActive
                          ? "text-forge-body hover:bg-accent-purple/5 hover:text-forge-ink"
                          : "text-forge-hint hover:bg-forge-well")
                      }
                    >
                      <span
                        className={
                          "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-mono " +
                          (isActive
                            ? "bg-accent-purple text-white"
                            : "border border-forge-border-strong text-forge-hint")
                        }
                        aria-hidden
                      >
                        {idx + 1}
                      </span>
                      <Icon className="h-3.5 w-3.5" aria-hidden />
                      <span className="font-medium">{p.navLabel}</span>
                      {!isActive ? (
                        <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-forge-border px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-forge-hint">
                          <CalendarClock className="h-2.5 w-2.5" />
                          {p.comingSoonLabel ?? "Soon"}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                  {!last ? (
                    <li aria-hidden className="font-mono text-forge-hint">
                      &gt;
                    </li>
                  ) : null}
                </React.Fragment>
              );
            })}
          </ol>
        </section>

        {/* ========== MODULE GRID ========== */}
        <section className="mt-10">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-forge-subtle">
            &gt; Modules
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...active, ...comingSoon].map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>

        {/* ========== MY TOWERS ========== */}
        <section className="mt-10 rounded-2xl border border-forge-border bg-forge-surface/70 p-5">
          <MyTowersChips compact />
          {myTowers.length > 0 ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Link
                href="/assess"
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent-purple/10 px-3 py-1.5 text-xs font-medium text-accent-purple-dark transition hover:bg-accent-purple/20"
              >
                <MapIcon className="h-3.5 w-3.5" />
                Open my towers in Capability Map
                <ArrowRight className="h-3 w-3" />
              </Link>
              <Link
                href="/towers"
                className="inline-flex items-center gap-1.5 rounded-lg border border-forge-border bg-forge-surface px-3 py-1.5 text-xs font-medium text-forge-body transition hover:border-accent-purple/40"
              >
                <Sparkles className="h-3.5 w-3.5 text-accent-purple-dark" />
                See the AI agenda for my towers
              </Link>
            </div>
          ) : null}
        </section>

        {/* ========== FOUNDATIONS FOOTER ========== */}
        <section className="mt-12 rounded-2xl border border-forge-border bg-forge-well/40 p-5 text-xs leading-relaxed text-forge-subtle">
          <h2 className="font-display text-xs font-semibold uppercase tracking-wider text-forge-hint">
            &gt; Foundations
          </h2>
          <p className="mt-2">
            All financial figures are workshop modelling, not Versant-reported. Roll-ups use
            user-entered blended rates and are illustrative for planning. The system of
            record stays with Versant&apos;s reported financials.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Link href="/glossary" className="text-forge-body underline-offset-2 hover:underline">
              Glossary
            </Link>
            <span aria-hidden>·</span>
            <Link href="/changelog" className="text-forge-body underline-offset-2 hover:underline">
              What&apos;s new
            </Link>
            <span aria-hidden>·</span>
            <Link href="/summary" className="text-forge-body underline-offset-2 hover:underline">
              Executive summary
            </Link>
          </div>
        </section>
      </div>
    </PageShell>
  );
}

function ProductCard({ product }: { product: ForgeProduct }) {
  const Icon = getProductIcon(product.iconId);
  const isActive = product.status === "active";
  const statusLabel = isActive ? "Active" : product.comingSoonLabel ?? "Coming next";

  return (
    <Link
      href={product.path}
      className={
        "group flex h-full flex-col gap-3 rounded-2xl border p-5 shadow-sm transition " +
        (isActive
          ? "border-forge-border bg-forge-surface hover:border-accent-purple/50 hover:shadow-[0_0_0_1px_rgba(161,0,255,0.2)]"
          : "border-forge-border bg-forge-surface/70 hover:border-forge-border-strong")
      }
    >
      <div className="flex items-start gap-3">
        <div
          className={
            "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border " +
            (isActive
              ? "border-forge-border bg-forge-well/80 text-accent-purple-dark"
              : "border-forge-border bg-forge-well/50 text-forge-subtle")
          }
        >
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              className={
                "font-display text-base font-semibold leading-snug " +
                (isActive
                  ? "text-forge-ink group-hover:text-accent-purple-dark"
                  : "text-forge-body")
              }
            >
              {product.name}
            </h3>
            <span
              className={
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider " +
                (isActive
                  ? "border-accent-green/40 bg-accent-green/10 text-accent-green"
                  : "border-accent-amber/40 bg-accent-amber/10 text-accent-amber")
              }
            >
              {!isActive ? <CalendarClock className="h-2.5 w-2.5" aria-hidden /> : null}
              {statusLabel}
            </span>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-forge-body">
            {product.tagline}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-mono text-accent-purple">{product.path}</span>
        <span className="inline-flex items-center gap-1 text-forge-subtle group-hover:text-accent-purple-dark">
          {isActive ? "Open module" : "Read what's coming"}
          <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
}
