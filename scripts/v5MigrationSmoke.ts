/**
 * V5 migration smoke test — read the dev DB, validate the AssessProgramV5
 * shape end-to-end against the same import path the GET /api/assess route
 * uses. Fails (non-zero exit) on any mismatch so CI / cutover playbooks can
 * gate on it.
 *
 * Pre-req: `npm run db:migrate` has been run against the same DATABASE_URL.
 *
 * Verifies:
 *   1. Connection to the dev Postgres works.
 *   2. The `assess_workshop` row (if any) loads cleanly.
 *   3. `importAssessProgramFromJsonText` returns ok:true (covers V2/V3/V4 → V5
 *      migration paths in `localStore.migrateAssessProgram`).
 *   4. The returned program is `version: 5`.
 *   5. Each tower's workforce uses the V5 keys: `l4Rows` exists; rows carry
 *      both `l4` (Activity Group) and either `l5Activities` or `l5Items`
 *      where present (the LLM may not have generated yet — empty arrays are
 *      valid, but the field shape must be V5).
 *
 * Usage: tsx scripts/v5MigrationSmoke.ts
 */

import * as path from "node:path";
import postgres from "postgres";
import dotenv from "dotenv";
import { importAssessProgramFromJsonText } from "../src/lib/assess/assessProgramIO";
import type { AssessProgramV2, TowerAssessState } from "../src/data/assess/types";

const root = path.join(__dirname, "..");

// Match the migrate-assess.cjs / Next.js env precedence exactly:
// load .env first, then .env.local with override so the .local value wins
// (and within a single file, the LAST declaration of a key wins per
// standard dotenv semantics — important because .env.local may carry
// multiple historical DATABASE_URL lines and only the last one is
// authoritative).
dotenv.config({ path: path.join(root, ".env") });
dotenv.config({ path: path.join(root, ".env.local"), override: true });

const url = (
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  ""
).trim();

if (!url) {
  console.error("DATABASE_URL not set in .env / .env.local — abort.");
  process.exit(1);
}

// Mask credentials when echoing the host so we don't leak passwords to logs.
const safeHost = (() => {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname}`;
  } catch {
    return "(unparseable url)";
  }
})();
console.log(`> Using Postgres host: ${safeHost}`);

async function main() {
  const sql = postgres(url, { max: 1, idle_timeout: 5 });
  const failures: string[] = [];
  const checks: { name: string; ok: boolean; detail?: string }[] = [];

  function check(name: string, ok: boolean, detail?: string) {
    checks.push({ name, ok, detail });
    if (!ok) failures.push(name);
  }

  try {
    const rows = await sql<{ program: unknown; updated_at: string }[]>`
      SELECT program, updated_at FROM assess_workshop WHERE id = 'default'
    `;
    check("DB connection + table accessible", true);

    if (rows.length === 0) {
      check(
        "assess_workshop has a 'default' row",
        false,
        "No row found — load the sample via the UI, then re-run.",
      );
      reportAndExit(checks, failures);
      return;
    }

    const r = rows[0];
    const asJson = JSON.stringify(r.program);
    const parsed = importAssessProgramFromJsonText(asJson);
    check(
      "importAssessProgramFromJsonText accepts the stored payload",
      parsed.ok,
      parsed.ok ? undefined : `import error: ${parsed.error}`,
    );
    if (!parsed.ok) {
      reportAndExit(checks, failures);
      return;
    }

    const program: AssessProgramV2 = parsed.program;
    check(
      "Migrated program reports version: 5",
      program.version === 5,
      `version=${program.version}`,
    );

    const towerEntries = Object.entries(program.towers ?? {}) as [
      string,
      TowerAssessState | undefined,
    ][];
    check(
      "At least one tower present after migration",
      towerEntries.length > 0,
      `${towerEntries.length} tower(s)`,
    );

    let towersWithRows = 0;
    let totalRows = 0;
    let rowsWithL4Field = 0;
    let rowsWithL5Field = 0;
    const sampleViolations: string[] = [];

    for (const [towerId, t] of towerEntries) {
      if (!t) continue;
      const l4Rows = (t as TowerAssessState & { l4Rows?: unknown[] }).l4Rows;
      if (!Array.isArray(l4Rows) || l4Rows.length === 0) continue;
      towersWithRows += 1;
      for (const row of l4Rows as Record<string, unknown>[]) {
        totalRows += 1;
        if (typeof row.l4 === "string") rowsWithL4Field += 1;
        const hasL5Activities =
          Array.isArray(row.l5Activities) || Array.isArray(row.l5Items);
        if (hasL5Activities) rowsWithL5Field += 1;
        if (typeof row.l4 !== "string" && sampleViolations.length < 3) {
          sampleViolations.push(
            `tower ${towerId} row ${String(row.id)}: missing l4 (got ${JSON.stringify(row.l4)})`,
          );
        }
      }
    }

    check(
      "Towers carry V5 l4Rows (renamed from V4 l3Rows)",
      towersWithRows > 0,
      `${towersWithRows} tower(s) with rows`,
    );
    if (totalRows > 0) {
      check(
        "Every l4Row carries the V5 l4 (Activity Group) field",
        rowsWithL4Field === totalRows,
        `${rowsWithL4Field}/${totalRows} have l4${
          sampleViolations.length ? "; sample: " + sampleViolations.join(" | ") : ""
        }`,
      );
      check(
        "At least one row exposes l5Activities/l5Items (V5 leaf shape)",
        rowsWithL5Field > 0,
        `${rowsWithL5Field}/${totalRows} have l5* (0 is OK pre-LLM-generation, but typical workshops have some)`,
      );
    }

    reportAndExit(checks, failures);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

function reportAndExit(
  checks: { name: string; ok: boolean; detail?: string }[],
  failures: string[],
) {
  console.log();
  for (const c of checks) {
    const tag = c.ok ? "PASS" : "FAIL";
    const detail = c.detail ? ` — ${c.detail}` : "";
    console.log(`  [${tag}] ${c.name}${detail}`);
  }
  console.log();
  if (failures.length > 0) {
    console.error(
      `${failures.length} check(s) failed. The dev DB is NOT cleanly on V5 yet.`,
    );
    process.exit(1);
  }
  console.log("All V5 migration smoke checks passed.");
  process.exit(0);
}

main().catch((e) => {
  console.error("Smoke test crashed:", e);
  process.exit(2);
});
