import { towers } from "../src/data/towers";

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
