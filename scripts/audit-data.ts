import { towers } from "../src/data/towers";
import { processBriefs } from "../src/data/processBriefs";
import { briefRowMap } from "../src/data/briefMap";

const PATTERN_ORDER = [
  "Pipeline",
  "Hub-and-Spoke",
  "Parallel",
  "Sequential",
  "Hierarchical",
] as const;

const pmap = new Map<string, number>();
let tp = 0;
let ta = 0;
let thTower = 0;
let thProc = 0;

for (const t of towers) {
  let a = 0;
  let h = 0;
  for (const p of t.processes) {
    a += p.agents.length;
    h += p.estimatedAnnualHoursSaved;
    const k = p.agentOrchestration.pattern;
    pmap.set(k, (pmap.get(k) ?? 0) + 1);
  }
  console.log(
    `${t.id} | proc ${t.processes.length} | agents ${a} | sumProcHours ${h} | tower.estHours ${t.estimatedAnnualSavingsHours} | aiElig ${t.aiEligibleProcesses}`,
  );
  tp += t.processes.length;
  ta += a;
  thTower += t.estimatedAnnualSavingsHours;
  thProc += h;
}

console.log("TOTAL proc", tp, "agents", ta, "tower hours sum", thTower, "process hours sum", thProc);
console.log(
  "patterns",
  PATTERN_ORDER.map((p) => `${p}:${pmap.get(p) ?? 0}`).join(" "),
);

console.log("\n=== Operating Model ===");
let cats = 0;
let omProc = 0;
let omAi = 0;
let p1 = 0;
let p2 = 0;
let p3 = 0;
for (const t of towers) {
  let cAi = 0;
  let cAll = 0;
  for (const c of t.workCategories) {
    cats += 1;
    for (const proc of c.processes) {
      omProc += 1;
      cAll += 1;
      if (proc.aiEligible) {
        omAi += 1;
        cAi += 1;
      }
      if (proc.aiPriority?.startsWith("P1")) p1 += 1;
      else if (proc.aiPriority?.startsWith("P2")) p2 += 1;
      else if (proc.aiPriority?.startsWith("P3")) p3 += 1;
    }
  }
  console.log(
    `${t.id} | cats ${t.workCategories.length} | proc ${cAll} | AI-elig ${cAi} | not ${cAll - cAi}`,
  );
}
console.log(
  `TOTAL OM: cats ${cats} | proc ${omProc} | AI-elig ${omAi} | not ${omProc - omAi} | P1 ${p1} | P2 ${p2} | P3 ${p3}`,
);

console.log("\n=== Process Briefs ===");
console.log(`Total briefs: ${processBriefs.length}`);

// Every brief must map to a row in briefRowMap
const unmappedBriefs = processBriefs.filter((b) => !briefRowMap[b.id]);
if (unmappedBriefs.length) {
  console.log(
    `WARN: ${unmappedBriefs.length} briefs have no row mapping:`,
    unmappedBriefs.map((b) => b.id),
  );
}

// Every row in the map must exist in some tower
const allRowIds = new Set<string>();
for (const t of towers) {
  for (const c of t.workCategories) {
    for (const proc of c.processes) allRowIds.add(proc.id);
  }
}
const missingRows = Object.entries(briefRowMap).filter(([, rowId]) => !allRowIds.has(rowId));
if (missingRows.length) {
  console.log(
    `WARN: ${missingRows.length} briefRowMap rows not found in operating model:`,
    missingRows,
  );
}

// Count briefs actually attached to rows
let attachedBriefs = 0;
let primaryLinks = 0;
for (const t of towers) {
  for (const c of t.workCategories) {
    for (const proc of c.processes) {
      if (proc.briefSlug) attachedBriefs += 1;
      if (proc.aiEligible && proc.aiInitiativeRelation === "primary" && proc.aiInitiativeId) {
        primaryLinks += 1;
      }
    }
  }
}

const initiativeCount = towers.reduce((n, t) => n + t.processes.length, 0);
console.log(
  `Attached briefs: ${attachedBriefs} | Primary-initiative rows: ${primaryLinks} | Full initiatives: ${initiativeCount} | Clickable detail surface: ${initiativeCount + attachedBriefs}`,
);

// Sanity: brief.towerSlug must match the tower containing its mapped row.
let slugMismatches = 0;
for (const brief of processBriefs) {
  const rowId = briefRowMap[brief.id];
  if (!rowId) continue;
  const tower = towers.find((t) =>
    t.workCategories.some((c) => c.processes.some((p) => p.id === rowId)),
  );
  if (tower && tower.id !== brief.towerSlug) {
    slugMismatches += 1;
    console.log(`Mismatch: brief ${brief.id} says towerSlug=${brief.towerSlug} but row is in ${tower.id}`);
  }
}
if (slugMismatches === 0) console.log("All brief towerSlug values consistent with their mapped rows.");
