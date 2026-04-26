import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, isValidSessionToken } from "@/lib/auth";

const PUBLIC_PATHS = new Set<string>(["/login"]);
const PUBLIC_API_PATHS = new Set<string>(["/api/login", "/api/logout"]);

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

  const block = clientPortalBlock(pathname, req);
  if (block) return block;

  if (PUBLIC_PATHS.has(pathname) || PUBLIC_API_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  const authed = await isValidSessionToken(token);

  if (!authed) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    const from = pathname + (search || "");
    if (from && from !== "/" && from !== "/login") {
      url.searchParams.set("from", from);
    }
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// Exclude Next.js internals and static assets from the middleware.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|woff|woff2|ttf|otf)).*)"],
};
