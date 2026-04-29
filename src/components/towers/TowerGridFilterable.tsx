"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import type { Tower } from "@/data/types";
import { TowerGrid } from "./TowerGrid";
import type { TowerId } from "@/data/assess/types";
import { getAssessProgram, getAssessProgramHydrationSnapshot, subscribe } from "@/lib/localStore";
import { LeadDeadlineChip } from "@/components/program/LeadDeadlineChip";

function matches(tower: Tower, q: string) {
  if (!q) return true;
  const needle = q.toLowerCase();
  const haystacks = [
    tower.name,
    tower.topOpportunityHeadline,
    ...tower.versantLeads,
    ...tower.accentureLeads,
  ];
  return haystacks.some((h) => h.toLowerCase().includes(needle));
}

export function TowerGridFilterable({ towers }: { towers: Tower[] }) {
  const [q, setQ] = React.useState("");
  const [program, setProgram] = React.useState(() => getAssessProgramHydrationSnapshot());

  React.useEffect(() => {
    setProgram(getAssessProgram());
    return subscribe("assessProgram", () => setProgram(getAssessProgram()));
  }, []);

  const filtered = React.useMemo(() => towers.filter((t) => matches(t, q)), [towers, q]);

  const footerByTowerId = React.useMemo(() => {
    const out: Partial<Record<string, React.ReactNode>> = {};
    for (const t of filtered) {
      out[t.id] = (
        <LeadDeadlineChip
          towerName={t.name}
          towerId={t.id as TowerId}
          step={4}
          program={program}
        />
      );
    }
    return out;
  }, [filtered, program]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-forge-ink">Tower overview</h2>
          <p className="mt-1 text-xs text-forge-hint">
            Click a card to drill into that tower&apos;s roadmap, processes, and agents.
          </p>
        </div>
        <label className="relative w-full sm:w-80">
          <span className="sr-only">Find your tower</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-forge-hint"
            aria-hidden
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find by tower, lead name, or keyword"
            className="w-full rounded-lg border border-forge-border bg-forge-surface py-2 pl-9 pr-9 text-sm text-forge-ink shadow-sm placeholder:text-forge-hint focus:border-accent-purple focus:outline-none focus:ring-2 focus:ring-accent-purple/20"
          />
          {q ? (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-forge-hint transition hover:bg-forge-well hover:text-forge-ink"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-forge-border bg-forge-well/60 p-10 text-center">
          <div className="font-display text-sm font-semibold text-forge-ink">
            No towers match &ldquo;{q}&rdquo;
          </div>
          <p className="mt-1 text-xs text-forge-subtle">
            Try a tower name, a Versant or Accenture lead, or a keyword like &ldquo;finance&rdquo;.
          </p>
          <button
            type="button"
            onClick={() => setQ("")}
            className="mt-4 inline-flex items-center gap-1 rounded-lg border border-forge-border bg-forge-surface px-3 py-1.5 text-xs font-medium text-forge-body hover:border-accent-purple/40 hover:text-accent-purple-dark"
          >
            Clear search
          </button>
        </div>
      ) : (
        <TowerGrid towers={filtered} footerByTowerId={footerByTowerId} />
      )}
    </div>
  );
}
