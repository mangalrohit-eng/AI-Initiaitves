/**
 * Step 2 ↔ Step 3 persistence test.
 *
 * Reproduces the exact runtime path the UI takes:
 *   1. Mock `localStorage` and `window` so the localStore module can
 *      hydrate / persist exactly as it does in the browser.
 *   2. Seed a tower with L4 rows (as if the user uploaded a capability
 *      map on Step 1).
 *   3. Simulate `applyGccPct` for a non-trivial subset of L4 rows
 *      (as if the user clicked "Get AI Suggestion" or hand-edited).
 *   4. Simulate "navigating to Step 3" by re-reading the assess
 *      program from localStorage (fresh `getAssessProgram()` call).
 *   5. Assert that:
 *        a. l4Rows preserve every gccPct + provenance.
 *        b. l3Rows expose the HC-weighted rollup as
 *           offshoreAssessmentPct (the field Step 3 reads).
 *        c. Re-reading after a notional page reload returns the same
 *           values bit-for-bit (no transient state).
 *
 * Run: npx tsx scripts/step2PersistenceTest.ts
 */
import type { L4WorkforceRow, TowerId } from "../src/data/assess/types";

// ---------------------------------------------------------------------------
// 1. Mock localStorage + window so `localStore.ts` runs as in the browser.
// ---------------------------------------------------------------------------

class LocalStorageMock {
  private store = new Map<string, string>();
  getItem(k: string): string | null {
    return this.store.has(k) ? (this.store.get(k) as string) : null;
  }
  setItem(k: string, v: string): void {
    this.store.set(k, String(v));
  }
  removeItem(k: string): void {
    this.store.delete(k);
  }
  clear(): void {
    this.store.clear();
  }
  get length(): number {
    return this.store.size;
  }
  key(i: number): string | null {
    return Array.from(this.store.keys())[i] ?? null;
  }
}

const ls = new LocalStorageMock();
(globalThis as unknown as { window: { localStorage: LocalStorageMock; addEventListener: () => void; removeEventListener: () => void } }).window = {
  localStorage: ls,
  addEventListener: () => {},
  removeEventListener: () => {},
};
(globalThis as unknown as { localStorage: LocalStorageMock }).localStorage = ls;
(globalThis as unknown as { document: { addEventListener: () => void } }).document =
  { addEventListener: () => {} };

// Use require so we control the eval order — mocks above must be in
// place before localStore touches `typeof window`. We could use a
// dynamic `import()` here too, but tsx bundles to CJS so top-level
// await isn't available; CJS require is the lighter path.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const localStore = require("../src/lib/localStore") as typeof import("../src/lib/localStore");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { deriveL3Rows } = require("../src/lib/assess/deriveL3Rows") as typeof import("../src/lib/assess/deriveL3Rows");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { clampPct, totalRowHc } = require("../src/lib/offshore/offshoreSplit") as typeof import("../src/lib/offshore/offshoreSplit");

// ---------------------------------------------------------------------------
// 2. Seed a tower with realistic L4 rows. Mirrors what `importOp` writes
//    after the tower lead uploads a capability map on Step 1.
// ---------------------------------------------------------------------------

const TOWER: TowerId = "finance";

function makeL4(
  i: number,
  l3: string,
  l4: string,
  hc: { onshore: number; offshore: number },
): L4WorkforceRow {
  return {
    id: `finance-r${i}`,
    towerId: TOWER,
    l1: "Finance",
    l2: l3.startsWith("Record")
      ? "Record to Report"
      : l3.startsWith("Procure")
        ? "Procure to Pay"
        : "Order to Cash",
    l3,
    l4,
    fteOnshore: hc.onshore,
    fteOffshore: hc.offshore,
    contractorOnshore: 0,
    contractorOffshore: 0,
    aiPriority: "P3 — Medium-term (12-24mo)",
    aiRationale: "Test seed",
    aiTransformationLens: "Operations",
    aiImpactAssessmentPct: undefined,
    offshoreAssessmentPct: 0,
    gccPct: 0,
    gccPctSetAt: undefined,
    gccPctSource: "seed",
    gccReason: undefined,
  } as L4WorkforceRow;
}

const seedL4Rows: L4WorkforceRow[] = [
  makeL4(1, "Financial Close & Consolidation", "Monthly Close", { onshore: 8, offshore: 0 }),
  makeL4(2, "Financial Close & Consolidation", "Intercompany Eliminations", { onshore: 5, offshore: 0 }),
  makeL4(3, "Financial Close & Consolidation", "Account Reconciliations", { onshore: 12, offshore: 0 }),
  makeL4(4, "Procure to Pay", "Invoice Processing", { onshore: 20, offshore: 0 }),
  makeL4(5, "Procure to Pay", "Vendor Master", { onshore: 4, offshore: 0 }),
  makeL4(6, "Order to Cash", "Customer Master", { onshore: 6, offshore: 0 }),
];

const seedL3Rows = deriveL3Rows(seedL4Rows, TOWER);

// Write the seed state through the public setter (so we exercise the
// real `setTowerAssess` / `safeSet` path, not a manual blob).
localStore.setTowerAssess(TOWER, {
  l4Rows: seedL4Rows,
  l3Rows: seedL3Rows,
  status: "data",
});

console.log("================ Step 1 seed ================");
{
  const after = localStore.getAssessProgram().towers[TOWER];
  console.log(
    `l4Rows=${after?.l4Rows.length ?? 0} l3Rows=${after?.l3Rows?.length ?? 0}`,
  );
  console.log(
    "l4 gccPct after seed:",
    after?.l4Rows.map((r) => `${r.id}=${r.gccPct ?? "∅"}`).join(" "),
  );
  console.log(
    "l3 offshorePct after seed:",
    after?.l3Rows?.map((r) => `${r.l3}=${r.offshoreAssessmentPct ?? "∅"}`).join(" · "),
  );
}

// ---------------------------------------------------------------------------
// 3. Simulate `applyGccPct(...)` exactly like the UI fires it after the
//    LLM returns suggestions. We hand-inline the production logic so we
//    can call it from this Node script (the hook lives in a React file).
// ---------------------------------------------------------------------------

const aiSuggestions = [
  { rowId: "finance-r1", gccPct: 70, reason: "Close prep — bulk of journal review GCC-able." },
  { rowId: "finance-r2", gccPct: 90, reason: "Intercompany — high-volume rules-based work." },
  { rowId: "finance-r3", gccPct: 95, reason: "Reconciliations — BlackLine-driven, GCC scope." },
  { rowId: "finance-r4", gccPct: 85, reason: "Invoice processing — straight-through AP." },
  { rowId: "finance-r5", gccPct: 30, reason: "Vendor mgmt — relationship work onshore." },
  { rowId: "finance-r6", gccPct: 25, reason: "Customer master — account ownership onshore." },
];

function applyGccPct(
  changes: ReadonlyArray<{ rowId: string; gccPct: number; setBy: "ai" | "user" | "upload" | "seed"; reason: string }>,
): void {
  const cur = localStore.getAssessProgram().towers[TOWER];
  if (!cur) throw new Error("Tower not found");
  const byId = new Map(changes.map((c) => [c.rowId, c] as const));
  const now = new Date().toISOString();
  const nextL4Rows: L4WorkforceRow[] = cur.l4Rows.map((r) => {
    const change = byId.get(r.id);
    if (!change) return r;
    const pct = clampPct(change.gccPct);
    return {
      ...r,
      gccPct: pct,
      gccPctSetAt: now,
      gccPctSource: change.setBy,
      gccReason: change.reason.slice(0, 200),
      offshoreAssessmentPct: pct,
    };
  });
  const l4ById = new Map(nextL4Rows.map((r) => [r.id, r] as const));
  const freshL3 = deriveL3Rows(nextL4Rows, TOWER);
  const existingL3ById = new Map(
    (cur.l3Rows ?? []).map((r) => [r.id, r] as const),
  );
  const nextL3Rows = freshL3.map((derived) => {
    const existing = existingL3ById.get(derived.id);
    let pctNumer = 0;
    let weightDen = 0;
    let plainSum = 0;
    let plainN = 0;
    for (const childId of derived.childL4RowIds ?? []) {
      const child = l4ById.get(childId);
      if (!child) continue;
      const pct = clampPct(child.gccPct);
      const w = totalRowHc(child);
      pctNumer += pct * (w || 1);
      weightDen += w || 1;
      plainSum += pct;
      plainN += 1;
    }
    const derivedPct =
      plainN === 0
        ? 0
        : weightDen > 0
          ? pctNumer / weightDen
          : plainSum / plainN;
    return {
      ...(existing ?? {}),
      ...derived,
      offshoreAssessmentPct: Math.round(derivedPct),
    };
  });
  localStore.setTowerAssess(TOWER, { l4Rows: nextL4Rows, l3Rows: nextL3Rows });
}

applyGccPct(aiSuggestions.map((s) => ({ ...s, setBy: "ai" as const })));

console.log("\n================ Step 2 — after AI suggestion write ================");
{
  const after = localStore.getAssessProgram().towers[TOWER];
  console.log(
    "l4 gccPct:",
    after?.l4Rows.map((r) => `${r.id}=${r.gccPct}%`).join(" "),
  );
  console.log(
    "l4 gccPctSource:",
    after?.l4Rows.map((r) => `${r.id}=${r.gccPctSource}`).join(" "),
  );
  console.log(
    "l3 offshorePct:",
    after?.l3Rows?.map((r) => `${r.l3}=${r.offshoreAssessmentPct}%`).join(" · "),
  );
}

// ---------------------------------------------------------------------------
// 4. Simulate "navigate to Step 3 then back to Step 2" by reading fresh
//    from localStorage. This is what the page-mount hydration does.
// ---------------------------------------------------------------------------

console.log("\n================ Step 3 — fresh read (simulates page nav) ================");
const step3Read = localStore.getAssessProgram();
const step3Tower = step3Read.towers[TOWER];
console.log(
  "l4 gccPct survived nav:",
  step3Tower?.l4Rows.map((r) => `${r.id}=${r.gccPct}%`).join(" "),
);
console.log(
  "l3 offshorePct survived nav (Step 3 reads this):",
  step3Tower?.l3Rows?.map((r) => `${r.l3}=${r.offshoreAssessmentPct}%`).join(" · "),
);

// ---------------------------------------------------------------------------
// 5. Assertions
// ---------------------------------------------------------------------------

let failures = 0;
function expect(name: string, cond: boolean, detail = ""): void {
  if (cond) {
    console.log(`  PASS  ${name}`);
  } else {
    console.log(`  FAIL  ${name}${detail ? " — " + detail : ""}`);
    failures += 1;
  }
}

console.log("\n================ Assertions ================");

// l4 round-trip
for (const s of aiSuggestions) {
  const row = step3Tower?.l4Rows.find((r) => r.id === s.rowId);
  expect(
    `L4 ${s.rowId} gccPct round-trips to ${s.gccPct}%`,
    row?.gccPct === s.gccPct,
    `actual=${row?.gccPct}`,
  );
  expect(
    `L4 ${s.rowId} gccPctSource is 'ai'`,
    row?.gccPctSource === "ai",
    `actual=${row?.gccPctSource}`,
  );
  expect(
    `L4 ${s.rowId} gccReason persisted`,
    typeof row?.gccReason === "string" && row.gccReason.length > 0,
    `actual=${JSON.stringify(row?.gccReason)}`,
  );
}

// l3 rollup (HC-weighted)
// Financial Close: HC=8+5+12=25, pct=(70*8 + 90*5 + 95*12)/25 = (560+450+1140)/25 = 2150/25 = 86
const closeL3 = step3Tower?.l3Rows?.find(
  (r) => r.l3 === "Financial Close & Consolidation",
);
expect(
  "L3 Financial Close & Consolidation offshorePct ≈ 86 (HC-weighted)",
  closeL3?.offshoreAssessmentPct === 86,
  `actual=${closeL3?.offshoreAssessmentPct}`,
);

// Procure to Pay: HC=20+4=24, pct=(85*20 + 30*4)/24 = (1700+120)/24 = 1820/24 = 75.83 → 76
const p2pL3 = step3Tower?.l3Rows?.find((r) => r.l3 === "Procure to Pay");
expect(
  "L3 Procure to Pay offshorePct ≈ 76 (HC-weighted)",
  p2pL3?.offshoreAssessmentPct === 76,
  `actual=${p2pL3?.offshoreAssessmentPct}`,
);

// Order to Cash: only 1 child at 25 → 25
const o2cL3 = step3Tower?.l3Rows?.find((r) => r.l3 === "Order to Cash");
expect(
  "L3 Order to Cash offshorePct = 25",
  o2cL3?.offshoreAssessmentPct === 25,
  `actual=${o2cL3?.offshoreAssessmentPct}`,
);

// l3.childL4RowIds matches l4 ids
const closeChildren = closeL3?.childL4RowIds ?? [];
expect(
  "L3 Financial Close & Consolidation childL4RowIds covers all 3 children",
  closeChildren.length === 3 &&
    closeChildren.includes("finance-r1") &&
    closeChildren.includes("finance-r2") &&
    closeChildren.includes("finance-r3"),
  `actual=${JSON.stringify(closeChildren)}`,
);

// Second navigation — does state survive another nav cycle?
console.log("\n================ Second nav cycle (Step 2 → 3 → 2) ================");
const step2BackRead = localStore.getAssessProgram();
const step2BackTower = step2BackRead.towers[TOWER];
expect(
  "After Step 2 → Step 3 → Step 2 nav cycle, every L4 gccPct still intact",
  aiSuggestions.every((s) => {
    const row = step2BackTower?.l4Rows.find((r) => r.id === s.rowId);
    return row?.gccPct === s.gccPct;
  }),
);

console.log("\n================");
if (failures > 0) {
  console.error(`${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log("All assertions pass. Step 2 → Step 3 persistence is correct.");
