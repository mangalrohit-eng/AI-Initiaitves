import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Process, Tower } from "@/data/types";
import { towers } from "@/data/towers";

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
