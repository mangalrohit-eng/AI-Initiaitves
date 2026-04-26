import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { AssessProgramV2 } from "@/data/assess/types";
import { importAssessProgramFromJsonText } from "@/lib/assess/assessProgramIO";
import { AUTH_COOKIE_NAME, isValidSessionToken } from "@/lib/auth";
import { ASSESS_WORKSHOP_ID, getDb, isDatabaseUrlConfigured } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET — load persisted assess program, or { program: null, db: unconfigured } if no DB URL env is set.
 * PUT — validate body as AssessProgramV2 and upsert one row in Postgres.
 */
export async function GET() {
  if (!(await isAuthed())) {
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
    const msg = e instanceof Error ? e.message : "Database error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  if (!(await isAuthed())) {
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
  if (program.version !== 4) {
    return NextResponse.json({ error: "version must be 4" }, { status: 400 });
  }

  const sql = getDb()!;
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

async function isAuthed(): Promise<boolean> {
  const token = cookies().get(AUTH_COOKIE_NAME)?.value;
  return isValidSessionToken(token);
}
