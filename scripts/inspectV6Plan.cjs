/* eslint-disable no-console */
const BASE = "http://localhost:3000";

async function main() {
  const cookies = [];
  const lr = await fetch(`${BASE}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "Towerlead", password: "ACN2026" }),
  });
  const sc = lr.headers.get("set-cookie");
  if (sc) {
    for (const part of sc.split(/,(?=[^;]+=)/g)) {
      const kv = part.split(";")[0].trim();
      if (kv && kv.includes("=")) cookies.push(kv);
    }
  }
  const cookie = cookies.join("; ");
  const r = await fetch(`${BASE}/api/cross-tower-ai-plan/state`, {
    headers: { Cookie: cookie },
  });
  const j = await r.json();
  const p = j.plan;
  if (!p) {
    console.log("No plan persisted yet.");
    return;
  }
  console.log("=== Persisted V6 Plan ===");
  console.log("schema:", p.schema, "version:", p.version);
  console.log("modelId:", p.modelId);
  console.log("promptVersion:", p.promptVersion);
  console.log("inputHash:", p.inputHash);
  console.log("generatedAt:", p.generatedAt);
  console.log("warnings:", p.warnings.length);
  console.log("initiativeRefs:", p.initiativeRefs.length);
  console.log("narratives:", p.narratives.length);
  if (p.synthesis) {
    console.log("\n--- Executive Summary ---");
    console.log(p.synthesis.executiveSummary);
    console.log(`\n--- Risks (${p.synthesis.risks.length}) ---`);
    for (const r of p.synthesis.risks.slice(0, 3)) {
      console.log(`* ${r.title}`);
      console.log(`  ${r.description}`);
      console.log(`  mitigation: ${r.mitigation}`);
    }
    console.log("\n--- Roadmap ---");
    console.log("overall:", p.synthesis.roadmapNarrative.overall);
    console.log("ladder:", p.synthesis.roadmapNarrative.ladder);
    console.log("milestones:", p.synthesis.roadmapNarrative.milestones);
    console.log("ownerNotes:", p.synthesis.roadmapNarrative.ownerNotes);
    console.log("\n--- Architecture ---");
    console.log("Vendors:", p.synthesis.architectureVendors);
    console.log("Data core:", p.synthesis.architectureDataCore);
    console.log("Delivery:", p.synthesis.architectureDelivery);
    console.log(`\n--- Sample narratives (first 3 of ${p.narratives.length}) ---`);
    for (const n of p.narratives.slice(0, 3)) {
      console.log(`* ${n.initiativeId}`);
      console.log(`  narrative: ${n.narrative}`);
      console.log(`  value: ${n.valueRationale}`);
      console.log(`  effort: ${n.effortRationale}`);
    }
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
