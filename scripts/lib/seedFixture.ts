/**
 * SCRIPT-ONLY fixture builder for dev/CI tests. Builds a populated
 * `AssessProgramV2` from the canonical L1–L5 capability map plus modeled
 * Versant headcount, so smoke / consistency / verification scripts have
 * realistic data to exercise.
 *
 * IMPORTANT: This file lives under `scripts/lib/` because the live app no
 * longer ships a sample-seed program. Do NOT import this from `src/` — app
 * code starts empty and is populated by tower-lead uploads or by syncing
 * from the workshop database.
 *
 * Modeled allocation of Versant's reported 3,748 employees (source:
 * `docs/headcount.csv`, 24 locations × ~55 sub-business units). Each
 * sub-business is mapped to one or more Forge towers; pure corporate
 * functions (Versant Finance, HR, Legal, Communications) map 1:1. Tower
 * totals are apportioned to the capability-map L2 buckets using
 * weight-of-effort, anchored to Versant's actual operating context
 * (post-Comcast standup, hyper-hiring, MS NOW progressive positioning,
 * BB- credit, $2.45B programming spend, Fandango / GolfNow / SportsEngine
 * consumer SaaS).
 */
import { getCapabilityMapForTower } from "../../src/data/capabilityMap/maps";
import type { CapabilityMapDefinition } from "../../src/data/capabilityMap/types";
import { towers } from "../../src/data/towers";
import { weightedTowerLevers } from "../../src/lib/assess/scenarioModel";
import type {
  AssessProgramV2,
  L4WorkforceRow,
  TowerAssessState,
  TowerId,
} from "../../src/data/assess/types";
import {
  buildDefaultProgramLeadDeadlines,
  defaultTowerBaseline,
  defaultTowerRates,
} from "../../src/data/assess/types";
import { inferL3Defaults } from "../../src/data/assess/seedAssessmentDefaults";
import { rowStarterRationale } from "../../src/data/assess/rowRationale";

export const SEED_FIXTURE_REFERENCE_AT = "2026-04-26T00:00:00.000Z";

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

function evenSpread(total: number, n: number): number[] {
  if (n === 0) return [];
  const base = Math.floor(total / n);
  const rem = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0));
}

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

function withL3Defaults(rows: L4WorkforceRow[], towerId: TowerId): L4WorkforceRow[] {
  const generatedAt = SEED_FIXTURE_REFERENCE_AT;
  return rows.map((r) => {
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
      dialsRationaleSource: "starter" as const,
      dialsRationaleAt: generatedAt,
    };
  });
}

export function buildTowerFixtureRows(towerId: TowerId): L4WorkforceRow[] {
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

export function buildTowerFixtureState(towerId: TowerId): TowerAssessState {
  const rates = defaultTowerRates(towerId);
  const rows = buildTowerFixtureRows(towerId);
  if (rows.length === 0) {
    return {
      l4Rows: rows,
      baseline: { ...defaultTowerBaseline },
      rates,
      status: "empty",
      lastUpdated: SEED_FIXTURE_REFERENCE_AT,
    };
  }
  const w = weightedTowerLevers(rows, defaultTowerBaseline, rates);
  return {
    l4Rows: rows,
    baseline: {
      baselineOffshorePct: Math.round(w.offshorePct),
      baselineAIPct: Math.round(w.aiPct),
    },
    rates,
    status: "data",
    lastUpdated: SEED_FIXTURE_REFERENCE_AT,
  };
}

export function buildSeededAssessProgramV2(): AssessProgramV2 {
  const tmap: Partial<Record<TowerId, TowerAssessState>> = {};
  for (const tw of towers) {
    const id = tw.id as TowerId;
    tmap[id] = buildTowerFixtureState(id);
  }
  return {
    version: 5,
    towers: tmap,
    leadDeadlines: buildDefaultProgramLeadDeadlines(),
  };
}
