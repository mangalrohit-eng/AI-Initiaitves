"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  Info,
  MapPin,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import type {
  ContactCenterHub,
  IndianGccCity,
} from "@/data/assess/types";
import { useStrictCarveOuts } from "@/lib/offshore/useStrictCarveOuts";
import { useOffshoreAssumptions } from "@/lib/offshore/useOffshoreAssumptions";
import type { StrictCarveOutReason } from "@/lib/offshore/strictCarveOutKeywords";
import { cn } from "@/lib/utils";

const REASON_OPTIONS: { value: StrictCarveOutReason; label: string; tone: string }[] = [
  { value: "Editorial", label: "Editorial", tone: "border-accent-red/40 bg-accent-red/10 text-accent-red" },
  { value: "Talent", label: "Talent", tone: "border-accent-amber/40 bg-accent-amber/10 text-accent-amber" },
  { value: "SOX", label: "SOX", tone: "border-accent-teal/40 bg-accent-teal/10 text-accent-teal" },
  { value: "Sales", label: "Sales", tone: "border-accent-purple/40 bg-accent-purple/10 text-accent-purple-dark" },
];

const PRIMARY_CITIES: IndianGccCity[] = ["Bangalore", "Pune", "Hyderabad", "Chennai"];
const HUBS: ContactCenterHub[] = ["Manila", "Cebu", "Krakow", "None"];

const HUB_LABEL: Record<ContactCenterHub, string> = {
  Manila: "Manila",
  Cebu: "Cebu",
  Krakow: "Kraków",
  None: "None",
};

const HUB_DESCRIPTION: Record<ContactCenterHub, string> = {
  Manila:
    "English-fluency during US business hours · Cisco WebEx Contact stack · multi-brand subscriber support",
  Cebu:
    "Lower cost-of-living vs Manila · same English-fluency profile · narrower talent depth at scale",
  Krakow:
    "EMEA coverage · multilingual European support · higher unit cost than APAC hubs",
  None:
    "Fold contact-center work into the primary GCC instead of routing to a separate hub.",
};

const CITY_DESCRIPTION: Record<IndianGccCity, string> = {
  Bangalore: "Tech / engineering / data depth · deepest GCC talent pool",
  Pune: "Lower cost vs Bangalore · strong CA / shared-service talent",
  Hyderabad: "Mature GCC ecosystem · cyber + financial services depth",
  Chennai: "Process / BPO depth · strong finance back-office talent",
};

type SectionId = "carve-outs" | "locations" | "other";

const ALL_SECTION_IDS: readonly SectionId[] = ["carve-outs", "locations", "other"];

/**
 * Step-5 Assumptions tab — the editable surface for everything Step-5-
 * specific that the deterministic substrate or LLM reads from. The three
 * top-level categories (Carve-outs, GCC locations, Other) are themselves
 * accordions so the page reads as a compact menu of "what would you like
 * to edit?" rather than three full sections stacked end-to-end. Carve-outs
 * is open by default since it's the most-used surface.
 */
export function AssumptionsTab() {
  const carveOuts = useStrictCarveOuts();
  const assumptions = useOffshoreAssumptions();
  const [openSections, setOpenSections] = React.useState<Set<SectionId>>(
    () => new Set<SectionId>(["carve-outs"]),
  );

  const toggleSection = React.useCallback((id: SectionId) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = React.useCallback(
    () => setOpenSections(new Set(ALL_SECTION_IDS)),
    [],
  );
  const collapseAll = React.useCallback(
    () => setOpenSections(new Set<SectionId>()),
    [],
  );
  const allOpen = ALL_SECTION_IDS.every((id) => openSections.has(id));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full border border-accent-purple/30 bg-accent-purple/5 text-accent-purple-dark">
            <Settings2 className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold text-forge-ink">
              <span className="mr-2 text-accent-purple-dark">&gt;</span>
              Step-5 assumptions
            </h2>
            <p className="mt-1 text-sm text-forge-body">
              Edit the inputs the Offshore Plan reads from. Changes save inline
              and propagate to every tab. Click{" "}
              <strong>Regenerate offshore plan</strong> in the action bar above
              to refresh LLM-authored justifications after you change carve-outs
              or locations.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={allOpen ? collapseAll : expandAll}
          className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-forge-border px-3 py-1 text-[11px] font-medium text-forge-body transition hover:border-forge-border-strong hover:text-forge-ink"
        >
          {allOpen ? "Collapse all" : "Expand all"}
        </button>
      </header>

      <div className="space-y-3">
        <CarveOutSection
          api={carveOuts}
          isOpen={openSections.has("carve-outs")}
          onToggle={() => toggleSection("carve-outs")}
        />
        <LocationsSection
          api={assumptions}
          isOpen={openSections.has("locations")}
          onToggle={() => toggleSection("locations")}
        />
        <ComingNextSection
          isOpen={openSections.has("other")}
          onToggle={() => toggleSection("other")}
        />
      </div>

      <footer className="flex items-center justify-between border-t border-forge-border/60 pt-4 text-[12px] text-forge-subtle">
        <span>
          Global rate assumptions ($ / FTE-year) live separately under{" "}
          <a
            className="font-medium text-accent-purple-dark underline underline-offset-2 hover:text-accent-purple"
            href="/assumptions"
          >
            /assumptions →
          </a>
        </span>
        <span className="text-forge-subtle">
          Step-5-specific · saved to your program workspace
        </span>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
//   Section 1 — Carve-outs
// ---------------------------------------------------------------------------

type TowerGroup = {
  towerId: string;
  towerName: string;
  rows: ReturnType<typeof useStrictCarveOuts>["rows"];
  counts: { total: number; carved: number; reasons: CarveOutCountsByReason };
};

type CarveOutCountsByReason = Record<StrictCarveOutReason, number>;

function emptyReasonCounts(): CarveOutCountsByReason {
  return { Editorial: 0, Talent: 0, SOX: 0, Sales: 0 };
}

function CarveOutSection({
  api,
  isOpen,
  onToggle,
}: {
  api: ReturnType<typeof useStrictCarveOuts>;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const [search, setSearch] = React.useState("");
  const [towerFilter, setTowerFilter] = React.useState<string | "all">("all");
  const [showResetConfirm, setShowResetConfirm] = React.useState(false);
  const [openTowers, setOpenTowers] = React.useState<Set<string>>(() => new Set());

  const towersInPlay = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const r of api.rows) map.set(r.towerId, r.towerName);
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [api.rows]);

  const filteredRows = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return api.rows.filter((r) => {
      if (towerFilter !== "all" && r.towerId !== towerFilter) return false;
      if (!q) return true;
      const hay = `${r.l2} ${r.l3} ${r.towerName}`.toLowerCase();
      return hay.includes(q);
    });
  }, [api.rows, search, towerFilter]);

  // Group filtered rows by tower with per-tower carve-out counts.
  const grouped = React.useMemo<TowerGroup[]>(() => {
    const map = new Map<string, TowerGroup>();
    for (const r of filteredRows) {
      let g = map.get(r.towerId);
      if (!g) {
        g = {
          towerId: r.towerId,
          towerName: r.towerName,
          rows: [],
          counts: { total: 0, carved: 0, reasons: emptyReasonCounts() },
        };
        map.set(r.towerId, g);
      }
      g.rows.push(r);
      g.counts.total += 1;
      if (r.reason) {
        g.counts.carved += 1;
        g.counts.reasons[r.reason] += 1;
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => b.counts.carved - a.counts.carved || a.towerName.localeCompare(b.towerName),
    );
  }, [filteredRows]);

  const isSearching = search.trim().length > 0;

  // While a search is active, auto-expand every matching tower so users
  // can read the matched rows without clicking. Collapsing is restored
  // when search clears.
  React.useEffect(() => {
    if (!isSearching) return;
    setOpenTowers(new Set(grouped.map((g) => g.towerId)));
  }, [isSearching, grouped]);

  const toggleTower = React.useCallback((towerId: string) => {
    setOpenTowers((prev) => {
      const next = new Set(prev);
      if (next.has(towerId)) next.delete(towerId);
      else next.add(towerId);
      return next;
    });
  }, []);

  const expandAll = React.useCallback(() => {
    setOpenTowers(new Set(grouped.map((g) => g.towerId)));
  }, [grouped]);

  const collapseAll = React.useCallback(() => setOpenTowers(new Set()), []);

  const allOpen = grouped.length > 0 && grouped.every((g) => openTowers.has(g.towerId));

  return (
    <>
    <SectionAccordion
      index={1}
      icon={<ShieldCheck className="h-4 w-4" aria-hidden />}
      title="Carve-outs"
      subtitle={
        api.counts.total > 0 ? (
          <>
            <span className="font-mono">{api.counts.total}</span> rows locked out of offshore scope —{" "}
            <ReasonMix counts={api.counts} />
          </>
        ) : (
          "No rows carved out — every L3 row is in scope for offshore."
        )
      }
      action={
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full border border-forge-border px-3 py-1 text-[11px] font-medium text-forge-body transition hover:border-forge-border-strong hover:text-forge-ink"
          onClick={() => setShowResetConfirm(true)}
        >
          <RotateCcw className="h-3 w-3" aria-hidden />
          Reset to keyword defaults
        </button>
      }
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
        <label className="relative flex items-center">
          <Search
            className="pointer-events-none absolute left-3 h-4 w-4 text-forge-subtle"
            aria-hidden
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search L2 · L3 · tower"
            className="w-full rounded-xl border border-forge-border bg-forge-well px-9 py-2 text-sm text-forge-ink placeholder:text-forge-subtle focus:border-accent-purple focus:outline-none focus:ring-2 focus:ring-accent-purple/20"
          />
        </label>
        <select
          value={towerFilter}
          onChange={(e) => setTowerFilter(e.target.value as string | "all")}
          className="rounded-xl border border-forge-border bg-forge-well px-3 py-2 text-sm text-forge-ink focus:border-accent-purple focus:outline-none focus:ring-2 focus:ring-accent-purple/20"
        >
          <option value="all">All towers ({api.rows.length})</option>
          {towersInPlay.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {grouped.length > 0 && (
        <div className="mt-3 flex items-center justify-between text-[11px] text-forge-subtle">
          <span>
            {grouped.length} tower{grouped.length === 1 ? "" : "s"} ·{" "}
            <span className="font-mono text-forge-body">
              {grouped.reduce((s, g) => s + g.counts.carved, 0)}
            </span>{" "}
            carved /{" "}
            <span className="font-mono">
              {grouped.reduce((s, g) => s + g.counts.total, 0)}
            </span>{" "}
            visible rows
          </span>
          <button
            type="button"
            onClick={allOpen ? collapseAll : expandAll}
            className="font-medium text-accent-purple-dark underline-offset-2 hover:underline"
          >
            {allOpen ? "Collapse all" : "Expand all"}
          </button>
        </div>
      )}

      <div className="mt-3 space-y-2">
        {grouped.length === 0 && (
          <p className="rounded-xl border border-dashed border-forge-border bg-forge-well/40 px-4 py-6 text-center text-sm text-forge-subtle">
            No L3 rows match. Clear the search or change the tower filter.
          </p>
        )}
        {grouped.map((g) => (
          <TowerAccordion
            key={g.towerId}
            group={g}
            isOpen={openTowers.has(g.towerId)}
            onToggle={() => toggleTower(g.towerId)}
            onSetReason={api.setReason}
          />
        ))}
      </div>
      </SectionAccordion>

      {/*
        Dialog lives OUTSIDE the SectionAccordion so it still renders when
        the section is collapsed (the action button is in the header and
        is always visible — clicking it must work whether the body is
        expanded or not).
      */}
      {showResetConfirm && (
        <ResetConfirmDialog
          title="Reset carve-outs to keyword defaults?"
          body="This replaces every current carve-out — including manual edits — with the seeded keyword defaults. You can re-tag any row afterward."
          onCancel={() => setShowResetConfirm(false)}
          onConfirm={() => {
            api.resetToKeywordDefaults();
            setShowResetConfirm(false);
          }}
        />
      )}
    </>
  );
}

const REASON_DOT: Record<StrictCarveOutReason, string> = {
  Editorial: "bg-accent-red",
  Talent: "bg-accent-amber",
  SOX: "bg-accent-teal",
  Sales: "bg-accent-purple",
};

function TowerAccordion({
  group,
  isOpen,
  onToggle,
  onSetReason,
}: {
  group: TowerGroup;
  isOpen: boolean;
  onToggle: () => void;
  onSetReason: (rowId: string, reason: StrictCarveOutReason | null) => void;
}) {
  const reasonChips = (Object.keys(group.counts.reasons) as StrictCarveOutReason[])
    .map((r) => ({ reason: r, count: group.counts.reasons[r] }))
    .filter((x) => x.count > 0);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border transition",
        isOpen
          ? "border-accent-purple/40 bg-forge-surface ring-1 ring-accent-purple/15"
          : "border-forge-border bg-forge-surface",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className={cn(
          "flex w-full items-center gap-3 px-4 py-2.5 text-left transition",
          isOpen ? "bg-accent-purple/5" : "bg-forge-well/60 hover:bg-forge-well",
        )}
      >
        <span
          className={cn(
            "inline-flex h-5 w-5 flex-none items-center justify-center text-forge-subtle transition",
            isOpen && "rotate-0 text-accent-purple-dark",
          )}
        >
          {isOpen ? (
            <ChevronDown className="h-4 w-4" aria-hidden />
          ) : (
            <ChevronRight className="h-4 w-4" aria-hidden />
          )}
        </span>
        <h3 className="flex-1 font-display text-sm font-semibold text-forge-ink">
          {group.towerName}
        </h3>
        <div className="flex flex-wrap items-center gap-1.5">
          {reasonChips.length === 0 ? (
            <span className="text-[11px] italic text-forge-subtle">
              No carve-outs
            </span>
          ) : (
            reasonChips.map((c) => (
              <span
                key={c.reason}
                className="inline-flex items-center gap-1 rounded-full border border-forge-border bg-forge-surface px-2 py-0.5 text-[10px] font-medium text-forge-body"
                title={`${c.count} ${c.reason} carve-out${c.count === 1 ? "" : "s"}`}
              >
                <span
                  className={cn("inline-block h-1.5 w-1.5 rounded-full", REASON_DOT[c.reason])}
                  aria-hidden
                />
                {c.reason}
                <span className="font-mono text-forge-subtle">{c.count}</span>
              </span>
            ))
          )}
          <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-forge-border bg-forge-well px-2 py-0.5 font-mono text-[10px] text-forge-subtle">
            <span className="font-semibold text-forge-body">{group.counts.carved}</span>
            <span>/</span>
            <span>{group.counts.total}</span>
          </span>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            style={{ overflow: "hidden" }}
          >
            <ul className="divide-y divide-forge-border/60 border-t border-forge-border">
              {group.rows.map((r) => (
                <CarveOutRow
                  key={r.rowId}
                  row={r}
                  onSetReason={(reason) => onSetReason(r.rowId, reason)}
                />
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CarveOutRow({
  row,
  onSetReason,
}: {
  row: ReturnType<typeof useStrictCarveOuts>["rows"][number];
  onSetReason: (reason: StrictCarveOutReason | null) => void;
}) {
  const checked = row.reason !== null;
  const dialOverridden = checked && row.dialPct != null && row.dialPct > 0;
  return (
    <li className="grid grid-cols-1 items-start gap-2 px-4 py-3 sm:grid-cols-[auto_1fr_auto]">
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={() => onSetReason(checked ? null : "Editorial")}
        className={cn(
          "mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded border transition",
          checked
            ? "border-accent-purple bg-accent-purple text-white"
            : "border-forge-border-strong bg-forge-surface text-transparent hover:border-accent-purple/60",
        )}
      >
        <Check className="h-3.5 w-3.5" aria-hidden />
      </button>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-forge-ink">{row.l3}</p>
          <span className="text-[11px] text-forge-subtle">·</span>
          <p className="truncate text-[12px] text-forge-subtle">{row.l2}</p>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-forge-subtle">
          <span className="font-mono">
            {row.totalHeadcount} HC
          </span>
          {row.dialPct != null && (
            <>
              <span>·</span>
              <span className="font-mono">Step-2 dial: {row.dialPct}%</span>
            </>
          )}
          {dialOverridden && (
            <span className="inline-flex items-center gap-1 rounded-full border border-accent-amber/40 bg-accent-amber/10 px-2 py-0.5 text-[10px] font-medium text-accent-amber">
              <AlertCircle className="h-3 w-3" aria-hidden />
              dial overridden
            </span>
          )}
          {row.setBy === "seed" && checked && (
            <span className="inline-flex items-center gap-1 rounded-full border border-forge-border bg-forge-well/60 px-2 py-0.5 text-[10px] font-medium text-forge-subtle">
              <Sparkles className="h-3 w-3" aria-hidden />
              pre-seeded
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {checked ? (
          <>
            {REASON_OPTIONS.map((opt) => {
              const selected = row.reason === opt.value;
              return (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => onSetReason(opt.value)}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider transition",
                    selected
                      ? opt.tone
                      : "border-forge-border bg-forge-well text-forge-subtle hover:border-forge-border-strong hover:text-forge-body",
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => onSetReason(null)}
              className="ml-1 inline-flex items-center gap-1 rounded-full border border-forge-border px-2 py-0.5 text-[10px] font-medium text-forge-subtle transition hover:border-accent-red/40 hover:text-accent-red"
              aria-label="Remove carve-out"
            >
              <X className="h-3 w-3" aria-hidden />
              Clear
            </button>
          </>
        ) : (
          <span className="text-[11px] italic text-forge-subtle">
            Click the checkbox to add a carve-out reason
          </span>
        )}
      </div>
    </li>
  );
}

function ReasonMix({
  counts,
}: {
  counts: ReturnType<typeof useStrictCarveOuts>["counts"];
}) {
  const parts: string[] = [];
  if (counts.Editorial) parts.push(`${counts.Editorial} Editorial`);
  if (counts.Talent) parts.push(`${counts.Talent} Talent`);
  if (counts.SOX) parts.push(`${counts.SOX} SOX`);
  if (counts.Sales) parts.push(`${counts.Sales} Sales`);
  return <span className="font-mono text-forge-subtle">{parts.join(" · ")}</span>;
}

// ---------------------------------------------------------------------------
//   Section 2 — GCC locations
// ---------------------------------------------------------------------------

function LocationsSection({
  api,
  isOpen,
  onToggle,
}: {
  api: ReturnType<typeof useOffshoreAssumptions>;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const [showResetConfirm, setShowResetConfirm] = React.useState(false);
  const a = api.assumptions;

  return (
    <>
    <SectionAccordion
      index={2}
      icon={<MapPin className="h-4 w-4" aria-hidden />}
      title="GCC locations"
      subtitle={
        api.isDefault
          ? "Default — Bangalore + Pune + Manila"
          : `Custom — ${a.primaryGccCity} + ${a.secondaryGccCity}${a.contactCenterHub === "None" ? "" : ` + ${HUB_LABEL[a.contactCenterHub]}`}`
      }
      action={
        api.isDefault ? null : (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-full border border-forge-border px-3 py-1 text-[11px] font-medium text-forge-body transition hover:border-forge-border-strong hover:text-forge-ink"
            onClick={() => setShowResetConfirm(true)}
          >
            <RotateCcw className="h-3 w-3" aria-hidden />
            Reset to Bangalore + Pune + Manila
          </button>
        )
      }
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <RadioGroup
          label="Primary GCC city"
          subtitle="Tech / engineering / data depth — most GCC scope routes here."
          options={PRIMARY_CITIES}
          value={a.primaryGccCity}
          renderDescription={(c) => CITY_DESCRIPTION[c]}
          conflict={a.secondaryGccCity}
          onChange={api.setPrimaryGcc}
        />
        <RadioGroup
          label="Secondary GCC city"
          subtitle="Finance back-office + HR ops — shared-service hub."
          options={PRIMARY_CITIES}
          value={a.secondaryGccCity}
          renderDescription={(c) => CITY_DESCRIPTION[c]}
          conflict={a.primaryGccCity}
          onChange={api.setSecondaryGcc}
        />
        <RadioGroup
          label="Contact-center hub"
          subtitle="Multi-brand subscriber + customer support."
          options={HUBS}
          value={a.contactCenterHub}
          renderLabel={(h) => HUB_LABEL[h]}
          renderDescription={(h) => HUB_DESCRIPTION[h]}
          onChange={api.setContactCenterHub}
        />
      </div>

      <div className="mt-4 rounded-xl border border-forge-border bg-forge-well/40 p-4 text-[12px] leading-relaxed text-forge-body">
        <span className="mr-1 font-display text-[11px] font-semibold uppercase tracking-wider text-accent-purple-dark/80">
          Routing rules ·
        </span>
        Finance + HR &rarr;{" "}
        <span className="font-mono text-forge-ink">{a.secondaryGccCity}</span>.
        Service-tower contact-center work &rarr;{" "}
        <span className="font-mono text-forge-ink">
          {a.contactCenterHub === "None"
            ? a.primaryGccCity
            : HUB_LABEL[a.contactCenterHub]}
        </span>
        . Everything else &rarr;{" "}
        <span className="font-mono text-forge-ink">{a.primaryGccCity}</span>.
        <span className="mt-1 block text-[11px] text-forge-subtle">
          Per-tower routing override is on the roadmap (see Section 3).
        </span>
      </div>
      </SectionAccordion>

      {showResetConfirm && (
        <ResetConfirmDialog
          title="Reset to default GCC locations?"
          body="This drops your current location overlay so every reference reverts to Bangalore + Pune + Manila."
          onCancel={() => setShowResetConfirm(false)}
          onConfirm={() => {
            api.resetToDefaults();
            setShowResetConfirm(false);
          }}
        />
      )}
    </>
  );
}

function RadioGroup<T extends string>({
  label,
  subtitle,
  options,
  value,
  conflict,
  renderLabel,
  renderDescription,
  onChange,
}: {
  label: string;
  subtitle: string;
  options: readonly T[];
  value: T;
  conflict?: T;
  renderLabel?: (opt: T) => string;
  renderDescription?: (opt: T) => string;
  onChange: (next: T) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold text-forge-ink">{label}</legend>
      <p className="text-[11px] text-forge-subtle">{subtitle}</p>
      <div className="space-y-1.5">
        {options.map((opt) => {
          const selected = value === opt;
          const conflicting = conflict === opt;
          return (
            <button
              type="button"
              key={opt}
              role="radio"
              aria-checked={selected}
              disabled={conflicting && !selected}
              onClick={() => onChange(opt)}
              className={cn(
                "group flex w-full items-start gap-2 rounded-xl border px-3 py-2 text-left transition",
                selected
                  ? "border-accent-purple bg-accent-purple/5 ring-1 ring-accent-purple/20"
                  : conflicting
                    ? "cursor-not-allowed border-forge-border bg-forge-well/30 opacity-50"
                    : "border-forge-border bg-forge-well hover:border-forge-border-strong hover:bg-forge-surface",
              )}
            >
              <span
                className={cn(
                  "mt-1 inline-flex h-3.5 w-3.5 flex-none items-center justify-center rounded-full border-2 transition",
                  selected
                    ? "border-accent-purple bg-accent-purple"
                    : "border-forge-border-strong bg-forge-surface",
                )}
              >
                {selected && <span className="h-1 w-1 rounded-full bg-white" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-forge-ink">
                  {renderLabel ? renderLabel(opt) : opt}
                  {conflicting && (
                    <span className="ml-2 text-[10px] uppercase tracking-wider text-forge-subtle">
                      taken by other slot
                    </span>
                  )}
                </span>
                {renderDescription && (
                  <span className="mt-0.5 block text-[11px] leading-relaxed text-forge-subtle">
                    {renderDescription(opt)}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
//   Section 3 — Coming next
// ---------------------------------------------------------------------------

function ComingNextSection({
  isOpen,
  onToggle,
}: {
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <SectionAccordion
      index={3}
      icon={<Info className="h-4 w-4" aria-hidden />}
      title="Other assumptions"
      subtitle="Coming next — the editable surface will grow here as more inputs become tunable."
      isOpen={isOpen}
      onToggle={onToggle}
      tone="dashed"
    >
      <ul className="grid gap-2 text-[12px] text-forge-subtle sm:grid-cols-2">
        {[
          "Wave gating dates & TSA windows",
          "Governance overlay names (steering committee, sponsors, lead pairings)",
          "LLM model + prompt version selection",
          "Per-tower routing override (Service Ops in Chennai, etc.)",
          "Transition cost tier overrides",
          "Risk-register weighting & owner assignments",
        ].map((item) => (
          <li key={item} className="flex items-center gap-2">
            <ChevronRight className="h-3 w-3 flex-none text-forge-subtle/70" aria-hidden />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </SectionAccordion>
  );
}

// ---------------------------------------------------------------------------
//   Shared primitives
// ---------------------------------------------------------------------------

/**
 * Top-level accordion wrapper for an Assumptions sub-category. The header
 * is always visible and clickable; the body collapses with a Framer Motion
 * height + opacity animation. Click handlers on `action` (e.g. Reset
 * buttons) stop propagation so users can hit the action without
 * accidentally toggling the accordion.
 *
 * Tone variants:
 *   - "default" — solid surface, used for editable sections.
 *   - "dashed"  — dashed border on a well background, used for the
 *     placeholder "Other assumptions" roadmap section.
 */
function SectionAccordion({
  index,
  icon,
  title,
  subtitle,
  action,
  isOpen,
  onToggle,
  tone = "default",
  children,
}: {
  index: number;
  icon: React.ReactNode;
  title: string;
  subtitle: React.ReactNode;
  action?: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  tone?: "default" | "dashed";
  children: React.ReactNode;
}) {
  const isDashed = tone === "dashed";
  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border bg-forge-surface transition",
        isDashed
          ? "border-dashed border-forge-border bg-forge-well/30 shadow-none"
          : isOpen
            ? "border-accent-purple/40 shadow-sm ring-1 ring-accent-purple/10"
            : "border-forge-border shadow-sm",
      )}
    >
      <div
        className={cn(
          "flex flex-wrap items-start justify-between gap-3 px-5 py-4 transition",
          isOpen && !isDashed && "bg-accent-purple/5",
          !isOpen && !isDashed && "hover:bg-forge-well/40",
        )}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          className="flex flex-1 items-start gap-2.5 text-left"
        >
          <span className="mt-0.5 inline-flex h-6 w-6 flex-none items-center justify-center rounded-full border border-accent-purple/30 bg-accent-purple/5 text-[11px] font-semibold text-accent-purple-dark">
            {index}
          </span>
          <span className="mt-1 flex-none text-accent-purple-dark">{icon}</span>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-base font-semibold text-forge-ink">
              {title}
            </h3>
            <p className="mt-0.5 text-[12px] leading-relaxed text-forge-subtle">
              {subtitle}
            </p>
          </div>
          <span
            className={cn(
              "ml-1 mt-0.5 inline-flex h-6 w-6 flex-none items-center justify-center text-forge-subtle transition",
              isOpen && "text-accent-purple-dark",
            )}
            aria-hidden
          >
            {isOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </span>
        </button>
        {action && (
          <div
            // Keep clicks on the action button (e.g. Reset) from bubbling
            // up to the toggle button — otherwise opening the dialog would
            // also collapse / re-open the section.
            onClick={(e) => e.stopPropagation()}
            className="flex flex-none items-center pt-0.5"
          >
            {action}
          </div>
        )}
      </div>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            style={{ overflow: "hidden" }}
          >
            <div
              className={cn(
                "border-t px-5 pb-5 pt-4",
                isDashed ? "border-forge-border/60" : "border-forge-border",
              )}
            >
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function ResetConfirmDialog({
  title,
  body,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-near-black/60 px-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-2xl border border-forge-border bg-forge-surface p-5 shadow-xl">
        <h4 className="font-display text-base font-semibold text-forge-ink">
          {title}
        </h4>
        <p className="mt-2 text-sm leading-relaxed text-forge-body">{body}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-forge-border px-3 py-1.5 text-sm font-medium text-forge-body transition hover:border-forge-border-strong hover:text-forge-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-full border border-accent-red/40 bg-accent-red/10 px-3 py-1.5 text-sm font-semibold text-accent-red transition hover:bg-accent-red/15"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
