// Probes the PUT /api/assess endpoint on the live dev server.
//
// 1. Logs in as Towerlead.
// 2. GETs the current server snapshot.
// 3. PUTs it back UNCHANGED — this is the worst case for the diff
//    guard, because every spurious normalization difference would
//    light up as a "tower changed".
// 4. If PUT 200 → the diff is now stable. If PUT 403 → dumps the
//    diagnostic so we know which fields are still drifting.
// 5. Then PUTs back with a SINGLE tower's gccPct edited → must succeed.
//
// Run: node scripts/probeAssessPut.mjs

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

  // 1. Log in
  const loginRes = await fetch(`${BASE}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: process.env.AUTH_USERNAME || "Towerlead",
      password: process.env.AUTH_PASSWORD || "ACN2026",
    }),
  });
  captureCookies(loginRes);
  console.log("login:", loginRes.status);
  if (!loginRes.ok) {
    const txt = await loginRes.text();
    console.error("login failed:", txt.slice(0, 300));
    process.exit(1);
  }

  // 2. GET current server snapshot
  const getRes = await fetch(`${BASE}/api/assess`, {
    method: "GET",
    headers: { Cookie: cookieHeader() },
  });
  captureCookies(getRes);
  const getBody = await getRes.json();
  console.log("GET /api/assess:", getRes.status, "db:", getBody?.db);
  if (!getRes.ok || !getBody?.program) {
    console.log("Server has no program yet — skipping PUT tests");
    return;
  }
  const program = getBody.program;
  console.log(
    "  towers:",
    Object.keys(program.towers ?? {}).length,
    "version:",
    program.version,
  );

  // 3. PUT the snapshot back UNCHANGED. With the diff fix, this
  //    should be a no-op — 0 towers changed, 200 OK.
  console.log("\n=== Test 1: PUT round-trip (unchanged) ===");
  const r1 = await fetch(`${BASE}/api/assess`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader(),
    },
    body: JSON.stringify(program),
  });
  const r1Body = await r1.json();
  console.log("PUT 1:", r1.status);
  if (r1.status === 403) {
    console.log("  error:", r1Body.error);
    console.log("  diagnostic:", r1Body.diagnostic);
  } else if (r1.ok) {
    console.log("  ok — round-trip diff is clean");
  } else {
    console.log("  unexpected:", r1Body);
  }

  // 4. PUT with a single tower's gccPct edited on one row. Should
  //    succeed (1 tower changed).
  console.log("\n=== Test 2: PUT with single-tower gccPct edit ===");
  const editedProgram = JSON.parse(JSON.stringify(program));
  const firstTowerId = Object.keys(editedProgram.towers || {})[0];
  if (!firstTowerId) {
    console.log("No towers in server program — can't test edit");
    return;
  }
  const tower = editedProgram.towers[firstTowerId];
  if (!Array.isArray(tower.l4Rows) || tower.l4Rows.length === 0) {
    console.log(`Tower ${firstTowerId} has no l4Rows — can't test edit`);
    return;
  }
  // Edit the first L4 row's gccPct from whatever it is to a clearly-
  // different "user"-sourced value.
  const targetRow = tower.l4Rows[0];
  const prevPct = targetRow.gccPct;
  targetRow.gccPct = prevPct === 73 ? 47 : 73; // pick something distinct
  targetRow.gccPctSource = "user";
  targetRow.gccPctSetAt = new Date().toISOString();
  targetRow.gccReason = `Probe test edit @ ${new Date().toISOString()}`;
  console.log(
    `  editing ${firstTowerId} row[0] (${targetRow.l4 || "?"}) gccPct ${prevPct} → ${targetRow.gccPct}`,
  );

  const r2 = await fetch(`${BASE}/api/assess`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader(),
    },
    body: JSON.stringify(editedProgram),
  });
  const r2Body = await r2.json();
  console.log("PUT 2:", r2.status);
  if (r2.status === 403) {
    console.log("  error:", r2Body.error);
    console.log("  diagnostic:", r2Body.diagnostic);
  } else if (r2.ok) {
    console.log("  ok — single-tower gccPct edit accepted");
  } else {
    console.log("  unexpected:", r2Body);
  }

  // 5. PUT it back to original to leave server state unchanged for
  //    the user's actual session.
  console.log("\n=== Test 3: revert ===");
  targetRow.gccPct = prevPct;
  if (targetRow.gccPctSource !== "user") {
    targetRow.gccPctSource = "seed";
  }
  const r3 = await fetch(`${BASE}/api/assess`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader(),
    },
    body: JSON.stringify(editedProgram),
  });
  console.log("PUT 3 (revert):", r3.status);
}

main().catch((e) => {
  console.error("probe failed:", e);
  process.exit(1);
});
