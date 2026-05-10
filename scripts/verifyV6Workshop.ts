/**
 * V6 workshop verification + one-shot migration.
 *
 * Pre-deploy safety check for the v5-translator-deletion ("Option A")
 * cleanup. Confirms the `assess_workshop` row(s) in the target Postgres
 * are already v6-shaped (every tower has populated `l3Rows` and the
 * stored `program.version === 6`). If any row is still v5-shaped, the
 * script can also derive the missing `l3Rows` from `l4Rows` and write
 * the migrated payload back.
 *
 * Why this exists:
 *   - Prod has been running with NEXT_PUBLIC_FORGE_SCHEMA=v6 for the
 *     whole cutover window, so the in-browser translator
 *     (`localStore.migrateToV6IfActive`) has already upgraded every
 *     workshop row that has been opened at least once. This script
 *     verifies that's true before we delete the translator.
 *   - If a tower was never opened post-cutover, the script migrates it
 *     using the SAME deterministic `deriveL3Rows()` helper the runtime
 *     translator uses. No behavioural drift between the script and the
 *     translator we're deleting.
 *
 * Idempotent. Safe to re-run. Default mode is read-only — pass
 * `--write` to actually persist any derived rows.
 *
 * Usage:
 *   tsx scripts/verifyV6Workshop.ts                # uses DATABASE_URL from env, READ-ONLY
 *   tsx scripts/verifyV6Workshop.ts --write        # uses DATABASE_URL, will UPDATE if needed
 *   tsx scripts/verifyV6Workshop.ts --url "postgresql://..."           # explicit URL, READ-ONLY
 *   tsx scripts/verifyV6Workshop.ts --url "postgresql://..." --write   # explicit URL + write
 *
 * Exit codes:
 *   0 — every row is already v6 (no migration needed) OR migration ran successfully with --write.
 *   2 — one or more rows still need migration AND --write was not passed.
 *   3 — connection / query failure.
 */

import * as path from "node:path";
import postgres from "postgres";
import dotenv from "dotenv";
import { deriveL3Rows } from "../src/lib/assess/deriveL3Rows";
import type {
  AssessProgramV2,
  L4WorkforceRow,
  TowerAssessState,
  TowerId,
} from "../src/data/assess/types";

const root = path.join(__dirname, "..");
dotenv.config({ path: path.join(root, ".env") });
dotenv.config({ path: path.join(root, ".env.local"), override: true });

const args = process.argv.slice(2);
const writeMode = args.includes("--write");
const urlIdx = args.indexOf("--url");
const explicitUrl = urlIdx >= 0 ? args[urlIdx + 1] : undefined;

const databaseUrl =
  (explicitUrl && explicitUrl.trim()) ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  "";

if (!databaseUrl) {
  console.error(
    "No DATABASE_URL configured. Pass --url <conn-str> or set DATABASE_URL in .env.local.",
  );
  process.exit(3);
}

function endpointHost(u: string): string {
  try {
    return new URL(u).hostname;
  } catch {
    return "(unparseable)";
  }
}

function cleanLegacyL4Row(r: L4WorkforceRow): L4WorkforceRow {
  // Mirrors the cleanup pass in localStore.migrateToV6IfActive: keep
  // identity + headcount + spend + l5 activity context, drop the v5-only
  // dial fields and the stale curated initiative payload (`l5Items`).
  const next: L4WorkforceRow = {
    id: r.id,
    l2: r.l2,
    l3: r.l3,
    l4: r.l4,
    fteOnshore: r.fteOnshore,
    fteOffshore: r.fteOffshore,
    contractorOnshore: r.contractorOnshore,
    contractorOffshore: r.contractorOffshore,
  };
  if (r.annualSpendUsd != null) next.annualSpendUsd = r.annualSpendUsd;
  if (r.l5Activities && r.l5Activities.length > 0) {
    next.l5Activities = r.l5Activities;
  }
  return next;
}

type TowerReport = {
  towerId: TowerId;
  l4Count: number;
  l3CountBefore: number;
  l3CountAfter: number;
  needsMigration: boolean;
};

type RowReport = {
  id: string;
  versionBefore: number;
  versionAfter: number;
  towerReports: TowerReport[];
  rowNeedsMigration: boolean;
};

function migrateProgram(p: AssessProgramV2): {
  migrated: AssessProgramV2;
  report: RowReport["towerReports"];
  rowNeedsMigration: boolean;
} {
  const inputVersion = p.version ?? 0;
  let touched = false;
  const towers: AssessProgramV2["towers"] = {};
  const report: TowerReport[] = [];

  // Defensive: a malformed legacy row may have no `towers` object at all
  // (we observed this on a stray dev row). Treat it as already-clean —
  // there's nothing to derive — and just stamp version=6 if needed.
  const towersObj =
    p.towers && typeof p.towers === "object" ? p.towers : {};

  for (const [k, t] of Object.entries(towersObj)) {
    if (!t) continue;
    const towerId = k as TowerId;
    const tower = t as TowerAssessState;
    const l3Before = tower.l3Rows?.length ?? 0;
    const needsFreshDerivation =
      inputVersion < 6 || !tower.l3Rows || tower.l3Rows.length === 0;

    if (needsFreshDerivation) {
      const cleanedL4Rows = tower.l4Rows.map(cleanLegacyL4Row);
      const derivedL3Rows = deriveL3Rows(cleanedL4Rows, towerId);
      towers[towerId] = {
        ...tower,
        l4Rows: cleanedL4Rows,
        l3Rows: derivedL3Rows,
      };
      touched = true;
      report.push({
        towerId,
        l4Count: cleanedL4Rows.length,
        l3CountBefore: l3Before,
        l3CountAfter: derivedL3Rows.length,
        needsMigration: true,
      });
    } else {
      towers[towerId] = tower;
      report.push({
        towerId,
        l4Count: tower.l4Rows.length,
        l3CountBefore: l3Before,
        l3CountAfter: l3Before,
        needsMigration: false,
      });
    }
  }

  const rowNeedsMigration = touched || inputVersion < 6;
  const migrated: AssessProgramV2 = rowNeedsMigration
    ? { ...p, version: 6, towers }
    : p;

  return { migrated, report, rowNeedsMigration };
}

async function main() {
  console.log("=".repeat(72));
  console.log("V6 Workshop Verification");
  console.log("=".repeat(72));
  console.log(`Endpoint: ${endpointHost(databaseUrl)}`);
  console.log(`Mode:     ${writeMode ? "WRITE (will UPDATE if needed)" : "READ-ONLY (use --write to persist)"}`);
  console.log("");

  const sql = postgres(databaseUrl, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 20,
  });

  let exitCode = 0;
  try {
    // Filter to the actual workshop row only. The `assess_workshop` table
    // also holds an unrelated sidecar row (`id = 'presence'`) used by the
    // multi-user presence feature — same table, different schema. The GET
    // /api/assess handler filters `WHERE id = 'default'`, so we mirror it
    // here for byte-identical fidelity with the runtime read path.
    const rows = await sql<{ id: string; program: unknown; updated_at: Date }[]>`
      SELECT id, program, updated_at FROM assess_workshop WHERE id = 'default' ORDER BY id
    `;

    if (rows.length === 0) {
      console.log("No assess_workshop rows with id='default' found. Nothing to verify.");
      return;
    }

    console.log(`Found ${rows.length} workshop row(s).`);
    console.log("");

    const reports: RowReport[] = [];

    for (const r of rows) {
      const program = r.program as AssessProgramV2;
      const versionBefore = program.version ?? 0;
      const { migrated, report, rowNeedsMigration } = migrateProgram(program);
      const versionAfter = migrated.version;

      console.log(`--- row id="${r.id}" updated_at=${r.updated_at.toISOString()}`);
      console.log(`    version: ${versionBefore} -> ${versionAfter}`);
      const towerHeaders = "      tower".padEnd(34) + "L4  L3(before)  L3(after)  needsMigration";
      console.log(towerHeaders);
      for (const tr of report) {
        const line =
          "      " +
          tr.towerId.padEnd(28) +
          String(tr.l4Count).padStart(4) +
          String(tr.l3CountBefore).padStart(11) +
          String(tr.l3CountAfter).padStart(11) +
          "  " +
          (tr.needsMigration ? "YES" : "no");
        console.log(line);
      }

      reports.push({
        id: r.id,
        versionBefore,
        versionAfter,
        towerReports: report,
        rowNeedsMigration,
      });

      if (rowNeedsMigration && writeMode) {
        await sql`
          UPDATE assess_workshop
             SET program = ${sql.json(migrated as unknown as object)}::jsonb,
                 updated_at = now()
           WHERE id = ${r.id}
        `;
        console.log(`    WROTE migrated payload back to row id="${r.id}".`);
      }
      console.log("");
    }

    const dirty = reports.filter((r) => r.rowNeedsMigration);
    console.log("=".repeat(72));
    if (dirty.length === 0) {
      console.log("All rows already v6. Translator-deletion is safe.");
    } else if (writeMode) {
      console.log(`Migrated ${dirty.length} of ${reports.length} row(s). Re-run without --write to confirm.`);
    } else {
      console.log(
        `${dirty.length} of ${reports.length} row(s) still need migration. Re-run with --write to fix.`,
      );
      exitCode = 2;
    }
    console.log("=".repeat(72));
  } catch (err) {
    console.error("ERROR:", err instanceof Error ? err.stack ?? err.message : String(err));
    exitCode = 3;
  } finally {
    await sql.end({ timeout: 5 });
  }

  process.exit(exitCode);
}

void main();
