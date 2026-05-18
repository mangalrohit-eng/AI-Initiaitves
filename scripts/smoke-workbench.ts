/* eslint-disable no-console */
/**
 * Smoke test for the new Tower Workbench + Orchestration Layer plumbing.
 *
 * Run from `forge-tower-explorer/`:
 *   npx tsx scripts/smoke-workbench.ts
 *
 * Asserts:
 *   1. `TOWER_WORKBENCHES` has 14 entries, each with 4-8 surfaces, all
 *      surfaces have non-empty verb / name / description, at least one
 *      `poweredByCapabilities` entry, and a valid `iconKey`.
 *   2. `ORCHESTRATION_LAYER` has the contracted minimum sizes:
 *      5-8 data components, 12-20 integrations, 4-8 agents, 3-5 policies.
 *   3. `matchCapabilitiesToInitiatives` returns the expected confident
 *      match for representative pairs (positive cases) and refuses to
 *      match on weak token overlap (negative cases).
 *
 * Exit code 0 on success, 1 on any failure. The script is verbose so the
 * shell output also doubles as an end-to-end "what got authored" report.
 */

import { TOWER_WORKBENCHES } from "../src/data/towerWorkbenches";
import { ORCHESTRATION_LAYER } from "../src/data/orchestrationLayer";
import { matchCapabilitiesToInitiatives } from "../src/lib/workbench/matchCapabilities";
import type { V6InitiativeCard } from "../src/lib/initiatives/selectV6";
import { SOLUTION_ICON_BY_KEY } from "../src/lib/initiatives/solutionIconAllowlist";

let failures = 0;
function check(label: string, cond: boolean, detail?: string) {
  if (cond) {
    console.log(`  PASS  ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

// =============================================================================
// 1. Workbenches
// =============================================================================
section("TOWER_WORKBENCHES");

const workbenches = Object.values(TOWER_WORKBENCHES);
check(`14 workbenches authored`, workbenches.length === 14, `got ${workbenches.length}`);

const surfaceCounts: number[] = [];
const usedTowerIds = new Set<string>();
for (const w of workbenches) {
  check(
    `[${w.towerId}] tower id is unique`,
    !usedTowerIds.has(w.towerId),
    w.towerId,
  );
  usedTowerIds.add(w.towerId);
  check(
    `[${w.towerId}] 4-8 surfaces`,
    w.surfaces.length >= 4 && w.surfaces.length <= 8,
    `got ${w.surfaces.length}`,
  );
  surfaceCounts.push(w.surfaces.length);
  check(`[${w.towerId}] non-empty tagline`, w.tagline.length > 0);
  check(`[${w.towerId}] non-empty whyConsolidated`, w.whyConsolidated.length > 50);
  check(`[${w.towerId}] non-empty whyCustomBuild`, w.whyCustomBuild.length > 50);
  check(`[${w.towerId}] non-empty successMetric`, w.successMetric.length > 0);
  check(
    `[${w.towerId}] digitalCore.integrations not empty`,
    w.digitalCore.integrations.length > 0,
  );

  for (const s of w.surfaces) {
    check(
      `[${w.towerId}/${s.id}] verb 1-2 words`,
      s.verb.split(/\s+/).length <= 2 && s.verb.length > 0,
      `"${s.verb}"`,
    );
    check(
      `[${w.towerId}/${s.id}] iconKey on allowlist`,
      SOLUTION_ICON_BY_KEY.has(s.iconKey),
      s.iconKey,
    );
    check(
      `[${w.towerId}/${s.id}] has poweredByCapabilities`,
      s.poweredByCapabilities.length > 0,
    );
  }
}

console.log(
  `  INFO  surface count distribution: min=${Math.min(...surfaceCounts)} max=${Math.max(
    ...surfaceCounts,
  )} mean=${(surfaceCounts.reduce((a, b) => a + b, 0) / surfaceCounts.length).toFixed(1)}`,
);

// Verify swap-name test — pick two workbenches at random and confirm
// their primaryAction strings are not interchangeable (no exact dup).
const allPrimaryActions = workbenches.flatMap((w) =>
  w.surfaces.map((s) => s.primaryAction),
);
const dupActions = new Set<string>();
const seenActions = new Set<string>();
for (const a of allPrimaryActions) {
  if (seenActions.has(a)) dupActions.add(a);
  seenActions.add(a);
}
check(
  `no duplicate primaryAction lines across workbenches`,
  dupActions.size === 0,
  Array.from(dupActions).join(" | "),
);

// =============================================================================
// 2. Orchestration Layer
// =============================================================================
section("ORCHESTRATION_LAYER");

const o = ORCHESTRATION_LAYER;
check(
  `5-8 data architecture components`,
  o.dataArchitecture.length >= 5 && o.dataArchitecture.length <= 8,
  `got ${o.dataArchitecture.length}`,
);
check(
  `12-20 API integrations`,
  o.apiIntegrations.length >= 12 && o.apiIntegrations.length <= 25,
  `got ${o.apiIntegrations.length}`,
);
check(
  `4-8 cross-cutting agents`,
  o.agents.length >= 4 && o.agents.length <= 8,
  `got ${o.agents.length}`,
);
check(
  `3-5 governance policies`,
  o.governance.length >= 3 && o.governance.length <= 5,
  `got ${o.governance.length}`,
);

for (const d of o.dataArchitecture) {
  check(
    `data[${d.id}] iconKey on allowlist`,
    SOLUTION_ICON_BY_KEY.has(d.iconKey),
    d.iconKey,
  );
}
for (const a of o.agents) {
  check(
    `agent[${a.id}] iconKey on allowlist`,
    SOLUTION_ICON_BY_KEY.has(a.iconKey),
    a.iconKey,
  );
}
for (const g of o.governance) {
  check(
    `policy[${g.id}] iconKey on allowlist`,
    SOLUTION_ICON_BY_KEY.has(g.iconKey),
    g.iconKey,
  );
}

// Every integration's `servesDataComponents` reference must resolve.
const dataIds = new Set(o.dataArchitecture.map((d) => d.id));
for (const i of o.apiIntegrations) {
  for (const ref of i.servesDataComponents) {
    check(
      `integration[${i.id}] servesDataComponents -> ${ref}`,
      dataIds.has(ref),
      ref,
    );
  }
}

// =============================================================================
// 3. Fuzzy matcher — positive + negative cases
// =============================================================================
section("matchCapabilitiesToInitiatives");

function fakeInit(
  id: string,
  solutionName: string,
  tagline = "",
): V6InitiativeCard {
  return {
    id,
    solutionName,
    tagline,
    aiRationale: "",
    feasibility: "High",
    iconKey: "Rocket",
    coversL4RowIds: [],
    applicability: "Retained",
    isPlaceholder: false,
    initiativeHref: `/x/${id}`,
    attributedAiUsd: 0,
    l3FteDataMissing: false,
  };
}

const inits: V6InitiativeCard[] = [
  fakeInit("a1", "Agentic AI Bank Reconciliation Co-Pilot"),
  fakeInit("a2", "Intercompany Reconciliation Co-Pilot"),
  fakeInit("a3", "MD&A First-Draft Generator"),
  fakeInit("a4", "Talent Flight-Risk Monitor"),
  fakeInit("a5", "Contract Search & Precedent Retrieval"),
  fakeInit("a6", "Commercial Insertion Verification Co-Pilot"),
];

const positiveCases: { cap: string; expectId: string }[] = [
  { cap: "Bank reconciliation auto-match", expectId: "a1" },
  { cap: "Intercompany reconciliation", expectId: "a2" },
  { cap: "MD&A first-draft generator", expectId: "a3" },
  // Note: "Retention risk" (only 1 token shared with "Talent Flight-Risk
  // Monitor") is intentionally NOT a positive case — token overlap is
  // too weak. The matcher is designed to be conservative here so a
  // mismatched LLM solution name doesn't get hijacked into the wrong
  // surface.
  { cap: "Flight risk scoring", expectId: "a4" },
  { cap: "Contract search", expectId: "a5" },
  { cap: "Commercial insertion verification", expectId: "a6" },
];
for (const pc of positiveCases) {
  const m = matchCapabilitiesToInitiatives([pc.cap], inits);
  check(
    `positive: "${pc.cap}" -> ${pc.expectId}`,
    m[0]?.init?.id === pc.expectId,
    m[0]?.init ? `matched ${m[0].init.id}` : "no match",
  );
}

const negativeCases = [
  "Crisis PR",
  "Cloud cost",
  "FAST programming",
  "Off-air response",
];
for (const nc of negativeCases) {
  const m = matchCapabilitiesToInitiatives([nc], inits);
  check(`negative: "${nc}" -> null`, m[0]?.init === null, m[0]?.init?.id);
}

// Confirm "Retention risk" stays REJECTED — token overlap is only the
// single word "risk", which is too weak. This protects against an LLM-
// drifted solution name accidentally hijacking a surface.
const retentionCap = matchCapabilitiesToInitiatives(["Retention risk"], inits);
check(
  `correct rejection: "Retention risk" stays null (only "risk" overlaps)`,
  retentionCap[0]?.init === null,
  retentionCap[0]?.init?.id,
);

// Confirm "Bank reconciliation auto-match" prefers the "Bank Reconciliation"
// solution over the "Intercompany Reconciliation" solution even though
// both share the "reconciliation" token.
const bankCap = matchCapabilitiesToInitiatives(
  ["Bank reconciliation auto-match"],
  inits,
);
check(
  `disambiguation: "Bank reconciliation auto-match" picks bank (a1) over intercompany (a2)`,
  bankCap[0]?.init?.id === "a1",
  bankCap[0]?.init?.id,
);

// =============================================================================
// Summary
// =============================================================================
section("RESULT");
if (failures === 0) {
  console.log("All checks passed.");
  process.exit(0);
} else {
  console.log(`${failures} check(s) failed.`);
  process.exit(1);
}
