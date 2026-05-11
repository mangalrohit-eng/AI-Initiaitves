/**
 * Step 4 — questionnaire status strip, journey nudge, workshop hash affordances.
 * Requires dev server + workshop login (same credentials as scripts/httpSmoke.mjs).
 */
import { test, expect } from "@playwright/test";

const TOWER_PATH = "/tower/finance";

test.describe("Step 4 AI readiness questionnaire UX", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.locator("#username").fill("Towerlead");
    await page.locator("#password").fill("ACN2026");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/^(?!.*\/login)/, { timeout: 15_000 });
  });

  test("shows questionnaire status region and workshop-tools anchor", async ({
    page,
  }) => {
    await page.goto(TOWER_PATH, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await expect(
      page.locator('[aria-label="Tower AI readiness questionnaire status"]'),
    ).toBeVisible({ timeout: 20_000 });

    await expect(page.locator("#workshop-tools")).toBeVisible();
    await expect(
      page.locator('[aria-label="Primary next action for this page"]'),
    ).toBeVisible();
  });

  test("guidance nudge mentions questionnaire when no intake (fresh profile)", async ({
    page,
  }) => {
    await page.goto(TOWER_PATH, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    const guidance = page.getByRole("region", {
      name: /Primary next action for this page/i,
    });
    await expect(guidance).toContainText(/Forge Tower AI Questionnaire|Questionnaire/i);
    await expect(
      guidance.getByRole("link", { name: /Open workshop tools/i }),
    ).toBeVisible();
  });

  test("hash opens workshop drawer", async ({ page }) => {
    await page.goto(`${TOWER_PATH}#workshop-tools`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await expect(page.locator("#workshop-tools")).toBeVisible();
    const drawerBtn = page.getByRole("button", { name: /Workshop tools/i });
    await expect(drawerBtn).toHaveAttribute("aria-expanded", "true", {
      timeout: 10_000,
    });
    await expect(page.getByRole("button", { name: /Import \.xlsx/i })).toBeVisible();
  });
});
