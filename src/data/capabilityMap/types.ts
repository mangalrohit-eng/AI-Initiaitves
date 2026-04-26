import type { Tower } from "@/data/types";

/** L4 activity: stable id, namespaced by map. */
export type CapabilityL4 = {
  id: string;
  name: string;
  relatedTowerIds?: Tower["id"][];
};

export type CapabilityL3 = {
  id: string;
  name: string;
  relatedTowerIds?: Tower["id"][];
  l4: CapabilityL4[];
};

export type CapabilityL2 = {
  id: string;
  name: string;
  l3: CapabilityL3[];
};

export type CapabilityMapDefinition = {
  id: string;
  name: string;
  l1Name: string;
  /** When set, the whole map is anchored to these Forge towers (e.g. HR map → `hr`). */
  mapRelatedTowerIds?: Tower["id"][];
  l2: CapabilityL2[];
};
