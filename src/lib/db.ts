import postgres from "postgres";

const DEFAULT_ID = "default" as const;

let sqlInstance: ReturnType<typeof postgres> | null = null;

/**
 * Resolves the Postgres connection string. Order matches common Neon + Vercel templates:
 * `DATABASE_URL` (pooled) first, then `POSTGRES_URL`, then `POSTGRES_PRISMA_URL`.
 */
export function getDatabaseUrl(): string | null {
  const a = process.env.DATABASE_URL?.trim();
  if (a) return a;
  const b = process.env.POSTGRES_URL?.trim();
  if (b) return b;
  const c = process.env.POSTGRES_PRISMA_URL?.trim();
  if (c) return c;
  return null;
}

/** Single shared client for serverless (low max connections). */
export function getDb(): ReturnType<typeof postgres> | null {
  const url = getDatabaseUrl();
  if (!url) return null;
  if (!sqlInstance) {
    sqlInstance = postgres(url, { max: 1, idle_timeout: 20, connect_timeout: 20 });
  }
  return sqlInstance;
}

export function isDatabaseUrlConfigured(): boolean {
  return getDatabaseUrl() != null;
}

export { DEFAULT_ID as ASSESS_WORKSHOP_ID };
