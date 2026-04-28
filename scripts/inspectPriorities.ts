import { capabilityMapDefinitions } from "../src/data/capabilityMap/maps";
import { classifyL4 } from "../src/lib/initiatives/eligibilityRubric";

const priorityCounts: Record<string, number> = {};
const tagCounts: Record<string, number> = {};
const tagPriorityMap: Record<string, string> = {};

for (const map of capabilityMapDefinitions) {
  const towerId = map.mapRelatedTowerIds?.[0] ?? map.id;
  for (const l2 of map.l2) {
    for (const l3 of l2.l3) {
      for (const l4 of l3.l4) {
        const v = classifyL4({
          towerId,
          l2Name: l2.name,
          l3Name: l3.name,
          l4Name: l4.name,
        });
        if (v.aiPriority) {
          priorityCounts[v.aiPriority] = (priorityCounts[v.aiPriority] ?? 0) + 1;
        }
        if (v.matchedPattern) {
          tagCounts[v.matchedPattern] = (tagCounts[v.matchedPattern] ?? 0) + 1;
          if (v.aiPriority) tagPriorityMap[v.matchedPattern] = v.aiPriority;
        }
      }
    }
  }
}

console.log("=== PRIORITY DISTRIBUTION (eligible only) ===");
console.log(JSON.stringify(priorityCounts, null, 2));

console.log("\n=== TAG → PRIORITY → COUNT ===");
const rows = Object.entries(tagCounts)
  .map(([tag, count]) => ({ tag, count, priority: tagPriorityMap[tag] ?? "(not eligible)" }))
  .sort((a, b) => b.count - a.count);
console.table(rows);
