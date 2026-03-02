import { expect, test } from "@playwright/test";

test("homepage has an h1 containing Scriptor", async ({ page }) => {
	await page.goto("/");
	await expect(page.locator("h1")).toContainText("Scriptor");
});

test("homepage has exactly three platform cards", async ({ page }) => {
	await page.goto("/");
	const cards = page.locator("[data-testid^='platform-card-']");
	await expect(cards).toHaveCount(3);
});

test("Windows platform card has correct href", async ({ page }) => {
	await page.goto("/");
	const windowsCard = page.locator("[data-testid='platform-card-windows']");
	await expect(windowsCard).toHaveAttribute("href", /\/scripts\/windows/);
});

test("Linux platform card has correct href", async ({ page }) => {
	await page.goto("/");
	const linuxCard = page.locator("[data-testid='platform-card-linux']");
	await expect(linuxCard).toHaveAttribute("href", /\/scripts\/linux/);
});

test("macOS platform card has correct href", async ({ page }) => {
	await page.goto("/");
	const macCard = page.locator("[data-testid='platform-card-mac']");
	await expect(macCard).toHaveAttribute("href", /\/scripts\/mac/);
});

test("homepage has install-command placeholder", async ({ page }) => {
	await page.goto("/");
	await expect(page.locator("[data-testid='install-command']")).toBeAttached();
});

// Task 4 — InstallCommand component tests

test("install-command contains a code or pre child with non-empty text", async ({
	page,
}) => {
	await page.goto("/");
	const installCmd = page.locator("[data-testid='install-command']");
	const codeEl = installCmd.locator("code, pre").first();
	await expect(codeEl).toBeVisible();
	const text = await codeEl.textContent();
	expect(text?.trim().length).toBeGreaterThan(0);
});

test("install-command has a visible Copy button", async ({ page }) => {
	await page.goto("/");
	const copyButton = page
		.locator("[data-testid='install-command']")
		.getByRole("button", { name: /copy/i });
	await expect(copyButton).toBeVisible();
});

test('clicking Copy button shows "Copied!" feedback', async ({ browser }) => {
	const context = await browser.newContext();
	const page = await context.newPage();
	// Redirect /Scriptor/_next/** requests to /_next/** so JS loads from static export
	await page.route("/Scriptor/_next/**", (route) => {
		const url = route.request().url().replace("/Scriptor/_next/", "/_next/");
		route.continue({ url });
	});
	await page.goto("/");
	const installCmd = page.locator("[data-testid='install-command']");
	const copyButton = installCmd.getByRole("button", { name: /copy/i });
	await copyButton.click();
	await expect(installCmd.getByText(/copied!/i)).toBeVisible();
	await context.close();
});

test("Windows user agent shows PowerShell command", async ({ browser }) => {
	const context = await browser.newContext({
		userAgent:
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
	});
	const page = await context.newPage();
	// Redirect /Scriptor/_next/** requests to /_next/** so JS loads from static export
	await page.route("/Scriptor/_next/**", (route) => {
		const url = route.request().url().replace("/Scriptor/_next/", "/_next/");
		route.continue({ url });
	});
	await page.goto("/");
	// Wait for React hydration + useEffect to run and update the command
	const installCmd = page.locator("[data-testid='install-command']");
	const codeEl = installCmd.locator("code, pre").first();
	await expect(codeEl).toContainText("Invoke-WebRequest", { timeout: 10000 });
	await context.close();
});
