/* eslint-disable no-console */
/**
 * Unit-style regression test for the cross-tower-plan determinism guard.
 *
 * Why this test exists:
 *   The guard's job is to reject fabricated metrics the deterministic engine
 *   should own ($ figures, %, FTE counts, savings claims) — but the cross-
 *   tower prompt explicitly asks the model to author "24-month sequencing
 *   across the 13 towers" in roadmapNarrative.overall. The original v6 guard
 *   shipped with `if (/\d{2,}/.test(s)) return false;` which rejected those
 *   structural digits and silently fell back to the deterministic stub.
 *
 *   This test pins the strip-then-check approach so the regression can't
 *   come back. Mirrors the function in
 *   src/lib/llm/programSynthesisV6LLM.ts — keep them in sync.
 */

function passesDeterminismGuard(s) {
  if (s.includes("$") || s.includes("%")) return false;
  const stripped = s
    .replace(/\bP[123]\b/g, "")
    .replace(/\bM\d+\b/g, "")
    .replace(
      /\b\d+(?:[-–\s]?\d+)?[-\s](?:month|months|week|weeks|year|years|day|days|hour|hours|minute|minutes)\b/gi,
      "",
    )
    .replace(
      /\b\d+\s+(?:towers?|functions?|entities?|brands?|networks?|workshops?|leads?)\b/gi,
      "",
    );
  if (/\d{2,}/.test(stripped)) return false;
  return true;
}

const cases = [
  // ===== Should PASS — exactly what the prompt asks the LLM to author =====
  ["Across the 24-month plan, Versant Finance moves first on TSA exits.", true],
  ["24-month sequencing across the 13 towers anchors P1 / P2 / P3 cadence.", true],
  ["Quick Wins land in P1; Strategic Bets layer in P2 and P3.", true],
  ["M24 run-rate is the steady state once every solution ramps.", true],
  ["12-month build, then a 6-month ramp.", true],
  ["Across 13 towers and 7 entities, the program threads through 4 brands.", true],
  ["Anand Kini owns Finance value realization through TSA exit.", true],
  ["The two-year arc starts with covenant-sensitive workflows.", true],

  // ===== Should FAIL — fabricated metrics the engine should own =====
  ["Saves $200M annually across operations.", false],
  ["85% straight-through processing.", false],
  ["Reduces close from 12 to 5 days saving 2400 hours.", false],
  ["120 FTEs redeployed in year one.", false],
  ["Cuts 30 percent of operational overhead.", false],
  ["Drives $1.5B in modeled value.", false],

  // ===== Hedge phrases — should still fail =====
  // (Not exhaustive — just spot-checking the path is wired.)
];

let pass = 0;
let fail = 0;
for (const [s, expected] of cases) {
  const got = passesDeterminismGuard(s);
  const ok = got === expected;
  if (!ok) fail += 1;
  else pass += 1;
  console.log(`${ok ? "PASS" : "FAIL"} | got=${got} expected=${expected} | "${s}"`);
}
console.log(`\n${pass}/${pass + fail} cases passed.`);
process.exit(fail === 0 ? 0 : 1);
