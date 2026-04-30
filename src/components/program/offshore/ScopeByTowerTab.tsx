"use client";

import * as React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { AssessProgramV2 } from "@/data/assess/types";
import type {
  CarveOutClass,
  OffshoreL3Row,
  OffshorePlanResult,
  OffshoreTowerSummary,
} from "@/lib/offshore/selectOffshorePlan";
import {
  Chip,
  carveOutClassAccent,
  carveOutClassLabel,
  destinationLabel,
  fmtInt,
} from "./offshoreLabels";

type PlanWithProgram = OffshorePlanResult & { program: AssessProgramV2 };

const LANE_ORDER: CarveOutClass[] = [
  "GccEligible",
  "GccWithOverlay",
  "OnshoreRetained",
  "EditorialCarveOut",
];

/**
 * Scope by tower — every L3 row, classified into one of four lanes:
 *   - GCC-eligible (transactional, repeatable)
 *   - GCC + onshore overlay (US business-hour or face-to-face touch points)
 *   - Onshore retained (judgment / relationship / executive)
 *   - Editorial / talent carve-out (Brian Carovillano veto)
 *
 * Tower cards are expandable. The 15-word `offshoreRationale` from Step 2
 * surfaces inline so each row reads as Versant-grounded, not consulting
 * fluff. Per-row movable / retained headcount is shown so this tab and
 * the Org Transition tab reconcile to the same numbers.
 */
export function ScopeByTowerTab({ plan }: { plan: PlanWithProgram }) {
  const [open, setOpen] = React.useState<Set<string>>(() => {
    // Default-open the top-3 towers by movable HC so the page reads useful on first load.
    return new Set(plan.towerSummaries.slice(0, 3).map((t) => t.towerId));
  });
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="space-y-4">
      <header>
        <h2 className="font-display text-lg font-semibold text-forge-ink">
          <span className="font-mono text-accent-purple-dark">&gt;</span>{" "}
          Scope by tower — L3 rows in four lanes
        </h2>
        <p className="mt-1 text-sm text-forge-subtle">
          Each L3 row is classified by a three-step cascade: user-set carve-outs
          first, then LLM lane judgment when the offshore plan has been
          generated, then a deterministic heuristic on the Step-2 dial.
          Reconciles to the same headcount shown in the Org Transition tab.
        </p>
      </header>

      <div className="space-y-3">
        {plan.towerSummaries.map((t) => (
          <TowerCard
            key={t.towerId}
            program={plan.program}
            tower={t}
            isOpen={open.has(t.towerId)}
            onToggle={() => toggle(t.towerId)}
          />
        ))}
      </div>
    </div>
  );
}

function TowerCard({
  program,
  tower,
  isOpen,
  onToggle,
}: {
  program: AssessProgramV2;
  tower: OffshoreTowerSummary;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const lanes = bucketByLane(tower.rows);
  return (
    <article className="overflow-hidden rounded-2xl border border-forge-border bg-forge-surface">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-3 px-5 py-4 text-left hover:bg-forge-well/40"
      >
        <span className="mt-1 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center text-forge-hint">
          {isOpen ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="font-display text-base font-semibold text-forge-ink">
              {tower.towerName}
            </h3>
            <span className="text-[11px] text-forge-subtle">
              {tower.recommendedScope}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {LANE_ORDER.map((lane) => {
              const count = lanes[lane].length;
              if (count === 0) return null;
              const a = carveOutClassAccent(lane);
              const movable = lanes[lane].reduce(
                (s, r) => s + r.movableFte + r.movableContractor,
                0,
              );
              return (
                <Chip
                  key={lane}
                  border={a.border}
                  bg={a.bg}
                  text={a.text}
                >
                  <span className={`mr-1 inline-block h-1 w-1 rounded-full ${a.dot}`} aria-hidden />
                  {carveOutClassLabel(lane)} · <span className="font-mono">{count}</span>
                  {movable > 0 ? (
                    <span className="ml-1 font-mono">({fmtInt(movable)} HC)</span>
                  ) : null}
                </Chip>
              );
            })}
          </div>
        </div>
        <div className="flex flex-col items-end gap-0.5 text-right">
          <div className="font-mono text-sm font-semibold text-accent-purple-dark">
            {fmtInt(tower.migratingToGcc + tower.migratingToManila)}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-forge-hint">
            to GCC
          </div>
        </div>
      </button>

      {isOpen ? (
        <div className="border-t border-forge-border px-5 pb-5 pt-3">
          {LANE_ORDER.map((lane) => {
            const rows = lanes[lane];
            if (rows.length === 0) return null;
            return (
              <Lane key={lane} program={program} laneClass={lane} rows={rows} />
            );
          })}
        </div>
      ) : null}
    </article>
  );
}

function Lane({
  program,
  laneClass,
  rows,
}: {
  program: AssessProgramV2;
  laneClass: CarveOutClass;
  rows: OffshoreL3Row[];
}) {
  const a = carveOutClassAccent(laneClass);
  return (
    <section className="mt-4">
      <header className="flex items-center gap-2">
        <span className={`inline-block h-2 w-2 rounded-full ${a.dot}`} aria-hidden />
        <h4 className={`font-display text-xs font-semibold uppercase tracking-wider ${a.text}`}>
          {carveOutClassLabel(laneClass)}
        </h4>
        <span className="text-[10px] text-forge-hint">
          {rows.length} row{rows.length === 1 ? "" : "s"}
        </span>
      </header>
      <div className="mt-2 overflow-x-auto rounded-xl border border-forge-border">
        <table className="min-w-full text-xs">
          <thead className="bg-forge-well/60 text-[10px] font-semibold uppercase tracking-wider text-forge-subtle">
            <tr>
              <th className="px-3 py-2 text-left">L2 · L3</th>
              <th className="px-3 py-2 text-left">Destination · provenance</th>
              <th className="px-3 py-2 text-right">Movable HC</th>
              <th className="px-3 py-2 text-right">Retained HC</th>
              <th className="px-3 py-2 text-left">Rationale</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const movable = r.movableFte + r.movableContractor;
              const retained = r.retainedFte + r.retainedContractor;
              return (
                <tr
                  key={r.rowId}
                  className="border-t border-forge-border align-top"
                >
                  <td className="px-3 py-2">
                    <div className="font-medium text-forge-ink">{r.l3}</div>
                    <div className="mt-0.5 text-[10px] text-forge-subtle">
                      {r.l2}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="space-y-1">
                      <span className="text-[11px] text-forge-body">
                        {destinationLabel(r.destination, program)}
                      </span>
                      {r.wave !== null ? (
                        <span className="ml-1.5 text-[10px] font-medium uppercase tracking-wider text-forge-hint">
                          Wave {r.wave}
                        </span>
                      ) : null}
                      <div>
                        <ProvenanceChip row={r} />
                      </div>
                      {r.carveOutReason && (
                        <div className="text-[10px] uppercase tracking-wider text-forge-subtle">
                          reason: {r.carveOutReason}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    <span
                      className={
                        movable > 0
                          ? "text-accent-purple-dark"
                          : "text-forge-hint"
                      }
                    >
                      {fmtInt(movable)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-forge-body">
                    {fmtInt(retained)}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-forge-body">
                    {r.justification ?? r.offshoreRationale ?? "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ProvenanceChip({ row }: { row: OffshoreL3Row }) {
  const tone = (() => {
    switch (row.classificationSource) {
      case "user-carve-out":
        return {
          border: "border-accent-purple/30",
          bg: "bg-accent-purple/5",
          text: "text-accent-purple-dark",
          label: "User carve-out",
        };
      case "seeded-carve-out":
        return {
          border: "border-forge-border",
          bg: "bg-forge-well/60",
          text: "text-forge-subtle",
          label: "Pre-seeded",
        };
      case "llm":
        return {
          border: "border-accent-teal/30",
          bg: "bg-accent-teal/5",
          text: "text-accent-teal",
          label: "LLM",
        };
      case "heuristic":
        return {
          border: "border-forge-border",
          bg: "bg-forge-well/60",
          text: "text-forge-subtle",
          label: "Heuristic",
        };
    }
  })();
  return (
    <Chip border={tone.border} bg={tone.bg} text={tone.text}>
      {tone.label}
    </Chip>
  );
}

function bucketByLane(
  rows: OffshoreL3Row[],
): Record<CarveOutClass, OffshoreL3Row[]> {
  const buckets: Record<CarveOutClass, OffshoreL3Row[]> = {
    GccEligible: [],
    GccWithOverlay: [],
    OnshoreRetained: [],
    EditorialCarveOut: [],
  };
  for (const r of rows) buckets[r.carveOut].push(r);
  return buckets;
}
