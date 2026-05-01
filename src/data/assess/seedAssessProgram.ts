import { getCapabilityMapForTower } from "@/data/capabilityMap/maps";
import type { CapabilityMapDefinition } from "@/data/capabilityMap/types";
import { towers } from "@/data/towers";
import { weightedTowerLevers } from "@/lib/assess/scenarioModel";
import type { AssessProgramV2, L4WorkforceRow, TowerAssessState, TowerId } from "./types";
import {
  buildDefaultProgramLeadDeadlines,
  defaultGlobalAssessAssumptions,
  defaultTowerBaseline,
} from "./types";
import { inferL3Defaults } from "./seedAssessmentDefaults";
import { rowStarterRationale } from "./rowRationale";

/**
 * Seeded headcount — modeled allocation of Versant's reported 3,748 employees
 * (source: `docs/headcount.csv`, 24 locations × ~55 sub-business units).
 *
 * Method: each sub-business in the CSV is mapped to one or more Forge towers
 * (vertically integrated brands like CNBC linear / GolfNow / Fandango span
 * Editorial, Production, Tech, Sales, etc.); pure corporate functions
 * (Versant Finance, HR, Legal, Communications) map 1:1. Tower totals are then
 * apportioned to the capability-map L2 buckets below using qualitative weight-
 * of-effort, anchored to Versant's actual operating context (post-Comcast
 * standup, hyper-hiring, MS NOW progressive positioning, BB- credit, $2.45B
 * programming spend, Fandango / GolfNow / SportsEngine consumer SaaS).
 *
 * Numbers are MODELED estimates, not Versant-reported. Contractor counts are
 * set to 0 — the CSV captures employees only, and tower leads can layer in
 * their actual contractor footprint via the upload flow. Baseline offshore
 * dial for scenarios starts at 0 until tower leads dial it in.
 *
 * Reconciles to 3,745 (~3-person rounding delta vs CSV 3,748).
 */
export const ASSESS_SEED_REFERENCE_AT = "2026-04-26T00:00:00.000Z";

/**
 * Versant's reported total employee headcount per `docs/headcount.csv` (24
 * locations, ~55 sub-business units). Used by the Capability Map scoreboard
 * to render a "gap vs Versant" indicator next to the program-wide FTE total —
 * i.e. how much of the 3,748-person footprint is currently represented in
 * tower-lead-confirmed capability maps.
 *
 * Source-of-truth note: the CSV is employees only (no contractors), so this
 * baseline only compares against onshore + offshore FTE.
 */
export const VERSANT_REPORTED_FTE = 3748;

/** Per-tower onshore FTE and contractor — modeled from `docs/headcount.csv`. */
const TOWER_HEADCOUNT: Record<TowerId, { fte: number; contractor: number }> = {
  finance: { fte: 133, contractor: 0 },
  hr: { fte: 129, contractor: 0 },
  "research-analytics": { fte: 61, contractor: 0 },
  legal: { fte: 57, contractor: 0 },
  "corp-services": { fte: 57, contractor: 0 },
  "tech-engineering": { fte: 689, contractor: 0 },
  "operations-technology": { fte: 200, contractor: 0 },
  sales: { fte: 137, contractor: 0 },
  "marketing-comms": { fte: 366, contractor: 0 },
  service: { fte: 67, contractor: 0 },
  "editorial-news": { fte: 819, contractor: 0 },
  production: { fte: 865, contractor: 0 },
  "programming-dev": { fte: 165, contractor: 0 },
};

/**
 * Per-tower L3-level FTE allocation — keyed by capability-map L3 (Job Family)
 * name. When present, FTE is concentrated in the listed Job Families (then
 * evenly spread across the L4 Activity Group rows within each Job Family).
 * When a tower is omitted here, FTE falls back to an even spread across all
 * L4 rows.
 *
 * Pre-migration this was keyed by L2 (Pillar) names — same string values,
 * since the 5-layer migration renamed Pillar → Job Family (L2 → L3) without
 * splitting any names.
 *
 * Sums for each tower must equal `TOWER_HEADCOUNT[towerId].fte`.
 */
const TOWER_L3_HEADCOUNT: Partial<Record<TowerId, Record<string, number>>> = {
  finance: {
    "Record to Report": 40,
    "Treasury & Capital": 16,
    "Planning & Analysis": 33,
    "Investor Relations": 7,
    "Procurement & Vendor Management": 37,
  },
  hr: {
    HRBPs: 25,
    "Talent Acquisition": 45,
    "L&D": 26,
    "Total Rewards": 19,
    "HR Services": 14,
  },
  "research-analytics": {
    "Audience Measurement & Identity": 21,
    "Content Performance Analytics": 15,
    "Competitive Intelligence": 9,
    "Ad Sales Research": 16,
  },
  legal: {
    "Content Rights & Intellectual Property": 23,
    "Contracts & Transactions": 20,
    "Compliance & Governance": 14,
  },
  "corp-services": {
    "Facilities & Real Estate": 28,
    Security: 17,
    "Procurement & Vendor Operations": 12,
  },
  "tech-engineering": {
    "Infrastructure & Cloud": 172,
    "Software Engineering": 345,
    "AI / ML Platform": 34,
    Cybersecurity: 138,
  },
  "operations-technology": {
    "Master Control & Playout": 80,
    "Signal Distribution": 60,
    "Broadcast Engineering": 60,
  },
  sales: {
    "Advertising Sales": 35,
    "Distribution Sales": 37,
    "DTC & Subscription Sales": 65,
  },
  "marketing-comms": {
    "Social Media & Content Distribution": 92,
    "Performance & Growth Marketing": 92,
    "Brand Marketing & Events": 73,
    "PR & Corporate Communications": 55,
    "Marketing Analytics & Attribution": 54,
  },
  service: {
    "Customer Support Operations": 54,
    "Subscriber Retention & Lifecycle": 13,
  },
  "editorial-news": {
    "News Production — Digital & Live": 574,
    "Investigative & Enterprise Journalism": 65,
    "Audio & Podcast Production": 98,
    "Editorial Standards & Quality": 82,
  },
  production: {
    "Post-Production": 476,
    "Studio Operations": 259,
    "Remote & Field Production": 130,
  },
  "programming-dev": {
    "Linear Programming & Scheduling": 66,
    "Content Development & Greenlight": 58,
    "Content Acquisition & Licensing": 41,
  },
};

/**
 * Per-tower hint of which L3 (Job Family) buckets house the bulk of contractor
 * labor (used to seed starter contractor counts in the right places). Optional
 * — falls back to round-robin across all rows if not provided or no rows match.
 *
 * Currently unused while contractor counts are 0 across the board, but retained
 * so tower-lead uploads of contractor data continue to land in the right Job
 * Family buckets.
 */
const CONTRACTOR_L3_HINT: Partial<Record<TowerId, string[]>> = {
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
 * Walk a capability map definition into per-L4 (Activity Group) workforce
 * rows. Each row gets the canonical L5 Activity names (display-only
 * `l5Activities`) but no headcount yet. Headcount and dials are layered on
 * by `applyHeadcountToRows` / `withL3Defaults`.
 *
 * In the 5-layer model the dummy L2 wrapper is a single Job Grouping per
 * tower (named after the function), so every row in the same map shares the
 * same `l2` value.
 */
function flattenCapabilityMap(map: CapabilityMapDefinition): L4WorkforceRow[] {
  const rows: L4WorkforceRow[] = [];
  for (const l2 of map.l2) {
    for (const l3 of l2.l3) {
      for (const l4 of l3.l4) {
        rows.push({
          id: l4.id,
          l2: l2.name,
          l3: l3.name,
          l4: l4.name,
          fteOnshore: 0,
          fteOffshore: 0,
          contractorOnshore: 0,
          contractorOffshore: 0,
          l5Activities: l4.l5.map((x) => x.name),
        });
      }
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

/**
 * Distribute FTE across L4 Activity Group rows. When `l3Headcount` is
 * provided (preferred — used to honor the modeled per-Job-Family allocation
 * from `TOWER_L3_HEADCOUNT`; map name retained for back-compat), FTE is
 * concentrated in the named Job Families and then evenly spread across the
 * L4 Activity Group rows within each Job Family. Otherwise FTE falls back to
 * an even spread across every row.
 *
 * Contractor counts use the `contractorL3Hint` to concentrate in the right
 * Job Family buckets. With contractor=0 in the seed, this is a no-op today
 * but kept so tower-lead uploads land contractor headcount correctly.
 */
function applyHeadcountToRows(
  rows: L4WorkforceRow[],
  fte: number,
  contractor: number,
  contractorL3Hint?: string[],
  l3Headcount?: Record<string, number>,
): L4WorkforceRow[] {
  if (rows.length === 0) return rows;

  if (l3Headcount && Object.keys(l3Headcount).length > 0) {
    const indicesByL3 = new Map<string, number[]>();
    for (let i = 0; i < rows.length; i++) {
      const l3 = rows[i].l3;
      if (!indicesByL3.has(l3)) indicesByL3.set(l3, []);
      indicesByL3.get(l3)!.push(i);
    }
    let assigned = 0;
    for (const [l3, count] of Object.entries(l3Headcount)) {
      const indices = indicesByL3.get(l3);
      if (!indices || indices.length === 0) continue;
      const spread = evenSpread(count, indices.length);
      for (let k = 0; k < indices.length; k++) {
        rows[indices[k]].fteOnshore = spread[k];
      }
      assigned += count;
    }
    const leftover = fte - assigned;
    if (leftover !== 0) {
      const allIdx = Array.from({ length: rows.length }, (_, i) => i);
      const spread = evenSpread(leftover, allIdx.length);
      for (let k = 0; k < allIdx.length; k++) {
        rows[allIdx[k]].fteOnshore += spread[k];
      }
    }
  } else {
    const fteSpread = evenSpread(fte, rows.length);
    for (let i = 0; i < rows.length; i++) {
      rows[i].fteOnshore = fteSpread[i];
    }
  }

  if (contractor > 0) {
    const hintRows: number[] = [];
    if (contractorL3Hint && contractorL3Hint.length > 0) {
      for (let i = 0; i < rows.length; i++) {
        if (contractorL3Hint.includes(rows[i].l3)) hintRows.push(i);
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
 * Apply Versant-aware starter offshore% / AI% to every L4 Activity Group
 * row. Rounded to the nearest 5 so seeded sliders sit on tidy positions.
 * Tower leads can adjust each dial individually on the Configure Impact
 * Levers page.
 *
 * Each seeded row also gets the deterministic `rowStarterRationale` text
 * baked onto `offshoreRationale` / `aiImpactRationale`, with
 * `dialsRationaleSource: "starter"` so the Configure Impact Levers chip
 * reads "starter" (not "AI-scored") and `getTowerStaleState.dialsStale`
 * doesn't flag sample-loaded data as needing refresh.
 */
function withL3Defaults(rows: L4WorkforceRow[], towerId: TowerId): L4WorkforceRow[] {
  const generatedAt = ASSESS_SEED_REFERENCE_AT;
  return rows.map((r) => {
    // Heuristic still keys off the bucket+row name pair — under the 5-layer
    // model that's (Job Family, Activity Group) = (r.l3, r.l4).
    const d = inferL3Defaults(towerId, r.l3, r.l4);
    const seeded = {
      ...r,
      offshoreAssessmentPct: Math.round(d.offshorePct / 5) * 5,
      aiImpactAssessmentPct: Math.round(d.aiPct / 5) * 5,
    };
    const rationale = rowStarterRationale(towerId, seeded);
    return {
      ...seeded,
      offshoreRationale: rationale.offshore,
      aiImpactRationale: rationale.ai,
      dialsRationaleSource: "starter",
      dialsRationaleAt: generatedAt,
    };
  });
}

/**
 * L4 Activity Group sample rows for one tower (used by the seeded program
 * and by sample downloads). No offshore FTE/contractor — the assessment
 * fills that via the offshore lever. Each row carries a starter
 * `offshoreAssessmentPct` / `aiImpactAssessmentPct` plus the canonical
 * `l5Activities` list for display in the capability map.
 */
export function getTowerSeedRows(towerId: TowerId): L4WorkforceRow[] {
  const map = getCapabilityMapForTower(towerId);
  if (!map) return [];
  const tw = towers.find((t) => t.id === towerId);
  if (!tw) return [];
  const { fte, contractor } = TOWER_HEADCOUNT[towerId] ?? { fte: 50, contractor: 0 };
  const flat = flattenCapabilityMap(map);
  const sized = applyHeadcountToRows(
    flat,
    fte,
    contractor,
    CONTRACTOR_L3_HINT[towerId],
    TOWER_L3_HEADCOUNT[towerId],
  );
  return withL3Defaults(sized, towerId);
}

/**
 * Full per-tower starter state: rows with L4 Activity Group assessments, plus
 * baseline computed as the cost-weighted roll-up of those assessments (so the
 * baseline matches what the summary shows for the seeded scenario).
 */
export function getTowerSeedState(towerId: TowerId): TowerAssessState {
  const rows = getTowerSeedRows(towerId);
  if (rows.length === 0) {
    return {
      l4Rows: rows,
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
    l4Rows: rows,
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
    version: 5,
    towers: tmap,
    global: { ...defaultGlobalAssessAssumptions },
    leadDeadlines: buildDefaultProgramLeadDeadlines(),
  };
}
