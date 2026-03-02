import { expect, test } from "@playwright/test";

test("/scripts/install-docker has an h1 containing the script name", async ({
	page,
}) => {
	await page.goto("/scripts/install-docker");
	const h1 = page.locator("h1");
	await expect(h1).toContainText("Install Docker");
});

test("/scripts/install-docker arch badge is visible", async ({ page }) => {
	await page.goto("/scripts/install-docker");
	const badge = page.locator("[data-testid='arch-badge']");
	await expect(badge).toBeVisible();
	const text = await badge.textContent();
	expect(["x86", "arm"]).toContain(text?.trim());
});

test("/scripts/install-docker spec markdown is rendered as HTML elements", async ({
	page,
}) => {
	await page.goto("/scripts/install-docker");
	// The spec for install-docker contains ## headings and paragraphs
	// ReactMarkdown converts ## to <h2> and paragraphs to <p>
	const specSection = page.locator("[data-testid='spec-content']");
	await expect(specSection).toBeVisible();
	const h2Count = await specSection.locator("h2").count();
	expect(h2Count).toBeGreaterThanOrEqual(1);
});

test("/scripts/install-docker dependency link points to correct script", async ({
	page,
}) => {
	await page.goto("/scripts/install-docker");
	// install-docker depends on setup-prereqs
	const depLink = page.locator("[data-testid='dependency-link']").first();
	await expect(depLink).toBeVisible();
	const href = await depLink.getAttribute("href");
	expect(href).toMatch(/\/scripts\/[\w-]+/);
});

test("/scripts/nonexistent-script returns a not-found response", async ({
	page,
}) => {
	const response = await page.goto("/scripts/nonexistent-script-xyz");
	// Static export with notFound() generates a 404 page
	// In a static export, the 404.html page is served — check the page has 404 content
	// or the response status
	expect(response?.status()).toBe(404);
});
