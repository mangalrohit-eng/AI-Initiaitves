/**
 * Derive `L3WorkforceRowV6[]` from the existing `L4WorkforceRow[]` upload.
 *
 * Under v6 the dial-bearing primary entity is L3 (Job Family). Tower leads
 * still upload at L4 Activity Group grain (the workshop template hasn't
 * changed) — this helper rolls those L4 rows up to L3 by grouping on
 * `(l1, l2, l3)` and summing headcount + spend.
 *
 * Used in two places:
 *   1. `useTowerAssessOps.importOp` — every tower-lead upload triggers a
 *      fresh derivation alongside the L4 row write.
 *   2. The v5 -> v6 read-time migration in `localStore.migrateAssessProgram`
 *      — first time a v5 blob is loaded under v6, derive l3Rows so Step 2
 *      and Step 4 have something to render.
 *
 * Pure function — no side effects, deterministic order (canonical order of
 * first-seen `(l2, l3)` pairs from the input). Produces no warnings; rows
 * missing an L3 label are silently dropped (the upstream parser already
 * rejects them with a hard error).
 *
 * Dial values are intentionally LEFT UNDEFINED on every derived row. Per
 * the locked-in "fresh-start with backup" migration strategy, dials are
 * not auto-aggregated from L4 — the tower lead re-sets them at L3 grain
 * on Step 2. The pre-migration backup mirror in `localStore.ts` preserves
 * the pre-cutover v5 state if the user ever wants to inspect it.
 *
 * Each derived row is stamped `curationStage: "queued"` so the
 * StaleCurationBanner (Step 4) lights up immediately and invites the user
 * to run the per-L3 LLM curation pipeline.
 */
import type {
  L3WorkforceRowV6,
  L4WorkforceRow,
  TowerId,
} from "@/data/assess/types";
import { getTowerFunctionName } from "@/data/towerFunctionNames";

/**
 * Slugify a string for inclusion in an L3 row id. Mirrors the slug rules
 * used elsewhere in `data/assess/types.ts` style id construction:
 *   - lowercase
 *   - non-alphanumerics become single hyphens
 *   - trim leading / trailing hyphens
 *   - capped at 32 chars (room for L1 + L2 + L3 segments + separators)
 *   - empty input falls back to "x" so the id segment is never empty
 */
function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "x"
  );
}

/**
 * Build the stable id for a derived L3 row. Encodes towerId + the four
 * identity strings so cross-tower id collisions are impossible (every L3
 * id is globally unique within the program), and so v6 -> v6 round-trips
 * preserve the same id when the underlying L4 names are unchanged.
 */
export function deriveL3RowId(
  towerId: TowerId,
  l1: string,
  l2: string,
  l3: string,
): string {
  return `${towerId}::${slugify(l1)}::${slugify(l2)}::${slugify(l3)}`;
}

/**
 * Roll an array of L4 Activity Group rows up to L3 Job Family rows.
 *
 * Aggregation rules:
 *   - Headcount fields (`fteOnshore`, `fteOffshore`, `contractorOnshore`,
 *     `contractorOffshore`) are summed across child L4 rows.
 *   - `annualSpendUsd` is summed only across L4 rows that explicitly carry
 *     a positive value; the field is omitted entirely when no child L4
 *     row has spend (so the math layer falls back to headcount × rates).
 *   - `childL4RowIds` preserves first-seen insertion order so the Step 2
 *     UI can render the L4 chips inside an expanded L3 row in their
 *     original sequence.
 *
 * Group order is the canonical order of first-encountered `(l2, l3)`
 * pairs in the input — same convention the v5 selector uses.
 */
export function deriveL3Rows(
  l4Rows: ReadonlyArray<L4WorkforceRow>,
  towerId: TowerId,
): L3WorkforceRowV6[] {
  const fallbackL1 = getTowerFunctionName(towerId);

  type Acc = {
    id: string;
    l1: string;
    l2: string;
    l3: string;
    fteOnshore: number;
    fteOffshore: number;
    contractorOnshore: number;
    contractorOffshore: number;
    annualSpendUsd: number;
    hasSpend: boolean;
    childL4RowIds: string[];
  };

  const order: string[] = [];
  const groups = new Map<string, Acc>();

  for (const row of l4Rows) {
    const l2 = (row.l2 || fallbackL1).trim();
    const l3 = (row.l3 || "").trim();
    // Rows missing an L3 label can't be rolled up. The upstream parser /
    // migration rejects these on the L4 path; defensively skip here so a
    // malformed legacy blob doesn't crash the derivation.
    if (!l3) continue;

    const key = `${l2.toLowerCase()}\u0000${l3.toLowerCase()}`;
    let acc = groups.get(key);
    if (!acc) {
      acc = {
        id: deriveL3RowId(towerId, fallbackL1, l2, l3),
        l1: fallbackL1,
        l2,
        l3,
        fteOnshore: 0,
        fteOffshore: 0,
        contractorOnshore: 0,
        contractorOffshore: 0,
        annualSpendUsd: 0,
        hasSpend: false,
        childL4RowIds: [],
      };
      groups.set(key, acc);
      order.push(key);
    }

    acc.fteOnshore += row.fteOnshore || 0;
    acc.fteOffshore += row.fteOffshore || 0;
    acc.contractorOnshore += row.contractorOnshore || 0;
    acc.contractorOffshore += row.contractorOffshore || 0;
    if (typeof row.annualSpendUsd === "number" && row.annualSpendUsd > 0) {
      acc.annualSpendUsd += row.annualSpendUsd;
      acc.hasSpend = true;
    }
    acc.childL4RowIds.push(row.id);
  }

  return order.map((k) => {
    const a = groups.get(k)!;
    const out: L3WorkforceRowV6 = {
      id: a.id,
      l1: a.l1,
      l2: a.l2,
      l3: a.l3,
      fteOnshore: a.fteOnshore,
      fteOffshore: a.fteOffshore,
      contractorOnshore: a.contractorOnshore,
      contractorOffshore: a.contractorOffshore,
      childL4RowIds: a.childL4RowIds,
      // Mark every freshly derived row queued so the StaleCurationBanner
      // (Step 4) invites the user to run the per-L3 LLM curation pipeline.
      // Phase 3 will compute a content hash here; Phase 2 leaves it
      // undefined so the row reads as definitively-stale.
      curationStage: "queued",
    };
    if (a.hasSpend) out.annualSpendUsd = a.annualSpendUsd;
    return out;
  });
}
