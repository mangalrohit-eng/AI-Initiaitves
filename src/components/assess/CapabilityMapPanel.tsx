"use client";

import * as React from "react";
import { ChevronDown, Eye, Users } from "lucide-react";
import type { L3WorkforceRow } from "@/data/assess/types";
import type {
  CapabilityMapViewModel,
  MapViewL2,
  MapViewL3,
  MapViewL4,
  MapViewL5,
} from "@/lib/assess/capabilityMapTree";
import { cn } from "@/lib/utils";

type Props = {
  view: CapabilityMapViewModel;
  rows: L3WorkforceRow[];
  /**
   * When true the rendered tree is the canonical capability map (no rows
   * uploaded yet). Adds a Preview banner and suppresses every per-box
   * headcount cell — those become meaningful only once the user uploads a
   * footprint.
   */
  isPreview?: boolean;
};

/**
 * Layered capability tree under the 5-layer V5 capability map. The view
 * is rendered as a sequence of L2 sections, one per L2 Job Grouping in
 * the view (the canonical maps ship a single dummy L2 named after the
 * function; uploads can supply multiple). Inside every L2 section:
 *
 *   1. L1 Function banner (rendered once at the top, full width).
 *   2. L2 Job Grouping header bar (one per L2, full section width).
 *   3. Main band — equal-width L3 Job Family columns laid out
 *      horizontally. Each column has its L3 column header on top and an
 *      L4 Activity Group button stack underneath. L4 is the dial-bearing
 *      rung and the only clickable rung in the main band; every L4 is
 *      permanently visible.
 *   4. L5 band (renders only when at least one L4 in this L2 section is
 *      active). Same horizontal column structure as the main band: each
 *      L3 column reveals ghost L4 captions + L5 Activity chips for the
 *      active L4s under it. L5 chips sit in the same column as their
 *      parent L4 so the linkage stays obvious.
 *
 * The L5 reveal is per-L2 (not global). Activating an L4 in one L2
 * section opens the L5 band only inside that section. The "Show all L5
 * Activities" master toggle is global and flips every L4 id at once.
 *
 * Headcount roll-up: workforce rows are 1-per-L4 in V5. The L4 button
 * reads its row's headcount directly via the row id; the L3 column header
 * shows the sum of its L4s; the L2 section header shows the sum of its
 * L3s; the L1 banner shows the tower total. In preview mode (no rows
 * yet) every headcount renders as null.
 *
 * Tier colours ride a purple-intensity gradient — red/amber/teal/green
 * are reserved for priority and savings semantics elsewhere in the app,
 * so we don't repurpose them for hierarchy.
 *
 * Source of truth: rows always when present; the predefined map only
 * when `isPreview === true` (no rows yet).
 */
export function CapabilityMapPanel({
  view,
  rows,
  isPreview = false,
}: Props) {
  // Every L4 Activity Group id in the view — drives the master toggle and
  // the "all active" check.
  const allL4Ids = React.useMemo(
    () =>
      view.l2.flatMap((l2) =>
        l2.l3.flatMap((l3) => l3.l4.map((l4) => l4.id)),
      ),
    [view],
  );

  // Total L5 Activity leaves across the view — drives the master expand /
  // collapse toggle copy ("Show all L5 Activities") and the panel header.
  const totalL5 = React.useMemo(
    () =>
      view.l2.reduce(
        (s, l2) =>
          s +
          l2.l3.reduce(
            (t, l3) =>
              t +
              l3.l4.reduce((u, l4) => u + (l4.l5?.length ?? 0), 0),
            0,
          ),
        0,
      ),
    [view],
  );

  // Per-L4 Activity Group headcount comes straight from the workforce row
  // (one row per L4 in V5). L5 Activities are display-only metadata and
  // don't carry their own headcount.
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

  // L4 = source of truth (one workforce row per L4 Activity Group).
  // L3 / L2 / L1 numbers are rolled up by summation; null when no row in
  // the subtree carries headcount (preview mode or empty footprint).
  const l4Headcount = React.useCallback(
    (l4: MapViewL4): number | null => {
      if (isPreview) return null;
      const v = hcByRowId.get(l4.id);
      return v == null ? null : v;
    },
    [hcByRowId, isPreview],
  );

  const l3Headcount = React.useCallback(
    (l3: MapViewL3): number | null => {
      if (isPreview) return null;
      let any = false;
      let sum = 0;
      for (const l4 of l3.l4) {
        const v = l4Headcount(l4);
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
    (l2: MapViewL2): number | null => {
      if (isPreview) return null;
      let any = false;
      let sum = 0;
      for (const l3 of l2.l3) {
        const v = l3Headcount(l3);
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

  // Active state is keyed by L4 Activity Group id (the dial-bearing
  // rung). Clicking an L4 toggles its membership; the L5 band inside the
  // L4's L2 section reveals every L5 Activity under each active L4.
  const [active, setActive] = React.useState<Set<string>>(() => new Set());
  const allActive = active.size > 0 && active.size === allL4Ids.length;
  const anyActive = active.size > 0;

  const toggleL4 = React.useCallback((id: string) => {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const masterToggle = React.useCallback(() => {
    setActive((prev) => (prev.size > 0 ? new Set() : new Set(allL4Ids)));
  }, [allL4Ids]);

  return (
    <div className="space-y-3">
      {/* Top line: total L5 Activity count and master toggle. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] tabular-nums text-forge-hint">
            {totalL5} L5 Activities
          </span>
        </div>
        {allL4Ids.length > 0 ? (
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
            {anyActive ? "Hide all L5 Activities" : "Show all L5 Activities"}
          </button>
        ) : null}
      </div>

      {isPreview ? <PreviewBanner totalL5={totalL5} /> : null}

      {/* L1 banner — full width, deepest purple wash. */}
      <L1Banner name={view.l1Name} hc={towerHeadcount} />

      {/* One L2 section per L2 Job Grouping. Each section owns its own
          main band and L5 band so activating an L4 only opens leaves
          inside that section. */}
      <div className="space-y-4">
        {view.l2.map((l2) => (
          <L2Section
            key={l2.name}
            l2={l2}
            hc={l2Headcount(l2)}
            active={active}
            onToggleL4={toggleL4}
            l3HeadcountFn={l3Headcount}
            l4HeadcountFn={l4Headcount}
          />
        ))}
      </div>
    </div>
  );
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
  variant: "banner" | "section" | "chip";
}) {
  const banner = variant === "banner";
  const section = variant === "section";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 tabular-nums",
        banner &&
          "gap-1 rounded-md border border-accent-purple/40 bg-forge-surface/70 px-2 py-0.5",
        section &&
          "gap-1 rounded-md border border-accent-purple/35 bg-forge-surface/60 px-1.5 py-0.5",
      )}
      title={title}
    >
      <Users
        className={cn(
          "shrink-0 text-accent-purple-dark/75",
          banner ? "h-3 w-3" : section ? "h-2.5 w-2.5" : "h-2.5 w-2.5",
        )}
        aria-hidden
      />
      <span
        className={cn(
          "font-mono tabular-nums",
          banner
            ? "text-sm font-semibold text-forge-ink"
            : section
              ? "text-[11px] font-semibold text-forge-ink"
              : "text-[9px] font-medium text-forge-subtle",
        )}
      >
        {hc.toLocaleString()}
      </span>
    </span>
  );
}

function PreviewBanner({ totalL5 }: { totalL5: number }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-accent-purple/30 bg-accent-purple/5 px-3 py-2 text-xs text-forge-body">
      <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-purple" aria-hidden />
      <span>
        <span className="font-semibold text-forge-ink">Preview</span> of the
        predefined capability tree. Load the sample or upload your own
        capability map &amp; headcount to replace it — your map then drives the
        assessment and downstream impact.
        {totalL5 > 0
          ? " Feasibility (Ship-ready / Investigate) and AI eligibility tags on L5 Activity chips show after you load a footprint and run Refresh AI guidance (AI Initiatives)."
          : null}
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

function L2Section({
  l2,
  hc,
  active,
  onToggleL4,
  l3HeadcountFn,
  l4HeadcountFn,
}: {
  l2: MapViewL2;
  hc: number | null;
  active: Set<string>;
  onToggleL4: (id: string) => void;
  l3HeadcountFn: (l3: MapViewL3) => number | null;
  l4HeadcountFn: (l4: MapViewL4) => number | null;
}) {
  const anyL4ActiveInL2 = React.useMemo(
    () => l2.l3.some((l3) => l3.l4.some((l4) => active.has(l4.id))),
    [l2, active],
  );

  return (
    <div data-l2-section={l2.name} className="space-y-2">
      <L2HeaderBar name={l2.name} hc={hc} />

      {/* Main band: horizontal flex of equal-width L3 Job Family columns. */}
      <div className="overflow-x-auto pb-1">
        <div className="flex items-stretch gap-3">
          {l2.l3.map((l3) => (
            <L3Column
              key={l3.name}
              l3={l3}
              hc={l3HeadcountFn(l3)}
              active={active}
              onToggleL4={onToggleL4}
              l4HeadcountFn={l4HeadcountFn}
            />
          ))}
        </div>
      </div>

      {/* L5 band: only when at least one L4 inside this L2 is active.
          Same column structure as the main band — L5 chips sit in the
          same column as their parent L4. */}
      {anyL4ActiveInL2 ? (
        <>
          <BandDivider />
          <div className="overflow-x-auto">
            <div className="flex items-start gap-3">
              {l2.l3.map((l3) => (
                <L5BandColumnForL3
                  key={l3.name}
                  l3={l3}
                  active={active}
                />
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function L2HeaderBar({ name, hc }: { name: string; hc: number | null }) {
  return (
    <div
      data-l2
      className="flex items-center justify-between gap-3 rounded-md border border-accent-purple/40 bg-accent-purple/12 px-3 py-1.5"
    >
      <div className="flex min-w-0 items-center gap-2">
        <TierBadge tier="l2" />
        <span className="truncate font-display text-[13px] font-semibold tracking-wide text-forge-ink">
          {name}
        </span>
      </div>
      {hc != null ? (
        <HeadcountCluster
          hc={hc}
          variant="section"
          title="Total headcount across this Job Grouping (FTE + contractor, onshore + offshore)"
        />
      ) : null}
    </div>
  );
}

function L3Column({
  l3,
  hc,
  active,
  onToggleL4,
  l4HeadcountFn,
}: {
  l3: MapViewL3;
  hc: number | null;
  active: Set<string>;
  onToggleL4: (id: string) => void;
  l4HeadcountFn: (l4: MapViewL4) => number | null;
}) {
  return (
    <div
      data-l3-col={l3.name}
      className="flex min-w-[180px] flex-1 flex-col gap-1.5"
    >
      <Box
        tier="l3"
        name={l3.name}
        hc={hc}
        title={l3.name}
        data-l3={l3.name}
        ariaLabel={
          hc != null
            ? `L3 ${l3.name}, ${hc.toLocaleString()} headcount`
            : `L3 ${l3.name}`
        }
      />
      {l3.l4.map((l4) => {
        const isActive = active.has(l4.id);
        const l4Hc = l4HeadcountFn(l4);
        return (
          <Box
            key={l4.id}
            tier="l4"
            name={l4.name}
            hc={l4Hc}
            title={l4.name}
            isActive={isActive}
            onClick={() => onToggleL4(l4.id)}
            data-l4={l4.id}
            ariaLabel={
              l4Hc != null
                ? `L4 ${l4.name}, ${l4Hc.toLocaleString()} headcount${isActive ? ", expanded" : ""}`
                : `L4 ${l4.name}${isActive ? ", expanded" : ""}`
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
        <TierBadge tier="l5" />
        L5 Activities
      </span>
      <div className="h-px flex-1 bg-gradient-to-r from-accent-purple/40 via-forge-border to-transparent" />
    </div>
  );
}

function L5BandColumnForL3({
  l3,
  active,
}: {
  l3: MapViewL3;
  active: Set<string>;
}) {
  // Walk every L4 in this L3; render only those whose id is in the active
  // set. Each active L4 contributes a ghost caption + its L5 chips (or an
  // empty placeholder when no L5 Activities exist yet).
  const activeL4s = l3.l4.filter((l4) => active.has(l4.id));

  return (
    <div
      data-l5-col={l3.name}
      className="flex min-w-[180px] flex-1 flex-col gap-1.5"
    >
      {activeL4s.length === 0 ? (
        <div
          aria-hidden
          className="h-8 rounded-md border border-dashed border-forge-border/50 bg-forge-page/30"
        />
      ) : (
        activeL4s.map((l4) => (
          <React.Fragment key={l4.id}>
            <GhostL4Caption name={l4.name} />
            {l4.l5.length === 0 ? (
              <Box
                tier="l5-empty"
                name="No L5 Activities yet — Generate above."
                hc={null}
                title="No L5 Activities recorded for this L4 Activity Group. Use Generate L5 Activities above to create them."
              />
            ) : (
              l4.l5.map((l5) => <L5Chip key={l5.id} l5={l5} />)
            )}
          </React.Fragment>
        ))
      )}
    </div>
  );
}

function L5Chip({ l5 }: { l5: MapViewL5 }) {
  return (
    <Box
      tier="l5"
      name={l5.name}
      hc={null}
      title={l5.name}
      data-l5={l5.id}
      ariaLabel={`L5 ${l5.name}`}
    />
  );
}

function GhostL4Caption({ name }: { name: string }) {
  return (
    <div
      className="flex h-8 w-full items-center gap-1.5 rounded-md border border-dashed border-accent-purple/35 bg-accent-purple/5 px-2"
      title={name}
    >
      <TierBadge tier="l4" muted />
      <span className="truncate text-[11px] font-medium leading-none text-accent-purple">
        {name}
      </span>
    </div>
  );
}

type BoxTier = "l3" | "l4" | "l5" | "l5-empty";
type TierKey = "l1" | "l2" | "l3" | "l4" | "l5";

/**
 * Compact, color-graded tier label rendered inside every chip and banner.
 * Reinforces the hierarchy textually so readers don't have to decode the
 * purple-intensity gradient. Color saturation tracks the tier so the badge
 * itself participates in the gradient.
 */
function TierBadge({ tier, muted = false }: { tier: TierKey; muted?: boolean }) {
  const label = tier.toUpperCase();
  const base = "inline-flex shrink-0 items-center justify-center rounded font-mono font-semibold uppercase tabular-nums";
  const size = "px-1 py-px text-[9px] tracking-wider";
  const palette = (() => {
    if (muted) return "border border-accent-purple/40 bg-transparent text-accent-purple";
    switch (tier) {
      case "l1":
        return "bg-accent-purple text-white";
      case "l2":
        return "bg-accent-purple/45 text-accent-purple-dark";
      case "l3":
        return "bg-accent-purple/30 text-accent-purple-dark";
      case "l4":
        return "bg-accent-purple/15 text-accent-purple-dark";
      case "l5":
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
  /** Stable dataset markers for future selectors (crawler / tests). */
  "data-l3"?: string;
  "data-l4"?: string;
  "data-l5"?: string;
};

/**
 * Single equal-size box used for L3 column header / L4 button / L5 chip.
 * Same height (~32 px) and column width across all tiers; styling differs
 * by tier on the purple-intensity gradient. L4 is the only clickable
 * rung in the main band (the dial-bearing Activity Group); the L3
 * column header is display-only; L5 chips in the bottom band are
 * display-only leaves. Names render on a single line with a `title`
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
    "flex h-8 w-full items-center gap-1.5 rounded-md border px-2 text-left transition",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-purple/40",
    tier === "l3" &&
      "border-accent-purple/35 bg-accent-purple/12 text-forge-ink",
    tier === "l4" && !isActive &&
      "cursor-pointer border-accent-purple/25 bg-accent-purple/5 text-forge-body hover:border-accent-purple/45 hover:text-forge-ink",
    tier === "l4" && isActive &&
      "cursor-pointer border-accent-purple/60 bg-accent-purple/15 text-forge-ink ring-1 ring-accent-purple/30",
    tier === "l5" &&
      "border-forge-border border-l-[3px] border-l-accent-purple/55 bg-forge-well/40 text-forge-subtle",
    tier === "l5-empty" &&
      "border-dashed border-forge-border bg-forge-page/40 text-forge-hint",
  );

  const nameClass = cn(
    "min-w-0 flex-1 truncate leading-none",
    tier === "l3" && "font-display text-[12px] font-semibold",
    tier === "l4" && "text-[11px] font-medium",
    tier === "l5" && "text-[10px] italic-none",
    tier === "l5-empty" && "text-[11px]",
  );

  // L5-empty placeholder doesn't show a badge — keeps the dashed empty state quiet.
  const badgeTier: TierKey | null =
    tier === "l3" ? "l3"
      : tier === "l4" ? "l4"
        : tier === "l5" ? "l5"
          : null;

  const inner = (
    <>
      {badgeTier ? <TierBadge tier={badgeTier} /> : null}
      <span className={nameClass}>{name}</span>
      {hc != null ? (
        <HeadcountCluster hc={hc} variant="chip" title={CHIP_HC_TITLE} />
      ) : null}
    </>
  );

  if (tier === "l4") {
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
