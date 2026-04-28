/**
 * Bridge: canonical capability-map L4 ↔ curated `TowerProcess` metadata.
 *
 * Phase 1 design: the AI Initiatives view (Step 4) renders the canonical
 * capability-map L1→L4 hierarchy and pulls per-L3 $ impact directly from the
 * `AssessProgramV4` dial via `rowModeledSaving`. Versant-specific curated
 * detail (priority, rationale, frequency, criticality, maturity, brief link,
 * 4-lens link) lives in `data/operating-models.ts` `TowerProcess` rows for
 * every tower today; this file joins those rows onto matching L4s.
 *
 * Phase 2 (later): the operating-models content migrates onto L4 records in
 * the capability-map files (the new fields on `CapabilityL4`), this overlay
 * file is removed, and `operating-models.ts` is retired.
 *
 * Match strategy (per L4):
 *
 *   1. Explicit override (`L4_TO_TOWER_PROCESS`). Use for tricky cases where
 *      L4 + TowerProcess names diverge (e.g. "Month-End Close Orchestration"
 *      vs "Monthly/Quarterly Financial Close & Consolidation").
 *
 *   2. Token-overlap fuzzy match (Jaccard ≥ 0.4 over normalized name tokens).
 *      Stopwords ignored. Highest score wins; ties → longer-name wins (more
 *      specific TowerProcess). Already-claimed TowerProcesses are removed
 *      from the candidate pool to prevent two L4s claiming the same row.
 *
 *   3. No match → L4 falls through to "pending-discovery" in the selector.
 */
import type { Tower, TowerProcess } from "@/data/types";
import type { CapabilityL4 } from "@/data/capabilityMap/types";

/**
 * Explicit overrides where fuzzy matching would either miss or attach the
 * wrong row. Keys are `capabilityL4Id`; values are `TowerProcess.id` from
 * `data/operating-models.ts`.
 *
 * Add an entry here only when a capability-map L4 has a TowerProcess
 * counterpart that the fuzzy matcher won't catch.
 */
const L4_TO_TOWER_PROCESS: Record<string, string> = {
  // ---------------- FINANCE -----------------------------------------
  "finance-l4-month-end-close": "fin-rep-1",
  "finance-l4-quarterly-close": "fin-rep-1",
  "finance-l4-multi-entity-consolidation": "fin-rep-1",
  "finance-l4-intercompany-eliminations": "fin-rep-4",
  "finance-l4-content-rights-amortization": "fin-rep-2",
  "finance-l4-revenue-recognition": "fin-rep-3",
  "finance-l4-mda-narrative": "fin-rep-5",
  "finance-l4-board-package": "fin-rep-8",
  "finance-l4-statutory-reporting": "fin-rep-6",
  "finance-l4-external-audit": "fin-rep-7",
  "finance-l4-cash-flow-forecast": "fin-tr-1",
  "finance-l4-bank-cash-mgmt": "fin-tr-4",
  "finance-l4-covenant-monitoring": "fin-tr-2",
  "finance-l4-dividend-execution": "fin-tr-3",
  "finance-l4-buyback-execution": "fin-tr-3",
  "finance-l4-fx-mgmt": "fin-tr-5",
  // P&A
  "finance-l4-annual-budget": "fin-fpa-2",
  "finance-l4-monthly-forecast": "fin-fpa-3",
  "finance-l4-variance-analysis": "fin-fpa-4",
  "finance-l4-content-roi": "fin-fpa-1",
  "finance-l4-ad-hoc-strategic": "fin-fpa-5",
  // IR
  "finance-l4-earnings-cycle": "fin-ir-1",
  "finance-l4-analyst-coverage": "fin-ir-2",
  "finance-l4-peer-benchmarking": "fin-ir-3",
  "finance-l4-shareholder-comms": "fin-ir-4",
  // Procurement
  "finance-l4-strategic-sourcing": "fin-proc-1",
  "finance-l4-po-processing": "fin-proc-2",
  "finance-l4-3-way-matching": "fin-proc-3",
  "finance-l4-spend-analytics": "fin-proc-4",
  "finance-l4-vendor-performance": "fin-proc-5",
  "finance-l4-contract-renewals": "fin-proc-6",

  // ---------------- HR ----------------------------------------------
  // The canonical HR map (`hr-localize-to-versant.ts`) uses `hr-loc-l4-*`
  // ids. Curated TowerProcess overlays in `operating-models.ts` still live
  // under `hr-ta-*`, `hr-onb-*`, `hr-tm-*`, `hr-cb-*`, `hr-wsa-*` (the prior
  // generation of the HR L4 list). Each canonical L4 below is hand-mapped
  // to the closest semantically-matching TowerProcess so its priority,
  // rationale, brief link, and 4-lens link surface in AI Initiatives.
  // Canonical L4s with no Versant-curated counterpart are intentionally
  // omitted — they correctly fall through to "pending discovery" until
  // someone authors a TowerProcess for them.
  //
  // HRBPs > HR Business Partners
  "hr-loc-l4-workforce-strategy": "hr-wsa-1",
  "hr-loc-l4-talent-planning": "hr-wsa-1",
  "hr-loc-l4-succession": "hr-tm-4",
  "hr-loc-l4-org-design": "hr-wsa-3",
  // Talent Acquisition > Talent Acquisition
  "hr-loc-l4-demand-forecasting": "hr-wsa-1",
  "hr-loc-l4-employer-branding": "hr-ta-6",
  "hr-loc-l4-sourcing-engagement": "hr-ta-1",
  "hr-loc-l4-recruiting-hiring": "hr-ta-2",
  "hr-loc-l4-new-joiner-onboarding": "hr-onb-1",
  // Talent Acquisition > Executive Talent Acquisition
  "hr-loc-l4-leadership-assessment": "hr-ta-4",
  "hr-loc-l4-exec-hiring-onboard": "hr-onb-2",
  // L&D > Learning and Development
  "hr-loc-l4-learning-experience": "hr-tm-2",
  "hr-loc-l4-learning-design": "hr-tm-2",
  "hr-loc-l4-learning-tech": "hr-tm-2",
  "hr-loc-l4-skills-strategy": "hr-tm-5",
  "hr-loc-l4-performance": "hr-tm-3",
  // Total Rewards > Compensation / Total Rewards
  "hr-loc-l4-comp-strategy": "hr-cb-1",
  "hr-loc-l4-benefits-strategy": "hr-cb-3",
  // HR Services > HR Operations
  "hr-loc-l4-people-analytics": "hr-wsa-2",
  "hr-loc-l4-pre-payroll": "hr-cb-2",
  // HR Services > HR Shared Services
  "hr-loc-l4-ld-delivery": "hr-tm-2",
  "hr-loc-l4-ta-delivery": "hr-ta-3",
};

const STOPWORDS = new Set([
  "the",
  "and",
  "a",
  "an",
  "of",
  "for",
  "to",
  "in",
  "on",
  "at",
  "by",
  "with",
  "from",
  "or",
  "as",
  "is",
  "be",
  "vs",
  "&",
]);

function normalizeTokens(s: string): Set<string> {
  const tokens = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((t) => t && !STOPWORDS.has(t) && t.length > 1);
  return new Set(tokens);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  a.forEach((t) => {
    if (b.has(t)) intersection += 1;
  });
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

const FUZZY_THRESHOLD = 0.4;

export type ProcessByL4Map = Map<string, TowerProcess>;

/**
 * Build a `Map<capabilityL4Id → TowerProcess>` for one tower.
 *
 * The map only includes L4s that have a confident match (override OR fuzzy
 * Jaccard ≥ 0.4). L4s without a match return undefined when looked up; the
 * selector treats those as `pending-discovery`.
 *
 * One TowerProcess can map to multiple L4s (e.g. the finance close primary
 * row covers both Month-End and Quarterly Close L4s). That's intentional —
 * the curated Versant rationale applies to both grains. Selector dedupes
 * the link target so the same brief / 4-lens isn't shown twice.
 */
export function buildProcessByL4Map(tower: Tower): ProcessByL4Map {
  const allProcesses: TowerProcess[] = tower.workCategories.flatMap((c) => c.processes);
  const byId = new Map<string, TowerProcess>();
  for (const p of allProcesses) byId.set(p.id, p);
  const map: ProcessByL4Map = new Map();
  for (const [l4Id, processId] of Object.entries(L4_TO_TOWER_PROCESS)) {
    const p = byId.get(processId);
    if (p) map.set(l4Id, p);
  }
  return map;
}

/**
 * Fallback fuzzy match for L4s not covered by the explicit override map.
 *
 * Iterates the tower's full TowerProcess pool, scores each candidate against
 * the L4 name, returns the best match if Jaccard ≥ 0.4.
 *
 * `claimed` is the set of TowerProcess ids already attached to other L4s
 * via overrides — they're skipped here so a single-row TowerProcess doesn't
 * spread across half a dozen L4s by name overlap alone.
 */
export function fuzzyMatchL4(
  l4: CapabilityL4,
  tower: Tower,
  claimed: Set<string>,
): TowerProcess | undefined {
  const target = normalizeTokens(l4.name);
  if (target.size === 0) return undefined;
  let best: { p: TowerProcess; score: number } | undefined;
  for (const cat of tower.workCategories) {
    for (const p of cat.processes) {
      if (claimed.has(p.id)) continue;
      const score = jaccard(target, normalizeTokens(p.name));
      if (score < FUZZY_THRESHOLD) continue;
      if (
        !best ||
        score > best.score ||
        (score === best.score && p.name.length > best.p.name.length)
      ) {
        best = { p, score };
      }
    }
  }
  return best?.p;
}
