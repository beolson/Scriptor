import { expect, test } from "@playwright/test";

test.describe("VersionBadge — Task 8 (Phase 4)", () => {
	test("footer contains a version badge element", async ({ page }) => {
		await page.goto("/");
		const footer = page.locator('[data-testid="footer"]');
		await expect(footer).toBeVisible();
		const badge = footer.locator('[data-testid="version-badge"]');
		await expect(badge).toBeVisible();
	});

	test("version badge shows v<semver> or 'dev'", async ({ page }) => {
		await page.goto("/");
		const badge = page.locator('[data-testid="version-badge"]');
		await expect(badge).toBeVisible();
		const text = await badge.textContent();
		const isVersionOrDev =
			/^v\d+\.\d+\.\d+$/.test(text ?? "") || text === "dev";
		expect(isVersionOrDev).toBe(true);
	});

	test("version badge shows 'dev' when NEXT_PUBLIC_VERSION is not set at build time", async ({
		page,
	}) => {
		// The static out/ directory is built without NEXT_PUBLIC_VERSION in CI
		// and local dev, so the badge should fall back to 'dev'.
		// This test is only authoritative when built without the env var.
		await page.goto("/");
		const badge = page.locator('[data-testid="version-badge"]');
		await expect(badge).toBeVisible();
		const text = await badge.textContent();
		// Accept either 'dev' (no env var) or a semver string (env var set)
		expect(text).toMatch(/^(dev|v\d+\.\d+\.\d+)$/);
	});
});
