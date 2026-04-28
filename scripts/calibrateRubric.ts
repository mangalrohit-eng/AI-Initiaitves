/**
 * Calibrate the deterministic eligibility rubric against the canonical 489 L4s.
 *
 * Usage: `npx tsx scripts/calibrateRubric.ts`
 *
 * Prints:
 *   1. Program-wide distribution (curated / reviewed-not-eligible / pending).
 *   2. Per-tower distribution.
 *   3. Per-tower full L4 verdict tables (for spot-checking and reporting).
 *
 * Used during PR 1 development to land the rubric in the 40-60% band.
 */

import { capabilityMapDefinitions } from "../src/data/capabilityMap/maps";
import { classifyL4 } from "../src/lib/initiatives/eligibilityRubric";

type Row = {
  towerId: string;
  l2: string;
  l3: string;
  l4Id: string;
  l4: string;
  status: string;
  priority?: string;
  reason?: string;
  pattern?: string;
};

function collectRows(): Row[] {
  const rows: Row[] = [];
  for (const map of capabilityMapDefinitions) {
    const towerId = map.mapRelatedTowerIds?.[0] ?? map.id;
    for (const l2 of map.l2) {
      for (const l3 of l2.l3) {
        for (const l4 of l3.l4) {
          const v = classifyL4({
            towerId,
            l2Name: l2.name,
            l3Name: l3.name,
            l4Name: l4.name,
          });
          rows.push({
            towerId,
            l2: l2.name,
            l3: l3.name,
            l4Id: l4.id,
            l4: l4.name,
            status: v.status,
            priority: v.aiPriority,
            reason: v.notEligibleReason,
            pattern: v.matchedPattern,
          });
        }
      }
    }
  }
  return rows;
}

function summary(rows: Row[]) {
  const counts = { curated: 0, "reviewed-not-eligible": 0, "pending-discovery": 0 } as Record<string, number>;
  for (const r of rows) counts[r.status] = (counts[r.status] ?? 0) + 1;
  const total = rows.length;
  const pct = (n: number) => `${((n / total) * 100).toFixed(1)}%`;
  return {
    total,
    curated: counts.curated,
    notEligible: counts["reviewed-not-eligible"],
    pending: counts["pending-discovery"],
    curatedPct: pct(counts.curated),
    notEligiblePct: pct(counts["reviewed-not-eligible"]),
    pendingPct: pct(counts["pending-discovery"]),
  };
}

function perTowerSummary(rows: Row[]) {
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    if (!groups.has(r.towerId)) groups.set(r.towerId, []);
    groups.get(r.towerId)!.push(r);
  }
  const out: Array<{ towerId: string } & ReturnType<typeof summary>> = [];
  for (const [towerId, gr] of groups) {
    out.push({ towerId, ...summary(gr) });
  }
  return out;
}

function pendingByPattern(rows: Row[]) {
  return rows.filter((r) => r.status === "pending-discovery").map((r) => `${r.towerId}\t${r.l2}\t${r.l3}\t${r.l4}`);
}

function main() {
  const rows = collectRows();
  console.log("================ PROGRAM-WIDE ================");
  console.log(JSON.stringify(summary(rows), null, 2));
  console.log("\n================ PER-TOWER ================");
  console.table(perTowerSummary(rows));
  const pending = pendingByPattern(rows);
  console.log(`\n================ PENDING-DISCOVERY (${pending.length}) ================`);
  for (const p of pending) console.log(p);
}

main();
