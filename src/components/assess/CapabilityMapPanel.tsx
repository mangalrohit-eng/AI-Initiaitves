"use client";

import * as React from "react";
import { ChevronDown, Eye } from "lucide-react";
import type { L4WorkforceRow } from "@/data/assess/types";
import type {
  CapabilityMapViewModel,
  MapViewL3,
  MapViewL4,
} from "@/lib/assess/capabilityMapTree";
import { findRowForMapL4 } from "@/lib/assess/capabilityMapTree";
import { cn } from "@/lib/utils";

type Props = {
  view: CapabilityMapViewModel;
  rows: L4WorkforceRow[];
  /**
   * When true the rendered tree is the predefined seed map (no rows uploaded
   * yet). Adds a Preview banner and suppresses every per-box headcount cell —
   * those become meaningful only once the user loads a footprint.
   */
  isPreview?: boolean;
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
export function CapabilityMapPanel({ view, rows, isPreview = false }: Props) {
  const allL3Keys = React.useMemo(
    () => view.l2.flatMap((l2) => l2.l3.map((l3) => keyOf(l2.name, l3.name))),
    [view],
  );
  const totalL4 = React.useMemo(
    () => view.l2.reduce((s, l2) => s + l2.l3.reduce((t, l3) => t + l3.l4.length, 0), 0),
    [view],
  );

  // Pre-compute headcount per row id so per-L4 / per-L3 / per-L2 sums are O(rows + tree).
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

  const l4Headcount = React.useCallback(
    (l2Name: string, l3Name: string, l4: MapViewL4): number | null => {
      if (isPreview) return null;
      const r = findRowForMapL4(rows, l2Name, l3Name, l4);
      if (!r) return null;
      return hcByRowId.get(r.id) ?? 0;
    },
    [hcByRowId, rows, isPreview],
  );

  const l3Headcount = React.useCallback(
    (l2Name: string, l3: MapViewL3): number | null => {
      if (isPreview) return null;
      let any = false;
      let sum = 0;
      for (const l4 of l3.l4) {
        const v = l4Headcount(l2Name, l3.name, l4);
        if (v != null) {
          any = true;
          sum += v;
        }
      }
      return any ? sum : null;
    },
    [l4Headcount, isPreview],
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
      {/* Top line: total L4 count + master toggle. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-[11px] tabular-nums text-forge-hint">
          {totalL4} L4 activities
        </span>
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
                  l4HeadcountFn={(l3, l4) => l4Headcount(l2.name, l3.name, l4)}
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
      <span className="font-display text-sm font-semibold tracking-wide text-forge-ink">
        {name}
      </span>
      {hc != null ? (
        <span
          className="inline-flex items-baseline gap-1 rounded-md border border-accent-purple/40 bg-forge-surface/70 px-2 py-0.5"
          title="Total headcount across this tower (FTE + contractor, onshore + offshore)"
        >
          <span className="font-mono text-sm font-semibold tabular-nums text-forge-ink">
            {hc.toLocaleString()}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-accent-purple-dark">
            total h/c
          </span>
        </span>
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
        ariaLabel={`L2 ${name}`}
      />
      {l3Nodes.map((l3) => {
        const isActive = active.has(keyOf(name, l3.name));
        return (
          <Box
            key={l3.name}
            tier="l3"
            name={l3.name}
            hc={l3HeadcountFn(l3)}
            title={l3.name}
            isActive={isActive}
            onClick={() => onToggleL3(l3.name)}
            data-l3={l3.name}
            ariaLabel={`L3 ${l3.name}`}
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
      <span className="font-mono text-[10px] uppercase tracking-wider text-accent-purple">
        L4 details
      </span>
      <div className="h-px flex-1 bg-gradient-to-r from-accent-purple/40 via-forge-border to-transparent" />
    </div>
  );
}

function L4BandColumn({
  l2Name,
  l3Nodes,
  active,
  l4HeadcountFn,
}: {
  l2Name: string;
  l3Nodes: MapViewL3[];
  active: Set<string>;
  l4HeadcountFn: (l3: MapViewL3, l4: MapViewL4) => number | null;
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
                name="No L4 activities recorded."
                hc={null}
                title="No L4 activities recorded."
              />
            ) : (
              l3.l4.map((l4) => (
                <Box
                  key={l4.id}
                  tier="l4"
                  name={l4.name}
                  hc={l4HeadcountFn(l3, l4)}
                  title={l4.name}
                  data-l4={l4.id}
                  ariaLabel={`L4 ${l4.name}`}
                />
              ))
            )}
          </React.Fragment>
        ))
      )}
    </div>
  );
}

function GhostL3Caption({ name }: { name: string }) {
  return (
    <div
      className="flex h-7 w-full items-center rounded-md border border-dashed border-accent-purple/35 bg-accent-purple/5 px-2.5"
      title={name}
    >
      <span className="truncate text-[11px] font-medium leading-none text-accent-purple">
        {name}
      </span>
    </div>
  );
}

type BoxTier = "l2" | "l3" | "l4" | "l4-empty";

type BoxBaseProps = {
  tier: BoxTier;
  name: string;
  title: string;
  hc: number | null;
  isActive?: boolean;
  ariaLabel?: string;
  ariaPressed?: boolean;
  onClick?: () => void;
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
    ...rest
  } = props;

  const className = cn(
    "flex h-8 w-full items-center gap-2 rounded-md border px-2.5 text-left transition",
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
    "min-w-0 flex-1 truncate text-[12px] leading-none",
    tier === "l2" && "font-display font-semibold",
    tier === "l3" && "font-medium",
    tier === "l4" && "italic-none",
  );

  const hcClass = cn(
    "shrink-0 font-mono text-[10px] tabular-nums",
    tier === "l4" ? "text-forge-hint" : "text-forge-subtle",
  );

  const inner = (
    <>
      <span className={nameClass}>{name}</span>
      {hc != null ? <span className={hcClass}>{hc} h/c</span> : null}
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
