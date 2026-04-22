import type { Tower, TowerSlice, WorkCategory } from "./types";
import { financeTower } from "./slices/finance";
import {
  corpTower,
  editorialTower,
  hrTower,
  legalTower,
  marketingTower,
  opsTower,
  productionTower,
  programmingTower,
  researchTower,
  salesTower,
  serviceTower,
  techTower,
} from "./slices/remaining";
import { workCategoriesByTower } from "./operating-models";
import { briefByRowId } from "./briefMap";

function attachBriefSlugs(categories: WorkCategory[]): WorkCategory[] {
  return categories.map((cat) => ({
    ...cat,
    processes: cat.processes.map((proc) => {
      const brief = briefByRowId[proc.id];
      return brief ? { ...proc, briefSlug: brief } : proc;
    }),
  }));
}

function withWorkCategories(tower: TowerSlice): Tower {
  const categories = workCategoriesByTower[tower.id] ?? [];
  return {
    ...tower,
    workCategories: attachBriefSlugs(categories),
  };
}

export const towers: Tower[] = [
  financeTower,
  hrTower,
  researchTower,
  legalTower,
  corpTower,
  techTower,
  opsTower,
  salesTower,
  marketingTower,
  serviceTower,
  editorialTower,
  productionTower,
  programmingTower,
].map(withWorkCategories);
