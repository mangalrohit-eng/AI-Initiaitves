import type { Tower } from "@/data/types";
import { hrLocalizeToVersant } from "./hr-localize-to-versant";
import { financeCapabilities } from "./finance";
import { researchAnalyticsCapabilities } from "./research-analytics";
import { legalCapabilities } from "./legal";
import { corpServicesCapabilities } from "./corp-services";
import { techEngineeringCapabilities } from "./tech-engineering";
import { operationsTechnologyCapabilities } from "./operations-technology";
import { salesCapabilities } from "./sales";
import { marketingCommsCapabilities } from "./marketing-comms";
import { serviceCapabilities } from "./service";
import { editorialNewsCapabilities } from "./editorial-news";
import { productionCapabilities } from "./production";
import { programmingDevCapabilities } from "./programming-dev";
import type { CapabilityMapDefinition } from "./types";

export const capabilityMapDefinitions: CapabilityMapDefinition[] = [
  hrLocalizeToVersant,
  financeCapabilities,
  researchAnalyticsCapabilities,
  legalCapabilities,
  corpServicesCapabilities,
  techEngineeringCapabilities,
  operationsTechnologyCapabilities,
  salesCapabilities,
  marketingCommsCapabilities,
  serviceCapabilities,
  editorialNewsCapabilities,
  productionCapabilities,
  programmingDevCapabilities,
];

export function getCapabilityMapById(id: string): CapabilityMapDefinition | undefined {
  return capabilityMapDefinitions.find((m) => m.id === id);
}

/** When a map is anchored to a single tower (e.g. HR), use it to render L1–L4 structure. */
export function getCapabilityMapForTower(
  towerId: Tower["id"],
): CapabilityMapDefinition | undefined {
  return capabilityMapDefinitions.find((m) => m.mapRelatedTowerIds?.includes(towerId));
}
