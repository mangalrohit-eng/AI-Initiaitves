/**
 * Mirror prod's entire `public` schema into the dev DB.
 *
 * - Reads PROD_DATABASE_URL (or --prod-url) and copies every base table in
 *   the public schema. Prod is touched READ-ONLY inside a REPEATABLE READ
 *   snapshot so all per-table reads see one consistent point in time.
 * - Reads DATABASE_URL / POSTGRES_URL for the DEV target. Inside a single
 *   transaction: TRUNCATEs every matching dev table (CASCADE, restart
 *   identity), INSERTs prod rows, then resets sequences to MAX(col).
 * - FK ordering: inserts are topologically sorted by FK constraints
 *   (parents first). On non-Neon Postgres roles with REPLICATION privilege,
 *   `session_replication_role = 'replica'` is also set as belt-and-braces;
 *   on Neon (default project role) that SET is silently skipped because
 *   topological order is sufficient.
 * - Mirror semantics: dev rows that don't exist in prod ARE deleted.
 * - Refuses to run if PROD_URL === DEV_URL.
 *
 * Usage:
 *   node scripts/sync-dev-from-prod.cjs --prod-url "postgresql://..." [--dry-run] [--exclude t1,t2]
 *
 * Or set PROD_DATABASE_URL in env and run plain.
 *
 * Known limits:
 *   - Tables with a `GENERATED ALWAYS AS IDENTITY` column are not supported
 *     (insert would need `OVERRIDING SYSTEM VALUE`). The script aborts with
 *     a clear message if it encounters one. None today; revisit if added.
 *   - Schema itself (DDL) is NOT copied. Both DBs must already have the same
 *     tables; run `npm run db:migrate` against dev first if drifted.
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
const excludeIdx = args.indexOf("--exclude");
const excludeList =
  excludeIdx >= 0 && args[excludeIdx + 1]
    ? args[excludeIdx + 1]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

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

function quoteIdent(s) {
  return '"' + String(s).replace(/"/g, '""') + '"';
}

function isJsonType(col) {
  return col.data_type === "json" || col.data_type === "jsonb";
}

async function listTables(sql) {
  const rows = await sql`
    SELECT table_name
      FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_type = 'BASE TABLE'
     ORDER BY table_name
  `;
  return rows.map((r) => r.table_name);
}

async function getColumns(sql, tableName) {
  return await sql`
    SELECT column_name,
           data_type,
           udt_name,
           is_identity,
           identity_generation,
           is_generated
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = ${tableName}
     ORDER BY ordinal_position
  `;
}

async function listSerialColumns(sql) {
  // Every public-schema column whose default is backed by a sequence
  // (serial / bigserial / GENERATED ... AS IDENTITY). Empty today; future-proof.
  return await sql`
    SELECT n.nspname AS schema_name,
           c.relname AS table_name,
           a.attname AS column_name,
           pg_get_serial_sequence(format('%I.%I', n.nspname, c.relname), a.attname) AS sequence_name
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid
     WHERE c.relkind = 'r'
       AND n.nspname = 'public'
       AND a.attnum > 0
       AND NOT a.attisdropped
       AND pg_get_serial_sequence(format('%I.%I', n.nspname, c.relname), a.attname) IS NOT NULL
  `;
}

async function readCount(sql, table) {
  const [{ count }] = await sql`
    SELECT COUNT(*)::int AS count FROM ${sql(table)}
  `;
  return count;
}

/**
 * Order `tables` so any table referenced by a FK appears before the
 * referencing table. Cross-schema FKs are ignored. Self-referential FKs
 * (a row referencing another row in the same table) don't constrain the
 * table-level order. Throws on a cyclic FK between distinct tables, which
 * cannot be satisfied without disabling triggers.
 */
async function buildInsertOrder(sql, tables) {
  const edges = await sql`
    SELECT
      child_cls.relname  AS child,
      parent_cls.relname AS parent
    FROM pg_constraint c
    JOIN pg_class     child_cls  ON child_cls.oid  = c.conrelid
    JOIN pg_class     parent_cls ON parent_cls.oid = c.confrelid
    JOIN pg_namespace child_ns   ON child_ns.oid   = child_cls.relnamespace
    JOIN pg_namespace parent_ns  ON parent_ns.oid  = parent_cls.relnamespace
    WHERE c.contype = 'f'
      AND child_ns.nspname  = 'public'
      AND parent_ns.nspname = 'public'
  `;

  const tableSet = new Set(tables);
  const parentsOf = new Map(tables.map((t) => [t, new Set()]));
  for (const e of edges) {
    if (!tableSet.has(e.child) || !tableSet.has(e.parent)) continue;
    if (e.child === e.parent) continue;
    parentsOf.get(e.child).add(e.parent);
  }

  // Kahn's algorithm. Tie-break alphabetically for stable output.
  const remaining = new Set(tables);
  const result = [];
  while (remaining.size > 0) {
    const ready = [...remaining]
      .filter((t) => parentsOf.get(t).size === 0)
      .sort();
    if (ready.length === 0) {
      throw new Error(
        `Cyclic FK dependency among: ${[...remaining].join(", ")}. ` +
          "Cannot order inserts. Break the cycle or run with a role that has " +
          "REPLICATION (so session_replication_role=replica works).",
      );
    }
    for (const t of ready) {
      remaining.delete(t);
      result.push(t);
      for (const other of remaining) parentsOf.get(other).delete(t);
    }
  }
  return result;
}

async function main() {
  console.log("PROD endpoint: " + endpointHost(prodUrl));
  console.log("DEV  endpoint: " + endpointHost(devUrl));
  console.log("");

  const prod = postgres(prodUrl, { max: 1 });
  const dev = postgres(devUrl, { max: 1 });

  try {
    // Discover schemas on both sides up front so we can warn about drift.
    const prodTablesAll = await listTables(prod);
    const devTablesAll = await listTables(dev);
    const prodSet = new Set(prodTablesAll);
    const devSet = new Set(devTablesAll);

    const onlyOnProd = prodTablesAll.filter((t) => !devSet.has(t));
    const onlyOnDev = devTablesAll.filter((t) => !prodSet.has(t));

    if (onlyOnProd.length || onlyOnDev.length) {
      console.warn("Schema drift detected:");
      if (onlyOnProd.length)
        console.warn("  prod-only (will be SKIPPED): " + onlyOnProd.join(", "));
      if (onlyOnDev.length)
        console.warn(
          "  dev-only  (will be TRUNCATED — not in prod): " + onlyOnDev.join(", "),
        );
      console.warn(
        "  Run `npm run db:migrate` against dev to align schemas before re-syncing if this is unexpected.",
      );
      console.warn("");
    }

    // Tables we'll actively sync (must exist on BOTH sides).
    const syncTables = prodTablesAll.filter(
      (t) => devSet.has(t) && !excludeList.includes(t),
    );

    // Dev-only tables get truncated so dev is a true mirror (no leftover data).
    const devOnlyToTruncate = onlyOnDev.filter((t) => !excludeList.includes(t));

    console.log(`Tables in PROD public schema: ${prodTablesAll.length}`);
    console.log(`Tables in DEV  public schema: ${devTablesAll.length}`);
    if (excludeList.length) console.log(`Excluding: ${excludeList.join(", ")}`);
    console.log(`Tables to sync (prod -> dev): ${syncTables.length}`);
    if (devOnlyToTruncate.length)
      console.log(`Dev-only tables to truncate:  ${devOnlyToTruncate.length}`);
    console.log("");

    // Per-table plan: columns + row counts on both sides.
    const plan = [];
    for (const t of syncTables) {
      const cols = await getColumns(prod, t);
      const alwaysIdentity = cols.find(
        (c) => c.is_identity === "YES" && c.identity_generation === "ALWAYS",
      );
      if (alwaysIdentity) {
        throw new Error(
          `Table "${t}" has a GENERATED ALWAYS AS IDENTITY column "${alwaysIdentity.column_name}". ` +
            "This script doesn't emit `OVERRIDING SYSTEM VALUE`. Either change the column to " +
            "GENERATED BY DEFAULT AS IDENTITY, or extend scripts/sync-dev-from-prod.cjs to handle it.",
        );
      }
      const insertableCols = cols.filter((c) => c.is_generated !== "ALWAYS");
      const prodCount = await readCount(prod, t);
      let devCount = 0;
      try {
        devCount = await readCount(dev, t);
      } catch (e) {
        console.warn(`  WARN: dev table "${t}" not readable: ${e.message}`);
      }
      plan.push({ table: t, cols: insertableCols, prodCount, devCount });
    }

    console.log("Sync plan:");
    for (const p of plan) {
      console.log(
        `  ${p.table.padEnd(40)} prod=${String(p.prodCount).padStart(6)}  dev(before)=${String(p.devCount).padStart(6)}`,
      );
    }
    for (const t of devOnlyToTruncate) {
      console.log(
        `  ${t.padEnd(40)} prod=     -  dev(before)=     ? (will TRUNCATE)`,
      );
    }
    console.log("");

    if (dryRun) {
      console.log("--dry-run set; not writing.");
      return;
    }

    // Plan the insert order before opening the dev tx so any cycle error
    // surfaces cleanly without touching dev.
    const orderedTables = await buildInsertOrder(
      prod,
      plan.map((p) => p.table),
    );
    const planByTable = new Map(plan.map((p) => [p.table, p]));

    // All dev mutations happen inside one transaction. Identity sequences are
    // reset at the end. If anything throws, the whole thing rolls back.
    await dev.begin(async (tx) => {
      // Best-effort: on self-hosted Postgres this disables FK triggers for the
      // tx and load order becomes irrelevant. On Neon (default project role)
      // this raises 42501 — we swallow it via a savepoint and rely on the
      // topological insert order instead.
      try {
        await tx.savepoint(async (sp) => {
          await sp`SET LOCAL session_replication_role = 'replica'`;
        });
      } catch (e) {
        if (e && e.code === "42501") {
          console.log(
            "Note: role lacks REPLICATION privilege (Neon). Proceeding with topological FK order.",
          );
        } else {
          throw e;
        }
      }

      const truncateTargets = [...plan.map((p) => p.table), ...devOnlyToTruncate];
      if (truncateTargets.length) {
        const list = truncateTargets.map(quoteIdent).join(", ");
        console.log(`TRUNCATE ${truncateTargets.length} table(s) (CASCADE)…`);
        await tx.unsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
      }

      // Snapshot prod so per-table reads see one consistent point in time.
      // We deliberately keep this read-only transaction OUTSIDE the dev tx.
      const BATCH = 500;
      for (const tableName of orderedTables) {
        const p = planByTable.get(tableName);
        if (p.prodCount === 0) {
          console.log(`  ${p.table}: 0 rows`);
          continue;
        }
        const rows = await prod`SELECT * FROM ${prod(p.table)}`;
        const colNames = p.cols.map((c) => c.column_name);
        const jsonColNames = new Set(
          p.cols.filter(isJsonType).map((c) => c.column_name),
        );

        const prepared = rows.map((r) => {
          const out = {};
          for (const col of colNames) {
            const v = r[col];
            if (v === undefined || v === null) {
              out[col] = null;
            } else if (jsonColNames.has(col)) {
              out[col] = tx.json(v);
            } else {
              out[col] = v;
            }
          }
          return out;
        });

        let inserted = 0;
        for (let i = 0; i < prepared.length; i += BATCH) {
          const slice = prepared.slice(i, i + BATCH);
          await tx`INSERT INTO ${tx(p.table)} ${tx(slice, ...colNames)}`;
          inserted += slice.length;
        }
        console.log(`  ${p.table}: inserted ${inserted} row(s)`);
      }

      // Reset every sequence to MAX(col) so dev-side inserts don't collide
      // with copied ids. Empty today (text PKs only), but here when needed.
      const seqs = await listSerialColumns(tx);
      let resetCount = 0;
      for (const s of seqs) {
        if (!s.sequence_name) continue;
        // sequence_name from pg_get_serial_sequence already includes the
        // schema-qualified, identifier-safe form (e.g. public.foo_id_seq).
        await tx.unsafe(
          `SELECT setval('${s.sequence_name.replace(/'/g, "''")}', ` +
            `GREATEST(COALESCE((SELECT MAX(${quoteIdent(s.column_name)}) FROM ${quoteIdent(s.table_name)}), 0), 1))`,
        );
        resetCount++;
      }
      if (resetCount > 0) console.log(`Reset ${resetCount} sequence(s).`);
    });

    // Post-sync verification. Read fresh outside the tx that just committed.
    console.log("");
    console.log("Verification (dev row counts after sync):");
    let mismatches = 0;
    for (const p of plan) {
      const after = await readCount(dev, p.table);
      const ok = after === p.prodCount;
      if (!ok) mismatches++;
      console.log(
        `  ${ok ? "OK " : "!! "} ${p.table.padEnd(40)} prod=${String(p.prodCount).padStart(6)}  dev(after)=${String(after).padStart(6)}`,
      );
    }
    for (const t of devOnlyToTruncate) {
      const after = await readCount(dev, t);
      console.log(
        `  ${after === 0 ? "OK " : "!! "} ${t.padEnd(40)} (dev-only)  dev(after)=${String(after).padStart(6)}`,
      );
      if (after !== 0) mismatches++;
    }

    if (mismatches > 0) {
      console.error(`\n${mismatches} table(s) have row-count mismatches.`);
      process.exit(3);
    } else {
      console.log("\nAll tables mirrored successfully.");
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
