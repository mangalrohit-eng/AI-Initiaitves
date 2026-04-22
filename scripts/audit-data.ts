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
