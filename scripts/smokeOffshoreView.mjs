/**
 * Ad-hoc HTTP smoke that authenticates as Tower Lead and verifies the
 * server-rendered `/offshore-view/tower/finance` HTML contains the
 * expected markers from the rewritten Step 2 capability map.
 *
 * Mirrors the auth flow in `scripts/httpSmoke.mjs`. Not wired into CI —
 * invoked manually after a `next start` to validate the new route
 * boots and renders the right chrome.
 *
 * Server-rendered Step 2 has no l3 rows in localStorage (SSR can't read
 * client storage), so the route emits the "No capability map yet" empty
 * state. The smoke asserts that empty-state branch plus chrome.
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
  const login = await fetch(`${base}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "Towerlead", password: "ACN2026" }),
  });
  if (!login.ok) {
    throw new Error(`Login failed ${login.status}: ${await login.text()}`);
  }
  const cookie = cookieHeaderFromLoginResponse(login);
  const page = await fetch(`${base}/offshore-view/tower/finance`, {
    headers: { cookie },
    redirect: "manual",
  });
  console.log("login.status=", login.status);
  console.log("offshore-view.status=", page.status);
  const html = await page.text();
  console.log("html.length=", html.length);

  // Diagnostic: locate the <main> body to see what SSR'd.
  const mainStart = html.indexOf("<main");
  if (mainStart !== -1) {
    const slice = html.slice(mainStart, mainStart + 4000);
    const text = slice.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    console.log("--- <main> first 1200 chars (stripped) ---");
    console.log(text.slice(0, 1200));
  } else {
    console.log("--- no <main> tag found ---");
  }

  // SSR for an assess-backed page emits a `Loading assessment…` Suspense
  // fallback (see AssessSyncProvider) because localStorage isn't
  // available server-side. The full Step 2 UI only mounts after
  // hydration. So at the SSR layer we validate the page chrome, the
  // breadcrumb that lists the canonical product, and the loading
  // placeholder — not the capability map itself.
  const markers = [
    "Loading assessment", // Suspense fallback inside AssessSyncProvider
    "Capability Map", // breadcrumb item / product name
    "Finance", // tower name
  ];
  let missing = 0;
  for (const m of markers) {
    const found = html.includes(m);
    console.log((found ? "  FOUND " : "   miss "), JSON.stringify(m));
    if (!found) missing += 1;
  }
  if (page.status !== 200) {
    console.error(`FAIL: expected 200, got ${page.status}`);
    process.exit(1);
  }
  if (missing > 0) {
    console.error(`FAIL: ${missing}/${markers.length} chrome markers missing.`);
    process.exit(1);
  }
  console.log("smokeOffshoreView: ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
