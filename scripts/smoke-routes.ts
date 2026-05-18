/* eslint-disable no-console */
/**
 * End-to-end test confirming that the Tower Workbench, Orchestration
 * Layer, and supporting touchpoints actually render in the user's
 * browser. We use a real headless Chromium via Playwright to hit each
 * route, wait for the client to hydrate, and assert that the canonical
 * hand-authored text appears in the rendered DOM.
 *
 * Comparisons are case-insensitive: many of our eyebrow labels are
 * displayed with CSS `text-transform: uppercase`, but the source text
 * keeps casing. `innerText` honors the rendered casing, so we lowercase
 * both sides before substring matching.
 *
 * Run from `forge-tower-explorer/`:
 *   npx tsx scripts/smoke-routes.ts
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { chromium } from "playwright-core";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const USERNAME = process.env.SMOKE_USERNAME ?? "Towerlead";
const PASSWORD = process.env.SMOKE_PASSWORD ?? "ACN2026";

type Action = (page: any) => Promise<void>;

type Case = {
  label: string;
  url: string;
  /** Optional setup (e.g. click a tab) after the page loads. */
  prepare?: Action;
  /** Strings the rendered DOM (textContent) MUST contain — case-insensitive. */
  mustContain: string[];
};

const cases: Case[] = [
  {
    label: "Tower page — Finance Workbench (Workbench tab default)",
    url: `${BASE}/tower/finance`,
    mustContain: [
      "Tower Workbench",
      "Custom build",
      "Finance Workbench",
      "Multi-entity close console",
      "Intercompany & bank reconciliation queue",
      "13-week cash & EBITDA forecaster",
      "Covenant headroom monitor",
      "the CFO",
      "e.g., BlackLine",
      "HighRadius",
      "Why one workbench",
      "Why custom build",
      "Digital core",
      "What sits beneath every surface",
      "Workforce shift",
      "The one number that matters",
      "Rollout",
      // Tab control
      "Workbench",
      "AI Solutions",
    ],
  },
  {
    label: "Tower page — Editorial & News Workbench",
    url: `${BASE}/tower/editorial-news`,
    mustContain: [
      "Editorial & News Workbench",
      "Editorial standards gate",
      "standards team",
      "MS NOW",
      "CNBC",
      "Standards review",
      "Human-led, AI-powered",
    ],
  },
  {
    label: "Tower page — Solutions tab caption",
    url: `${BASE}/tower/finance`,
    prepare: async (page) => {
      await page.click('button[role="tab"]:has-text("AI Solutions")');
      await page.waitForTimeout(600);
    },
    // After switching to AI Solutions, at least one Solution card should
    // render with a "Surfaces in <surface name>" caption (the
    // `SolutionCardV2` workbench cross-reference). We don't assert
    // specific solution names — those are LLM-generated and unstable —
    // we just confirm the caption text appears.
    mustContain: [
      "Surfaces in",
    ],
  },
  {
    label: "Cross-tower AI plan — Cross-tower outcomes tab (Orchestration section)",
    url: `${BASE}/program/cross-tower-ai-plan`,
    prepare: async (page) => {
      // The orchestration content lives inside the
      // "Cross-tower outcomes" tab, not on the default "Approach" tab.
      await page.click('button:has-text("Cross-tower outcomes")');
      await page.waitForTimeout(800);
      // Scroll to the canonical orchestration section so any lazy
      // rendering attached to viewport intersection has a chance to
      // commit.
      await page.evaluate(() => {
        const el = document.getElementById("orchestration");
        if (el) el.scrollIntoView({ behavior: "instant" as ScrollBehavior, block: "start" });
      });
      await page.waitForTimeout(400);
    },
    mustContain: [
      "Canonical Orchestration Layer",
      "The shared fabric every Tower Workbench plugs into",
      "How the layers stack",
      "Tower Workbenches",
      "Illustrative vendor point solutions",
      "Where the data actually lives",
      "How point solutions feed the layer",
      "Agents that work for every tower",
      "Policies enforced on every agent decision",
      "Versant Identity Graph",
      "Versant Knowledge Graph",
      "BlackLine",
      "Eightfold",
      "Strategist commentary",
    ],
  },
  {
    label: "Glossary",
    url: `${BASE}/glossary`,
    mustContain: [
      "Tower Workbench",
      "Workbench Surface",
      "Orchestration Layer",
      "Cross-cutting agent",
    ],
  },
  {
    label: "Changelog",
    url: `${BASE}/changelog`,
    mustContain: [
      "Tower Workbenches",
      "Orchestration Layer",
    ],
  },
];

async function loginAndApplyCookies(ctx: any) {
  const res = await ctx.request.post(`${BASE}/api/login`, {
    data: { username: USERNAME, password: PASSWORD },
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok()) {
    throw new Error(`Login failed: ${res.status()} ${await res.text()}`);
  }
}

async function runCase(
  page: any,
  c: Case,
): Promise<{ pass: number; fail: number; missing: string[] }> {
  console.log(`\n--- ${c.label} ---`);
  console.log(`  GET ${c.url}`);
  await page.goto(c.url, { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForTimeout(700);
  if (c.prepare) {
    try {
      await c.prepare(page);
    } catch (e) {
      console.log(`  [prepare error] ${(e as Error).message}`);
    }
  }
  const text: string = (await page.evaluate(() => document.body.innerText))
    .toString()
    .toLowerCase();
  let pass = 0;
  let fail = 0;
  const missing: string[] = [];
  for (const m of c.mustContain) {
    if (text.includes(m.toLowerCase())) {
      console.log(`  PASS  contains "${m}"`);
      pass += 1;
    } else {
      console.log(`  FAIL  missing  "${m}"`);
      fail += 1;
      missing.push(m);
    }
  }
  return { pass, fail, missing };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    page.on("pageerror", (err: any) => {
      console.log(`  [pageerror] ${err.message}`);
    });
    page.on("console", (msg: any) => {
      if (msg.type() === "error") {
        const text = msg.text();
        if (text.includes("sw.js") || text.includes("DevTools")) return;
        console.log(`  [console.error] ${text}`);
      }
    });

    await loginAndApplyCookies(ctx);

    let totalPass = 0;
    let totalFail = 0;
    const allMissing: { label: string; missing: string[] }[] = [];
    for (const c of cases) {
      const { pass, fail, missing } = await runCase(page, c);
      totalPass += pass;
      totalFail += fail;
      if (missing.length) allMissing.push({ label: c.label, missing });
    }

    console.log(`\n=== RESULT ===`);
    console.log(`pass: ${totalPass}  fail: ${totalFail}`);
    if (allMissing.length) {
      console.log(`\nFailed assertions:`);
      for (const { label, missing } of allMissing) {
        console.log(`  ${label}`);
        for (const m of missing) console.log(`    - "${m}"`);
      }
    }
    process.exit(totalFail === 0 ? 0 : 1);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
