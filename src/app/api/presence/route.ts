import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, isValidSessionToken } from "@/lib/auth";
import {
  countActiveToday,
  isPresenceConfigured,
  isValidSessionId,
  recordPresence,
} from "@/lib/presence/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isPresenceConfigured()) {
    return NextResponse.json({ ok: true, count: 0 }, { status: 200 });
  }
  try {
    const count = await countActiveToday();
    return NextResponse.json({ ok: true, count }, { status: 200 });
  } catch {
    return NextResponse.json({ ok: true, count: 0 }, { status: 200 });
  }
}

export async function POST(req: Request) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isPresenceConfigured()) {
    return NextResponse.json({ ok: true, count: 0 }, { status: 200 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const sessionId = (body as { sessionId?: unknown })?.sessionId;
  if (!isValidSessionId(sessionId)) {
    return NextResponse.json(
      { error: "Invalid sessionId — expected 8–64 chars, [a-zA-Z0-9_-]" },
      { status: 400 },
    );
  }

  try {
    await recordPresence(sessionId);
    const count = await countActiveToday();
    return NextResponse.json({ ok: true, count }, { status: 200 });
  } catch {
    return NextResponse.json({ ok: true, count: 0 }, { status: 200 });
  }
}

async function isAuthed(): Promise<boolean> {
  const token = cookies().get(AUTH_COOKIE_NAME)?.value;
  return isValidSessionToken(token);
}
