import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  ADMIN_AUTH_COOKIE_NAME,
  AUTH_COOKIE_NAME,
  isForgeAdminAuthConfigured,
  isValidAdminSessionToken,
  isValidSessionToken,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Returns whether caller has a valid workshop session and admin session cookie. */
export async function GET() {
  const workshopToken = cookies().get(AUTH_COOKIE_NAME)?.value;
  const workshopOk = await isValidSessionToken(workshopToken);
  if (!workshopOk) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const adminToken = cookies().get(ADMIN_AUTH_COOKIE_NAME)?.value;
  const isAdmin = await isValidAdminSessionToken(adminToken);
  return NextResponse.json(
    {
      ok: true,
      isAdmin,
      configured: isForgeAdminAuthConfigured(),
    },
    { status: 200 },
  );
}
