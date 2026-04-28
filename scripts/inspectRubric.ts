import { capabilityMapDefinitions } from "../src/data/capabilityMap/maps";
import { classifyL4 } from "../src/lib/initiatives/eligibilityRubric";

const target = process.argv[2];
if (!target) {
  console.error("Usage: npx tsx scripts/inspectRubric.ts <towerId>");
  process.exit(1);
}

const map = capabilityMapDefinitions.find(
  (m) => m.mapRelatedTowerIds?.[0] === target,
);
if (!map) {
  console.error(`Tower not found: ${target}`);
  process.exit(1);
}

for (const l2 of map.l2) {
  for (const l3 of l2.l3) {
    for (const l4 of l3.l4) {
      const v = classifyL4({
        towerId: target,
        l2Name: l2.name,
        l3Name: l3.name,
        l4Name: l4.name,
      });
      const tag =
        v.status === "curated"
          ? `[${v.aiPriority?.[0]}: ${v.matchedPattern}]`
          : v.status === "reviewed-not-eligible"
            ? `[NE: ${v.matchedPattern}]`
            : "[?]";
      console.log(`${tag.padEnd(35)} ${l2.name.padEnd(28)} | ${l3.name.padEnd(30)} | ${l4.name}`);
    }
  }
}
