/**
 * Verifies the server-side multi-tower-drift guard in
 * `src/app/api/assess/route.ts` does NOT trip on the seed `gccPct*`
 * fields that the client's read-time migration stamps onto every L4
 * row, while still tripping on real Step 2 edits.
 *
 * Reproduces the two relevant `projectRowForDiff` callers — `jsonEqual`
 * is comparing client-stamped seed rows against server-stored rows
 * that pre-date the migration. Without the fix, the diff trips on
 * every L4 row, every PUT returns 403, and the user's Step 2 edits
 * are silently overwritten on the next provider remount.
 *
 * Run: npx tsx scripts/serverDiffNoise.test.ts
 */

// Inline the diff helpers so we don't depend on Next route imports.
const ROW_CACHE_FIELDS = [
  "curationContentHash",
  "curationStage",
  "curationGeneratedAt",
  "curationError",
] as const;

const ROW_GCC_TIMESTAMP_FIELDS = ["gccPctSetAt", "gccReason"] as const;

function projectRowForDiff(row: unknown): unknown {
  if (!row || typeof row !== "object") return row;
  const out = { ...(row as Record<string, unknown>) };
  for (const k of ROW_CACHE_FIELDS) delete out[k];
  for (const k of ROW_GCC_TIMESTAMP_FIELDS) delete out[k];
  const src = out.gccPctSource;
  const isSeedOrMissing =
    src == null || src === "seed" || (typeof src === "string" && !src.trim());
  if (isSeedOrMissing) {
    delete out.gccPct;
    delete out.gccPctSource;
  }
  return out;
}

function projectTowerForDiff(t: unknown): unknown {
  if (!t || typeof t !== "object") return t;
  const tt = t as Record<string, unknown>;
  const projected: Record<string, unknown> = { ...tt };
  delete projected.lastUpdated;
  if (Array.isArray(projected.l4Rows)) {
    projected.l4Rows = (projected.l4Rows as unknown[]).map(projectRowForDiff);
  }
  if (Array.isArray(projected.l3Rows)) {
    projected.l3Rows = (projected.l3Rows as unknown[]).map(projectRowForDiff);
  }
  return projected;
}

function normalizeJson(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(normalizeJson);
  if (v && typeof v === "object") {
    const rec = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(rec).sort()) {
      out[key] = normalizeJson(rec[key]);
    }
    return out;
  }
  return v;
}

function jsonEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(normalizeJson(a)) === JSON.stringify(normalizeJson(b));
}

// ----- Test cases ----------------------------------------------------------

let failures = 0;
function expect(name: string, cond: boolean, detail = ""): void {
  if (cond) {
    console.log(`  PASS  ${name}`);
  } else {
    console.log(`  FAIL  ${name}${detail ? " — " + detail : ""}`);
    failures += 1;
  }
}

// Case 1: server has a row WITHOUT gccPct fields (legacy snapshot),
// client read-time migration stamps the seed defaults. Diff must
// return EQUAL — no spurious "tower changed" signal.
{
  const serverRow = {
    id: "finance-r1",
    l1: "Finance",
    l2: "Record to Report",
    l3: "Financial Close",
    l4: "Monthly Close",
    fteOnshore: 8,
    fteOffshore: 0,
    contractorOnshore: 0,
    contractorOffshore: 0,
  };
  const clientRow = {
    ...serverRow,
    gccPct: 0,
    gccPctSource: "seed",
    gccPctSetAt: "2025-01-01T12:00:00.000Z",
    gccReason: "Awaiting Step 2 review — no offshore signal in legacy data.",
  };
  expect(
    "legacy server row == client-migrated seed row",
    jsonEqual(projectRowForDiff(serverRow), projectRowForDiff(clientRow)),
  );
}

// Case 2: same row, client has a REAL user edit. Diff must
// return DIFFERENT so the PUT correctly counts this tower as changed.
{
  const serverRow = {
    id: "finance-r1",
    l1: "Finance",
    l4: "Monthly Close",
    fteOnshore: 8,
    gccPct: 0,
    gccPctSource: "seed",
  };
  const clientRow = {
    ...serverRow,
    gccPct: 70,
    gccPctSource: "ai",
    gccPctSetAt: "2025-01-02T12:00:00.000Z",
    gccReason: "Close prep — bulk of journal review GCC-able.",
  };
  expect(
    "user/ai/upload gccPct edit DOES trip the diff",
    !jsonEqual(projectRowForDiff(serverRow), projectRowForDiff(clientRow)),
  );
}

// Case 3: same gccPct value but different source semantics.
// 0% from a deliberate user decision should be DIFFERENT from 0%
// seeded by the migration.
{
  const serverRow = {
    id: "finance-r1",
    l4: "Monthly Close",
    gccPct: 0,
    gccPctSource: "seed",
  };
  const clientRow = {
    ...serverRow,
    gccPct: 0,
    gccPctSource: "user",
  };
  expect(
    "explicit 0% (source='user') DIFFERS from seed 0% (source='seed')",
    !jsonEqual(projectRowForDiff(serverRow), projectRowForDiff(clientRow)),
  );
}

// Case 4: timestamp / reason churn alone must NOT trip the diff.
// `gccPctSetAt` and `gccReason` are stripped from the projection.
{
  const serverRow = {
    id: "finance-r1",
    l4: "Monthly Close",
    gccPct: 70,
    gccPctSource: "ai",
    gccPctSetAt: "2025-01-01T12:00:00.000Z",
    gccReason: "Reason A",
  };
  const clientRow = {
    ...serverRow,
    gccPctSetAt: "2025-01-02T13:00:00.000Z",
    gccReason: "Reason A — re-stamped on read",
  };
  expect(
    "timestamp+reason churn alone is NOT a tower mutation",
    jsonEqual(projectRowForDiff(serverRow), projectRowForDiff(clientRow)),
  );
}

// Case 5: full tower with 6 legacy server rows vs 6 client-migrated
// seed rows. Tower-level diff must be EQUAL (the 12-tower 403 scenario
// the user just hit).
{
  const serverTower = {
    l4Rows: [
      { id: "r1", l4: "A", fteOnshore: 5 },
      { id: "r2", l4: "B", fteOnshore: 5 },
      { id: "r3", l4: "C", fteOnshore: 5 },
      { id: "r4", l4: "D", fteOnshore: 5 },
      { id: "r5", l4: "E", fteOnshore: 5 },
      { id: "r6", l4: "F", fteOnshore: 5 },
    ],
    l3Rows: [],
    lastUpdated: "2025-01-01T12:00:00.000Z",
  };
  const clientTower = {
    l4Rows: serverTower.l4Rows.map((r) => ({
      ...r,
      gccPct: 0,
      gccPctSource: "seed",
      gccPctSetAt: "2025-05-13T15:00:00.000Z",
      gccReason: "Awaiting Step 2 review — no offshore signal in legacy data.",
    })),
    l3Rows: [],
    lastUpdated: "2025-05-13T15:00:00.000Z",
  };
  expect(
    "legacy server tower diffs EQUAL against client-migrated seed tower",
    jsonEqual(projectTowerForDiff(serverTower), projectTowerForDiff(clientTower)),
  );
}

// Case 6: same legacy tower vs client with ONE real user edit.
// Should DIFFER so the single-tower-per-save guard allows it through.
{
  const serverTower = {
    l4Rows: [
      { id: "r1", l4: "A", fteOnshore: 5 },
      { id: "r2", l4: "B", fteOnshore: 5 },
    ],
    l3Rows: [],
  };
  const clientTower = {
    l4Rows: [
      {
        id: "r1",
        l4: "A",
        fteOnshore: 5,
        gccPct: 70,
        gccPctSource: "user",
        gccPctSetAt: "2025-05-14T15:00:00.000Z",
        gccReason: "User set 70%.",
      },
      {
        id: "r2",
        l4: "B",
        fteOnshore: 5,
        gccPct: 0,
        gccPctSource: "seed",
        gccPctSetAt: "2025-05-14T15:00:00.000Z",
        gccReason: "Awaiting review.",
      },
    ],
    l3Rows: [],
  };
  expect(
    "tower with a single user edit DIFFERS from server tower",
    !jsonEqual(projectTowerForDiff(serverTower), projectTowerForDiff(clientTower)),
  );
}

console.log("\n================");
if (failures > 0) {
  console.error(`${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log("All assertions pass. Server-side diff normalization is correct.");
