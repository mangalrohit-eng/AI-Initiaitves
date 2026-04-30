import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { buildSeededAssessProgramV2 } from "@/data/assess/seedAssessProgram";
import {
  ADMIN_AUTH_COOKIE_NAME,
  AUTH_COOKIE_NAME,
  isValidAdminSessionToken,
  isValidSessionToken,
} from "@/lib/auth";
import { ASSESS_WORKSHOP_ID, getDb, isDatabaseUrlConfigured } from "@/lib/db";
import { getPortalAudience, isInternalSurfaceAllowed } from "@/lib/portalAudience";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST — rebuild the workshop starter program from the latest code-side seed
 * (`buildSeededAssessProgramV2`) and upsert into `assess_workshop`.
 *
 * Use this after editing the L1–L4 capability maps, the L4 default heuristic, or the
 * tower headcounts. Server-only so the result is reproducible regardless of who clicks.
 *
 * Auth: requires the same Forge session cookie as GET/PUT, plus an "internal" portal
 * audience (so client-only deployments can't wipe the database).
 */
export async function POST() {
  if (!(await isWorkshopAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await isProgramAdminAuthed())) {
    return NextResponse.json(
      { error: "Program admin login required. Sign in at /login/admin and retry." },
      { status: 403 },
    );
  }
  if (!isInternalSurfaceAllowed(getPortalAudience())) {
    return NextResponse.json(
      { error: "Re-seed is internal-only on this deployment" },
      { status: 403 },
    );
  }
  if (!isDatabaseUrlConfigured() || getDb() === null) {
    return NextResponse.json(
      { error: "Database not configured (set DATABASE_URL or POSTGRES_URL)." },
      { status: 503 },
    );
  }

  const sql = getDb()!;
  try {
    const program = buildSeededAssessProgramV2();
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
    const towerCount = Object.keys(program.towers).length;
    return NextResponse.json(
      { ok: true, towers: towerCount, updatedAt: new Date().toISOString() },
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
