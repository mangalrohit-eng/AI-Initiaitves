import { getCapabilityMapForTower } from "@/data/capabilityMap/maps";
import type { CapabilityMapDefinition } from "@/data/capabilityMap/types";
import { towers } from "@/data/towers";
import { weightedTowerLevers } from "@/lib/assess/scenarioModel";
import type { AssessProgramV2, L3WorkforceRow, TowerAssessState, TowerId } from "./types";
import { defaultGlobalAssessAssumptions, defaultTowerBaseline } from "./types";
import { inferL3Defaults } from "./seedAssessmentDefaults";

/**
 * Seeded with illustrative, workshop-only data — not Versant-reported. No offshore
 * FTE/contractor in the footprint; baseline offshore dial for scenarios starts at 0.
 */
export const ASSESS_SEED_REFERENCE_AT = "2026-01-15T00:00:00.000Z";

/** Per-tower onshore FTE and contractor (illustrative) — mid-range for ~1k–5k-employee org. */
const TOWER_HEADCOUNT: Record<TowerId, { fte: number; contractor: number }> = {
  finance: { fte: 200, contractor: 30 },
  hr: { fte: 95, contractor: 20 },
  "research-analytics": { fte: 80, contractor: 10 },
  legal: { fte: 40, contractor: 5 },
  "corp-services": { fte: 80, contractor: 10 },
  "tech-engineering": { fte: 220, contractor: 50 },
  "operations-technology": { fte: 180, contractor: 25 },
  sales: { fte: 170, contractor: 20 },
  "marketing-comms": { fte: 120, contractor: 12 },
  service: { fte: 90, contractor: 8 },
  "editorial-news": { fte: 200, contractor: 30 },
  production: { fte: 180, contractor: 25 },
  "programming-dev": { fte: 170, contractor: 15 },
};

/**
 * Per-tower hint of which L2 buckets house the bulk of contractor labor (used to seed
 * starter contractor counts in the right places). Optional — falls back to round-robin
 * across all rows if not provided or no rows match.
 */
const CONTRACTOR_L2_HINT: Partial<Record<TowerId, string[]>> = {
  hr: ["HR Services"],
  finance: ["Procurement & Vendor Management", "Record to Report"],
  "tech-engineering": ["Software Engineering", "AI / ML Platform"],
  "operations-technology": ["Broadcast Engineering"],
  production: ["Post-Production", "Remote & Field Production"],
  "editorial-news": ["Audio & Podcast Production", "News Production — Digital & Live"],
  "marketing-comms": ["Brand Marketing & Events", "Social Media & Content Distribution"],
  service: ["Customer Support Operations"],
  sales: ["Advertising Sales"],
  "research-analytics": ["Audience Measurement & Identity"],
  legal: ["Contracts & Transactions"],
  "corp-services": ["Facilities & Real Estate", "Procurement & Vendor Operations"],
  "programming-dev": ["Content Development & Greenlight", "Content Acquisition & Licensing"],
};

/**
 * Walk a capability map definition into per-L3 workforce rows. Each row gets
 * the canonical L4 names (display-only `l4Activities`) but no headcount yet.
 * Headcount and dials are layered on by `applyHeadcountToRows` / `withL3Defaults`.
 */
function flattenCapabilityMap(map: CapabilityMapDefinition): L3WorkforceRow[] {
  const rows: L3WorkforceRow[] = [];
  for (const l2 of map.l2) {
    for (const l3 of l2.l3) {
      rows.push({
        id: l3.id,
        l2: l2.name,
        l3: l3.name,
        fteOnshore: 0,
        fteOffshore: 0,
        contractorOnshore: 0,
        contractorOffshore: 0,
        l4Activities: l3.l4.map((x) => x.name),
      });
    }
  }
  return rows;
}

/** Spread `total` evenly across `n` slots, with the first `remainder` slots getting +1. */
function evenSpread(total: number, n: number): number[] {
  if (n === 0) return [];
  const base = Math.floor(total / n);
  const rem = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0));
}

/** Distribute FTE across all L3 rows; concentrate contractor in hint L2s when present. */
function applyHeadcountToRows(
  rows: L3WorkforceRow[],
  fte: number,
  contractor: number,
  contractorL2Hint?: string[],
): L3WorkforceRow[] {
  if (rows.length === 0) return rows;

  const fteSpread = evenSpread(fte, rows.length);
  for (let i = 0; i < rows.length; i++) {
    rows[i].fteOnshore = fteSpread[i];
  }

  if (contractor > 0) {
    const hintRows: number[] = [];
    if (contractorL2Hint && contractorL2Hint.length > 0) {
      for (let i = 0; i < rows.length; i++) {
        if (contractorL2Hint.includes(rows[i].l2)) hintRows.push(i);
      }
    }
    const targetRows =
      hintRows.length > 0 ? hintRows : Array.from({ length: rows.length }, (_, i) => i);
    const conSpread = evenSpread(contractor, targetRows.length);
    for (let k = 0; k < targetRows.length; k++) {
      rows[targetRows[k]].contractorOnshore = conSpread[k];
    }
  }

  return rows;
}

/**
 * Apply Versant-aware starter offshore% / AI% to every L3 row. Rounded to the
 * nearest 5 so seeded sliders sit on tidy positions. Tower leads can adjust
 * each L3 dial individually on the Configure Impact Levers page.
 */
function withL3Defaults(rows: L3WorkforceRow[], towerId: TowerId): L3WorkforceRow[] {
  return rows.map((r) => {
    const d = inferL3Defaults(towerId, r.l2, r.l3);
    return {
      ...r,
      offshoreAssessmentPct: Math.round(d.offshorePct / 5) * 5,
      aiImpactAssessmentPct: Math.round(d.aiPct / 5) * 5,
    };
  });
}

/**
 * L3 sample rows for one tower (used by the seeded program and by sample downloads).
 * No offshore FTE/contractor — the workshop fills that via the offshore lever.
 * Each row carries a workshop-starter `offshoreAssessmentPct` / `aiImpactAssessmentPct`
 * plus the canonical `l4Activities` list for display in the capability map.
 */
export function getTowerSeedRows(towerId: TowerId): L3WorkforceRow[] {
  const map = getCapabilityMapForTower(towerId);
  if (!map) return [];
  const tw = towers.find((t) => t.id === towerId);
  if (!tw) return [];
  const { fte, contractor } = TOWER_HEADCOUNT[towerId] ?? { fte: 50, contractor: 5 };
  const flat = flattenCapabilityMap(map);
  const sized = applyHeadcountToRows(flat, fte, contractor, CONTRACTOR_L2_HINT[towerId]);
  return withL3Defaults(sized, towerId);
}

/**
 * Full per-tower starter state: rows with L3 assessments, plus baseline computed as the
 * cost-weighted roll-up of those assessments (so the baseline matches what the summary
 * shows for the seeded scenario).
 */
export function getTowerSeedState(towerId: TowerId): TowerAssessState {
  const rows = getTowerSeedRows(towerId);
  if (rows.length === 0) {
    return {
      l3Rows: rows,
      baseline: { ...defaultTowerBaseline },
      status: "empty",
      lastUpdated: ASSESS_SEED_REFERENCE_AT,
    };
  }
  const w = weightedTowerLevers(
    rows,
    defaultTowerBaseline,
    defaultGlobalAssessAssumptions,
  );
  // Seed rows are illustrative — they land towers at "data" (rows present,
  // not signed off). Only an explicit Mark-complete on the Configure Impact Levers page
  // should promote a tower to "complete". Otherwise the hub falsely reads
  // "Reviewed by Tower Lead" before any human review has happened.
  return {
    l3Rows: rows,
    baseline: {
      baselineOffshorePct: Math.round(w.offshorePct),
      baselineAIPct: Math.round(w.aiPct),
    },
    status: "data",
    lastUpdated: ASSESS_SEED_REFERENCE_AT,
  };
}

export function buildSeededAssessProgramV2(): AssessProgramV2 {
  const tmap: Partial<Record<TowerId, TowerAssessState>> = {};
  for (const tw of towers) {
    const id = tw.id as TowerId;
    tmap[id] = getTowerSeedState(id);
  }
  return {
    version: 4,
    towers: tmap,
    global: { ...defaultGlobalAssessAssumptions },
  };
}
