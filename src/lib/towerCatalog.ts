import { towers } from "@/data/towers";
import type { Tower } from "@/data/types";

export type TowerListEntry = {
  id: Tower["id"];
  name: string;
  href: string;
};

/** Single source of truth: derived from `towers` only. */
export function listTowersForNav(): TowerListEntry[] {
  return towers.map((t) => ({
    id: t.id,
    name: t.name,
    href: `/tower/${t.id}`,
  }));
}
