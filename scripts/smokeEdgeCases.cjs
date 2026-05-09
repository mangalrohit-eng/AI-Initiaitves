/* eslint-disable no-console */
const BASE = "http://localhost:3000";

function pickCookies(setCookie) {
  if (!setCookie) return [];
  const out = [];
  for (const part of setCookie.split(/,(?=[^;]+=)/g)) {
    const kv = part.split(";")[0].trim();
    if (kv && kv.includes("=")) out.push(kv);
  }
  return out;
}

async function login() {
  const lr = await fetch(`${BASE}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "Towerlead", password: "ACN2026" }),
  });
  return pickCookies(lr.headers.get("set-cookie")).join("; ");
}

async function postJson(cookie, path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify(body),
  });
  let json = null;
  try {
    json = await r.json();
  } catch {
    json = null;
  }
  return { status: r.status, json };
}

async function main() {
  const cookie = await login();
  console.log("login OK");

  console.log("\n=== EDGE 1: Generate with empty initiatives array ===");
  const e1 = await postJson(cookie, "/api/cross-tower-ai-plan/generate", {
    schemaVersion: "v6",
    initiatives: [],
    assumptions: {
      planThresholdUsd: 0,
      rampMonths: 6,
      p1PhaseStartMonth: 1,
      p2PhaseStartMonth: 7,
      p3PhaseStartMonth: 13,
      p1BuildMonths: 6,
      p2BuildMonths: 9,
      p3BuildMonths: 12,
      attributionPctOfL5: 60,
      fillInOffsetMonths: 3,
    },
    inputHash: "edge-empty",
    assumptionsHash: "edge-empty-a",
  });
  console.log("HTTP:", e1.status);
  console.log(
    "warnings:",
    e1.json?.warnings?.length ?? "n/a",
    "synthesis exec sample:",
    typeof e1.json?.synthesis?.executiveSummary === "string"
      ? e1.json.synthesis.executiveSummary.slice(0, 100)
      : "(none)",
  );

  console.log("\n=== EDGE 2: Generate with malformed initiatives (missing required fields) ===");
  const e2 = await postJson(cookie, "/api/cross-tower-ai-plan/generate", {
    schemaVersion: "v6",
    initiatives: [
      { id: "x", name: "no tower" },
      { id: "y", towerName: "Finance" },
    ],
    assumptions: {
      planThresholdUsd: 0,
      rampMonths: 6,
      p1PhaseStartMonth: 1,
      p2PhaseStartMonth: 7,
      p3PhaseStartMonth: 13,
      p1BuildMonths: 6,
      p2BuildMonths: 9,
      p3BuildMonths: 12,
      attributionPctOfL5: 60,
      fillInOffsetMonths: 3,
    },
    inputHash: "edge-malformed",
    assumptionsHash: "edge-malformed-a",
  });
  console.log("HTTP:", e2.status);
  console.log("warnings:", e2.json?.warnings ?? e2.json);

  console.log("\n=== EDGE 3: Wrong schema version on generate ===");
  const e3 = await postJson(cookie, "/api/cross-tower-ai-plan/generate", {
    schemaVersion: "v99",
    initiatives: [],
    assumptions: {},
    inputHash: "x",
    assumptionsHash: "x",
  });
  console.log("HTTP:", e3.status, "body:", JSON.stringify(e3.json).slice(0, 200));

  console.log("\n=== EDGE 4: PUT state with malformed body ===");
  const e4 = await fetch(`${BASE}/api/cross-tower-ai-plan/state`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ plan: { version: 999, schema: "v6" } }),
  });
  console.log("HTTP:", e4.status, "body:", (await e4.text()).slice(0, 300));

  console.log("\n=== EDGE 5: GET state when no plan persisted (after DELETE) ===");
  const del = await fetch(`${BASE}/api/cross-tower-ai-plan/state`, {
    method: "DELETE",
    headers: { Cookie: cookie },
  });
  console.log("DELETE HTTP:", del.status);
  const get = await fetch(`${BASE}/api/cross-tower-ai-plan/state`, {
    headers: { Cookie: cookie },
  });
  const gj = await get.json();
  console.log("GET HTTP:", get.status);
  console.log("plan present:", !!gj.plan, "warnings:", gj.warnings?.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
