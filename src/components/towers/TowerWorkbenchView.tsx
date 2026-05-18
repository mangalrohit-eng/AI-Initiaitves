"use client";

import * as React from "react";
import {
  ArrowUpRight,
  Building2,
  Calendar,
  ChevronRight,
  Compass,
  Cpu,
  Layers,
  Network,
  ScrollText,
  ShieldCheck,
  Signpost,
  Sparkles,
  Target,
  Users,
  Wrench,
} from "lucide-react";
import type { Tower, TowerWorkbench, WorkbenchSurface } from "@/data/types";
import { TOWER_WORKBENCHES } from "@/data/towerWorkbenches";
import {
  resolveSolutionIcon,
} from "@/lib/initiatives/solutionIconAllowlist";
import { useInitiativeReviewsV6 } from "@/lib/initiatives/useInitiativeReviewsV6";
import {
  matchCapabilitiesToInitiatives,
  uniqueMatchedInitiativeIds,
  type WorkbenchCapabilityMatch,
} from "@/lib/workbench/matchCapabilities";
import { cn } from "@/lib/utils";

/**
 * Tower Workbench tab — the per-tower, custom-built user-facing app
 * that consolidates the tower's point-solution L3 Initiatives behind
 * 4-8 surfaces in the tower's native vernacular.
 *
 * Reads the canonical hand-authored `TOWER_WORKBENCHES[towerId]` record
 * and surfaces its identity, surfaces, why-consolidated, why-custom,
 * digital core, workforce shift, success metric, and rollout pattern.
 *
 * Each surface card fuzzy-matches its `poweredByCapabilities` against
 * the live curated L3 initiatives and renders click-through chips when
 * a confident match exists; surfaces stay readable when no match
 * exists (capability shown as plain text).
 *
 * Distinct from the per-initiative `WorkbenchLens` (which is the tools
 * lens on a single AI Solution deep-dive). Type and component names
 * disambiguate.
 */
export function TowerWorkbenchView({ tower }: { tower: Tower }) {
  const workbench: TowerWorkbench | undefined = TOWER_WORKBENCHES[tower.id];
  const { result } = useInitiativeReviewsV6(tower);

  const allInitiatives = React.useMemo(() => {
    return result.l3Rows.flatMap((r) => r.initiatives);
  }, [result]);

  const surfacesWithMatches = React.useMemo(() => {
    if (!workbench) return [];
    return workbench.surfaces.map((surface) => ({
      surface,
      matches: matchCapabilitiesToInitiatives(
        surface.poweredByCapabilities,
        allInitiatives,
      ),
    }));
  }, [workbench, allInitiatives]);

  const uniquePoweredByCount = React.useMemo(
    () => uniqueMatchedInitiativeIds(surfacesWithMatches).length,
    [surfacesWithMatches],
  );

  if (!workbench) {
    return <EmptyWorkbenchState towerName={tower.name} />;
  }

  return (
    <div className="space-y-8">
      <WorkbenchHeader
        workbench={workbench}
        liveSurfaceCount={workbench.surfaces.length}
        livePoweredByCount={uniquePoweredByCount}
      />

      <SurfacesGrid
        surfacesWithMatches={surfacesWithMatches}
        towerIconKey={tower.iconKey}
      />

      <WhyPanels workbench={workbench} />

      <DigitalCorePanel workbench={workbench} />

      <BottomLine workbench={workbench} />
    </div>
  );
}

// ===========================================================================
//   Header
// ===========================================================================

function WorkbenchHeader({
  workbench,
  liveSurfaceCount,
  livePoweredByCount,
}: {
  workbench: TowerWorkbench;
  liveSurfaceCount: number;
  livePoweredByCount: number;
}) {
  return (
    <section
      aria-label={`${workbench.name} overview`}
      className="rounded-2xl border border-accent-purple/30 bg-gradient-to-br from-accent-purple/10 via-forge-surface to-forge-surface p-6 shadow-[0_0_0_1px_rgba(161,0,255,0.10)]"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono uppercase tracking-[0.18em] text-accent-purple-light">
            <span>&gt;</span>
            <span>Tower Workbench</span>
            <span className="text-forge-hint">·</span>
            <span className="text-forge-subtle">Custom build</span>
          </div>
          <h2 className="mt-2 font-display text-2xl font-semibold text-forge-ink sm:text-3xl">
            {workbench.name}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-forge-body">
            {workbench.tagline}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {workbench.primaryUsers.map((u) => (
              <span
                key={u}
                className="inline-flex items-center gap-1 rounded-full border border-forge-border bg-forge-well/40 px-2.5 py-1 text-[11px] text-forge-body"
              >
                <Users className="h-3 w-3 text-forge-hint" aria-hidden />
                {u}
              </span>
            ))}
          </div>
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2 lg:gap-2.5">
          <Stat
            label="Build effort"
            value={workbench.buildEffort}
            Icon={Wrench}
          />
          <Stat
            label="Delivery"
            value={`${workbench.estimatedDeliveryMonths} months`}
            Icon={Calendar}
          />
          <Stat
            label="Surfaces"
            value={`${liveSurfaceCount}`}
            Icon={Layers}
          />
          <Stat
            label="Powered by"
            value={`${livePoweredByCount} AI Solutions`}
            Icon={Sparkles}
          />
        </div>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  Icon,
}: {
  label: string;
  value: string;
  Icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-xl border border-forge-border bg-forge-surface/80 px-3 py-2">
      <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-forge-hint">
        <Icon className="h-3 w-3" aria-hidden />
        {label}
      </div>
      <div className="mt-1 font-mono text-xs font-semibold text-forge-ink">
        {value}
      </div>
    </div>
  );
}

// ===========================================================================
//   Surfaces grid — the headline content
// ===========================================================================

function SurfacesGrid({
  surfacesWithMatches,
  towerIconKey,
}: {
  surfacesWithMatches: { surface: WorkbenchSurface; matches: WorkbenchCapabilityMatch[] }[];
  towerIconKey?: string;
}) {
  return (
    <section aria-label="Workbench surfaces" className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-forge-hint">
            &gt; Surfaces
          </div>
          <h3 className="mt-1 font-display text-lg font-semibold text-forge-ink">
            What people actually do in this workbench
          </h3>
        </div>
        <span className="font-mono text-[11px] uppercase tracking-wider text-forge-hint">
          {surfacesWithMatches.length} surfaces
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {surfacesWithMatches.map(({ surface, matches }) => (
          <SurfaceCard
            key={surface.id}
            surface={surface}
            matches={matches}
            towerIconKey={towerIconKey}
          />
        ))}
      </div>
    </section>
  );
}

function SurfaceCard({
  surface,
  matches,
  towerIconKey,
}: {
  surface: WorkbenchSurface;
  matches: WorkbenchCapabilityMatch[];
  towerIconKey?: string;
}) {
  const Icon = resolveSolutionIcon(surface.iconKey, {
    feasibility: "ship-ready",
    towerIconKey,
    seed: surface.id,
  });
  const matchedCount = matches.filter((m) => m.init).length;

  return (
    <div className="group relative flex h-full flex-col gap-3 rounded-2xl border border-forge-border bg-forge-surface/70 p-4 transition hover:border-accent-purple/40 hover:bg-forge-surface">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-accent-purple/40 bg-accent-purple/10 text-accent-purple-light"
        >
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center rounded-full border border-accent-purple/40 bg-accent-purple/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-accent-purple-light">
              {surface.verb}
            </span>
            {matchedCount > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-accent-teal/40 bg-accent-teal/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-accent-teal">
                <Sparkles className="h-2.5 w-2.5" aria-hidden />
                {matchedCount} live
              </span>
            ) : null}
          </div>
          <h4 className="mt-1.5 font-display text-base font-semibold text-forge-ink">
            {surface.name}
          </h4>
        </div>
      </div>

      <p className="text-sm leading-relaxed text-forge-body">
        {surface.primaryAction}
      </p>
      <p className="text-[12.5px] leading-relaxed text-forge-subtle">
        {surface.description}
      </p>

      {matches.length > 0 ? (
        <div className="mt-auto border-t border-forge-border/60 pt-3">
          <div className="text-[10px] font-mono uppercase tracking-wider text-forge-hint">
            Powered by
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {matches.map((m) => (
              <PoweredByChip key={`${surface.id}-${m.capability}`} match={m} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PoweredByChip({ match }: { match: WorkbenchCapabilityMatch }) {
  if (match.init && match.init.initiativeHref) {
    return (
      <a
        href={match.init.initiativeHref}
        className="inline-flex max-w-full items-center gap-1 truncate rounded-full border border-accent-teal/40 bg-accent-teal/10 px-2 py-0.5 text-[11px] text-accent-teal transition hover:bg-accent-teal/15"
        title={`${match.init.solutionName} — open deep dive`}
      >
        <span className="truncate">{match.init.solutionName}</span>
        <ArrowUpRight className="h-3 w-3 shrink-0" aria-hidden />
      </a>
    );
  }
  return (
    <span
      className="inline-flex items-center rounded-full border border-forge-border bg-forge-well/40 px-2 py-0.5 text-[11px] text-forge-subtle"
      title={
        match.init
          ? match.init.solutionName
          : "No matching curated AI Solution yet — capability described by the canonical workbench."
      }
    >
      {match.capability}
    </span>
  );
}

// ===========================================================================
//   Why panels (consolidated + custom build)
// ===========================================================================

function WhyPanels({ workbench }: { workbench: TowerWorkbench }) {
  return (
    <section
      aria-label="Why one workbench, custom built"
      className="grid gap-3 md:grid-cols-2"
    >
      <WhyCard
        eyebrow="Why one workbench (not five tools)"
        body={workbench.whyConsolidated}
        Icon={Network}
        accent="purple"
      />
      <WhyCard
        eyebrow="Why custom build (no COTS)"
        body={workbench.whyCustomBuild}
        Icon={Compass}
        accent="teal"
        chips={workbench.digitalCore.integrations}
      />
    </section>
  );
}

function WhyCard({
  eyebrow,
  body,
  Icon,
  accent,
  chips,
}: {
  eyebrow: string;
  body: string;
  Icon: React.ComponentType<{ className?: string }>;
  accent: "purple" | "teal";
  chips?: string[];
}) {
  const tone =
    accent === "purple"
      ? "border-l-accent-purple bg-accent-purple/5"
      : "border-l-accent-teal bg-accent-teal/5";
  return (
    <div
      className={cn(
        "flex h-full flex-col gap-3 rounded-2xl border border-l-4 bg-forge-surface/70 p-5",
        tone,
        accent === "purple" ? "border-forge-border" : "border-forge-border",
      )}
    >
      <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.18em] text-forge-hint">
        <Icon
          className={cn(
            "h-3.5 w-3.5",
            accent === "purple" ? "text-accent-purple-light" : "text-accent-teal",
          )}
          aria-hidden
        />
        {eyebrow}
      </div>
      <p className="text-sm leading-relaxed text-forge-body">{body}</p>
      {chips && chips.length > 0 ? (
        <div className="mt-auto pt-2">
          <div className="text-[10px] font-mono uppercase tracking-wider text-forge-hint">
            Wraps
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <span
                key={c}
                className="inline-flex items-center rounded-full border border-forge-border bg-forge-well/40 px-2 py-0.5 text-[11px] text-forge-body"
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ===========================================================================
//   Digital core panel
// ===========================================================================

function DigitalCorePanel({ workbench }: { workbench: TowerWorkbench }) {
  const rows: { label: string; value: string; Icon: React.ComponentType<{ className?: string }> }[] = [
    {
      label: "Knowledge store",
      value: workbench.digitalCore.knowledgeStore,
      Icon: Cpu,
    },
    {
      label: "Identity",
      value: workbench.digitalCore.identity,
      Icon: ShieldCheck,
    },
    {
      label: "Agent router",
      value: workbench.digitalCore.agentRouter,
      Icon: Signpost,
    },
    {
      label: "Audit log",
      value: workbench.digitalCore.auditLog,
      Icon: ScrollText,
    },
  ];

  return (
    <section aria-label="Digital core" className="space-y-3">
      <div>
        <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-forge-hint">
          &gt; Digital core
        </div>
        <h3 className="mt-1 font-display text-lg font-semibold text-forge-ink">
          What sits beneath every surface
        </h3>
      </div>
      <div className="rounded-2xl border border-forge-border bg-forge-surface/70 p-5">
        <ul className="space-y-3">
          {rows.map(({ label, value, Icon }) => (
            <li key={label} className="flex items-start gap-3">
              <span
                aria-hidden
                className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-forge-border bg-forge-well/50 text-forge-subtle"
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-mono uppercase tracking-wider text-forge-hint">
                  {label}
                </div>
                <div className="text-sm text-forge-body">{value}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ===========================================================================
//   Bottom line — workforce shift, single success metric, rollout
// ===========================================================================

function BottomLine({ workbench }: { workbench: TowerWorkbench }) {
  return (
    <section
      aria-label="What it changes and how it lands"
      className="grid gap-3 md:grid-cols-3"
    >
      <Tile
        eyebrow="Workforce shift"
        body={workbench.workforceShift}
        Icon={Users}
      />
      <Tile
        eyebrow="The one number that matters"
        body={workbench.successMetric}
        Icon={Target}
        mono
      />
      <Tile
        eyebrow="Rollout"
        body={workbench.rolloutPattern}
        Icon={ChevronRight}
      />
    </section>
  );
}

function Tile({
  eyebrow,
  body,
  Icon,
  mono,
}: {
  eyebrow: string;
  body: string;
  Icon: React.ComponentType<{ className?: string }>;
  mono?: boolean;
}) {
  return (
    <div className="flex h-full flex-col gap-2 rounded-2xl border border-forge-border bg-forge-surface/70 p-4">
      <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.18em] text-forge-hint">
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {eyebrow}
      </div>
      <p
        className={cn(
          "text-sm leading-relaxed",
          mono ? "font-mono text-forge-ink" : "text-forge-body",
        )}
      >
        {body}
      </p>
    </div>
  );
}

// ===========================================================================
//   Empty state
// ===========================================================================

function EmptyWorkbenchState({ towerName }: { towerName: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-forge-border bg-forge-well/30 p-10 text-center">
      <Building2 className="mx-auto h-6 w-6 text-forge-hint" aria-hidden />
      <p className="mt-3 font-display text-base font-semibold text-forge-ink">
        Workbench not yet authored for {towerName}.
      </p>
      <p className="mt-2 text-xs text-forge-subtle">
        The Solutions tab still shows every curated AI Solution for this tower.
      </p>
    </div>
  );
}
