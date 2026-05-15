/**
 * Build the strategist LLM input from program state.
 *
 * Inputs:
 *   - Step 1 capability map (l4Rows grouped to L3 job families).
 *   - Step 2 offshore lanes (used to filter by `baseScope`).
 *   - Step 4 readiness intake (per-tower AI tools / experiments / constraints).
 *   - The in-flight `L3Initiative` roster across towers (current AI tools).
 *
 * Output:
 *   - `StrategistPromptInput` ready for the LLM prompt builder.
 *   - `inputHash` — stable deterministic hash that includes `baseScope`
 *      so cache lookups never serve the wrong-scope payload.
 */
import type {
  AssessProgramV2,
  L3WorkforceRowV6,
  TowerId,
} from "@/data/assess/types";
import type { BaseScope } from "@/lib/scope/baseScope";
import type {
  StrategistPromptInput,
  StrategistTowerInput,
} from "@/lib/llm/prompts/strategistOutputs.v1";
import { baseScopeLabel } from "@/lib/scope/baseScope";
import { towers as ALL_TOWERS } from "@/data/towers";
import { clampPct } from "@/lib/offshore/offshoreSplit";

/** L4 rows with `gccPct < this threshold` are counted as "retained" for the
 *  retained-only strategist scope. Matches the Step 4 applicability
 *  threshold so the two views stay coherent. */
const RETAINED_GCC_PCT_THRESHOLD = 50;

export type StrategistInputAndHash = {
  input: StrategistPromptInput;
  inputHash: string;
};

/**
 * True when at least one child L4 of this L3 sits below the 50% GCC
 * threshold — i.e. some part of the work is retained onshore. Used by the
 * `retained-only` filter so L3s where every child is overwhelmingly GCC
 * (`gccPct >= 50` everywhere) are dropped from that scope.
 *
 * For L3s where Step 2 has not yet been touched (every child is still
 * `gccPctSource === "seed"`) we treat them as in-scope under both filters
 * so the strategist isn't starved of input on a tower the lead hasn't
 * reviewed yet.
 */
function l3IsInRetainedScope(
  l3: L3WorkforceRowV6,
  program: AssessProgramV2,
  towerId: TowerId,
): boolean {
  const childIds = l3.childL4RowIds ?? [];
  const t = program.towers[towerId];
  if (!t) return false;
  let anyReviewed = false;
  for (const id of childIds) {
    const child = t.l4Rows.find((r) => r.id === id);
    if (!child) continue;
    if (child.gccPctSource && child.gccPctSource !== "seed") {
      anyReviewed = true;
    }
    if (clampPct(child.gccPct) < RETAINED_GCC_PCT_THRESHOLD) {
      return true;
    }
  }
  // No reviewed rows yet → keep the L3 visible regardless of scope so
  // the strategist isn't starved of input on a tower the lead hasn't
  // reviewed yet.
  return !anyReviewed;
}

export async function buildStrategistInput(
  program: AssessProgramV2,
  scope: BaseScope,
): Promise<StrategistInputAndHash> {
  const towers: StrategistTowerInput[] = [];
  const inFlight: Array<{
    towerName: string;
    l3: string;
    solutionName: string;
    vendor?: string;
  }> = [];

  for (const t of ALL_TOWERS) {
    const tid = t.id as TowerId;
    const state = program.towers[tid];
    if (!state) continue;

    const intake = state.aiReadinessIntake;
    const aiToolsByTower = intake?.currentAiTools ?? "";
    const constraintsByTower = intake?.constraints ?? "";

    const l3Rows = state.l3Rows ?? [];
    const l4ById = new Map(state.l4Rows.map((r) => [r.id, r] as const));
    const families: Array<{
      l2: string;
      l3: string;
      activities: string[];
      aiTools: string;
      constraints: string;
    }> = [];
    let inScopeHc = 0;
    for (const l3 of l3Rows) {
      if (scope === "retained-only" && !l3IsInRetainedScope(l3, program, tid)) {
        continue;
      }
      const activities: string[] = [];
      for (const childId of l3.childL4RowIds ?? []) {
        const child = l4ById.get(childId);
        if (!child) continue;
        activities.push(child.l4);
      }
      families.push({
        l2: l3.l2,
        l3: l3.l3,
        activities: activities.slice(0, 6),
        aiTools: aiToolsByTower,
        constraints: constraintsByTower,
      });
      inScopeHc +=
        l3.fteOnshore +
        l3.fteOffshore +
        l3.contractorOnshore +
        l3.contractorOffshore;

      for (const init of l3.l3Initiatives ?? []) {
        inFlight.push({
          towerName: t.name,
          l3: l3.l3,
          solutionName: init.solutionName,
          vendor: init.primaryVendor,
        });
      }
    }
    if (families.length === 0) continue;
    towers.push({
      id: tid,
      name: t.name,
      inScopeHc,
      jobFamilies: families,
    });
  }

  const input: StrategistPromptInput = {
    baseScopeLabel: baseScopeLabel(scope),
    towers,
    inFlightInitiatives: inFlight.slice(0, 80),
  };
  const inputHash = await hashStrategistInput(scope, input);
  return { input, inputHash };
}

async function hashStrategistInput(
  scope: BaseScope,
  input: StrategistPromptInput,
): Promise<string> {
  // Canonicalise — sort tower ids + job families so identical inputs hash
  // identically regardless of iteration order. Scope is included
  // explicitly so an `all-org` cache never serves a `retained-only`
  // request.
  const canon = JSON.stringify({
    scope,
    towers: input.towers
      .map((t) => ({
        id: t.id,
        hc: t.inScopeHc,
        families: t.jobFamilies
          .map((f) => ({ l2: f.l2, l3: f.l3, a: f.activities.slice(0, 6) }))
          .sort((a, b) => a.l3.localeCompare(b.l3)),
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    inFlight: input.inFlightInitiatives.map((i) => i.solutionName).sort(),
  });
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const buffer = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(canon),
    );
    return Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // Non-cryptographic fallback for Node environments without WebCrypto.
  let h = 5381;
  for (let i = 0; i < canon.length; i++) {
    h = ((h << 5) + h + canon.charCodeAt(i)) | 0;
  }
  return `nh-${Math.abs(h).toString(16)}`;
}
