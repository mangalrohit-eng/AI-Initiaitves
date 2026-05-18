/**
 * Cross-tower strategist rollups.
 *
 * Every cross-tower initiative anchors to 1-N tower-specific AI
 * Solutions via `StrategistInitiative.constituentSolutionIds` (added in
 * strategist.v1.1). These helpers compose deterministic rollups from
 * the anchored solutions — modeled dollars, value tier, vendor mix,
 * build-vs-buy mix, agent footprint — so the cluster and initiative
 * detail pages can show the same brief depth as the tower-specific
 * solution briefs without inviting the LLM to invent figures.
 *
 * Key design rules:
 *   - Cluster-level rollups deduplicate solution ids across initiatives
 *     so a solution anchored to two initiatives in the same cluster is
 *     not double-counted.
 *   - All dollar paths return `number | null`. `null` means "no
 *     anchored solutions" — the UI renders the explicit "Unsized · TBD
 *     subject to discovery" state rather than $0 (which would imply no
 *     value, not no model).
 *   - The agent and sourcing aggregators operate on the underlying
 *     `Process` payloads (`L3Initiative.generatedProcess`) because the
 *     view-model `AIProjectResolved` doesn't carry the brief depth.
 */

import type {
  Agent,
  Process,
  SolutionSourcingApproach,
} from "@/data/types";
import type { AIProjectResolved } from "@/lib/cross-tower/aiProjects";
import type {
  OutcomeCluster,
  StrategistInitiative,
  ValueSizingTier,
} from "@/lib/strategist/types";

// ---------------------------------------------------------------------
//   Value-tier breakpoints
// ---------------------------------------------------------------------

/**
 * Initiative-level dollar breakpoints from `@docs/main-spec.md` — the
 * same thresholds the rest of Forge uses for HIGH / MEDIUM / LOW
 * impact sizing.
 */
const TIER_HIGH_USD = 20_000_000;
const TIER_MEDIUM_USD = 5_000_000;

export type DerivedValueTier = ValueSizingTier | "UNSIZED";

/**
 * Maps a modeled-dollar rollup to a HIGH/MEDIUM/LOW pill. `null`
 * means there was no anchored solution to roll up at all — the badge
 * renders "Unsized" rather than silently showing $0 / LOW.
 */
export function deriveValueTier(usd: number | null): DerivedValueTier {
  if (usd === null) return "UNSIZED";
  if (usd >= TIER_HIGH_USD) return "HIGH";
  if (usd >= TIER_MEDIUM_USD) return "MEDIUM";
  return "LOW";
}

// ---------------------------------------------------------------------
//   Anchor resolution
// ---------------------------------------------------------------------

/**
 * Resolve the tower-specific AI Solutions an initiative anchors to.
 * Returns the projects in the same order the strategist emitted them
 * so the detail page can show "constituent solution #1 / #2 / #3"
 * stably.
 */
export function anchoredSolutionsForInitiative(
  initiative: StrategistInitiative,
  projects: ReadonlyArray<AIProjectResolved>,
): AIProjectResolved[] {
  // Legacy v1.0 strategist payloads (persisted before the v1.1 prompt
  // upgrade) omit `constituentSolutionIds` entirely — coalesce so the
  // page renders the "Unsized" fallback instead of throwing.
  const ids = initiative.constituentSolutionIds ?? [];
  if (ids.length === 0) return [];
  const byId = new Map(projects.map((p) => [p.id, p] as const));
  const out: AIProjectResolved[] = [];
  for (const id of ids) {
    const p = byId.get(id);
    if (p) out.push(p);
  }
  return out;
}

/**
 * De-duplicated union of every solution anchored under any initiative
 * in this cluster. Used for cluster-level dollar / vendor / agent
 * rollups so a solution that's referenced by two sibling initiatives
 * counts once.
 */
export function anchoredSolutionsForCluster(
  cluster: OutcomeCluster,
  initiatives: ReadonlyArray<StrategistInitiative>,
  projects: ReadonlyArray<AIProjectResolved>,
): AIProjectResolved[] {
  const inCluster = initiatives.filter((i) => i.clusterId === cluster.id);
  const seen = new Set<string>();
  const out: AIProjectResolved[] = [];
  const byId = new Map(projects.map((p) => [p.id, p] as const));
  for (const init of inCluster) {
    for (const id of init.constituentSolutionIds ?? []) {
      if (seen.has(id)) continue;
      seen.add(id);
      const p = byId.get(id);
      if (p) out.push(p);
    }
  }
  return out;
}

// ---------------------------------------------------------------------
//   Dollar rollups
// ---------------------------------------------------------------------

/**
 * Sum `attributedAiUsd` across the initiative's anchored solutions.
 * Returns `null` when nothing is anchored so the UI can distinguish
 * "Unsized" from "$0".
 */
export function initiativeRollupUsd(
  initiative: StrategistInitiative,
  projects: ReadonlyArray<AIProjectResolved>,
): number | null {
  const ids = initiative.constituentSolutionIds ?? [];
  if (ids.length === 0) return null;
  const anchored = anchoredSolutionsForInitiative(initiative, projects);
  if (anchored.length === 0) return null;
  let total = 0;
  for (const p of anchored) total += p.attributedAiUsd;
  return total;
}

/**
 * Sum `attributedAiUsd` across every solution anchored anywhere under
 * the cluster — de-duplicated by solution id so a solution shared by
 * two sibling initiatives counts once.
 */
export function clusterRollupUsd(
  cluster: OutcomeCluster,
  initiatives: ReadonlyArray<StrategistInitiative>,
  projects: ReadonlyArray<AIProjectResolved>,
): number | null {
  const anchored = anchoredSolutionsForCluster(cluster, initiatives, projects);
  if (anchored.length === 0) return null;
  let total = 0;
  for (const p of anchored) total += p.attributedAiUsd;
  return total;
}

// ---------------------------------------------------------------------
//   Vendor + sourcing aggregators
// ---------------------------------------------------------------------

export type VendorTally = { vendor: string; count: number };

/**
 * Count each named vendor across the anchored solutions, ordered by
 * frequency. Solutions without a `primaryVendor` are skipped. Used in
 * the cluster / initiative detail headers and the build-vs-buy panel.
 */
export function aggregateVendors(
  solutions: ReadonlyArray<AIProjectResolved>,
): VendorTally[] {
  const tally = new Map<string, number>();
  for (const p of solutions) {
    const v = p.primaryVendor?.trim();
    if (!v) continue;
    tally.set(v, (tally.get(v) ?? 0) + 1);
  }
  return Array.from(tally.entries())
    .map(([vendor, count]) => ({ vendor, count }))
    .sort((a, b) => b.count - a.count || a.vendor.localeCompare(b.vendor));
}

export type SourcingMix = {
  build: number;
  buy: number;
  discover: number;
  /** Solutions whose brief has not yet been cached — no verdict yet. */
  unknown: number;
};

/**
 * Build-vs-buy mix across the underlying tower briefs. The brief lives
 * on `Process.solutionBrief.sourcing.approach` — when the brief hasn't
 * been generated yet the solution falls into `unknown` and the UI
 * surfaces a "brief not yet authored" hint.
 */
export function aggregateSourcingMix(
  processes: ReadonlyArray<Process | undefined>,
): SourcingMix {
  const mix: SourcingMix = { build: 0, buy: 0, discover: 0, unknown: 0 };
  for (const proc of processes) {
    const approach: SolutionSourcingApproach | undefined =
      proc?.solutionBrief?.sourcing?.approach;
    if (!approach) {
      mix.unknown += 1;
      continue;
    }
    if (approach === "Build") mix.build += 1;
    else if (approach === "Buy") mix.buy += 1;
    else mix.discover += 1;
  }
  return mix;
}

// ---------------------------------------------------------------------
//   Agent footprint
// ---------------------------------------------------------------------

/**
 * Union of `Process.agents[]` across the anchored solutions, grouped
 * by canonical agent name. Each entry carries the set of solution ids
 * that surface that agent so the UI can render "Reconciliation Agent
 * (used in 3 anchored solutions)" with a click-through.
 */
export type AggregatedAgent = {
  /** Display name — `Agent.name`. */
  name: string;
  /** `Agent.type` — Orchestrator / Specialist / Monitor / Router / Executor. */
  type: Agent["type"];
  /** Solutions that surface this agent. */
  solutionIds: string[];
};

export function aggregateAgents(
  pairs: ReadonlyArray<{
    solutionId: string;
    process: Process | undefined;
  }>,
): AggregatedAgent[] {
  const byKey = new Map<string, AggregatedAgent>();
  for (const { solutionId, process } of pairs) {
    if (!process?.agents) continue;
    for (const a of process.agents) {
      const key = `${a.type}::${a.name.toLowerCase()}`;
      const existing = byKey.get(key);
      if (existing) {
        if (!existing.solutionIds.includes(solutionId)) {
          existing.solutionIds.push(solutionId);
        }
      } else {
        byKey.set(key, {
          name: a.name,
          type: a.type,
          solutionIds: [solutionId],
        });
      }
    }
  }
  return Array.from(byKey.values()).sort(
    (a, b) =>
      b.solutionIds.length - a.solutionIds.length ||
      a.name.localeCompare(b.name),
  );
}

// ---------------------------------------------------------------------
//   Workforce / workbench / digital-core lens digest
// ---------------------------------------------------------------------

export type LensDigest = {
  /** De-duped workforce role-change one-liners across solutions. */
  workforceChanges: string[];
  /** De-duped vendor / tool names across the four-lens briefs. */
  workbenchTools: string[];
  /** De-duped digital-core platform / system names. */
  digitalCorePlatforms: string[];
};

/**
 * Lightweight cross-tower digest of the four-lens briefs. Inputs are
 * the underlying `Process` payloads (one per anchored solution).
 * Returns short, de-duped string lists ready for chip rendering on
 * the cluster / initiative detail pages.
 *
 * Field choices reflect what reads cleanly as a chip cloud:
 *   - workforceChanges → `WorkforceLens.keyShifts` (one-liner role
 *     deltas like "Sourcer → AI-augmented researcher").
 *   - workbenchTools   → the post-state `ToolState.tool` names (the
 *     stack each solution lands on).
 *   - digitalCorePlatforms → `PlatformRequirement.platform` names
 *     from the digital-core lens.
 */
export function aggregateLenses(
  processes: ReadonlyArray<Process | undefined>,
): LensDigest {
  const workforce = new Set<string>();
  const tools = new Set<string>();
  const platforms = new Set<string>();
  for (const proc of processes) {
    if (!proc) continue;
    for (const shift of proc.workforce?.keyShifts ?? []) {
      const s = shift?.trim();
      if (s) workforce.add(s);
    }
    for (const t of proc.workbench?.post ?? []) {
      const name = t?.tool?.trim();
      if (name) tools.add(name);
    }
    for (const p of proc.digitalCore?.requiredPlatforms ?? []) {
      const name = p?.platform?.trim();
      if (name) platforms.add(name);
    }
  }
  return {
    workforceChanges: Array.from(workforce).sort(),
    workbenchTools: Array.from(tools).sort(),
    digitalCorePlatforms: Array.from(platforms).sort(),
  };
}
