/**
 * AI Initiatives selector — the single source of truth for Step 4's view-models.
 *
 * Joins the canonical capability map (L1→L4 hierarchy), the live `AssessProgramV4`
 * dial (per-L3 AI %, modeled $), and the curated Versant-specific overlay
 * (`TowerProcess` rows in `data/operating-models.ts`) into a unified shape
 * that the AI Initiatives UI consumes directly.
 *
 * ───────────────────────────────────────────────────────────────────────────
 *   Financial integrity contract
 * ───────────────────────────────────────────────────────────────────────────
 * Every $ rendered by AI Initiatives flows through `rowAnnualCost` +
 * `rowModeledSaving` from `lib/assess/scenarioModel.ts`. There is no new
 * arithmetic in this file — we read the pool/AI numbers and pass them through.
 *
 * The dev-mode helper `assertImpactConsistency` checks that the sum of per-L3
 * AI $ on Step 4 (post-filter) equals the unfiltered tower AI total from
 * `modeledSavingsForTower`. Filtering can only *omit* rows where the dial is
 * 0; any other discrepancy is a bug and throws in dev (silent in prod).
 *
 * ───────────────────────────────────────────────────────────────────────────
 *   Filtering rules
 * ───────────────────────────────────────────────────────────────────────────
 *   - L4 renders only when the `TowerProcess` overlay says `aiEligible: true`
 *     OR the L4 itself carries `aiCurationStatus: "curated"` (Phase 2 path).
 *   - L3 renders only when its `aiImpactAssessmentPct > 0`. If it has zero
 *     curated L4s but dial > 0, we synthesize a "discovery activity" placeholder
 *     L4 (ghost-L3 prevention) so the L3 stays visible — the full per-L3 $
 *     will appear on Step 4 even before the editorial sweep is complete.
 *   - L2 renders only when at least one L3 renders.
 */
import type { Tower, TowerProcess, AiPriority, Process, AIProcessBrief } from "@/data/types";
import type {
  CapabilityL2,
  CapabilityL3,
  CapabilityL4,
} from "@/data/capabilityMap/types";
import { getCapabilityMapForTower } from "@/data/capabilityMap/maps";
import type { AssessProgramV2, L3WorkforceRow, TowerId } from "@/data/assess/types";
import { defaultTowerBaseline, defaultGlobalAssessAssumptions } from "@/data/assess/types";
import {
  modeledSavingsForTower,
  rowModeledSaving,
} from "@/lib/assess/scenarioModel";
import { processBriefsBySlug } from "@/data/processBriefs";
import { briefByRowId } from "@/data/briefMap";
import { findAiInitiative } from "@/lib/utils";
import { buildProcessByL4Map, fuzzyMatchL4 } from "./processL4Map";
import { composeL4Verdict, type ComposedVerdict } from "./composeVerdict";

// ===========================================================================
//   View-model types
// ===========================================================================

export type InitiativeL4Source = "curated" | "fuzzy-match" | "placeholder";

export type InitiativeL4 = {
  /** Stable id from the canonical map. Placeholder L4s use a synthetic id. */
  id: string;
  /** Display name from the canonical L4 (or the placeholder copy). */
  name: string;
  /** Curation provenance — how the curated metadata got attached. */
  source: InitiativeL4Source;
  /** True when the row is a synthesized placeholder for ghost-L3 prevention. */
  isPlaceholder: boolean;
  // ----- Curated metadata (undefined for placeholders until editorial sweep)
  aiPriority?: AiPriority;
  aiRationale?: string;
  frequency?: TowerProcess["frequency"];
  criticality?: TowerProcess["criticality"];
  currentMaturity?: TowerProcess["currentMaturity"];
  // ----- Click-through targets (one of: full 4-lens, brief, or none)
  initiativeId?: string;
  briefSlug?: string;
};

export type InitiativeL3 = {
  l3: CapabilityL3;
  /** L2 row this L3 sits under (denormalized for header rendering). */
  l2Name: string;
  l2Id: string;
  /** Mirror of `L3WorkforceRow.id` so UI can deep-link to Step 2 anchors. */
  rowId: string;
  /** Per-L3 pool $ (from `rowAnnualCost`). */
  poolUsd: number;
  /** Per-L3 AI dial % (from row override or tower baseline). */
  aiPct: number;
  /** Per-L3 modeled AI $ (from `rowModeledSaving`). Single source of truth. */
  aiUsd: number;
  /**
   * Filtered AI-eligible L4s; placeholders are appended here when the L3 has
   * dial > 0 but no curated L4s yet (ghost-L3 prevention).
   */
  l4s: InitiativeL4[];
  /** First curated L4 with `initiativeId` set — the L3-level click-through. */
  primaryInitiativeId?: string;
  /** First curated L4 with `briefSlug` set — fallback click-through. */
  primaryBriefSlug?: string;
};

export type InitiativeL2 = {
  l2: CapabilityL2;
  l3s: InitiativeL3[];
  /** Sum of per-L3 AI $ across L3s shown under this L2. */
  totalAiUsd: number;
  /** Curated L4 count (excluding placeholders). */
  curatedL4Count: number;
  /** Placeholder L4 count (pending-discovery). */
  placeholderL4Count: number;
};

export type SelectInitiativesResult = {
  towerId: TowerId;
  /** Tower-wide modeled AI $ — should equal sum of `l2.totalAiUsd`. */
  towerAiUsd: number;
  /** Tower-wide pool $ across all L3s (regardless of dial). */
  towerPoolUsd: number;
  /** Cost-weighted AI dial across the tower. */
  towerAiPct: number;
  l2s: InitiativeL2[];
  /** Diagnostics for the dev assertion + any UI debugging. */
  diagnostics: {
    l3WithDialZero: number;
    l3GhostPlaceholders: number;
    l4Curated: number;
    l4Placeholders: number;
    overlayHits: number;
    overlayFuzzyHits: number;
    /** Source-mix counts — verdict provenance across L4s in this tower. */
    sourceMix: {
      canonical: number;
      overlay: number;
      rubric: number;
      legacyTowerProcess: number;
    };
  };
};

// ===========================================================================
//   Selector
// ===========================================================================

/**
 * Build the AI Initiatives view-model for one tower.
 *
 * The loop is **driven by `L3WorkforceRow`s** (the canonical financial truth on
 * Step 2), not by the capability map. Each row is decorated with canonical L2
 * + L4 metadata when its id (or, as fallback, its name) matches the map. Rows
 * that don't match the map still render — they appear under their own L2 name
 * with a synthesized "Discovery activity" L4 — so a stale localStorage import
 * or a renamed L3 never causes a row's modeled $ to silently disappear.
 *
 * Pure function of `(towerId, program, tower)` — no side effects, safe to call
 * during SSR. By construction, sum-of-l3.aiUsd === modeledSavingsForTower(...).ai.
 */
export function selectInitiativesForTower(
  towerId: TowerId,
  program: AssessProgramV2,
  tower: Tower,
): SelectInitiativesResult {
  const map = getCapabilityMapForTower(towerId);
  const towerState = program.towers[towerId];
  const baseline = towerState?.baseline ?? defaultTowerBaseline;
  const global = program.global ?? defaultGlobalAssessAssumptions;
  const l3Rows: L3WorkforceRow[] = towerState?.l3Rows ?? [];

  const overlay = buildProcessByL4Map(tower);
  const claimed = new Set<string>(Array.from(overlay.values()).map((p) => p.id));

  let l3WithDialZero = 0;
  let l3GhostPlaceholders = 0;
  let l4Curated = 0;
  let l4Placeholders = 0;
  let overlayHits = 0;
  let overlayFuzzyHits = 0;
  // Provenance counters for the source-mix diagnostic — useful for spotting
  // when an overlay rule isn't firing or the rubric is over-eager.
  const sourceMix = {
    canonical: 0,
    overlay: 0,
    rubric: 0,
    legacyTowerProcess: 0,
  };

  // Build L3 lookup tables off the canonical map. We index by both id and a
  // normalized "L2 + L3 name" key so a row imported with a different id (but
  // same names) still finds its canonical L4 list.
  type MapL3Hit = {
    l2: CapabilityL2;
    l3: CapabilityL3;
  };
  const mapL3ById = new Map<string, MapL3Hit>();
  const mapL3ByNameKey = new Map<string, MapL3Hit>();
  // Canonical L2 ordering — used to sort the output L2 panels stably.
  const l2OrderById = new Map<string, number>();
  if (map) {
    for (let i = 0; i < map.l2.length; i++) {
      const l2 = map.l2[i];
      l2OrderById.set(l2.id, i);
      for (const l3 of l2.l3) {
        if (l3.relatedTowerIds && !l3.relatedTowerIds.includes(towerId)) continue;
        const hit: MapL3Hit = { l2, l3 };
        mapL3ById.set(l3.id, hit);
        mapL3ByNameKey.set(nameKey(l2.name, l3.name), hit);
      }
    }
  }

  // Group accumulator keyed by L2 id (canonical) or a synthesized id for rows
  // whose L2 name doesn't appear in the canonical map.
  type Accum = {
    l2: CapabilityL2;
    order: number;
    l3s: InitiativeL3[];
    totalAiUsd: number;
    curatedL4Count: number;
    placeholderL4Count: number;
  };
  const byL2: Map<string, Accum> = new Map();
  const synthOrderBase = (map?.l2.length ?? 0) + 1;

  // Stable order for synthesized L2s (rows whose L2 name isn't on the
  // canonical map) — first encountered, first ordered.
  let synthOrderCursor = 0;

  for (const row of l3Rows) {
    const saving = rowModeledSaving(row, baseline, global);

    // Resolve canonical metadata (id-first, name-key fallback for stale data).
    const mapHit =
      mapL3ById.get(row.id) ?? mapL3ByNameKey.get(nameKey(row.l2, row.l3));

    if (saving.aiPct <= 0) {
      // Row contributes $0 to AI totals — skip to keep the L3 list focused on
      // capabilities the user has actually opted into. Tracked for diagnostics.
      l3WithDialZero += 1;
      continue;
    }

    // Build the L4 list for this row.
    const l4Views: InitiativeL4[] = [];
    let curatedHere = 0;
    let placeholdersHere = 0;
    if (mapHit) {
      for (const l4 of mapHit.l3.l4) {
        if (l4.relatedTowerIds && !l4.relatedTowerIds.includes(towerId)) continue;

        // Path A — legacy `operating-models.ts` TowerProcess overlay (still
        // primary when present, since those rows carry hand-authored 4-lens
        // initiative + brief links the composer can't synthesize).
        const overlayProcess = overlay.get(l4.id);
        if (overlayProcess) {
          if (overlayProcess.aiEligible) {
            l4Views.push(buildL4FromOverlay(l4, overlayProcess, "curated", tower));
            l4Curated += 1;
            curatedHere += 1;
            overlayHits += 1;
            sourceMix.legacyTowerProcess += 1;
          }
          continue;
        }

        // Path B — fuzzy name match against TowerProcess overlay; claim-
        // protected so a single TowerProcess doesn't spread across multiple
        // L4s.
        const fuzzy = fuzzyMatchL4(l4, tower, claimed);
        if (fuzzy && fuzzy.aiEligible) {
          claimed.add(fuzzy.id);
          l4Views.push(buildL4FromOverlay(l4, fuzzy, "fuzzy-match", tower));
          l4Curated += 1;
          curatedHere += 1;
          overlayFuzzyHits += 1;
          sourceMix.legacyTowerProcess += 1;
          continue;
        }

        // Path C — composer (canonical-fields-on-L4 → overlay → rubric).
        // Covers every L4 that doesn't have a TowerProcess overlay, which
        // is the majority of the canonical 489 L4s in PR 1.
        const verdict = composeL4Verdict({
          towerId,
          l2Name: mapHit.l2.name,
          l3Name: mapHit.l3.name,
          l4,
        });
        sourceMix[verdict.source] += 1;
        if (verdict.status === "curated") {
          l4Views.push(buildL4FromComposedVerdict(l4, verdict));
          l4Curated += 1;
          curatedHere += 1;
        }
        // `reviewed-not-eligible` and `pending-discovery` from the composer
        // are intentionally skipped here — the L3 still gets a placeholder
        // below if no curated L4 surfaced.
      }
    }

    // Ghost-L3 prevention: dial > 0 but no curated L4 surfaced (either no map
    // hit at all, or the map L4s all fell through). Synthesize a placeholder
    // so the L3 stays visible and its $ is still attributed.
    if (l4Views.length === 0) {
      l4Views.push(buildPlaceholderL4Fallback(row.id, saving.aiPct));
      l4Placeholders += 1;
      placeholdersHere += 1;
      l3GhostPlaceholders += 1;
    }

    const primaryInitiativeId = l4Views.find((x) => x.initiativeId)?.initiativeId;
    const primaryBriefSlug = l4Views.find((x) => x.briefSlug)?.briefSlug;

    // Resolve the L2 group — canonical L2 if matched, synthesized otherwise.
    const groupKey = mapHit ? mapHit.l2.id : `__row-l2:${row.l2}`;
    let group = byL2.get(groupKey);
    if (!group) {
      const l2Obj: CapabilityL2 = mapHit
        ? mapHit.l2
        : {
            id: groupKey,
            name: row.l2 || "Uncategorised",
            l3: [],
          };
      const order = mapHit
        ? (l2OrderById.get(mapHit.l2.id) ?? synthOrderBase + synthOrderCursor++)
        : synthOrderBase + synthOrderCursor++;
      group = {
        l2: l2Obj,
        order,
        l3s: [],
        totalAiUsd: 0,
        curatedL4Count: 0,
        placeholderL4Count: 0,
      };
      byL2.set(groupKey, group);
    }

    // Resolve the L3 object — canonical if matched, synthesized otherwise.
    const l3Obj: CapabilityL3 = mapHit
      ? mapHit.l3
      : {
          id: row.id,
          name: row.l3 || "Capability",
          l4: [],
        };

    group.l3s.push({
      l3: l3Obj,
      l2Name: group.l2.name,
      l2Id: group.l2.id,
      rowId: row.id,
      poolUsd: saving.pool,
      aiPct: saving.aiPct,
      aiUsd: saving.ai,
      l4s: l4Views,
      primaryInitiativeId,
      primaryBriefSlug,
    });
    group.totalAiUsd += saving.ai;
    group.curatedL4Count += curatedHere;
    group.placeholderL4Count += placeholdersHere;
  }

  const l2Views: InitiativeL2[] = Array.from(byL2.values())
    .sort((a, b) => a.order - b.order)
    .map((g) => ({
      l2: g.l2,
      l3s: g.l3s,
      totalAiUsd: g.totalAiUsd,
      curatedL4Count: g.curatedL4Count,
      placeholderL4Count: g.placeholderL4Count,
    }));

  const towerSummary = l3Rows.length
    ? modeledSavingsForTower(l3Rows, baseline, global)
    : { pool: 0, offshorePct: 0, aiPct: 0, offshore: 0, ai: 0, combined: 0 };

  const result: SelectInitiativesResult = {
    towerId,
    towerAiUsd: towerSummary.ai,
    towerPoolUsd: towerSummary.pool,
    towerAiPct: towerSummary.aiPct,
    l2s: l2Views,
    diagnostics: {
      l3WithDialZero,
      l3GhostPlaceholders,
      l4Curated,
      l4Placeholders,
      overlayHits,
      overlayFuzzyHits,
      sourceMix,
    },
  };

  // Source-mix log — surfaces which curation layer is doing the work for
  // each tower. Keeps us honest as the LLM pipeline (PR 2) shifts the mix.
  if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
    const total =
      sourceMix.canonical +
      sourceMix.overlay +
      sourceMix.rubric +
      sourceMix.legacyTowerProcess;
    if (total > 0) {
      // eslint-disable-next-line no-console
      console.debug(
        `[forge.selectInitiatives] tower="${towerId}" L4 source mix:`,
        `canonical=${sourceMix.canonical}`,
        `overlay=${sourceMix.overlay}`,
        `rubric=${sourceMix.rubric}`,
        `legacy=${sourceMix.legacyTowerProcess}`,
      );
    }
  }

  // Run the dev assertion in development only — never in production builds.
  // By construction the loop above only excludes rows where saving.aiPct === 0
  // (which contribute $0 anyway), so the totals must match exactly.
  if (process.env.NODE_ENV !== "production") {
    assertImpactConsistency(result, towerSummary.ai);
  }

  return result;
}

/**
 * Normalize "L2 name + L3 name" into a stable lookup key. Trims, lowercases,
 * and collapses whitespace so a tower-lead upload that differs only by minor
 * formatting (e.g. trailing space, case) still finds its canonical L4 list.
 */
function nameKey(l2: string, l3: string): string {
  return `${l2.trim().toLowerCase()}::${l3.trim().toLowerCase()}`.replace(
    /\s+/g,
    " ",
  );
}

// ===========================================================================
//   Helpers — view-model builders
// ===========================================================================

function buildL4FromOverlay(
  l4: CapabilityL4,
  overlayProcess: TowerProcess,
  source: InitiativeL4Source,
  tower: Tower,
): InitiativeL4 {
  // Click target preference: full initiative on "primary" rows, brief on
  // sub-process rows that have a brief, nothing otherwise.
  const initiative = findAiInitiative(tower, overlayProcess);
  const briefSlug =
    overlayProcess.briefSlug ?? briefByRowId[overlayProcess.id] ?? undefined;
  return {
    id: l4.id,
    name: l4.name,
    source,
    isPlaceholder: false,
    aiPriority: overlayProcess.aiPriority,
    aiRationale: overlayProcess.aiRationale,
    frequency: overlayProcess.frequency,
    criticality: overlayProcess.criticality,
    currentMaturity: overlayProcess.currentMaturity,
    initiativeId: initiative?.id,
    briefSlug,
  };
}

/**
 * Build an InitiativeL4 view-model from the composer output. Only invoked
 * when no `operating-models.ts` overlay or fuzzy match attached to the L4 —
 * so the composer is the sole curation source. The composer itself
 * already prefers any direct curation fields baked onto the canonical L4.
 */
function buildL4FromComposedVerdict(
  l4: CapabilityL4,
  verdict: ComposedVerdict,
): InitiativeL4 {
  return {
    id: l4.id,
    name: l4.name,
    source: "curated",
    isPlaceholder: false,
    aiPriority: verdict.aiPriority,
    aiRationale: verdict.aiRationale,
    frequency: verdict.frequency,
    criticality: verdict.criticality,
    currentMaturity: verdict.currentMaturity,
    initiativeId: verdict.initiativeId,
    briefSlug: verdict.briefSlug,
  };
}

/**
 * Synthesize a placeholder L4 for ghost-L3 prevention. Returned only when
 * an L3's dial is > 0 but no curated L4 surfaced through the overlay or
 * fuzzy match. Priority is derived from the dial level so the placeholder
 * still groups correctly on the AI roadmap.
 */
function buildPlaceholderL4Fallback(rowId: string, aiPct: number): InitiativeL4 {
  const aiPriority: AiPriority =
    aiPct >= 50
      ? "P1 — Immediate (0-6mo)"
      : aiPct >= 25
        ? "P2 — Near-term (6-12mo)"
        : "P3 — Medium-term (12-24mo)";
  return {
    id: `${rowId}-placeholder`,
    name: "Discovery activity — to be sequenced",
    source: "placeholder",
    isPlaceholder: true,
    aiPriority,
    aiRationale:
      "Pending discovery — tower-lead workshop will identify the specific Versant activities under this capability and the agent that delivers them. The L3 is in scope because the dial set on Step 2 is greater than zero.",
  };
}

// ===========================================================================
//   Dev-mode consistency assertion
// ===========================================================================

const DRIFT_TOLERANCE_USD = 1; // sub-dollar floating-point tolerance.

/**
 * Throws in development if Step 4's per-L3 AI $ sum doesn't match Step 2's
 * `modeledSavingsForTower(...).ai` for the same tower. The two should be
 * identical because Step 4 routes every $ through the exact same selector
 * code that Step 2 does — any mismatch indicates filtering changed the math.
 *
 * Filtering can only *omit* rows where `aiPct === 0` (which contribute $0
 * anyway), so the totals must be equal regardless of how many L4s rendered.
 */
export function assertImpactConsistency(
  result: SelectInitiativesResult,
  towerAiTotal: number,
): void {
  const summed = result.l2s.reduce((s, l2) => s + l2.totalAiUsd, 0);
  const drift = Math.abs(summed - towerAiTotal);
  if (drift <= DRIFT_TOLERANCE_USD) return;
  const msg = [
    `[forge.selectInitiatives] Impact consistency violation for tower "${result.towerId}".`,
    `  Step 4 sum-of-L3 AI $:    $${summed.toFixed(0)}`,
    `  Step 2 modeled AI total:  $${towerAiTotal.toFixed(0)}`,
    `  Drift:                    $${drift.toFixed(0)}`,
    `  This means Step 4 filtered out a row that contributes AI $ on Step 2,`,
    `  or Step 4 introduced new arithmetic that bypasses scenarioModel.ts.`,
    `  Inspect selector filtering logic. (This is a dev-mode-only assertion.)`,
  ].join("\n");
  throw new Error(msg);
}

// ===========================================================================
//   Lookup helpers used by deep-dive routes
// ===========================================================================

/**
 * Resolve an L3 capability id to its full 4-lens initiative + L4 row. Used by
 * `/tower/[slug]/process/[l3-slug]` to navigate through canonical L3 ids
 * (instead of legacy initiative-name slugs). When no curated L4 surfaces, we
 * return undefined and the caller renders a placeholder page.
 */
export function findInitiativeByL3Id(
  result: SelectInitiativesResult,
  l3Id: string,
): { l3: InitiativeL3; primaryL4?: InitiativeL4 } | undefined {
  for (const l2 of result.l2s) {
    for (const l3 of l2.l3s) {
      if (l3.l3.id !== l3Id) continue;
      const primaryL4 = l3.l4s.find((x) => x.initiativeId);
      return { l3, primaryL4 };
    }
  }
  return undefined;
}

/** Resolve an L4 view-model into a `Process` (the 4-lens deep-dive object). */
export function resolveL4Initiative(
  l4: InitiativeL4,
  tower: Tower,
): Process | undefined {
  if (!l4.initiativeId) return undefined;
  return tower.processes.find((p) => p.id === l4.initiativeId);
}

/** Resolve an L4 view-model into the AIProcessBrief (lightweight pre/post). */
export function resolveL4Brief(l4: InitiativeL4): AIProcessBrief | undefined {
  if (!l4.briefSlug) return undefined;
  return processBriefsBySlug.get(l4.briefSlug);
}
