// One-off probe of /api/cross-tower-ai-plan/strategist on the running dev
// server. Logs in via /api/login first, then POSTs a minimal valid input
// and dumps the full response so we can see source/warnings/outputs.
//
// Run: node scripts/probeStrategist.mjs

const BASE = process.env.BASE_URL || "http://localhost:3001";

async function main() {
  const jar = new Map();

  function captureCookies(res) {
    const setCookie = res.headers.getSetCookie?.() ?? [];
    for (const sc of setCookie) {
      const [pair] = sc.split(";");
      const idx = pair.indexOf("=");
      if (idx > 0) jar.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
    }
  }
  function cookieHeader() {
    return Array.from(jar.entries()).map(([k, v]) => `${k}=${v}`).join("; ");
  }

  // 1. Log in. Route expects { username, password }.
  const loginRes = await fetch(`${BASE}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: process.env.AUTH_USERNAME || "Towerlead",
      password: process.env.AUTH_PASSWORD || "ACN2026",
    }),
  });
  captureCookies(loginRes);
  console.log("login:", loginRes.status, "cookies:", jar.size);
  if (!loginRes.ok) {
    const txt = await loginRes.text();
    console.error("login failed:", txt.slice(0, 200));
    process.exit(1);
  }

  // 2. Probe /api/cross-tower-ai-plan/strategist with the smallest valid
  //    body. The route requires `inputHash`, `input.baseScopeLabel`, and
  //    `input.towers[]` with at least one tower.
  const body = {
    inputHash: "probe::" + Date.now().toString(36),
    forceRegenerate: true,
    input: {
      baseScopeLabel: "All of Versant",
      towers: [
        {
          id: "finance",
          name: "Finance",
          inScopeHc: 250,
          jobFamilies: [
            {
              l2: "Record to Report",
              l3: "Financial Close & Consolidation",
              activities: [
                "Monthly close",
                "Intercompany eliminations",
                "Account reconciliations",
              ],
              aiTools: "BlackLine deployed for reconciliations",
              constraints: "New-public-company SEC obligations, 7+ Versant entities",
            },
          ],
        },
        {
          id: "editorial-news",
          name: "Editorial News",
          inScopeHc: 320,
          jobFamilies: [
            {
              l2: "Editorial Production",
              l3: "News Production & Publishing",
              activities: [
                "Story writing",
                "Fact-checking",
                "Headline & SEO optimization",
                "Cross-brand syndication",
              ],
              aiTools: "Descript for video editing; in-house GenAI copilot pilot at MS NOW",
              constraints: "Editorial standards; progressive positioning for MS NOW; brand safety",
            },
          ],
        },
        {
          id: "ad-sales",
          name: "Ad Sales",
          inScopeHc: 180,
          jobFamilies: [
            {
              l2: "Ad Operations",
              l3: "Programmatic & Yield Management",
              activities: [
                "Inventory forecasting",
                "Yield optimization",
                "Audience segment activation",
              ],
              aiTools: "LiveRamp identity graph; Piano analytics",
              constraints: "TSA expiration with NBCU — greenfield ad sales infra; BB- credit rating",
            },
          ],
        },
      ],
      inFlightInitiatives: [],
    },
  };

  const t0 = Date.now();
  const res = await fetch(`${BASE}/api/cross-tower-ai-plan/strategist`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: cookieHeader() },
    body: JSON.stringify(body),
  });
  const elapsed = Date.now() - t0;
  console.log(`strategist: HTTP ${res.status} (${elapsed}ms)`);
  const raw = await res.text();
  let json;
  try {
    json = JSON.parse(raw);
  } catch {
    console.log("non-JSON response:", raw.slice(0, 500));
    return;
  }
  console.log("source:", json.source);
  console.log("modelId:", json.modelId);
  console.log("promptVersion:", json.promptVersion);
  console.log("generatedAt:", json.generatedAt);
  console.log("warnings:", json.warnings);
  console.log(
    "outputs:",
    json.outputs == null
      ? "NULL (strategist returned no usable payload)"
      : `clusters=${json.outputs.clusters?.length ?? 0}, initiatives=${json.outputs.initiatives?.length ?? 0}, orchestration=${json.outputs.orchestration ? "present" : "absent"}`,
  );
}

main().catch((e) => {
  console.error("probe failed:", e);
  process.exit(1);
});
