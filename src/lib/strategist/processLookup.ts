/**
 * Build a `Map<L3InitiativeId, Process | undefined>` from the live
 * assess program. Used by the cluster / initiative detail pages to
 * pull the underlying four-lens brief for each anchored AI Solution
 * so the cross-tower view can roll up agents, build-vs-buy mix, and
 * the lens digest deterministically.
 */
import type { AssessProgramV2 } from "@/data/assess/types";
import type { Process } from "@/data/types";

export function buildProcessByInitiativeId(
  program: AssessProgramV2,
): Map<string, Process | undefined> {
  const out = new Map<string, Process | undefined>();
  for (const towerState of Object.values(program.towers)) {
    if (!towerState) continue;
    for (const row of towerState.l3Rows ?? []) {
      for (const init of row.l3Initiatives ?? []) {
        out.set(init.id, init.generatedProcess?.process);
      }
    }
  }
  return out;
}
