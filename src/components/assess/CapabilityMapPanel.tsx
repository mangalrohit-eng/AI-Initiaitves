"use client";

import * as React from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Maximize2,
  MoveHorizontal,
  Users,
} from "lucide-react";
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
 * Layered capability tree under the 5-layer V5 capability map. The whole
 * view renders as a single horizontal tier so multiple L2 Job Groupings
 * sit side-by-side on one row instead of stacking vertically:
 *
 *   1. L1 Function banner (rendered once at the top, full width).
 *   2. Main band — a single horizontal flex of L2 groups. Each L2 group
 *      owns its L2 header bar at the top (width naturally scales with
 *      the L3 count beneath it) and a flex row of fixed-width L3 Job
 *      Family columns directly underneath. L3 columns stay uniform
 *      across the entire tier so the L2 header widths read as
 *      proportional to scope.
 *   3. Each L3 column has its L3 header on top and an L4 Activity Group
 *      button stack underneath. L4 is the dial-bearing rung and the only
 *      clickable rung in the main band; every L4 is permanently visible.
 *   4. L5 band (per L2 group). Renders inside an L2 group only when at
 *      least one L4 inside that group is active. Same column structure
 *      as the main band so L5 chips line up under their parent L4.
 *
 * The L5 reveal stays per-L2 (not global): activating an L4 in one L2
 * group opens the L5 band only inside that group, keeping the linkage
 * to the parent L4 column obvious. The "Show all L5 Activities" master
 * toggle is global and flips every L4 id at once.
 *
 * Headcount roll-up: workforce rows are 1-per-L4 in V5. The L4 button
 * reads its row's headcount directly via the row id; the L3 column header
 * shows the sum of its L4s; the L2 group header shows the sum of its
 * L3s; the L1 banner shows the tower total. In preview mode (no rows
 * yet) every headcount renders as null.
 *
 * Tier colours ride a purple-intensity gradient — red/amber/teal/green
 * are reserved for priority and savings semantics elsewhere in the app,
 * so we don't repurpose them for hierarchy.
 *
 * Layout modes (toggle in the panel header):
 *
 *   - "scroll" (default) — L3 columns are fixed at 200 px wide; rows that
 *     don't fit the viewport scroll horizontally with chevron + edge-fade
 *     indicators (see `ScrollableTier`).
 *   - "fit" — L3 columns share the visible width via `flex-1 basis-0`,
 *     so the entire map fits on one screen. To compensate for narrower
 *     columns, every box at a given tier (L3 / L4 / L5) gets a uniform
 *     fixed height (taller than scroll mode), label fonts drop, and
 *     labels wrap inside the fixed box with `line-clamp` — overflow
 *     ellipses, full label remains in the `title` tooltip. Every tier
 *     badge (L1-L5) and every FTE / headcount display is suppressed
 *     for a clean executive grid; the L1 / L2 banners and each box
 *     carry a `title` tooltip with the count so hover surfaces it.
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

  // Layout mode — `false` (default) is the fixed-200px-column scroll
  // mode; `true` is fit-to-one-page mode where L3 columns share the
  // viewport width and every per-tier box gets a uniform fixed height.
  const [fitMode, setFitMode] = React.useState(false);
  const toggleFitMode = React.useCallback(() => {
    setFitMode((prev) => !prev);
  }, []);

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
      {/* Top line: total L5 Activity count, fit-mode toggle, master L5 toggle. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] tabular-nums text-forge-hint">
            {totalL5} L5 Activities
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {view.l2.length > 0 ? (
            <button
              type="button"
              onClick={toggleFitMode}
              aria-pressed={fitMode}
              title={
                fitMode
                  ? "Restore 200px columns and horizontal scrolling."
                  : "Shrink columns to fit the entire map on one screen."
              }
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium transition",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-purple/40",
                fitMode
                  ? "border-accent-purple/60 bg-accent-purple/15 text-forge-ink"
                  : "border-forge-border bg-forge-surface text-forge-body hover:border-accent-purple/40 hover:text-forge-ink",
              )}
            >
              {fitMode ? (
                <MoveHorizontal className="h-3 w-3 text-accent-purple" aria-hidden />
              ) : (
                <Maximize2 className="h-3 w-3" aria-hidden />
              )}
              {fitMode ? "Allow horizontal scroll" : "Fit to one page"}
            </button>
          ) : null}
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
      </div>

      {/* Fit-mode caption — explains that tier badges (L1-L5) and every
          headcount display are suppressed (no room in a narrow box) so
          users don't think the data disappeared. Every banner / box
          carries a `title` tooltip with the count so hover reveals it. */}
      {fitMode && view.l2.length > 0 ? (
        <p className="text-[11px] leading-snug text-forge-hint">
          Tier badges and headcount hidden in fit mode — hover any box for the value.
        </p>
      ) : null}

      {isPreview ? <PreviewBanner totalL5={totalL5} /> : null}

      {/* L1 banner — full width, deepest purple wash. */}
      <L1Banner name={view.l1Name} hc={towerHeadcount} fitMode={fitMode} />

      {/* Single horizontal tier — all L2 groups sit on one row. Each
          group owns its L2 header bar and the L3 columns directly below
          it. In scroll mode L3 columns are fixed-width and the tier
          scrolls horizontally with chevron + edge-fade indicators when
          it overflows. In fit mode columns share the viewport width via
          `flex-1 basis-0`, the scroll wrapper turns inert, and box
          heights grow uniformly to absorb wrapped labels. */}
      <ScrollableTier fitMode={fitMode}>
        <div
          className={cn(
            "flex items-stretch",
            fitMode ? "gap-2" : "gap-5",
          )}
        >
          {view.l2.map((l2) => (
            <L2Group
              key={l2.name}
              l2={l2}
              hc={l2Headcount(l2)}
              active={active}
              onToggleL4={toggleL4}
              l3HeadcountFn={l3Headcount}
              l4HeadcountFn={l4Headcount}
              fitMode={fitMode}
            />
          ))}
        </div>
      </ScrollableTier>
    </div>
  );
}

/**
 * Horizontal scroll wrapper that signals overflow to the user. When the
 * tier's content exceeds the viewport width, we render:
 *
 *   - Edge fade gradients on the cut-off side so the cliff edge is
 *     visible without reading as an empty column.
 *   - Floating chevron buttons that scroll the tier ~80% of the
 *     viewport width on click. Buttons only appear (visually + for
 *     pointer / focus) when scroll is possible in that direction.
 *
 * The component listens to scroll + resize so the indicators stay
 * accurate after L4 toggles (which may add the L5 band and shift
 * heights / widths). When content fits, both indicators stay hidden
 * and the wrapper is visually inert.
 *
 * In fit mode the panel guarantees the content fits the viewport (L3
 * columns share width via `flex-1 basis-0`), so this wrapper renders a
 * plain `div` with no `overflow-x-auto` and no indicators — sub-pixel
 * rounding can otherwise trigger a phantom scrollbar.
 */
function ScrollableTier({
  children,
  fitMode,
}: {
  children: React.ReactNode;
  fitMode: boolean;
}) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [canLeft, setCanLeft] = React.useState(false);
  const [canRight, setCanRight] = React.useState(false);

  const update = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanLeft(scrollLeft > 1);
    setCanRight(scrollLeft + clientWidth < scrollWidth - 1);
  }, []);

  React.useEffect(() => {
    if (fitMode) {
      // Indicators are dormant in fit mode; nothing to wire up.
      setCanLeft(false);
      setCanRight(false);
      return;
    }
    const el = ref.current;
    if (!el) return;
    update();
    const onScroll = () => update();
    el.addEventListener("scroll", onScroll, { passive: true });
    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => update())
        : null;
    ro?.observe(el);
    if (el.firstElementChild) ro?.observe(el.firstElementChild);
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [update, fitMode]);

  const scrollByDir = React.useCallback((dir: -1 | 1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  }, []);

  if (fitMode) {
    return <div className="pb-1">{children}</div>;
  }

  return (
    <div className="relative">
      <div ref={ref} className="overflow-x-auto pb-1 scroll-smooth">
        {children}
      </div>

      {/* Left edge fade — fades the page background over content as it
          scrolls past the viewport edge. Pointer-events disabled so it
          never blocks clicks on the underlying L4 buttons. */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 w-10 rounded-l-md bg-gradient-to-r from-forge-page via-forge-page/70 to-transparent transition-opacity",
          canLeft ? "opacity-100" : "opacity-0",
        )}
      />
      <button
        type="button"
        onClick={() => scrollByDir(-1)}
        aria-label="Scroll capability map left"
        tabIndex={canLeft ? 0 : -1}
        className={cn(
          "absolute left-1 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-accent-purple/35 bg-forge-surface text-accent-purple-dark shadow-card transition",
          "hover:border-accent-purple/70 hover:text-accent-purple",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-purple/50",
          canLeft ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
      </button>

      {/* Right edge fade + chevron — mirror of the left side. */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 right-0 w-10 rounded-r-md bg-gradient-to-l from-forge-page via-forge-page/70 to-transparent transition-opacity",
          canRight ? "opacity-100" : "opacity-0",
        )}
      />
      <button
        type="button"
        onClick={() => scrollByDir(1)}
        aria-label="Scroll capability map right"
        tabIndex={canRight ? 0 : -1}
        className={cn(
          "absolute right-1 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-accent-purple/35 bg-forge-surface text-accent-purple-dark shadow-card transition",
          "hover:border-accent-purple/70 hover:text-accent-purple",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-purple/50",
          canRight ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <ChevronRight className="h-4 w-4" aria-hidden />
      </button>
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
          ? " Feasibility (Proven pattern / New build) and AI eligibility tags on L5 Activity chips show after you load a footprint and run Refresh AI guidance (AI Initiatives)."
          : null}
      </span>
    </div>
  );
}

function L1Banner({
  name,
  hc,
  fitMode,
}: {
  name: string;
  hc: number | null;
  fitMode: boolean;
}) {
  // In fit mode the L1 badge and inline FTE cluster are hidden, so the
  // cluster's own `title` hover goes with them. Move the headcount info
  // onto the banner root so users can still hover the tower name to see
  // the total — the panel caption explicitly tells them they can.
  const hoverTitle =
    fitMode && hc != null
      ? `${name} — total headcount across this tower: ${hc.toLocaleString()} (FTE + contractor, onshore + offshore)`
      : undefined;
  return (
    <div
      data-l1
      title={hoverTitle}
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border border-accent-purple/50 bg-accent-purple/20",
        fitMode ? "h-9 px-2 py-0" : "px-4 py-2",
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        {fitMode ? null : <TierBadge tier="l1" />}
        <span
          className={cn(
            "truncate font-display font-semibold tracking-wide text-forge-ink",
            fitMode ? "text-[11px]" : "text-sm",
          )}
        >
          {name}
        </span>
      </div>
      {!fitMode && hc != null ? (
        <HeadcountCluster
          hc={hc}
          variant="banner"
          title="Total headcount across this tower (FTE + contractor, onshore + offshore)"
        />
      ) : null}
    </div>
  );
}

function L2Group({
  l2,
  hc,
  active,
  onToggleL4,
  l3HeadcountFn,
  l4HeadcountFn,
  fitMode,
}: {
  l2: MapViewL2;
  hc: number | null;
  active: Set<string>;
  onToggleL4: (id: string) => void;
  l3HeadcountFn: (l3: MapViewL3) => number | null;
  l4HeadcountFn: (l4: MapViewL4) => number | null;
  fitMode: boolean;
}) {
  const anyL4ActiveInL2 = React.useMemo(
    () => l2.l3.some((l3) => l3.l4.some((l4) => active.has(l4.id))),
    [l2, active],
  );

  return (
    <div
      data-l2-group={l2.name}
      className={cn(
        "flex flex-col",
        fitMode ? "gap-1" : "gap-2",
        // Scroll mode: each L2 group is sized by its content (L3 row
        // natural width). Fit mode: each L2 group claims a share of the
        // tier's total width proportional to its L3 count via flex-grow,
        // so its child L3 columns inherit equal width across every L2.
        fitMode ? "min-w-0 flex-grow basis-0" : "shrink-0",
      )}
      style={fitMode ? { flexGrow: l2.l3.length } : undefined}
    >
      <L2HeaderBar name={l2.name} hc={hc} fitMode={fitMode} />

      {/* L3 row: columns laid out horizontally. In scroll mode columns
          are fixed 200px wide; in fit mode they share width via
          `flex-1 basis-0`. The L2 header above naturally spans the
          full width of this row in both modes. */}
      <div
        className={cn(
          "flex items-stretch",
          fitMode ? "gap-1" : "gap-3",
        )}
      >
        {l2.l3.map((l3) => (
          <L3Column
            key={l3.name}
            l3={l3}
            hc={l3HeadcountFn(l3)}
            active={active}
            onToggleL4={onToggleL4}
            l4HeadcountFn={l4HeadcountFn}
            fitMode={fitMode}
          />
        ))}
      </div>

      {/* L5 band: only when at least one L4 inside this L2 group is
          active. Same column structure as the main band so chips line
          up under their parent L4 column. */}
      {anyL4ActiveInL2 ? (
        <>
          <BandDivider />
          <div
            className={cn(
              "flex items-start",
              fitMode ? "gap-1" : "gap-3",
            )}
          >
            {l2.l3.map((l3) => (
              <L5BandColumnForL3
                key={l3.name}
                l3={l3}
                active={active}
                fitMode={fitMode}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function L2HeaderBar({
  name,
  hc,
  fitMode,
}: {
  name: string;
  hc: number | null;
  fitMode: boolean;
}) {
  // Mirror L1Banner: in fit mode the L2 badge + inline FTE cluster are
  // hidden, so we promote the headcount info onto the bar's parent
  // title so hover still surfaces the value.
  const hoverTitle =
    fitMode && hc != null
      ? `${name} — total headcount across this Job Grouping: ${hc.toLocaleString()} (FTE + contractor, onshore + offshore)`
      : undefined;
  return (
    <div
      data-l2
      title={hoverTitle}
      className={cn(
        "flex items-center justify-between gap-3 rounded-md border border-accent-purple/40 bg-accent-purple/12",
        fitMode ? "h-8 px-1.5 py-0" : "h-9 px-3 py-0",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {fitMode ? null : <TierBadge tier="l2" />}
        <span
          className={cn(
            "min-w-0 flex-1 font-display font-semibold tracking-wide text-forge-ink",
            fitMode
              ? "overflow-hidden text-[10px] leading-tight line-clamp-2 break-words"
              : "truncate text-[13px]",
          )}
        >
          {name}
        </span>
      </div>
      {!fitMode && hc != null ? (
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
  fitMode,
}: {
  l3: MapViewL3;
  hc: number | null;
  active: Set<string>;
  onToggleL4: (id: string) => void;
  l4HeadcountFn: (l4: MapViewL4) => number | null;
  fitMode: boolean;
}) {
  return (
    <div
      data-l3-col={l3.name}
      className={cn(
        "flex flex-col",
        fitMode ? "gap-0.5" : "gap-1.5",
        fitMode
          ? "min-w-0 flex-1 basis-0"
          : "w-[200px] shrink-0",
      )}
    >
      <Box
        tier="l3"
        name={l3.name}
        hc={hc}
        title={
          hc != null
            ? `${l3.name} — ${hc.toLocaleString()} headcount`
            : l3.name
        }
        data-l3={l3.name}
        fitMode={fitMode}
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
            title={
              l4Hc != null
                ? `${l4.name} — ${l4Hc.toLocaleString()} headcount`
                : l4.name
            }
            isActive={isActive}
            onClick={() => onToggleL4(l4.id)}
            data-l4={l4.id}
            fitMode={fitMode}
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
  fitMode,
}: {
  l3: MapViewL3;
  active: Set<string>;
  fitMode: boolean;
}) {
  // Walk every L4 in this L3; render only those whose id is in the active
  // set. Each active L4 contributes a ghost caption + its L5 chips (or an
  // empty placeholder when no L5 Activities exist yet).
  const activeL4s = l3.l4.filter((l4) => active.has(l4.id));

  return (
    <div
      data-l5-col={l3.name}
      className={cn(
        "flex flex-col",
        fitMode ? "gap-0.5" : "gap-1.5",
        fitMode
          ? "min-w-0 flex-1 basis-0"
          : "w-[200px] shrink-0",
      )}
    >
      {activeL4s.length === 0 ? (
        <div
          aria-hidden
          className="h-8 rounded-md border border-dashed border-forge-border/50 bg-forge-page/30"
        />
      ) : (
        activeL4s.map((l4) => (
          <React.Fragment key={l4.id}>
            <GhostL4Caption name={l4.name} fitMode={fitMode} />
            {l4.l5.length === 0 ? (
              <Box
                tier="l5-empty"
                name="No L5 Activities yet — Generate above."
                hc={null}
                title="No L5 Activities recorded for this L4 Activity Group. Use Generate L5 Activities above to create them."
                fitMode={fitMode}
              />
            ) : (
              l4.l5.map((l5) => <L5Chip key={l5.id} l5={l5} fitMode={fitMode} />)
            )}
          </React.Fragment>
        ))
      )}
    </div>
  );
}

function L5Chip({ l5, fitMode }: { l5: MapViewL5; fitMode: boolean }) {
  return (
    <Box
      tier="l5"
      name={l5.name}
      hc={null}
      title={l5.name}
      data-l5={l5.id}
      fitMode={fitMode}
      ariaLabel={`L5 ${l5.name}`}
    />
  );
}

function GhostL4Caption({
  name,
  fitMode,
}: {
  name: string;
  fitMode: boolean;
}) {
  return (
    <div
      className={cn(
        "flex w-full items-center rounded-md border border-dashed border-accent-purple/35 bg-accent-purple/5",
        fitMode ? "h-8 gap-0 px-1" : "h-8 gap-1.5 px-2",
      )}
      title={name}
    >
      {fitMode ? null : <TierBadge tier="l4" muted />}
      <span
        className={cn(
          "min-w-0 flex-1 font-medium text-accent-purple",
          fitMode
            ? "overflow-hidden text-[8px] leading-tight line-clamp-2 break-words"
            : "truncate text-[11px] leading-none",
        )}
      >
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
  fitMode: boolean;
  /** Stable dataset markers for future selectors (crawler / tests). */
  "data-l3"?: string;
  "data-l4"?: string;
  "data-l5"?: string;
};

/**
 * Single equal-size box used for L3 column header / L4 button / L5 chip.
 * Every box at a given tier shares the same fixed width (= column width)
 * AND the same fixed height per mode, so the map reads as a uniform
 * grid even when labels differ in length. Styling differs by tier on
 * the purple-intensity gradient. L4 is the only clickable rung in the
 * main band (the dial-bearing Activity Group); the L3 column header is
 * display-only; L5 chips in the bottom band are display-only leaves.
 *
 * Scroll mode: 32 px tall, single line, `truncate`.
 * Fit mode: taller boxes (40 / 56 / 48 px for L3 / L4 / L5), label
 * wraps with `line-clamp` inside the fixed box; overflow text ellipses
 * and the full label remains accessible via the `title` tooltip. Inline
 * per-row headcount chips are suppressed in fit mode to free up the
 * narrow box's text area; per-L4 numbers stay accessible via the
 * `title` tooltip ("X. {name} — Y headcount") on the L4 button.
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
    fitMode,
    ...rest
  } = props;

  // Fixed heights per tier per mode. `min-h` is intentionally NOT used —
  // boxes must be the SAME height across the entire view.
  const heightClass =
    tier === "l3"
      ? fitMode ? "h-10" : "h-8"
      : tier === "l4"
        ? fitMode ? "h-14" : "h-8"
        : /* l5 / l5-empty */ fitMode ? "h-12" : "h-8";

  // Padding + internal gap shrink hard in fit mode — every saved pixel
  // is a character that fits on a line in narrow columns. Badge is
  // hidden so the inner flex has only the name span; gap-0 is fine.
  const className = cn(
    "flex w-full items-center rounded-md border text-left transition",
    heightClass,
    fitMode ? "gap-0 px-1" : "gap-1.5 px-2",
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

  // Font sizes drop further in fit mode and `line-clamp` allows
  // additional lines to absorb wrapped labels (text-[8px] with
  // leading-tight ~10px line-height fits 4 lines comfortably in h-14).
  // Scroll mode keeps the original single-line truncate.
  const nameClass = cn(
    "min-w-0 flex-1",
    fitMode
      ? "overflow-hidden break-words leading-tight"
      : "truncate leading-none",
    tier === "l3" &&
      (fitMode
        ? "font-display text-[9px] font-semibold line-clamp-2"
        : "font-display text-[12px] font-semibold"),
    tier === "l4" &&
      (fitMode
        ? "text-[8px] font-medium line-clamp-4"
        : "text-[11px] font-medium"),
    tier === "l5" &&
      (fitMode
        ? "text-[8px] line-clamp-3"
        : "text-[10px] italic-none"),
    tier === "l5-empty" &&
      (fitMode
        ? "text-[8px] line-clamp-2"
        : "text-[11px]"),
  );

  // Tier badges are hidden in fit mode (less visual clutter at narrow
  // box widths). L5-empty never carries a badge anyway. In scroll mode
  // the badge keeps the tier signal that the gradient alone doesn't.
  const badgeTier: TierKey | null = fitMode
    ? null
    : tier === "l3" ? "l3"
      : tier === "l4" ? "l4"
        : tier === "l5" ? "l5"
          : null;

  // Per-row inline headcount chip is suppressed in fit mode — the chip
  // would steal the box's text area at narrow column widths and break
  // the line-clamp budget. The L1 / L2 banner totals stay visible, and
  // the per-L4 number remains in the `title` tooltip on hover.
  const showInlineHc = hc != null && !fitMode;

  const inner = (
    <>
      {badgeTier ? <TierBadge tier={badgeTier} /> : null}
      <span className={nameClass}>{name}</span>
      {showInlineHc ? (
        <HeadcountCluster hc={hc as number} variant="chip" title={CHIP_HC_TITLE} />
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
