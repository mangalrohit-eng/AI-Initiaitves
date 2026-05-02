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
  if (program.version !== 5) {
    return NextResponse.json({ error: "version must be 5" }, { status: 400 });
  }

  const sql = getDb()!;
  const isAdmin = await isProgramAdminAuthed();
  if (!isAdmin) {
    const current = await readCurrentProgram(sql);
    if (!current) {
      return NextResponse.json(
        {
          error:
            "Program admin required to initialize or replace full workshop state. Use /login/admin and retry.",
        },
        { status: 403 },
      );
    }
    const scope = validateTowerScopedMutation(current, program);
    if (!scope.ok) {
      return NextResponse.json({ error: scope.error }, { status: 403 });
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
      error:
        "Only one tower can be updated per save for non-admin users (this includes per-tower cost rates). Split the change by tower and retry.",
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
    if (!jsonEqual(a, b)) out.push(id);
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
