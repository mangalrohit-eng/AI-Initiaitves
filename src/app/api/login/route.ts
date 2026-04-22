import { NextResponse } from "next/server";
import {
  AUTH_COOKIE_MAX_AGE_SECONDS,
  AUTH_COOKIE_NAME,
  verifyCredentials,
} from "@/lib/auth";

export const runtime = "edge";

export async function POST(req: Request) {
  let username = "";
  let password = "";

  try {
    const body = (await req.json()) as { username?: unknown; password?: unknown };
    if (typeof body.username === "string") username = body.username;
    if (typeof body.password === "string") password = body.password;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  if (!username || !password) {
    return NextResponse.json({ ok: false, error: "Missing credentials" }, { status: 400 });
  }

  const result = await verifyCredentials(username, password);
  if (!result.ok || !result.token) {
    // Small artificial delay to discourage brute-force timing attacks.
    await new Promise((r) => setTimeout(r, 350));
    return NextResponse.json(
      { ok: false, error: "Incorrect username or password" },
      { status: 401 },
    );
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: result.token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_COOKIE_MAX_AGE_SECONDS,
  });
  return res;
}
