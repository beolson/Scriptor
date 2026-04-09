import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
	await page.goto("/scripts/windows");
});

test("browse page loads and shows windows scripts", async ({ page }) => {
	await expect(page.getByText("Fixture Setup Package Manager")).toBeVisible();
	await expect(page.getByText("Fixture Install Git")).toBeVisible();
	await expect(page.getByText("Fixture Install Editor")).toBeVisible();
});

test("each script row shows its description", async ({ page }) => {
	await expect(
		page.getByText("A fixture script for setting up the package manager."),
	).toBeVisible();
});

test("clicking a script row navigates to the detail page", async ({ page }) => {
	await page.getByText("Fixture Setup Package Manager").click();

	await expect(page).toHaveURL(
		/\/scripts\/windows\/windows-11-x64\/fixture-setup-pkgmgr/,
	);
	await expect(
		page.getByRole("heading", { name: /Fixture Setup Package Manager/ }),
	).toBeVisible();
});
