import type { Tower } from "./types";
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
];
