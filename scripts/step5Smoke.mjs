/**
 * HTTP smoke for Step 5 — the Cross-Tower AI Plan page.
 *
 * Run against a `next start` (default base http://127.0.0.1:3999):
 *   BASE_URL=http://127.0.0.1:3999 node scripts/step5Smoke.mjs
 *
 * Validates the consolidated 5-tab structure shipped by the Phase 1
 * simplification: present tab labels, retired vocabulary, and the new
 * sub-section anchors inside the Plan tab body.
 */
const base = (process.env.BASE_URL || "http://127.0.0.1:3999").replace(/\/$/, "");

function cookieHeaderFromLoginResponse(res) {
  const getSetCookie = res.headers.getSetCookie?.bind(res.headers);
  const lines = getSetCookie ? getSetCookie() : [];
  if (lines.length === 0) {
    const single = res.headers.get("set-cookie");
    if (single)
      return single
        .split(",")
        .map((p) => p.trim().split(";")[0])
        .join("; ");
  }
  return lines.map((l) => l.split(";")[0]).join("; ");
}

function assert(cond, msg) {
  if (!cond) throw new Error(`assert: ${msg}`);
}

function assertPresent(html, needle, label) {
  if (!html.includes(needle)) {
    throw new Error(`missing expected marker (${label}): ${JSON.stringify(needle)}`);
  }
}

function assertAbsent(html, needle, label) {
  if (html.includes(needle)) {
    throw new Error(
      `unexpected marker present (${label}): ${JSON.stringify(needle)}`,
    );
  }
}

async function main() {
  // ---- 1. Unauthenticated request bounces to /login --------------------
  const unauth = await fetch(`${base}/program/cross-tower-ai-plan`, {
    redirect: "manual",
  });
  assert(
    unauth.status === 307 || unauth.status === 302,
    `expected redirect when unauthenticated, got ${unauth.status}`,
  );
  const loc = unauth.headers.get("location") || "";
  assert(loc.includes("/login"), `expected /login redirect, got ${loc}`);

  // ---- 2. Log in and fetch the page ------------------------------------
  const login = await fetch(`${base}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "Towerlead", password: "ACN2026" }),
  });
  assert(login.ok, `login failed: ${login.status}`);
  const cookie = cookieHeaderFromLoginResponse(login);
  assert(
    cookie.includes("forge_session="),
    `missing forge_session cookie, got: ${cookie}`,
  );

  const page = await fetch(`${base}/program/cross-tower-ai-plan`, {
    headers: { cookie },
    redirect: "manual",
  });
  assert(page.status === 200, `cross-tower-ai-plan expected 200, got ${page.status}`);
  const html = await page.text();

  // ---- 3. Page-level markers --------------------------------------------
  assertPresent(html, "24-month agentic AI plan", "page title");
  assertPresent(html, "Cross-Tower AI Plan", "breadcrumb");

  // ---- 4. New 5-tab structure ------------------------------------------
  // TabGroup renders `<button role="tab" ...>{label}</button>`. Extract
  // the label set by matching that signature and compare against the
  // expected five tabs.
  const tabButtonRe =
    /<button[^>]*role="tab"[^>]*>([\s\S]*?)<\/button>/g;
  const tabLabels = [];
  let m;
  while ((m = tabButtonRe.exec(html)) !== null) {
    tabLabels.push(m[1].replace(/<[^>]+>/g, "").trim());
  }
  assert(
    tabLabels.length === 5,
    `expected 5 tab buttons, got ${tabLabels.length}: ${JSON.stringify(tabLabels)}`,
  );
  const tabSet = new Set(tabLabels);
  const required = [
    "Approach",
    "Cross-tower outcomes",
    "Assumptions",
    "Risks",
  ];
  for (const r of required) {
    assert(tabSet.has(r), `missing tab "${r}" in ${JSON.stringify(tabLabels)}`);
  }
  // Plan label is dynamic ("Plan" or "Plan (n)"), so check by prefix.
  assert(
    tabLabels.some((l) => l === "Plan" || l.startsWith("Plan (")),
    `missing Plan tab in ${JSON.stringify(tabLabels)}`,
  );

  // ---- 5. Retired tabs must not appear as standalone tab buttons --------
  const retired = [
    "Outcome Clusters",
    "Orchestration & Data Layer",
    "Overview",
    "Value × Effort",
    "Architecture",
  ];
  for (const r of retired) {
    assert(
      !tabSet.has(r),
      `retired tab "${r}" still rendered: ${JSON.stringify(tabLabels)}`,
    );
  }
  // Roadmap could also legitimately appear in body copy; only assert it
  // isn't a tab button.
  assert(
    !tabSet.has("Roadmap"),
    `retired tab "Roadmap" still rendered: ${JSON.stringify(tabLabels)}`,
  );

  // ---- 6. Vocabulary lock — retired strings in visible copy ------------
  // These shouldn't appear anywhere in the initial HTML payload.
  assertAbsent(html, "L3 AI Initiatives", "retired 'L3 AI Initiatives' phrase");
  assertAbsent(html, "L4 Activity Group prize", "retired 'L4 Activity Group prize' phrase");

  // ---- 7. Approach tab default content ---------------------------------
  // Two-track rail eyebrows.
  assertPresent(html, "Track A", "Approach Track A eyebrow");
  assertPresent(html, "Track B", "Approach Track B eyebrow");
  assertPresent(html, "Tracks converge", "convergence divider");

  // ---- 8. Header chrome assertions -------------------------------------
  // BaseScope caption updated to point at the consolidated tab.
  assertPresent(
    html,
    "Base scope drives the Cross-tower outcomes tab.",
    "BaseScope caption updated",
  );
  // Verbose old caption strings are gone.
  assertAbsent(html, "per-cohort fan-out", "verbose regenerate caption");
  assertAbsent(html, "0-token", "verbose regenerate caption");

  // ---- 9. Plan tab count matches the KPI strip --------------------------
  // The KPI strip renders the live-project metric inside a node whose
  // first text fragment is the number, followed by "AI Solutions in
  // plan". Extract that and confirm it matches the Plan tab label.
  const kpiMatch = html.match(/>(\d+)<\/[^>]+>\s*<[^>]*>AI Solutions in plan/);
  if (kpiMatch) {
    const live = kpiMatch[1];
    const expectedPlanLabel = live === "0" ? "Plan" : `Plan (${live})`;
    assert(
      tabSet.has(expectedPlanLabel),
      `Plan tab label "${expectedPlanLabel}" not in tabs ${JSON.stringify(tabLabels)} (KPI strip reported ${live} live projects)`,
    );
  }

  // ---- 10. Cross-tower outcome detail routes return 200 ----------------
  // Pre-strategist-run the cluster/initiative ids don't exist; the
  // route still renders a 200 with the "not found" or "no strategist
  // run yet" fallback. The smoke just confirms the route compiles
  // and ships HTML for an authenticated user.
  const clusterRoute = await fetch(
    `${base}/program/cross-tower-ai-plan/outcome/smoke-cluster-id`,
    { headers: { cookie }, redirect: "manual" },
  );
  assert(
    clusterRoute.status === 200,
    `outcome/[clusterId] expected 200, got ${clusterRoute.status}`,
  );
  const clusterHtml = await clusterRoute.text();
  assertPresent(clusterHtml, "Cross-Tower AI Plan", "cluster route breadcrumb");

  const initiativeRoute = await fetch(
    `${base}/program/cross-tower-ai-plan/outcome/smoke-cluster-id/initiative/smoke-initiative-id`,
    { headers: { cookie }, redirect: "manual" },
  );
  assert(
    initiativeRoute.status === 200,
    `outcome/[clusterId]/initiative/[initiativeId] expected 200, got ${initiativeRoute.status}`,
  );
  const initiativeHtml = await initiativeRoute.text();
  assertPresent(
    initiativeHtml,
    "Cross-Tower AI Plan",
    "initiative route breadcrumb",
  );

  console.log("step5Smoke: ok", base);
  console.log("  - 5-tab structure present");
  console.log("  - retired tabs absent");
  console.log("  - vocabulary lock holding");
  console.log("  - two-track Approach rail rendered");
  console.log("  - header captions trimmed");
  console.log("  - plan tab count matches KPI strip");
  console.log("  - cluster + initiative detail routes 200");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
