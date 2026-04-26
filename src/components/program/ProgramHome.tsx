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
  getMyTowers,
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

/** Per-product tagline for the larger initiative cards. */
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
  const [myTowers, setMyTowersState] = React.useState<string[]>([]);
  const [program, setProgram] = React.useState<AssessProgramV2 | null>(null);

  React.useEffect(() => {
    setPersonaState(getPersona());
    setMyTowersState(getMyTowers());
    setProgram(getAssessProgram());
    const unsubP = subscribe("persona", () => setPersonaState(getPersona()));
    const unsubM = subscribe("myTowers", () => setMyTowersState(getMyTowers()));
    const unsubA = subscribe("assessProgram", () => setProgram(getAssessProgram()));
    return () => {
      unsubP();
      unsubM();
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

  const primaryCta: { label: string; href: string } = (() => {
    if (persona === "executive") return { label: "Open executive summary", href: "/summary" };
    if (myTowers.length > 0)
      return {
        label: `Open my ${myTowers.length} tower${myTowers.length === 1 ? "" : "s"}`,
        href: "/capability-map",
      };
    return { label: "Pick my towers", href: "/capability-map?picker=open" };
  })();

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
      <div className="mx-auto max-w-6xl px-4 pb-6 pt-6 sm:px-6 sm:pt-8 lg:px-8">
        {/* ========== HERO (compact) ========== */}
        <section className="relative overflow-hidden rounded-2xl border border-forge-border bg-gradient-to-br from-accent-purple/10 via-forge-surface to-forge-surface px-5 py-5 sm:px-7 sm:py-6">
          <div
            aria-hidden
            className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-accent-purple/10 blur-3xl"
          />
          <div className="relative flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="inline-flex items-center gap-2 rounded-full border border-forge-border bg-forge-surface px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-forge-subtle">
                <Sparkles className="h-3 w-3 text-accent-purple" aria-hidden />
                Forge Program · Accenture × Versant
              </div>
              <h1 className="mt-2 font-display text-2xl font-semibold leading-tight tracking-tight text-forge-ink sm:text-3xl">
                &gt; Map the work. Dial the levers. See the dollars.
              </h1>
              <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-forge-body sm:text-sm">
                Tower-by-tower against $2.43B adj. EBITDA, BB- credit, and the NBCU TSA expiration.
              </p>
            </div>
            <div className="flex flex-col items-stretch gap-2 sm:items-end">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={primaryCta.href}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-accent-purple px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-purple-dark"
                >
                  {primaryCta.label}
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/summary"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-forge-border bg-forge-surface px-3 py-2 text-xs font-medium text-forge-body transition hover:border-accent-purple/40"
                >
                  Executive summary
                </Link>
              </div>
              <div
                className="flex flex-wrap items-center gap-1.5"
                role="group"
                aria-label="Pick your persona"
              >
                <span className="text-[10px] uppercase tracking-wider text-forge-hint">I&apos;m a:</span>
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
            </div>
          </div>
        </section>

        {/* ========== THREE-STEP STORY: thin, single-row navigation ========== */}
        <ol className="mt-3 grid gap-2 sm:grid-cols-3">
          <StoryStrip
            step={1}
            title="Confirm capabilities"
            href="/capability-map"
            icon={<MapIcon className="h-3.5 w-3.5" />}
            metricLabel="L4"
            metricValue={counts ? String(counts.l4) : "—"}
            footer={
              counts
                ? `${counts.contributingTowers}/${towers.length} towers`
                : "Capability Map"
            }
          />
          <StoryStrip
            step={2}
            title="Dial the levers"
            href="/assessment"
            icon={<Sparkles className="h-3.5 w-3.5" />}
            metricLabel="Off / AI"
            metricValue={
              summary
                ? `${summary.weightedScenarioOffshorePct.toFixed(0)}% / ${summary.weightedScenarioAiPct.toFixed(0)}%`
                : "— / —"
            }
            footer={
              summary && summary.totalPool > 0
                ? `Pool ${formatMoney(summary.totalPool, { decimals: 1 })}`
                : "Assessment"
            }
            secondaryIcons={[
              { Icon: Globe2, accent: "purple" },
              { Icon: Cpu, accent: "teal" },
            ]}
          />
          <StoryStrip
            step={3}
            title="See the impact"
            href="/assessment/summary"
            icon={<TrendingUp className="h-3.5 w-3.5" />}
            accent
            money={summary?.scenarioCombined ?? 0}
            footer={
              summary && summary.scenarioCombined > 0
                ? `Off ${formatMoney(summary.scenarioOffshore, { decimals: 1 })} · AI ${formatMoney(summary.scenarioAi, { decimals: 1 })}`
                : "Lights up as dials move"
            }
          />
        </ol>

        {/* ========== INITIATIVE DETAIL (AI Initiatives + Offshore Plan) ========== */}
        {initiativeBoxes.length > 0 ? (
          <section className="mt-6">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-forge-subtle">
                &gt; Initiative detail
              </h2>
              <span className="text-[11px] text-forge-hint">
                What sits behind the dials
              </span>
            </div>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
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

        {/* ========== REST OF THE PROGRAM (single chip strip) ========== */}
        {otherSurfaces.length > 0 ? (
          <section className="mt-4">
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-forge-border bg-forge-surface/60 px-3 py-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-forge-hint">
                &gt; Shipping next
              </span>
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

/* ============== THIN STEP-STRIP CARD ============== */

type AccentHue = "purple" | "teal";

function StoryStrip({
  step,
  title,
  href,
  icon,
  metricLabel,
  metricValue,
  money,
  footer,
  accent,
  secondaryIcons,
}: {
  step: number;
  title: string;
  href: string;
  icon: React.ReactNode;
  metricLabel?: string;
  metricValue?: string;
  money?: number;
  footer?: string;
  accent?: boolean;
  secondaryIcons?: { Icon: React.ComponentType<{ className?: string }>; accent: AccentHue }[];
}) {
  return (
    <li className="list-none">
      <Link
        href={href}
        className={
          "group flex h-full items-center gap-3 rounded-xl border px-3 py-2.5 transition " +
          (accent
            ? "border-accent-purple/40 bg-gradient-to-br from-accent-purple/12 via-forge-surface to-forge-surface hover:border-accent-purple/60"
            : "border-forge-border bg-forge-surface hover:border-accent-purple/40")
        }
      >
        <span
          className={
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-semibold " +
            (accent
              ? "bg-accent-purple text-white"
              : "border border-forge-border-strong bg-forge-well text-forge-body")
          }
          aria-hidden
        >
          {step}
        </span>
        <span
          className={
            "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md " +
            (accent
              ? "bg-accent-purple/20 text-accent-purple-dark"
              : "bg-forge-well/70 text-accent-purple-dark")
          }
          aria-hidden
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <h3 className="font-display text-sm font-semibold leading-tight text-forge-ink">
              {title}
            </h3>
          </div>
          {money !== undefined ? (
            <div className="mt-0.5 font-display text-lg font-semibold leading-tight tracking-tight text-forge-ink">
              {money > 0 ? (
                <MoneyCounter value={money} decimals={1} />
              ) : (
                <span className="text-forge-subtle">$—</span>
              )}
            </div>
          ) : metricValue ? (
            <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[12px] leading-tight">
              {secondaryIcons
                ? secondaryIcons.map(({ Icon, accent: hue }, i) => (
                    <Icon
                      key={i}
                      className={
                        "h-3 w-3 " +
                        (hue === "purple"
                          ? "text-accent-purple-dark"
                          : "text-accent-teal")
                      }
                      aria-hidden
                    />
                  ))
                : null}
              <span className="text-forge-hint">{metricLabel}</span>
              <span className="font-semibold text-forge-ink">{metricValue}</span>
            </div>
          ) : null}
          {footer ? (
            <div className="mt-0.5 truncate text-[11px] text-forge-subtle">{footer}</div>
          ) : null}
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-forge-subtle transition group-hover:text-accent-purple-dark" />
      </Link>
    </li>
  );
}

/* ============== LARGE INITIATIVE CARD ============== */

function InitiativeCard({ product, bullet }: { product: ForgeProduct; bullet?: string }) {
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
            "flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border " +
            (isActive
              ? "border-forge-border bg-forge-well/80 text-accent-purple-dark"
              : "border-forge-border bg-forge-well/50 text-forge-subtle")
          }
        >
          <Icon className="h-6 w-6" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              className={
                "font-display text-lg font-semibold leading-snug " +
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
          {bullet ? (
            <p className="mt-2 font-mono text-[11px] leading-relaxed text-forge-subtle">
              {bullet}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-auto flex items-center justify-between text-xs">
        <span className="font-mono text-accent-purple">{product.path}</span>
        <span className="inline-flex items-center gap-1 text-forge-subtle group-hover:text-accent-purple-dark">
          {isActive ? "Open module" : "Read what's coming"}
          <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
}

/* ============== PRODUCT CHIP ============== */

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
