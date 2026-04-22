import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type {
  AgentOrchestration,
  AIProcessBrief,
  Process,
  TopOpportunity,
  Tower,
  TowerProcess,
} from "@/data/types";
import { towers } from "@/data/towers";
import { processBriefsBySlug } from "@/data/processBriefs";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function getTowerBySlug(slug: string): Tower | undefined {
  return towers.find((t) => t.id === slug);
}

export function getProcessBySlugs(
  towerSlug: string,
  processSlug: string,
): { tower: Tower; process: Process } | undefined {
  const tower = getTowerBySlug(towerSlug);
  if (!tower) return undefined;
  const process = tower.processes.find((p) => slugify(p.name) === processSlug);
  if (!process) return undefined;
  return { tower, process };
}

export function aggregateTotals() {
  const totalTowers = towers.length;
  const aiProcesses = towers.reduce((n, t) => n + t.aiEligibleProcesses, 0);
  const hours = towers.reduce((n, t) => n + t.estimatedAnnualSavingsHours, 0);
  const agentCount = towers.reduce(
    (n, t) => n + t.processes.reduce((m, p) => m + p.agents.length, 0),
    0,
  );
  return { totalTowers, aiProcesses, hours, agentCount };
}

export function hoursByTower() {
  return towers.map((t) => ({
    name: t.name,
    hours: t.estimatedAnnualSavingsHours,
    id: t.id,
  }));
}

export function readinessHeatmapPoints() {
  const points: {
    tower: string;
    process: string;
    complexity: Process["complexity"];
    hours: number;
    savingsPct: number;
  }[] = [];
  for (const t of towers) {
    for (const p of t.processes) {
      if (!p.isAiEligible) continue;
      points.push({
        tower: t.name,
        process: p.name,
        complexity: p.complexity,
        hours: p.estimatedAnnualHoursSaved,
        savingsPct: p.estimatedTimeSavingsPercent,
      });
    }
  }
  return points;
}

export function formatHours(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}K`;
  return `${Math.round(n)}`;
}

export function agentTypeCounts() {
  const map: Record<string, number> = {};
  for (const t of towers) {
    for (const p of t.processes) {
      for (const a of p.agents) {
        map[a.type] = (map[a.type] ?? 0) + 1;
      }
    }
  }
  return Object.entries(map).map(([type, count]) => ({ type, count }));
}

const PATTERN_ORDER: AgentOrchestration["pattern"][] = [
  "Pipeline",
  "Hub-and-Spoke",
  "Parallel",
  "Sequential",
  "Hierarchical",
];

export function orchestrationPatternCounts() {
  const map = new Map<AgentOrchestration["pattern"], number>();
  for (const t of towers) {
    for (const p of t.processes) {
      const k = p.agentOrchestration.pattern;
      map.set(k, (map.get(k) ?? 0) + 1);
    }
  }
  return PATTERN_ORDER.map((pattern) => ({ pattern, count: map.get(pattern) ?? 0 }));
}

export function operatingModelTotals(tower: Tower) {
  const categories = tower.workCategories;
  const processes = categories.flatMap((c) => c.processes);
  const aiEligible = processes.filter((p) => p.aiEligible).length;
  return {
    categoryCount: categories.length,
    processCount: processes.length,
    aiEligibleCount: aiEligible,
    notEligibleCount: processes.length - aiEligible,
  };
}

export function towerAiEligibility() {
  return towers.map((t) => {
    const totals = operatingModelTotals(t);
    const pct = totals.processCount === 0 ? 0 : (totals.aiEligibleCount / totals.processCount) * 100;
    return {
      id: t.id,
      name: t.name,
      aiEligible: totals.aiEligibleCount,
      total: totals.processCount,
      percent: Math.round(pct),
    };
  });
}

// Returns the full 4-lens initiative ONLY when this row is the "primary"
// representation of an initiative. Sub-process / related / governance rows
// resolve via their `briefSlug` instead (see `findProcessBrief`).
export function findAiInitiative(tower: Tower, tp: TowerProcess): Process | undefined {
  if (!tp.aiInitiativeId) return undefined;
  if (tp.aiInitiativeRelation && tp.aiInitiativeRelation !== "primary") return undefined;
  return tower.processes.find((p) => p.id === tp.aiInitiativeId);
}

export function findProcessBrief(slug: string): AIProcessBrief | undefined {
  return processBriefsBySlug.get(slug);
}

// Total AI-eligible clickable surface — full initiatives + briefs.
export function aiEligibleDetailCount() {
  const initiativeCount = towers.reduce((n, t) => n + t.processes.length, 0);
  const briefCount = processBriefsBySlug.size;
  return { initiativeCount, briefCount, total: initiativeCount + briefCount };
}

// Returns up to 3 "top opportunities" for a tower. If the tower has curated
// `topOpportunities` authored, those win. Otherwise the helper derives the top
// AI-eligible initiatives by modeled annual hours saved so the tower page
// always has meaningful content without content authoring.
export function deriveTopOpportunities(tower: Tower, limit = 3): TopOpportunity[] {
  if (tower.topOpportunities?.length) return tower.topOpportunities.slice(0, limit);
  const ranked = [...tower.processes]
    .filter((p) => p.isAiEligible)
    .sort((a, b) => b.estimatedAnnualHoursSaved - a.estimatedAnnualHoursSaved)
    .slice(0, limit);
  return ranked.map((p) => ({
    headline: p.name,
    impact: `${formatHours(p.estimatedAnnualHoursSaved)} hrs/yr · ${p.estimatedTimeSavingsPercent}% time saved`,
    processId: p.id,
  }));
}

export function allProcessTimelines() {
  const rows: { tower: string; process: string; months: number }[] = [];
  for (const t of towers) {
    for (const p of t.processes) {
      rows.push({ tower: t.name, process: p.name, months: p.timelineMonths });
    }
  }
  rows.sort((a, b) => b.months - a.months || a.tower.localeCompare(b.tower));
  return rows;
}

