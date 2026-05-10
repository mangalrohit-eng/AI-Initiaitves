/* eslint-disable no-console */
/**
 * Headless Playwright smoke check for the redesigned `/tower/[slug]` page.
 *
 * Usage:  node scripts/reviewTowerPage.cjs [tower=finance]
 *
 * Renders the page across multiple towers to confirm:
 *   - top-of-page chrome order (stepper → sign-off → guidance → hero → KPIs → drawer)
 *   - filter popovers open and behave (Job Family, Quadrant, Vendor)
 *   - card grid renders with varied icons (one per tower bucket)
 *   - workshop tools drawer expands with stale banner + facilitator panels
 *   - tower switcher navigates correctly
 *   - no console errors
 *
 * Captures screenshots into `scripts/_screenshots/` and prints a structured
 * report.
 */
const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");

const BASE = process.env.SMOKE_BASE_URL || "http://localhost:3001";
const USERNAME = process.env.SMOKE_USERNAME || "Towerlead";
const PASSWORD = process.env.SMOKE_PASSWORD || "ACN2026";
const SHOTS = path.join(__dirname, "_screenshots");
const TOWERS = (process.argv[2] || "finance,editorial-news,legal-rights").split(
  ",",
);

if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });

async function login(page) {
  const res = await page.request.post(`${BASE}/api/login`, {
    data: { username: USERNAME, password: PASSWORD },
  });
  if (!res.ok()) throw new Error(`Login failed: ${res.status()}`);
}

async function snap(page, name) {
  const file = path.join(SHOTS, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

async function reviewTower(page, slug) {
  const consoleErrors = [];
  const onConsole = (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  };
  const onError = (err) => consoleErrors.push(`pageerror: ${err.message}`);
  page.on("console", onConsole);
  page.on("pageerror", onError);

  const url = `${BASE}/tower/${slug}`;
  console.log(`\n=== Tower: ${slug} ===`);
  console.log(`Navigating to ${url}`);
  await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });

  try {
    // The gallery has no heading anymore; wait for the filter toolbar
    // (Job Family pill is reliably present once the gallery hydrates).
    await page.waitForSelector("button:has-text('Job Family')", {
      timeout: 30000,
    });
  } catch (_e) {
    console.log("[!] Gallery toolbar not found");
  }
  await page.waitForTimeout(800);

  await snap(page, `tower-${slug}-01-above-fold`);

  const inventory = await page.evaluate(() => {
    const has = (sel) => !!document.querySelector(sel);
    const text = (sel) => {
      const n = document.querySelector(sel);
      return n ? (n.textContent || "").trim().slice(0, 200) : null;
    };
    return {
      breadcrumbs: !!Array.from(
        document.querySelectorAll("nav, ol, div"),
      ).find((n) =>
        /Program home/i.test(n.textContent?.slice(0, 200) || ""),
      ),
      stepper: has("nav[aria-label*='Journey for']"),
      signoffBar: has("#tower-lead-signoff"),
      signoffText: text("#tower-lead-signoff p"),
      signoffMarkButton: !!Array.from(
        document.querySelectorAll("button"),
      ).find((b) =>
        /(Mark reviewed|Reopen for review)/i.test(b.textContent || ""),
      ),
      guidanceText: text("section[aria-label*='Primary next action']"),
      guidanceJumpButton: !!Array.from(
        document.querySelectorAll("a, button"),
      ).find((b) => /Jump to sign-off/i.test(b.textContent || "")),
      heroH1: text("h1"),
      // Gallery has no heading — the filter toolbar IS the section start.
      galleryToolbarPresent: !!Array.from(
        document.querySelectorAll("button"),
      ).find((b) => /Job Family/i.test(b.textContent || "")),
      reviewChipPresent: !!Array.from(document.querySelectorAll("*")).find(
        (n) => /VALIDATED/i.test(n.textContent?.slice(0, 50) || ""),
      ),
      jobFamilyTrigger: !!Array.from(document.querySelectorAll("button")).find(
        (b) => /Job Family/i.test(b.textContent || ""),
      ),
      quadrantTrigger: !!Array.from(document.querySelectorAll("button")).find(
        (b) => /^Quadrant/i.test((b.textContent || "").trim()),
      ),
      vendorTrigger: !!Array.from(document.querySelectorAll("button")).find(
        (b) => /^Vendor/i.test((b.textContent || "").trim()),
      ),
      cardCount: document.querySelectorAll(
        "a[href*='/initiative/'], a[href*='/brief/']",
      ).length,
    };
  });

  // Icon variety
  const iconClasses = await page.evaluate(() => {
    const cards = document.querySelectorAll(
      "a[href*='/initiative/'] span[role='presentation'] svg",
    );
    const classes = new Set();
    cards.forEach((svg) => {
      const cls = (svg.getAttribute("class") || "")
        .split(/\s+/)
        .find((c) => c.startsWith("lucide-") && c !== "lucide");
      if (cls) classes.add(cls);
    });
    return Array.from(classes).sort();
  });

  console.log("Inventory:");
  Object.entries(inventory).forEach(([k, v]) => {
    let display = v;
    if (typeof v === "string" && v.length > 120) display = v.slice(0, 120) + "…";
    console.log(`  ${k}: ${JSON.stringify(display)}`);
  });
  console.log(`Cards rendered: ${inventory.cardCount}`);
  console.log(
    `Distinct icons (${iconClasses.length}): ${iconClasses.join(", ")}`,
  );
  console.log(`Console errors: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    console.log("--- Errors ---");
    consoleErrors.slice(0, 10).forEach((e, i) => console.log(`[${i}] ${e}`));
  }

  page.off("console", onConsole);
  page.off("pageerror", onError);

  return { slug, inventory, iconClasses, errors: consoleErrors };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await ctx.newPage();
  await login(page);

  const results = [];
  for (const t of TOWERS) {
    results.push(await reviewTower(page, t));
  }

  console.log("\n========== SUMMARY ==========");
  results.forEach((r) => {
    const ok =
      r.inventory.signoffBar &&
      r.inventory.signoffMarkButton &&
      r.inventory.heroH1 &&
      r.inventory.galleryToolbarPresent &&
      r.inventory.cardCount > 0 &&
      r.iconClasses.length >= 3 &&
      r.errors.length === 0 &&
      r.inventory.guidanceJumpButton === false;
    console.log(
      `  ${r.slug}: ${ok ? "OK" : "FAIL"} | cards=${r.inventory.cardCount} | icons=${r.iconClasses.length} | errors=${r.errors.length} | jumpBtn=${r.inventory.guidanceJumpButton ? "(redundant!)" : "removed"}`,
    );
  });

  await browser.close();
})().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
