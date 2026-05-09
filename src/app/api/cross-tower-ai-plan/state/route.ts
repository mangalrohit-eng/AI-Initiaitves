/**
 * GET / PUT /api/cross-tower-ai-plan/state
 *
 * Cross-Tower AI Plan v3 — persistence layer.
 *
 * Responsibilities:
 *   - GET: load the latest persisted plan document so the page hydrates
 *     without an LLM call. Returns `{ plan: null }` (not 404) for any
 *     not-found / unconfigured / unavailable / version-mismatch case so
 *     the client can render first-run UX without bespoke status handling.
 *   - PUT: validate + upsert the document the client built right after a
 *     successful Regenerate. Last write wins (no optimistic locking).
 *
 * Auth:
 *   - Same `forge_session` cookie as `/api/cross-tower-ai-plan/generate`.
 *   - NO admin gate, NO tower-scope check (unlike `/api/assess`'s
 *     `validateTowerScopedMutation`): the cross-tower plan is program-wide,
 *     and any workshop user authorised to click Regenerate is authorised
 *     to save the result.
 *
 * DB unconfigured / unavailable:
 *   - GET: returns `{ plan: null, db: "unconfigured" | "unavailable" }`
 *     and the client surfaces a one-line warning where appropriate.
 *   - PUT: returns 503 with `{ db: "unconfigured" }` (caller treats it as
 *     "saved-locally-only" and surfaces a soft warning, NOT an error).
 *
 * Logs metadata only — never the full payload.
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME, isValidSessionToken } from "@/lib/auth";
import {
  CROSS_TOWER_AI_PLAN_ID,
  getDb,
  isDatabaseUrlConfigured,
} from "@/lib/db";
import {
  validatePersistedPlan,
  type PersistedCrossTowerAiPlan,
} from "@/lib/cross-tower/persistedPlan";
import {
  validatePersistedPlanV2,
  type PersistedCrossTowerAiPlanV2,
} from "@/lib/cross-tower/persistedPlanV2";
import { IS_V6 } from "@/lib/schemaFlag";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 2 MB ceiling on the JSONB document — covers ~60 cohorts with full briefs. */
const MAX_BODY_BYTES = 2_000_000;

/**
 * Schema-aware validator. Under v6 the document MUST be the v2 shape
 * (`version: 2, schema: "v6"`); v1 docs from a previous v5 deployment are
 * rejected so the page falls through to the empty-state regenerate flow.
 * Under v5 the validator behaves exactly as before.
 */
type AnyPersistedPlan = PersistedCrossTowerAiPlan | PersistedCrossTowerAiPlanV2;
type ValidatedPlan =
  | { ok: true; plan: AnyPersistedPlan }
  | { ok: false; error: string };

function validateForActiveSchema(raw: unknown): ValidatedPlan {
  if (IS_V6) {
    const v2 = validatePersistedPlanV2(raw);
    if (v2.ok) return { ok: true, plan: v2.plan };
    return { ok: false, error: v2.error };
  }
  const v1 = validatePersistedPlan(raw);
  if (v1.ok) return { ok: true, plan: v1.plan };
  return { ok: false, error: v1.error };
}

type DbDisposition = "ok" | "unconfigured" | "unavailable";

// ---------------------------------------------------------------------------
//  GET — load the persisted plan
// ---------------------------------------------------------------------------

export async function GET() {
  if (!(await isWorkshopAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isDatabaseUrlConfigured() || getDb() === null) {
    return NextResponse.json<GetResponse>(
      { ok: true, plan: null, db: "unconfigured", updatedAt: null },
      { status: 200 },
    );
  }

  const sql = getDb()!;
  try {
    const rows = await sql<{ document: unknown; updated_at: string }[]>`
      SELECT document, updated_at
      FROM cross_tower_ai_plan
      WHERE id = ${CROSS_TOWER_AI_PLAN_ID}
    `;
    if (rows.length === 0) {
      return NextResponse.json<GetResponse>(
        { ok: true, plan: null, db: "ok", updatedAt: null },
        { status: 200 },
      );
    }
    const validated = validateForActiveSchema(rows[0].document);
    if (!validated.ok) {
      // Don't 500 — let the page render first-run UX with a quiet warning.
      // The most likely cause is a schema bump; no point blocking the user.
      logMetadata("get_invalid", { reason: validated.error });
      return NextResponse.json<GetResponse>(
        {
          ok: true,
          plan: null,
          db: "ok",
          updatedAt: rows[0].updated_at,
          loadWarning: `Saved plan rejected by validator: ${validated.error}`,
        },
        { status: 200 },
      );
    }
    return NextResponse.json<GetResponse>(
      {
        ok: true,
        plan: validated.plan,
        db: "ok",
        updatedAt: rows[0].updated_at,
      },
      { status: 200 },
    );
  } catch (e) {
    if (isDatabaseConnectionFailure(e)) {
      return NextResponse.json<GetResponse>(
        { ok: true, plan: null, db: "unavailable", updatedAt: null },
        { status: 200 },
      );
    }
    const msg = e instanceof Error ? e.message : "Database error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
//  PUT — upsert the persisted plan
// ---------------------------------------------------------------------------

export async function PUT(req: Request) {
  if (!(await isWorkshopAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isDatabaseUrlConfigured() || getDb() === null) {
    // The client treats 503 with `db: "unconfigured"` as a soft-warning state
    // (plan generated but not persisted). It does NOT surface this as an
    // error — generation already succeeded.
    return NextResponse.json(
      {
        error: "Database not configured (set DATABASE_URL or POSTGRES_URL).",
        db: "unconfigured" as const,
      },
      { status: 503 },
    );
  }

  // Read the raw body once so we can size-cap before parsing.
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) {
    return NextResponse.json(
      {
        error: `Persisted plan exceeds size cap (${text.length} > ${MAX_BODY_BYTES} bytes).`,
      },
      { status: 413 },
    );
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validated = validateForActiveSchema(body);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }
  const document: AnyPersistedPlan = validated.plan;

  const sql = getDb()!;
  try {
    // Round-trip through `JSON.parse(JSON.stringify(...))` to land a pure
    // JSON tree — postgres-js's `sql.json` is typed against its private
    // JSONValue and the validator returns branded TypeScript types.
    const payload = JSON.parse(JSON.stringify(document));
    await sql`
      INSERT INTO cross_tower_ai_plan (id, document, updated_at)
      VALUES (
        ${CROSS_TOWER_AI_PLAN_ID},
        ${sql.json(payload as unknown as Parameters<typeof sql.json>[0])},
        now()
      )
      ON CONFLICT (id) DO UPDATE
      SET document = EXCLUDED.document, updated_at = now()
    `;
    const updatedAt = new Date().toISOString();
    logMetadata("put_ok", {
      modelId: document.modelId,
      promptVersion: document.promptVersion,
      inputHash: document.inputHash,
      schema: "schema" in document ? document.schema : "v1",
      bytes: text.length,
    });
    return NextResponse.json(
      { ok: true, updatedAt, db: "ok" as const },
      { status: 200 },
    );
  } catch (e) {
    if (isDatabaseConnectionFailure(e)) {
      return NextResponse.json(
        {
          error: "Database unreachable; plan generated but not saved.",
          db: "unavailable" as const,
        },
        { status: 503 },
      );
    }
    const msg = e instanceof Error ? e.message : "Database error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------------

type GetResponse = {
  ok: true;
  plan: AnyPersistedPlan | null;
  db: DbDisposition;
  updatedAt: string | null;
  /** Optional one-liner the client surfaces when validator soft-rejected. */
  loadWarning?: string;
};

async function isWorkshopAuthed(): Promise<boolean> {
  const token = cookies().get(AUTH_COOKIE_NAME)?.value;
  return isValidSessionToken(token);
}

/**
 * Mirror of `[isDatabaseConnectionFailure](../../assess/route.ts)`. Kept inline
 * (not in `lib/db.ts`) so each route owns its own degradation policy without
 * coupling to a shared helper.
 */
function isDatabaseConnectionFailure(e: unknown): boolean {
  const parts: string[] = [];
  parts.push(String(e));
  if (e instanceof Error) {
    parts.push(
      e.message,
      e.name,
      "code" in e ? String((e as NodeJS.ErrnoException).code) : "",
    );
  }
  if (typeof AggregateError !== "undefined" && e instanceof AggregateError) {
    for (const err of e.errors) {
      if (err instanceof Error) parts.push(err.message, err.name);
    }
  }
  const s = parts.join(" ").toLowerCase();
  return (
    s.includes("connect_timeout") ||
    s.includes("econnrefused") ||
    s.includes("etimedout") ||
    s.includes("enotfound") ||
    s.includes("eai_again") ||
    s.includes("getaddrinfo") ||
    s.includes("connection terminated") ||
    s.includes("connection closed") ||
    s.includes("socket closed") ||
    s.includes("password authentication failed") ||
    s.includes("server closed the connection")
  );
}

function logMetadata(
  event: string,
  meta: Record<string, string | number | undefined>,
): void {
  if (process.env.NODE_ENV === "test") return;
  const fields = [`event=${event}`];
  for (const [k, v] of Object.entries(meta)) {
    if (v !== undefined) fields.push(`${k}=${v}`);
  }
  // eslint-disable-next-line no-console
  console.info(`[forge.crossTowerAiPlan.state] ${fields.join(" ")}`);
}
