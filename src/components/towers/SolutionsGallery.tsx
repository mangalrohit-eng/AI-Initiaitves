"use client";

import * as React from "react";
import {
  ArrowDownAZ,
  Building2,
  Compass,
  Layers,
  Rocket,
  Search,
  SlidersHorizontal,
  Target,
  X,
} from "lucide-react";
import type { Tower } from "@/data/types";
import { useInitiativeReviewsV6 } from "@/lib/initiatives/useInitiativeReviewsV6";
import type {
  V6InitiativeCard,
  V6L3Row,
} from "@/lib/initiatives/selectV6";
import { SolutionCardV2 } from "@/components/towers/SolutionCardV2";
import { MultiSelectFilter } from "@/components/towers/MultiSelectFilter";
import {
  assignQuadrants,
  QUADRANT_HINTS,
  QUADRANT_LABELS,
  type Quadrant,
} from "@/lib/initiatives/quadrant";
import { cn } from "@/lib/utils";

type SortKey = "value-desc" | "feasibility-then-value" | "name";
type FeasibilityFilter = "all" | "high" | "low";

type Row = {
  init: V6InitiativeCard;
  /**
   * The full V6 L3 row this initiative belongs to. Carried on each row
   * so the per-card validate / reject snapshot can capture L2 / L3 names
   * + the row id without `<SolutionCardV2>` having to re-walk state.
   */
  row: V6L3Row;
  l3Id: string;
  l3Name: string;
  l2Name: string;
  l3AiUsd: number;
};

type GalleryState = {
  sort: SortKey;
  feasibility: FeasibilityFilter;
  jobFamilies: string[];
  vendors: string[];
  quadrants: Quadrant[];
  query: string;
};

const STATE_VERSION = 2;

function storageKey(towerId: string): string {
  return `solutions-gallery-state-v${STATE_VERSION}-${towerId}`;
}

function defaultState(): GalleryState {
  return {
    sort: "feasibility-then-value",
    feasibility: "all",
    jobFamilies: [],
    vendors: [],
    quadrants: [],
    query: "",
  };
}

/**
 * Split a `primaryVendor` string into the individual named vendors.
 * The curator LLM is told to use ` + ` as the separator between
 * stack components ("BlackLine + HighRadius"); we also tolerate `,`
 * and `&` separators in case older cached entries used them.
 *
 * Returns an empty array for `undefined` / "TBD …" placeholders so
 * those don't pollute the vendor filter list.
 */
function splitVendors(s: string | undefined): string[] {
  if (!s) return [];
  const cleaned = s.trim();
  if (!cleaned) return [];
  if (/^TBD/i.test(cleaned)) return [];
  return cleaned
    .split(/\s*[+,&]\s*/g)
    .map((v) => v.trim())
    .filter((v) => v.length > 0 && !/^TBD/i.test(v));
}

const QUADRANT_ORDER: Quadrant[] = [
  "quick-win",
  "strategic-bet",
  "fill-in",
  "deprioritize",
];

const FEASIBILITY_OPTIONS: ReadonlyArray<{
  id: FeasibilityFilter;
  label: string;
  Icon?: React.ComponentType<{ className?: string }>;
}> = [
  { id: "all", label: "All" },
  { id: "high", label: "Proven pattern", Icon: Rocket },
  { id: "low", label: "New build", Icon: Compass },
];

/**
 * Single filterable card grid of every AI Solution in the tower.
 *
 * Filters (popovers + segmented controls):
 *   - Feasibility (binary toggle: All / Proven pattern / New build).
 *   - Job Family (multi-select popover, one option per L3 row name).
 *   - 2x2 Quadrant (multi-select popover; Quick Win / Strategic Bet /
 *     Fill-in / Deprioritize). Quadrants are derived from
 *     `assignQuadrants()` so the values match what the cross-tower
 *     2x2 would assign at program scope.
 *   - Vendor (multi-select popover, INDIVIDUAL vendors split out of
 *     compound stacks like "BlackLine + HighRadius").
 *   - Search over solutionName + tagline + parent L3 name + L2.
 *
 * Sort: "Proven pattern first → value desc", "Value desc",
 * or "Name (A→Z)". Filter / sort state persists per tower in
 * `localStorage`.
 *
 * Renders one responsive grid (no group-by toggle, no roster tabs)
 * — the "browse every solution" view is the only view.
 */
export function SolutionsGallery({ tower }: { tower: Tower }) {
  const { result, reviews, actions } = useInitiativeReviewsV6(tower);
  const [state, setState] = React.useState<GalleryState>(() => defaultState());
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    setHydrated(true);
    try {
      const raw = window.localStorage.getItem(storageKey(tower.id));
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<GalleryState>;
        setState((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tower.id]);

  React.useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(
        storageKey(tower.id),
        JSON.stringify(state),
      );
    } catch {
      // ignore
    }
  }, [state, hydrated, tower.id]);

  const allRows: Row[] = React.useMemo(() => {
    const out: Row[] = [];
    for (const r of result.l3Rows) {
      for (const init of r.initiatives) {
        out.push({
          init,
          row: r,
          l3Id: r.id,
          l3Name: r.l3,
          l2Name: r.l2,
          l3AiUsd: r.aiUsd,
        });
      }
    }
    return out;
  }, [result]);

  const allJobFamilies = React.useMemo(() => {
    const set = new Set<string>();
    for (const r of allRows) set.add(r.l3Name);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allRows]);

  const allVendors = React.useMemo(() => {
    const set = new Set<string>();
    for (const r of allRows) {
      for (const v of splitVendors(r.init.primaryVendor)) set.add(v);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allRows]);

  const quadrantById = React.useMemo(
    () =>
      assignQuadrants(
        allRows.map((r) => ({
          id: r.init.id,
          feasibility: r.init.feasibility,
          l3AiUsd: r.l3AiUsd,
          isPlaceholder: r.init.isPlaceholder,
        })),
      ),
    [allRows],
  );

  const quadrantCounts = React.useMemo(() => {
    const counts: Record<Quadrant, number> = {
      "quick-win": 0,
      "strategic-bet": 0,
      "fill-in": 0,
      deprioritize: 0,
    };
    quadrantById.forEach((q: Quadrant) => {
      counts[q] += 1;
    });
    return counts;
  }, [quadrantById]);

  const filtered = React.useMemo(() => {
    const q = state.query.trim().toLowerCase();
    const jfSet = new Set(state.jobFamilies);
    const venSet = new Set(state.vendors);
    const quadSet = new Set(state.quadrants);
    return allRows.filter((row) => {
      if (
        state.feasibility === "high" &&
        row.init.feasibility !== "High"
      ) {
        return false;
      }
      if (state.feasibility === "low" && row.init.feasibility === "High") {
        return false;
      }
      if (jfSet.size > 0 && !jfSet.has(row.l3Name)) return false;
      if (venSet.size > 0) {
        const rowVendors = splitVendors(row.init.primaryVendor);
        if (rowVendors.length === 0) return false;
        if (!rowVendors.some((v) => venSet.has(v))) return false;
      }
      if (quadSet.size > 0) {
        const q = quadrantById.get(row.init.id);
        if (!q || !quadSet.has(q)) return false;
      }
      if (q) {
        const hay =
          `${row.init.solutionName} ${row.init.tagline ?? ""} ${row.l3Name} ${row.l2Name}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allRows, state, quadrantById]);

  const sorted = React.useMemo(() => {
    const arr = [...filtered];
    const cmpName = (a: Row, b: Row) =>
      a.init.solutionName.localeCompare(b.init.solutionName);
    const cmpValueDesc = (a: Row, b: Row) => {
      if (b.l3AiUsd !== a.l3AiUsd) return b.l3AiUsd - a.l3AiUsd;
      return cmpName(a, b);
    };
    if (state.sort === "name") {
      arr.sort(cmpName);
    } else if (state.sort === "value-desc") {
      arr.sort(cmpValueDesc);
    } else {
      arr.sort((a, b) => {
        const aShip = a.init.feasibility === "High" ? 0 : 1;
        const bShip = b.init.feasibility === "High" ? 0 : 1;
        if (aShip !== bShip) return aShip - bShip;
        return cmpValueDesc(a, b);
      });
    }
    return arr;
  }, [filtered, state.sort]);

  const totalShown = sorted.length;
  const hasActiveFilters =
    state.feasibility !== "all" ||
    state.jobFamilies.length > 0 ||
    state.vendors.length > 0 ||
    state.quadrants.length > 0 ||
    state.query.trim().length > 0;

  const clearAll = () =>
    setState((s) => ({
      ...s,
      feasibility: "all",
      jobFamilies: [],
      vendors: [],
      quadrants: [],
      query: "",
    }));

  return (
    <div className="space-y-4">
      <Toolbar
        state={state}
        setState={setState}
        totalAvailable={allRows.length}
        totalShown={totalShown}
        allJobFamilies={allJobFamilies}
        allVendors={allVendors}
        quadrantCounts={quadrantCounts}
        hasActiveFilters={hasActiveFilters}
        onClearAll={clearAll}
      />
      {totalShown === 0 ? (
        <EmptyResults
          hasActiveFilters={hasActiveFilters}
          onClear={clearAll}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sorted.map((row) => (
            <SolutionCardV2
              key={row.init.id}
              init={row.init}
              row={row.row}
              l3Name={row.l3Name}
              l3AiUsd={row.l3AiUsd}
              towerIconKey={tower.iconKey}
              review={reviews[row.init.id]}
              actions={actions}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ===========================================================================
//   Toolbar
// ===========================================================================

function Toolbar({
  state,
  setState,
  totalAvailable,
  totalShown,
  allJobFamilies,
  allVendors,
  quadrantCounts,
  hasActiveFilters,
  onClearAll,
}: {
  state: GalleryState;
  setState: React.Dispatch<React.SetStateAction<GalleryState>>;
  totalAvailable: number;
  totalShown: number;
  allJobFamilies: string[];
  allVendors: string[];
  quadrantCounts: Record<Quadrant, number>;
  hasActiveFilters: boolean;
  onClearAll: () => void;
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-forge-border bg-forge-surface/50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <FeasibilityToggle state={state} setState={setState} />
        <MultiSelectFilter
          label="Job Family"
          triggerIcon={Layers}
          options={allJobFamilies.map((jf) => ({ id: jf, label: jf }))}
          selected={state.jobFamilies}
          onChange={(next) =>
            setState((s) => ({ ...s, jobFamilies: next }))
          }
        />
        <MultiSelectFilter
          label="Quadrant"
          triggerIcon={Target}
          options={QUADRANT_ORDER.map((q) => ({
            id: q,
            label: QUADRANT_LABELS[q],
            hint: `${quadrantCounts[q]}`,
          }))}
          selected={state.quadrants}
          onChange={(next) =>
            setState((s) => ({ ...s, quadrants: next as Quadrant[] }))
          }
          emptyHint="No quadrants match."
        />
        {allVendors.length > 0 ? (
          <MultiSelectFilter
            label="Vendor"
            triggerIcon={Building2}
            options={allVendors.map((v) => ({ id: v, label: v }))}
            selected={state.vendors}
            onChange={(next) =>
              setState((s) => ({ ...s, vendors: next }))
            }
          />
        ) : null}
        <SortMenu state={state} setState={setState} />
        <SearchInput state={state} setState={setState} />
        <span className="ml-auto inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.16em] text-forge-hint">
          <span className="text-forge-body">{totalShown}</span>
          <span>of</span>
          <span className="text-forge-body">{totalAvailable}</span>
          <span>solutions</span>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={onClearAll}
              className="ml-2 inline-flex items-center gap-1 rounded-full border border-forge-border bg-forge-well/50 px-2 py-0.5 text-[10px] uppercase tracking-wider text-forge-body transition hover:border-accent-purple/40 hover:text-forge-ink"
            >
              <X className="h-3 w-3" aria-hidden /> Clear filters
            </button>
          ) : null}
        </span>
      </div>
      {state.quadrants.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-forge-subtle">
          <span className="font-mono uppercase tracking-[0.16em] text-forge-hint">
            &gt; Quadrants
          </span>
          {state.quadrants.map((q) => (
            <span
              key={q}
              className="inline-flex items-center gap-1 rounded-full border border-accent-purple/40 bg-accent-purple/10 px-2 py-0.5 font-medium text-accent-purple-light"
              title={QUADRANT_HINTS[q]}
            >
              {QUADRANT_LABELS[q]}
              <button
                type="button"
                onClick={() =>
                  setState((s) => ({
                    ...s,
                    quadrants: s.quadrants.filter((x) => x !== q),
                  }))
                }
                aria-label={`Remove ${QUADRANT_LABELS[q]} filter`}
                className="text-accent-purple-light/70 hover:text-accent-purple-light"
              >
                <X className="h-2.5 w-2.5" aria-hidden />
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function FeasibilityToggle({
  state,
  setState,
}: {
  state: GalleryState;
  setState: React.Dispatch<React.SetStateAction<GalleryState>>;
}) {
  return (
    <div
      role="group"
      aria-label="Filter by feasibility"
      className="inline-flex rounded-full border border-forge-border bg-forge-well/40 p-0.5"
    >
      {FEASIBILITY_OPTIONS.map(({ id, label, Icon }) => {
        const active = state.feasibility === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => setState((s) => ({ ...s, feasibility: id }))}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition",
              active
                ? "bg-accent-teal/15 text-accent-teal"
                : "text-forge-body hover:bg-forge-well",
            )}
            aria-pressed={active}
          >
            {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden /> : null}
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

function SortMenu({
  state,
  setState,
}: {
  state: GalleryState;
  setState: React.Dispatch<React.SetStateAction<GalleryState>>;
}) {
  return (
    <label className="inline-flex items-center gap-1.5 rounded-full border border-forge-border bg-forge-well/40 px-2 py-1 text-xs text-forge-body">
      <SlidersHorizontal className="h-3.5 w-3.5 text-forge-hint" aria-hidden />
      <span className="font-mono uppercase tracking-[0.14em] text-forge-hint">
        Sort
      </span>
      <select
        value={state.sort}
        onChange={(e) =>
          setState((s) => ({ ...s, sort: e.target.value as SortKey }))
        }
        className="bg-transparent text-xs text-forge-ink focus:outline-none"
      >
        <option value="feasibility-then-value">Proven first, then value</option>
        <option value="value-desc">Value (high to low)</option>
        <option value="name">Name (A→Z)</option>
      </select>
    </label>
  );
}

function SearchInput({
  state,
  setState,
}: {
  state: GalleryState;
  setState: React.Dispatch<React.SetStateAction<GalleryState>>;
}) {
  return (
    <label
      className={cn(
        "inline-flex items-center gap-2 rounded-full border bg-forge-well/40 px-3 py-1 text-xs",
        state.query
          ? "border-accent-purple/40 text-forge-ink"
          : "border-forge-border text-forge-body",
      )}
    >
      <Search className="h-3.5 w-3.5 text-forge-hint" aria-hidden />
      <input
        type="text"
        placeholder="Search title, tagline, Job Family"
        value={state.query}
        onChange={(e) => setState((s) => ({ ...s, query: e.target.value }))}
        className="w-44 bg-transparent text-xs placeholder:text-forge-hint focus:outline-none sm:w-60"
      />
      {state.query ? (
        <button
          type="button"
          onClick={() => setState((s) => ({ ...s, query: "" }))}
          aria-label="Clear search"
          className="text-forge-hint hover:text-forge-ink"
        >
          <X className="h-3 w-3" aria-hidden />
        </button>
      ) : null}
    </label>
  );
}

function EmptyResults({
  hasActiveFilters,
  onClear,
}: {
  hasActiveFilters: boolean;
  onClear: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-forge-border bg-forge-well/30 p-10 text-center text-sm text-forge-subtle">
      <ArrowDownAZ
        className="mx-auto h-5 w-5 text-forge-hint"
        aria-hidden
      />
      <p className="mt-3 font-display font-semibold text-forge-ink">
        No AI Solutions match the current filters.
      </p>
      <p className="mt-2 text-xs text-forge-subtle">
        {hasActiveFilters
          ? "Loosen the filters or clear them to see every solution in this tower."
          : "Once Job Families have an AI dial above zero, refresh AI guidance from the workshop tools drawer to populate this view."}
      </p>
      {hasActiveFilters ? (
        <button
          type="button"
          onClick={onClear}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-accent-purple/40 bg-accent-purple/10 px-3 py-1.5 text-xs text-accent-purple-light hover:bg-accent-purple/20"
        >
          <X className="h-3 w-3" aria-hidden /> Clear all filters
        </button>
      ) : null}
    </div>
  );
}
