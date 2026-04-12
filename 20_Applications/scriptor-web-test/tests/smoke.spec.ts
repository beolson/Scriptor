import { expect, test } from "@playwright/test";

test("home page loads and renders platform cards", async ({ page }) => {
	await page.goto("/");
	// Platform cards link to each OS section
	await expect(
		page.getByRole("link", { name: /debian/i }).first(),
	).toBeVisible();
	await expect(
		page.getByRole("link", { name: /windows/i }).first(),
	).toBeVisible();
});

test("clicking a platform card navigates to that platform's script list", async ({
	page,
}) => {
	await page.goto("/");
	await page
		.getByRole("link", { name: /windows/i })
		.first()
		.click();
	await expect(page).toHaveURL(/\/scripts\/windows/);
	await expect(page.getByText("Fixture Setup Package Manager")).toBeVisible();
});

test("footer shows version string on home page", async ({ page }) => {
	await page.goto("/");
	// The footer renders the version as "v<semver>" — e.g. "v1.2.3"
	await expect(page.locator("footer")).toContainText(/v\d+\.\d+\.\d+/);
});

test("footer shows version string on linux browse page", async ({ page }) => {
	await page.goto("/scripts/debian-13-x64");
	await expect(page.locator("footer")).toContainText(/v\d+\.\d+\.\d+/);
});

test("footer shows version string on group detail page", async ({ page }) => {
	await page.goto("/groups/linux/fixture-group");
	await expect(page.locator("footer")).toContainText(/v\d+\.\d+\.\d+/);
});
