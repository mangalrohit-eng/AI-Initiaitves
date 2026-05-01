"use client";

import * as React from "react";
import {
  getAssessProgram,
  getAssessProgramHydrationSnapshot,
  setTowerAssess,
  subscribe,
  updateAssessProgram,
} from "@/lib/localStore";
import {
  seedStrictCarveOuts,
  type StrictCarveOutReason,
} from "@/lib/offshore/strictCarveOutKeywords";
import type {
  AssessProgramV2,
  L3WorkforceRow,
  TowerId,
} from "@/data/assess/types";
import { towers } from "@/data/towers";

/**
 * Per-row strict carve-out summary surfaced to UI.
 */
export type StrictCarveOutRowView = {
  rowId: string;
  towerId: TowerId;
  towerName: string;
  l2: string;
  l3: string;
  /** Total onshore + offshore headcount on the row — for sort + display. */
  totalHeadcount: number;
  /** Step-2 dial value (if set) — drives the "X% — overridden" conflict chip. */
  dialPct: number | null;
  reason: StrictCarveOutReason | null;
  setBy: "user" | "seed" | null;
  setAt?: string;
};

export type CarveOutCounts = {
  total: number;
  Editorial: number;
  Talent: number;
  SOX: number;
  Sales: number;
};

export type UseStrictCarveOutsApi = {
  rows: StrictCarveOutRowView[];
  counts: CarveOutCounts;
  /**
   * Toggle a row. Pass `reason: null` to clear the carve-out, or a reason to
   * set / change it. Always written with `setBy: "user"` so the seed-tag
   * never overrides a deliberate user choice.
   */
  setReason: (rowId: string, reason: StrictCarveOutReason | null) => void;
  /**
   * Re-seed every row from the keyword library. Existing user-set rows are
   * REPLACED — the user's manual edits are lost. The Assumptions-tab UI
   * gates this behind a confirm.
   */
  resetToKeywordDefaults: () => void;
  /**
   * Whether any flag has been written yet — falsy means we still need to
   * run the first-mount seed.
   */
  hasAnyFlag: boolean;
};

/**
 * Step-5 strict carve-out store hook.
 *
 *   - Reads `program.towers[*].l4Rows[*].offshoreStrictCarveOut`.
 *   - Writes via `setTowerAssess` so the existing AssessSyncProvider flushes
 *     to the server.
 *   - Auto-seeds on first mount (when no row has a flag yet) using
 *     `seedStrictCarveOuts(program)`. Each seed write is tagged
 *     `setBy: "seed"` so the UI can show a "Pre-seeded" indicator.
 */
export function useStrictCarveOuts(): UseStrictCarveOutsApi {
  const [program, setProgram] = React.useState<AssessProgramV2>(() =>
    getAssessProgramHydrationSnapshot(),
  );
  React.useEffect(() => {
    setProgram(getAssessProgram());
    return subscribe("assessProgram", () => setProgram(getAssessProgram()));
  }, []);

  // Build the row view + counts from the subscribed program.
  const { rows, counts, hasAnyFlag } = React.useMemo(() => {
    const rs: StrictCarveOutRowView[] = [];
    const c: CarveOutCounts = { total: 0, Editorial: 0, Talent: 0, SOX: 0, Sales: 0 };
    let any = false;
    for (const tower of towers) {
      const towerId = tower.id as TowerId;
      const state = program.towers[towerId];
      if (!state || state.l4Rows.length === 0) continue;
      for (const r of state.l4Rows) {
        const flag = r.offshoreStrictCarveOut;
        const reason = flag?.reason ?? null;
        const setBy = flag?.setBy ?? null;
        if (flag) {
          any = true;
          c.total += 1;
          c[flag.reason] += 1;
        }
        rs.push({
          rowId: r.id,
          towerId,
          towerName: tower.name,
          l2: r.l2,
          l3: r.l3,
          totalHeadcount:
            (r.fteOnshore ?? 0) +
            (r.fteOffshore ?? 0) +
            (r.contractorOnshore ?? 0) +
            (r.contractorOffshore ?? 0),
          dialPct:
            typeof r.offshoreAssessmentPct === "number"
              ? r.offshoreAssessmentPct
              : null,
          reason,
          setBy,
          setAt: flag?.setAt,
        });
      }
    }
    return { rows: rs, counts: c, hasAnyFlag: any };
  }, [program]);

  const setReason = React.useCallback(
    (rowId: string, reason: StrictCarveOutReason | null) => {
      // Find the row's tower so we can patch via setTowerAssess.
      const cur = getAssessProgram();
      let foundTower: TowerId | null = null;
      for (const tower of towers) {
        const towerId = tower.id as TowerId;
        const state = cur.towers[towerId];
        if (!state) continue;
        if (state.l4Rows.some((r) => r.id === rowId)) {
          foundTower = towerId;
          break;
        }
      }
      if (!foundTower) return;
      const towerState = cur.towers[foundTower];
      if (!towerState) return;
      const nextRows = towerState.l4Rows.map((r) => {
        if (r.id !== rowId) return r;
        if (reason == null) {
          // Clear the flag — strip the field rather than leave undefined.
          const { offshoreStrictCarveOut: _drop, ...rest } = r;
          void _drop;
          return rest as L3WorkforceRow;
        }
        return {
          ...r,
          offshoreStrictCarveOut: {
            reason,
            setAt: new Date().toISOString(),
            setBy: "user" as const,
          },
        };
      });
      setTowerAssess(foundTower, { l4Rows: nextRows });
    },
    [],
  );

  const resetToKeywordDefaults = React.useCallback(() => {
    const cur = getAssessProgram();
    const seeds = seedStrictCarveOuts(cur);
    const seedsByTower = new Map<TowerId, Map<string, StrictCarveOutReason>>();
    for (const s of seeds) {
      let m = seedsByTower.get(s.towerId);
      if (!m) {
        m = new Map();
        seedsByTower.set(s.towerId, m);
      }
      m.set(s.rowId, s.reason);
    }
    const now = new Date().toISOString();
    updateAssessProgram((p) => {
      const nextTowers: AssessProgramV2["towers"] = {};
      for (const [k, state] of Object.entries(p.towers)) {
        if (!state) continue;
        const towerId = k as TowerId;
        const seedMap = seedsByTower.get(towerId);
        const nextRows = state.l4Rows.map((r) => {
          const seedReason = seedMap?.get(r.id) ?? null;
          if (seedReason == null) {
            const { offshoreStrictCarveOut: _drop, ...rest } = r;
            void _drop;
            return rest as L3WorkforceRow;
          }
          return {
            ...r,
            offshoreStrictCarveOut: {
              reason: seedReason,
              setAt: now,
              setBy: "seed" as const,
            },
          };
        });
        nextTowers[towerId] = { ...state, l4Rows: nextRows };
      }
      return { ...p, towers: nextTowers };
    });
  }, []);

  // First-mount auto-seed: only if NO row carries a flag.
  const seededRef = React.useRef(false);
  React.useEffect(() => {
    if (seededRef.current) return;
    if (hasAnyFlag) {
      seededRef.current = true;
      return;
    }
    // Run after hydration so we don't trigger the seed during SSR.
    const cur = getAssessProgram();
    // Re-check on the live program — `program` from subscribe might be the
    // hydration snapshot.
    let liveAny = false;
    for (const tower of towers) {
      const tid = tower.id as TowerId;
      const ts = cur.towers[tid];
      if (!ts) continue;
      if (ts.l4Rows.some((r) => r.offshoreStrictCarveOut)) {
        liveAny = true;
        break;
      }
    }
    if (liveAny) {
      seededRef.current = true;
      return;
    }
    const seeds = seedStrictCarveOuts(cur);
    if (seeds.length === 0) {
      seededRef.current = true;
      return;
    }
    const seedsByTower = new Map<TowerId, Map<string, StrictCarveOutReason>>();
    for (const s of seeds) {
      let m = seedsByTower.get(s.towerId);
      if (!m) {
        m = new Map();
        seedsByTower.set(s.towerId, m);
      }
      m.set(s.rowId, s.reason);
    }
    const now = new Date().toISOString();
    updateAssessProgram((p) => {
      const nextTowers: AssessProgramV2["towers"] = {};
      for (const [k, state] of Object.entries(p.towers)) {
        if (!state) continue;
        const towerId = k as TowerId;
        const seedMap = seedsByTower.get(towerId);
        if (!seedMap) {
          nextTowers[towerId] = state;
          continue;
        }
        const nextRows = state.l4Rows.map((r) => {
          const seedReason = seedMap.get(r.id);
          if (!seedReason) return r;
          // Don't overwrite an existing flag — defensive guard.
          if (r.offshoreStrictCarveOut) return r;
          return {
            ...r,
            offshoreStrictCarveOut: {
              reason: seedReason,
              setAt: now,
              setBy: "seed" as const,
            },
          };
        });
        nextTowers[towerId] = { ...state, l4Rows: nextRows };
      }
      return { ...p, towers: nextTowers };
    });
    seededRef.current = true;
  }, [hasAnyFlag]);

  return { rows, counts, setReason, resetToKeywordDefaults, hasAnyFlag };
}
