"use client";

import * as React from "react";
import { ChevronDown, Eye, Users } from "lucide-react";
import type { L3WorkforceRow } from "@/data/assess/types";
import type {
  CapabilityMapViewModel,
  MapViewL3,
  MapViewL4,
} from "@/lib/assess/capabilityMapTree";
import { findRowForMapL3 } from "@/lib/assess/capabilityMapTree";
import {
  CurationPill,
  CurationScoreboard,
} from "@/components/capabilityMap/CurationPill";
import type { ComposedVerdict } from "@/lib/initiatives/composeVerdict";
import { cn } from "@/lib/utils";

type Props = {
  view: CapabilityMapViewModel;
  rows: L3WorkforceRow[];
  /**
   * When true the rendered tree is the predefined seed map (no rows uploaded
   * yet). Adds a Preview banner and suppresses every per-box headcount cell —
   * those become meaningful only once the user loads a footprint.
   */
  isPreview?: boolean;
  /**
   * Optional verdict lookup — when present, every L4 chip renders a curation
   * pill and the panel header shows the per-tower scoreboard. Built off the
   * canonical capability map; safe to omit on the program-wide hub view.
   */
  verdictLookup?: {
    byId: Map<string, ComposedVerdict>;
    byNameKey: Map<string, ComposedVerdict>;
  };
  /** Aggregate counts shown in the scoreboard. Pair with `verdictLookup`. */
  scoreboardSummary?: {
    eligible: number;
    notEligible: number;
    pending: number;
    totalL4: number;
  };
};

/**
 * Layered capability tree with two distinct visual bands:
 *
 *   1. L1 banner + L2 row + L3 grid (the "L3 band") — every L3 is always
 *      visible. No L4 chips ever sit inside this band.
 *   2. A divider, then an L4 band that renders only when at least one L3 is
 *      active. The band reuses the same equal-width column structure as the
 *      L3 band, and shows ghost L3 captions + their L4 chips per column.
 *
 * Multiple L3s can be active simultaneously. A top-line "Show all L4" /
 * "Hide all L4" master toggle expands or collapses everything in one shot.
 *
 * Tier colours ride a purple-intensity gradient — red/amber/teal/green are
 * reserved for priority and savings semantics elsewhere in the app, so we
 * don't repurpose them for hierarchy.
 *
 * Source of truth: rows always when present; the predefined map only when
 * `isPreview === true` (no rows yet).
 */
export function CapabilityMapPanel({
  view,
  rows,
  isPreview = false,
  verdictLookup,
  scoreboardSummary,
}: Props) {
  const allL3Keys = React.useMemo(
    () => view.l2.flatMap((l2) => l2.l3.map((l3) => keyOf(l2.name, l3.name))),
    [view],
  );
  const totalL4 = React.useMemo(
    () => view.l2.reduce((s, l2) => s + l2.l3.reduce((t, l3) => t + l3.l4.length, 0), 0),
    [view],
  );

  // Per-L3 headcount comes straight from the L3 workforce row. L4 activities
  // are display-only metadata and don't carry their own headcount in this
  // model — they show as anonymous chips under the active L3.
  const hcByRowId = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) {
      m.set(
        r.id,
        (r.fteOnshore || 0) +
          (r.fteOffshore || 0) +
          (r.contractorOnshore || 0) +
          (r.contractorOffshore || 0),
      );
    }
    return m;
  }, [rows]);

  const l3Headcount = React.useCallback(
    (l2Name: string, l3: MapViewL3): number | null => {
      if (isPreview) return null;
      const r = findRowForMapL3(rows, l2Name, l3.name);
      if (!r) return null;
      return hcByRowId.get(r.id) ?? 0;
    },
    [hcByRowId, rows, isPreview],
  );

  const l2Headcount = React.useCallback(
    (l2: { name: string; l3: MapViewL3[] }): number | null => {
      if (isPreview) return null;
      let any = false;
      let sum = 0;
      for (const l3 of l2.l3) {
        const v = l3Headcount(l2.name, l3);
        if (v != null) {
          any = true;
          sum += v;
        }
      }
      return any ? sum : null;
    },
    [l3Headcount, isPreview],
  );

  const towerHeadcount = React.useMemo(() => {
    if (isPreview || hcByRowId.size === 0) return null;
    let sum = 0;
    hcByRowId.forEach((v) => {
      sum += v;
    });
    return sum;
  }, [hcByRowId, isPreview]);

  const [active, setActive] = React.useState<Set<string>>(() => new Set());
  const allActive = active.size > 0 && active.size === allL3Keys.length;
  const anyActive = active.size > 0;

  const toggleL3 = React.useCallback((key: string) => {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);
  const masterToggle = React.useCallback(() => {
    setActive((prev) => (prev.size > 0 ? new Set() : new Set(allL3Keys)));
  }, [allL3Keys]);

  return (
    <div className="space-y-3">
      {/* Top line: total L4 count, optional scoreboard, and master toggle. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] tabular-nums text-forge-hint">
            {totalL4} L4 activities
          </span>
          {scoreboardSummary && scoreboardSummary.totalL4 > 0 ? (
            <CurationScoreboard {...scoreboardSummary} />
          ) : null}
        </div>
        {totalL4 > 0 ? (
          <button
            type="button"
            onClick={masterToggle}
            aria-pressed={allActive}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-purple/40",
              anyActive
                ? "border-accent-purple/60 bg-accent-purple/15 text-forge-ink"
                : "border-forge-border bg-forge-surface text-forge-body hover:border-accent-purple/40 hover:text-forge-ink",
            )}
          >
            <ChevronDown
              className={cn(
                "h-3 w-3 transition-transform",
                anyActive ? "rotate-180 text-accent-purple" : "",
              )}
              aria-hidden
            />
            {anyActive ? "Hide all L4" : "Show all L4"}
          </button>
        ) : null}
      </div>

      {isPreview ? <PreviewBanner /> : null}

      {/* L1 banner — full width, deepest purple wash. */}
      <L1Banner name={view.l1Name} hc={towerHeadcount} />

      {/* L3 band: L2 row of equal-width columns, every L3 chip visible, no L4s. */}
      <div className="overflow-x-auto pb-1">
        <div className="flex items-stretch gap-3">
          {view.l2.map((l2) => (
            <L2Column
              key={l2.name}
              name={l2.name}
              hc={l2Headcount(l2)}
              l3Nodes={l2.l3}
              active={active}
              onToggleL3={(l3Name) => toggleL3(keyOf(l2.name, l3Name))}
              l3HeadcountFn={(l3) => l3Headcount(l2.name, l3)}
            />
          ))}
        </div>
      </div>

      {/* L4 band: only when at least one L3 is active. Same column structure. */}
      {anyActive ? (
        <>
          <BandDivider />
          <div className="overflow-x-auto">
            <div className="flex items-start gap-3">
              {view.l2.map((l2) => (
                <L4BandColumn
                  key={l2.name}
                  l2Name={l2.name}
                  l3Nodes={l2.l3}
                  active={active}
                  verdictLookup={verdictLookup}
                />
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function keyOf(l2: string, l3: string): string {
  return `${l2}|${l3}`;
}

const CHIP_HC_TITLE =
  "Headcount (FTE + contractor, onshore + offshore)";

function HeadcountCluster({
  hc,
  title,
  variant,
}: {
  hc: number;
  title: string;
  variant: "banner" | "chip";
}) {
  const banner = variant === "banner";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 tabular-nums",
        banner &&
          "gap-1 rounded-md border border-accent-purple/40 bg-forge-surface/70 px-2 py-0.5",
      )}
      title={title}
    >
      <Users
        className={cn(
          "shrink-0 text-accent-purple-dark/75",
          banner ? "h-3 w-3" : "h-2.5 w-2.5",
        )}
        aria-hidden
      />
      <span
        className={cn(
          "font-mono tabular-nums",
          banner
            ? "text-sm font-semibold text-forge-ink"
            : "text-[9px] font-medium text-forge-subtle",
        )}
      >
        {hc.toLocaleString()}
      </span>
    </span>
  );
}

function PreviewBanner() {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-accent-purple/30 bg-accent-purple/5 px-3 py-2 text-xs text-forge-body">
      <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-purple" aria-hidden />
      <span>
        <span className="font-semibold text-forge-ink">Preview</span> of the
        predefined capability tree. Load the sample or upload your own
        capability map &amp; headcount to replace it — your map then drives the
        assessment and downstream impact.
      </span>
    </div>
  );
}

function L1Banner({ name, hc }: { name: string; hc: number | null }) {
  return (
    <div
      data-l1
      className="flex items-center justify-between gap-3 rounded-lg border border-accent-purple/50 bg-accent-purple/20 px-4 py-2"
    >
      <div className="flex min-w-0 items-center gap-2">
        <TierBadge tier="l1" />
        <span className="truncate font-display text-sm font-semibold tracking-wide text-forge-ink">
          {name}
        </span>
      </div>
      {hc != null ? (
        <HeadcountCluster
          hc={hc}
          variant="banner"
          title="Total headcount across this tower (FTE + contractor, onshore + offshore)"
        />
      ) : null}
    </div>
  );
}

function L2Column({
  name,
  hc,
  l3Nodes,
  active,
  onToggleL3,
  l3HeadcountFn,
}: {
  name: string;
  hc: number | null;
  l3Nodes: MapViewL3[];
  active: Set<string>;
  onToggleL3: (l3Name: string) => void;
  l3HeadcountFn: (l3: MapViewL3) => number | null;
}) {
  return (
    <div
      data-l2-col={name}
      className="flex min-w-[180px] flex-1 flex-col gap-1.5"
    >
      <Box
        tier="l2"
        name={name}
        hc={hc}
        title={name}
        ariaLabel={
          hc != null
            ? `L2 ${name}, ${hc.toLocaleString()} headcount`
            : `L2 ${name}`
        }
      />
      {l3Nodes.map((l3) => {
        const isActive = active.has(keyOf(name, l3.name));
        const l3Hc = l3HeadcountFn(l3);
        return (
          <Box
            key={l3.name}
            tier="l3"
            name={l3.name}
            hc={l3Hc}
            title={l3.name}
            isActive={isActive}
            onClick={() => onToggleL3(l3.name)}
            data-l3={l3.name}
            ariaLabel={
              l3Hc != null
                ? `L3 ${l3.name}, ${l3Hc.toLocaleString()} headcount`
                : `L3 ${l3.name}`
            }
            ariaPressed={isActive}
          />
        );
      })}
    </div>
  );
}

function BandDivider() {
  return (
    <div className="flex items-center gap-3 pt-1">
      <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-accent-purple">
        <TierBadge tier="l4" />
        Activities
      </span>
      <div className="h-px flex-1 bg-gradient-to-r from-accent-purple/40 via-forge-border to-transparent" />
    </div>
  );
}

function L4BandColumn({
  l2Name,
  l3Nodes,
  active,
  verdictLookup,
}: {
  l2Name: string;
  l3Nodes: MapViewL3[];
  active: Set<string>;
  verdictLookup?: {
    byId: Map<string, ComposedVerdict>;
    byNameKey: Map<string, ComposedVerdict>;
  };
}) {
  const activeL3sInThisL2 = l3Nodes.filter((l3) =>
    active.has(keyOf(l2Name, l3.name)),
  );

  return (
    <div
      data-l4-col={l2Name}
      className="flex min-w-[180px] flex-1 flex-col gap-1.5"
    >
      {activeL3sInThisL2.length === 0 ? (
        <div
          aria-hidden
          className="h-8 rounded-md border border-dashed border-forge-border/50 bg-forge-page/30"
        />
      ) : (
        activeL3sInThisL2.map((l3) => (
          <React.Fragment key={l3.name}>
            <GhostL3Caption name={l3.name} />
            {l3.l4.length === 0 ? (
              <Box
                tier="l4-empty"
                name="No L4 activities yet — Generate above."
                hc={null}
                title="No L4 activities recorded for this L3 capability. Use Generate above to create them."
              />
            ) : (
              l3.l4.map((l4) => (
                <L4Box key={l4.id} l4={l4} verdictLookup={verdictLookup} />
              ))
            )}
          </React.Fragment>
        ))
      )}
    </div>
  );
}

function L4Box({
  l4,
  verdictLookup,
}: {
  l4: MapViewL4;
  verdictLookup?: {
    byId: Map<string, ComposedVerdict>;
    byNameKey: Map<string, ComposedVerdict>;
  };
}) {
  const verdict = React.useMemo(() => {
    if (!verdictLookup) return undefined;
    const byId = verdictLookup.byId.get(l4.id);
    if (byId) return byId;
    return verdictLookup.byNameKey.get(l4.name.trim().toLowerCase().replace(/\s+/g, " "));
  }, [verdictLookup, l4.id, l4.name]);

  return (
    <Box
      tier="l4"
      name={l4.name}
      hc={null}
      title={
        verdict?.aiRationale
          ? `${l4.name} — ${verdict.aiRationale}`
          : l4.name
      }
      data-l4={l4.id}
      ariaLabel={`L4 ${l4.name}`}
      trailingPill={
        verdict ? (
          <CurationPill
            status={verdict.status}
            priority={verdict.aiPriority}
            rationale={verdict.aiRationale}
            variant="map"
          />
        ) : null
      }
    />
  );
}

function GhostL3Caption({ name }: { name: string }) {
  return (
    <div
      className="flex h-8 w-full items-center gap-1.5 rounded-md border border-dashed border-accent-purple/35 bg-accent-purple/5 px-2"
      title={name}
    >
      <TierBadge tier="l3" muted />
      <span className="truncate text-[11px] font-medium leading-none text-accent-purple">
        {name}
      </span>
    </div>
  );
}

type BoxTier = "l2" | "l3" | "l4" | "l4-empty";
type TierKey = "l1" | "l2" | "l3" | "l4";

/**
 * Compact, color-graded tier label rendered inside every chip and banner.
 * Reinforces the hierarchy textually so readers don't have to decode the
 * purple-intensity gradient. Color saturation tracks the tier so the badge
 * itself participates in the gradient.
 */
function TierBadge({ tier, muted = false }: { tier: TierKey; muted?: boolean }) {
  const label = tier.toUpperCase();
  const base = "inline-flex shrink-0 items-center justify-center rounded font-mono font-semibold uppercase tabular-nums";
  // Two slightly different sizes — the banner uses a chunkier pill, chips a
  // tighter one. We keep both in one place so the tier system stays consistent.
  const size = "px-1 py-px text-[9px] tracking-wider";
  const palette = (() => {
    if (muted) return "border border-accent-purple/40 bg-transparent text-accent-purple";
    switch (tier) {
      case "l1":
        return "bg-accent-purple text-white";
      case "l2":
        return "bg-accent-purple/40 text-accent-purple-dark";
      case "l3":
        return "bg-accent-purple/20 text-accent-purple-dark";
      case "l4":
        return "border border-accent-purple/45 bg-forge-surface text-accent-purple-dark";
    }
  })();
  return (
    <span className={cn(base, size, palette)} aria-hidden>
      {label}
    </span>
  );
}

type BoxBaseProps = {
  tier: BoxTier;
  name: string;
  title: string;
  hc: number | null;
  isActive?: boolean;
  ariaLabel?: string;
  ariaPressed?: boolean;
  onClick?: () => void;
  /** Optional trailing element (e.g., CurationPill on L4 chips). */
  trailingPill?: React.ReactNode;
  /** Stable dataset markers for future selectors (crawler / tests). */
  "data-l3"?: string;
  "data-l4"?: string;
};

/**
 * Single equal-size box used for L2 / L3 / L4 chips. Same height (~32 px) and
 * column width across all tiers; styling differs by tier on the
 * purple-intensity gradient. Names render on a single line with a `title`
 * attribute carrying the full text.
 */
function Box(props: BoxBaseProps) {
  const {
    tier,
    name,
    title,
    hc,
    isActive,
    ariaLabel,
    ariaPressed,
    onClick,
    trailingPill,
    ...rest
  } = props;

  const className = cn(
    "flex h-8 w-full items-center gap-1.5 rounded-md border px-2 text-left transition",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-purple/40",
    tier === "l2" &&
      "border-accent-purple/35 bg-accent-purple/12 text-forge-ink",
    tier === "l3" && !isActive &&
      "cursor-pointer border-accent-purple/25 bg-accent-purple/5 text-forge-body hover:border-accent-purple/45 hover:text-forge-ink",
    tier === "l3" && isActive &&
      "cursor-pointer border-accent-purple/60 bg-accent-purple/15 text-forge-ink ring-1 ring-accent-purple/30",
    tier === "l4" &&
      "border-forge-border border-l-[3px] border-l-accent-purple/55 bg-forge-well/40 text-forge-subtle",
    tier === "l4-empty" &&
      "border-dashed border-forge-border bg-forge-page/40 text-forge-hint",
  );

  const nameClass = cn(
    "min-w-0 flex-1 truncate leading-none",
    tier === "l2" && "font-display text-[12px] font-semibold",
    tier === "l3" && "text-[11px] font-medium",
    tier === "l4" && "text-[10px] italic-none",
    tier === "l4-empty" && "text-[11px]",
  );

  // L4-empty placeholder doesn't show a badge — keeps the dashed empty state quiet.
  const badgeTier: TierKey | null =
    tier === "l2" ? "l2" : tier === "l3" ? "l3" : tier === "l4" ? "l4" : null;

  const inner = (
    <>
      {badgeTier ? <TierBadge tier={badgeTier} /> : null}
      <span className={nameClass}>{name}</span>
      {trailingPill ? <span className="ml-0.5 shrink-0">{trailingPill}</span> : null}
      {hc != null ? (
        <HeadcountCluster hc={hc} variant="chip" title={CHIP_HC_TITLE} />
      ) : null}
    </>
  );

  if (tier === "l3") {
    return (
      <button
        type="button"
        title={title}
        aria-label={ariaLabel}
        aria-pressed={ariaPressed}
        onClick={onClick}
        className={className}
        {...rest}
      >
        {inner}
      </button>
    );
  }

  return (
    <div
      title={title}
      aria-label={ariaLabel}
      className={className}
      {...rest}
    >
      {inner}
    </div>
  );
}
