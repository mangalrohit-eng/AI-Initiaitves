import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { towers } from "@/data/towers";
import { deriveActivity } from "@/lib/activity/deriveActivity";
import { importAssessProgramFromJsonText } from "@/lib/assess/assessProgramIO";
import { AUTH_COOKIE_NAME, isValidSessionToken } from "@/lib/auth";
import { ASSESS_WORKSHOP_ID, getDb, isDatabaseUrlConfigured } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Tiny in-route memo so a busy home page doesn't hammer Postgres on every
// 60-second poll across multiple open tabs in the same region. The events
// list is derived from data that only changes on deliberate "Confirm" clicks,
// so a 5s TTL is invisible to users.
const MEMO_TTL_MS = 5_000;
let memo: { at: number; payload: unknown } | null = null;

export async function GET() {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isDatabaseUrlConfigured() || getDb() === null) {
    return NextResponse.json({ ok: true, events: [] }, { status: 200 });
  }

  const now = Date.now();
  if (memo && now - memo.at < MEMO_TTL_MS) {
    return NextResponse.json(memo.payload, { status: 200 });
  }

  const sql = getDb()!;
  try {
    const rows = await sql<{ program: unknown }[]>`
      SELECT program FROM assess_workshop WHERE id = ${ASSESS_WORKSHOP_ID}
    `;
    if (!rows.length) {
      const payload = { ok: true as const, events: [] };
      memo = { at: now, payload };
      return NextResponse.json(payload, { status: 200 });
    }
    const parsed = importAssessProgramFromJsonText(JSON.stringify(rows[0].program));
    if (!parsed.ok) {
      // Don't 500 the home page over a malformed legacy program; the rail
      // just hides itself on empty events.
      return NextResponse.json({ ok: true, events: [] }, { status: 200 });
    }
    const events = deriveActivity(parsed.program, towers);
    const payload = { ok: true as const, events };
    memo = { at: now, payload };
    return NextResponse.json(payload, { status: 200 });
  } catch {
    return NextResponse.json({ ok: true, events: [] }, { status: 200 });
  }
}

async function isAuthed(): Promise<boolean> {
  const token = cookies().get(AUTH_COOKIE_NAME)?.value;
  return isValidSessionToken(token);
}
