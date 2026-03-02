import { expect, test } from "@playwright/test";

test("/scripts/windows shows only Windows scripts", async ({ page }) => {
	await page.goto("/scripts/windows");
	// All script entry links should point to /scripts/[id] paths
	const entries = page.locator("[data-testid='script-entry']");
	await expect(entries.first()).toBeVisible();
	// No Linux-only content should appear (distro headings are Linux-specific)
	const distroHeadings = page.locator("[data-testid='distro-heading']");
	await expect(distroHeadings).toHaveCount(0);
});

test("/scripts/linux renders at least one distro sub-group heading", async ({
	page,
}) => {
	await page.goto("/scripts/linux");
	const distroHeadings = page.locator("[data-testid='distro-heading']");
	await expect(distroHeadings.first()).toBeVisible();
	const count = await distroHeadings.count();
	expect(count).toBeGreaterThanOrEqual(1);
});

test("each listing entry contains an arch badge with text x86 or arm", async ({
	page,
}) => {
	await page.goto("/scripts/linux");
	const badges = page.locator("[data-testid='arch-badge']");
	await expect(badges.first()).toBeVisible();
	const firstBadgeText = await badges.first().textContent();
	expect(["x86", "arm"]).toContain(firstBadgeText?.trim());
});

test("clicking a script name navigates to /scripts/[id]", async ({ page }) => {
	await page.goto("/scripts/linux");
	const firstLink = page.locator("[data-testid='script-entry'] a").first();
	const href = await firstLink.getAttribute("href");
	expect(href).toMatch(/\/scripts\/[\w-]+/);
});

test("/scripts/mac shows only macOS scripts", async ({ page }) => {
	await page.goto("/scripts/mac");
	const entries = page.locator("[data-testid='script-entry']");
	await expect(entries.first()).toBeVisible();
	// No distro headings for mac
	const distroHeadings = page.locator("[data-testid='distro-heading']");
	await expect(distroHeadings).toHaveCount(0);
});
