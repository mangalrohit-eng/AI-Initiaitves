import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_AUTH_COOKIE_NAME,
  AUTH_COOKIE_NAME,
  isValidAdminSessionToken,
  isValidSessionToken,
} from "@/lib/auth";

const PUBLIC_PATHS = new Set<string>(["/login", "/login/admin"]);
const PUBLIC_API_PATHS = new Set<string>(["/api/login", "/api/login/admin", "/api/logout"]);

/** Match PUBLIC_PATHS / route logic even when the URL has a trailing slash. */
function normalizePathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname;
}

function clientPortalBlock(pathname: string, req: NextRequest): ReturnType<typeof NextResponse.redirect> | null {
  const mode = process.env.NEXT_PUBLIC_PORTAL_AUDIENCE?.toLowerCase().trim();
  if (mode !== "client") return null;
  const internalOnly = ["/changelog"];
  if (internalOnly.includes(pathname)) {
    const u = req.nextUrl.clone();
    u.pathname = "/";
    u.search = "";
    return NextResponse.redirect(u);
  }
  return null;
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const path = normalizePathname(pathname);

  const block = clientPortalBlock(path, req);
  if (block) return block;

  if (PUBLIC_PATHS.has(path) || PUBLIC_API_PATHS.has(path)) {
    return NextResponse.next();
  }

  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  const authed = await isValidSessionToken(token);

  if (!authed) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    const from = path + (search || "");
    if (from && from !== "/" && from !== "/login" && from !== "/login/admin") {
      url.searchParams.set("from", from);
    }
    return NextResponse.redirect(url);
  }

  if (path === "/program/lead-deadlines" || path === "/program/admin") {
    const adminTok = req.cookies.get(ADMIN_AUTH_COOKIE_NAME)?.value;
    const adminOk = await isValidAdminSessionToken(adminTok);
    if (!adminOk) {
      const url = req.nextUrl.clone();
      url.pathname = "/login/admin";
      url.search = "";
      url.searchParams.set("from", pathname + (search || ""));
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

// Exclude Next.js internals and static assets from the middleware.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|woff|woff2|ttf|otf)).*)"],
};
