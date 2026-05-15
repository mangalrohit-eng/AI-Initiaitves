/**
 * Step 2 — Offshore View capability map (gccPct model).
 *
 * Validates the rewritten `OffshoreViewTowerClient` boots after login,
 * hydrates the localStorage-backed program, renders the L1 → L2 → L3
 * → L4 capability map, and exposes the action-bar affordances.
 * Requires `next start` on the configured base URL (3000 by default,
 * 3999 when PLAYWRIGHT_BASE_URL is set).
 */
import { test, expect } from "@playwright/test";

const PATH = "/offshore-view/tower/finance";

test.describe("Step 2 — Offshore View capability map", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.locator("#username").fill("Towerlead");
    await page.locator("#password").fill("ACN2026");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/^(?!.*\/login)/, { timeout: 15_000 });
  });

  test("hydrates and renders the capability map chrome", async ({ page }) => {
    await page.goto(PATH, { waitUntil: "domcontentloaded", timeout: 90_000 });

    // Once hydrated, the client component replaces the SSR Suspense
    // fallback. The page heading carries the chevron prefix used
    // throughout the design system.
    await expect(
      page.getByRole("heading", { name: /Finance · Offshore View/i }),
    ).toBeVisible({ timeout: 20_000 });

    // Action bar — every CTA visible (even disabled-because-locked
    // is fine; we only assert presence here).
    await expect(page.getByRole("button", { name: /Refresh AI/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Accept all AI/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Upload override/i })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Download current/i }),
    ).toBeVisible();

    // Sign-off card with the journey CTA.
    await expect(
      page.getByText(/Reviewed by Finance tower lead/i),
    ).toBeVisible();
  });

  test("breadcrumbs link back to Capability Map and program home", async ({
    page,
  }) => {
    await page.goto(PATH, { waitUntil: "domcontentloaded", timeout: 90_000 });
    const nav = page.getByRole("navigation", { name: /breadcrumb/i });
    await expect(nav).toBeVisible({ timeout: 20_000 });
    await expect(nav.getByRole("link", { name: /Program home/i })).toBeVisible();
    await expect(
      nav.getByRole("link", { name: /Capability Map/i }).first(),
    ).toBeVisible();
    await expect(nav.getByText(/Offshore View/i)).toBeVisible();
  });
});
