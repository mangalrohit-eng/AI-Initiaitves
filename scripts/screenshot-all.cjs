/* eslint-disable */
// Capture full-page screenshots of every page route in the app.
// Run with: npx playwright install chromium && node scripts/screenshot-all.cjs

const path = require("path");
const fs = require("fs");

const BASE = process.env.BASE_URL || "http://localhost:3000";
const USERNAME = process.env.AUTH_USERNAME || "Towerlead";
const PASSWORD = process.env.AUTH_PASSWORD || "ACN2026";
const OUT_DIR = path.join(__dirname, "..", "screenshots");

const SCREENS = [
  { slug: "01-login",                            url: "/login",                                                                              auth: false },
  { slug: "02-program-home",                     url: "/" },
  { slug: "03-executive-summary",                url: "/summary" },
  { slug: "04-capability-map",                   url: "/capability-map" },
  { slug: "05-capability-map-tower-finance",     url: "/capability-map/tower/finance" },
  { slug: "06-assessment",                       url: "/assessment" },
  { slug: "07-assessment-tower-finance",         url: "/assessment/tower/finance" },
  { slug: "08-assessment-summary",               url: "/assessment/summary" },
  { slug: "09-assess-legacy",                    url: "/assess/legacy" },
  { slug: "10-towers-ai-initiatives",            url: "/towers" },
  { slug: "11-tower-finance",                    url: "/tower/finance" },
  { slug: "12-tower-finance-process",            url: "/tower/finance/process/monthly-quarterly-financial-close-consolidation" },
  { slug: "13-tower-finance-brief",              url: "/tower/finance/brief/content-rights-amortization" },
  { slug: "14-offshore-plan",                    url: "/offshore-plan" },
  { slug: "15-prototypes",                       url: "/prototypes" },
  { slug: "16-delivery-plan",                    url: "/delivery-plan" },
  { slug: "17-workshops",                        url: "/workshops" },
  { slug: "18-assumptions",                      url: "/assumptions" },
  { slug: "19-glossary",                         url: "/glossary" },
  { slug: "20-changelog",                        url: "/changelog" },
];

(async () => {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const { chromium } = require("playwright");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });

  // First capture the unauthenticated login screen
  {
    const loginPage = await context.newPage();
    await loginPage.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await loginPage.waitForLoadState("networkidle").catch(() => {});
    await loginPage.waitForTimeout(500);
    await loginPage.screenshot({
      path: path.join(OUT_DIR, "01-login.png"),
      fullPage: true,
    });
    console.log(`[ok] 01-login.png`);
    await loginPage.close();
  }

  // Authenticate via the API directly so the session cookie is attached to the context
  const loginResp = await context.request.post(`${BASE}/api/login`, {
    data: { username: USERNAME, password: PASSWORD },
    headers: { "Content-Type": "application/json" },
  });
  if (!loginResp.ok()) {
    throw new Error(`Login failed: ${loginResp.status()} ${await loginResp.text()}`);
  }
  console.log(`[auth] signed in as ${USERNAME}`);

  // Pre-warm each route serially so the dev compiler builds them one at a time
  // without overlapping with browser navigation. This mitigates the Windows
  // chunk-resolution race that surfaces under concurrent compile.
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  console.log("[warm] compiling routes serially…");
  for (const screen of SCREENS) {
    if (screen.slug === "01-login") continue;
    const target = `${BASE}${screen.url}`;
    let lastStatus = 0;
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        const r = await context.request.get(target, { timeout: 120000, maxRedirects: 0 });
        lastStatus = r.status();
        // 2xx/3xx means compile finished without 5xx
        if (lastStatus < 500) break;
      } catch (err) {
        lastStatus = -1;
      }
      await sleep(2000 * attempt);
    }
    console.log(`[warm] ${screen.slug.padEnd(40)} ${lastStatus}`);
    await sleep(800);
  }

  // Reuse a single page for all routes — gentler on the Next dev compiler
  // than newPage() per route, which can race the .next cache on Windows.
  const page = await context.newPage();

  for (const screen of SCREENS) {
    if (screen.slug === "01-login") continue; // already captured
    const target = `${BASE}${screen.url}`;
    try {
      const resp = await page.goto(target, { waitUntil: "domcontentloaded", timeout: 90000 });
      await page.waitForLoadState("networkidle", { timeout: 45000 }).catch(() => {});
      await page
        .waitForFunction(
          () => !document.body.innerText.includes("Loading assess workshop"),
          undefined,
          { timeout: 25000 },
        )
        .catch(() => {});
      await page
        .waitForFunction(
          () => {
            const t = document.body.innerText;
            return !/^\s*Loading\.\.\.?\s*$/m.test(t);
          },
          undefined,
          { timeout: 8000 },
        )
        .catch(() => {});
      await page.waitForTimeout(1500);
      const status = resp ? resp.status() : "n/a";
      const finalUrl = page.url();
      await page.screenshot({
        path: path.join(OUT_DIR, `${screen.slug}.png`),
        fullPage: true,
      });
      console.log(`[ok] ${screen.slug}.png  (${status})  -> ${finalUrl}`);
    } catch (err) {
      console.error(`[err] ${screen.slug}: ${err.message}`);
      try {
        await page.screenshot({
          path: path.join(OUT_DIR, `${screen.slug}-ERROR.png`),
          fullPage: true,
        });
      } catch {}
    }
  }
  await page.close();

  await context.close();
  await browser.close();
  console.log(`\nAll screenshots saved to ${OUT_DIR}`);
})();
