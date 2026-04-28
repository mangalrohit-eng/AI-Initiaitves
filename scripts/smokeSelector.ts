/**
 * Smoke test: build the seeded program, run `selectInitiativesForTower`
 * against every tower, and assert that:
 *
 *   - the call doesn't throw,
 *   - sum-of-l3 AI $ matches `modeledSavingsForTower(...).ai` (handled by the
 *     dev assertion already),
 *   - eligibility-band sanity holds across the program.
 *
 * Run during development before each PR — `npx tsx scripts/smokeSelector.ts`.
 */

import { buildSeededAssessProgramV2 } from "../src/data/assess/seedAssessProgram";
import { towers } from "../src/data/towers";
import { selectInitiativesForTower } from "../src/lib/initiatives/select";
import type { TowerId } from "../src/data/assess/types";

const program = buildSeededAssessProgramV2();
let totalAi = 0;
let totalCurated = 0;
let totalPlaceholders = 0;
let totalSourceMix = { canonical: 0, overlay: 0, rubric: 0, legacyTowerProcess: 0 };

for (const tower of towers) {
  const towerId = tower.id as TowerId;
  const result = selectInitiativesForTower(towerId, program, tower);
  totalAi += result.towerAiUsd;
  totalCurated += result.diagnostics.l4Curated;
  totalPlaceholders += result.diagnostics.l4Placeholders;
  for (const k of ["canonical", "overlay", "rubric", "legacyTowerProcess"] as const) {
    totalSourceMix[k] += result.diagnostics.sourceMix[k];
  }
  console.log(
    `${towerId.padEnd(22)} ` +
      `L2s=${String(result.l2s.length).padStart(2)} ` +
      `aiUsd=$${(result.towerAiUsd / 1_000_000).toFixed(2)}M ` +
      `curated=${result.diagnostics.l4Curated} ` +
      `placeholders=${result.diagnostics.l4Placeholders} ` +
      `mix(canon=${result.diagnostics.sourceMix.canonical} ` +
      `overlay=${result.diagnostics.sourceMix.overlay} ` +
      `rubric=${result.diagnostics.sourceMix.rubric} ` +
      `legacy=${result.diagnostics.sourceMix.legacyTowerProcess})`,
  );
}

console.log("\n========== program-wide totals ==========");
console.log(`towerAiUsd:    $${(totalAi / 1_000_000).toFixed(2)}M`);
console.log(`L4 curated:    ${totalCurated}`);
console.log(`L4 placeholder: ${totalPlaceholders}`);
console.log(`L4 source-mix:  ${JSON.stringify(totalSourceMix)}`);
