/**
 * Maps curate-brief `SolutionBrief.sourcing` to the binary `Feasibility` field
 * on `L3Initiative`. Display of Proven / New build is **brief-first**: until
 * `process.solutionBrief` exists, tower surfaces show Pending (not curation
 * feasibility alone).
 */
import type { GeneratedProcessCache, L3Initiative } from "@/data/assess/types";
import type { Feasibility, Process, SolutionSourcingApproach } from "@/data/types";

export function deriveFeasibilityFromSourcing(
  approach: SolutionSourcingApproach,
): Feasibility {
  if (approach === "Buy") return "High";
  return "Low";
}

/**
 * True when the cached Process includes a full solution brief with sourcing
 * — the signal that build/buy/discover was decided for this initiative.
 */
export function initiativeHasCuratedSolutionBrief(init: L3Initiative): boolean {
  return Boolean(
    init.generatedProcess?.process?.solutionBrief?.sourcing?.approach,
  );
}

/**
 * Feasibility for UI: `undefined` until a brief with sourcing exists; then
 * prefers the stamped `L3Initiative.feasibility`, else derives from the
 * brief (e.g. legacy cache before we stamped the field).
 */
export function effectiveInitiativeFeasibility(
  init: L3Initiative,
): Feasibility | undefined {
  const approach =
    init.generatedProcess?.process?.solutionBrief?.sourcing?.approach;
  if (!approach) return undefined;
  return init.feasibility ?? deriveFeasibilityFromSourcing(approach);
}

/**
 * Derive feasibility to persist when saving a new `generatedProcess` from
 * curate-brief. Returns `undefined` if the process has no `solutionBrief`
 * sourcing (e.g. incomplete parse — do not stamp).
 */
export function feasibilityFromGeneratedProcess(
  cache: GeneratedProcessCache,
): Feasibility | undefined {
  return feasibilityFromProcess(cache.process);
}

export function feasibilityFromProcess(process: Process): Feasibility | undefined {
  const approach = process.solutionBrief?.sourcing?.approach;
  if (!approach) return undefined;
  return deriveFeasibilityFromSourcing(approach);
}
