/**
 * Run every sql/*.sql migration in lexical order against the configured
 * Postgres. Uses DATABASE_URL, or POSTGRES_URL / POSTGRES_PRISMA_URL
 * (Vercel + Neon). Loads .env.local from the project root (same as Next.js).
 *
 * One-off target (e.g. prod while .env.local points at dev): set
 * MIGRATE_DATABASE_URL to the full connection string for that run only.
 * It wins over .env / .env.local so you do not have to swap commented lines.
 *
 * Usage: npm run db:migrate
 *
 * Each migration is wrapped in a transaction inside the .sql file (BEGIN/
 * COMMIT). Re-running is idempotent — every script in this folder is
 * authored to no-op when applied to an already-migrated database.
 */
const fs = require("fs");
const path = require("path");
const postgres = require("postgres");
const root = path.join(__dirname, "..");

/** Same order as Next.js: base, then .local wins. */
require("dotenv").config({ path: path.join(root, ".env") });
require("dotenv").config({ path: path.join(root, ".env.local"), override: true });

const url = (
  process.env.MIGRATE_DATABASE_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  ""
).trim();
if (!url) {
  console.error(
    "Set DATABASE_URL or POSTGRES_URL (e.g. in .env.local), or MIGRATE_DATABASE_URL for a one-off target, then run from project root: npm run db:migrate",
  );
  process.exit(1);
}
if (process.env.MIGRATE_DATABASE_URL?.trim()) {
  console.info("[migrate] Using MIGRATE_DATABASE_URL (one-off target).");
}

const sqlDir = path.join(__dirname, "../sql");
const files = fs
  .readdirSync(sqlDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

if (files.length === 0) {
  console.error(`No .sql files found in ${sqlDir}`);
  process.exit(1);
}

async function main() {
  const sql = postgres(url, { max: 1 });
  try {
    for (const f of files) {
      const body = fs.readFileSync(path.join(sqlDir, f), "utf8");
      await sql.unsafe(body);
      console.log(`OK: ${f} applied.`);
    }
    console.log(`Done: ${files.length} migration${files.length === 1 ? "" : "s"} applied.`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
