/**
 * GET /api/ask/corpus
 *
 * Returns the static corpus digest (towers + briefs metadata) for the
 * Provenance drawer to resolve `tower:*` / `brief:*` citation IDs to
 * displayable detail without round-tripping back through the LLM.
 *
 * Same auth as `/api/ask`. Cached at the edge for 10 minutes — corpus
 * changes only on deploy.
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, isValidSessionToken } from "@/lib/auth";
import { getStaticCorpusDigest } from "@/lib/ask/buildStaticCorpusDigest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const token = cookies().get(AUTH_COOKIE_NAME)?.value;
  if (!(await isValidSessionToken(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(getStaticCorpusDigest(), {
    headers: { "Cache-Control": "private, max-age=600" },
  });
}
