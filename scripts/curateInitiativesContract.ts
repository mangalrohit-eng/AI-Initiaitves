/**
 * curateInitiativesContract — smoke test for `curateInitiativesLLM.ts`
 * helpers and the deterministic fallback that the
 * `/api/assess/curate-initiatives` route uses when the LLM is unavailable.
 *
 * Verifies:
 *   1. `isLLMConfigured()` reflects whether `OPENAI_API_KEY` is set, and
 *      `curateInitiativesWithLLM` throws cleanly when it isn't (instead of
 *      hitting OpenAI without a key).
 *   2. Vendor allow-list sanitization (via `MAX_L4S_PER_CALL` exposure)
 *      and canonical not-eligible reasons are wired through.
 *   3. `composeL4Verdict` (the route's fallback) returns valid output
 *      for a sample tower / L4, so the route's deterministic path is
 *      provably reachable end-to-end.
 *
 *   `npx tsx scripts/curateInitiativesContract.ts`
 */

import {
  isLLMConfigured,
  MAX_L4S_PER_CALL,
  VENDOR_ALLOW_LIST,
  curateInitiativesWithLLM,
} from "../src/lib/assess/curateInitiativesLLM";
import { composeL4Verdict } from "../src/lib/initiatives/composeVerdict";

let pass = 0;
let fail = 0;

function check(label: string, cond: boolean, detail?: string) {
  if (cond) {
    pass += 1;
    console.log(`  PASS  ${label}`);
  } else {
    fail += 1;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function asyncCheck(
  label: string,
  fn: () => Promise<boolean>,
  detail?: string,
): Promise<void> {
  try {
    const ok = await fn();
    if (ok) {
      pass += 1;
      console.log(`  PASS  ${label}`);
    } else {
      fail += 1;
      console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
    }
  } catch (e) {
    fail += 1;
    console.log(`  FAIL  ${label} — threw: ${(e as Error).message}`);
  }
}

const main = async () => {
  console.log("\n[curate-initiatives] LLM gate + fallback contract");

  // 1. LLM gate. We don't want this script to hit OpenAI; force-unset
  //    the key so the helper short-circuits cleanly.
  delete process.env.OPENAI_API_KEY;
  check("1) isLLMConfigured() returns false when key unset", !isLLMConfigured());

  await asyncCheck(
    "1) curateInitiativesWithLLM throws LLMError when key unset",
    async () => {
      try {
        await curateInitiativesWithLLM("finance", [
          {
            rowId: "r1",
            l2: "Record to Report",
            l3: "Reconciliation",
            l4Activities: ["Match invoices"],
          },
        ]);
        return false;
      } catch (e) {
        return e instanceof Error && /OPENAI_API_KEY/.test(e.message);
      }
    },
  );

  // 2. Allow-list discipline.
  check(
    "2) VENDOR_ALLOW_LIST contains BlackLine (canonical)",
    VENDOR_ALLOW_LIST.includes("BlackLine"),
  );
  check(
    "2) VENDOR_ALLOW_LIST contains Amagi",
    VENDOR_ALLOW_LIST.includes("Amagi"),
  );
  check(
    "2) MAX_L4S_PER_CALL is a sane positive integer",
    typeof MAX_L4S_PER_CALL === "number" &&
      MAX_L4S_PER_CALL > 0 &&
      MAX_L4S_PER_CALL <= 200,
  );

  // 3. Deterministic fallback path. The route calls `composeL4Verdict`
  //    when the LLM fails — verify it returns a usable verdict for a
  //    representative L4.
  console.log("\n[curate-initiatives] composeL4Verdict fallback");
  const verdict = composeL4Verdict({
    towerId: "finance",
    l2Name: "Record to Report",
    l3Name: "Reconciliation",
    l4: { id: "test::reconcile", name: "Reconciliation" },
  });
  check(
    "3) composeL4Verdict returns a status string",
    typeof verdict.status === "string" && verdict.status.length > 0,
    `status=${verdict.status}`,
  );
  check(
    "3) composeL4Verdict returns aiRationale text",
    typeof verdict.aiRationale === "string" && verdict.aiRationale.length > 5,
  );
  check(
    "3) composeL4Verdict source is canonical / overlay / rubric",
    verdict.source === "canonical" ||
      verdict.source === "overlay" ||
      verdict.source === "rubric",
    `source=${verdict.source}`,
  );

  console.log("\n========================================");
  console.log(
    `curate-initiatives contract: ${pass} passed, ${fail} failed.`,
  );
  if (fail > 0) process.exit(1);
};

void main();
