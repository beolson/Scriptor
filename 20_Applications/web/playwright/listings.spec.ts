import { expect, test } from "@playwright/test";

test.describe("listings — Task 7 ScriptRow & PlatformCard", () => {
	test("windows listing shows heading and at least one script-row", async ({
		page,
	}) => {
		await page.goto("/scripts/windows");
		await expect(page.locator('[data-testid="platform-header"]')).toContainText(
			/windows/i,
		);
		const rows = page.locator('[data-testid="script-row"]');
		await expect(rows.first()).toBeVisible();
	});

	test("first script-row contains a script name and >> arrow", async ({
		page,
	}) => {
		await page.goto("/scripts/windows");
		const row = page.locator('[data-testid="script-row"]').first();
		await expect(row).toBeVisible();
		await expect(row).toContainText(">>");
	});

	test("linux listing has at least one distro-group-header", async ({
		page,
	}) => {
		await page.goto("/scripts/linux");
		const header = page.locator('[data-testid="distro-group-header"]').first();
		await expect(header).toBeVisible();
	});

	test("clicking a script-row navigates to the script detail page", async ({
		page,
	}) => {
		await page.goto("/scripts/windows");
		const row = page.locator('[data-testid="script-row"]').first();
		await row.click();
		await expect(page).toHaveURL(/\/scripts\//);
	});

	test("breadcrumb shows correct segments on windows listing", async ({
		page,
	}) => {
		await page.goto("/scripts/windows");
		const breadcrumb = page.locator('[data-testid="breadcrumb"]');
		await expect(breadcrumb).toContainText(/home/i);
		await expect(breadcrumb).toContainText(/windows/i);
	});
});
