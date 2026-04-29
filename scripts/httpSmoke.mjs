/**
 * HTTP smoke against a running `next start` (default base http://127.0.0.1:3999).
 * Usage: BASE_URL=http://127.0.0.1:3999 node scripts/httpSmoke.mjs
 */
const base = (process.env.BASE_URL || "http://127.0.0.1:3999").replace(/\/$/, "");

function cookieHeaderFromLoginResponse(res) {
  const getSetCookie = res.headers.getSetCookie?.bind(res.headers);
  const lines = getSetCookie ? getSetCookie() : [];
  if (lines.length === 0) {
    const single = res.headers.get("set-cookie");
    if (single) return single.split(",").map((p) => p.trim().split(";")[0]).join("; ");
  }
  return lines.map((l) => l.split(";")[0]).join("; ");
}

async function main() {
  const unauth = await fetch(`${base}/program/tower-status`, { redirect: "manual" });
  if (unauth.status !== 307 && unauth.status !== 302) {
    throw new Error(`Expected redirect when unauthenticated, got ${unauth.status}`);
  }
  const loc = unauth.headers.get("location") || "";
  if (!loc.includes("/login")) {
    throw new Error(`Expected Location to /login, got ${loc}`);
  }

  const login = await fetch(`${base}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "Towerlead", password: "ACN2026" }),
  });
  if (!login.ok) {
    const t = await login.text();
    throw new Error(`Login failed ${login.status}: ${t.slice(0, 200)}`);
  }
  const cookie = cookieHeaderFromLoginResponse(login);
  if (!cookie.includes("forge_session=")) {
    throw new Error(`Missing forge_session cookie, got: ${cookie}`);
  }

  const page = await fetch(`${base}/program/tower-status`, {
    headers: { cookie },
    redirect: "manual",
  });
  if (page.status !== 200) {
    throw new Error(`tower-status expected 200, got ${page.status} loc=${page.headers.get("location")}`);
  }
  const html = await page.text();
  if (!html.includes("Tower step status")) {
    throw new Error("tower-status HTML missing title marker");
  }
  if (!html.includes("Accenture tower lead")) {
    throw new Error("tower-status HTML missing column marker");
  }

  const adminGate = await fetch(`${base}/program/lead-deadlines`, {
    headers: { cookie },
    redirect: "manual",
  });
  if (adminGate.status !== 307 && adminGate.status !== 302) {
    throw new Error(`lead-deadlines expected redirect without admin cookie, got ${adminGate.status}`);
  }
  const adminLoc = adminGate.headers.get("location") || "";
  if (!adminLoc.includes("/login/admin")) {
    throw new Error(`Expected redirect to /login/admin, got ${adminLoc}`);
  }

  console.log("httpSmoke: ok", base);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
