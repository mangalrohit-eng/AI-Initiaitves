import type { Tower, TowerSlice } from "./types";
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

function withWorkCategories(tower: TowerSlice): Tower {
  return {
    ...tower,
    workCategories: workCategoriesByTower[tower.id] ?? [],
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
