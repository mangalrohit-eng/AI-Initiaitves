// Lightweight presence store backed by a sidecar row in the existing
// `assess_workshop` Postgres table.
//
//   row id = "presence", program = { sessions: { "<uuid>": "<isoTimestamp>" } }
//
// Why not a new table: the team explicitly wanted "no new schema" for this
// feature. Why not the existing `id = "default"` row: workshop saves write
// the entire program JSONB blob on every flush; mixing presence into the
// same document would race with — and could clobber — workshop edits. The
// dedicated `id = "presence"` row keeps the two write paths fully isolated
// while reusing the table.
//
// The `assess_workshop` GET handler at `src/app/api/assess/route.ts` filters
// `WHERE id = 'default'`, so it never sees the presence row and never tries
// to validate it as an `AssessProgramV5`.

import { ASSESS_WORKSHOP_ID, getDb, isDatabaseUrlConfigured } from "@/lib/db";

const PRESENCE_ROW_ID = "presence";
const PRUNE_OLDER_THAN_MS = 48 * 60 * 60 * 1000;
const PRUNE_THRESHOLD_ENTRIES = 1000;

/** Hex/dash UUID-shaped strings only — guards the JSONB key path. */
const SESSION_ID_RE = /^[a-zA-Z0-9_-]{8,64}$/;

export function isValidSessionId(s: unknown): s is string {
  return typeof s === "string" && SESSION_ID_RE.test(s);
}

export function isPresenceConfigured(): boolean {
  return isDatabaseUrlConfigured() && getDb() !== null;
}

// Used to silence the dedicated workshop row from any wildcard read; callers
// SELECT explicitly by id, so this is informational only.
export { ASSESS_WORKSHOP_ID, PRESENCE_ROW_ID };

/**
 * Single atomic write — `INSERT ... ON CONFLICT DO UPDATE SET program =
 * jsonb_set(...)` — so two browsers pinging at the same instant can't lose
 * each other's entries. Idempotent: repeated pings from the same browser
 * just overwrite the same key with a newer timestamp.
 */
export async function recordPresence(sessionId: string): Promise<void> {
  if (!isValidSessionId(sessionId)) return;
  const sql = getDb();
  if (!sql) return;
  const nowIso = new Date().toISOString();
  await sql`
    INSERT INTO assess_workshop (id, program, updated_at)
    VALUES (
      ${PRESENCE_ROW_ID},
      jsonb_build_object('sessions', jsonb_build_object(${sessionId}::text, to_jsonb(${nowIso}::text))),
      now()
    )
    ON CONFLICT (id) DO UPDATE
    SET program = jsonb_set(
          COALESCE(assess_workshop.program, '{}'::jsonb),
          ARRAY['sessions', ${sessionId}::text],
          to_jsonb(${nowIso}::text),
          true
        ),
        updated_at = now()
  `;
}

type PresenceDoc = { sessions?: Record<string, unknown> };

/**
 * Counts distinct sessionIds last seen since the most recent UTC midnight.
 * Fires-and-forgets a prune `UPDATE` when the sessions blob has grown past
 * `PRUNE_THRESHOLD_ENTRIES` so the doc stays bounded without slowing the
 * user-visible read path.
 */
export async function countActiveToday(now: Date = new Date()): Promise<number> {
  const sql = getDb();
  if (!sql) return 0;
  const rows = await sql<{ program: unknown }[]>`
    SELECT program FROM assess_workshop WHERE id = ${PRESENCE_ROW_ID}
  `;
  if (!rows.length) return 0;
  const program = rows[0].program;
  const sessions = isPresenceDoc(program) ? program.sessions ?? {} : {};
  const startOfTodayMs = startOfUtcDay(now).getTime();
  let active = 0;
  for (const v of Object.values(sessions)) {
    if (typeof v !== "string") continue;
    const ms = Date.parse(v);
    if (Number.isFinite(ms) && ms >= startOfTodayMs) active += 1;
  }
  if (Object.keys(sessions).length > PRUNE_THRESHOLD_ENTRIES) {
    void prune(now).catch(() => {
      /* fire-and-forget; cleanup is best-effort */
    });
  }
  return active;
}

function isPresenceDoc(x: unknown): x is PresenceDoc {
  return x !== null && typeof x === "object" && !Array.isArray(x);
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

async function prune(now: Date): Promise<void> {
  const sql = getDb();
  if (!sql) return;
  const rows = await sql<{ program: unknown }[]>`
    SELECT program FROM assess_workshop WHERE id = ${PRESENCE_ROW_ID}
  `;
  if (!rows.length) return;
  const program = rows[0].program;
  if (!isPresenceDoc(program) || !program.sessions) return;
  const cutoff = now.getTime() - PRUNE_OLDER_THAN_MS;
  const next: Record<string, string> = {};
  for (const [k, v] of Object.entries(program.sessions)) {
    if (typeof v !== "string") continue;
    const ms = Date.parse(v);
    if (Number.isFinite(ms) && ms >= cutoff) next[k] = v;
  }
  if (Object.keys(next).length === Object.keys(program.sessions).length) return;
  const payload = { sessions: next };
  await sql`
    UPDATE assess_workshop
    SET program = ${sql.json(payload as unknown as Parameters<typeof sql.json>[0])},
        updated_at = now()
    WHERE id = ${PRESENCE_ROW_ID}
  `;
}

/** Used by the `_active_today` test path; not exported via the route handler. */
export const __test = { startOfUtcDay };
