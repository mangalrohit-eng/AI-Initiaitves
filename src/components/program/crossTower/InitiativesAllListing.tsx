"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronDown, ChevronRight, Search, Sparkles } from "lucide-react";
import type { SelectProgramResult, ProgramInitiativeRow } from "@/lib/initiatives/selectProgram";
import type { CrossTowerAiPlanLLM } from "@/lib/llm/prompts/crossTowerAiPlan.v1";
import type { BuildScaleRow } from "@/lib/initiatives/buildScaleModel";
import { HORIZON_MONTHS } from "@/lib/initiatives/buildScaleModel";
import { TIER_STYLES } from "@/lib/priority";
import { formatUsdCompact } from "@/lib/format";
import { useRedactDollars } from "@/lib/clientMode";
import { slugify } from "@/lib/utils";

/**
 * Comprehensive Initiatives table — every non-placeholder initiative across
 * the 13 towers, sortable + filterable. No top-N truncation.
 *
 * Row data is fully deterministic. The LLM ranking surfaces only as a small
 * non-disruptive badge + an expandable rationale; rank does NOT reorder rows.
 * Sort is uniform deterministic so search/findability stays stable.
 */
export function InitiativesAllListing({
  program,
  llmPlan,
  narrativeUnavailable,
}: {
  program: SelectProgramResult;
  llmPlan: CrossTowerAiPlanLLM | null;
  narrativeUnavailable: boolean;
}) {
  const redact = useRedactDollars();
  const [sortKey, setSortKey] = React.useState<SortKey>("phase");
  const [towerFilter, setTowerFilter] = React.useState<Set<string>>(new Set());
  const [phaseFilter, setPhaseFilter] = React.useState<Set<string>>(new Set());
  const [search, setSearch] = React.useState("");
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  const buildScaleById = React.useMemo(() => {
    const map = new Map<string, BuildScaleRow>();
    for (const r of program.buildScale.rows) map.set(r.id, r);
    return map;
  }, [program.buildScale.rows]);

  const llmById = React.useMemo(() => {
    const map = new Map<string, { ranking: number; why: string; dependsOn: string[] }>();
    if (!llmPlan || narrativeUnavailable) return map;
    for (const k of llmPlan.keyInitiatives) {
      map.set(k.initiativeId, {
        ranking: k.ranking,
        why: k.why,
        dependsOn: k.dependsOn,
      });
    }
    return map;
  }, [llmPlan, narrativeUnavailable]);

  const initiativeNameById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const r of program.initiatives) map.set(r.id, r.name);
    return map;
  }, [program.initiatives]);

  const towers = React.useMemo(() => uniqueTowers(program.initiatives), [program.initiatives]);

  const visible = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = program.initiatives.filter((r) => {
      if (towerFilter.size > 0 && !towerFilter.has(r.towerId)) return false;
      const phaseLabel = r.tier ?? "Unphased";
      if (phaseFilter.size > 0 && !phaseFilter.has(phaseLabel)) return false;
      if (q.length > 0) {
        const hay = `${r.name} ${r.towerName} ${r.l3Name} ${r.l2Name}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    return [...filtered].sort(buildSorter(sortKey, buildScaleById));
  }, [program.initiatives, towerFilter, phaseFilter, search, sortKey, buildScaleById]);

  const filtersActive =
    towerFilter.size > 0 || phaseFilter.size > 0 || search.trim().length > 0;

  return (
    <div className="space-y-3">
      <Toolbar
        sortKey={sortKey}
        setSortKey={setSortKey}
        towers={towers}
        towerFilter={towerFilter}
        setTowerFilter={setTowerFilter}
        phaseFilter={phaseFilter}
        setPhaseFilter={setPhaseFilter}
        search={search}
        setSearch={setSearch}
        visibleCount={visible.length}
        totalCount={program.initiatives.length}
        filtersActive={filtersActive}
        onClear={() => {
          setTowerFilter(new Set());
          setPhaseFilter(new Set());
          setSearch("");
        }}
      />

      <div className="overflow-x-auto rounded-xl border border-forge-border bg-forge-surface">
        <table className="w-full min-w-[1024px] text-sm">
          <thead>
            <tr className="border-b border-forge-border bg-forge-well/40 text-left text-[11px] uppercase tracking-wider text-forge-subtle">
              <th className="w-9 px-3 py-2"></th>
              <th className="px-3 py-2 font-medium">Initiative</th>
              <th className="px-3 py-2 font-medium">Tower</th>
              <th className="px-3 py-2 font-medium">Phase</th>
              <th className="px-3 py-2 font-medium">Build</th>
              <th className="px-3 py-2 font-medium">Ramp window</th>
              <th className="px-3 py-2 font-medium">Full scale</th>
              <th className="px-3 py-2 text-right font-medium">$ at full scale</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-sm text-forge-subtle">
                  No initiatives match the active filters.
                </td>
              </tr>
            ) : (
              visible.map((row) => {
                const bs = buildScaleById.get(row.id);
                const llm = llmById.get(row.id);
                const isExpanded = expanded.has(row.id);
                return (
                  <React.Fragment key={row.id}>
                    <tr
                      className={`border-b border-forge-border/60 transition hover:bg-forge-well/30 ${
                        isExpanded ? "bg-forge-well/40" : ""
                      }`}
                    >
                      <td className="px-3 py-2 align-top">
                        <button
                          type="button"
                          onClick={() =>
                            setExpanded((prev) => {
                              const next = new Set(prev);
                              if (next.has(row.id)) next.delete(row.id);
                              else next.add(row.id);
                              return next;
                            })
                          }
                          className="rounded-md p-0.5 text-forge-hint hover:bg-forge-border/40 hover:text-forge-ink"
                          aria-label={isExpanded ? "Collapse" : "Expand"}
                          aria-expanded={isExpanded}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </td>
                      <td className="min-w-0 px-3 py-2 align-top">
                        <div className="flex items-center gap-1.5">
                          <Link
                            href={initiativeHref(row)}
                            className="group inline-flex max-w-full items-center gap-1 truncate text-sm font-medium text-forge-ink hover:text-accent-purple-dark"
                          >
                            <span className="truncate">{row.name}</span>
                            <ArrowUpRight className="h-3 w-3 flex-shrink-0 text-forge-hint transition group-hover:text-accent-purple" />
                          </Link>
                          {llm ? <RankedBadge ranking={llm.ranking} /> : null}
                        </div>
                        <div className="mt-0.5 truncate text-[11px] text-forge-hint" title={row.l3Name}>
                          {row.l2Name} · {row.l3Name}
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top text-xs text-forge-body">
                        {row.towerName}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <PhaseBadge tier={row.tier} />
                      </td>
                      <td className="px-3 py-2 align-top text-xs text-forge-body">
                        {bs ? (
                          <span className="font-mono tabular-nums">
                            M{bs.phaseStartMonth}–M
                            {Math.min(bs.endBuildMonth, HORIZON_MONTHS)}
                            <span className="ml-1 text-forge-hint">
                              ({bs.buildMonths}mo)
                            </span>
                          </span>
                        ) : (
                          <span className="text-forge-hint">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top text-xs text-forge-body">
                        {bs && bs.rampStartMonth <= HORIZON_MONTHS ? (
                          <span className="font-mono tabular-nums">
                            M{bs.rampStartMonth}–M
                            {Math.min(bs.fullScaleMonth, HORIZON_MONTHS)}
                          </span>
                        ) : bs ? (
                          <span className="font-mono text-forge-hint">past M24</span>
                        ) : (
                          <span className="text-forge-hint">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top text-xs text-forge-body">
                        {bs ? (
                          bs.rampExtendsPastHorizon ? (
                            <span className="font-mono uppercase tracking-wider text-forge-subtle">
                              past M24
                            </span>
                          ) : (
                            <span className="font-mono tabular-nums">
                              M{bs.fullScaleMonth}
                            </span>
                          )
                        ) : (
                          <span className="text-forge-hint">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right align-top">
                        <div className="font-mono text-xs tabular-nums text-forge-ink">
                          {redact ? "—" : formatUsdCompact(row.attributedAiUsd)}
                        </div>
                        {row.attributedAiUsd !== row.aiUsd && !redact ? (
                          <div className="font-mono text-[10px] text-forge-hint" title="L3-level AI $ pool">
                            of {formatUsdCompact(row.aiUsd)} L3
                          </div>
                        ) : null}
                      </td>
                    </tr>
                    {isExpanded ? (
                      <tr className="border-b border-forge-border/60 bg-forge-well/40">
                        <td colSpan={8} className="px-3 pb-3 pt-1">
                          <ExpandedDetail
                            row={row}
                            llmRationale={llm?.why}
                            llmDependsOn={llm?.dependsOn ?? []}
                            initiativeNameById={initiativeNameById}
                          />
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ===========================================================================
//   Toolbar (sort + filter + search)
// ===========================================================================

type SortKey = "phase" | "ai-usd" | "tower" | "name" | "start-month";
const PHASE_OPTIONS = ["P1", "P2", "P3", "Unphased"] as const;

function Toolbar({
  sortKey,
  setSortKey,
  towers,
  towerFilter,
  setTowerFilter,
  phaseFilter,
  setPhaseFilter,
  search,
  setSearch,
  visibleCount,
  totalCount,
  filtersActive,
  onClear,
}: {
  sortKey: SortKey;
  setSortKey: (k: SortKey) => void;
  towers: { id: string; name: string }[];
  towerFilter: Set<string>;
  setTowerFilter: (s: Set<string>) => void;
  phaseFilter: Set<string>;
  setPhaseFilter: (s: Set<string>) => void;
  search: string;
  setSearch: (s: string) => void;
  visibleCount: number;
  totalCount: number;
  filtersActive: boolean;
  onClear: () => void;
}) {
  return (
    <div className="space-y-2.5 rounded-xl border border-forge-border bg-forge-surface p-3">
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-forge-hint">Sort:</span>
          {(
            [
              { id: "phase", label: "Phase" },
              { id: "start-month", label: "Build start" },
              { id: "ai-usd", label: "$ desc" },
              { id: "tower", label: "Tower" },
              { id: "name", label: "Name" },
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

        <label className="ml-auto inline-flex items-center gap-2 rounded-full border border-forge-border bg-forge-well/60 px-2.5 py-1 text-forge-body focus-within:border-accent-purple/60">
          <Search className="h-3.5 w-3.5 text-forge-hint" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search initiatives, towers, capabilities…"
            className="w-56 bg-transparent text-xs text-forge-ink outline-none placeholder:text-forge-hint"
          />
        </label>

        <div className="flex items-center gap-2 font-mono text-[11px] text-forge-subtle">
          <span>{visibleCount}</span>
          <span className="text-forge-hint">/</span>
          <span>{totalCount} initiatives</span>
          {filtersActive ? (
            <button
              type="button"
              onClick={onClear}
              className="ml-2 rounded-full border border-forge-border bg-forge-well px-2 py-0.5 text-[10px] text-forge-body hover:text-forge-ink"
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>

      <ChipFilterRow
        label="Phase"
        options={PHASE_OPTIONS.map((p) => ({ id: p, label: p }))}
        selected={phaseFilter}
        onToggle={(id) => {
          const next = new Set(phaseFilter);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          setPhaseFilter(next);
        }}
      />

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
//   Row helpers
// ===========================================================================

function PhaseBadge({ tier }: { tier: ProgramInitiativeRow["tier"] }) {
  if (!tier) {
    return (
      <span className="inline-flex items-center rounded-full border border-forge-border bg-forge-well px-2 py-0.5 font-mono text-[10px] font-semibold text-forge-body">
        —
      </span>
    );
  }
  const styles = TIER_STYLES[tier];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold ${styles.badge}`}
    >
      {tier}
    </span>
  );
}

function RankedBadge({ ranking }: { ranking: number }) {
  return (
    <span
      className="inline-flex items-center gap-0.5 rounded-full border border-accent-purple/30 bg-accent-purple/10 px-1.5 py-0 font-mono text-[10px] font-semibold text-accent-purple-dark"
      title={`AI-ranked #${ranking}`}
    >
      <Sparkles className="h-2.5 w-2.5" aria-hidden />
      {ranking}
    </span>
  );
}

function ExpandedDetail({
  row,
  llmRationale,
  llmDependsOn,
  initiativeNameById,
}: {
  row: ProgramInitiativeRow;
  llmRationale?: string;
  llmDependsOn: string[];
  initiativeNameById: Map<string, string>;
}) {
  const dependsOnNames = llmDependsOn
    .map((id) => initiativeNameById.get(id))
    .filter((s): s is string => Boolean(s));
  const rationaleSource: "llm" | "deterministic" | "tbd" = llmRationale
    ? "llm"
    : row.aiRationale
      ? "deterministic"
      : "tbd";
  const rationaleText =
    rationaleSource === "llm"
      ? llmRationale
      : rationaleSource === "deterministic"
        ? row.aiRationale
        : "Rationale: TBD — subject to discovery.";
  return (
    <div className="grid gap-3 rounded-lg border border-forge-border bg-forge-surface px-4 py-3 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-forge-subtle">
          {rationaleSource === "llm"
            ? "AI-authored rationale"
            : rationaleSource === "deterministic"
              ? "Capability-map rationale"
              : "Rationale"}
        </div>
        <p className="mt-1 text-xs leading-relaxed text-forge-body">{rationaleText}</p>
        {dependsOnNames.length > 0 ? (
          <div className="mt-2 text-[11px] text-forge-subtle">
            <span className="text-forge-hint">Depends on:</span>{" "}
            {dependsOnNames.join(" · ")}
          </div>
        ) : null}
      </div>
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-forge-subtle">
          Click-throughs
        </div>
        <ul className="mt-1 space-y-1 text-xs">
          <li>
            <Link
              href={initiativeHref(row)}
              className="inline-flex items-center gap-1 text-forge-body hover:text-accent-purple-dark"
            >
              <ArrowUpRight className="h-3 w-3" aria-hidden />
              {row.initiative ? "Full 4-lens initiative" : row.briefSlug ? "Process brief" : "Tower roadmap"}
            </Link>
          </li>
          <li>
            <Link
              href={`/tower/${row.towerId}`}
              className="inline-flex items-center gap-1 text-forge-body hover:text-accent-purple-dark"
            >
              <ArrowUpRight className="h-3 w-3" aria-hidden />
              {row.towerName} roadmap
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
}

function initiativeHref(row: ProgramInitiativeRow): string {
  if (row.initiative) {
    return `/tower/${row.towerId}/process/${slugify(row.initiative.name)}`;
  }
  if (row.briefSlug) return `/tower/${row.towerId}/brief/${row.briefSlug}`;
  return `/tower/${row.towerId}`;
}

// ===========================================================================
//   Sort + filter helpers
// ===========================================================================

function uniqueTowers(
  rows: readonly ProgramInitiativeRow[],
): { id: string; name: string }[] {
  const map = new Map<string, string>();
  for (const r of rows) if (!map.has(r.towerId)) map.set(r.towerId, r.towerName);
  return Array.from(map.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function buildSorter(
  key: SortKey,
  buildScaleById: Map<string, BuildScaleRow>,
) {
  return (a: ProgramInitiativeRow, b: ProgramInitiativeRow): number => {
    if (key === "ai-usd") {
      const usd = b.attributedAiUsd - a.attributedAiUsd;
      if (Math.abs(usd) > 0.5) return usd;
    }
    if (key === "tower") {
      const t = a.towerName.localeCompare(b.towerName);
      if (t !== 0) return t;
    }
    if (key === "name") {
      const n = a.name.localeCompare(b.name);
      if (n !== 0) return n;
    }
    if (key === "start-month") {
      const aStart = buildScaleById.get(a.id)?.phaseStartMonth ?? 99;
      const bStart = buildScaleById.get(b.id)?.phaseStartMonth ?? 99;
      const m = aStart - bStart;
      if (m !== 0) return m;
    }
    // Default tail: phase rank → start month → $ desc → tower → name.
    const phaseDelta = tierRank(a.tier) - tierRank(b.tier);
    if (phaseDelta !== 0) return phaseDelta;
    const aStart = buildScaleById.get(a.id)?.phaseStartMonth ?? 99;
    const bStart = buildScaleById.get(b.id)?.phaseStartMonth ?? 99;
    const startDelta = aStart - bStart;
    if (startDelta !== 0) return startDelta;
    const usdDelta = b.attributedAiUsd - a.attributedAiUsd;
    if (Math.abs(usdDelta) > 0.5) return usdDelta;
    const towerDelta = a.towerName.localeCompare(b.towerName);
    if (towerDelta !== 0) return towerDelta;
    return a.name.localeCompare(b.name);
  };
}

function tierRank(t: ProgramInitiativeRow["tier"]): number {
  if (t === "P1") return 0;
  if (t === "P2") return 1;
  if (t === "P3") return 2;
  return 3;
}

