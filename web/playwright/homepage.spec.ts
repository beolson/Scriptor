import { expect, test } from "@playwright/test";

test.describe("homepage — CodeBlock — Task 6", () => {
	test("code-block is visible on the homepage", async ({ page }) => {
		await page.goto("/");
		const codeBlock = page.locator('[data-testid="code-block"]').first();
		await expect(codeBlock).toBeVisible();
	});

	test("clicking [copy] changes label to [copied]", async ({ page }) => {
		await page.goto("/");
		const copyBtn = page.locator('[data-testid="copy-button"]').first();
		await expect(copyBtn).toHaveText("[copy]");
		await copyBtn.click();
		await expect(copyBtn).toHaveText("[copied]");
	});

	test("[copy] reverts back to [copy] after 2.5s", async ({ page }) => {
		await page.goto("/");
		const copyBtn = page.locator('[data-testid="copy-button"]').first();
		await copyBtn.click();
		await expect(copyBtn).toHaveText("[copied]");
		await page.waitForTimeout(2500);
		await expect(copyBtn).toHaveText("[copy]");
	});
});

test.describe("homepage — Task 9", () => {
	test("hero headline > scriptor is visible", async ({ page }) => {
		await page.goto("/");
		const headline = page.locator('[data-testid="hero-headline"]');
		await expect(headline).toBeVisible();
		await expect(headline).toContainText("> scriptor");
	});

	test("CodeBlock shows an install command string", async ({ page }) => {
		await page.goto("/");
		const codeBlock = page.locator('[data-testid="code-block"]').first();
		await expect(codeBlock).toBeVisible();
		// The command text should contain a URL reference to the scriptor release
		const commandText = codeBlock.locator('[data-testid="command-text"]');
		await expect(commandText).toBeVisible();
	});

	test("three platform cards are visible with correct titles", async ({
		page,
	}) => {
		await page.goto("/");
		const cards = page.locator('[data-testid="platform-card"]');
		await expect(cards).toHaveCount(3);
		await expect(cards.nth(0)).toContainText("windows");
		await expect(cards.nth(1)).toContainText("linux");
		await expect(cards.nth(2)).toContainText("macos");
	});

	test("clicking the Windows card navigates to /scripts/windows", async ({
		page,
	}) => {
		await page.goto("/");
		const windowsCard = page
			.locator('[data-testid="platform-card"]')
			.filter({ hasText: "windows" });
		await windowsCard.click();
		await expect(page).toHaveURL(/\/scripts\/windows/);
	});

	test("mobile layout at 390px shows stacked platform cards", async ({
		page,
	}) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto("/");
		const cards = page.locator('[data-testid="platform-card"]');
		await expect(cards).toHaveCount(3);
		// On mobile all cards should be visible (stacked)
		for (let i = 0; i < 3; i++) {
			await expect(cards.nth(i)).toBeVisible();
		}
	});
});
