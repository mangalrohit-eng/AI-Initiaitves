// Lightweight auth helpers shared by middleware (Edge runtime) and route handlers.
// The session cookie stores a SHA-256 hash derived from the configured credentials
// plus a server-side secret. Middleware recomputes the expected hash per request
// and compares it in constant time. This avoids storing plaintext credentials in
// the cookie and avoids needing an external session store.

export const AUTH_COOKIE_NAME = "forge_session";
export const AUTH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 12; // 12 hours

const DEFAULT_USERNAME = "Towerlead";
const DEFAULT_PASSWORD = "ACN2026";
const DEFAULT_SECRET = "forge-tower-explorer-default-secret-change-me";

export function getExpectedCredentials(): { username: string; password: string; secret: string } {
  return {
    username: process.env.AUTH_USERNAME ?? DEFAULT_USERNAME,
    password: process.env.AUTH_PASSWORD ?? DEFAULT_PASSWORD,
    secret: process.env.AUTH_SECRET ?? DEFAULT_SECRET,
  };
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(buf);
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

export async function computeSessionToken(
  username: string,
  password: string,
  secret: string,
): Promise<string> {
  return sha256Hex(`${secret}::${username}::${password}`);
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function isValidSessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const { username, password, secret } = getExpectedCredentials();
  const expected = await computeSessionToken(username, password, secret);
  return constantTimeEquals(token, expected);
}

export async function verifyCredentials(
  username: string,
  password: string,
): Promise<{ ok: boolean; token?: string }> {
  const expected = getExpectedCredentials();
  const userOk = constantTimeEquals(username, expected.username);
  const passOk = constantTimeEquals(password, expected.password);
  if (!userOk || !passOk) return { ok: false };
  const token = await computeSessionToken(expected.username, expected.password, expected.secret);
  return { ok: true, token };
}
