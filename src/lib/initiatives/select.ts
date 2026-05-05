/**
 * AI Initiatives selector — the single source of truth for Step 4's view-models.
 *
 * Joins the canonical capability map (L1→L5 hierarchy under V5), the live
 * `AssessProgramV5` dial (per-L4 Activity Group AI %, modeled $), and the
 * curated Versant-specific overlay (`TowerProcess` rows in
 * `data/operating-models.ts`) into a unified shape that the AI Initiatives UI
 * consumes directly.
 *
 * ───────────────────────────────────────────────────────────────────────────
 *   Financial integrity contract
 * ───────────────────────────────────────────────────────────────────────────
 * Every $ rendered by AI Initiatives flows through `rowAnnualCost` +
 * `rowModeledSaving` from `lib/assess/scenarioModel.ts`. There is no new
 * arithmetic in this file — we read the pool/AI numbers and pass them through.
 *
 * The dev-mode helper `assertImpactConsistency` checks that the sum of per-L4
 * Activity Group AI $ on Step 4 (post-filter) equals the unfiltered tower AI
 * total from `modeledSavingsForTower`. Filtering can only *omit* rows where
 * the dial is 0; any other discrepancy is a bug and throws in dev (silent in
 * prod).
 *
 * ───────────────────────────────────────────────────────────────────────────
 *   Filtering rules
 * ───────────────────────────────────────────────────────────────────────────
 *   - L5 Activity renders only when the `TowerProcess` overlay says
 *     `aiEligible: true` OR the L5 itself carries `aiCurationStatus:
 *     "curated"` (Phase 2 path).
 *   - L4 Activity Group renders only when its `aiImpactAssessmentPct > 0`.
 *     If it has zero curated L5 Activities but dial > 0, we synthesize a
 *     "discovery activity" placeholder L5 (ghost-Activity-Group prevention)
 *     so the L4 stays visible — the full per-L4 Activity Group $ will appear
 *     on Step 4 even before the editorial sweep is complete.
 *   - L3 Job Family renders only when at least one L4 Activity Group renders.
 */
import type {
  Tower,
  TowerProcess,
  AiPriority,
  Feasibility,
  Process,
  AIProcessBrief,
} from "@/data/types";
import type {
  CapabilityL2,
  CapabilityL3,
  CapabilityL4,
  CapabilityL5,
} from "@/data/capabilityMap/types";
import { getCapabilityMapForTower } from "@/data/capabilityMap/maps";
import type {
  AssessProgramV2,
  L4WorkforceRow,
  L5Item,
  TowerId,
} from "@/data/assess/types";
import { defaultTowerBaseline, defaultTowerRates } from "@/data/assess/types";
import {
  modeledSavingsForTower,
  rowModeledSaving,
} from "@/lib/assess/scenarioModel";
import { processBriefsBySlug } from "@/data/processBriefs";
import { briefByRowId } from "@/data/briefMap";
import { findAiInitiative } from "@/lib/utils";
import { buildProcessByL4Map, fuzzyMatchL4 } from "./processL4Map";
import { composeL4Verdict, type ComposedVerdict } from "./composeVerdict";
import { computeFeasibility } from "./feasibility";
import { isCacheValidForRow } from "./curationHash";
import { resolveRowDescriptions } from "@/data/capabilityMap/descriptions";

// ===========================================================================
//   View-model types
// ===========================================================================

export type InitiativeL4Source = "curated" | "fuzzy-match" | "placeholder";

export type InitiativeL4 = {
  /** Stable id from the canonical map. Placeholder L4s use a synthetic id. */
  id: string;
  /** Display name from the canonical L4 (or the placeholder copy). */
  name: string;
  /**
   * AI-initiative-style headline — what the agent does, not the underlying
   * activity (e.g. `"Bank reconciliation automation"` for an L5 named
   * `"Bank Reconciliations"`). Populated when the LLM, the hand-authored
   * overlay, or the deterministic fallback emits one. UI uses this as the
   * primary card title and falls back to `name` when undefined. Always
   * undefined for placeholders and not-eligible L5s.
   */
  initiativeName?: string;
  /** Curation provenance — how the curated metadata got attached. */
  source: InitiativeL4Source;
  /** True when the row is a synthesized placeholder for ghost-L3 prevention. */
  isPlaceholder: boolean;
  // ----- Curated metadata (undefined for placeholders until editorial sweep)
  /**
   * @deprecated Per-L4 P-tier is no longer the program priority signal —
   * cross-tower priority lives on `ProgramInitiativeRow.programTier`. Field
   * is retained ONLY as a back-compat input to `feasibility` derivation
   * and as a snapshot value on legacy `InitiativeReviewSnapshot`. Never
   * render as a priority chip on Step 4.
   */
  aiPriority?: AiPriority;
  /**
   * Binary ship-readiness — feeds the program-level 2x2. Stamped by every
   * read path; undefined only on placeholder rows (which never make it
   * into the cross-tower selector anyway).
   */
  feasibility?: Feasibility;
  aiRationale?: string;
  frequency?: TowerProcess["frequency"];
  criticality?: TowerProcess["criticality"];
  currentMaturity?: TowerProcess["currentMaturity"];
  /** Named vendor when the curation layer surfaced one — feeds the heuristic feasibility fallback and UI. */
  primaryVendor?: string;
  // ----- Click-through targets (one of: full 4-lens, brief, llm-brief, or none)
  initiativeId?: string;
  briefSlug?: string;
  /**
   * Lazy-LLM brief route. Emitted only for LLM-curated L4s (Path 0 cache
   * hit) that don't carry a hand-curated `briefSlug` overlay match. The
   * UI prefers `initiativeId` → `briefSlug` → `llmBriefHref`. Resolves to
   * `/tower/[slug]/brief/llm/[rowId]/[l4Id]` and the page generates the
   * brief on first visit, caching the result on `L4Item.generatedProcess` (full
   * `Process`) or legacy `L4Item.generatedBrief` for older stores.
   */
  llmBriefHref?: string;
};

export type InitiativeL3 = {
  /**
   * Pre-migration: the L3 Capability this card represents. Post-migration
   * (5-layer): the L3 Job Family the row sits under (the natural section
   * grouping). For per-row labels, prefer `rowL4Name` — the Activity Group
   * the L4WorkforceRow itself represents. Phase 8 rename pending.
   */
  l3: CapabilityL3;
  /** L2 row this L3 sits under (denormalized for header rendering). */
  l2Name: string;
  l2Id: string;
  /**
   * The L4 Activity Group name the row IS. Post-5-layer-migration, the row
   * grain is per Activity Group, so this is the per-row display label.
   * Captured here so review snapshots can stamp `l4Name` without re-walking
   * the program state. Pre-migration this was implicit in `l3.name`.
   */
  rowL4Name: string;
  /**
   * Mirror of `L4WorkforceRow.id` (the Activity Group id) so UI can deep-link
   * to Step 2 anchors and snapshots can capture a stable parent reference.
   */
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
  /** Sum of per-L4 Activity Group AI $ across rows shown under this L2 / L3 path. */
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
    /**
     * Rows in `curationStage: "queued"` — i.e. capability map was uploaded
     * but the AI initiatives haven't been refreshed yet. Empty-state copy
     * uses this to differentiate "your map is queued, click Refresh in the
     * banner above" from "no L3 has its AI dial > 0, raise it on Step 2".
     */
    queuedRowCount: number;
    /** Total row count for the tower (queued + non-queued). */
    totalRowCount: number;
    /** Source-mix counts — verdict provenance across L4s in this tower. */
    sourceMix: {
      canonical: number;
      overlay: number;
      rubric: number;
      /** Step 1 map only; selector Path C uses composeL4Verdict (never `l4item`). */
      l4item: number;
      legacyTowerProcess: number;
      /** L5 surfaced from row.l5Items pipeline cache (Path 0). */
      l5Items: number;
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
  const rates = towerState?.rates ?? defaultTowerRates(towerId);
  const l4Rows: L4WorkforceRow[] = towerState?.l4Rows ?? [];

  const overlay = buildProcessByL4Map(tower);
  const claimed = new Set<string>(Array.from(overlay.values()).map((p) => p.id));

  let l3WithDialZero = 0;
  let l3GhostPlaceholders = 0;
  let l4Curated = 0;
  let l4Placeholders = 0;
  let overlayHits = 0;
  let overlayFuzzyHits = 0;
  /**
   * Sum of aiUsd for rows that the selector dropped from the rendered L3
   * list (queued rows with no surfaced L4s). They still contribute to the
   * Step 2 totals but NOT to the Step 4 view, so the dev-mode consistency
   * assertion subtracts this amount from the expected total before
   * comparing against the rendered sum.
   */
  let skippedAiUsd = 0;
  // Provenance counters for the source-mix diagnostic — useful for spotting
  // when an overlay rule isn't firing or the rubric is over-eager.
  const sourceMix = {
    canonical: 0,
    overlay: 0,
    rubric: 0,
    l4item: 0,
    legacyTowerProcess: 0,
    l5Items: 0,
  };

  // Build L4 (Activity Group) lookup tables off the canonical map. We index by
  // both id and a normalized "L3 + L4 name" key so a row imported with a
  // different id (but same names) still finds its canonical L5 Activity list.
  // Post-5-layer migration: the dial-bearing row is L4 (Activity Group); AI
  // initiatives attach to its L5 children.
  type MapL4Hit = {
    l2: CapabilityL2;
    l3: CapabilityL3;
    l4: CapabilityL4;
  };
  const mapL4ById = new Map<string, MapL4Hit>();
  const mapL4ByNameKey = new Map<string, MapL4Hit>();
  // Canonical L3 (Job Family) ordering — used to sort the output panels stably.
  // Pre-migration this was keyed by L2 (Pillar); the dummy L2 wrapper means
  // every map has a single L2 today, so meaningful UI grouping happens at L3.
  const l3OrderById = new Map<string, number>();
  if (map) {
    let order = 0;
    for (const l2 of map.l2) {
      for (const l3 of l2.l3) {
        l3OrderById.set(l3.id, order);
        order += 1;
        for (const l4 of l3.l4) {
          if (l4.relatedTowerIds && !l4.relatedTowerIds.includes(towerId)) continue;
          const hit: MapL4Hit = { l2, l3, l4 };
          mapL4ById.set(l4.id, hit);
          mapL4ByNameKey.set(nameKey(l3.name, l4.name), hit);
        }
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

  for (const row of l4Rows) {
    const saving = rowModeledSaving(row, baseline, rates);

    // Resolve canonical metadata (id-first, name-key fallback for stale data).
    // The row IS an L4 Activity Group, so its id matches a CapabilityL4 id,
    // and its (l3, l4) name pair is the unique fallback key.
    const mapHit =
      mapL4ById.get(row.id) ?? mapL4ByNameKey.get(nameKey(row.l3, row.l4));

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

    // Path 0 — pipeline cache short-circuit. When `row.l5Items` is populated
    // and `row.curationContentHash` matches the row's current name footprint,
    // the cache IS the source of truth and we skip the canonical-map walk
    // entirely. This is the post-refresh state — the curationPipeline
    // orchestrator wrote l5Items + l5Activities + hash atomically, so
    // re-deriving the hash from l5Activities here is guaranteed to match.
    if (
      isCacheValidForRow(
        row,
        resolveRowDescriptions(towerId, row.l2, row.l3, row.l4),
      ) &&
      row.l5Items
    ) {
      for (const item of row.l5Items) {
        if (!item.aiEligible) continue;
        l4Views.push(buildL4FromCachedItem(item, towerId, row.id));
        l4Curated += 1;
        curatedHere += 1;
        sourceMix.l5Items += 1;
      }
    } else if (row.curationStage === "queued") {
      // Post-upload: the user's capability map is fresh and the LLM
      // pipeline hasn't run yet. Suppress the canonical-map composer
      // walk so we don't misleadingly surface the SEED tower's curated
      // L4s as if they applied to the user's just-uploaded rows. The
      // StaleCurationBanner above already messages the Refresh CTA;
      // showing pre-curated stale content alongside it would contradict
      // the "queued" signal and lower content quality below the
      // Versant-grounded bar.
      // (intentional no-op — l4Views stays empty for this row)
    } else if (mapHit) {
      // Walk the L5 leaves of the matched L4 (Activity Group). AI initiatives
      // attach to L5 Activities; the L4 row is the dial-bearing aggregator.
      for (const l5 of mapHit.l4.l5) {
        if (l5.relatedTowerIds && !l5.relatedTowerIds.includes(towerId)) continue;

        // Path A — legacy `operating-models.ts` TowerProcess overlay (still
        // primary when present, since those rows carry hand-authored 4-lens
        // initiative + brief links the composer can't synthesize). The
        // overlay file's keys are the canonical leaf ids, which are now L5.
        const overlayProcess = overlay.get(l5.id);
        if (overlayProcess) {
          if (overlayProcess.aiEligible) {
            l4Views.push(buildL4FromOverlay(l5, overlayProcess, "curated", tower));
            l4Curated += 1;
            curatedHere += 1;
            overlayHits += 1;
            sourceMix.legacyTowerProcess += 1;
          }
          continue;
        }

        // Path B — fuzzy name match against TowerProcess overlay; claim-
        // protected so a single TowerProcess doesn't spread across multiple
        // L5 Activities.
        const fuzzy = fuzzyMatchL4(l5, tower, claimed);
        if (fuzzy && fuzzy.aiEligible) {
          claimed.add(fuzzy.id);
          l4Views.push(buildL4FromOverlay(l5, fuzzy, "fuzzy-match", tower));
          l4Curated += 1;
          curatedHere += 1;
          overlayFuzzyHits += 1;
          sourceMix.legacyTowerProcess += 1;
          continue;
        }

        // Path C — composer (canonical-fields-on-L5 → overlay → rubric).
        // Covers every L5 that doesn't have a TowerProcess overlay.
        const verdict = composeL4Verdict({
          towerId,
          l2Name: mapHit.l3.name,
          l3Name: mapHit.l4.name,
          l4: l5,
        });
        sourceMix[verdict.source] += 1;
        if (verdict.status === "curated") {
          l4Views.push(buildL4FromComposedVerdict(l5, verdict));
          l4Curated += 1;
          curatedHere += 1;
        }
        // `reviewed-not-eligible` and `pending-discovery` from the composer
        // are intentionally skipped here — the L4 row still gets a
        // placeholder below if no curated L5 surfaced.
      }
    }

    // Ghost-L3 prevention: dial > 0 but no curated L4 surfaced (either no map
    // hit at all, or the map L4s all fell through). Synthesize a placeholder
    // so the L3 stays visible and its $ is still attributed.
    //
    // Exception: when the row is `queued` (post-upload state — the LLM
    // pipeline hasn't run yet), suppress the placeholder so Step 4 reads
    // empty. The StaleCurationBanner above already tells the user what
    // to do, and showing a wall of "No AI candidates found" placeholders
    // for every row would be a worse UX than a clean empty state.
    if (l4Views.length === 0 && row.curationStage !== "queued") {
      l4Views.push(buildPlaceholderL4Fallback(row.id));
      l4Placeholders += 1;
      placeholdersHere += 1;
      l3GhostPlaceholders += 1;
    }

    // When the row is queued and produced zero L4s, skip the L3 entirely —
    // it has nothing to render and the banner above is already messaging
    // the refresh action. Track the skip so the dev-mode consistency
    // assertion below can subtract these rows' aiUsd from the expected
    // total (they DO contribute to Step 2 totals but not to Step 4).
    if (l4Views.length === 0) {
      skippedAiUsd += saving.ai;
      continue;
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
      // L2 ordering: under the dummy-Job-Grouping era there's a single L2 per
      // map (the function wrapper), so the canonical L2 always sorts to 0;
      // synthesized "Uncategorised" buckets fall after with monotonic order.
      const order = mapHit ? 0 : synthOrderBase + synthOrderCursor++;
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
      rowL4Name: row.l4 || row.l3 || "Activity Group",
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

  const towerSummary = l4Rows.length
    ? modeledSavingsForTower(l4Rows, baseline, rates)
    : { pool: 0, offshorePct: 0, aiPct: 0, offshore: 0, ai: 0, combined: 0 };

  // Queued rows are excluded from the L3 list above (they render an empty
  // Step 4 until the refresh runs), but their $ is still in the tower-level
  // total. Track the excluded ai$ so the dev-mode consistency assertion
  // can subtract it before comparing against the rendered sum.
  const queuedRowCount = l4Rows.filter(
    (r) => r.curationStage === "queued",
  ).length;

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
      queuedRowCount,
      totalRowCount: l4Rows.length,
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
      sourceMix.l4item +
      sourceMix.legacyTowerProcess +
      sourceMix.l5Items;
    if (total > 0) {
      // eslint-disable-next-line no-console
      console.debug(
        `[forge.selectInitiatives] tower="${towerId}" L5 source mix:`,
        `canonical=${sourceMix.canonical}`,
        `overlay=${sourceMix.overlay}`,
        `rubric=${sourceMix.rubric}`,
        `l4item=${sourceMix.l4item}`,
        `legacy=${sourceMix.legacyTowerProcess}`,
        `l5Items=${sourceMix.l5Items}`,
      );
    }
  }

  // Run the dev assertion in development only — never in production builds.
  // The loop above excludes (a) rows where saving.aiPct === 0 (contribute $0)
  // and (b) rows where the selector produced no L4 views (queued rows whose
  // canonical-map walk + composer fell through). The skipped rows DO
  // contribute to Step 2 totals but NOT to Step 4 — subtract them before
  // comparing so the remaining drift must be zero.
  if (process.env.NODE_ENV !== "production") {
    assertImpactConsistency(result, towerSummary.ai - skippedAiUsd);
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
  l4: CapabilityL5,
  overlayProcess: TowerProcess,
  source: InitiativeL4Source,
  tower: Tower,
): InitiativeL4 {
  // Click target preference: full initiative on "primary" rows, brief on
  // sub-process rows that have a brief, nothing otherwise.
  const initiative = findAiInitiative(tower, overlayProcess);
  const briefSlug =
    overlayProcess.briefSlug ?? briefByRowId[overlayProcess.id] ?? undefined;
  const feasibility = computeFeasibility({
    feasibility: overlayProcess.feasibility,
    aiPriority: overlayProcess.aiPriority,
    currentMaturity: overlayProcess.currentMaturity,
    frequency: overlayProcess.frequency,
  });
  return {
    id: l4.id,
    name: l4.name,
    source,
    isPlaceholder: false,
    aiPriority: overlayProcess.aiPriority,
    feasibility,
    aiRationale: overlayProcess.aiRationale,
    frequency: overlayProcess.frequency,
    criticality: overlayProcess.criticality,
    currentMaturity: overlayProcess.currentMaturity,
    initiativeId: initiative?.id,
    briefSlug,
  };
  // Note: this overlay path comes from `operating-models.ts` `TowerProcess`
  // entries which don't carry an `initiativeName` field. The composer
  // (`composeL4Verdict`) handles that for non-overlay paths; if a tower
  // lead wants a custom initiativeName on an overlay row, set it via
  // `aiCurationOverlay` instead.
}

/**
 * Build an InitiativeL4 view-model from the composer output. Only invoked
 * when no `operating-models.ts` overlay or fuzzy match attached to the L4 —
 * so the composer is the sole curation source. The composer itself
 * already prefers any direct curation fields baked onto the canonical L4.
 */
function buildL4FromComposedVerdict(
  l4: CapabilityL5,
  verdict: ComposedVerdict,
): InitiativeL4 {
  // Composer already resolved feasibility (rubric direct, or canonical/overlay
  // explicit-then-aiPriority-fallback). We pass it through and only re-run the
  // heuristic if the composer returned undefined — which only happens when
  // the L4 has no curation signal at all.
  const feasibility =
    verdict.feasibility ??
    computeFeasibility({
      aiPriority: verdict.aiPriority,
      currentMaturity: verdict.currentMaturity,
      frequency: verdict.frequency,
      primaryVendor: verdict.primaryVendor,
    });
  return {
    id: l4.id,
    name: l4.name,
    initiativeName: verdict.initiativeName,
    source: "curated",
    isPlaceholder: false,
    aiPriority: verdict.aiPriority,
    feasibility,
    aiRationale: verdict.aiRationale,
    frequency: verdict.frequency,
    criticality: verdict.criticality,
    currentMaturity: verdict.currentMaturity,
    primaryVendor: verdict.primaryVendor,
    initiativeId: verdict.initiativeId,
    briefSlug: verdict.briefSlug,
  };
}

/**
 * Build an InitiativeL4 from the pipeline cache (Path 0). Only invoked when
 * `isCacheValidForRow(row)` returned true — i.e. the curationPipeline
 * orchestrator has stamped this row's l5Items and the row's name footprint
 * has not changed since.
 *
 * Click-through preference (renderer reads top-down):
 *   1. `initiativeId`  — full 4-lens hand-curated deep-dive.
 *   2. `briefSlug`     — hand-curated AIProcessBrief from the overlay.
 *   3. `llmBriefHref`  — lazy LLM brief route, populated here when the L5
 *                        is LLM-curated and has no overlay match. The page
 *                        generates and caches the brief on first visit.
 */
function buildL4FromCachedItem(
  item: L5Item,
  towerId: TowerId,
  rowId: string,
): InitiativeL4 {
  const llmBriefHref =
    !item.briefSlug && !item.initiativeId && item.aiEligible
      ? `/tower/${towerId}/brief/llm/${encodeURIComponent(rowId)}/${encodeURIComponent(item.id)}`
      : undefined;
  const feasibility = computeFeasibility({
    feasibility: item.feasibility,
    aiPriority: item.aiPriority,
    currentMaturity: item.currentMaturity,
    frequency: item.frequency,
    primaryVendor: item.primaryVendor,
  });
  return {
    id: item.id,
    name: item.name,
    initiativeName: item.initiativeName,
    source: "curated",
    isPlaceholder: false,
    aiPriority: item.aiPriority,
    feasibility,
    aiRationale: item.aiRationale,
    frequency: item.frequency,
    criticality: item.criticality,
    currentMaturity: item.currentMaturity,
    primaryVendor: item.primaryVendor,
    initiativeId: item.initiativeId,
    briefSlug: item.briefSlug,
    llmBriefHref,
  };
}

/**
 * Synthesize a placeholder L4 for ghost-L3 prevention. Returned only when
 * an L3's dial is > 0 but no curated L4 surfaced through the overlay or
 * fuzzy match.
 *
 * Placeholders deliberately leave `feasibility` undefined — they're a
 * "we don't yet know what to ship here" signal, not a feasibility
 * judgment. The cross-tower selector skips placeholders entirely, so the
 * undefined value never reaches the program-tier 2x2.
 *
 * `aiPriority` is also intentionally left undefined: deriving a P-tier from
 * the dial percentage was a UI artefact of the legacy phase-roadmap layout
 * which has since been replaced by feasibility framing on Step 4.
 */
function buildPlaceholderL4Fallback(rowId: string): InitiativeL4 {
  return {
    id: `${rowId}-placeholder`,
    name: "No AI candidates found",
    source: "placeholder",
    isPlaceholder: true,
    aiRationale:
      "AI couldn't identify L5 Activities that are candidates for AI here. Regenerate the L5 Activity list on Step 1, or reduce the AI dial for this L4 Activity Group to zero on Step 2.",
  };
}

// ===========================================================================
//   Dev-mode consistency assertion
// ===========================================================================

const DRIFT_TOLERANCE_USD = 1; // sub-dollar floating-point tolerance.

/**
 * Throws in development if Step 4's per-L4 Activity Group AI $ sum doesn't
 * match Step 2's `modeledSavingsForTower(...).ai` for the same tower. The
 * two should be identical because Step 4 routes every $ through the exact
 * same selector code that Step 2 does — any mismatch indicates filtering
 * changed the math.
 *
 * Filtering can only *omit* rows where `aiPct === 0` (which contribute $0
 * anyway), so the totals must be equal regardless of how many L5 Activities
 * rendered.
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
    `  Step 4 sum-of-L4 Activity Group AI $:    $${summed.toFixed(0)}`,
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
 * Resolve an L4 Activity Group id to its full 4-lens initiative + L5 Activity
 * row. Used by `/tower/[slug]/process/[l3-slug]` (URL slug retained for
 * back-compat — semantically an Activity Group id under V5) to navigate
 * through canonical Activity Group ids (instead of legacy initiative-name
 * slugs). When no curated L5 Activity surfaces, we return undefined and the
 * caller renders a placeholder page.
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
