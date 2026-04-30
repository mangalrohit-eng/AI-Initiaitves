"use client";

import * as React from "react";
import { Hammer, Sparkles, TrendingUp } from "lucide-react";
import type {
  BuildScaleResult,
  BuildScaleRow,
} from "@/lib/initiatives/buildScaleModel";
import { HORIZON_MONTHS, RAMP_MONTHS } from "@/lib/initiatives/buildScaleModel";
import { TIER_HEX, type Tier } from "@/lib/priority";
import { formatUsdCompact } from "@/lib/format";
import { useRedactDollars } from "@/lib/clientMode";
import type { TowerId } from "@/data/assess/types";

/**
 * Build & Scale Gantt — 24-month visual over every non-placeholder initiative
 * in the Cross-Tower AI Plan. Fully deterministic; the LLM does not author
 * this surface.
 *
 * Each row shows three positioned segments:
 *   - Build  (35% opacity, dashed bottom border) — in-flight, no benefit yet
 *   - Ramp   (gradient 65%→100%, 6 fixed months)  — progressive benefit accrual
 *   - Scale  (solid, full opacity)               — in-month full attributed run-rate
 *
 * Out-of-horizon segments fade to transparent at the right edge with a
 * "completes Q? Y3" annotation. No clamping of `Process.timelineMonths`.
 *
 * Layout uses absolute positioning by percentage inside a min-width container
 * so the chart horizontally scrolls below ~1024px while the label column
 * stays sticky-left.
 */
export function BuildScaleGanttChart({
  buildScale,
  initialSort = "phase",
}: {
  buildScale: BuildScaleResult;
  initialSort?: SortKey;
}) {
  const redact = useRedactDollars();
  const [sortKey, setSortKey] = React.useState<SortKey>(initialSort);
  const [towerFilter, setTowerFilter] = React.useState<Set<string>>(new Set());
  const [phaseFilter, setPhaseFilter] = React.useState<Set<BuildScaleRow["phase"]>>(
    new Set(),
  );

  const towers = React.useMemo(() => uniqueTowers(buildScale.rows), [buildScale.rows]);
  const phasesPresent = React.useMemo(
    () => uniquePhases(buildScale.rows),
    [buildScale.rows],
  );

  const visibleRows = React.useMemo(() => {
    const filtered = buildScale.rows.filter((r) => {
      if (towerFilter.size > 0 && !towerFilter.has(r.towerId)) return false;
      if (phaseFilter.size > 0 && !phaseFilter.has(r.phase)) return false;
      return true;
    });
    return [...filtered].sort(buildSorter(sortKey));
  }, [buildScale.rows, sortKey, towerFilter, phaseFilter]);

  const filtersActive = towerFilter.size > 0 || phaseFilter.size > 0;
  const totalRows = buildScale.rows.length;

  return (
    <div className="space-y-3">
      <Toolbar
        sortKey={sortKey}
        setSortKey={setSortKey}
        towers={towers}
        towerFilter={towerFilter}
        setTowerFilter={setTowerFilter}
        phasesPresent={phasesPresent}
        phaseFilter={phaseFilter}
        setPhaseFilter={setPhaseFilter}
        visibleCount={visibleRows.length}
        totalCount={totalRows}
        onClear={() => {
          setTowerFilter(new Set());
          setPhaseFilter(new Set());
        }}
        filtersActive={filtersActive}
      />

      <div className="overflow-x-auto rounded-xl border border-forge-border bg-forge-surface">
        <div className="min-w-[1024px]">
          <GanttHeader />
          {visibleRows.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-forge-subtle">
              No initiatives match the active filters.
            </div>
          ) : (
            <ul className="divide-y divide-forge-border/60">
              {visibleRows.map((row, idx) => (
                <GanttRow key={`${row.id}-${idx}`} row={row} redact={redact} />
              ))}
            </ul>
          )}
        </div>
      </div>

      <GanttLegend />
    </div>
  );
}

// ===========================================================================
//   Toolbar
// ===========================================================================

type SortKey = "phase" | "ai-usd" | "start-month";

function Toolbar({
  sortKey,
  setSortKey,
  towers,
  towerFilter,
  setTowerFilter,
  phasesPresent,
  phaseFilter,
  setPhaseFilter,
  visibleCount,
  totalCount,
  onClear,
  filtersActive,
}: {
  sortKey: SortKey;
  setSortKey: (k: SortKey) => void;
  towers: { id: string; name: string }[];
  towerFilter: Set<string>;
  setTowerFilter: (s: Set<string>) => void;
  phasesPresent: BuildScaleRow["phase"][];
  phaseFilter: Set<BuildScaleRow["phase"]>;
  setPhaseFilter: (s: Set<BuildScaleRow["phase"]>) => void;
  visibleCount: number;
  totalCount: number;
  onClear: () => void;
  filtersActive: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-forge-border bg-forge-surface p-3">
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-forge-hint">Sort:</span>
          {(
            [
              { id: "phase", label: "Phase" },
              { id: "start-month", label: "Build start" },
              { id: "ai-usd", label: "$ at full scale" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setSortKey(opt.id)}
              className={`rounded-full border px-2.5 py-1 transition ${
                sortKey === opt.id
                  ? "border-accent-purple bg-accent-purple/10 text-accent-purple-dark"
                  : "border-forge-border bg-forge-well text-forge-body hover:text-forge-ink"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2 font-mono text-[11px] text-forge-subtle">
          <span>{visibleCount}</span>
          <span className="text-forge-hint">/</span>
          <span>{totalCount} initiatives</span>
          {filtersActive ? (
            <button
              type="button"
              onClick={onClear}
              className="ml-2 rounded-full border border-forge-border bg-forge-well px-2 py-0.5 text-[10px] text-forge-body hover:text-forge-ink"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      </div>

      {phasesPresent.length > 1 ? (
        <ChipFilterRow
          label="Phase"
          options={phasesPresent.map((p) => ({ id: p, label: p }))}
          selected={phaseFilter as Set<string>}
          onToggle={(id) => {
            const next = new Set(phaseFilter);
            if (next.has(id as BuildScaleRow["phase"])) {
              next.delete(id as BuildScaleRow["phase"]);
            } else {
              next.add(id as BuildScaleRow["phase"]);
            }
            setPhaseFilter(next);
          }}
        />
      ) : null}

      {towers.length > 1 ? (
        <ChipFilterRow
          label="Tower"
          options={towers.map((t) => ({ id: t.id, label: t.name }))}
          selected={towerFilter}
          onToggle={(id) => {
            const next = new Set(towerFilter);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            setTowerFilter(next);
          }}
        />
      ) : null}
    </div>
  );
}

function ChipFilterRow({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: { id: string; label: string }[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className="mr-1 text-forge-hint">{label}:</span>
      {options.map((opt) => {
        const active = selected.has(opt.id);
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onToggle(opt.id)}
            className={`rounded-full border px-2 py-0.5 transition ${
              active
                ? "border-accent-purple/60 bg-accent-purple/10 text-accent-purple-dark"
                : "border-forge-border bg-forge-well text-forge-body hover:text-forge-ink"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ===========================================================================
//   Gantt header (M1..M24 + quarter dividers)
// ===========================================================================

function GanttHeader() {
  return (
    <div className="sticky top-0 z-10 grid grid-cols-[256px_minmax(0,1fr)_96px] items-end gap-3 border-b border-forge-border bg-forge-surface/95 px-3 py-2 backdrop-blur">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-forge-subtle">
        Initiative
      </div>
      <div className="relative h-9">
        {/* Quarter band */}
        <div className="absolute inset-x-0 top-0 grid grid-cols-8 text-[10px] uppercase tracking-wider text-forge-hint">
          {["Q1 Y1", "Q2 Y1", "Q3 Y1", "Q4 Y1", "Q1 Y2", "Q2 Y2", "Q3 Y2", "Q4 Y2"].map(
            (q, i) => (
              <div
                key={q}
                className={`text-center ${
                  i === 0 ? "" : "border-l border-forge-border/60"
                }`}
              >
                {q}
              </div>
            ),
          )}
        </div>
        {/* Month index row */}
        <div className="absolute inset-x-0 bottom-0 flex">
          {Array.from({ length: HORIZON_MONTHS }, (_, i) => (
            <div
              key={i}
              className="flex-1 text-center font-mono text-[9px] text-forge-hint"
            >
              {i + 1}
            </div>
          ))}
        </div>
      </div>
      <div className="text-right text-[11px] font-semibold uppercase tracking-wider text-forge-subtle">
        $ full scale
      </div>
    </div>
  );
}

// ===========================================================================
//   Gantt row
// ===========================================================================

function GanttRow({ row, redact }: { row: BuildScaleRow; redact: boolean }) {
  const colors = phaseColors(row.tier);
  const tooltip = buildTooltip(row, redact);
  return (
    <li
      className="grid grid-cols-[256px_minmax(0,1fr)_96px] items-center gap-3 px-3 py-2 hover:bg-forge-well/30"
      title={tooltip}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <PhaseChip phase={row.phase} colors={colors} />
          <span className="truncate text-sm font-medium text-forge-ink" title={row.name}>
            {row.name}
          </span>
        </div>
        <div className="mt-0.5 truncate text-[11px] text-forge-hint" title={row.towerName}>
          {row.towerName}
        </div>
      </div>

      <BarTrack row={row} colors={colors} />

      <div className="text-right">
        <div className="font-mono text-xs tabular-nums text-forge-ink">
          {redact ? "—" : formatUsdCompact(row.attributedAiUsd)}
        </div>
        {row.rampExtendsPastHorizon ? (
          <div className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-forge-hint">
            ramps past M24
          </div>
        ) : null}
      </div>
    </li>
  );
}

// ===========================================================================
//   Bar track — three positioned segments per row
// ===========================================================================

function BarTrack({
  row,
  colors,
}: {
  row: BuildScaleRow;
  colors: PhaseColors;
}) {
  // Percent helpers — convert (1-indexed month) to a left edge percentage.
  // Month m's left edge = (m - 1) / HORIZON_MONTHS; right edge = m / HORIZON_MONTHS.
  const leftPctOfStart = (m: number) => clamp01((m - 1) / HORIZON_MONTHS) * 100;
  const widthPctMonths = (count: number) =>
    clamp01(count / HORIZON_MONTHS) * 100;

  const buildLeft = leftPctOfStart(row.phaseStartMonth);
  const buildEndVisualMonth = Math.min(row.endBuildMonth, HORIZON_MONTHS);
  const buildVisibleMonths = Math.max(
    0,
    buildEndVisualMonth - row.phaseStartMonth + 1,
  );
  const buildWidth = widthPctMonths(buildVisibleMonths);
  const buildClipped = row.endBuildMonth > HORIZON_MONTHS;

  // Ramp visibility — only render if it begins inside horizon.
  const rampStartsInHorizon = row.rampStartMonth <= HORIZON_MONTHS;
  const rampEndVisualMonth = Math.min(row.fullScaleMonth, HORIZON_MONTHS);
  const rampVisibleMonths = rampStartsInHorizon
    ? Math.max(0, rampEndVisualMonth - row.rampStartMonth + 1)
    : 0;
  const rampLeft = leftPctOfStart(row.rampStartMonth);
  const rampWidth = widthPctMonths(rampVisibleMonths);
  const rampClipped = row.fullScaleMonth > HORIZON_MONTHS;

  // At-scale — only render when fullScaleMonth < HORIZON_MONTHS.
  const atScaleStartsInHorizon = row.fullScaleMonth < HORIZON_MONTHS;
  const atScaleVisibleMonths = atScaleStartsInHorizon
    ? HORIZON_MONTHS - row.fullScaleMonth
    : 0;
  const atScaleLeft = leftPctOfStart(row.fullScaleMonth + 1);
  const atScaleWidth = widthPctMonths(atScaleVisibleMonths);

  return (
    <div className="relative h-7 rounded-md border border-forge-border/40 bg-forge-well/30">
      {/* Quarter gridlines */}
      {[6, 12, 18].map((m) => (
        <div
          key={m}
          aria-hidden
          className="absolute top-0 bottom-0 w-px bg-forge-border/50"
          style={{ left: `${(m / HORIZON_MONTHS) * 100}%` }}
        />
      ))}

      {/* Build segment */}
      {buildVisibleMonths > 0 ? (
        <div
          className="absolute top-0.5 bottom-0.5 rounded-sm border-b border-dashed"
          style={{
            left: `${buildLeft}%`,
            width: `${buildWidth}%`,
            background: colors.buildFill,
            borderBottomColor: colors.solid,
            ...(buildClipped
              ? {
                  WebkitMaskImage:
                    "linear-gradient(to right, black 80%, transparent 100%)",
                  maskImage:
                    "linear-gradient(to right, black 80%, transparent 100%)",
                }
              : {}),
          }}
        />
      ) : null}

      {/* Ramp segment */}
      {rampVisibleMonths > 0 ? (
        <div
          className="absolute top-0.5 bottom-0.5 rounded-sm"
          style={{
            left: `${rampLeft}%`,
            width: `${rampWidth}%`,
            background: `linear-gradient(to right, ${colors.rampStart}, ${colors.rampEnd})`,
            ...(rampClipped
              ? {
                  WebkitMaskImage:
                    "linear-gradient(to right, black 70%, transparent 100%)",
                  maskImage:
                    "linear-gradient(to right, black 70%, transparent 100%)",
                }
              : {}),
          }}
        />
      ) : null}

      {/* At-scale segment */}
      {atScaleVisibleMonths > 0 ? (
        <div
          className="absolute top-0.5 bottom-0.5 rounded-sm"
          style={{
            left: `${atScaleLeft}%`,
            width: `${atScaleWidth}%`,
            background: colors.solid,
          }}
        />
      ) : null}

      {/* Out-of-horizon annotation chip */}
      {(buildClipped || rampClipped) && row.fullScaleMonth > HORIZON_MONTHS ? (
        <div
          className="absolute right-0.5 top-1/2 -translate-y-1/2 rounded-sm border border-forge-border bg-forge-surface px-1 font-mono text-[9px] uppercase tracking-wider text-forge-subtle shadow-sm"
          aria-hidden
        >
          {fullScaleQuarterLabel(row.fullScaleMonth)}
        </div>
      ) : null}
    </div>
  );
}

// ===========================================================================
//   Phase visuals
// ===========================================================================

type PhaseColors = {
  solid: string;
  buildFill: string;
  rampStart: string;
  rampEnd: string;
  badge: string;
  text: string;
};

function phaseColors(tier: Tier | null): PhaseColors {
  if (tier === "P1") {
    return {
      solid: TIER_HEX.P1.solid,
      buildFill: "rgba(15, 52, 96, 0.18)",
      rampStart: "rgba(15, 52, 96, 0.45)",
      rampEnd: TIER_HEX.P1.solid,
      badge: "border-[#0F3460]/30 bg-[#0F3460]/10 text-[#0B274A]",
      text: TIER_HEX.P1.deep,
    };
  }
  if (tier === "P2") {
    return {
      solid: TIER_HEX.P2.solid,
      buildFill: "rgba(255, 179, 0, 0.22)",
      rampStart: "rgba(255, 179, 0, 0.55)",
      rampEnd: TIER_HEX.P2.solid,
      badge: "border-[#FFB300]/50 bg-[#FFB300]/15 text-amber-900",
      text: TIER_HEX.P2.deep,
    };
  }
  if (tier === "P3") {
    return {
      solid: TIER_HEX.P3.solid,
      buildFill: "rgba(0, 191, 165, 0.18)",
      rampStart: "rgba(0, 191, 165, 0.5)",
      rampEnd: TIER_HEX.P3.solid,
      badge: "border-[#00BFA5]/45 bg-[#00BFA5]/10 text-emerald-900",
      text: TIER_HEX.P3.deep,
    };
  }
  // Unphased — graphite. Visually muted; signals "no priority set yet".
  return {
    solid: "#5A6478",
    buildFill: "rgba(90, 100, 120, 0.18)",
    rampStart: "rgba(90, 100, 120, 0.45)",
    rampEnd: "#5A6478",
    badge: "border-forge-border bg-forge-well text-forge-body",
    text: "#3A4356",
  };
}

function PhaseChip({
  phase,
  colors,
}: {
  phase: BuildScaleRow["phase"];
  colors: PhaseColors;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-1.5 py-0 font-mono text-[10px] font-semibold ${colors.badge}`}
    >
      {phase === "Unphased" ? "—" : phase}
    </span>
  );
}

// ===========================================================================
//   Legend
// ===========================================================================

function GanttLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-forge-border bg-forge-well/30 px-3 py-2 text-[11px] text-forge-subtle">
      <div className="flex items-center gap-1.5">
        <Hammer className="h-3 w-3 text-forge-hint" aria-hidden />
        <span className="text-forge-body">Build</span>
        <SwatchBuild />
        <span>in flight, no benefit</span>
      </div>
      <div className="flex items-center gap-1.5">
        <TrendingUp className="h-3 w-3 text-forge-hint" aria-hidden />
        <span className="text-forge-body">Ramp</span>
        <SwatchRamp />
        <span>{RAMP_MONTHS}-month adoption curve</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Sparkles className="h-3 w-3 text-forge-hint" aria-hidden />
        <span className="text-forge-body">At scale</span>
        <SwatchScale />
        <span>full attributed run-rate</span>
      </div>
      <div className="ml-auto max-w-md text-right text-[10px] leading-snug text-forge-hint">
        Build duration uses <span className="text-forge-body">Process.timelineMonths</span>{" "}
        when present; otherwise phase defaults (P1 4mo · P2 6mo · P3 9mo). All
        initiatives in a phase build in parallel.
      </div>
    </div>
  );
}

function SwatchBuild() {
  return (
    <span
      aria-hidden
      className="inline-block h-2 w-6 rounded-sm border-b border-dashed border-accent-purple-dark/60"
      style={{ background: "rgba(161, 0, 255, 0.18)" }}
    />
  );
}
function SwatchRamp() {
  return (
    <span
      aria-hidden
      className="inline-block h-2 w-6 rounded-sm"
      style={{
        background: "linear-gradient(to right, rgba(161,0,255,0.4), #A100FF)",
      }}
    />
  );
}
function SwatchScale() {
  return (
    <span
      aria-hidden
      className="inline-block h-2 w-6 rounded-sm"
      style={{ background: "#A100FF" }}
    />
  );
}

// ===========================================================================
//   Helpers
// ===========================================================================

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function uniqueTowers(rows: readonly BuildScaleRow[]): { id: TowerId; name: string }[] {
  const map = new Map<TowerId, string>();
  for (const r of rows) if (!map.has(r.towerId)) map.set(r.towerId, r.towerName);
  return Array.from(map.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function uniquePhases(rows: readonly BuildScaleRow[]): BuildScaleRow["phase"][] {
  const set = new Set<BuildScaleRow["phase"]>();
  for (const r of rows) set.add(r.phase);
  const ordered: BuildScaleRow["phase"][] = ["P1", "P2", "P3", "Unphased"];
  return ordered.filter((p) => set.has(p));
}

function buildSorter(key: SortKey) {
  return (a: BuildScaleRow, b: BuildScaleRow): number => {
    if (key === "ai-usd") {
      const usd = b.attributedAiUsd - a.attributedAiUsd;
      if (Math.abs(usd) > 0.5) return usd;
    }
    if (key === "start-month") {
      const m = a.phaseStartMonth - b.phaseStartMonth;
      if (m !== 0) return m;
      const buildEnd = a.endBuildMonth - b.endBuildMonth;
      if (buildEnd !== 0) return buildEnd;
    }
    // Phase rank → start month → $ desc → tower → name (stable default).
    const phaseDelta = phaseRank(a.phase) - phaseRank(b.phase);
    if (phaseDelta !== 0) return phaseDelta;
    const startDelta = a.phaseStartMonth - b.phaseStartMonth;
    if (startDelta !== 0) return startDelta;
    const usdDelta = b.attributedAiUsd - a.attributedAiUsd;
    if (Math.abs(usdDelta) > 0.5) return usdDelta;
    const towerDelta = a.towerName.localeCompare(b.towerName);
    if (towerDelta !== 0) return towerDelta;
    return a.name.localeCompare(b.name);
  };
}

function phaseRank(p: BuildScaleRow["phase"]): number {
  if (p === "P1") return 0;
  if (p === "P2") return 1;
  if (p === "P3") return 2;
  return 3;
}

function buildTooltip(row: BuildScaleRow, redact: boolean): string {
  const phaseLabel = row.phase === "Unphased" ? "Unphased" : row.phase;
  const buildSrc =
    row.buildSource === "process-timeline"
      ? "from Process.timelineMonths"
      : "phase default";
  const fullScaleStr = row.rampExtendsPastHorizon
    ? `${fullScaleQuarterLabel(row.fullScaleMonth)} (M${row.fullScaleMonth})`
    : `M${row.fullScaleMonth}`;
  const usd = redact ? "—" : `${formatUsdCompact(row.attributedAiUsd)} attributed`;
  return [
    `${row.name} — ${row.towerName}`,
    `Phase: ${phaseLabel}`,
    `Build: M${row.phaseStartMonth}–M${row.endBuildMonth} (${row.buildMonths}mo, ${buildSrc})`,
    `Ramp:  M${row.rampStartMonth}–M${Math.min(row.fullScaleMonth, HORIZON_MONTHS)} (${RAMP_MONTHS}mo)`,
    `Full scale: ${fullScaleStr}`,
    `$ at full scale: ${usd}`,
  ].join("\n");
}

function fullScaleQuarterLabel(month: number): string {
  if (month <= HORIZON_MONTHS) return `M${month}`;
  // M25 = Q1 Y3, M28 = Q2 Y3, M31 = Q3 Y3, M34 = Q4 Y3 ...
  const monthsPastHorizon = month - HORIZON_MONTHS;
  const yearOffset = Math.floor((monthsPastHorizon - 1) / 12) + 1;
  const monthInYear = ((monthsPastHorizon - 1) % 12) + 1;
  const quarter = Math.ceil(monthInYear / 3);
  return `Q${quarter} Y${2 + yearOffset}`;
}
