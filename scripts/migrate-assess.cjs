/**
 * Run sql/001_assess_workshop.sql. Uses DATABASE_URL, or POSTGRES_URL / POSTGRES_PRISMA_URL (Vercel+Neon).
 * Loads .env.local from the project root (same as Next.js).
 * Usage: npm run db:migrate
 */
const fs = require("fs");
const path = require("path");
const postgres = require("postgres");
const root = path.join(__dirname, "..");

/** Same order as Next.js: base, then .local wins. */
require("dotenv").config({ path: path.join(root, ".env") });
require("dotenv").config({ path: path.join(root, ".env.local"), override: true });

const url =
  (process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || "").trim();
if (!url) {
  console.error(
    "Set DATABASE_URL or POSTGRES_URL (e.g. in .env.local) and run from project root: npm run db:migrate",
  );
  process.exit(1);
}

const sqlFile = path.join(__dirname, "../sql/001_assess_workshop.sql");
const body = fs.readFileSync(sqlFile, "utf8");

async function main() {
  const sql = postgres(url, { max: 1 });
  try {
    await sql.unsafe(body);
    console.log("OK: assess_workshop migration applied.");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
