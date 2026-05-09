/* eslint-disable no-console */
/**
 * Verify GET → PUT roundtrip on /api/assess across three scenarios:
 *   1. Identity PUT (no changes)            → HTTP 200
 *   2. Single-tower edit (finance baseline) → HTTP 200
 *   3. Multi-tower edit (finance + hr)      → HTTP 403
 *
 * Used to prove that my server-side normalization changes make non-admin
 * saves with no actual user changes succeed instead of tripping the 403
 * guard, while still blocking accidental cross-tower mutations.
 */

const BASE = "http://localhost:3000";

async function main() {
  const cookieJar = [];
  const setCookie = (res) => {
    const sc = res.headers.get("set-cookie");
    if (sc) {
      for (const part of sc.split(/,(?=[^;]+=)/g)) {
        const kv = part.split(";")[0].trim();
        if (kv && kv.includes("=")) cookieJar.push(kv);
      }
    }
  };
  const cookieHeader = () => cookieJar.join("; ");

  console.log("=== Step 1: Login as Towerlead ===");
  const loginRes = await fetch(`${BASE}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "Towerlead", password: "ACN2026" }),
  });
  setCookie(loginRes);
  console.log(`  HTTP ${loginRes.status}, ${await loginRes.text()}`);
  if (loginRes.status !== 200) process.exit(2);

  console.log("\n=== Step 2: GET /api/assess (baseline) ===");
  const getRes = await fetch(`${BASE}/api/assess`, {
    method: "GET",
    headers: { Cookie: cookieHeader() },
  });
  console.log(`  HTTP ${getRes.status}`);
  const getJson = JSON.parse(await getRes.text());
  if (!getJson.program) {
    console.log("  Program is null — DB is empty.");
    process.exit(2);
  }
  const baseline = getJson.program;
  console.log(`  version=${baseline.version}, towers=${Object.keys(baseline.towers).length}`);

  const put = async (label, mutator, expectStatus) => {
    const next = JSON.parse(JSON.stringify(baseline));
    if (mutator) mutator(next);
    const res = await fetch(`${BASE}/api/assess`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: cookieHeader() },
      body: JSON.stringify(next),
    });
    const body = await res.text();
    const ok = res.status === expectStatus;
    console.log(`  ${ok ? "PASS" : "FAIL"} HTTP ${res.status} (expected ${expectStatus})`);
    if (!ok) console.log(`    body: ${body}`);
    return ok;
  };

  console.log("\n=== Test 1: Identity PUT (no changes) → expect 200 ===");
  const t1 = await put("identity", null, 200);

  console.log("\n=== Test 2: Single-tower edit (finance baseline AI%) → expect 200 ===");
  const t2 = await put(
    "single-tower",
    (next) => {
      const cur = next.towers.finance.baseline.baselineAIPct ?? 15;
      next.towers.finance.baseline.baselineAIPct = (cur + 1) % 100;
    },
    200,
  );

  console.log("\n=== Test 3: Multi-tower edit (finance + hr) → expect 403 ===");
  const t3 = await put(
    "multi-tower",
    (next) => {
      next.towers.finance.baseline.baselineAIPct =
        ((next.towers.finance.baseline.baselineAIPct ?? 15) + 2) % 100;
      next.towers.hr.baseline.baselineAIPct =
        ((next.towers.hr.baseline.baselineAIPct ?? 15) + 2) % 100;
    },
    403,
  );

  const allPass = t1 && t2 && t3;
  console.log(allPass ? "\nALL PASS" : "\nFAILURES present");
  process.exit(allPass ? 0 : 1);
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(99);
});
