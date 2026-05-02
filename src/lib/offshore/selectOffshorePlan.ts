/**
 * Offshore Plan (Step 5) — program-level deterministic selector.
 *
 * Pure function over `AssessProgramV2`. Loops every Versant tower, classifies
 * each L3 row into one of four lanes (GccEligible / GccWithOverlay /
 * OnshoreRetained / EditorialCarveOut), assigns it a destination
 * (PrimaryGcc / SecondaryGcc / ContactCenterHub / OnshoreRetained — the
 * actual city is resolved at render time via `offshoreLocationLabels`),
 * tags a transition wave, and rolls everything up to the program-wide
 * org-transition snapshot the `/offshore-plan` page renders.
 *
 * Classification cascade (per L3 row):
 *   1. `r.offshoreStrictCarveOut` (user-set / seeded from keyword detection
 *      on first mount) — wins over everything. Editorial reason → EditorialCarveOut;
 *      Talent / SOX / Sales reasons → OnshoreRetained.
 *   2. `options.llmLanes` (optional overlay produced by the
 *      /api/offshore-plan/classify route) — applied to non-carved-out rows
 *      when the user has clicked Regenerate.
 *   3. Heuristic fallback — uses tower default + the Step-2 dial bucket.
 *      Keyword detection is NOT used here anymore (keywords only seed the
 *      strict carve-out flag on first mount).
 *
 * Math discipline:
 *   - Headcount: same movable formula as `scenarioModel.computeRowOffshore`
 *     so Step 5 reconciles to Step 2 / Step 3 exactly.
 *   - Dollars: routed through `programImpactSummary` and `rowAnnualCost` —
 *     no new arithmetic. Step 5's `programOffshoreUsd` ≡ Step 3's
 *     `programImpactSummary().offshore`.
 *
 * Invariants:
 *   - retainedOnshore = todayOnshoreCount − migratingToGcc − migratingToContactCenterHub
 *   - editorialCarveOutCount ⊆ retainedOnshore
 *   - GCC India steady-state = migratingToGcc + todayOffshoreCount
 *   - movable per-row math matches scenarioModel.ts lines 158-167
 */
import type {
  AssessProgramV2,
  L3WorkforceRow,
  OffshoreAssumptions,
  TowerBaseline,
  TowerId,
} from "@/data/assess/types";
import { DEFAULT_OFFSHORE_ASSUMPTIONS } from "@/data/assess/types";
import { towers } from "@/data/towers";
import {
  programImpactSummary,
  rowAnnualCost,
  rowModeledSaving,
  towerRatesFromState,
  type ProgramImpactSummary,
} from "@/lib/assess/scenarioModel";

// ===========================================================================
//   Types
// ===========================================================================

export type CarveOutClass =
  | "GccEligible" // transactional, repeatable — primary GCC scope
  | "GccWithOverlay" // GCC + onshore overlay touch points
  | "OnshoreRetained" // strategic / relationship / executive judgment
  | "EditorialCarveOut"; // newsroom / on-air / talent — Brian Carovillano veto

/**
 * Role-based destination codes. The actual city name is resolved at render
 * time via `offshoreLocationLabels(program).cityForDestination(dest)` — it
 * reads from `program.offshoreAssumptions` which is editable in the
 * Assumptions tab. v1 routing rules (deterministic):
 *   - finance / hr → SecondaryGcc (default Pune)
 *   - service-tower contact-center work → ContactCenterHub (default Manila)
 *   - everything else → PrimaryGcc (default Bangalore)
 */
export type GccDestination =
  | "PrimaryGcc"
  | "SecondaryGcc"
  | "ContactCenterHub"
  | "OnshoreRetained";

/**
 * Provenance for a row's lane assignment. Used by the Scope tab to render a
 * `LLM` / `User carve-out` / `Heuristic` chip next to each row.
 */
export type ClassificationSource = "user-carve-out" | "seeded-carve-out" | "llm" | "heuristic";

export type UsLocation =
  | "NycHq" // 229 W 43rd — MS NOW, CNBC, Versant Corporate
  | "EnglewoodCliffs" // broadcast & production
  | "DcBureau" // News politics, leased from NBC
  | "Distributed"; // Versant Corporate distributed / TSA-supplied

export type CarveOutFlag = "Editorial" | "Talent" | "SOX" | "Sales";

export type WaveNumber = 1 | 2 | 3;
export type Tier = "HIGH" | "MEDIUM" | "LOW";
export type TsaTag = "Hr-Payroll" | "Tech-Infra" | "Finance" | "None";

/**
 * One assessment-row entry in the Step-5 Offshore Plan view.
 *
 * Under the 5-layer capability map (`AssessProgramV5`) one row corresponds to
 * an L4 Activity Group (formerly an L3 Capability under V4). The type name
 * mirrors the rung being classified: `OffshoreL4Row`. The historic
 * `OffshoreL3Row` alias is kept for back-compat with consumers that haven't
 * been renamed yet.
 */
export type OffshoreL4Row = {
  rowId: string;
  towerId: TowerId;
  towerName: string;
  /** L2 Job Grouping. */
  l2: string;
  /** L3 Job Family. */
  l3: string;
  /**
   * L4 Activity Group — the row being classified into a lane. Optional only
   * because legacy V4 programs hydrated through migration may transiently
   * leave this blank; in practice it is always populated for V5 programs.
   */
  l4: string;
  /** Headcount lens — the leadership-facing answer. */
  todayFteOnshore: number;
  todayFteOffshore: number;
  todayCtrOnshore: number;
  todayCtrOffshore: number;
  movableFte: number;
  movableContractor: number;
  retainedFte: number;
  retainedContractor: number;
  /** Dollar lens — sum over rows reconciles to programImpactSummary().offshore. */
  poolUsd: number;
  modeledOffshoreUsd: number;
  /** ≤15-word LLM rationale already produced in Step 2 (when available). */
  offshoreRationale?: string;
  /**
   * Step-5 LLM justification (2-3 sentences) — populated when the user has
   * clicked Regenerate and the row's lane came from the LLM. Distinct from
   * `offshoreRationale` (which is a 15-word Step-2 rationale).
   */
  justification?: string;
  /** Where this row's classification came from — drives provenance chips. */
  classificationSource: ClassificationSource;
  carveOut: CarveOutClass;
  /**
   * When the row is in a strict carve-out, the user-selected reason. Drives
   * the reason chip in the Scope tab and the Risks register's `affectedTowers`.
   */
  carveOutReason?: "Editorial" | "Talent" | "SOX" | "Sales";
  destination: GccDestination;
  fromLocations: UsLocation[]; // chip set — primary first
  /** null for OnshoreRetained / EditorialCarveOut rows. */
  wave: WaveNumber | null;
  tsaTag: TsaTag;
};

export type OffshoreTowerSummary = {
  towerId: TowerId;
  towerName: string;
  // headcount — INVARIANT: retained = todayOnshore − migratingToGcc − migratingToManila
  // INVARIANT: editorialCarveOutCount ⊆ retainedOnshore
  todayOnshoreCount: number;
  todayOffshoreCount: number;
  migratingToGcc: number;
  migratingToManila: number;
  retainedOnshore: number;
  editorialCarveOutCount: number;
  primaryUsLocations: UsLocation[];
  // dollars
  poolUsd: number;
  movableUsd: number;
  modeledOffshoreUsd: number;
  // narrative
  carveOutFlags: CarveOutFlag[];
  recommendedScope: string;
  retainedSpineSummary: string;
  /**
   * All L4 Activity Group rows in this tower, classified — drives the
   * Scope-by-tower drawer. Field name preserved for API stability; under
   * V5 each entry is an `OffshoreL4Row`.
   */
  rows: OffshoreL4Row[];
};

/**
 * @deprecated Renamed to `OffshoreL4Row` after the 5-layer migration. Re-
 * exported as an alias so existing imports keep compiling during cutover.
 */
export type OffshoreL3Row = OffshoreL4Row;

export type OffshoreWaveBucket = {
  wave: WaveNumber;
  windowMonths: string; // "M0-M9" / "M9-M18" / "M18-M24"
  windowStart: number; // 0 / 9 / 18
  windowEnd: number; // 9 / 18 / 24
  title: string; // "Stand up + bank covenant savings"
  rolesEnteringGcc: number; // sum of movable across the wave's rows
  scopeTowers: { towerId: TowerId; towerName: string; movable: number }[];
  scopeHeadlines: string[]; // L2-headline strings for the wave card
  tsaDependenciesCleared: TsaTag[];
  versantGatekeeper: string;
  gateCriteria: string;
  transitionCostTier: Tier;
};

export type OffshoreCarveOut = {
  flag: CarveOutFlag;
  title: string;
  description: string;
  gatekeeper: string;
  affectedTowers: TowerId[];
};

export type OffshoreRiskItem = {
  id: string;
  title: string;
  exposure: string; // 1-line Versant-grounded exposure
  mitigation: string; // 1-line mitigation (named)
  owner: string;
  severity: Tier;
};

export type OffshorePlanResult = {
  // program-wide headcount roll-up
  programTodayOnshoreCount: number;
  programTodayOffshoreCount: number;
  programMigratingToGcc: number;
  programMigratingToManila: number;
  programGccIndiaSteadyState: number; // migrating + existing offshore
  programRetainedOnshore: number;
  programEditorialCarveOutCount: number;
  // dollar lens (re-uses Step 3 numbers)
  programPoolUsd: number;
  programMovableSpendUsd: number;
  programOffshoreUsd: number;
  weightedOffshorePct: number;
  // per-tower + per-wave
  towerSummaries: OffshoreTowerSummary[];
  waves: OffshoreWaveBucket[];
  // narrative scaffolding
  carveOuts: OffshoreCarveOut[];
  risks: OffshoreRiskItem[];
  /** Cache key — same inputs → same hash. */
  inputHash: string;
};

// ===========================================================================
//   Static maps — the auditable carve-out / location / wave logic
// ===========================================================================

/**
 * Per-tower default carve-out class. Per-L3 keyword detection (below) can
 * promote a row to a stricter class. This is the *baseline* a row falls
 * into before keyword refinement.
 */
const TOWER_DEFAULT_CARVE_OUT: Record<TowerId, CarveOutClass> = {
  finance: "GccEligible",
  hr: "GccEligible",
  "research-analytics": "GccWithOverlay",
  legal: "GccWithOverlay",
  "corp-services": "GccEligible",
  "tech-engineering": "GccEligible",
  "operations-technology": "GccWithOverlay",
  sales: "OnshoreRetained",
  "marketing-comms": "GccWithOverlay",
  service: "GccEligible",
  "editorial-news": "EditorialCarveOut",
  production: "EditorialCarveOut",
  "programming-dev": "OnshoreRetained",
};

/**
 * Tower-level US source-of-resources hint, grounded in `docs/context.md` §3
 * (NYC HQ at 229 W 43rd, Englewood Cliffs NJ broadcast, DC bureau leased
 * from NBC for politics). Drives the "From" location chip in the Org
 * Transition table.
 */
const TOWER_ONSHORE_LOCATION_HINT: Record<TowerId, UsLocation[]> = {
  finance: ["Distributed", "NycHq"],
  hr: ["Distributed", "NycHq"],
  "research-analytics": ["Distributed", "NycHq"],
  legal: ["NycHq", "DcBureau"],
  "corp-services": ["NycHq", "Distributed"],
  "tech-engineering": ["Distributed", "NycHq"],
  "operations-technology": ["EnglewoodCliffs", "Distributed"],
  sales: ["NycHq", "Distributed"],
  "marketing-comms": ["NycHq"],
  service: ["Distributed"],
  "editorial-news": ["NycHq", "DcBureau"],
  production: ["EnglewoodCliffs", "NycHq"],
  "programming-dev": ["NycHq", "Distributed"],
};

/**
 * Tower-level NBCU TSA dependency tag. The wave gate logic uses this so we
 * don't try to offshore work that's still TSA-supplied — until the relevant
 * TSA winds down, that work stays where it is. Tags align with the TSA
 * categories named in `docs/context.md` (HR/Payroll, Tech infra, Finance).
 */
const TOWER_TSA_DEPENDENCY: Record<TowerId, TsaTag> = {
  finance: "Finance",
  hr: "Hr-Payroll",
  "research-analytics": "None",
  legal: "None",
  "corp-services": "None",
  "tech-engineering": "Tech-Infra",
  "operations-technology": "Tech-Infra",
  sales: "None",
  "marketing-comms": "None",
  service: "None",
  "editorial-news": "None",
  production: "None",
  "programming-dev": "None",
};

/**
 * Service-tower-only signal that a row routes to the Contact-Center Hub
 * (default Manila) instead of the Primary GCC. The English-fluency-during-
 * US-business-hours constraint is what makes Manila the canonical
 * destination for multi-brand contact center work (CNBC Pro, GolfNow /
 * GolfPass, Fandango, SportsEngine).
 */
const CONTACT_CENTER_KEYWORDS = [
  "contact",
  "support",
  "customer",
  "subscriber",
  "helpdesk",
  "tier 1",
  "tier 2",
  "first line support",
  "service desk",
];

// ===========================================================================
//   Public selector
// ===========================================================================

export type SelectOffshorePlanOptions = {
  /**
   * Optional LLM-lane overlay produced by the /api/offshore-plan/classify
   * route. Keyed by L3 row id. Carved-out rows (those with
   * `offshoreStrictCarveOut`) are filtered out before the LLM call, so the
   * map should never contain them.
   */
  llmLanes?: ReadonlyMap<string, { lane: CarveOutClass; justification: string }>;
  /**
   * GCC location assumptions. Drives `chooseDestination` city resolution and
   * (downstream) the narrative city-name reads. When omitted the default
   * trio (Bangalore + Pune + Manila) is used.
   */
  assumptions?: OffshoreAssumptions;
};

export function selectOffshorePlan(
  program: AssessProgramV2,
  options: SelectOffshorePlanOptions = {},
): OffshorePlanResult {
  const assumptions = options.assumptions ?? program.offshoreAssumptions ?? DEFAULT_OFFSHORE_ASSUMPTIONS;
  const llmLanes = options.llmLanes;

  let programTodayOnshoreCount = 0;
  let programTodayOffshoreCount = 0;
  let programMigratingToGcc = 0;
  let programMigratingToContactCenter = 0;
  let programEditorialCarveOutCount = 0;
  let programPoolUsd = 0;
  let programMovableSpendUsd = 0;

  const towerSummaries: OffshoreTowerSummary[] = [];

  for (const tower of towers) {
    const towerId = tower.id as TowerId;
    const state = program.towers[towerId];
    if (!state || state.l4Rows.length === 0) continue;

    const baseline = state.baseline;
    const rates = towerRatesFromState(towerId, program);
    const towerDefault = TOWER_DEFAULT_CARVE_OUT[towerId];
    const tsaTag = TOWER_TSA_DEPENDENCY[towerId];
    const fromLocations = TOWER_ONSHORE_LOCATION_HINT[towerId];

    let towerToday = 0;
    let towerTodayOff = 0;
    let towerToGcc = 0;
    let towerToContactCenter = 0;
    let towerEdCarve = 0;
    let towerPool = 0;
    let towerMovableSpend = 0;
    let towerOffshoreUsd = 0;
    const rows: OffshoreL4Row[] = [];

    for (const r of state.l4Rows) {
      const classification = classifyRow(r, towerDefault, llmLanes);
      const destination = chooseDestination(
        classification.carveOut,
        towerId,
        r,
        assumptions,
      );
      const head = computeMovableHeadcount(r, baseline);
      const pool = rowAnnualCost(r, rates);
      const saving = rowModeledSaving(r, baseline, rates);
      const todayOnshore = r.fteOnshore + r.contractorOnshore;
      const todayOffshore = r.fteOffshore + r.contractorOffshore;

      // Carve-out / retained rows don't migrate, regardless of dial value.
      // Their movable headcount is forced to 0 so the program totals
      // reconcile to "X stays, Y goes".
      const isMoving =
        classification.carveOut === "GccEligible" ||
        classification.carveOut === "GccWithOverlay";
      const movableFte = isMoving ? head.movableFte : 0;
      const movableCtr = isMoving ? head.movableContractor : 0;
      const movableTotal = movableFte + movableCtr;
      const offshoreUsd = isMoving ? saving.offshore : 0;
      const movableSpend = isMoving
        ? movableTotal * pool /
          Math.max(1, todayOnshore + todayOffshore || 1)
        : 0;

      const wave: WaveNumber | null =
        isMoving ? assignWave(classification.carveOut, towerId, tsaTag) : null;

      const retainedFte = Math.max(0, r.fteOnshore - movableFte);
      const retainedCtr = Math.max(0, r.contractorOnshore - movableCtr);

      const row: OffshoreL4Row = {
        rowId: r.id,
        towerId,
        towerName: tower.name,
        l2: r.l2,
        l3: r.l3,
        l4: r.l4,
        todayFteOnshore: r.fteOnshore,
        todayFteOffshore: r.fteOffshore,
        todayCtrOnshore: r.contractorOnshore,
        todayCtrOffshore: r.contractorOffshore,
        movableFte,
        movableContractor: movableCtr,
        retainedFte,
        retainedContractor: retainedCtr,
        poolUsd: pool,
        modeledOffshoreUsd: offshoreUsd,
        offshoreRationale: r.offshoreRationale,
        justification: classification.justification,
        classificationSource: classification.source,
        carveOut: classification.carveOut,
        carveOutReason: classification.carveOutReason,
        destination,
        fromLocations,
        wave,
        tsaTag,
      };
      rows.push(row);

      towerToday += todayOnshore;
      towerTodayOff += todayOffshore;
      towerPool += pool;
      towerMovableSpend += movableSpend;
      towerOffshoreUsd += offshoreUsd;

      if (destination === "ContactCenterHub") towerToContactCenter += movableTotal;
      else if (isMoving) towerToGcc += movableTotal;

      if (classification.carveOut === "EditorialCarveOut") towerEdCarve += todayOnshore;
    }

    const retainedOnshore = Math.max(
      0,
      towerToday - towerToGcc - towerToContactCenter,
    );

    const summary: OffshoreTowerSummary = {
      towerId,
      towerName: tower.name,
      todayOnshoreCount: towerToday,
      todayOffshoreCount: towerTodayOff,
      migratingToGcc: towerToGcc,
      migratingToManila: towerToContactCenter,
      retainedOnshore,
      editorialCarveOutCount: Math.min(towerEdCarve, retainedOnshore),
      primaryUsLocations: fromLocations,
      poolUsd: towerPool,
      movableUsd: towerMovableSpend,
      modeledOffshoreUsd: towerOffshoreUsd,
      carveOutFlags: deriveCarveOutFlags(rows),
      recommendedScope: deriveRecommendedScope(towerId),
      retainedSpineSummary: deriveRetainedSpineSummary(towerId),
      rows,
    };
    towerSummaries.push(summary);

    programTodayOnshoreCount += towerToday;
    programTodayOffshoreCount += towerTodayOff;
    programMigratingToGcc += towerToGcc;
    programMigratingToContactCenter += towerToContactCenter;
    programEditorialCarveOutCount += summary.editorialCarveOutCount;
    programPoolUsd += towerPool;
    programMovableSpendUsd += towerMovableSpend;
  }

  // Sort towers by `migratingToGcc` desc so leadership reads the towers
  // carrying the offshoring weight first.
  towerSummaries.sort((a, b) => b.migratingToGcc - a.migratingToGcc);

  const programRetainedOnshore = Math.max(
    0,
    programTodayOnshoreCount -
      programMigratingToGcc -
      programMigratingToContactCenter,
  );
  const programGccIndiaSteadyState =
    programMigratingToGcc + programTodayOffshoreCount;

  // Reuse Step 3 numbers for the dollar lens — single source of truth.
  const impact: ProgramImpactSummary = programImpactSummary(program);

  const waves = buildWaveBuckets(towerSummaries);
  const carveOuts = buildCarveOuts(towerSummaries);
  const risks = buildRiskRegister();

  return {
    programTodayOnshoreCount,
    programTodayOffshoreCount,
    programMigratingToGcc,
    programMigratingToManila: programMigratingToContactCenter,
    programGccIndiaSteadyState,
    programRetainedOnshore,
    programEditorialCarveOutCount,
    programPoolUsd,
    programMovableSpendUsd,
    programOffshoreUsd: impact.offshore,
    weightedOffshorePct: impact.weightedOffshorePct,
    towerSummaries,
    waves,
    carveOuts,
    risks,
    inputHash: computeInputHash(program, assumptions),
  };
}

// ===========================================================================
//   Per-row classification
// ===========================================================================

type ClassifyResult = {
  carveOut: CarveOutClass;
  carveOutReason?: "Editorial" | "Talent" | "SOX" | "Sales";
  source: ClassificationSource;
  justification?: string;
};

/**
 * Classification cascade per row:
 *   1. `r.offshoreStrictCarveOut` — user/seed flag wins over everything.
 *   2. `llmLanes` — applied to non-carved-out rows when the LLM has run.
 *   3. Heuristic fallback — tower default + Step-2 dial bucket. NO keyword
 *      detection (keywords now only seed the carve-out flag on first mount).
 */
function classifyRow(
  r: L3WorkforceRow,
  towerDefault: CarveOutClass,
  llmLanes: ReadonlyMap<string, { lane: CarveOutClass; justification: string }> | undefined,
): ClassifyResult {
  // 1) Strict carve-out — the only path that can produce EditorialCarveOut.
  const strict = r.offshoreStrictCarveOut;
  if (strict) {
    const carveOut: CarveOutClass =
      strict.reason === "Editorial" ? "EditorialCarveOut" : "OnshoreRetained";
    return {
      carveOut,
      carveOutReason: strict.reason,
      source: strict.setBy === "user" ? "user-carve-out" : "seeded-carve-out",
    };
  }

  // 2) LLM overlay (only when present — and never for already-strict rows,
  //    which the route filters out before the LLM call).
  const llm = llmLanes?.get(r.id);
  if (llm) {
    return {
      carveOut: llm.lane,
      source: "llm",
      justification: llm.justification,
    };
  }

  // 3) Heuristic — Step-2 dial bucket with tower default fallback.
  //
  // INVARIANT: the heuristic NEVER produces EditorialCarveOut. The
  // EditorialCarveOut lane is reachable ONLY through path 1 (an explicit
  // user/seeded `offshoreStrictCarveOut` with reason="Editorial"). When
  // the user has removed all carve-outs, editorial / production / etc.
  // rows must be considered for offshore on dial signal — not silently
  // pinned to EditorialCarveOut by the tower default. This was the root
  // cause of "regenerate doesn't honour assumptions" when the user
  // unchecked editorial carve-outs and still saw zero movable HC.
  const dial = r.offshoreAssessmentPct ?? -1;
  let carveOut: CarveOutClass;
  if (dial >= 50) carveOut = "GccEligible";
  else if (dial >= 25) carveOut = "GccWithOverlay";
  else if (dial >= 0 && dial < 15) carveOut = "OnshoreRetained";
  else
    carveOut =
      towerDefault === "EditorialCarveOut" ? "OnshoreRetained" : towerDefault;
  return { carveOut, source: "heuristic" };
}

/**
 * Map a classified row to a role-based destination code. The actual city
 * name is resolved at render time via `offshoreLocationLabels(program)`.
 */
function chooseDestination(
  carveOut: CarveOutClass,
  towerId: TowerId,
  r: L3WorkforceRow,
  assumptions: OffshoreAssumptions,
): GccDestination {
  if (carveOut === "OnshoreRetained" || carveOut === "EditorialCarveOut")
    return "OnshoreRetained";

  // Service-tower contact-center work routes to the Contact-Center Hub
  // (default Manila). When the user has set `contactCenterHub: "None"`,
  // the hub-routed rows fall back to PrimaryGcc so nothing disappears.
  if (towerId === "service") {
    const text = `${r.l2} ${r.l3}`.toLowerCase();
    if (matchesAnyKeyword(text, CONTACT_CENTER_KEYWORDS)) {
      return assumptions.contactCenterHub === "None"
        ? "PrimaryGcc"
        : "ContactCenterHub";
    }
  }

  // Finance + HR back-office route to the Secondary GCC (default Pune).
  // Everything else routes to the Primary GCC (default Bangalore).
  if (towerId === "finance" || towerId === "hr") return "SecondaryGcc";
  return "PrimaryGcc";
}

function assignWave(
  carveOut: CarveOutClass,
  towerId: TowerId,
  tsaTag: TsaTag,
): WaveNumber {
  // Wave 3 — anything blocked by the Finance TSA OR specifically gated by
  // the first SOX clean opinion (finance close + finance-adjacent).
  if (tsaTag === "Finance") return 3;
  if (towerId === "legal" || towerId === "research-analytics") return 3;
  if (towerId === "programming-dev") return 3;

  // Wave 1 — Stand up + bank covenant savings. Finance back-office (AP/AR
  // / T&E ≠ close), HR service center, IT helpdesk. The towers whose
  // GCC-eligible rows we want delivered first.
  if (towerId === "finance" && carveOut === "GccEligible") return 1;
  if (towerId === "hr" && carveOut === "GccEligible") return 1;
  if (towerId === "tech-engineering" && carveOut === "GccEligible") return 1;

  // Wave 2 — Broaden + Service Ops contact center. Service contact-center,
  // ad ops back-office, marketing production, broader engineering.
  if (towerId === "service") return 2;
  return 2;
}

// ===========================================================================
//   Headcount math (mirrors scenarioModel.computeRowOffshore math)
// ===========================================================================

/**
 * Movable FTE / contractor for one row at the row's own dial (with tower
 * baseline fallback). Mirrors `computeRowOffshore` in scenarioModel.ts so
 * Step 5 reconciles to Step 2 / Step 3 line-by-line.
 */
function computeMovableHeadcount(
  r: L3WorkforceRow,
  baseline: TowerBaseline,
): { movableFte: number; movableContractor: number } {
  const dialPct = r.offshoreAssessmentPct ?? baseline.baselineOffshorePct;
  const dial = clamp01(dialPct / 100);
  const fteTotal = r.fteOnshore + r.fteOffshore;
  const ctrTotal = r.contractorOnshore + r.contractorOffshore;
  const movableFte = Math.max(0, fteTotal * dial - r.fteOffshore);
  const movableContractor = Math.max(0, ctrTotal * dial - r.contractorOffshore);
  return { movableFte, movableContractor };
}

// ===========================================================================
//   Per-tower narrative derivation
// ===========================================================================

const TOWER_RECOMMENDED_SCOPE: Record<TowerId, string> = {
  finance:
    "AR · AP · T&E · intercompany ops · close (Wave 3 post-SOX)",
  hr: "Service center · benefits ops · onboarding ops · payroll ops",
  "research-analytics":
    "Data ops · dashboard build · audience analytics back-office",
  legal: "Contract ops · discovery support · NDA review",
  "corp-services":
    "Procurement ops · vendor onboarding · expense audit",
  "tech-engineering":
    "L1/L2 helpdesk · DevOps · platform engineering · QA automation",
  "operations-technology":
    "Broadcast ops back-office · monitoring ops",
  sales:
    "Ad ops back-office · traffic · billing · CRM hygiene (post-NBCU TSA)",
  "marketing-comms": "Production ops · asset management · campaign ops",
  service:
    "Multi-brand contact (Manila): CNBC Pro · GolfNow/GolfPass · Fandango · SportsEngine",
  "editorial-news":
    "Carve-out — newsroom workflow stays onshore (Brian Carovillano veto)",
  production:
    "Carve-out — live broadcast & studio ops stay onshore",
  "programming-dev":
    "Programming ops back-office only — development & talent stay onshore",
};

const TOWER_RETAINED_SPINE: Record<TowerId, string> = {
  finance:
    "Treasury · M&A · executive finance · SOX-critical controls (Wave 1-2)",
  hr: "Talent strategy · executive search · ER / labor · culture",
  "research-analytics":
    "Strategic insights · ratings calls · audience strategy",
  legal:
    "Outside counsel mgmt · litigation · regulatory (SEC) · M&A counsel",
  "corp-services":
    "Real estate · physical security · executive support",
  "tech-engineering":
    "Architecture · cybersecurity SOC · CIO office (Nate Balogh)",
  "operations-technology":
    "Live broadcast ops · master control · transmission",
  sales:
    "Top-tier ad sales relationships ($1.58B post-NBCU TSA story)",
  "marketing-comms":
    "Brand strategy · creative direction · executive comms · crisis",
  service: "Customer success leadership · escalation desk · tier-3 specialists",
  "editorial-news":
    "MS NOW political coverage · CNBC anchor producers · Brian Carovillano standards function",
  production:
    "On-air talent · live producers · studio · field crews",
  "programming-dev":
    "Programming development · talent contracts · agency relationships",
};

/**
 * Derive the CarveOutFlag chip set for a tower from the actual user-set
 * (or seeded) `carveOutReason` values on its rows. No more tower-id
 * heuristics — if no row in the tower carries an SOX reason, the SOX chip
 * doesn't appear (consistent with the user's actual decisions).
 */
function deriveCarveOutFlags(rows: OffshoreL4Row[]): CarveOutFlag[] {
  const flags = new Set<CarveOutFlag>();
  for (const r of rows) {
    if (r.carveOutReason) flags.add(r.carveOutReason);
  }
  return Array.from(flags);
}

function deriveRecommendedScope(towerId: TowerId): string {
  return TOWER_RECOMMENDED_SCOPE[towerId];
}

function deriveRetainedSpineSummary(towerId: TowerId): string {
  return TOWER_RETAINED_SPINE[towerId];
}

// ===========================================================================
//   Wave bucket assembly
// ===========================================================================

function buildWaveBuckets(
  towers: OffshoreTowerSummary[],
): OffshoreWaveBucket[] {
  type Acc = {
    rolesEnteringGcc: number;
    scopeTowers: { towerId: TowerId; towerName: string; movable: number }[];
    headlines: Set<string>;
    tsa: Set<TsaTag>;
  };
  const empty = (): Acc => ({
    rolesEnteringGcc: 0,
    scopeTowers: [],
    headlines: new Set(),
    tsa: new Set(),
  });
  const buckets: Record<WaveNumber, Acc> = { 1: empty(), 2: empty(), 3: empty() };

  for (const t of towers) {
    const byWave: Record<WaveNumber, number> = { 1: 0, 2: 0, 3: 0 };
    const headlinesByWave: Record<WaveNumber, Set<string>> = {
      1: new Set(),
      2: new Set(),
      3: new Set(),
    };
    const tsaByWave: Record<WaveNumber, Set<TsaTag>> = {
      1: new Set(),
      2: new Set(),
      3: new Set(),
    };
    for (const r of t.rows) {
      if (r.wave === null) continue;
      const movable = r.movableFte + r.movableContractor;
      byWave[r.wave] += movable;
      if (r.l2) headlinesByWave[r.wave].add(`${t.towerName}: ${r.l2}`);
      if (r.tsaTag !== "None") tsaByWave[r.wave].add(r.tsaTag);
    }
    for (const wave of [1, 2, 3] as WaveNumber[]) {
      if (byWave[wave] > 0) {
        buckets[wave].rolesEnteringGcc += byWave[wave];
        buckets[wave].scopeTowers.push({
          towerId: t.towerId,
          towerName: t.towerName,
          movable: byWave[wave],
        });
        headlinesByWave[wave].forEach((h) => buckets[wave].headlines.add(h));
        tsaByWave[wave].forEach((tg) => buckets[wave].tsa.add(tg));
      }
    }
  }

  return [
    finalizeWave(1, buckets[1]),
    finalizeWave(2, buckets[2]),
    finalizeWave(3, buckets[3]),
  ];
}

function finalizeWave(wave: WaveNumber, acc: {
  rolesEnteringGcc: number;
  scopeTowers: { towerId: TowerId; towerName: string; movable: number }[];
  headlines: Set<string>;
  tsa: Set<TsaTag>;
}): OffshoreWaveBucket {
  const [start, end, title, gatekeeper, gateCriteria, costTier] =
    WAVE_META[wave];
  acc.scopeTowers.sort((a, b) => b.movable - a.movable);
  return {
    wave,
    windowMonths: `M${start}-M${end}`,
    windowStart: start,
    windowEnd: end,
    title,
    rolesEnteringGcc: acc.rolesEnteringGcc,
    scopeTowers: acc.scopeTowers,
    scopeHeadlines: Array.from(acc.headlines).slice(0, 8),
    tsaDependenciesCleared: Array.from(acc.tsa),
    versantGatekeeper: gatekeeper,
    gateCriteria,
    transitionCostTier: costTier,
  };
}

const WAVE_META: Record<
  WaveNumber,
  [number, number, string, string, string, Tier]
> = {
  1: [
    0,
    9,
    "Stand up + bank covenant savings",
    "Anand Kini (CFO/COO)",
    "BB- covenant savings floor cleared at M9 hyper-care exit",
    "HIGH",
  ],
  2: [
    9,
    18,
    "Broaden + Service Ops contact center",
    "Anand Kini (CFO/COO)",
    "Wave 1 SLAs green AND covenant savings floor maintained",
    "MEDIUM",
  ],
  3: [
    18,
    24,
    "Specialized + finance close",
    "Anand Kini + Brian Carovillano (editorial veto)",
    "First SOX cycle clean opinion",
    "MEDIUM",
  ],
};

// ===========================================================================
//   Carve-out + risk register (deterministic, named to real Versant context)
// ===========================================================================

function buildCarveOuts(towers: OffshoreTowerSummary[]): OffshoreCarveOut[] {
  const findAffected = (predicate: (t: OffshoreTowerSummary) => boolean) =>
    towers.filter(predicate).map((t) => t.towerId);
  return [
    {
      flag: "Editorial",
      title: "Editorial judgment carve-out",
      description:
        "MS NOW political coverage decisions, CNBC anchor-facing producers, breaking-news judgment. Newsroom workflow stays onshore (NYC HQ + DC bureau).",
      gatekeeper: "Brian Carovillano (SVP Standards & Editorial)",
      affectedTowers: findAffected((t) => t.carveOutFlags.includes("Editorial")),
    },
    {
      flag: "Talent",
      title: "Talent-relationship carve-out",
      description:
        "Anchor agents, producer-talent management, on-air casting, talent contracts, top-tier agency relationships. Walled off — no GCC scope.",
      gatekeeper: "Tower lead (Production / Programming & Dev)",
      affectedTowers: findAffected((t) => t.carveOutFlags.includes("Talent")),
    },
    {
      flag: "SOX",
      title: "First-SOX-year carve-out",
      description:
        "Finance close + SOX-critical controls retained Wave 1-2 (Versant's first audit cycle as a newly-public BB-rated company), then phase to GCC in Wave 3.",
      gatekeeper: "Anand Kini (CFO/COO)",
      affectedTowers: findAffected((t) => t.carveOutFlags.includes("SOX")),
    },
    {
      flag: "Sales",
      title: "Brand-sensitive sales carve-out",
      description:
        "Top-tier ad sales relationships stay onshore (the $1.58B revenue stream Versant is rebuilding independently post-NBCU TSA). GCC handles ad ops back-office, traffic, billing — not relationship.",
      gatekeeper: "Sales tower lead",
      affectedTowers: findAffected((t) => t.carveOutFlags.includes("Sales")),
    },
  ];
}

function buildRiskRegister(): OffshoreRiskItem[] {
  return [
    {
      id: "editorial-brand",
      title: "Editorial brand risk",
      exposure:
        "MS NOW progressive positioning + CNBC anchor producers — any GCC scope creep into newsroom workflow risks brand & political-news credibility.",
      mitigation:
        "Brian Carovillano holds binding veto on every wave gate; newsroom workflow walled off from all three waves.",
      owner: "Brian Carovillano (SVP Standards & Editorial)",
      severity: "HIGH",
    },
    {
      id: "talent-onair",
      title: "Talent / on-air relationship risk",
      exposure:
        "Anchor agents, talent contracts, on-air casting are relationship-driven; any GCC overlay risks key-talent attrition.",
      mitigation: "Walled off from all GCC scope; production tower lead owns gate.",
      owner: "Production tower lead",
      severity: "HIGH",
    },
    {
      id: "tsa-stranded",
      title: "TSA stranded-cost risk",
      exposure:
        "Offshoring NBCU-TSA-supplied work (HR/Payroll, Tech infra, Finance) before the relevant TSA winds down creates dual-running cost without savings.",
      mitigation:
        "Per-tower TSA tag drives wave gating: HR-Payroll → Wave 1 wind-down, Tech-Infra → Wave 2, Finance → Wave 3.",
      owner: "Anand Kini (CFO/COO)",
      severity: "HIGH",
    },
    {
      id: "bb-covenant",
      title: "BB- covenant savings-floor slip risk",
      exposure:
        "Wave-1 attrition or dual-running drag drops net savings below the BB- credit-covenant cushion — existential for the newly-public company.",
      mitigation:
        "Wave 2 gated on covenant savings-floor + Wave-1 SLAs green. Plan does not auto-advance on calendar alone.",
      owner: "Anand Kini (CFO/COO)",
      severity: "HIGH",
    },
    {
      id: "sox-year-one",
      title: "Newly-public SOX year-1 risk",
      exposure:
        "First audit-cycle integrity — offshoring SOX-critical close controls before clean opinion risks restatement & rating action.",
      mitigation:
        "SOX-critical controls retained through Wave 1-2; finance close phases to GCC only after first clean opinion.",
      owner: "Anand Kini (CFO/COO)",
      severity: "HIGH",
    },
    {
      id: "data-residency",
      title: "Regulatory / data-residency risk",
      exposure:
        "Political news source data + ad-audience PII have data-residency and privilege constraints; cross-border movement risks compliance exposure.",
      mitigation:
        "Data classification policy; political-source data and PII stay on US-controlled infra; GCC accesses via least-privilege virtual desktop.",
      owner: "Caroline Richardson (CISO)",
      severity: "MEDIUM",
    },
    {
      id: "cultural-labor",
      title: "Cultural / labor risk",
      exposure:
        "MS NOW progressive-positioned journalists may reject offshore producers; CNBC editorial culture is sensitive to handoff quality.",
      mitigation:
        "Editorial workflow stays onshore; GCC scope limited to back-office & technical layers; tower-lead × Accenture-lead pairing maintains continuity.",
      owner: "Tower leads (Editorial-News, Production)",
      severity: "MEDIUM",
    },
  ];
}

// ===========================================================================
//   Helpers
// ===========================================================================

function matchesAnyKeyword(text: string, keywords: string[]): boolean {
  for (const kw of keywords) {
    if (text.includes(kw)) return true;
  }
  return false;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/**
 * Stable hash of the LLM-input substrate. CRITICAL: this hash MUST be a
 * function of the LLM INPUTS only (program rows + their dials + carve-out
 * flags + assumptions) — NEVER of classification OUTPUTS like
 * `programMigratingToGcc` or `hasLlmLanes`. Otherwise applying the LLM
 * lanes after a successful Regenerate changes the displayed plan's
 * inputHash, the client's `isStale(currentHash)` flips to true, and we
 * paint a "Stale — regenerate to refresh" chip even though the user just
 * regenerated. (That was the bug the user hit.)
 *
 * Determinism: rows are sorted by `(towerId, rowId)` before hashing, so
 * two clients with the same program produce the same hash regardless of
 * Map / Object iteration order.
 */
function computeInputHash(
  program: AssessProgramV2,
  assumptions: OffshoreAssumptions,
): string {
  type RowSig = {
    t: string; // towerId
    r: string; // rowId
    d: number; // dial (-1 for unset)
    c: string; // carve-out reason ("" if none)
    fo: number;
    ff: number;
    co: number;
    cf: number;
  };
  const sigs: RowSig[] = [];
  for (const tower of towers) {
    const towerId = tower.id as TowerId;
    const state = program.towers[towerId];
    if (!state || state.l4Rows.length === 0) continue;
    for (const r of state.l4Rows) {
      sigs.push({
        t: towerId,
        r: r.id,
        d:
          typeof r.offshoreAssessmentPct === "number"
            ? Math.round(r.offshoreAssessmentPct)
            : -1,
        c: r.offshoreStrictCarveOut?.reason ?? "",
        fo: Math.round(r.fteOnshore ?? 0),
        ff: Math.round(r.fteOffshore ?? 0),
        co: Math.round(r.contractorOnshore ?? 0),
        cf: Math.round(r.contractorOffshore ?? 0),
      });
    }
  }
  sigs.sort((a, b) =>
    a.t === b.t ? a.r.localeCompare(b.r) : a.t.localeCompare(b.t),
  );
  const compact = JSON.stringify({
    sigs,
    p: assumptions.primaryGccCity,
    s: assumptions.secondaryGccCity,
    cch: assumptions.contactCenterHub,
  });
  let h = 5381;
  for (let i = 0; i < compact.length; i++) {
    h = ((h << 5) + h + compact.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}
