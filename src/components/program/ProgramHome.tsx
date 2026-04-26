"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  Cpu,
  Globe2,
  Map as MapIcon,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { MoneyCounter, formatMoney } from "@/components/ui/MoneyCounter";
import { getProductIcon } from "@/config/productIcons";
import type { ForgeProduct } from "@/config/products";
import type { PortalAudience } from "@/lib/portalAudience";
import {
  getAssessProgram,
  getPersona,
  setPersona as persistPersona,
  subscribe,
  type Persona,
} from "@/lib/localStore";
import type { AssessProgramV2 } from "@/data/assess/types";
import { towers } from "@/data/towers";
import { programCapabilityCounts } from "@/lib/assess/capabilityCounts";
import { programImpactSummary } from "@/lib/assess/scenarioModel";

type Props = {
  products: ForgeProduct[];
  portalMode: PortalAudience;
};

const PERSONA_OPTIONS: ReadonlyArray<{
  id: Persona;
  label: string;
  showInClientMode: boolean;
}> = [
  { id: "versant", label: "Versant tower lead", showInClientMode: true },
  { id: "accenture", label: "Accenture tower lead", showInClientMode: false },
  { id: "executive", label: "Executive sponsor", showInClientMode: true },
];

const INITIATIVE_BULLET: Record<string, string> = {
  "tower-explorer":
    "13 tower roadmaps · agent architectures · 4-lens detail per process.",
  "offshore-plan":
    "Target locations · role-by-role offshorability · TSA-aware transition runway.",
};

export function ProgramHome({ products, portalMode }: Props) {
  const active = products.filter((p) => p.status === "active");
  const comingSoon = products.filter((p) => p.status === "coming-soon");
  const aiInitiatives = active.find((p) => p.id === "tower-explorer");
  const offshorePlan = comingSoon.find((p) => p.id === "offshore-plan");
  const initiativeBoxes = [aiInitiatives, offshorePlan].filter(
    (p): p is ForgeProduct => Boolean(p),
  );
  const otherSurfaces = comingSoon.filter((p) => p.id !== "offshore-plan");

  const [persona, setPersonaState] = React.useState<Persona | null>(null);
  const [program, setProgram] = React.useState<AssessProgramV2 | null>(null);

  React.useEffect(() => {
    setPersonaState(getPersona());
    setProgram(getAssessProgram());
    const unsubP = subscribe("persona", () => setPersonaState(getPersona()));
    const unsubA = subscribe("assessProgram", () => setProgram(getAssessProgram()));
    return () => {
      unsubP();
      unsubA();
    };
  }, []);

  const visiblePersonas = PERSONA_OPTIONS.filter(
    (p) => portalMode !== "client" || p.showInClientMode,
  );

  const onChoosePersona = (id: Persona) => {
    persistPersona(id);
    setPersonaState(id);
  };

  const counts = React.useMemo(
    () => (program ? programCapabilityCounts(program) : null),
    [program],
  );
  const summary = React.useMemo(
    () => (program ? programImpactSummary(program) : null),
    [program],
  );

  return (
    <PageShell>
      <div className="mx-auto max-w-6xl px-4 pb-8 pt-4 sm:px-6 lg:px-8">
        {/* ========== COMPACT HEADER ========== */}
        <header className="flex flex-wrap items-center justify-between gap-3 pb-1">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-purple/30 bg-accent-purple/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-accent-purple-dark">
            <Sparkles className="h-3 w-3" aria-hidden />
            Forge Program · Accenture × Versant
          </span>
          <div
            className="flex flex-wrap items-center gap-1"
            role="group"
            aria-label="Pick your persona"
          >
            <span className="mr-1 text-[10px] uppercase tracking-wider text-forge-hint">
              I&apos;m a:
            </span>
            {visiblePersonas.map((p) => {
              const selected = persona === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onChoosePersona(p.id)}
                  className={
                    "rounded-full border px-2 py-0.5 text-[11px] font-medium transition " +
                    (selected
                      ? "border-accent-purple bg-accent-purple text-white"
                      : "border-forge-border bg-forge-surface text-forge-body hover:border-accent-purple/40")
                  }
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </header>

        {/* ========== TIER 1 — BIGGEST: numbered workshop cards ========== */}
        <ol className="mt-4 grid gap-4 lg:grid-cols-3">
          <PrimaryCard
            step={1}
            title="Capability Map"
            subtitle="Confirm L1-L4 work and footprint"
            href="/capability-map"
            icon={<MapIcon className="h-7 w-7" />}
            metric={
              counts && counts.l4 > 0
                ? { value: String(counts.l4), label: "L4 confirmed" }
                : { value: "—", label: "Start here" }
            }
            meta={
              counts && counts.contributingTowers > 0
                ? `${counts.contributingTowers} of ${towers.length} towers · ${counts.l2} L2 · ${counts.l3} L3`
                : "Pick towers and confirm capabilities"
            }
          />
          <PrimaryCard
            step={2}
            title="Impact Levers"
            subtitle="Dial offshore + AI per L4"
            href="/assessment"
            icon={<Sparkles className="h-7 w-7" />}
            dualMetric={
              summary
                ? {
                    off: summary.weightedScenarioOffshorePct,
                    ai: summary.weightedScenarioAiPct,
                  }
                : undefined
            }
            meta={
              summary && summary.totalPool > 0
                ? `Pool ${formatMoney(summary.totalPool, { decimals: 1 })} · cost-weighted`
                : "Move dials per tower to see modeled $"
            }
          />
          <PrimaryCard
            step={3}
            title="Impact"
            subtitle="See the modeled scenario $"
            href="/assessment/summary"
            icon={<TrendingUp className="h-7 w-7" />}
            money={summary?.scenarioCombined ?? 0}
            meta={
              summary && summary.scenarioCombined > 0
                ? `Off ${formatMoney(summary.scenarioOffshore, { decimals: 1 })} · AI ${formatMoney(summary.scenarioAi, { decimals: 1 })}`
                : "Lights up as dials move"
            }
            accent
          />
        </ol>

        {/* ========== TIER 2 — MEDIUM: AI / Offshore initiatives ========== */}
        {initiativeBoxes.length > 0 ? (
          <section className="mt-5">
            <div className="grid gap-3 sm:grid-cols-2">
              {initiativeBoxes.map((p) => (
                <InitiativeCard
                  key={p.id}
                  product={p}
                  bullet={INITIATIVE_BULLET[p.id]}
                />
              ))}
            </div>
          </section>
        ) : null}

        {/* ========== TIER 3 — SMALLEST: chip strip ========== */}
        {otherSurfaces.length > 0 ? (
          <section className="mt-3">
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-forge-border bg-forge-surface/60 px-3 py-2">
              {otherSurfaces.map((p) => (
                <ProductChip key={p.id} product={p} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </PageShell>
  );
}

/* ============== TIER 1 PRIMARY CARD ============== */

type PrimaryCardProps = {
  step: number;
  title: string;
  subtitle: string;
  href: string;
  icon: React.ReactNode;
  /** Single-value metric: e.g. L4 count. */
  metric?: { value: string; label: string };
  /** Dual percentage display for the levers card. */
  dualMetric?: { off: number; ai: number };
  /** Animated $ counter for the impact card. */
  money?: number;
  /** Footer line under the metric. */
  meta?: string;
  /** Hero treatment for step 3 (purple gradient + glow). */
  accent?: boolean;
};

function PrimaryCard({
  step,
  title,
  subtitle,
  href,
  icon,
  metric,
  dualMetric,
  money,
  meta,
  accent,
}: PrimaryCardProps) {
  return (
    <li className="list-none">
      <Link
        href={href}
        className={
          "group flex h-full min-h-[220px] flex-col gap-4 rounded-2xl border p-5 shadow-sm transition sm:p-6 " +
          (accent
            ? "border-accent-purple/40 bg-gradient-to-br from-accent-purple/15 via-forge-surface to-forge-surface hover:border-accent-purple/60 hover:shadow-[0_0_0_1px_rgba(161,0,255,0.3)]"
            : "border-forge-border bg-forge-surface hover:border-accent-purple/40 hover:shadow-[0_0_0_1px_rgba(161,0,255,0.18)]")
        }
      >
        {/* Top: numbered badge + icon + arrow */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span
              className={
                "flex h-8 w-8 items-center justify-center rounded-full font-mono text-xs font-bold " +
                (accent
                  ? "bg-accent-purple text-white shadow-[0_0_0_3px_rgba(161,0,255,0.18)]"
                  : "border border-forge-border-strong bg-forge-well text-forge-body")
              }
              aria-hidden
            >
              {step}
            </span>
            <div
              className={
                "flex h-12 w-12 items-center justify-center rounded-xl border " +
                (accent
                  ? "border-accent-purple/40 bg-accent-purple/10 text-accent-purple-dark"
                  : "border-forge-border bg-forge-well/80 text-accent-purple-dark")
              }
              aria-hidden
            >
              {icon}
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-forge-subtle transition group-hover:translate-x-1 group-hover:text-accent-purple-dark" />
        </div>

        {/* Title + subtitle */}
        <div>
          <h3
            className={
              "font-display text-xl font-semibold leading-tight tracking-tight sm:text-2xl " +
              (accent
                ? "text-forge-ink"
                : "text-forge-ink group-hover:text-accent-purple-dark")
            }
          >
            {title}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-forge-subtle sm:text-sm">
            {subtitle}
          </p>
        </div>

        {/* Metric */}
        <div className="mt-auto">
          {money !== undefined ? (
            <>
              <div className="font-display text-3xl font-semibold tabular-nums tracking-tight text-forge-ink sm:text-4xl">
                {money > 0 ? (
                  <MoneyCounter value={money} decimals={1} />
                ) : (
                  <span className="text-forge-subtle">$—</span>
                )}
              </div>
              <div className="mt-1 text-[10px] font-medium uppercase tracking-wider text-forge-hint">
                Modeled scenario
              </div>
            </>
          ) : dualMetric ? (
            <>
              <div className="flex items-baseline gap-2 font-display text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl">
                <span className="inline-flex items-baseline gap-1">
                  <Globe2
                    className="h-4 w-4 self-center text-accent-purple-dark"
                    aria-hidden
                  />
                  <span className="text-accent-purple-dark">
                    {dualMetric.off.toFixed(0)}%
                  </span>
                </span>
                <span className="text-forge-hint">/</span>
                <span className="inline-flex items-baseline gap-1">
                  <Cpu
                    className="h-4 w-4 self-center text-accent-teal"
                    aria-hidden
                  />
                  <span className="text-accent-teal">
                    {dualMetric.ai.toFixed(0)}%
                  </span>
                </span>
              </div>
              <div className="mt-1 text-[10px] font-medium uppercase tracking-wider text-forge-hint">
                Cost-weighted dials
              </div>
            </>
          ) : metric ? (
            <>
              <div className="font-display text-3xl font-semibold tabular-nums tracking-tight text-forge-ink sm:text-4xl">
                {metric.value}
              </div>
              <div className="mt-1 text-[10px] font-medium uppercase tracking-wider text-forge-hint">
                {metric.label}
              </div>
            </>
          ) : null}
          {meta ? (
            <div className="mt-2 truncate text-[11px] text-forge-subtle">
              {meta}
            </div>
          ) : null}
        </div>
      </Link>
    </li>
  );
}

/* ============== TIER 2 INITIATIVE CARD ============== */

function InitiativeCard({
  product,
  bullet,
}: {
  product: ForgeProduct;
  bullet?: string;
}) {
  const Icon = getProductIcon(product.iconId);
  const isActive = product.status === "active";
  const statusLabel = isActive ? "Active" : product.comingSoonLabel ?? "Coming next";
  return (
    <Link
      href={product.path}
      className={
        "group flex h-full items-start gap-3 rounded-xl border p-4 transition " +
        (isActive
          ? "border-forge-border bg-forge-surface hover:border-accent-purple/45 hover:shadow-[0_0_0_1px_rgba(161,0,255,0.15)]"
          : "border-forge-border bg-forge-surface/70 hover:border-forge-border-strong")
      }
    >
      <div
        className={
          "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border " +
          (isActive
            ? "border-forge-border bg-forge-well/80 text-accent-purple-dark"
            : "border-forge-border bg-forge-well/50 text-forge-subtle")
        }
        aria-hidden
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3
            className={
              "font-display text-sm font-semibold leading-snug " +
              (isActive
                ? "text-forge-ink group-hover:text-accent-purple-dark"
                : "text-forge-body")
            }
          >
            {product.name}
          </h3>
          <span
            className={
              "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider " +
              (isActive
                ? "border-accent-green/40 bg-accent-green/10 text-accent-green"
                : "border-accent-amber/40 bg-accent-amber/10 text-accent-amber")
            }
          >
            {!isActive ? <CalendarClock className="h-2.5 w-2.5" aria-hidden /> : null}
            {statusLabel}
          </span>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-forge-body">
          {product.tagline}
        </p>
        {bullet ? (
          <p className="mt-1 font-mono text-[10px] leading-relaxed text-forge-subtle">
            {bullet}
          </p>
        ) : null}
      </div>
      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-forge-subtle transition group-hover:translate-x-0.5 group-hover:text-accent-purple-dark" />
    </Link>
  );
}

/* ============== TIER 3 PRODUCT CHIP ============== */

function ProductChip({ product }: { product: ForgeProduct }) {
  const Icon = getProductIcon(product.iconId);
  const isActive = product.status === "active";
  return (
    <Link
      href={product.path}
      className={
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition " +
        (isActive
          ? "border-forge-border bg-forge-surface text-forge-body hover:border-accent-purple/40 hover:text-forge-ink"
          : "border-forge-border bg-forge-surface/60 text-forge-subtle hover:border-forge-border-strong")
      }
    >
      <Icon className="h-3 w-3 text-accent-purple-dark" aria-hidden />
      <span className="font-medium">{product.navLabel}</span>
      {!isActive ? (
        <span className="inline-flex items-center gap-0.5 rounded-full border border-accent-amber/40 bg-accent-amber/10 px-1.5 py-0 text-[9px] uppercase tracking-wider text-accent-amber">
          <CalendarClock className="h-2.5 w-2.5" />
          {product.comingSoonLabel ?? "Soon"}
        </span>
      ) : null}
    </Link>
  );
}
