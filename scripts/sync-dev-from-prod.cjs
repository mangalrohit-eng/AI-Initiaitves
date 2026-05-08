/**
 * Copy prod's `assess_workshop` row into the dev DB.
 *
 * - Reads PROD_DATABASE_URL (or falls back to a literal --prod-url arg) to SELECT the single row.
 * - Reads DATABASE_URL (or POSTGRES_URL) for the DEV target and UPSERTs the row.
 * - Prod is touched READ-ONLY. Dev is overwritten.
 *
 * Usage:
 *   node scripts/sync-dev-from-prod.cjs --prod-url "postgresql://..." [--dry-run]
 *
 * Or set PROD_DATABASE_URL in env and run plain.
 */
const path = require("path");
const postgres = require("postgres");

const root = path.join(__dirname, "..");
require("dotenv").config({ path: path.join(root, ".env") });
require("dotenv").config({ path: path.join(root, ".env.local"), override: true });

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const prodUrlIdx = args.indexOf("--prod-url");
const prodUrl =
  (prodUrlIdx >= 0 ? args[prodUrlIdx + 1] : process.env.PROD_DATABASE_URL) || "";
const devUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";

if (!prodUrl) {
  console.error("Set PROD_DATABASE_URL env var or pass --prod-url <conn-str>.");
  process.exit(1);
}
if (!devUrl) {
  console.error("Dev DATABASE_URL not set in .env.local.");
  process.exit(1);
}
if (prodUrl === devUrl) {
  console.error("Prod URL == Dev URL — refusing. Check your .env.local.");
  process.exit(1);
}

function endpointHost(u) {
  try {
    return new URL(u).hostname;
  } catch {
    return "(unparseable)";
  }
}

async function main() {
  console.log("PROD endpoint: " + endpointHost(prodUrl));
  console.log("DEV  endpoint: " + endpointHost(devUrl));

  const prod = postgres(prodUrl, { max: 1 });
  const dev = postgres(devUrl, { max: 1 });

  try {
    const prodRows = await prod`SELECT id, program, updated_at FROM assess_workshop`;
    console.log(`PROD assess_workshop rows: ${prodRows.length}`);
    if (prodRows.length === 0) {
      console.error("PROD has no rows in assess_workshop. Aborting.");
      process.exit(2);
    }
    for (const r of prodRows) {
      const bytes = JSON.stringify(r.program).length;
      console.log(`  id=${r.id} bytes=${bytes} updated_at=${r.updated_at.toISOString()}`);
    }

    const devBeforeRows = await dev`SELECT id, updated_at FROM assess_workshop`;
    console.log(`DEV assess_workshop rows BEFORE sync: ${devBeforeRows.length}`);
    for (const r of devBeforeRows) {
      console.log(`  id=${r.id} updated_at=${r.updated_at.toISOString()}`);
    }

    if (dryRun) {
      console.log("--dry-run set; not writing.");
      return;
    }

    for (const r of prodRows) {
      await dev`
        INSERT INTO assess_workshop (id, program, updated_at)
        VALUES (${r.id}, ${dev.json(r.program)}, ${r.updated_at})
        ON CONFLICT (id) DO UPDATE
          SET program = EXCLUDED.program,
              updated_at = EXCLUDED.updated_at
      `;
      console.log(`UPSERTED id=${r.id} into DEV`);
    }

    const devAfterRows = await dev`SELECT id, program, updated_at FROM assess_workshop`;
    console.log(`DEV assess_workshop rows AFTER sync: ${devAfterRows.length}`);
    for (const r of devAfterRows) {
      const bytes = JSON.stringify(r.program).length;
      console.log(`  id=${r.id} bytes=${bytes} updated_at=${r.updated_at.toISOString()}`);
    }
  } finally {
    await prod.end({ timeout: 5 });
    await dev.end({ timeout: 5 });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
