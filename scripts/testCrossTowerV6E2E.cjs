/* eslint-disable no-console */
/**
 * End-to-end smoke test for the V6 cross-tower AI plan flow.
 *
 *   1.  Log in as Towerlead.
 *   2.  GET /api/cross-tower-ai-plan/state — establish baseline (may be empty).
 *   3.  Pull the current AssessProgram so we can derive the v6 initiative
 *       roster the generate endpoint expects.
 *   4.  POST /api/cross-tower-ai-plan/generate with the v6 body shape.
 *   5.  PUT /api/cross-tower-ai-plan/state with the resulting v2 doc.
 *   6.  GET /api/cross-tower-ai-plan/state again — confirm round-trip.
 *   7.  Sanity-check page routes (200 OK, no auth redirect).
 *
 * Optional CLI args:
 *   --skip-llm   Skip the generate step (useful when OpenAI is rate-limited
 *                or you just want to check route health).
 */

const BASE = "http://localhost:3000";

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

const argv = process.argv.slice(2);
const args = new Set(argv);
const SKIP_LLM = args.has("--skip-llm");
const REPEAT_ARG = argv.find((a) => a.startsWith("--repeat="));
const REPEAT = REPEAT_ARG ? Math.max(1, parseInt(REPEAT_ARG.split("=")[1], 10)) : 1;
const STRICT = args.has("--strict") || REPEAT > 1;

const out = {
  login: null,
  state_get_initial: null,
  assess_get: null,
  initiative_count: 0,
  generate: null,
  generate_initiatives: 0,
  generate_warnings: 0,
  generate_synthesis_status: null,
  generate_validation_failed: false,
  generate_call_failed: false,
  state_put: null,
  state_get_roundtrip: null,
  hydrate_match: null,
  routes: {},
};

async function login() {
  const res = await fetch(`${BASE}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "Towerlead", password: "ACN2026" }),
  });
  setCookie(res);
  out.login = res.status;
  console.log(`[1] login → HTTP ${res.status}`);
  if (res.status !== 200) {
    console.error("    body:", await res.text());
    throw new Error("login failed");
  }
}

async function getState() {
  const res = await fetch(`${BASE}/api/cross-tower-ai-plan/state`, {
    method: "GET",
    headers: { Cookie: cookieHeader() },
  });
  out.state_get_initial = res.status;
  console.log(`[2] GET state → HTTP ${res.status}`);
  if (res.status !== 200) {
    console.error("    body:", await res.text());
    return null;
  }
  return res.json();
}

async function getAssess() {
  const res = await fetch(`${BASE}/api/assess`, {
    method: "GET",
    headers: { Cookie: cookieHeader() },
  });
  out.assess_get = res.status;
  console.log(`[3] GET assess → HTTP ${res.status}`);
  if (res.status !== 200) {
    console.error("    body:", await res.text());
    throw new Error("assess fetch failed");
  }
  const j = await res.json();
  if (!j.program) {
    throw new Error("Empty assess program — log in via UI once first.");
  }
  return j.program;
}

/**
 * Walk the AssessProgramV2 and build the v6 initiative roster the generate
 * endpoint expects (mirrors what the client-side `useCrossTowerPlanV6` hook
 * sends).
 */
function buildV6Initiatives(program) {
  // Mirror the wire shape `useCrossTowerPlanV6` POSTs. The sanitizer in
  // /api/cross-tower-ai-plan/generate requires { id, towerName,
  // l3FamilyName, solutionName, tagline, aiRationale, primaryVendor?,
  // feasibility:"High"|"Low", quadrant, programTier:"P1"|"P2"|"P3" }.
  const initiatives = [];
  const towerLookup = {};
  for (const [towerId, t] of Object.entries(program.towers ?? {})) {
    if (!t || !Array.isArray(t.l3Rows)) continue;
    let towerInitiativeCount = 0;
    const towerName = prettyTower(towerId);
    for (const row of t.l3Rows) {
      const list = Array.isArray(row.l3Initiatives) ? row.l3Initiatives : [];
      for (const it of list) {
        if (!it.solutionName || typeof it.solutionName !== "string") continue;
        // Coerce feasibility to the binary the prompt expects.
        const feasibility =
          it.feasibility === "Low" || it.feasibility === "High"
            ? it.feasibility
            : it.feasibility === "Medium"
              ? "High"
              : "High";
        // Spread quadrants the way the deterministic 2x2 would in production
        // (every fourth row Strategic Bet, every fourth Fill-in, etc.) so
        // the synthesis prompt only narrates the realistic QW + SB share.
        const buckets = ["Quick Win", "Strategic Bet", "Fill-in", "Deprioritize"];
        const tierBuckets = ["P1", "P1", "P2", "P3"];
        const idx = initiatives.length % 4;
        const quadrant = buckets[idx];
        const programTier = tierBuckets[idx];
        initiatives.push({
          id: it.id,
          towerId,
          towerName,
          l3RowId: row.id,
          l3FamilyName: row.l3 ?? "",
          solutionName: it.solutionName,
          tagline: it.tagline ?? "",
          aiRationale: it.aiRationale ?? "",
          primaryVendor: it.primaryVendor ?? undefined,
          feasibility,
          quadrant,
          programTier,
        });
        towerInitiativeCount += 1;
      }
    }
    if (towerInitiativeCount > 0) {
      towerLookup[towerId] = { id: towerId, name: towerName };
    }
  }
  const towers = Object.values(towerLookup);
  return { initiatives, towers };
}

function prettyTower(id) {
  if (id === "hr") return "Human Resources";
  return id
    .split("-")
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join(" ");
}

function prettyTowerToId(name) {
  if (name === "Human Resources") return "hr";
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

async function generate(initiatives, towers) {
  const body = {
    schema: "v6",
    initiatives,
    towers,
    assumptions: {
      programStartMonth: 1,
      rampMonths: 6,
      p1PhaseStartMonth: 1,
      p2PhaseStartMonth: 7,
      p3PhaseStartMonth: 13,
      p1BuildMonths: 6,
      p2BuildMonths: 6,
      p3BuildMonths: 6,
      planThresholdUsd: 0,
      promptDetailLevel: "concise",
    },
    inputHash: "smoke-test-input-hash",
    assumptionsHash: "smoke-test-assumptions-hash",
    intakeDigest: null,
  };
  console.log(
    `[4] POST generate (v6) — ${initiatives.length} initiatives across ${towers.length} towers`,
  );
  const res = await fetch(`${BASE}/api/cross-tower-ai-plan/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieHeader() },
    body: JSON.stringify(body),
  });
  out.generate = res.status;
  const text = await res.text();
  if (res.status !== 200) {
    console.error(`    HTTP ${res.status}: ${text.slice(0, 400)}`);
    return null;
  }
  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    console.error("    JSON parse error:", e);
    return null;
  }
  out.generate_warnings = (json.warnings ?? []).length;
  out.generate_initiatives = (json.narratives ?? []).length;
  out.generate_synthesis_status = json.synthesisStatus ?? null;
  const warningsArr = json.warnings ?? [];
  out.generate_validation_failed = warningsArr.some((w) =>
    typeof w === "string" && /Synthesis validation failed/i.test(w),
  );
  out.generate_call_failed = warningsArr.some((w) =>
    typeof w === "string" && /Synthesis call failed/i.test(w),
  );
  console.log(
    `    HTTP 200 — schema=${json.schema}, synthesisStatus=${json.synthesisStatus}, narratives=${out.generate_initiatives}, warnings=${out.generate_warnings}, model=${json.modelId ?? "?"}`,
  );
  if (warningsArr.length > 0) {
    console.log(`    warnings: ${JSON.stringify(warningsArr)}`);
  }
  // Hard sanity check on the LLM synthesis itself: the engine must have
  // returned a real LLM-authored synthesis, not the deterministic stub.
  // If the determinism guard rejects the output (or the OpenAI call fails),
  // we land in stub mode with a "Synthesis validation failed" / "Synthesis
  // call failed" warning. That MUST trip a smoke-test failure in strict
  // mode — otherwise the bug we just fixed could regress silently.
  if (json.synthesisStatus !== "ok") {
    console.error(`    ! synthesisStatus is "${json.synthesisStatus}" — fell back to deterministic stub.`);
  }
  if (out.generate_validation_failed) {
    console.error(`    ! synthesis validation failed — determinism guard rejected the LLM output.`);
  }
  if (out.generate_call_failed) {
    console.error(`    ! synthesis call failed — OpenAI request errored before validation.`);
  }
  return json;
}

async function putState(persistedDoc) {
  const res = await fetch(`${BASE}/api/cross-tower-ai-plan/state`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: cookieHeader() },
    body: JSON.stringify(persistedDoc),
  });
  out.state_put = res.status;
  const text = await res.text();
  console.log(`[5] PUT state → HTTP ${res.status}`);
  if (res.status !== 200) {
    console.error(`    ${text.slice(0, 400)}`);
    return false;
  }
  return true;
}

async function roundTripGet(expected) {
  const res = await fetch(`${BASE}/api/cross-tower-ai-plan/state`, {
    method: "GET",
    headers: { Cookie: cookieHeader() },
  });
  out.state_get_roundtrip = res.status;
  if (res.status !== 200) {
    console.log(`[6] GET state (roundtrip) → HTTP ${res.status}`);
    return false;
  }
  const j = await res.json();
  const got = j.plan;
  const matchVersion = got?.version === expected.version;
  const matchSchema = got?.schema === expected.schema;
  const matchSummary =
    got?.synthesis?.executiveSummary === expected.synthesis?.executiveSummary;
  const matchRefs =
    Array.isArray(got?.initiativeRefs) &&
    Array.isArray(expected.initiativeRefs) &&
    got.initiativeRefs.length === expected.initiativeRefs.length;
  out.hydrate_match = {
    version: matchVersion,
    schema: matchSchema,
    executive_summary: matchSummary,
    initiative_refs: matchRefs,
  };
  const allOk = matchVersion && matchSchema && matchSummary && matchRefs;
  console.log(
    `[6] GET state (roundtrip) → HTTP 200, hydration ${allOk ? "OK" : "MISMATCH"}`,
  );
  if (!allOk) {
    console.log("    expected:", {
      version: expected.version,
      schema: expected.schema,
      refs: expected.initiativeRefs?.length,
    });
    console.log("    got:", {
      version: got?.version,
      schema: got?.schema,
      refs: got?.initiativeRefs?.length,
    });
  }
  return allOk;
}

async function checkRoute(path) {
  const res = await fetch(`${BASE}${path}`, {
    method: "GET",
    headers: { Cookie: cookieHeader() },
    redirect: "manual",
  });
  out.routes[path] = res.status;
  const tag = res.status === 200 ? "OK" : `HTTP ${res.status}`;
  console.log(`[7] GET ${path} → ${tag}`);
}

async function main() {
  await login();
  await getState();
  const program = await getAssess();
  const { initiatives, towers } = buildV6Initiatives(program);
  out.initiative_count = initiatives.length;
  console.log(
    `    derived ${initiatives.length} L3 initiatives across ${towers.length} towers from AssessProgramV2`,
  );

  if (initiatives.length === 0) {
    console.log(
      "    no v6 initiatives present — visit the assess workshop and curate L3 initiatives first.",
    );
  }

  let persistedDoc = null;
  if (!SKIP_LLM && initiatives.length > 0) {
    const gen = await generate(initiatives, towers);
    if (gen && gen.synthesis) {
      persistedDoc = {
        version: 2,
        schema: "v6",
        modelId: gen.modelId ?? "gpt-5.5",
        promptVersion: gen.promptVersion ?? "v6.1.0",
        inputHash: "smoke-test-input-hash",
        assumptionsHash: "smoke-test-assumptions-hash",
        generatedAt: gen.generatedAt ?? new Date().toISOString(),
        initiativeRefs: initiatives.map((it) => ({
          id: it.id,
          towerId: it.towerId,
          l3RowId: it.l3RowId,
          solutionName: it.solutionName,
        })),
        synthesis: gen.synthesis,
        narratives: gen.narratives ?? [],
        warnings: gen.warnings ?? [],
        appliedAssumptions: {
          programStartMonth: 1,
          rampMonths: 6,
          p1PhaseStartMonth: 1,
          p2PhaseStartMonth: 7,
          p3PhaseStartMonth: 13,
          p1BuildMonths: 6,
          p2BuildMonths: 6,
          p3BuildMonths: 6,
          planThresholdUsd: 0,
          promptDetailLevel: "concise",
        },
      };
      const putOk = await putState(persistedDoc);
      if (putOk) await roundTripGet(persistedDoc);
    }
  } else if (SKIP_LLM) {
    console.log("[4-6] LLM steps skipped (--skip-llm)");
  }

  console.log("\n[7] route health checks");
  for (const p of [
    "/program/cross-tower-ai-plan",
    "/towers",
    "/tower/finance",
    "/summary",
    "/impact-levers",
    "/capability-map",
    "/program/admin",
  ]) {
    await checkRoute(p);
  }

  console.log("\n=== SUMMARY ===");
  console.log(JSON.stringify(out, null, 2));

  // Strict-mode pass criteria: the LLM synthesis MUST land "ok" with no
  // validation/call failures. Flake-checking via --repeat=N catches any
  // output that drifts close to the determinism-guard boundary.
  const passed =
    out.login === 200 &&
    out.assess_get === 200 &&
    out.generate === 200 &&
    out.state_put === 200 &&
    out.state_get_roundtrip === 200 &&
    out.generate_synthesis_status === "ok" &&
    !out.generate_validation_failed &&
    !out.generate_call_failed &&
    out.hydrate_match &&
    Object.values(out.hydrate_match).every(Boolean);

  return passed;
}

async function runAll() {
  let passed = 0;
  let failed = 0;
  const failures = [];
  for (let i = 0; i < REPEAT; i += 1) {
    if (REPEAT > 1) {
      console.log(`\n========== ITERATION ${i + 1} of ${REPEAT} ==========\n`);
    }
    cookieJar.length = 0;
    out.login = null;
    out.state_get_initial = null;
    out.assess_get = null;
    out.initiative_count = 0;
    out.generate = null;
    out.generate_initiatives = 0;
    out.generate_warnings = 0;
    out.generate_synthesis_status = null;
    out.generate_validation_failed = false;
    out.generate_call_failed = false;
    out.state_put = null;
    out.state_get_roundtrip = null;
    out.hydrate_match = null;
    out.routes = {};
    let ok = false;
    try {
      ok = await main();
    } catch (e) {
      console.error(`Iteration ${i + 1} threw:`, e);
      ok = false;
    }
    if (ok) passed += 1;
    else {
      failed += 1;
      failures.push({
        iteration: i + 1,
        synthesisStatus: out.generate_synthesis_status,
        validationFailed: out.generate_validation_failed,
        callFailed: out.generate_call_failed,
      });
    }
  }
  if (REPEAT > 1) {
    console.log(`\n========== AGGREGATE ==========`);
    console.log(`Iterations: ${REPEAT}, passed: ${passed}, failed: ${failed}`);
    if (failures.length > 0) {
      console.log("Failures:", JSON.stringify(failures, null, 2));
    }
  }
  return failed === 0;
}

runAll()
  .then((ok) => {
    if (STRICT && !ok) {
      console.error("\nSTRICT MODE: at least one iteration failed.");
      process.exit(1);
    }
    process.exit(0);
  })
  .catch((e) => {
    console.error("Fatal error:", e);
    console.log("\n=== PARTIAL SUMMARY ===");
    console.log(JSON.stringify(out, null, 2));
    process.exit(1);
  });
