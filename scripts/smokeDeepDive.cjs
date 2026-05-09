/* eslint-disable no-console */
// Smoke-test the v6 initiative deep-dive route + the cross-tower SSR DOM.
const BASE = "http://localhost:3000";

function pickCookies(setCookie) {
  if (!setCookie) return [];
  const cookies = [];
  for (const part of setCookie.split(/,(?=[^;]+=)/g)) {
    const kv = part.split(";")[0].trim();
    if (kv && kv.includes("=")) cookies.push(kv);
  }
  return cookies;
}

async function main() {
  const lr = await fetch(`${BASE}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "Towerlead", password: "ACN2026" }),
  });
  const cookie = pickCookies(lr.headers.get("set-cookie")).join("; ");
  console.log("login:", lr.status);

  const sr = await fetch(`${BASE}/api/cross-tower-ai-plan/state`, {
    headers: { Cookie: cookie },
  });
  const sj = await sr.json();
  if (!sj.plan) {
    console.log("No plan persisted — aborting");
    return;
  }

  const refs = sj.plan.initiativeRefs;
  // Pick three: first, middle, last — to spot-check several deep-dive routes.
  const sampleRefs = [
    refs[0],
    refs[Math.floor(refs.length / 2)],
    refs[refs.length - 1],
  ].filter(Boolean);
  for (const liveRef of sampleRefs) {
    console.log("\n--- Deep-dive ref ---");
    console.log({
      id: liveRef.id,
      towerId: liveRef.towerId,
      l3RowId: liveRef.l3RowId,
      solutionName: liveRef.solutionName,
    });
    const url = `${BASE}/tower/${liveRef.towerId}/initiative/${encodeURIComponent(liveRef.l3RowId)}/${encodeURIComponent(liveRef.id)}`;
    const dr = await fetch(url, { headers: { Cookie: cookie } });
    const dhtml = await dr.text();
    console.log("  HTTP:", dr.status, "bytes:", dhtml.length);
    console.log(
      "  contains solutionName:",
      liveRef.solutionName ? dhtml.includes(liveRef.solutionName) : "(no name in ref)",
    );
    // Strip the JSON __NEXT_DATA__ blob since `undefined` legitimately appears
    // there as a JSON string inside escaped strings; only check user-visible HTML.
    const visibleHtml = dhtml
      .replace(/<script id="__NEXT_DATA__"[\s\S]*?<\/script>/g, "")
      .replace(/<script[^>]*?>[\s\S]*?<\/script>/g, "");
    const undefMatches = visibleHtml.match(/>undefined</g) || [];
    console.log("  '>undefined<' tag-content occurrences:", undefMatches.length);
    const errorBoundary = /Application error|Internal Server Error|something went wrong/i.test(
      visibleHtml,
    );
    console.log("  error boundary text present:", errorBoundary);
    const hasLoadingShell = /Loading tower data/i.test(visibleHtml);
    console.log("  SSR loading shell (expected for client-only page):", hasLoadingShell);
  }

  console.log("\n--- Cross-tower page render ---");
  const cr = await fetch(`${BASE}/program/cross-tower-ai-plan`, {
    headers: { Cookie: cookie },
  });
  const chtml = await cr.text();
  console.log("cross-tower HTTP:", cr.status, "bytes:", chtml.length);
  const checks = [
    "AI Solutions",
    "AI Projects in plan",
    "Quick Win",
    "Strategic Bet",
    "Executive summary",
    "Lineage",
  ];
  for (const k of checks) {
    console.log(`  contains "${k}":`, chtml.includes(k));
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
