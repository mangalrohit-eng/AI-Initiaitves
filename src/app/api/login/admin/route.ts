import { NextResponse } from "next/server";
import {
  ADMIN_AUTH_COOKIE_NAME,
  AUTH_COOKIE_MAX_AGE_SECONDS,
  isForgeAdminAuthConfigured,
  verifyAdminCredentials,
} from "@/lib/auth";

export const runtime = "edge";

export async function POST(req: Request) {
  if (!isForgeAdminAuthConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Program admin login is not configured on this deployment." },
      { status: 503 },
    );
  }

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

  const result = await verifyAdminCredentials(username, password);
  if (!result.ok || !result.token) {
    await new Promise((r) => setTimeout(r, 350));
    return NextResponse.json(
      { ok: false, error: "Incorrect admin username or password" },
      { status: 401 },
    );
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: ADMIN_AUTH_COOKIE_NAME,
    value: result.token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_COOKIE_MAX_AGE_SECONDS,
  });
  return res;
}
