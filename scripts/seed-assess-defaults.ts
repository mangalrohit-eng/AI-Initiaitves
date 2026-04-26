/**
 * Write the workshop-starter assess program (with Versant-aware L4 offshoring% and
 * AI-impact% defaults per row, and matching tower baselines) to Postgres.
 *
 * Run from the project root:
 *   npm run db:seed
 *
 * Reads `.env` then `.env.local` for `DATABASE_URL` (or `POSTGRES_URL`).
 * Idempotent: upserts the single `assess_workshop` row with id `default`.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import postgres from "postgres";
import { buildSeededAssessProgramV2 } from "../src/data/assess/seedAssessProgram";
import { towers } from "../src/data/towers";
import type { TowerId } from "../src/data/assess/types";
import { towerOutcomeForState } from "../src/lib/assess/scenarioModel";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

dotenv.config({ path: path.join(root, ".env") });
dotenv.config({ path: path.join(root, ".env.local"), override: true });

const url = (
  process.env.DATABASE_URL
  ?? process.env.POSTGRES_URL
  ?? process.env.POSTGRES_PRISMA_URL
  ?? ""
).trim();

if (!url) {
  console.error(
    "Set DATABASE_URL or POSTGRES_URL (e.g. in .env.local) and run from project root: npm run db:seed",
  );
  process.exit(1);
}

const ASSESS_WORKSHOP_ID = "default";

async function main(): Promise<void> {
  const program = buildSeededAssessProgramV2();
  console.log(
    `Seeding ${Object.keys(program.towers).length} towers with starter L4 defaults …`,
  );

  for (const tw of towers) {
    const id = tw.id as TowerId;
    const o = towerOutcomeForState(id, program);
    if (!o) continue;
    console.log(
      `  ${tw.name.padEnd(30)} baseline off ${o.baseline.offshorePct.toFixed(0)}%`
        + ` / AI ${o.baseline.aiPct.toFixed(0)}%`
        + ` · pool $${(o.pool / 1_000_000).toFixed(1)}M`
        + ` · modeled $${(o.scenario.combined / 1_000_000).toFixed(1)}M`,
    );
  }

  const sql = postgres(url, { max: 1 });
  try {
    const payload = JSON.parse(JSON.stringify(program)) as Record<string, unknown>;
    await sql`
      INSERT INTO assess_workshop (id, program, updated_at)
      VALUES (
        ${ASSESS_WORKSHOP_ID},
        ${sql.json(payload)},
        now()
      )
      ON CONFLICT (id) DO UPDATE
      SET program = EXCLUDED.program, updated_at = now()
    `;
    console.log("\nOK: starter assess defaults written to assess_workshop.");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e);
  console.error("Seed failed:", msg);
  process.exit(1);
});
