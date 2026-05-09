import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { AssessProgramV2 } from "@/data/assess/types";
import { importAssessProgramFromJsonText } from "@/lib/assess/assessProgramIO";
import {
  ADMIN_AUTH_COOKIE_NAME,
  AUTH_COOKIE_NAME,
  isValidAdminSessionToken,
  isValidSessionToken,
} from "@/lib/auth";
import { ASSESS_WORKSHOP_ID, getDb, isDatabaseUrlConfigured } from "@/lib/db";
import { applyClientBootstrapMigrations } from "@/lib/localStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** True when Postgres is configured but the driver failed to connect or query (not a logic error). */
function isDatabaseConnectionFailure(e: unknown): boolean {
  const parts: string[] = [];
  parts.push(String(e));
  if (e instanceof Error) {
    parts.push(e.message, e.name, "code" in e ? String((e as NodeJS.ErrnoException).code) : "");
  }
  if (typeof AggregateError !== "undefined" && e instanceof AggregateError) {
    for (const err of e.errors) {
      if (err instanceof Error) parts.push(err.message, err.name);
    }
  }
  const s = parts.join(" ").toLowerCase();
  return (
    s.includes("connect_timeout") ||
    s.includes("econnrefused") ||
    s.includes("etimedout") ||
    s.includes("enotfound") ||
    s.includes("eai_again") ||
    s.includes("getaddrinfo") ||
    s.includes("connection terminated") ||
    s.includes("connection closed") ||
    s.includes("socket closed") ||
    s.includes("password authentication failed") ||
    s.includes("server closed the connection")
  );
}

/**
 * GET — load persisted assess program, or { program: null, db: unconfigured } if no DB URL env is set.
 * PUT — validate body as AssessProgramV2 and upsert one row in Postgres.
 */
export async function GET() {
  if (!(await isWorkshopAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isDatabaseUrlConfigured() || getDb() === null) {
    return NextResponse.json(
      { ok: true, program: null, db: "unconfigured" as const },
      { status: 200 },
    );
  }
  const sql = getDb()!;
  try {
    const rows = await sql<{ program: unknown; updated_at: string }[]>`
      SELECT program, updated_at
      FROM assess_workshop
      WHERE id = ${ASSESS_WORKSHOP_ID}
    `;
    if (!rows.length) {
      return NextResponse.json(
        { ok: true, program: null, db: "ok" as const, updatedAt: null },
        { status: 200 },
      );
    }
    const r = rows[0];
    const asJson = JSON.stringify(r.program);
    const parsed = importAssessProgramFromJsonText(asJson);
    if (!parsed.ok) {
      return NextResponse.json(
        { error: "Stored program failed validation. Fix or clear `assess_workshop`." },
        { status: 500 },
      );
    }
    return NextResponse.json(
      { ok: true, program: parsed.program, db: "ok" as const, updatedAt: r.updated_at },
      { status: 200 },
    );
  } catch (e) {
    if (isDatabaseConnectionFailure(e)) {
      return NextResponse.json(
        { ok: true, program: null, db: "unavailable" as const },
        { status: 200 },
      );
    }
    const msg = e instanceof Error ? e.message : "Database error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  if (!(await isWorkshopAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isDatabaseUrlConfigured() || getDb() === null) {
    return NextResponse.json(
      { error: "Database not configured (set DATABASE_URL or POSTGRES_URL)." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = importAssessProgramFromJsonText(
    typeof body === "string" ? body : JSON.stringify(body),
  );
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const program: AssessProgramV2 = parsed.program;
  // V6 cutover: accept both legacy v5 payloads and current v6 payloads on
  // the PUT path. The server-side `importAssessProgramFromJsonText`
  // already runs the v5 -> v6 derivation when `IS_V6` is active, so any
  // v5 body lands as version 6 by the time it reaches this check. Both
  // versions persist into the same JSONB column verbatim.
  if (program.version !== 5 && program.version !== 6) {
    return NextResponse.json({ error: "version must be 5 or 6" }, { status: 400 });
  }

  const sql = getDb()!;
  const isAdmin = await isProgramAdminAuthed();
  if (!isAdmin) {
    const current = await readCurrentProgram(sql);
    if (!current) {
      console.error(
        "[PUT /api/assess] 403 — non-admin save against empty DB. Admin must initialize first.",
      );
      return NextResponse.json(
        {
          error:
            "Program admin required to initialize or replace full workshop state. Use /login/admin and retry.",
        },
        { status: 403 },
      );
    }
    // Apply the client-side bootstrap migrations to BOTH sides of the
    // diff. Without this, the client's `getAssessProgram()` legitimately
    // stamps fields (curationContentHash bootstrap, l1L5TreeValidatedAt
    // backfill, buggy-seed status demotion) that the server's parser
    // doesn't add — causing every save to look like a multi-tower
    // mutation and tripping the 403 guard. The migrations are pure +
    // idempotent so applying them server-side is byte-equivalent to what
    // the client produced before sending.
    const normalizedCurrent = applyClientBootstrapMigrations(current);
    const normalizedNext = applyClientBootstrapMigrations(program);
    const scope = validateTowerScopedMutation(normalizedCurrent, normalizedNext);
    if (!scope.ok) {
      const diagnostic = describeDiff(normalizedCurrent, normalizedNext);
      console.error(
        `[PUT /api/assess] 403 — ${scope.error}\n  Diagnostic: ${diagnostic}`,
      );
      return NextResponse.json(
        { error: scope.error, diagnostic },
        { status: 403 },
      );
    }
  }

  try {
    // postgres-js's `sql.json` is typed against its private `JSONValue`; we
    // already round-tripped through `JSON.parse(JSON.stringify(...))` so the
    // payload is a pure JSON tree. Cast through `unknown` so the typecheck
    // accepts the JSON-clean payload.
    const payload = JSON.parse(JSON.stringify(program));
    await sql`
      INSERT INTO assess_workshop (id, program, updated_at)
      VALUES (
        ${ASSESS_WORKSHOP_ID},
        ${sql.json(payload as unknown as Parameters<typeof sql.json>[0])},
        now()
      )
      ON CONFLICT (id) DO UPDATE
      SET program = EXCLUDED.program, updated_at = now()
    `;
    return NextResponse.json(
      { ok: true, updatedAt: new Date().toISOString() },
      { status: 200 },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Database error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function isWorkshopAuthed(): Promise<boolean> {
  const token = cookies().get(AUTH_COOKIE_NAME)?.value;
  return isValidSessionToken(token);
}

async function isProgramAdminAuthed(): Promise<boolean> {
  const token = cookies().get(ADMIN_AUTH_COOKIE_NAME)?.value;
  return isValidAdminSessionToken(token);
}

async function readCurrentProgram(sql: NonNullable<ReturnType<typeof getDb>>): Promise<AssessProgramV2 | null> {
  const rows = await sql<{ program: unknown }[]>`
    SELECT program
    FROM assess_workshop
    WHERE id = ${ASSESS_WORKSHOP_ID}
  `;
  if (!rows.length) return null;
  const asJson = JSON.stringify(rows[0].program);
  const parsed = importAssessProgramFromJsonText(asJson);
  if (!parsed.ok) {
    throw new Error("Stored program failed validation. Fix or clear `assess_workshop`.");
  }
  return parsed.program;
}

function validateTowerScopedMutation(
  current: AssessProgramV2,
  next: AssessProgramV2,
): { ok: true; towerId: string | null } | { ok: false; error: string } {
  // Per-tower rates live on TowerAssessState.rates (no longer on
  // program.global). The single-tower-scope rule below naturally enforces
  // that a tower lead can only edit their own tower's rates: a save that
  // touches two towers' rates at once is rejected as "only one tower per
  // save."
  if (!jsonEqual(current.leadDeadlines ?? null, next.leadDeadlines ?? null)) {
    return {
      ok: false,
      error: "Program admin required: lead-deadlines updates are admin-only.",
    };
  }

  const changedTowers = changedTowerIds(current, next);
  if (changedTowers.length > 1) {
    return {
      ok: false,
      error: `Only one tower can be updated per save for non-admin users (this includes per-tower cost rates). Split the change by tower and retry. (Towers detected as changed: ${changedTowers.join(", ")})`,
    };
  }
  return { ok: true, towerId: changedTowers[0] ?? null };
}

function changedTowerIds(current: AssessProgramV2, next: AssessProgramV2): string[] {
  const ids = new Set<string>([
    ...Object.keys(current.towers ?? {}),
    ...Object.keys(next.towers ?? {}),
  ]);
  const out: string[] = [];
  for (const id of Array.from(ids)) {
    const a = current.towers?.[id as keyof typeof current.towers] ?? null;
    const b = next.towers?.[id as keyof typeof next.towers] ?? null;
    if (!jsonEqual(projectTowerForDiff(a), projectTowerForDiff(b))) out.push(id);
  }
  return out;
}

/**
 * Tower-state projection used by the multi-tower-mutation guard. Strips
 * migration / cache / timestamp fields that the client-side
 * `getAssessProgram()` legitimately stamps on read but the server-side
 * `importAssessProgramFromJsonText()` doesn't, so the diff doesn't trip
 * on benign normalization differences (e.g. `curationContentHash` added
 * by `migrateBootstrapCurationHash`, `lastUpdated` bumped on every
 * write, `l1L5TreeValidatedAt` backfilled by `migrateBackfillStep1Validated`).
 *
 * Keeps every field that genuinely encodes user data: the L4 / L3 rows
 * (with their dial values, headcount, spend, activity lists, AI
 * initiative payloads), baseline, rates, status, AI readiness intake,
 * initiative reviews, plus the explicit confirmation timestamps that
 * the user set by clicking "Mark complete" buttons.
 *
 * Strips:
 *   - `lastUpdated` (auto-bumped on every setTowerAssess write)
 *   - L4 row cache fields: curationContentHash, curationStage,
 *     curationGeneratedAt, curationError (pipeline-managed; not user data)
 *   - L3 row cache fields: same set as L4
 *
 * Confirmation timestamps (capabilityMapConfirmedAt, headcountConfirmedAt,
 * offshoreConfirmedAt, aiConfirmedAt, impactEstimateValidatedAt,
 * aiInitiativesValidatedAt, l1L5TreeValidatedAt) ARE retained — they
 * encode an explicit user action and a non-admin SHOULD only be flipping
 * those for their own tower.
 */
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

const ROW_CACHE_FIELDS = [
  "curationContentHash",
  "curationStage",
  "curationGeneratedAt",
  "curationError",
] as const;

function projectRowForDiff(row: unknown): unknown {
  if (!row || typeof row !== "object") return row;
  const out = { ...(row as Record<string, unknown>) };
  for (const k of ROW_CACHE_FIELDS) {
    delete out[k];
  }
  return out;
}

function jsonEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(normalizeJson(a)) === JSON.stringify(normalizeJson(b));
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

/**
 * Human-readable description of the diff between the DB program and the
 * incoming PUT body. Surfaces the first ~5 fields whose normalized JSON
 * differs so the dev terminal log shows exactly what tripped the
 * tower-scoped mutation guard. Diagnostic only — never persisted, never
 * shown in the UI; the front-end keeps the existing `error` string.
 */
function describeDiff(current: AssessProgramV2, next: AssessProgramV2): string {
  const parts: string[] = [];
  if (!jsonEqual(current.leadDeadlines ?? null, next.leadDeadlines ?? null)) {
    parts.push("leadDeadlines differs");
  }
  const changed = changedTowerIds(current, next);
  if (changed.length > 0) {
    parts.push(`towers changed (${changed.length}): ${changed.join(", ")}`);
    for (const id of changed.slice(0, 3)) {
      const a = projectTowerForDiff(
        (current.towers as Record<string, unknown>)?.[id] ?? null,
      );
      const b = projectTowerForDiff(
        (next.towers as Record<string, unknown>)?.[id] ?? null,
      );
      const fieldDiff = describeTowerFieldDiff(a, b);
      if (fieldDiff) {
        parts.push(`  ${id}: ${fieldDiff}`);
      }
    }
  }
  if (!jsonEqual(current.offshoreAssumptions ?? null, next.offshoreAssumptions ?? null)) {
    parts.push("offshoreAssumptions differs");
  }
  if (current.version !== next.version) {
    parts.push(`version differs (${current.version} → ${next.version})`);
  }
  return parts.length > 0 ? parts.join("; ") : "no observable diff (identical normalized JSON?)";
}

/**
 * Describe which top-level keys on a single tower's state are different.
 * Lists up to 8 keys whose normalized JSON differs — gives the dev a
 * fast path to the field that's drifting (e.g. `l4Rows`, `l3Rows`,
 * `rates`, `aiReadinessIntake`).
 */
function describeTowerFieldDiff(a: unknown, b: unknown): string | null {
  if (!a || !b || typeof a !== "object" || typeof b !== "object") {
    return a !== b ? "tower presence differs" : null;
  }
  const ar = a as Record<string, unknown>;
  const br = b as Record<string, unknown>;
  const keys = Array.from(new Set([...Object.keys(ar), ...Object.keys(br)]));
  const changed: string[] = [];
  for (const k of keys) {
    if (!jsonEqual(ar[k], br[k])) changed.push(k);
  }
  if (changed.length === 0) return null;
  return `field(s) ${changed.slice(0, 8).join(", ")}${changed.length > 8 ? `, +${changed.length - 8} more` : ""}`;
}
